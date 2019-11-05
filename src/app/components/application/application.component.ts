import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AppService, DictionaryDoc } from '@services/app';
import { ParseResult, MatchingState, MatchResult } from '@models/common';
import { Subscription } from 'rxjs';
import _ from 'lodash';

@Component({
  selector: 'app-application',
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.scss']
})
export class ApplicationComponent implements OnInit, OnDestroy {

  @ViewChild('f', { static: false })
  private form: NgForm;
  @ViewChild('fileController', { static: false })
  private fileController: ElementRef<HTMLInputElement>;
  @ViewChild('plainLiteralsController', { static: false })
  private plainLiteralsController: ElementRef<HTMLTextAreaElement>;
  private dictionarySub: Subscription;
  private selectedFile: File = null;
  private parsedInput: ParseResult = null;

  public dictionary: DictionaryDoc = null;
  public csvHeaders: string[] = [];
  public formDisabled: boolean = false;
  public screenStateEnum = ScreenState;
  public state: ScreenState = ScreenState.Form;
  public matchingMessage: string = null;
  public matchResult: MatchResult = null;
  /** Used for styling only when dragging over. */
  public dropboxActive: boolean = false;
  public dropboxDisabled: boolean = false;
  public lottieConfig = {
    path: '/assets/spinner-blue.json',
    autoplay: true,
    loop: true
  };

  constructor(
    private app: AppService
  ) { }

  private parseInput() {

    this.dropboxActive = false;
    this.dropboxDisabled = true;

    this.app.readFile(this.selectedFile)
    .then(input => {

      return this.app.parseCSV(input);

    })
    .then(parsed => {

      this.parsedInput = parsed;

      if ( parsed.result && parsed.result.length ) {

        this.csvHeaders = _.keys(parsed.result[0]);

      }

    })
    .catch(console.error)
    .finally(() => {

      this.dropboxDisabled = false;

    });

  }

  private startMatching(input: ParseResult, quickMatch?: boolean, targetHeader?: string) {

    this.state = ScreenState.Matching;
    this.app.setMenuActive(false);

    const sub = this.app.match(this.dictionary, input.result, input.time, quickMatch, targetHeader).subscribe(message => {

      if ( message.state === MatchingState.Error ) {

        this.state = ScreenState.Error;
        this.matchingMessage = null;
        sub.unsubscribe();
        console.error(message.error);
        this.app.setMenuActive(true);
        return;

      }

      this.matchingMessage = message.message;

      if ( message.state === MatchingState.Finished ) {

        this.matchResult = message.result;
        this.state = ScreenState.Results;
        this.matchingMessage = null;
        sub.unsubscribe();
        this.app.setMenuActive(true);

      }

    });

  }

  ngOnInit() {

    // Listen to dictionary selection changes
    this.dictionarySub = this.app.onDictionarySelectionChanged.subscribe(id => {

      this.dictionary = id ? this.app.dictionaries.find(dic => dic.id === id) : null;

    });

  }

  ngOnDestroy() {

    if ( this.dictionarySub && ! this.dictionarySub.closed ) this.dictionarySub.unsubscribe();

  }

  public allowDrop(event: Event) {

    event.preventDefault();
    this.dropboxActive = true;

  }

  public onDragLeave() {

    this.dropboxActive = false;

  }

  public onDrop(event: DragEvent) {

    event.preventDefault();

    if ( this.dropboxDisabled ) return;

    this.selectedFile = event.dataTransfer.files.item(0) || null;

    if ( this.selectedFile ) this.parseInput();

  }

  public openFileDialog() {

    if ( this.fileController && ! this.dropboxDisabled ) this.fileController.nativeElement.click();

  }

  public onFileChange() {

    if ( ! this.fileController || this.dropboxDisabled ) return;

    this.selectedFile = this.fileController.nativeElement.files.item(0) || null;

    if ( this.selectedFile ) this.parseInput();

  }

  public unloadFile(event: MouseEvent) {

    event.preventDefault();
    event.stopPropagation();
    this.selectedFile = null;
    this.csvHeaders = [];
    this.parsedInput = null;
    this.dropboxDisabled = false;
    this.form.setValue({
      csvFile: null,
      csvHeader: null,
      plainLiterals: this.plainLiteralsController.nativeElement.value || ''
    });

  }

  public onSubmit(form: NgForm) {

    if ( form.invalid ) return;

    // CSV file
    if ( form.value.csvHeader ) {

      this.startMatching(this.parsedInput, false, form.value.csvHeader);

    }
    // Plain literals
    else {

      this.formDisabled = true;

      // Parse the literals
      this.app.parsePlainLiterals(form.value.plainLiterals)
      .then(input => {

        this.startMatching(input, true);

      })
      .catch(console.error)
      .finally(() => {

        this.formDisabled = false;

      });

    }

  }

}

export enum ScreenState {

  Form,
  Matching,
  Results,
  Error

}
