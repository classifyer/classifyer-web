import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AppService, CategoryDoc, DictionaryDoc } from '@services/app';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit {

  public categories: CategoryDoc[] = [];
  public dictionaries: DictionaryDoc[] = [];
  public activeDictionary: string = null;
  public loading: boolean = true;
  public enabled: boolean = true;
  public opened: boolean = true;
  public currentTab: string = '';
  public lottieConfig = {
    path: '/assets/spinner-white.json',
    autoplay: true,
    loop: true
  };

  constructor(
    private app: AppService,
    private router: Router
  ) { }

  ngOnInit() {

    this.router.events.subscribe(event => {

      if ( ! (event instanceof NavigationEnd) ) return;

      // Switch menu content based on top level route
      this.currentTab = (new URL(`http://localhost${event.urlAfterRedirects}`)).pathname.split('/')[1];

    });

    this.app.onMenuAccessibilityChanged.subscribe(opened => {

      this.opened = opened;

    });

    this.app.onDataChange.subscribe(available => {

      this.loading = ! available;
      this.categories = available ? this.app.categories : [];
      this.dictionaries = available ? this.app.dictionaries : [];

    });

    this.app.onMenuStateChanged.subscribe(active => {

      this.enabled = active;

    });

  }

  public getDictionariesOfCategory(id: string): DictionaryDoc[] {

    return this.dictionaries.filter(dictionary => dictionary.categoryId === id);

  }

  public activateDictionary(id: string, event: MouseEvent) {

    if ( ! this.enabled || ! this.opened ) return;

    this.app.matchCleanup();
    this.app.onSetViewToForm.next();
    this.app.selectDictionary(id);
    this.activeDictionary = this.app.selectedDictionary;

    if ( this.app.breakpointActive ) {

      this.app.closeMenu(true);
      event.preventDefault();
      event.stopPropagation();

    }

  }

  public menuLinkClicked(event: MouseEvent) {

    if ( ! this.enabled || ! this.opened ) return;

    if ( this.app.breakpointActive ) {

      this.app.closeMenu(true);
      event.preventDefault();
      event.stopPropagation();

    }

  }

}
