/*
 * Firebase initialization for Acopify.
 *
 * Replace the placeholder values below with your project's
 * Firebase configuration from the Firebase Console:
 *   Project Settings > General > Your apps > Firebase SDK snippet
 */

var firebaseConfig = {
  apiKey: "AIzaSyALQQ3QjOuhsLJqJnco8DkdxB-wcK39BHo",
  authDomain: "acopify-venezuela.firebaseapp.com",
  databaseURL: "https://acopify-venezuela-default-rtdb.firebaseio.com",
  projectId: "acopify-venezuela",
  storageBucket: "acopify-venezuela.firebasestorage.app",
  messagingSenderId: "237534329876",
  appId: "1:237534329876:web:d75bf61f8d87ebfc0cbb01"
};

firebase.initializeApp(firebaseConfig);

var db = firebase.database();
var auth = firebase.auth();
