/*
 * Acopify - Perfil / Ajustes del usuario
 */

(function () {
  // Check if Firebase is properly initialized
  if (!auth || !db) {
    console.error("Firebase not initialized in ajustes.js");
    return;
  }

  var loadingState = document.getElementById("loading-state");
  var authRequired = document.getElementById("auth-required");
  var profileContent = document.getElementById("profile-content");
  var avatarContainer = document.getElementById("avatar-container");
  var profileName = document.getElementById("profile-name");
  var form = document.getElementById("form-perfil");
  var nameInput = document.getElementById("name");
  var emailInput = document.getElementById("email");
  var phoneCcSelect = document.getElementById("phone-cc");
  var phoneLocalInput = document.getElementById("phone-local");
  var btnGuardar = document.getElementById("btn-guardar");
  var btnLogout = document.getElementById("btn-logout");
  var formMessage = document.getElementById("form-message");

  var user = null;

  // When redirected here to complete a missing phone number, prompt the user and
  // send them back to Mi Centro once they save it.
  var phoneSetup = /[?&]setup=phone\b/.test(window.location.search);

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

    // Load phone from RTDB profile using FirebaseDataManager
    FirebaseDataManager.getUserProfile(u.uid).then(function (profile) {
      if (profile) {
        if (profile.telefono) {
          // Support both the new object format {cc, local, full} and
          // the legacy flat string (e.g. "+54911441133050").
          var parsed = (typeof profile.telefono === "object" && profile.telefono.cc)
            ? profile.telefono
            : parsePhoneNumber(profile.telefono);
          phoneCcSelect.value = parsed.cc;
          phoneLocalInput.value = parsed.local;
        }
        if (profile.nombre && !u.displayName) {
          nameInput.value = profile.nombre;
          profileName.textContent = profile.nombre;
        }
      }

      // Forced phone-setup flow: nudge the user to fill in the missing number.
      if (phoneSetup && !phoneLocalInput.value.trim()) {
        showMessage(
          "Agrega tu número de teléfono para que las personas puedan contactarte. Luego presiona Guardar Cambios.",
          "info"
        );
        phoneLocalInput.focus();
      }
    }).catch(function () {
      // Ignore load errors, keep defaults
    });
  }

  // Save changes
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!user) return;

    hideMessage();

    var nombre = nameInput.value.trim();
    var localNum = phoneLocalInput.value.trim().replace(/[^\d]/g, "");
    var telefono = localNum
      ? { cc: phoneCcSelect.value, local: localNum, full: phoneCcSelect.value + localNum }
      : "";

    if (!nombre) {
      showMessage("Por favor ingresa tu nombre.", "error");
      nameInput.focus();
      return;
    }

    // In the forced setup flow the phone number is mandatory.
    if (phoneSetup && !localNum) {
      showMessage("Por favor ingresa tu número de teléfono para continuar.", "error");
      phoneLocalInput.focus();
      return;
    }

    var originalText = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="material-symbols-outlined animate-spin" data-icon="sync">sync</span> Guardando...';

    // Update Firebase Auth profile + RTDB profile using FirebaseDataManager
    var updateAuth = user.updateProfile({ displayName: nombre });
    var profileData = {
      nombre: nombre,
      telefono: telefono,
      email: user.email,
      actualizadoEn: firebase.database.ServerValue.TIMESTAMP
    };
    var updateDb = FirebaseDataManager.updateUserProfile(user.uid, profileData);

    Promise.all([updateAuth, updateDb])
      .then(function () {
        profileName.textContent = nombre;

        btnGuardar.innerHTML = '<span class="material-symbols-outlined" data-icon="check_circle">check_circle</span> Guardado con éxito';
        btnGuardar.classList.replace("bg-primary", "bg-emerald-600");

        if (navigator.vibrate) navigator.vibrate(50);

        // Completed the forced phone-setup flow: return to Mi Centro.
        if (phoneSetup && telefono && telefono.full) {
          setTimeout(function () {
            window.location.href = "/mi-centro.html";
          }, 900);
          return;
        }

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

  // Split a stored phone string (e.g. "+54911441133050") into its country code
  // and local number parts. Country codes are matched longest-first to avoid
  // a 1-digit prefix swallowing a 3-digit code (e.g. +593 vs +5).
  function parsePhoneNumber(fullPhone) {
    var CODES = [
      "+593", "+591", "+595", "+598", "+507", "+506",
      "+58", "+54", "+57", "+34", "+52", "+56", "+51", "+55", "+1"
    ];
    if (!fullPhone) return { cc: "+58", local: "" };
    var phone = String(fullPhone).replace(/[\s\-().]/g, "");
    if (phone.charAt(0) !== "+") return { cc: "+58", local: phone };
    for (var i = 0; i < CODES.length; i++) {
      if (phone.indexOf(CODES[i]) === 0) {
        return { cc: CODES[i], local: phone.slice(CODES[i].length) };
      }
    }
    return { cc: "+58", local: phone };
  }

  // Cleanup Firebase listeners on page unload
  window.addEventListener("beforeunload", function () {
    if (window.FirebaseDataManager) {
      FirebaseDataManager.cleanup();
    }
  });
})();