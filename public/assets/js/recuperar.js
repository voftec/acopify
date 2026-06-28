/*
 * Acopify - Password recovery page logic
 */

(function () {
  // Check if Firebase is properly initialized
  if (!auth) {
    console.error("Firebase not initialized in recuperar.js");
    var errorDiv = document.getElementById("auth-error");
    if (errorDiv) {
      errorDiv.textContent = "Error al cargar Firebase. Por favor recarga la página.";
      errorDiv.classList.remove("hidden");
    }
    return;
  }

  var form = document.getElementById("form-recuperar");
  var btnSubmit = document.getElementById("btn-submit");
  var errorDiv = document.getElementById("auth-error");
  var infoDiv = document.getElementById("auth-info");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideMessages();

    var email = document.getElementById("email").value.trim();
    if (!email) {
      showError("Ingresa tu correo electronico.");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Enviando...";

    auth.sendPasswordResetEmail(email)
      .then(function () {
        showInfo(
          "Te enviamos un correo para restablecer tu contrasena a " + email +
          ". Revisa tu bandeja de entrada y tambien tu carpeta de spam o correo no deseado."
        );
        form.reset();
      })
      .catch(function (error) {
        showError(translateError(error.code));
      })
      .finally(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar enlace de recuperacion";
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
      "auth/missing-email": "Ingresa tu correo electronico.",
      "auth/too-many-requests": "Demasiados intentos. Intenta de nuevo mas tarde."
    };
    return errors[code] || "No se pudo enviar el correo. Intenta de nuevo.";
  }
})();
