import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LottieAnimationViewModule } from 'ng-lottie';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { ClipboardModule } from 'ngx-clipboard';

import { AppComponent } from './app.component';
import {
  HeaderComponent,
  MenuComponent,
  ContributeComponent,
  AboutComponent,
  ApplicationComponent,
  PromptComponent,
  ContactComponent,
  WhenToContributeComponent,
  HowToContributeComponent,
  WhatHappensAfterComponent
} from '@components';

import { LineLimiterValidator } from '@validators/linelimiter';
import { StrictEmailValidator } from '@validators/strictemail';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    MenuComponent,
    ContributeComponent,
    AboutComponent,
    ApplicationComponent,
    PromptComponent,
    ContactComponent,
    WhenToContributeComponent,
    HowToContributeComponent,
    WhatHappensAfterComponent,
    LineLimiterValidator,
    StrictEmailValidator
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    LottieAnimationViewModule.forRoot(),
    BrowserAnimationsModule,
    ClipboardModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
