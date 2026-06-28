/*
 * Acopify - User registration page logic
 */

(function () {
  // Check if Firebase is properly initialized
  if (!auth || !db) {
    console.error("Firebase not initialized in registro.js");
    var errorDiv = document.getElementById("auth-error");
    if (errorDiv) {
      errorDiv.textContent = "Error al cargar Firebase. Por favor recarga la página.";
      errorDiv.classList.remove("hidden");
    }
    return;
  }

  var form = document.getElementById("form-registro");
  var btnGoogle = document.getElementById("btn-google");
  var btnSubmit = document.getElementById("btn-submit");
  var errorDiv = document.getElementById("auth-error");
  var infoDiv = document.getElementById("auth-info");

  // True while we are in the middle of creating an account (we sign the user
  // out right after, so we must not auto-redirect them as "logged in").
  var registering = false;

  function getRedirectTarget() {
    return sessionStorage.getItem("postLoginRedirect") || "/mi-centro.html";
  }

  function goToTarget() {
    var target = getRedirectTarget();
    sessionStorage.removeItem("postLoginRedirect");
    window.location.href = target;
  }

  auth.onAuthStateChanged(function (user) {
    // A verified user (or Google user) who is already signed in shouldn't be
    // on the registration page; send them along.
    if (user && !registering) {
      var isPasswordProvider = user.providerData.some(function (p) {
        return p.providerId === "password";
      });
      if (!isPasswordProvider || user.emailVerified) {
        goToTarget();
      }
    }
  });

  // Complete a redirect-based Google sign-up if we fell back to one earlier.
  auth.getRedirectResult()
    .then(function (result) {
      if (result && result.user) {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("sign_up", { method: "google" });
          logAnalyticsEvent("login", { method: "google" });
        }
        goToTarget();
      }
    })
    .catch(function (error) {
      showError(translateError(error.code));
    });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideMessages();

    var nombre = document.getElementById("nombre").value.trim();
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    var password2 = document.getElementById("password2").value;

    if (!nombre) {
      showError("Por favor ingresa tu nombre.");
      return;
    }
    if (password.length < 6) {
      showError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      showError("Las contrasenas no coinciden.");
      return;
    }

    btnSubmit.disabled = true;
    registering = true;

    auth.createUserWithEmailAndPassword(email, password)
      .then(function (cred) {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("sign_up", { method: "email" });
        }
        return cred.user.updateProfile({ displayName: nombre })
          .then(function () {
            return cred.user.sendEmailVerification();
          })
          .then(function () {
            return auth.signOut();
          });
      })
      .then(function () {
        registering = false;
        // Hand off a message and redirect to login.
        sessionStorage.setItem(
          "authInfo",
          "Te enviamos un correo de confirmacion a " + email +
          ". Verifica tu cuenta y luego inicia sesion. Si no lo ves, revisa tu carpeta de spam o correo no deseado."
        );
        window.location.href = "/login.html";
      })
      .catch(function (error) {
        registering = false;
        showError(translateError(error.code));
        btnSubmit.disabled = false;
      });
  });

  btnGoogle.addEventListener("click", function () {
    hideMessages();
    // Uses a popup on desktop and a full-page redirect on mobile (where popups
    // are unreliable). The redirect path resolves via getRedirectResult above.
    window.acopifyGoogleSignIn(
      function () {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("sign_up", { method: "google" });
          logAnalyticsEvent("login", { method: "google" });
        }
        // Google accounts are already verified.
        goToTarget();
      },
      function (code) {
        showError(translateError(code));
      }
    );
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove("hidden");
    if (infoDiv) infoDiv.classList.add("hidden");
  }

  function hideMessages() {
    errorDiv.classList.add("hidden");
    if (infoDiv) infoDiv.classList.add("hidden");
  }

  function translateError(code) {
    var errors = {
      "auth/email-already-in-use": "Este correo ya esta registrado. Inicia sesion.",
      "auth/invalid-email": "Correo electronico invalido.",
      "auth/weak-password": "La contrasena debe tener al menos 6 caracteres.",
      "auth/too-many-requests": "Demasiados intentos. Intenta de nuevo mas tarde.",
      "auth/popup-closed-by-user": "Se cerro la ventana de registro.",
      "auth/operation-not-allowed": "El registro con correo no esta habilitado.",
      "auth/unauthorized-domain": "Este dominio no esta autorizado para registrarse con Google.",
      "auth/account-exists-with-different-credential": "Ya existe una cuenta con este correo usando otro metodo de inicio de sesion."
    };
    return errors[code] || "Error al crear la cuenta. Intenta de nuevo.";
  }
})();
