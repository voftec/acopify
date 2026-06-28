/*
 * Firebase initialization for Acopify.
 *
 * Replace the placeholder values below with your project's
 * Firebase configuration from the Firebase Console:
 *   Project Settings > General > Your apps > Firebase SDK snippet
 */

// Serve the Google OAuth handler from the canonical app origin. Mobile browsers
// (Safari ITP, Chrome storage partitioning) block the cross-domain storage that
// signInWithRedirect needs when authDomain is the default *.firebaseapp.com — so
// the redirect comes back but the sign-in never completes. Firebase Hosting
// serves /__/auth/handler on the custom domain, making the flow first-party.
//
// We PIN the production authDomain to "www.acopify.com" (the only redirect URI
// registered on the OAuth client). Using location.hostname directly would break
// if the page ever runs on the apex "acopify.com", whose /__/auth/handler is not
// a registered redirect URI -> Error 400 redirect_uri_mismatch. Localhost keeps
// the firebaseapp.com default so local dev still works.
var acopifyAuthDomain;
if (typeof location !== "undefined" && location.hostname === "localhost") {
  acopifyAuthDomain = "acopify-venezuela.firebaseapp.com";
} else if (typeof location !== "undefined" && /(^|\.)acopify\.com$/.test(location.hostname)) {
  acopifyAuthDomain = "www.acopify.com";
} else {
  // Firebase default domains (*.web.app / *.firebaseapp.com) and previews.
  acopifyAuthDomain = "acopify-venezuela.firebaseapp.com";
}

var firebaseConfig = {
  apiKey: "AIzaSyALQQ3QjOuhsLJqJnco8DkdxB-wcK39BHo",
  authDomain: acopifyAuthDomain,
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

// Detect mobile/touch devices, where popup-based OAuth flows are unreliable
// (popups are blocked or the window reference is severed). On these devices we
// use a full-page redirect instead.
window.acopifyIsMobile = function () {
  try {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  } catch (e) {
    return false;
  }
};

// Unified Google sign-in. On mobile it redirects; on desktop it uses a popup and
// falls back to redirect when the popup flow breaks. `onSuccess(result)` runs
// only for the popup path (the redirect path resolves via getRedirectResult on
// the next page load). `onError(code)` receives a Firebase auth error code.
window.acopifyGoogleSignIn = function (onSuccess, onError) {
  if (!auth || typeof firebase === 'undefined' || !firebase.auth) {
    if (onError) onError("auth/internal-error");
    return;
  }
  var provider = new firebase.auth.GoogleAuthProvider();

  if (window.acopifyIsMobile()) {
    auth.signInWithRedirect(provider).catch(function (err) {
      if (onError) onError(err.code);
    });
    return;
  }

  auth.signInWithPopup(provider)
    .then(function (result) {
      if (onSuccess) onSuccess(result);
    })
    .catch(function (error) {
      var fallback = error.code === "auth/popup-blocked" ||
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/internal-error" ||
        error.code === "auth/web-storage-unsupported" ||
        error.code === "auth/operation-not-supported-in-this-environment";
      if (fallback) {
        auth.signInWithRedirect(provider).catch(function (err) {
          if (onError) onError(err.code);
        });
        return;
      }
      if (onError) onError(error.code);
    });
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
