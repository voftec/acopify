/*
 * Acopify - Edit centro page (info + real-time needs management)
 */

(function () {
  var contentEl = document.getElementById("editar-content");
  var params = new URLSearchParams(window.location.search);
  var centroId = params.get("id");

  if (!centroId) {
    contentEl.innerHTML =
      '<div class="empty-state"><p>Centro no encontrado.</p><a href="/" class="btn btn-primary">Volver</a></div>';
    return;
  }

  var centroRef = db.ref("centros/" + centroId);
  var map, marker;
  var currentNeeds = {};
  var formBuilt = false;

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      contentEl.innerHTML =
        '<div class="alert alert-info" style="margin-top: 24px;">Debes <a href="/login.html">iniciar sesion</a> para editar un centro.</div>';
      return;
    }

    // Auth can re-fire (token refresh); only build the form once to avoid
    // rebuilding the map and stacking duplicate listeners on unsaved edits.
    if (formBuilt) return;

    centroRef.once("value").then(function (snapshot) {
      var centro = snapshot.val();
      if (!centro) {
        contentEl.innerHTML =
          '<div class="empty-state"><p>Centro no encontrado.</p><a href="/" class="btn btn-primary">Volver</a></div>';
        return;
      }
      if (centro.organizadorId !== user.uid) {
        contentEl.innerHTML =
          '<div class="alert alert-error" style="margin-top: 24px;">No tienes permiso para editar este centro.</div>' +
          '<a href="/centro.html?id=' + centroId + '" class="btn btn-secondary" style="margin-top: 12px;">Ver centro</a>';
        return;
      }
      formBuilt = true;
      renderEditForm(centro);
    });
  });

  function renderEditForm(centro) {
    currentNeeds = centro.necesidades || {};

    var html =
      '<h1 style="margin: 24px 0 8px;">Editar Centro de Acopio</h1>' +
      '<p class="mb-16" style="color: var(--color-text-secondary);">Modifica la informacion de tu centro. Los cambios se veran reflejados inmediatamente.</p>' +
      '<div id="edit-error" class="alert alert-error hidden"></div>' +
      '<div id="edit-success" class="alert alert-success hidden"></div>' +

      '<form id="form-editar">' +
      '<div class="form-group">' +
      '<label class="form-label" for="nombre">Nombre del centro *</label>' +
      '<input class="form-input" type="text" id="nombre" required value="' + escapeAttr(centro.nombre) + '" />' +
      '</div>' +

      '<div class="form-group">' +
      '<label class="form-label" for="descripcion">Descripcion</label>' +
      '<textarea class="form-textarea" id="descripcion" rows="3">' + escapeHtml(centro.descripcion || "") + '</textarea>' +
      '</div>' +

      '<h3 class="mb-8" style="margin-top: 24px;">Direccion</h3>' +
      '<div class="form-row">' +
      '<div class="form-group"><label class="form-label" for="calle">Calle / Avenida *</label>' +
      '<input class="form-input" type="text" id="calle" required value="' + escapeAttr(centro.direccion ? centro.direccion.calle : "") + '" /></div>' +
      '<div class="form-group"><label class="form-label" for="ciudad">Ciudad *</label>' +
      '<input class="form-input" type="text" id="ciudad" required value="' + escapeAttr(centro.direccion ? centro.direccion.ciudad : "") + '" /></div>' +
      '</div>' +

      '<div class="form-row">' +
      '<div class="form-group"><label class="form-label" for="estado">Estado *</label>' +
      '<input class="form-input" type="text" id="estado" required value="' + escapeAttr(centro.direccion ? centro.direccion.estado : "") + '" /></div>' +
      '<div class="form-group"><label class="form-label" for="piso">Piso / Apartamento</label>' +
      '<input class="form-input" type="text" id="piso" value="' + escapeAttr(centro.direccion ? centro.direccion.piso : "") + '" /></div>' +
      '</div>' +

      '<h3 class="mb-8" style="margin-top: 24px;">Ubicacion en el mapa</h3>' +
      '<p class="form-hint mb-8">Arrastra el marcador para cambiar la ubicacion.</p>' +
      '<div class="map-form-container"><div id="map-editar"></div></div>' +
      '<p class="form-hint" id="coords-display">Lat: --, Lng: --</p>' +

      '<h3 class="mb-8" style="margin-top: 24px;">Contacto</h3>' +
      '<div class="form-row">' +
      '<div class="form-group"><label class="form-label" for="telefono">Telefono</label>' +
      '<input class="form-input" type="tel" id="telefono" value="' + escapeAttr(centro.contacto ? centro.contacto.telefono : "") + '" /></div>' +
      '<div class="form-group"><label class="form-label" for="whatsapp">WhatsApp</label>' +
      '<input class="form-input" type="tel" id="whatsapp" value="' + escapeAttr(centro.contacto ? centro.contacto.whatsapp : "") + '" /></div>' +
      '</div>' +

      '<div style="margin-top: 32px;">' +
      '<button class="btn btn-primary btn-block" type="submit" id="btn-save">Guardar cambios</button>' +
      '</div>' +
      '</form>' +

      '<hr style="margin: 32px 0; border: none; border-top: 1px solid var(--color-border);" />' +

      '<h2 style="margin-bottom: 16px;">Gestionar necesidades</h2>' +
      '<p class="form-hint mb-16">Agrega o elimina recursos que tu centro necesita. Los cambios se actualizan en tiempo real para los donantes.</p>' +
      '<div class="needs-list" id="needs-list"></div>' +
      '<div class="add-need-row" style="margin-bottom: 32px;">' +
      '<input class="form-input" type="text" id="need-input" placeholder="Ej: Agua, Comida, Medicinas..." />' +
      '<button type="button" class="btn btn-secondary" id="btn-add-need">Agregar</button>' +
      '</div>';

    contentEl.innerHTML = html;
    document.title = "Editar: " + escapeHtml(centro.nombre) + " - Acopify";

    // Init map
    var coords = centro.coordenadas || { lat: 10.48, lng: -66.87 };
    map = L.map("map-editar").setView([coords.lat, coords.lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map);
    var selectedLat = coords.lat;
    var selectedLng = coords.lng;
    updateCoordsDisplay(selectedLat, selectedLng);

    marker.on("dragend", function () {
      var pos = marker.getLatLng();
      selectedLat = pos.lat;
      selectedLng = pos.lng;
      updateCoordsDisplay(selectedLat, selectedLng);
    });

    map.on("click", function (e) {
      selectedLat = e.latlng.lat;
      selectedLng = e.latlng.lng;
      marker.setLatLng(e.latlng);
      updateCoordsDisplay(selectedLat, selectedLng);
    });

    // Render needs with real-time listener
    centroRef.child("necesidades").on("value", function (snapshot) {
      currentNeeds = snapshot.val() || {};
      renderNeeds();
    });

    // Add need
    var needInput = document.getElementById("need-input");
    var btnAddNeed = document.getElementById("btn-add-need");

    btnAddNeed.addEventListener("click", function () { addNeedToDb(); });
    needInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addNeedToDb();
      }
    });

    function addNeedToDb() {
      var val = needInput.value.trim();
      if (!val) return;

      var existing = Object.values(currentNeeds).some(function (n) {
        return n.nombre.toLowerCase() === val.toLowerCase();
      });
      if (existing) {
        needInput.value = "";
        return;
      }

      var newKey = db.ref().push().key;
      centroRef.child("necesidades/" + newKey).set({
        nombre: val,
        agregado: firebase.database.ServerValue.TIMESTAMP
      });
      needInput.value = "";
      needInput.focus();
    }

    // Save form
    var form = document.getElementById("form-editar");
    var btnSave = document.getElementById("btn-save");
    var errorDiv = document.getElementById("edit-error");
    var successDiv = document.getElementById("edit-success");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errorDiv.classList.add("hidden");
      successDiv.classList.add("hidden");
      btnSave.disabled = true;
      btnSave.textContent = "Guardando...";

      var updates = {
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
        }
      };

      centroRef.update(updates)
        .then(function () {
          successDiv.textContent = "Cambios guardados correctamente.";
          successDiv.classList.remove("hidden");
          window.scrollTo(0, 0);
        })
        .catch(function (error) {
          errorDiv.textContent = "Error al guardar: " + error.message;
          errorDiv.classList.remove("hidden");
          window.scrollTo(0, 0);
        })
        .finally(function () {
          btnSave.disabled = false;
          btnSave.textContent = "Guardar cambios";
        });
    });
  }

  function renderNeeds() {
    var needsList = document.getElementById("needs-list");
    if (!needsList) return;

    var entries = Object.entries(currentNeeds);
    if (entries.length === 0) {
      needsList.innerHTML = '<span class="needs-empty">Sin necesidades registradas</span>';
      return;
    }

    var html = "";
    entries.forEach(function (entry) {
      var key = entry[0];
      var need = entry[1];
      html +=
        '<span class="tag tag-warning tag-removable">' +
        escapeHtml(need.nombre) +
        ' <button type="button" class="tag-remove" data-key="' + key + '">&times;</button>' +
        '</span>';
    });
    needsList.innerHTML = html;

    needsList.querySelectorAll(".tag-remove").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var key = btn.getAttribute("data-key");
        centroRef.child("necesidades/" + key).remove();
      });
    });
  }

  function updateCoordsDisplay(lat, lng) {
    var el = document.getElementById("coords-display");
    if (el) {
      el.textContent = "Lat: " + lat.toFixed(6) + ", Lng: " + lng.toFixed(6);
    }
  }

  function escapeAttr(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
