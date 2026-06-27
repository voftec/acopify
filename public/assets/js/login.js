/*
 * Acopify - Login page logic (sign in only)
 *
 * Registration lives in registro.html / registro.js.
 * Password recovery lives in recuperar.html / recuperar.js.
 */

(function () {
  // Check if Firebase is properly initialized
  if (!auth || !db) {
    console.error("Firebase not initialized in login.js");
    var errorDiv = document.getElementById("auth-error");
    if (errorDiv) {
      errorDiv.textContent = "Error al cargar Firebase. Por favor recarga la página.";
      errorDiv.classList.remove("hidden");
    }
    return;
  }

  var form = document.getElementById("form-login");
  var btnGoogle = document.getElementById("btn-google");
  var btnSubmit = document.getElementById("btn-submit");
  var errorDiv = document.getElementById("auth-error");
  var infoDiv = document.getElementById("auth-info");

  // Where to send the user after a successful, verified login.
  function getRedirectTarget() {
    return sessionStorage.getItem("postLoginRedirect") || "/mis-centros.html";
  }

  function goToTarget() {
    var target = getRedirectTarget();
    sessionStorage.removeItem("postLoginRedirect");
    window.location.href = target;
  }

  // Show any message handed over from another auth page (e.g. after registering).
  var handoffInfo = sessionStorage.getItem("authInfo");
  if (handoffInfo) {
    sessionStorage.removeItem("authInfo");
    showInfo(handoffInfo);
  }

  auth.onAuthStateChanged(function (user) {
    // If a verified user (or a Google user) is already signed in, continue.
    if (user) {
      var isPasswordProvider = user.providerData.some(function (p) {
        return p.providerId === "password";
      });
      if (!isPasswordProvider || user.emailVerified) {
        goToTarget();
      }
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideMessages();
    btnSubmit.disabled = true;

    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;

    auth.signInWithEmailAndPassword(email, password)
      .then(function (cred) {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("login", { method: "email" });
        }
        if (!cred.user.emailVerified) {
          // Block unverified accounts; offer to resend the email.
          return cred.user.sendEmailVerification()
            .catch(function () {})
            .then(function () {
              return auth.signOut();
            })
            .then(function () {
              showInfo(
                "Tu cuenta aun no esta verificada. Te reenviamos el correo de confirmacion a " +
                email + ". Revisa tu bandeja de entrada."
              );
              btnSubmit.disabled = false;
            });
        }
        goToTarget();
      })
      .catch(function (error) {
        showError(translateError(error.code));
        btnSubmit.disabled = false;
      });
  });

  btnGoogle.addEventListener("click", function () {
    hideMessages();
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(function () {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("login", { method: "google" });
        }
        // Google accounts are already verified.
        goToTarget();
      })
      .catch(function (error) {
        showError(translateError(error.code));
      });
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove("hidden");
    if (infoDiv) infoDiv.classList.add("hidden");
  }

  function showInfo(msg) {
    if (!infoDiv) return;
    infoDiv.textContent = msg;
    infoDiv.classList.remove("hidden");
    errorDiv.classList.add("hidden");
  }

  function hideMessages() {
    errorDiv.classList.add("hidden");
    if (infoDiv) infoDiv.classList.add("hidden");
  }

  function translateError(code) {
    var errors = {
      "auth/invalid-email": "Correo electronico invalido.",
      "auth/user-not-found": "No se encontro una cuenta con este correo.",
      "auth/wrong-password": "Contrasena incorrecta.",
      "auth/too-many-requests": "Demasiados intentos. Intenta de nuevo mas tarde.",
      "auth/popup-closed-by-user": "Se cerro la ventana de inicio de sesion.",
      "auth/invalid-credential": "Credenciales invalidas. Verifica tu correo y contrasena.",
      "auth/missing-email": "Ingresa tu correo electronico.",
      "auth/user-disabled": "Esta cuenta ha sido deshabilitada."
    };
    return errors[code] || "Error de autenticacion. Intenta de nuevo.";
  }
})();
