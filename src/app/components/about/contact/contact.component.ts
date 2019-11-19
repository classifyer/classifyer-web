import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { AppService, ContactReason } from '@services/app';
import _ from 'lodash';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
  animations: [
    trigger('fadeIn', [
      state('void', style({
        opacity: 0
      })),
      transition(':enter', animate('.2s'))
    ]),
    trigger('popInOut', [
      state('void', style({
        opacity: 0,
        height: 0,
        margin: 0,
        padding: 0
      })),
      transition(':enter', animate('.2s')),
      transition(':leave', animate('.2s'))
    ])
  ]
})
export class ContactComponent implements OnInit {

  public reasons = ContactReason;
  public values = _.values;
  public sending: boolean = false;
  public message: string = null;
  public error: boolean = false;
  public lottieConfig = {
    path: '/assets/spinner-white.json',
    autoplay: true,
    loop: true
  };

  constructor(
    private app: AppService
  ) { }

  ngOnInit() {
  }

  public onSubmit(form: NgForm) {

    if ( form.invalid || this.sending ) return;

    this.sending = true;

    this.app.sendEmail(form.value.name, form.value.email, form.value.subject, form.value.reason, form.value.message)
    .then(response => {

      if ( response.error ) {

        console.error(new Error(response.code + ': ' + response.message));
        this.error = true;
        this.message = 'Oops! Something went wrong. Please try again.';

      }
      else {

        this.error = false;
        this.message = 'Thank you for your message. We will get back to you shortly.';
        form.reset();

      }

    })
    .catch(error => {

      console.error(error);
      this.error = true;
      this.message = 'Oops! Something went wrong. Please try again.'

    })
    .finally(() => {

      this.sending = false;

      // Remove message after 10 seconds
      setTimeout(() => {

        this.message = null;

      }, 10000);

    });

  }

}
