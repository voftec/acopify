/*
 * Acopify - Login page logic
 */

(function () {
  var isRegister = false;
  var form = document.getElementById("form-login");
  var btnGoogle = document.getElementById("btn-google");
  var btnSubmit = document.getElementById("btn-submit");
  var toggleLink = document.getElementById("toggle-mode");
  var errorDiv = document.getElementById("auth-error");
  var heading = document.querySelector(".auth-card h1");
  var subtitle = document.querySelector(".auth-subtitle");
  var footerText = document.querySelector(".auth-footer");

  auth.onAuthStateChanged(function (user) {
    if (user) {
      window.location.href = "/";
    }
  });

  toggleLink.addEventListener("click", function (e) {
    e.preventDefault();
    isRegister = !isRegister;
    if (isRegister) {
      heading.textContent = "Crear cuenta";
      subtitle.textContent = "Registrate para gestionar centros de acopio";
      btnSubmit.textContent = "Crear cuenta";
      footerText.innerHTML = 'Ya tienes cuenta? <a href="#" id="toggle-mode">Iniciar sesion</a>';
    } else {
      heading.textContent = "Iniciar sesion";
      subtitle.textContent = "Ingresa para gestionar tus centros de acopio";
      btnSubmit.textContent = "Iniciar sesion";
      footerText.innerHTML = 'No tienes cuenta? <a href="#" id="toggle-mode">Crear cuenta</a>';
    }
    document.getElementById("toggle-mode").addEventListener("click", arguments.callee.bind(this));
    hideError();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();
    btnSubmit.disabled = true;

    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;

    var promise = isRegister
      ? auth.createUserWithEmailAndPassword(email, password)
      : auth.signInWithEmailAndPassword(email, password);

    promise
      .then(function () {
        window.location.href = "/";
      })
      .catch(function (error) {
        showError(translateError(error.code));
        btnSubmit.disabled = false;
      });
  });

  btnGoogle.addEventListener("click", function () {
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(function () {
        window.location.href = "/";
      })
      .catch(function (error) {
        showError(translateError(error.code));
      });
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove("hidden");
  }

  function hideError() {
    errorDiv.classList.add("hidden");
  }

  function translateError(code) {
    var errors = {
      "auth/email-already-in-use": "Este correo ya esta registrado.",
      "auth/invalid-email": "Correo electronico invalido.",
      "auth/weak-password": "La contrasena debe tener al menos 6 caracteres.",
      "auth/user-not-found": "No se encontro una cuenta con este correo.",
      "auth/wrong-password": "Contrasena incorrecta.",
      "auth/too-many-requests": "Demasiados intentos. Intenta de nuevo mas tarde.",
      "auth/popup-closed-by-user": "Se cerro la ventana de inicio de sesion.",
      "auth/invalid-credential": "Credenciales invalidas. Verifica tu correo y contrasena."
    };
    return errors[code] || "Error de autenticacion. Intenta de nuevo.";
  }
})();
