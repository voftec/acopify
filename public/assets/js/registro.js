/*
 * Acopify - Centro registration form
 */

(function () {
  var map, marker;
  var selectedLat = null;
  var selectedLng = null;
  var needs = [];
  var form = document.getElementById("form-registro");
  var authRequired = document.getElementById("auth-required");
  var errorDiv = document.getElementById("form-error");
  var coordsDisplay = document.getElementById("coords-display");
  var needsList = document.getElementById("needs-list");
  var needInput = document.getElementById("need-input");
  var btnAddNeed = document.getElementById("btn-add-need");
  var btnSubmit = document.getElementById("btn-submit");

  // Venezuela center
  var VZ_CENTER = [10.48, -66.87]; // Caracas
  var VZ_ZOOM = 12;

  auth.onAuthStateChanged(function (user) {
    if (user) {
      form.classList.remove("hidden");
      authRequired.classList.add("hidden");
      initMap();
    } else {
      form.classList.add("hidden");
      authRequired.classList.remove("hidden");
    }
  });

  function initMap() {
    if (map) return;
    map = L.map("map-registro").setView(VZ_CENTER, VZ_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    marker = L.marker(VZ_CENTER, { draggable: true }).addTo(map);
    selectedLat = VZ_CENTER[0];
    selectedLng = VZ_CENTER[1];
    updateCoordsDisplay();

    marker.on("dragend", function () {
      var pos = marker.getLatLng();
      selectedLat = pos.lat;
      selectedLng = pos.lng;
      updateCoordsDisplay();
    });

    map.on("click", function (e) {
      selectedLat = e.latlng.lat;
      selectedLng = e.latlng.lng;
      marker.setLatLng(e.latlng);
      updateCoordsDisplay();
    });
  }

  function updateCoordsDisplay() {
    coordsDisplay.textContent = "Lat: " + selectedLat.toFixed(6) + ", Lng: " + selectedLng.toFixed(6);
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
    if (needs.indexOf(val) !== -1) return;
    needs.push(val);
    renderNeeds();
    needInput.value = "";
    needInput.focus();
  }

  function removeNeed(index) {
    needs.splice(index, 1);
    renderNeeds();
  }

  function renderNeeds() {
    if (needs.length === 0) {
      needsList.innerHTML = '<span class="needs-empty">Sin necesidades agregadas aun</span>';
      return;
    }
    var html = "";
    needs.forEach(function (n, i) {
      html +=
        '<span class="tag tag-warning tag-removable" data-index="' + i + '">' +
        escapeHtml(n) +
        ' <button type="button" class="tag-remove" data-index="' + i + '">&times;</button>' +
        '</span>';
    });
    needsList.innerHTML = html;

    needsList.querySelectorAll(".tag-remove").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        removeNeed(parseInt(btn.getAttribute("data-index")));
      });
    });
  }

  renderNeeds();

  // Form submit
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideError();

    if (!currentUser) {
      showError("Debes iniciar sesion para registrar un centro.");
      return;
    }

    if (selectedLat === null || selectedLng === null) {
      showError("Selecciona la ubicacion en el mapa.");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Registrando...";

    var centroData = {
      nombre: document.getElementById("nombre").value.trim(),
      descripcion: document.getElementById("descripcion").value.trim(),
      direccion: {
        calle: document.getElementById("calle").value.trim(),
        ciudad: document.getElementById("ciudad").value.trim(),
        estado: document.getElementById("estado").value.trim(),
        piso: document.getElementById("piso").value.trim()
      },
      coordenadas: {
        lat: selectedLat,
        lng: selectedLng
      },
      contacto: {
        telefono: document.getElementById("telefono").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim()
      },
      organizadorId: currentUser.uid,
      organizadorNombre: currentUser.displayName || currentUser.email.split("@")[0],
      creadoEn: firebase.database.ServerValue.TIMESTAMP,
      reportes: 0
    };

    // Build needs object
    var necesidades = {};
    needs.forEach(function (n) {
      var key = db.ref().push().key;
      necesidades[key] = {
        nombre: n,
        agregado: firebase.database.ServerValue.TIMESTAMP
      };
    });
    centroData.necesidades = necesidades;

    var newRef = db.ref("centros").push();
    newRef.set(centroData)
      .then(function () {
        window.location.href = "/centro?id=" + newRef.key;
      })
      .catch(function (error) {
        showError("Error al registrar: " + error.message);
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Registrar Centro";
      });
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  function hideError() {
    errorDiv.classList.add("hidden");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
