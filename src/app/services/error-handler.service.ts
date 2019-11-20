import { ErrorHandler, Injectable } from '@angular/core';
import { AppService } from './app.service';

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {

  constructor(
    private app: AppService
  ) { }

  handleError(error: any) {

    this.app.analytics.logErrorReport(error, 'global');

    console.error(error);

  }

}
