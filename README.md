# Classifyer

This is the repository of Classifyer web application.

## Project Setup

1. Clone this repo
2. Inside the project, run `npm install` to install dependencies
3. Setup a Firebase project with the following settings:
    - Authentication: Anonymous sign-in method enabled
    - Authentication: Add the project domain (if any) to authorized domains
    - Storage: Enable the cloud storage
    - Database: Enable Firestore with default security rules
    - Install firebase tools: `npm install -g firebase-tools`
    - Login: `firebase login`
    - Inside the repo initialize Firebase: `firebase init` with the following features:
      - Hosting: Set to dist/classifyer
      - Firestore: Avoid overwriting the rules file
      - Storage: Avoid overwriting the rules file
    - Visit <https://console.cloud.google.com/home> and select your project, click Activate Cloud Shell and execute the following commands in order:
      - `nano cors.json` and write the following content and save (change the origin array as you see fit, e.g. http://localhost:4200, your production domain, etc.):
        ```json
        [{
          "origin":["*"],
          "method": ["GET"],
          "maxAgeSeconds": 3600
        }]
        ```
      - `gsutil cors set cors.json gs://PROJECT_ID.appspot.com` (replace PROJECT_ID with your project ID)
    - Finally, generate your credentials file for the web through Firebase console and store it at `/src/app/credentials/firebase.json`
4. Configure the app by creating `/src/app/app.config.json` and adding the following content (you need to have the email server [up and running](https://github.com/classifyer/classifyer-email-server) and obtain its URL):
    ```json
    {
      "emailServerUrl": "HEROKU_EMAIL_SERVER_URL/send"
    }
    ```
5. Build the app: `ng build --prod`
6. Deploy: `firebase deploy`

## Versioning

Use `npm run version -- 0.0.0` to change the versioning of the application (replace `0.0.0` with the desired version). **Make sure to version the app after cloning this repository, otherwise, the app won't be built.**
