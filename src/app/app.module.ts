import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {
  HeaderComponent,
  MenuComponent,
  ContributeComponent,
  AboutComponent,
  ApplicationComponent
} from '@components';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    MenuComponent,
    ContributeComponent,
    AboutComponent,
    ApplicationComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
