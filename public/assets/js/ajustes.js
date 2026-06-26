/*
 * Acopify - Perfil / Ajustes del usuario
 */

(function () {
  var loadingState = document.getElementById("loading-state");
  var authRequired = document.getElementById("auth-required");
  var profileContent = document.getElementById("profile-content");
  var avatarContainer = document.getElementById("avatar-container");
  var profileName = document.getElementById("profile-name");
  var form = document.getElementById("form-perfil");
  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  var phoneInput = document.getElementById("phone");
  var btnGuardar = document.getElementById("btn-guardar");
  var btnLogout = document.getElementById("btn-logout");
  var formMessage = document.getElementById("form-message");

  var user = null;

  auth.onAuthStateChanged(function (u) {
    loadingState.classList.add("hidden");

    if (!u) {
      authRequired.classList.remove("hidden");
      profileContent.classList.add("hidden");
      return;
    }

    user = u;
    authRequired.classList.add("hidden");
    profileContent.classList.remove("hidden");
    loadProfile(u);
  });

  function loadProfile(u) {
    var displayName = u.displayName || u.email.split("@")[0];
    profileName.textContent = displayName;
    nameInput.value = u.displayName || "";
    emailInput.value = u.email || "";

    // Render avatar (photo if available)
    if (u.photoURL) {
      avatarContainer.innerHTML =
        '<img src="' + u.photoURL + '" alt="Avatar" class="w-full h-full object-cover" referrerpolicy="no-referrer">';
    }

    // Load phone from RTDB profile
    db.ref("usuarios/" + u.uid).once("value")
      .then(function (snapshot) {
        var profile = snapshot.val();
        if (profile) {
          if (profile.telefono) phoneInput.value = profile.telefono;
          if (profile.nombre && !u.displayName) {
            nameInput.value = profile.nombre;
            profileName.textContent = profile.nombre;
          }
        }
      })
      .catch(function () {
        // Ignore load errors, keep defaults
      });
  }

  // Save changes
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!user) return;

    hideMessage();

    var nombre = nameInput.value.trim();
    var telefono = phoneInput.value.trim();

    if (!nombre) {
      showMessage("Por favor ingresa tu nombre.", "error");
      nameInput.focus();
      return;
    }

    var originalText = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="material-symbols-outlined animate-spin" data-icon="sync">sync</span> Guardando...';

    // Update Firebase Auth profile + RTDB profile
    var updateAuth = user.updateProfile({ displayName: nombre });
    var updateDb = db.ref("usuarios/" + user.uid).update({
      nombre: nombre,
      telefono: telefono,
      email: user.email,
      actualizadoEn: firebase.database.ServerValue.TIMESTAMP
    });

    Promise.all([updateAuth, updateDb])
      .then(function () {
        profileName.textContent = nombre;

        btnGuardar.innerHTML = '<span class="material-symbols-outlined" data-icon="check_circle">check_circle</span> Guardado con éxito';
        btnGuardar.classList.replace("bg-primary", "bg-emerald-600");

        if (navigator.vibrate) navigator.vibrate(50);

        setTimeout(function () {
          btnGuardar.innerHTML = originalText;
          btnGuardar.classList.replace("bg-emerald-600", "bg-primary");
          btnGuardar.disabled = false;
        }, 2000);
      })
      .catch(function (error) {
        showMessage("Error al guardar: " + error.message, "error");
        btnGuardar.innerHTML = originalText;
        btnGuardar.disabled = false;
      });
  });

  // Logout
  btnLogout.addEventListener("click", function () {
    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
      auth.signOut().then(function () {
        window.location.href = "/login.html";
      });
    }
  });

  function showMessage(msg, type) {
    formMessage.textContent = msg;
    formMessage.classList.remove("hidden");
    if (type === "error") {
      formMessage.className = "mb-md p-3 rounded-lg text-sm bg-error-container text-on-error-container";
    } else {
      formMessage.className = "mb-md p-3 rounded-lg text-sm bg-primary-fixed text-on-primary-fixed";
    }
  }

  function hideMessage() {
    formMessage.classList.add("hidden");
  }
})();