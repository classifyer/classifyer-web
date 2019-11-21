import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {
  ApplicationComponent,
  ContributeComponent,
  AboutComponent,
  TeamComponent,
  ContactComponent,
  WhenToContributeComponent,
  HowToContributeComponent,
  WhatHappensAfterComponent
} from '@components';

import { CanCancelMatching } from '@guards/matching';


const routes: Routes = [
  { path: 'app', component: ApplicationComponent, canDeactivate: [CanCancelMatching] },
  { path: 'contribute', component: ContributeComponent, children: [
    { path: '', pathMatch: 'full', redirectTo: 'when-to-contribute' },
    { path: 'when-to-contribute', component: WhenToContributeComponent },
    { path: 'how-to-contribute', component: HowToContributeComponent },
    { path: 'what-happens-after', component: WhatHappensAfterComponent }
  ]},
  { path: 'about', component: AboutComponent, children: [
    { path: '', pathMatch: 'full', redirectTo: 'team' },
    { path: 'team', component: TeamComponent },
    { path: 'contact', component: ContactComponent }
  ]},
  { path: '**', redirectTo: '/app' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
