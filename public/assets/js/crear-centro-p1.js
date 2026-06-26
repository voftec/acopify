/*
 * Acopify - Crear Centro de Acopio - Pantalla 1 (Formulario inicial)
 */

(function () {
  var form = document.getElementById("form-crear-centro");
  var authRequired = document.getElementById("auth-required");
  var errorDiv = document.getElementById("form-error");
  var errorText = document.getElementById("error-text");
  var needsList = document.getElementById("needs-list");
  var needInput = document.getElementById("need-input");
  var btnAddNeed = document.getElementById("btn-add-need");
  var btnContinuar = document.getElementById("btn-continuar");
  var btnCancelar = document.getElementById("btn-cancelar");

  var horariosList = document.getElementById("horarios-list");

  var needs = [];
  var formData = {};
  var currentUser = null;

  // Días de la semana para el horario de atención
  var DIAS = [
    { key: "lunes", label: "Lunes" },
    { key: "martes", label: "Martes" },
    { key: "miercoles", label: "Miércoles" },
    { key: "jueves", label: "Jueves" },
    { key: "viernes", label: "Viernes" },
    { key: "sabado", label: "Sábado" },
    { key: "domingo", label: "Domingo" }
  ];

  // Render schedule rows (one per day)
  function renderHorarios() {
    if (!horariosList) return;
    var html = "";
    DIAS.forEach(function (d) {
      html +=
        '<div class="flex items-center gap-sm flex-wrap p-3 bg-surface-container-low rounded-xl border border-outline-variant">' +
        '<label class="flex items-center gap-sm cursor-pointer select-none min-w-[120px]">' +
        '<input type="checkbox" class="horario-toggle h-5 w-5 rounded text-primary-container focus:ring-primary-container" data-dia="' + d.key + '">' +
        '<span class="text-body-md font-semibold text-on-surface">' + d.label + '</span>' +
        '</label>' +
        '<div class="flex items-center gap-xs flex-1 horario-times opacity-50" data-dia="' + d.key + '">' +
        '<input type="time" value="08:00" disabled class="horario-desde flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all">' +
        '<span class="text-on-surface-variant text-sm">a</span>' +
        '<input type="time" value="17:00" disabled class="horario-hasta flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all">' +
        '</div>' +
        '</div>';
    });
    horariosList.innerHTML = html;

    horariosList.querySelectorAll(".horario-toggle").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var dia = cb.getAttribute("data-dia");
        var timesWrap = horariosList.querySelector('.horario-times[data-dia="' + dia + '"]');
        var inputs = timesWrap.querySelectorAll("input");
        inputs.forEach(function (inp) {
          inp.disabled = !cb.checked;
        });
        timesWrap.classList.toggle("opacity-50", !cb.checked);
      });
    });
  }

  // Build horarios object from current UI state
  function collectHorarios() {
    var horarios = {};
    DIAS.forEach(function (d) {
      var cb = horariosList.querySelector('.horario-toggle[data-dia="' + d.key + '"]');
      if (cb && cb.checked) {
        var timesWrap = horariosList.querySelector('.horario-times[data-dia="' + d.key + '"]');
        horarios[d.key] = {
          desde: timesWrap.querySelector(".horario-desde").value || "",
          hasta: timesWrap.querySelector(".horario-hasta").value || ""
        };
      }
    });
    return horarios;
  }

  renderHorarios();

  // Check auth state
  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    if (user) {
      form.classList.remove("hidden");
      authRequired.classList.add("hidden");
      btnContinuar.disabled = false;
    } else {
      form.classList.add("hidden");
      authRequired.classList.remove("hidden");
      btnContinuar.disabled = true;
      // Return here after a successful login.
      sessionStorage.setItem("postLoginRedirect", "/crear-centro-p1.html");
    }
  });

  // Cancel button
  if (btnCancelar) {
    btnCancelar.addEventListener("click", function () {
      if (confirm("¿Estás seguro de que deseas cancelar? Los datos ingresados se perderán.")) {
        window.location.href = "/mis-centros.html";
      }
    });
  }

  // Needs management
  btnAddNeed.addEventListener("click", addNeed);
  needInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addNeed();
    }
  });

  function addNeed() {
    var val = needInput.value.trim();
    if (!val) return;
    if (needs.indexOf(val) !== -1) {
      showError("Esta necesidad ya fue agregada.");
      return;
    }
    needs.push(val);
    renderNeeds();
    needInput.value = "";
    needInput.focus();
    hideError();
  }

  function removeNeed(index) {
    needs.splice(index, 1);
    renderNeeds();
  }

  function renderNeeds() {
    if (needs.length === 0) {
      needsList.innerHTML = '<span class="text-body-md text-on-surface-variant text-sm">Sin necesidades agregadas aún</span>';
      return;
    }
    var html = "";
    needs.forEach(function (n, i) {
      html +=
        '<span class="inline-flex items-center gap-xs px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-full text-sm font-medium">' +
        escapeHtml(n) +
        ' <button type="button" class="need-remove hover:brightness-110 transition-all" data-index="' + i + '">' +
        '<span class="material-symbols-outlined text-base" data-icon="close">close</span>' +
        '</button>' +
        '</span>';
    });
    needsList.innerHTML = html;

    needsList.querySelectorAll(".need-remove").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        removeNeed(parseInt(btn.getAttribute("data-index")));
      });
    });
  }

  renderNeeds();

  // Continue button - validate and save form data
  btnContinuar.addEventListener("click", function () {
    if (!currentUser) {
      showError("Debes iniciar sesión para continuar.");
      return;
    }

    // Validate required fields
    var nombre = document.getElementById("nombre").value.trim();
    var calle = document.getElementById("calle").value.trim();
    var ciudad = document.getElementById("ciudad").value.trim();
    var estado = document.getElementById("estado").value.trim();

    if (!nombre) {
      showError("Por favor ingresa el nombre del centro.");
      document.getElementById("nombre").focus();
      return;
    }

    if (!calle) {
      showError("Por favor ingresa la calle/avenida.");
      document.getElementById("calle").focus();
      return;
    }

    if (!ciudad) {
      showError("Por favor ingresa la ciudad.");
      document.getElementById("ciudad").focus();
      return;
    }

    if (!estado) {
      showError("Por favor ingresa el estado.");
      document.getElementById("estado").focus();
      return;
    }

    // Save form data to sessionStorage for next step
    formData = {
      nombre: nombre,
      descripcion: document.getElementById("descripcion").value.trim(),
      direccion: {
        calle: calle,
        ciudad: ciudad,
        estado: estado,
        piso: document.getElementById("piso").value.trim()
      },
      contacto: {
        telefono: document.getElementById("telefono").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim()
      },
      necesidades: needs,
      horarios: collectHorarios()
    };

    sessionStorage.setItem("crearCentroFormData", JSON.stringify(formData));

    // Navigate to step 2
    window.location.href = "/crear-centro-p2.html";
  });

  function showError(msg) {
    errorText.textContent = msg;
    errorDiv.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function hideError() {
    errorDiv.classList.add("hidden");
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();