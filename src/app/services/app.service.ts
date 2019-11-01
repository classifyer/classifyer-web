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

  /** Emits when the data has changed due to updates or authentication changes. The boolean value indicates the data availability. */
  public onDataChange: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this._dataAvailable);
  /** Emits when prompt state (visibility) changes. */
  public onPromptStateChanged: BehaviorSubject<PromptMessage> = new BehaviorSubject<PromptMessage>({ id: null, visible: false, message: null, title: null });
  /** Used for responding back with an activated prompt. */
  public onPromptResponse: Subject<PromptResponse> = new Subject<PromptResponse>();

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

      console.log('Matching cancelled!');
      this._cancelMatching = false;
      this._matchingInProgress = false;
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

      console.log('Matching cancelled!');
      this._cancelMatching = false;
      this._matchingInProgress = false;
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

    if ( ! this._matchingInProgress ) this._selectedDictionary = id;

  }

  /**
  * Returns the current selected dictionary ID or null if none.
  */
  public get selectedDictionary(): string {

    return this._selectedDictionary;

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
