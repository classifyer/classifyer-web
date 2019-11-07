import { Component, OnInit } from '@angular/core';
import { AppService } from '@services/app';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(
    private app: AppService
  ) { }

  ngOnInit() {

    this.app.setMenuActive(false);

  }

}
