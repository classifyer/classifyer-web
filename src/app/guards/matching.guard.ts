import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { MappingComponent } from '@components';
import { AppService } from '@services/app';

@Injectable({
  providedIn: 'root'
})
export class CanCancelMatching implements CanDeactivate<MappingComponent> {

  constructor(
    private app: AppService
  ) { }

  public async canDeactivate() {

    return await this.app.promptMatchCancellation();

  }

}
