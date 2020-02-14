import { BrowserModule } from '@angular/platform-browser';
import { NgModule, ErrorHandler } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { LottieModule } from 'ngx-lottie';
import player from 'lottie-web';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { ClipboardModule } from 'ngx-clipboard';

import { AppComponent } from './app.component';
import {
  HeaderComponent,
  MenuComponent,
  ContributeComponent,
  AboutComponent,
  MappingComponent,
  PromptComponent,
  ContactComponent,
  WhenToContributeComponent,
  HowToContributeComponent,
  WhatHappensAfterComponent,
  TeamComponent
} from '@components';

import { LineLimiterValidator } from '@validators/linelimiter';
import { StrictEmailValidator } from '@validators/strictemail';

import { GlobalErrorHandler } from '@services/error-handler';

export function playerFactory() {

  return player;

}

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    MenuComponent,
    ContributeComponent,
    AboutComponent,
    MappingComponent,
    PromptComponent,
    ContactComponent,
    WhenToContributeComponent,
    HowToContributeComponent,
    WhatHappensAfterComponent,
    LineLimiterValidator,
    StrictEmailValidator,
    TeamComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    ClipboardModule,
    LottieModule.forRoot({ player: playerFactory })
  ],
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
