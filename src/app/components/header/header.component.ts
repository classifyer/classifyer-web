import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AppService } from '@services/app';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class HeaderComponent implements OnInit {

  public opened: boolean = true;

  constructor(
    public app: AppService
  ) { }

  ngOnInit() {

    this.app.onMenuAccessibilityChanged.subscribe(opened => {

      this.opened = opened;

    });

  }

  public onBrandClick() {

    if ( ! this.app.breakpointActive ) return;

    if ( this.opened ) this.app.closeMenu(true);
    else this.app.openMenu(true);

  }

  public svgUrlPrefix(): string {

    return location.pathname;

  }

}
