import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import {
  ApplicationComponent,
  ContributeComponent,
  AboutComponent
} from '@components';


const routes: Routes = [
  { path: 'app', component: ApplicationComponent },
  { path: 'contribute', component: ContributeComponent },
  { path: 'about', component: AboutComponent },
  { path: '**', redirectTo: '/app' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
