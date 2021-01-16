import { Injectable } from '@angular/core';
import credentials from '@credentials/firebase';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';
import 'firebase/analytics';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private authenticated: boolean = false;
  /** Emits when there's a change in authentication (the boolean value indicates if the user is authenticated or not). */
  public onAuthChange: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this.authenticated);
  public currentToken: string = null;

  constructor() {

    firebase.initializeApp(credentials);
    firebase.analytics();

    // Subscribe to auth changes
    firebase.auth().onAuthStateChanged(user => {

      this.authenticated = !! user;

      this.onAuthChange.next(this.authenticated);

      // Authenticate anonymously
      if ( ! user ) {

        this.currentToken = null;

        firebase.auth().signInAnonymously()
        .catch(console.error);

      }
      // Set token
      else {

        user.getIdToken()
        .then(token => {

          this.currentToken = token;

        })
        .catch(console.error);

      }

    });

  }

  /**
  * Returns all documents inside a collection.
  * @param collectionName The collection name.
  */
  public async getAllDocuments(collectionName: string): Promise<firebase.firestore.QueryDocumentSnapshot[]> {

    const snapshot = await firebase.firestore().collection(collectionName).get();

    return snapshot.docs;

  }

  /**
  * Returns a document by the given ID and collection name.
  * @param collectionName The collection name.
  * @param documentId The document ID.
  */
  public async getDocument(collectionName: string, documentId: string): Promise<firebase.firestore.DocumentSnapshot> {

    return await firebase.firestore().collection(collectionName).doc(documentId).get();

  }

  /**
  * Retrieves the URL for the given filename from the storage.
  * @param filename The name of the file in the storage.
  */
  public async getFileUrl(filename: string): Promise<string> {

    return await firebase.storage().ref(filename).getDownloadURL();

  }

  /**
  * Logs a custom event with possible data in Firebase Analytics.
  * @param event The event name.
  * @param data The event data (if any).
  */
  public logAnalytics(event: string, data?: any) {

    firebase.analytics().logEvent(event, data);

  }

}
