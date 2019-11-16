import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { trigger, state, animate, style, transition, keyframes } from '@angular/animations';
import { AppService, DictionaryDoc } from '@services/app';
import { ParseResult, MatchingState, MatchResult } from '@models/common';
import { Subscription } from 'rxjs';
import _ from 'lodash';
import fileSaver from 'file-saver';
import { ClipboardService } from 'ngx-clipboard';

@Component({
  selector: 'app-application',
  templateUrl: './application.component.html',
  styleUrls: ['./application.component.scss'],
  animations: [
    trigger('fadeIn', [
      state('void', style({
        opacity: 0,
        height: 0,
        margin: 0
      })),
      transition(':enter', animate('.2s .2s'))
    ]),
    trigger('fadeOut', [
      transition(':leave', animate('.2s', keyframes([
        style({ opacity: 1, height: 'auto', 'overflow-y': 'hidden', offset: 0 }),
        style({ opacity: 0, height: 0, 'overflow-y': 'hidden', offset: 1 })
      ])))
    ])
  ]
})
export class ApplicationComponent implements OnInit, OnDestroy {

  @ViewChild('f', { static: false })
  private form: NgForm;
  @ViewChild('fileController', { static: false })
  private fileController: ElementRef<HTMLInputElement>;
  @ViewChild('plainLiteralsController', { static: false })
  private plainLiteralsController: ElementRef<HTMLTextAreaElement>;
  private dictionarySub: Subscription;
  private matchSub: Subscription;
  private cleanupSub: Subscription;
  private stateChangeSub: Subscription;
  private parsedInput: ParseResult = null;
  private matchingAnimation: any = null;

  public selectedFile: File = null;
  public dictionary: DictionaryDoc = null;
  public csvHeaders: string[] = [];
  public formDisabled: boolean = false;
  public screenStateEnum = ScreenState;
  public state: ScreenState = ScreenState.Form;
  public matchingMessage: string = null;
  public matchResult: MatchResult = null;
  public quickMatch: boolean = false;
  /** Used for styling only when dragging over. */
  public dropboxActive: boolean = false;
  public dropboxDisabled: boolean = false;
  public lottieConfig = {
    path: '/assets/spinner-blue.json',
    autoplay: true,
    loop: true
  };
  public lottieConfigSuccess = {
    path: '/assets/match-success.json',
    autoplay: true,
    loop: false
  };
  public lottieConfigFail = {
    path: '/assets/match-fail.json',
    autoplay: true,
    loop: false
  };
  public lottieConfigError = {
    path: '/assets/match-error.json',
    autoplay: true,
    loop: false
  };

  constructor(
    private app: AppService,
    private clipboard: ClipboardService
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

    this.matchSub = this.app.match(this.dictionary, input.result, input.time, quickMatch, targetHeader).subscribe(message => {

      if ( message.state === MatchingState.Error ) {

        this.state = ScreenState.Error;
        this.matchingMessage = null;
        this.matchSub.unsubscribe();
        console.error(message.error);
        this.app.setMenuActive(true);
        return;

      }

      this.matchingMessage = message.message;

      if ( message.state === MatchingState.Finished ) {

        const handler = () => {

          this.matchingAnimation.removeEventListener('complete', handler);
          this.quickMatch = quickMatch;
          this.matchResult = message.result;
          this.state = ScreenState.Results;
          this.matchingMessage = null;
          this.matchSub.unsubscribe();
          this.app.setMenuActive(true);

        };

        this.matchingAnimation.addEventListener('complete', handler);
        this.matchingAnimation.loop = false;

      }

    });

  }

  ngOnInit() {

    this.app.setMenuActive(true);

    // Listen to dictionary selection changes
    this.dictionarySub = this.app.onDictionarySelectionChanged.subscribe(id => {

      this.dictionary = id ? this.app.dictionaries.find(dic => dic.id === id) : null;

    });

    // Listen to cleanup requests
    this.cleanupSub = this.app.onMatchingCleanup.subscribe(() => {

      this.selectedFile = null;
      this.csvHeaders = [];
      this.formDisabled = false;
      this.parsedInput = null;
      this.matchingAnimation = null;
      this.matchingMessage = null;
      this.matchResult = null;
      this.quickMatch = false;
      this.app.setMenuActive(true);

    });

    // Listen to external state changes
    this.stateChangeSub = this.app.onSetViewToForm.subscribe(() => {

      this.state = ScreenState.Form;

    });

  }

  ngOnDestroy() {

    this.app.unmarkCleanup();
    if ( this.dictionarySub && ! this.dictionarySub.closed ) this.dictionarySub.unsubscribe();
    if ( this.matchSub && ! this.matchSub.closed ) this.matchSub.unsubscribe();
    if ( this.cleanupSub && ! this.cleanupSub.closed ) this.cleanupSub.unsubscribe();
    if ( this.stateChangeSub && ! this.stateChangeSub.closed ) this.stateChangeSub.unsubscribe();

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

  public registerMatchingAnimation(anim: any) {

    this.matchingAnimation = anim;

  }

  public delayAnimation(anim: any, delay: number) {

    setTimeout(() => anim.play(), delay);

  }

  public startOver() {

    this.app.onMatchingCleanup.next();
    this.state = ScreenState.Form;

  }

  public downloadResults() {

    fileSaver.saveAs(new Blob([this.matchResult.csv], { type: 'text/csv;charset=utf-8' }), 'results.csv');

  }

  public copyResults() {

    // Copy the content without headers (if newline detection fails it would fallback to copying the headers)
    this.clipboard.copyFromContent(this.matchResult.csv.substr(this.matchResult.csv.indexOf('\n') + 1));

  }

  public roundToDecimal(num: number, precision?: number): number {

    let multiplier = Math.pow(10, precision || 0);

    return Math.round(num * multiplier) / multiplier;

  }

}

export enum ScreenState {

  Form,
  Matching,
  Results,
  Error

}
