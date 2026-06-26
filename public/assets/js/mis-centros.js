/*
 * Acopify - My centros dashboard (new design)
 */

(function () {
  var centrosList = document.getElementById("centros-list");
  var authRequired = document.getElementById("auth-required");
  var mainContent = document.getElementById("main-content");
  var loadingState = document.getElementById("loading-state");
  var btnRegistrarNuevo = document.getElementById("btn-registrar-nuevo");
  var btnSettings = document.getElementById("btn-settings");
  var btnLogout = document.getElementById("btn-logout");

  // Show loading initially
  loadingState.classList.remove("hidden");
  mainContent.classList.add("hidden");
  authRequired.classList.add("hidden");

  auth.onAuthStateChanged(function (user) {
    loadingState.classList.add("hidden");
    
    if (user) {
      authRequired.classList.add("hidden");
      mainContent.classList.remove("hidden");
      loadMyCentros(user.uid);
    } else {
      authRequired.classList.remove("hidden");
      mainContent.classList.add("hidden");
      centrosList.innerHTML = "";
    }
  });

  function loadMyCentros(uid) {
    db.ref("centros")
      .orderByChild("organizadorId")
      .equalTo(uid)
      .on("value", function (snapshot) {
        var centros = snapshot.val();
        renderCentros(centros);
      });
  }

  function renderCentros(centros) {
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
      var c = centros[id];
      var needs = c.necesidades ? Object.keys(c.necesidades).length : 0;
      var address = buildAddressString(c.direccion);
      
      html +=
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
        '</div>';
    });
    centrosList.innerHTML = html;

    // Edit buttons
    centrosList.querySelectorAll(".btn-editar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var centroId = btn.getAttribute("data-centro-id");
        window.location.href = "/editar.html?id=" + centroId;
      });
    });

    // Needs buttons
    centrosList.querySelectorAll(".btn-necesidades").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var centroId = btn.getAttribute("data-centro-id");
        window.location.href = "/lista-recursos.html?id=" + centroId;
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

  // Logout button
  if (btnLogout) {
    btnLogout.addEventListener("click", function () {
      if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        auth.signOut().then(function () {
          window.location.href = "/login.html";
        });
      }
    });
  }
})();