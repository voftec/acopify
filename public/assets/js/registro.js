/*
 * Acopify - User registration page logic
 */

(function () {
  var form = document.getElementById("form-registro");
  var btnGoogle = document.getElementById("btn-google");
  var btnSubmit = document.getElementById("btn-submit");
  var errorDiv = document.getElementById("auth-error");
  var infoDiv = document.getElementById("auth-info");

  // True while we are in the middle of creating an account (we sign the user
  // out right after, so we must not auto-redirect them as "logged in").
  var registering = false;

  function getRedirectTarget() {
    return sessionStorage.getItem("postLoginRedirect") || "/mis-centros.html";
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
          ". Verifica tu cuenta y luego inicia sesion."
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
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(function () {
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
      "auth/operation-not-allowed": "El registro con correo no esta habilitado."
    };
    return errors[code] || "Error al crear la cuenta. Intenta de nuevo.";
  }
})();
