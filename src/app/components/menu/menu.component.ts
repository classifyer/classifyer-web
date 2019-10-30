import { Component, OnInit } from '@angular/core';
import { AppService, CategoryDoc, DictionaryDoc } from '@services/app';
import { trigger, transition, state, style, animate } from '@angular/animations';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  animations: [
    trigger('fadeInOut', [
      state('void', style({
        opacity: 0
      })),
      transition('void<=>*', animate(200))
    ])
  ]
})
export class MenuComponent implements OnInit {

  public categories: CategoryDoc[] = [];
  public dictionaries: DictionaryDoc[] = [];
  public activeDictionary: string = null;
  public loading: boolean = true;
  public lottieConfig = {
    path: '/assets/spinner-white.json',
    autoplay: true,
    loop: true
  };

  constructor(
    private app: AppService
  ) { }

  ngOnInit() {

    this.app.onDataChange.subscribe(available => {

      this.loading = ! available;
      this.categories = available ? this.app.categories : [];
      this.dictionaries = available ? this.app.dictionaries : [];

    });

  }

  public getDictionariesOfCategory(id: string): DictionaryDoc[] {

    return this.dictionaries.filter(dictionary => dictionary.categoryId === id);

  }

  public activateDictionary(id: string) {

    this.activeDictionary = id;

  }

}
