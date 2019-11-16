import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FirebaseService } from './firebase.service';
import { WorkerService, WebWorker } from './worker.service';
import { MatchMessage, MatchingState, ParseResult } from '@models/common';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import _ from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  /** Dictionaries collection name. */
  private static readonly DICTIONARIES_COLLECTION: string = 'dictionaries';
  /** Categories collection name. */
  private static readonly CATEGORIES_COLLECTION: string = 'categories';
  /** Files collection name. */
  private static readonly FILES_COLLECTION: string = 'files';
  private _categories: CategoryDoc[] = [];
  private _dictionaries: DictionaryDoc[] = [];
  private _dataAvailable: boolean = false;
  private _matchingInProgress: boolean = false;
  private _cancelMatching: boolean = false;
  private _activeWorkers: WebWorker[] = [];
  private _selectedDictionary: string = null;
  private _menuActive: boolean = true;
  private _menuOpened: boolean = true;
  private _keepOpened: boolean = false;
  private _breakpointActive: boolean = false;
  private _needsCleanup: boolean = false;

  /** Responsive breakpoint for minimal menu. */
  static readonly MENU_BREAKPOINT: number = 992;

  /** Emits when the data has changed due to updates or authentication changes. The boolean value indicates the data availability. */
  public onDataChange: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this._dataAvailable);
  /** Emits when prompt state (visibility) changes. */
  public onPromptStateChanged: BehaviorSubject<PromptMessage> = new BehaviorSubject<PromptMessage>({ id: null, visible: false, message: null, title: null });
  /** Used for responding back with an activated prompt. */
  public onPromptResponse: Subject<PromptResponse> = new Subject<PromptResponse>();
  /** Emits when dictionary selection changes with a dictionary ID or null if none selected. */
  public onDictionarySelectionChanged: BehaviorSubject<string> = new BehaviorSubject<string>(this.selectedDictionary);
  /** Emits when the active state of the left menu changes. */
  public onMenuStateChanged: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this._menuActive);
  /** Emits when the opened/closed state of the left menu changes. */
  public onMenuAccessibilityChanged: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this._menuOpened);
  /** Emits when a cleanup needs to occur after matching. */
  public onMatchingCleanup: Subject<void> = new Subject<void>();
  /** Emits when application view needs to switch to Form state. */
  public onSetViewToForm: Subject<void> = new Subject<void>();

  constructor(
    private firebase: FirebaseService,
    private worker: WorkerService,
    private http: HttpClient
  ) {

    this.firebase.onAuthChange.subscribe(authenticated => {

      // If authenticated, load the dictionaries and categories
      if ( authenticated ) {

        this.firebase.getAllDocuments(AppService.DICTIONARIES_COLLECTION)
        .then(docs => {

          this._dictionaries = docs.map(doc => {

            return {
              id: doc.id,
              name: doc.get('name'),
              language: doc.get('language'),
              description: doc.get('description'),
              mappingFileId: doc.get('mappingFileId'),
              categoryId: doc.get('categoryId')
            };

          });

          return this.firebase.getAllDocuments(AppService.CATEGORIES_COLLECTION);

        })
        .then(docs => {

          this._categories = docs.map(doc => {

            return {
              id: doc.id,
              name: doc.get('name')
            };

          });

          this._dataAvailable = true;
          this.onDataChange.next(this._dataAvailable);

        })
        .catch(error => {

          console.error(error);

          this._categories = [];
          this._dictionaries = [];
          this._dataAvailable = false;
          this.onDataChange.next(this._dataAvailable);

        });

      }
      // Otherwise, unload the dictionaries and categories
      else {

        this._categories = [];
        this._dictionaries = [];
        this._dataAvailable = false;
        this.onDataChange.next(this._dataAvailable);

      }

    });

  }

  private async _match(dictionary: DictionaryDoc, input: any[], listener: BehaviorSubject<MatchMessage>, parsingTime: number, quickMatch: boolean = false, targetHeader?: string) {

    // Check for cancellation
    if ( this._cancelMatching ) {

      this._cancelMatching = false;
      this._matchingInProgress = false;
      this._needsCleanup = false;
      return;

    }

    this._matchingInProgress = true;

    listener.next({ state: MatchingState.Downloading, message: 'Downloading the classification dictionary...' });

    let downloadTimeStart: number = performance.now();

    // Download the mappings file
    const doc = await this.firebase.getDocument(AppService.FILES_COLLECTION, dictionary.mappingFileId);
    const mappingsFileUrl = await this.firebase.getFileUrl(doc.get('filename'));
    const mappingsCompressed = await this.http.get(mappingsFileUrl, { responseType: 'arraybuffer' }).toPromise();

    let downloadTimeEnd: number = performance.now();

    // Check for cancellation
    if ( this._cancelMatching ) {

      this._cancelMatching = false;
      this._matchingInProgress = false;
      this._needsCleanup = false;
      return;

    }

    // Create web worker
    const matcher = this.worker.wrap(new Worker('../workers/matcher.worker', { type: 'module' }));

    // Add to active workers for future cancellation
    this._activeWorkers.push(matcher);

    // Start the matching process and listen to messages
    matcher
    .send({
      input: input,
      dictionary: mappingsCompressed,
      quickMatch: quickMatch,
      downloadTime: Math.round(downloadTimeEnd - downloadTimeStart),
      parsingTime: parsingTime,
      targetHeader: targetHeader
    })
    .listen<MatchMessage>(data => {

      // Error message
      if ( data.state === MatchingState.Error ) {

        listener.error(data.error);
        matcher.terminate();
        this._matchingInProgress = false;

      }
      // Normal message
      else {

        listener.next(data);

      }

      // Finish message
      if ( data.state === MatchingState.Finished ) {

        listener.complete();
        matcher.terminate();
        this._matchingInProgress = false;

      }

    });

  }

  /**
  * Returns the last cached categories.
  */
  public get categories(): CategoryDoc[] {

    return _.cloneDeep(this._categories);

  }

  /**
  * Returns the last cached dictionaries.
  */
  public get dictionaries(): DictionaryDoc[] {

    return _.cloneDeep(this._dictionaries);

  }

  /**
  * Starts the matching process. Returns a BehaviorSubject emitting MatchMessage objects which can be used to track the progress and retrieve the end result.
  * @param dictionary The dictionary document.
  * @param input The parsed input.
  * @param parsingTime The parsing time indicated by the parser.
  * @param quickMatch Indicates if the input is a list of string literals and not a CSV file.
  * @param targetHeader The column that should be used as literals when input is a CSV file.
  */
  public match(dictionary: DictionaryDoc, input: any[], parsingTime: number, quickMatch: boolean = false, targetHeader?: string): BehaviorSubject<MatchMessage> {

    this._cancelMatching = false;
    this._needsCleanup = true;

    const listener = new BehaviorSubject<MatchMessage>({ state: MatchingState.Started, message: 'Matching your data...' });

    this._match(dictionary, input, listener, parsingTime, quickMatch, targetHeader)
    .catch(listener.error);

    return listener;

  }

  /**
  * Prompts the user to cancel the matching if it's in progress.
  * Returns the user decision as boolean or true if no matching is in progress.
  */
  public async promptMatchCancellation(): Promise<boolean> {

    // Return true if no matching is in progress
    if ( ! this._matchingInProgress ) return true;

    // Prompt the user
    this.onPromptStateChanged.next({
      id: 'matching-cancellation',
      visible: true,
      message: 'Navigating away will cancel the matching. Do you wish to continue?',
      title: 'warning'
    });

    return await new Promise<boolean>(resolve => {

      let sub: Subscription;

      // Listen to user response
      sub = this.onPromptResponse.subscribe(response => {

        // If response is for another prompt, ignore
        if ( response.id !== 'matching-cancellation' ) return;

        // Cancel if necessary
        if ( response.answer ) {

          this._cancelMatching = true;

          // Only set matching in progress to false if the matching is in the worker phase
          if ( this._activeWorkers.length ) this._matchingInProgress = false;

          while ( this._activeWorkers.length ) {

            this._activeWorkers.pop().terminate();

          }

          this._needsCleanup = false;

        }

        // Otherwise, resolve with user's answer
        sub.unsubscribe();
        resolve(response.answer);

      });

    });

  }

  /**
  * Parses the string input as a CSV file.
  * @param input The CSV file content as string.
  */
  public async parseCSV(input: string) {

    const parser = this.worker.wrap(new Worker('../workers/parser.worker', { type: 'module' }));

    this._activeWorkers.push(parser);

    return await parser.send({ csv: true, input: input }).toPromise<ParseResult>();

  }

  /**
  * Parses a newline-delimited list of string literals.
  * @param input The list of string literals.
  */
  public async parsePlainLiterals(input: string) {

    const parser = this.worker.wrap(new Worker('../workers/parser.worker', { type: 'module' }));

    this._activeWorkers.push(parser);

    return await parser.send({ csv: false, input: input }).toPromise<ParseResult>();

  }

  /**
  * Marks a dictionary as selected if matching is not in progress.
  * @param id The dictionary ID.
  */
  public selectDictionary(id: string) {

    if ( this._matchingInProgress ) return;

    this._selectedDictionary = id;
    this.onDictionarySelectionChanged.next(id);

  }

  /**
  * Returns the current selected dictionary ID or null if none.
  */
  public get selectedDictionary(): string {

    return this._selectedDictionary;

  }

  /**
  * Reads file's content.
  * @param file A file object retrieved from a FileList.
  */
  public readFile(file: File): Promise<string> {

    return new Promise((resolve, reject) => {

      if ( ! file ) return resolve(null);

      const reader = new FileReader();

      // On file read
      reader.onloadend = () => {

        if ( reader.error ) reject(reader.error);
        else resolve(<string>reader.result);

      };

      // Start reading the file
      reader.readAsText(file, 'utf8');

    });

  }

  /**
  * Returns the accessibility state of the left menu.
  */
  public get menuOpened(): boolean {

    return this._menuOpened;

  }

  /**
  * Sets the left menu active or inactive.
  * @param active A boolean indicating the state of the menu.
  */
  public setMenuActive(active: boolean) {

    this._menuActive = active;
    this.onMenuStateChanged.next(active);

  }

  /**
  * Closes the left menu.
  * @param force Force closes the menu if it was kept open (also resets keepOpened).
  */
  public closeMenu(force?: boolean) {

    if ( ! this._menuOpened || (! force && this._keepOpened) ) return;

    this.onMenuAccessibilityChanged.next(false);
    this._menuOpened = false;
    this._keepOpened = false;

  }

  /**
  * Opens the left menu.
  * @param keepOpened Keeps the menu opened by ignoring close command (unless forced).
  */
  public openMenu(keepOpened?: boolean) {

    if ( this._menuOpened ) return;

    this.onMenuAccessibilityChanged.next(true);
    this._menuOpened = true;
    this._keepOpened = !! keepOpened;

  }

  /**
  * Sets the left menu's breakpoint active or deactive.
  * @param active The active state.
  */
  public setBreakpointActive(active: boolean) {

    this._breakpointActive = active;

    if ( ! active ) this._keepOpened = false;

  }

  /**
  * Left menu breakpoint active state.
  */
  public get breakpointActive(): boolean {

    return this._breakpointActive;

  }

  /**
  * Triggers a matching cleanup if necessary.
  */
  public matchCleanup(): void {

    if ( ! this._needsCleanup ) return;

    this.onMatchingCleanup.next();
    this._needsCleanup = false;

  }

}

export interface CategoryDoc {

  id: string;
  name: string;

}

export interface DictionaryDoc {

  id: string;
  name: string;
  language: string;
  description: string;
  mappingFileId: string;
  categoryId: string;

}

export interface FileDoc {

  filename: string;
  version: number;
  commitId: string;

}

export interface PromptMessage {

  id: string;
  visible: boolean;
  message: string;
  title: string;

}

export interface PromptResponse {

  id: string;
  answer: boolean;

}
