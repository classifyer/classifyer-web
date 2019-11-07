import { Component, OnInit } from '@angular/core';
import { AppService } from '@services/app';

@Component({
  selector: 'app-contribute',
  templateUrl: './contribute.component.html',
  styleUrls: ['./contribute.component.scss']
})
export class ContributeComponent implements OnInit {

  constructor(
    private app: AppService
  ) { }

  ngOnInit() {

    this.app.setMenuActive(false);

  }

}
