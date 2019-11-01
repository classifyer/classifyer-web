import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppService, DictionaryDoc } from '@services/app';
import { MatchingState, ParseResult } from '@models/common'
import { PromptComponent } from '@components';
import _ from 'lodash';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  @ViewChild('csvInput', { static: true })
  public csvInput: ElementRef<HTMLInputElement>;

  public dataAvailable: boolean = false;
  public dictionaries: DictionaryDoc[] = [];
  public headers: string[] = [];

  @ViewChild(PromptComponent, { static: false })
  private prompt: PromptComponent;
  private userInput: ParseResult = null;

  constructor(
    private app: AppService
  ) {}

  ngOnInit() {

    this.app.onDataChange.subscribe(available => {

      this.dataAvailable = available;

      console.log('DATA AVAILABILITY:', available);

      if ( ! available ) return;

      this.dictionaries = this.app.dictionaries;

    });

    this.app.onPromptStateChanged.subscribe(state => {

      if ( this.prompt ) this.prompt.setState(state);
      else if ( state.id !== null ) console.error('Could not set state', state, 'because prompt is', this.prompt);

    });

  }

  public onCSVChanged() {

    this.userInput = null;
    this.headers = [];

    // Get reference to the file input
    const file: File = this.csvInput.nativeElement.files.length ? this.csvInput.nativeElement.files.item(0) : null;

    if ( ! file ) return;

    // Read the file content
    const reader = new FileReader();

    // When file read
    reader.onloadend = () => {

      this.app.parseCSV(<string>reader.result)
      .then(result => {

        this.userInput = result;

        if ( result.result && result.result.length ) this.headers = _.keys(result.result[0]);

        console.log(this.userInput);

      })
      .catch(console.error);

    };

    // Start reading the file
    reader.readAsText(file, 'utf8');

  }

  public onFormSubmit(form: NgForm) {

    if ( form.invalid || ! this.userInput ) return;

    console.log(`Selected dictionary: ${this.dictionaries[+form.value.dictionary].name}`);

    let sub: Subscription;

    // sub = this.app.match(this.dictionaries[+form.value.dictionary], this.userInput.result, this.userInput.time, false, this.headers[+form.value.header])
    // .subscribe(progress => {
    //
    //   console.log(progress);
    //
    //   if ( progress.state === MatchingState.Finished ) {
    //
    //     sub.unsubscribe();
    //
    //   }
    //
    // });

    this.app.parsePlainLiterals('Islam\nAtheist')
    .then(result => {

      this.userInput = result;

      console.log(this.userInput);

      sub = this.app.match(this.dictionaries[+form.value.dictionary], this.userInput.result, this.userInput.time, true)
      .subscribe(progress => {

        console.log(progress);

        if ( progress.state === MatchingState.Finished ) {

          sub.unsubscribe();

        }

      });

    })
    .catch(console.error);

  }

}
