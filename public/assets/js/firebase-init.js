/*
 * Firebase initialization for Acopify.
 *
 * Replace the placeholder values below with your project's
 * Firebase configuration from the Firebase Console:
 *   Project Settings > General > Your apps > Firebase SDK snippet
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "acopify.firebaseapp.com",
  databaseURL: "https://acopify-default-rtdb.firebaseio.com",
  projectId: "acopify",
  storageBucket: "acopify.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();
