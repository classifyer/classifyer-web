import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {
  MappingComponent,
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
  { path: 'mapping', component: MappingComponent, canDeactivate: [CanCancelMatching] },
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
  { path: '**', redirectTo: '/mapping' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
