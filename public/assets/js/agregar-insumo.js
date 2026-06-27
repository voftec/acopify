/*
 * Acopify - Agregar insumo a la lista de recursos de un centro
 */

(function () {
  // Check if Firebase is properly initialized
  if (!db || !auth) {
    console.error("Firebase not initialized in agregar-insumo.js");
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var centroId = params.get("id");

  var btnCerrar = document.getElementById("btn-cerrar");
  var btnGuardar = document.getElementById("btn-guardar");
  var nameInput = document.getElementById("insumo-name");
  var categoriasGrid = document.getElementById("categorias-grid");
  var feedback = document.getElementById("save-feedback");
  var feedbackText = document.getElementById("feedback-text");
  var feedbackClose = document.getElementById("feedback-close");

  var selectedCategoria = null;
  var selectedPrioridad = null;
  var centroRef = centroId ? db.ref("centros/" + centroId) : null;

  var backUrl = centroId ? "/lista-recursos.html?id=" + centroId : "/mis-centros.html";

  if (!centroId) {
    alert("No se encontró el centro. Vuelve a la lista de centros.");
    window.location.href = "/mis-centros.html";
    return;
  }

  // Verificar permisos: solo el organizador puede agregar insumos.
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      alert("Debes iniciar sesión para agregar insumos.");
      window.location.href = "/login.html";
      return;
    }
    centroRef.once("value").then(function (snapshot) {
      var centro = snapshot.val();
      if (!centro) {
        alert("Este centro no existe o fue eliminado.");
        window.location.href = "/mis-centros.html";
        return;
      }
      if (centro.organizadorId !== user.uid) {
        alert("No tienes permiso para gestionar este centro.");
        window.location.href = "/lista-recursos.html?id=" + centroId;
      }
    });
  });

  // Render categorías
  function renderCategorias() {
    var html = "";
    RECURSO_CATEGORIAS.forEach(function (cat) {
      html +=
        '<button type="button" class="category-card group flex flex-col p-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-left hover:border-primary transition-all active:scale-[0.98]" data-categoria="' + cat.id + '">' +
        '<div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center mb-3 group-hover:bg-primary-fixed transition-colors">' +
        '<span class="material-symbols-outlined text-primary">' + cat.icon + '</span>' +
        '</div>' +
        '<span class="font-label-md text-label-md leading-tight">' + cat.label + '</span>' +
        '</button>';
    });
    categoriasGrid.innerHTML = html;

    categoriasGrid.querySelectorAll(".category-card").forEach(function (card) {
      card.addEventListener("click", function () {
        selectCategory(card);
      });
    });
  }

  function selectCategory(element) {
    categoriasGrid.querySelectorAll(".category-card").forEach(function (card) {
      card.classList.remove("active");
      var iconWrap = card.querySelector("div");
      iconWrap.classList.remove("bg-primary-container");
      iconWrap.classList.add("bg-surface-container");
      var icon = card.querySelector(".material-symbols-outlined");
      icon.classList.remove("text-on-primary-container");
      icon.classList.add("text-primary");
    });

    element.classList.add("active");
    selectedCategoria = element.getAttribute("data-categoria");
    var iconWrap = element.querySelector("div");
    iconWrap.classList.remove("bg-surface-container");
    iconWrap.classList.add("bg-primary-container");
    var icon = element.querySelector(".material-symbols-outlined");
    icon.classList.remove("text-primary");
    icon.classList.add("text-on-primary-container");
  }

  // Prioridad
  var priorityButtons = document.querySelectorAll(".priority-toggle");
  priorityButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectPriority(btn, btn.getAttribute("data-priority"));
    });
  });

  function selectPriority(element, level) {
    priorityButtons.forEach(function (btn) {
      btn.classList.remove(
        "bg-primary", "text-on-primary", "shadow-md",
        "bg-tertiary-container", "text-on-tertiary",
        "bg-secondary-container", "text-on-secondary-container",
        "bg-primary-container", "text-on-primary-container"
      );
      btn.classList.add("text-on-surface-variant");
    });

    element.classList.remove("text-on-surface-variant");
    selectedPrioridad = level;

    if (level === "alta") {
      element.classList.add("bg-tertiary-container", "text-on-tertiary", "shadow-md");
    } else if (level === "media") {
      element.classList.add("bg-secondary-container", "text-on-secondary-container", "shadow-md");
    } else {
      element.classList.add("bg-primary-container", "text-on-primary-container", "shadow-md");
    }
  }

  // Guardar
  btnGuardar.addEventListener("click", function () {
    var nombre = nameInput.value.trim();

    if (!selectedCategoria) {
      showFeedback("Selecciona una categoría.", true);
      return;
    }
    if (!nombre) {
      showFeedback("Escribe el nombre del insumo.", true);
      nameInput.focus();
      return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    var newKey = db.ref().push().key;
    var insumo = {
      nombre: nombre,
      categoria: selectedCategoria,
      agregado: firebase.database.ServerValue.TIMESTAMP
    };
    if (selectedPrioridad) insumo.prioridad = selectedPrioridad;

    centroRef.child("necesidades/" + newKey).set(insumo)
      .then(function () {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("add_insumo", {
            nombre: insumo.nombre,
            categoria: insumo.categoria,
            prioridad: insumo.prioridad || "baja",
            centro_id: centroId
          });
        }
        showFeedback("Insumo guardado correctamente", false);
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(function () {
          window.location.href = backUrl;
        }, 800);
      })
      .catch(function (error) {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "GUARDAR";
        showFeedback("Error al guardar: " + error.message, true);
      });
  });

  btnCerrar.addEventListener("click", function () {
    window.location.href = backUrl;
  });

  feedbackClose.addEventListener("click", function () {
    feedback.classList.add("translate-y-32");
  });

  function showFeedback(text, isError) {
    feedbackText.textContent = text;
    var box = feedback.firstElementChild;
    if (isError) {
      box.classList.remove("bg-inverse-surface", "text-inverse-on-surface");
      box.classList.add("bg-error", "text-on-error");
    } else {
      box.classList.remove("bg-error", "text-on-error");
      box.classList.add("bg-inverse-surface", "text-inverse-on-surface");
    }
    feedback.classList.remove("translate-y-32");
    if (isError) {
      setTimeout(function () {
        feedback.classList.add("translate-y-32");
      }, 3000);
    }
  }

  renderCategorias();
})();
