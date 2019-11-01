import { Component, OnInit } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { AppService, PromptMessage } from '@services/app';

@Component({
  selector: 'app-prompt',
  templateUrl: './prompt.component.html',
  styleUrls: ['./prompt.component.scss'],
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0
      })),
      transition('void<=>*', animate(200))
    ])
  ]
})
export class PromptComponent implements OnInit {

  public visible: boolean = false;
  public message: string = null;
  public title: string = null;
  private id: string = null;

  constructor(
    private app: AppService
  ) { }

  ngOnInit() {
  }

  public setState(state: PromptMessage) {

    this.visible = state.visible;
    this.message = state.message;
    this.title = state.title;
    this.id = state.id;

  }

  public onCancel() {

    this.app.onPromptResponse.next({ id: this.id, answer: false });
    this.visible = false;

  }

  public onProceed() {

    this.app.onPromptResponse.next({ id: this.id, answer: true });
    this.visible = false;

  }

}
