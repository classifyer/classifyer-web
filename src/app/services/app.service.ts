import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FirebaseService } from './firebase.service';
import { WorkerService } from './worker.service';
import { MatchMessage, MatchingState, ParseResult } from '@models/common';
import { BehaviorSubject } from 'rxjs';
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
  private dataAvailable: boolean = false;

  /** Emits when the data has changed due to updates or authentication changes. The boolean value indicates the data availability. */
  public onDataChange: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this.dataAvailable);

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

          this.dataAvailable = true;
          this.onDataChange.next(this.dataAvailable);

        })
        .catch(error => {

          console.error(error);

          this._categories = [];
          this._dictionaries = [];
          this.dataAvailable = false;
          this.onDataChange.next(this.dataAvailable);

        });

      }
      // Otherwise, unload the dictionaries and categories
      else {

        this._categories = [];
        this._dictionaries = [];
        this.dataAvailable = false;
        this.onDataChange.next(this.dataAvailable);

      }

    });

  }

  private async _match(dictionary: DictionaryDoc, input: any[], listener: BehaviorSubject<MatchMessage>, parsingTime: number, quickMatch: boolean = false, targetHeader?: string) {

    listener.next({ state: MatchingState.Downloading, message: 'Downloading the classification dictionary...' });

    let downloadTimeStart: number = performance.now();

    // Download the mappings file
    const doc = await this.firebase.getDocument(AppService.FILES_COLLECTION, dictionary.mappingFileId);
    const mappingsFileUrl = await this.firebase.getFileUrl(doc.get('filename'));
    const mappingsCompressed = await this.http.get(mappingsFileUrl, { responseType: 'arraybuffer' }).toPromise();

    let downloadTimeEnd: number = performance.now();

    // Create web worker
    const matcher = this.worker.wrap(new Worker('../workers/matcher.worker', { type: 'module' }));

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

      }
      // Normal message
      else {

        listener.next(data);

      }

      // Finish message
      if ( data.state === MatchingState.Finished ) {

        listener.complete();
        matcher.terminate();

      }

    });

  }

  public get categories(): CategoryDoc[] {

    return _.cloneDeep(this._categories);

  }

  public get dictionaries(): DictionaryDoc[] {

    return _.cloneDeep(this._dictionaries);

  }

  public match(dictionary: DictionaryDoc, input: any[], parsingTime: number, quickMatch: boolean = false, targetHeader?: string): BehaviorSubject<MatchMessage> {

    const listener = new BehaviorSubject<MatchMessage>({ state: MatchingState.Started, message: 'Matching your data...' });

    this._match(dictionary, input, listener, parsingTime, quickMatch, targetHeader)
    .catch(listener.error);

    return listener;

  }

  public async parseCSV(input: string) {

    const parser = this.worker.wrap(new Worker('../workers/parser.worker', { type: 'module' }));

    return await parser.send({ csv: true, input: input }).toPromise<ParseResult>();

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
