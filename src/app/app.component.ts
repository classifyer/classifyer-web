import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { AppService, DictionaryDoc } from '@services/app';
import { Subscription } from 'rxjs';
import { MatchingState, ParseResult } from '@models/common'
import { NgForm } from '@angular/forms';
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

      // let sub: Subscription;
      //
      // sub = this.app.match(licr, 'islam,Truth Seeker', true)
      // .subscribe(value => {
      //
      //   console.log(value);
      //   if ( value.state === MatchingState.Finished ) {
      //
      //     sub.unsubscribe();
      //     console.log(sub.closed);
      //
      //   }
      //
      // });

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

    sub = this.app.match(this.dictionaries[+form.value.dictionary], this.userInput.result, this.userInput.time, false, this.headers[+form.value.header])
    .subscribe(progress => {

      console.log(progress);

      if ( progress.state === MatchingState.Finished ) {

        sub.unsubscribe();

      }

    });

  }

}
