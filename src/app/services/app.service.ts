import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FirebaseService } from './firebase.service';
import { WorkerService, WebWorker } from './worker.service';
import { MatchMessage, MatchingState, ParseResult } from '@models/common';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import _ from 'lodash';
import config from '@config';
import { UAParser } from 'ua-parser-js';

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
  /** Determines if device is mobile. */
  public isMobile: boolean = false;

  constructor(
    private firebase: FirebaseService,
    private worker: WorkerService,
    private http: HttpClient
  ) {

    console.log(`VERSION: ${config.version}`);

    // Detect if device is mobile
    if ( window && window.navigator && window.navigator.userAgent ) {

      const info = (new UAParser(window.navigator.userAgent)).getDevice();

      this.isMobile = info && typeof info.type === 'string' && info.type.toLowerCase().trim() === 'mobile';

    }

    // Subscribe to auth changes for loading the data
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

          this.analytics.logErrorReport(error, 'firebase_data_read');

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
    const mappingsFileUrl = await this.firebase.getFileUrl(`${doc.get('basename')}_v${doc.get('version')}.json.gz`);
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
    .listen<MatchMessage>((error, data) => {

      // Exception
      if ( error ) {

        this.analytics.logErrorReport(<Error>error, 'matching_exception_worker');
        listener.error(<Error>error);
        matcher.terminate();
        this._matchingInProgress = false;

        return;

      }

      // Error message
      if ( data.state === MatchingState.Error ) {

        this.analytics.logErrorReport(data.error, 'matching_error_worker');
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

        this.analytics.logMatchStatistics(
          data.result.inputCount,
          data.result.count,
          data.result.totalCount,
          dictionary.name,
          dictionary.language,
          quickMatch,
          Math.round(downloadTimeEnd - downloadTimeStart),
          data.result.decompressionTime,
          data.result.parsingInputTime,
          data.result.parsingOutputTime,
          data.result.matchingTime,
          data.result.totalTime
        );
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
    .catch(error => {

      this.analytics.logErrorReport(error, 'matching_error_promise');
      listener.error(error);

    });

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

    try {

      return await parser.send({ csv: true, input: input }).toPromise<ParseResult>();

    }
    catch (error) {

      this.analytics.logErrorReport(error, 'parsing_csv_exception_worker');
      throw error;

    }

  }

  /**
  * Parses a newline-delimited list of string literals.
  * @param input The list of string literals.
  */
  public async parsePlainLiterals(input: string) {

    const parser = this.worker.wrap(new Worker('../workers/parser.worker', { type: 'module' }));

    this._activeWorkers.push(parser);

    try {

      return await parser.send({ csv: false, input: input }).toPromise<ParseResult>();

    }
    catch (error) {

      this.analytics.logErrorReport(error, 'parsing_plain_exception_worker');
      throw error;

    }

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

        if ( reader.error ) {

          this.analytics.logErrorReport(reader.error, 'file_reader_error');
          reject(reader.error);

        }
        else {

          resolve(<string>reader.result);

        }

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

  /**
  * Unmarks matching cleanup flag.
  */
  public unmarkCleanup(): void {

    this._needsCleanup = false;

  }

  /**
  * Sends an email using the email server (from the app config).
  * @param name The user's name.
  * @param email The user's email.
  * @param subject The email's subject.
  * @param category The email's category.
  * @param message The email's message/body.
  */
  public async sendEmail(name: string, email: string, subject: string, reason: ContactReason, message: string): Promise<ServerResponse> {

    try {

      const response = <ServerResponse>await this.http.post(config.emailServerUrl, {
        name: _.startCase(name.trim().toLowerCase()),
        email: email.trim(),
        subject: _.capitalize(subject.trim()),
        reason: reason,
        message: message.trim(),
        time: Date.now()
      }, {
        headers: { 'Content-Type': 'application/json' }
      }).toPromise();

      if ( response.error ) {

        this.analytics.logErrorReport(<any>response, 'email_server_error');
        throw new Error(response.message);

      }

      return response;

    }
    catch (error) {

      this.analytics.logErrorReport(error, 'email_exception_error');
      throw error;

    }

  }

  /**
  * A Firebase Analytics logger instance.
  */
  public analytics = new AnalyticsLogger(window ? (window.navigator ? window.navigator.userAgent : undefined) : undefined, this.firebase);

}

export class AnalyticsLogger {

  private userAgent: IUAParser.IResult = null;

  constructor(
    userAgent: string,
    private firebase: FirebaseService
  ) {

    // Parse user agent
    this.userAgent = (new UAParser(userAgent)).getResult();

  }

  /**
  * Returns a new date object with timestamp and local time string.
  */
  private getTime() {

    const date = new Date();

    return {
      time_timestamp: date.getTime(),
      time_local: date.toString()
    };

  }

  /**
  * Flattens the parsed user agent.
  */
  private getUserAgent() {

    return {
      ua_original: this.userAgent.ua,
      ua_browser_major: this.userAgent.browser.major,
      ua_browser_name: this.userAgent.browser.name,
      ua_browser_version: this.userAgent.browser.version,
      ua_cpu_arch: this.userAgent.cpu.architecture,
      ua_device_model: this.userAgent.device.model,
      ua_device_type: this.userAgent.device.type,
      ua_device_vendor: this.userAgent.device.vendor,
      ua_engine_name: this.userAgent.engine.name,
      ua_engine_version: this.userAgent.engine.version,
      ua_os_name: this.userAgent.os.name,
      ua_os_version: this.userAgent.os.version
    };

  }

  /**
  * Builds a analytics data log object by appending all metadata properties to it.
  * @param data The data object.
  */
  private buildLogObject(data: Object): Object {

    return _.assign(data, this.getTime(), this.getUserAgent());

  }

  /**
  * Logs an error object.
  * @param error The error object.
  * @param notes Developer notes to help with the classification of the error.
  */
  public logErrorReport(error: Error, notes?: string) {

    const httpErrorBody: any = {};

    // Unwrap http errors with body
    if ( error instanceof HttpErrorResponse && error.error ) {

      httpErrorBody.code = error.error.code;
      httpErrorBody.message = error.error.message;

    }

    const log = {
      notes: notes,
      error_message: error.message,
      error_name: error.name,
      error_code: (<any>error).code,
      error_stack: error.stack,
      error_http_code: httpErrorBody.code,
      error_http_message: httpErrorBody.message
    };

    // Limit log name to 200 bytes
    if ( log.error_name ) log.error_name = log.error_name.substr(0, 200);
    // Limit log message to 1kb
    if ( log.error_message ) log.error_message = log.error_message.substr(0, 1000);
    // Limit log stack to 2kb
    if ( log.error_stack ) log.error_stack = log.error_stack.substr(0, 2000);

    this.firebase.logAnalytics('error_thrown', this.buildLogObject(log));

  }

  /**
  * Logs matching statistics.
  * @param literalsCount The number of literals in the input.
  * @param literalsMatchedCount The number of literals matched (to one or more classifications).
  * @param totalMatchesCount The total number of matches.
  * @param classificationName The name of the classification used.
  * @param classificationLanguage The language of the classification used.
  * @param quickMatch Whether quick matching method was used or not.
  * @param downloadTime The dictionary download time.
  * @param decompressionTime The dictionary decompression time.
  * @param parsingInputTime The input parsing time.
  * @param parsingOutputTime The output parsing time.
  * @param matchingTime The matching time.
  * @param totalTime The total operation time.
  */
  public logMatchStatistics(
    literalsCount: number,
    literalsMatchedCount: number,
    totalMatchesCount: number,
    classificationName: string,
    classificationLanguage: string,
    quickMatch: boolean,
    downloadTime: number,
    decompressionTime: number,
    parsingInputTime: number,
    parsingOutputTime: number,
    matchingTime: number,
    totalTime: number
  ) {

    this.firebase.logAnalytics('matching_done', this.buildLogObject({
      match_literals_count: literalsCount,
      match_matched_literals_count: literalsMatchedCount,
      match_matched_total_count: totalMatchesCount,
      match_class_name: classificationName,
      match_class_lang: classificationLanguage,
      match_quick: quickMatch,
      match_time_download: downloadTime,
      match_time_inflate: decompressionTime,
      match_time_parse_input: parsingInputTime,
      match_time_parse_output: parsingOutputTime,
      match_time_matching: matchingTime,
      match_time_total: totalTime
    }));

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

  basename: string;
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

export interface ServerErrorResponse {

  ok: undefined;
  error: boolean;
  code: string;
  message: string;

}

export interface ServerOkResponse {

  ok: boolean;
  error: undefined;
  code: undefined;
  message: undefined;

}

export type ServerResponse = ServerErrorResponse|ServerOkResponse;

export enum ContactReason {

  GeneralEnquiry = 'General enquiry',
  Bug = 'Reporting a bug',
  Request = 'Feature request',
  Contribution = 'Help with contribution',
  Other = 'Other'

}
