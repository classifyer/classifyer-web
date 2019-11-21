import { Component, OnInit } from '@angular/core';
import { AppService } from '@services/app';

@Component({
  selector: 'app-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss']
})
export class TeamComponent implements OnInit {

  public contributors: string = null;
  public loading: boolean = true;
  public lottieConfig = {
    path: '/assets/spinner-blue.json',
    autoplay: true,
    loop: true
  };

  constructor(
    private app: AppService
  ) { }

  ngOnInit() {

    // Fetch the contributors list
    this.app.getContributorsList()
    .then(list => this.contributors = list)
    .catch(error => this.app.analytics.logErrorReport(error, 'contrib_list_fetch_error'))
    .finally(() => this.loading = false);

  }

}
