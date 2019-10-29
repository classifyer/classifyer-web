import { Injectable } from '@angular/core';
import credentials from '@credentials/firebase';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private authenticated: boolean = false;
  /** Emits when there's a change in authentication (the boolean value indicates if the user is authenticated or not). */
  public onAuthChange: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this.authenticated);

  constructor() {

    firebase.initializeApp(credentials);

    // Subscribe to auth changes
    firebase.auth().onAuthStateChanged(user => {

      this.authenticated = !! user;

      console.log(`AUTH STATE:`, this.authenticated);

      this.onAuthChange.next(this.authenticated);

      if ( user ) return;

      // Authenticate anonymously
      firebase.auth().signInAnonymously()
      .catch(console.error);

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

}
