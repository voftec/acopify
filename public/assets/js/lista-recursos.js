/*
 * Acopify - Lista de recursos necesarios (gestión por el organizador del centro)
 */

(function () {
  // Check if Firebase is properly initialized
  if (!db || !auth) {
    console.error("Firebase not initialized in lista-recursos.js");
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var centroId = params.get("id");

  var loadingState = document.getElementById("loading-state");
  var authRequired = document.getElementById("auth-required");
  var content = document.getElementById("recursos-content");
  var listEl = document.getElementById("recursos-list");
  var nombreEl = document.getElementById("centro-nombre");
  var metaEl = document.getElementById("centro-meta");
  var btnAgregar = document.getElementById("btn-agregar");

  if (!centroId) {
    loadingState.classList.add("hidden");
    content.classList.remove("hidden");
    listEl.innerHTML =
      '<p class="text-body-md text-on-surface-variant text-center py-lg">Centro no encontrado. ' +
      '<a href="/mi-centro.html" class="text-primary font-semibold underline">Volver a mi centro</a>.</p>';
    return;
  }

  var centroRef = db.ref("centros/" + centroId);
  var isOwner = false;

  btnAgregar.addEventListener("click", function () {
    window.location.href = "/agregar-insumo.html?id=" + centroId;
  });

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      loadingState.classList.add("hidden");
      content.classList.add("hidden");
      authRequired.classList.remove("hidden");
      return;
    }
    authRequired.classList.add("hidden");

    // Use FirebaseDataManager for efficient caching
    FirebaseDataManager.getCentro(centroId).then(function (centro) {
      loadingState.classList.add("hidden");

      if (!centro) {
        content.classList.remove("hidden");
        listEl.innerHTML =
          '<p class="text-body-md text-on-surface-variant text-center py-lg">Este centro no existe o fue eliminado.</p>';
        btnAgregar.classList.add("hidden");
        return;
      }

      // El organizador y los colaboradores confirmados pueden gestionar recursos.
      var isCollaborator = !!(centro.colaboradores && centro.colaboradores[user.uid]);
      isOwner = centro.organizadorId === user.uid || isCollaborator;
      content.classList.remove("hidden");
      nombreEl.textContent = centro.nombre || "Lista de recursos necesarios";

      if (!isOwner) {
        btnAgregar.classList.add("hidden");
      }

      // Realtime listener para los insumos del centro
      var needsListener = function (snap) {
        renderList(snap.val() || {});
      };
      centroRef.child("necesidades").on("value", needsListener);
      
      // Store listener for cleanup
      window.listaRecursosNeedsListener = needsListener;
      window.listaRecursosCentroRef = centroRef;
    }).catch(function (error) {
      console.error("Error loading centro:", error);
      loadingState.classList.add("hidden");
      content.classList.remove("hidden");
      listEl.innerHTML =
        '<p class="text-body-md text-error text-center py-lg">Error al cargar el centro. Por favor intenta de nuevo.</p>';
    });
  });

  function renderList(necesidades) {
    var entries = Object.keys(necesidades).map(function (key) {
      return { key: key, data: necesidades[key] };
    });

    var total = entries.length;
    metaEl.innerHTML = total + (total === 1 ? " insumo registrado" : " insumos registrados");

    if (total === 0) {
      listEl.innerHTML =
        '<div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center">' +
        '<span class="material-symbols-outlined text-6xl text-outline-variant" data-icon="inventory_2">inventory_2</span>' +
        '<p class="text-body-lg font-semibold text-on-surface mt-md mb-1">Aún no hay recursos en la lista</p>' +
        '<p class="text-body-md text-on-surface-variant">' +
        (isOwner ? "Agrega los insumos que tu centro necesita actualmente." : "Este centro no tiene recursos registrados.") +
        '</p>' +
        '</div>';
      return;
    }

    // Agrupar por categoría
    var grupos = {};
    entries.forEach(function (e) {
      var catId = (e.data && e.data.categoria) ? e.data.categoria : RECURSO_CATEGORIA_OTROS.id;
      if (!grupos[catId]) grupos[catId] = [];
      grupos[catId].push(e);
    });

    var orden = RECURSO_CATEGORIAS.map(function (c) { return c.id; });
    orden.push(RECURSO_CATEGORIA_OTROS.id);

    var html = "";
    orden.forEach(function (catId) {
      var items = grupos[catId];
      if (!items || items.length === 0) return;
      var cat = getCategoriaById(catId);

      html +=
        '<section class="space-y-md">' +
        '<div class="flex items-center gap-md border-b border-outline-variant pb-2">' +
        '<span class="text-2xl">' + cat.emoji + '</span>' +
        '<h3 class="font-headline-md text-on-background">' + escapeHtml(cat.label) + '</h3>' +
        '</div>' +
        '<ul class="grid grid-cols-1 md:grid-cols-2 gap-sm pl-2">';

      items.forEach(function (e) {
        html += renderItem(e.key, e.data);
      });

      html += '</ul></section>';
    });

    listEl.innerHTML = html;
    attachItemEvents();
  }

  function renderItem(key, data) {
    var cubierto = !!data.cubierto;
    var checkIcon = cubierto ? "check_box" : "check_box_outline_blank";
    var nameClass = cubierto ? "line-through text-outline" : "text-on-surface-variant";

    var prioridadHtml = "";
    if (data.prioridad && RECURSO_PRIORIDADES[data.prioridad]) {
      var p = RECURSO_PRIORIDADES[data.prioridad];
      prioridadHtml =
        '<span class="text-status-sm px-2 py-0.5 rounded-full ' + p.badge + '">' + p.label + '</span>';
    }

    var deleteBtn = isOwner
      ? '<button class="btn-delete-need ml-auto text-outline hover:text-error transition-colors p-1 rounded-full" data-key="' + key + '" title="Eliminar">' +
        '<span class="material-symbols-outlined" style="font-size:20px;">delete</span></button>'
      : "";

    var checkBtn = isOwner
      ? '<button class="btn-toggle-need flex items-center" data-key="' + key + '" data-cubierto="' + cubierto + '" title="Marcar como cubierto">' +
        '<span class="material-symbols-outlined text-outline" style="font-size:20px;">' + checkIcon + '</span></button>'
      : '<span class="material-symbols-outlined text-outline" style="font-size:20px;">' + checkIcon + '</span>';

    return (
      '<li class="flex items-center gap-md font-body-md bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2">' +
      checkBtn +
      '<span class="' + nameClass + '">' + escapeHtml(data.nombre || "") + '</span>' +
      prioridadHtml +
      deleteBtn +
      '</li>'
    );
  }

  function attachItemEvents() {
    if (!isOwner) return;

    listEl.querySelectorAll(".btn-toggle-need").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-key");
        var cubierto = btn.getAttribute("data-cubierto") === "true";
        centroRef.child("necesidades/" + key + "/cubierto").set(!cubierto);
      });
    });

    listEl.querySelectorAll(".btn-delete-need").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-key");
        if (confirm("¿Eliminar este insumo de la lista?")) {
          centroRef.child("necesidades/" + key).remove();
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Cleanup Firebase listeners on page unload
  window.addEventListener("beforeunload", function () {
    if (window.listaRecursosCentroRef && window.listaRecursosNeedsListener) {
      window.listaRecursosCentroRef.child("necesidades").off("value", window.listaRecursosNeedsListener);
    }
    if (window.FirebaseDataManager) {
      FirebaseDataManager.cleanup();
    }
  });
})();
