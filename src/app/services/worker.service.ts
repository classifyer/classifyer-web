import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WorkerService {

  constructor() { }

  /**
  * Wraps the web worker with a clean API.
  * @param worker The web worker to wrap.
  */
  public wrap(worker: Worker): WebWorker {

    return new WebWorker(worker);

  }

}

export class WebWorker {

  constructor(
    private worker: Worker
  ) { }

  /**
  * Sends the data to the web worker.
  * @param data The data to send.
  */
  public send(data: any): WebWorker {

    this.worker.postMessage(data);

    return this;

  }

  /**
  * Listens to messages from the web worker (if using this API, avoid using toPromise).
  * @param cb The callback.
  */
  public listen<T=any>(cb: (data: T) => void): WebWorker {

    this.worker.onmessage = ({ data }) => {

      cb(data);

    };

    return this;

  }

  /**
  * Terminates the current web worker.
  */
  public terminate() {

    this.worker.terminate();

  }

  /**
  * Listens to the first message from the web worker and resolves the promise (if using this API, avoid using listen).
  */
  public toPromise<T=any>(): Promise<T> {

    return new Promise(resolve => {

      this.worker.onmessage = ({ data }) => resolve(data);

    });

  }

}
