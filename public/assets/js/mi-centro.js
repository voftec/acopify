/*
 * Acopify - Mi Centro (owner dashboard)
 */

(function () {
  // Check if Firebase is properly initialized
  if (!auth || !db) {
    console.error("Firebase not initialized in mi-centro.js");
    return;
  }

  var centrosList = document.getElementById("centros-list");
  var topbar = document.getElementById("topbar");
  var topbarActions = document.getElementById("topbar-actions");
  var mainContent = document.getElementById("main-content");
  var loadingState = document.getElementById("loading-state");
  var loginView = document.getElementById("login-view");
  var btnRegistrarNuevo = document.getElementById("btn-registrar-nuevo");
  var btnSettings = document.getElementById("btn-settings");

  // Firebase persists the signed-in user in localStorage. If there is no
  // cached session, show the login panel right away (no spinner) — and keep
  // the user on /mi-centro so the "Mi Centro" tab stays selected.
  if (hasCachedAuthUser()) {
    loadingState.classList.remove("hidden");
    topbar.classList.add("hidden");
    mainContent.classList.add("hidden");
    loginView.classList.add("hidden");
  } else {
    showLogin();
  }

  // Complete a redirect-based Google sign-in (mobile flow). onAuthStateChanged
  // below reveals the owner content; this catches and surfaces any error.
  auth.getRedirectResult()
    .then(function (result) {
      if (result && result.user && typeof logAnalyticsEvent === "function") {
        logAnalyticsEvent("login", { method: "google" });
      }
    })
    .catch(function () { /* surfaced on next interaction; avoid noisy UI */ });

  auth.onAuthStateChanged(function (user) {
    if (user) {
      // Owners must have a phone number on file (centers need a contact). If it
      // is missing, force them into Ajustes to add it before showing the
      // dashboard. Keep the spinner up while we check so content doesn't flash.
      loadingState.classList.remove("hidden");
      topbar.classList.add("hidden");
      mainContent.classList.add("hidden");
      loginView.classList.add("hidden");

      FirebaseDataManager.getUserProfile(user.uid)
        .then(function (profile) {
          // profile.telefono may be the new object {cc, local, full} or the
          // legacy flat string; either way, treat any truthy value as "set".
          var t = profile && profile.telefono;
          var phone = t
            ? (typeof t === "object" ? (t.full || "").trim() : String(t).trim())
            : "";
          if (!phone) {
            window.location.replace("/ajustes.html?setup=phone");
            return;
          }
          revealOwner(user);
        })
        .catch(function () {
          // On a profile read error, don't block the owner from their dashboard.
          revealOwner(user);
        });
    } else {
      centrosList.innerHTML = "";
      showLogin();
    }
  });

  function revealOwner(user) {
    loadingState.classList.add("hidden");
    loginView.classList.add("hidden");
    topbar.classList.remove("hidden");
    topbarActions.classList.remove("hidden");
    mainContent.classList.remove("hidden");
    loadDashboard(user);
  }

  // Show the in-place login panel. Keeps the Acopify header bar (logo only)
  // so the page still reads as "Mi Centro".
  function showLogin() {
    loadingState.classList.add("hidden");
    mainContent.classList.add("hidden");
    topbarActions.classList.add("hidden");
    topbar.classList.remove("hidden");
    loginView.classList.remove("hidden");
    wireLogin();
  }

  // Detects a persisted Firebase auth session synchronously (no network/SDK
  // round-trip) by looking for its localStorage key: firebase:authUser:<key>.
  function hasCachedAuthUser() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("firebase:authUser:") === 0) return true;
      }
    } catch (e) {}
    return false;
  }

  // Wire the embedded login form once. On success, onAuthStateChanged above
  // reveals the owner content — no page navigation needed.
  var loginWired = false;
  function wireLogin() {
    if (loginWired) return;
    loginWired = true;

    var form = document.getElementById("mc-form-login");
    var btnGoogle = document.getElementById("mc-btn-google");
    var btnSubmit = document.getElementById("mc-btn-submit");
    var errorDiv = document.getElementById("mc-auth-error");
    var infoDiv = document.getElementById("mc-auth-info");

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

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideMessages();
      btnSubmit.disabled = true;
      var email = document.getElementById("mc-email").value.trim();
      var password = document.getElementById("mc-password").value;

      auth.signInWithEmailAndPassword(email, password)
        .then(function (cred) {
          if (typeof logAnalyticsEvent === "function") {
            logAnalyticsEvent("login", { method: "email" });
          }
          if (!cred.user.emailVerified) {
            return cred.user.sendEmailVerification()
              .catch(function () {})
              .then(function () { return auth.signOut(); })
              .then(function () {
                showInfo(
                  "Tu cuenta aun no esta verificada. Te reenviamos el correo de confirmacion a " +
                  email + ". Revisa tu bandeja de entrada y tambien tu carpeta de spam o correo no deseado."
                );
                btnSubmit.disabled = false;
              });
          }
          // Verified: onAuthStateChanged reveals the owner content.
        })
        .catch(function (error) {
          showError(translateError(error.code));
          btnSubmit.disabled = false;
        });
    });

    btnGoogle.addEventListener("click", function () {
      hideMessages();
      window.acopifyGoogleSignIn(
        function () {
          if (typeof logAnalyticsEvent === "function") {
            logAnalyticsEvent("login", { method: "google" });
          }
          // onAuthStateChanged reveals the owner content.
        },
        function (code) {
          showError(translateError(code));
        }
      );
    });
  }

  var dashboardUser = null;
  // Mapa id -> centro, para que el botón "Compartir" pueda pasar el objeto
  // completo (coordenadas, nombre, dirección) a AcopifyStory.open.
  var centrosById = {};

  // La clave de invitación debe coincidir EXACTAMENTE con la transformación de
  // las reglas RTDB: email.toLowerCase().replace('.', ',') (todos los puntos).
  function emailToKey(email) {
    return String(email || "").trim().toLowerCase().replace(/\./g, ",");
  }

  // Carga TODOS los centros (lectura pública, como el mapa) y deriva:
  //  - centros propios (organizadorId === uid)
  //  - centros donde colaboro (colaboradores[uid] existe)
  //  - invitaciones pendientes para mi correo
  function loadDashboard(user) {
    dashboardUser = user;
    FirebaseDataManager.getCentros(true)
      .then(function (centros) { renderDashboard(centros || {}, user); })
      .catch(function () { renderDashboard({}, user); });
  }

  function renderDashboard(centros, user) {
    var myKey = emailToKey(user.email);
    centrosById = centros || {};
    var owned = {}, collaborated = {}, invitations = {};

    Object.keys(centros).forEach(function (id) {
      var c = centros[id] || {};
      if (c.organizadorId === user.uid) {
        owned[id] = c;
      } else if (c.colaboradores && c.colaboradores[user.uid]) {
        collaborated[id] = c;
      } else if (user.email && c.invitaciones && c.invitaciones[myKey] &&
                 c.invitaciones[myKey].estado === "pendiente") {
        invitations[id] = c;
      }
    });

    renderInvitations(invitations, user);
    renderOwnedCentros(owned);
    renderCollaboratedCentros(collaborated);
  }

  // ---- Centros (propios y colaborados) ----
  function buildCentroCard(id, c, opts) {
    opts = opts || {};
    var address = buildAddressString(c.direccion);
    var hasCoords = c.coordenadas && typeof c.coordenadas.lat === "number";
    var shareBtn = hasCoords
      ? '<button class="btn-compartir mt-sm w-full flex items-center justify-center gap-2 bg-surface-container-high text-primary py-3 rounded-lg border border-outline-variant active:bg-surface-variant transition-colors" data-centro-id="' + id + '">' +
          '<span class="material-symbols-outlined" data-icon="ios_share">ios_share</span>' +
          '<span class="text-status-sm font-semibold">Compartir historia</span>' +
        '</button>'
      : '';
    var inviteBtn = opts.showInvite
      ? '<button class="btn-invitar mt-sm w-full flex items-center justify-center gap-2 bg-surface-container-high text-on-surface py-3 rounded-lg border border-outline-variant active:bg-surface-variant transition-colors" data-centro-id="' + id + '">' +
          '<span class="material-symbols-outlined" data-icon="group_add">group_add</span>' +
          '<span class="text-status-sm font-semibold">Invitar Colaborador</span>' +
        '</button>'
      : '';
    return '' +
      '<div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm" data-centro-id="' + id + '">' +
        '<div class="flex items-center gap-md mb-md">' +
          '<div class="bg-primary-container text-on-primary-container w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">' +
            '<span class="material-symbols-outlined" data-icon="domain">domain</span>' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<h3 class="font-bold text-body-lg text-on-surface truncate">' + escapeHtml(c.nombre) + '</h3>' +
            '<p class="text-on-surface-variant text-label-md truncate">' + escapeHtml(address) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-sm">' +
          '<button class="btn-editar flex flex-col items-center justify-center gap-1 bg-surface-container-high text-on-surface py-3 rounded-lg border border-outline-variant active:bg-surface-variant transition-colors" data-centro-id="' + id + '">' +
            '<span class="material-symbols-outlined" data-icon="edit">edit</span>' +
            '<span class="text-status-sm">Editar Info</span>' +
          '</button>' +
          '<button class="btn-necesidades flex flex-col items-center justify-center gap-1 bg-primary text-on-primary py-3 rounded-lg active:brightness-90 transition-all" data-centro-id="' + id + '">' +
            '<span class="material-symbols-outlined" data-icon="format_list_bulleted">format_list_bulleted</span>' +
            '<span class="text-status-sm">Lista de recursos</span>' +
          '</button>' +
        '</div>' +
        shareBtn +
        inviteBtn +
      '</div>';
  }

  function wireCentroCard(container) {
    container.querySelectorAll(".btn-editar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.href = "/editar.html?id=" + btn.getAttribute("data-centro-id");
      });
    });
    container.querySelectorAll(".btn-necesidades").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.href = "/lista-recursos.html?id=" + btn.getAttribute("data-centro-id");
      });
    });
    container.querySelectorAll(".btn-invitar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.href = "/editar.html?id=" + btn.getAttribute("data-centro-id") + "#colaboradores";
      });
    });
    container.querySelectorAll(".btn-compartir").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-centro-id");
        var c = centrosById[id];
        if (window.AcopifyStory && c) window.AcopifyStory.open(c, { id: id });
      });
    });
  }

  function renderOwnedCentros(centros) {
    if (!centros || Object.keys(centros).length === 0) {
      centrosList.innerHTML =
        '<div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center">' +
        '<div class="flex flex-col items-center gap-md">' +
        '<span class="material-symbols-outlined text-6xl text-outline-variant" data-icon="inventory_2">inventory_2</span>' +
        '<div>' +
        '<p class="text-body-lg font-semibold text-on-surface mb-1">No tienes centros registrados</p>' +
        '<p class="text-body-md text-on-surface-variant">Comienza registrando tu primer centro de acopio</p>' +
        '</div>' +
        '</div>' +
        '</div>';
      return;
    }
    var html = "";
    Object.keys(centros).forEach(function (id) {
      html += buildCentroCard(id, centros[id], { showInvite: true });
    });
    centrosList.innerHTML = html;
    wireCentroCard(centrosList);
  }

  function renderCollaboratedCentros(centros) {
    var section = document.getElementById("colaboro-section");
    var list = document.getElementById("colaboro-list");
    if (!section || !list) return;
    if (!centros || Object.keys(centros).length === 0) {
      section.classList.add("hidden");
      list.innerHTML = "";
      return;
    }
    var html = "";
    Object.keys(centros).forEach(function (id) {
      html += buildCentroCard(id, centros[id], { showInvite: false });
    });
    list.innerHTML = html;
    wireCentroCard(list);
    section.classList.remove("hidden");
  }

  // ---- Invitaciones pendientes (aceptar / rechazar) ----
  function renderInvitations(centros, user) {
    var section = document.getElementById("invitaciones-section");
    var list = document.getElementById("invitaciones-list");
    if (!section || !list) return;
    if (!centros || Object.keys(centros).length === 0) {
      section.classList.add("hidden");
      list.innerHTML = "";
      return;
    }
    var html = "";
    Object.keys(centros).forEach(function (id) {
      var c = centros[id];
      html +=
        '<div class="bg-primary-container/30 border border-primary rounded-xl p-md shadow-sm" data-centro-id="' + id + '">' +
          '<div class="flex items-start gap-md mb-md">' +
            '<span class="material-symbols-outlined text-primary mt-1" data-icon="handshake">handshake</span>' +
            '<div class="flex-1 min-w-0">' +
              '<p class="text-body-md text-on-surface"><strong>' + escapeHtml(c.nombre || "Un centro") + '</strong> te invitó a colaborar.</p>' +
              '<p class="text-on-surface-variant text-label-md truncate">' + escapeHtml(buildAddressString(c.direccion)) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-sm">' +
            '<button class="btn-rechazar flex items-center justify-center gap-1 bg-surface-container-high text-on-surface py-3 rounded-lg border border-outline-variant active:bg-surface-variant transition-colors" data-centro-id="' + id + '">' +
              '<span class="material-symbols-outlined" data-icon="close">close</span><span class="text-status-sm">Rechazar</span>' +
            '</button>' +
            '<button class="btn-aceptar flex items-center justify-center gap-1 bg-primary text-on-primary py-3 rounded-lg active:brightness-90 transition-all" data-centro-id="' + id + '">' +
              '<span class="material-symbols-outlined" data-icon="check">check</span><span class="text-status-sm">Aceptar</span>' +
            '</button>' +
          '</div>' +
        '</div>';
    });
    list.innerHTML = html;
    section.classList.remove("hidden");

    var myKey = emailToKey(user.email);

    list.querySelectorAll(".btn-aceptar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-centro-id");
        btn.disabled = true;
        var nombre = user.displayName || (user.email && user.email.split("@")[0]) || "Colaborador";
        var updates = {};
        updates["colaboradores/" + user.uid] = {
          email: user.email || "",
          nombre: nombre,
          aceptadoEn: firebase.database.ServerValue.TIMESTAMP
        };
        updates["invitaciones/" + myKey + "/estado"] = "aceptada";
        db.ref("centros/" + id).update(updates).then(function () {
          if (typeof logAnalyticsEvent === "function") logAnalyticsEvent("accept_collaborator", { centro_id: id });
          if (FirebaseDataManager.clearCache) FirebaseDataManager.clearCache("centro", id);
          loadDashboard(dashboardUser || user);
        }).catch(function () {
          btn.disabled = false;
          alert("No se pudo aceptar la invitación. Intenta de nuevo.");
        });
      });
    });

    list.querySelectorAll(".btn-rechazar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-centro-id");
        btn.disabled = true;
        db.ref("centros/" + id + "/invitaciones/" + myKey + "/estado").set("rechazada").then(function () {
          if (typeof logAnalyticsEvent === "function") logAnalyticsEvent("reject_collaborator", { centro_id: id });
          if (FirebaseDataManager.clearCache) FirebaseDataManager.clearCache("centro", id);
          loadDashboard(dashboardUser || user);
        }).catch(function () {
          btn.disabled = false;
          alert("No se pudo rechazar la invitación. Intenta de nuevo.");
        });
      });
    });
  }

  function buildAddressString(dir) {
    if (!dir) return "";
    var parts = [];
    if (dir.calle) parts.push(dir.calle);
    if (dir.piso) parts.push(dir.piso);
    if (dir.ciudad) parts.push(dir.ciudad);
    if (dir.estado) parts.push(dir.estado);
    return parts.join(", ");
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Register new center button
  if (btnRegistrarNuevo) {
    btnRegistrarNuevo.addEventListener("click", function () {
      window.location.href = "/crear-centro-p1.html";
    });
  }

  // Settings button -> profile page
  if (btnSettings) {
    btnSettings.addEventListener("click", function () {
      window.location.href = "/ajustes.html";
    });
  }

  // Cleanup Firebase listeners on page unload
  window.addEventListener("beforeunload", function () {
    if (window.FirebaseDataManager) {
      FirebaseDataManager.cleanup();
    }
  });
})();