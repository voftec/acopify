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
  appId: "1:237534329876:web:d75bf61f8d87ebfc0cbb01",
  measurementId: "G-3HHTN0JFMN"
};

// Initialize Firebase with error handling
var db = null;
var auth = null;
var analytics = null;

// Global helper for safe and unified analytics logging
window.logAnalyticsEvent = function (eventName, params) {
  try {
    if (analytics) {
      analytics.logEvent(eventName, params);
    } else if (typeof firebase !== 'undefined' && typeof firebase.analytics === 'function') {
      analytics = firebase.analytics();
      analytics.logEvent(eventName, params);
    }
  } catch (error) {
    console.warn("Failed to log analytics event '" + eventName + "':", error);
  }
};

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  // Initialize each service defensively. A compat script (database / auth /
  // analytics) may be blocked by ad-blockers or fail to load; in that case the
  // corresponding global is undefined and we leave the variable as null instead
  // of throwing. Downstream scripts already guard with `if (!auth || !db)`.
  if (typeof firebase.database === 'function') {
    db = firebase.database();
  } else {
    console.warn("Firebase Database not loaded");
  }
  if (typeof firebase.auth === 'function') {
    auth = firebase.auth();
  } else {
    console.warn("Firebase Auth not loaded");
  }
  if (typeof firebase.analytics === 'function') {
    analytics = firebase.analytics();
    console.log("Firebase and Analytics initialized successfully");
  } else {
    console.log("Firebase initialized successfully (Analytics not loaded)");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  // Show user-friendly error message
  window.addEventListener('DOMContentLoaded', function() {
    var errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
      errorDiv.textContent = "Error al conectar con Firebase. Por favor recarga la página.";
      errorDiv.classList.remove('hidden');
    }
  });
}
