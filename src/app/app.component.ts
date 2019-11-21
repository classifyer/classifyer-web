import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AppService, DictionaryDoc } from '@services/app';
import { PromptComponent } from '@components';
import _ from 'lodash';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0
      })),
      transition(':enter', animate('.2s .2s')),
      transition(':leave', animate(200))
    ])
  ]
})
export class AppComponent implements OnInit {

  @ViewChild('csvInput', { static: true })
  public csvInput: ElementRef<HTMLInputElement>;

  public dataAvailable: boolean = false;
  public dictionaries: DictionaryDoc[] = [];
  public headers: string[] = [];
  public menuOpened: boolean = true;

  @ViewChild(PromptComponent, { static: false })
  private prompt: PromptComponent;

  @HostListener('window:resize', ['$event'])
  public onResize(event: Event) {

    const target = <Window>event.target;

    if ( target.innerWidth <= AppService.MENU_BREAKPOINT ) {

      this.app.closeMenu();
      this.app.setBreakpointActive(true);

    }
    else {

      this.app.openMenu();
      this.app.setBreakpointActive(false);

    }

  }

  constructor(
    public app: AppService
  ) {}

  ngOnInit() {

    if ( window.innerWidth <= AppService.MENU_BREAKPOINT ) {

      this.app.closeMenu();
      this.app.setBreakpointActive(true);

    }
    else {

      this.app.openMenu();
      this.app.setBreakpointActive(false);

    }

    this.app.onMenuAccessibilityChanged.subscribe(opened => {

      this.menuOpened = opened;

    });

    this.app.onDataChange.subscribe(available => {

      this.dataAvailable = available;

      if ( ! available ) return;

      this.dictionaries = this.app.dictionaries;

    });

    this.app.onPromptStateChanged.subscribe(state => {

      if ( this.prompt ) this.prompt.setState(state);
      else if ( state.id !== null ) console.error('Could not set state', state, 'because prompt is', this.prompt);

    });

  }

  public onMenuClicked() {

    if ( this.menuOpened ) return;

    this.app.openMenu(true);

  }

  public onBlurClick() {

    if ( ! this.menuOpened ) return;

    this.app.closeMenu(true);

  }

  public getYear() {

    return (new Date()).getFullYear();

  }

}
