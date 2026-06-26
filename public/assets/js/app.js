/*
 * Acopify - Homepage: map + centro list with real-time updates
 */

(function () {
  var map;
  var markers = {};
  var centrosData = {};
  var listEl = document.getElementById("centros-list");
  var sidebarEl = document.getElementById("sidebar");
  var mapContainerEl = document.querySelector(".map-container");

  // Venezuela center coordinates
  var VZ_CENTER = [8.0, -66.0];
  var VZ_ZOOM = 7;

  initMap();
  listenCentros();
  setupViewToggle();

  function initMap() {
    map = L.map("map").setView(VZ_CENTER, VZ_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  function listenCentros() {
    db.ref("centros").on("value", function (snapshot) {
      var data = snapshot.val() || {};
      centrosData = data;
      renderMarkers(data);
      renderList(data);
    });
  }

  function renderMarkers(centros) {
    // Remove old markers
    Object.keys(markers).forEach(function (id) {
      if (!centros[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });

    Object.keys(centros).forEach(function (id) {
      var c = centros[id];
      if (!c.coordenadas) return;

      var lat = c.coordenadas.lat;
      var lng = c.coordenadas.lng;

      if (markers[id]) {
        markers[id].setLatLng([lat, lng]);
        markers[id].setPopupContent(buildPopup(id, c));
      } else {
        var marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup(buildPopup(id, c));
        markers[id] = marker;
      }
    });
  }

  function buildPopup(id, centro) {
    var needs = centro.necesidades ? Object.values(centro.necesidades) : [];
    var needsHtml = "";
    if (needs.length > 0) {
      needsHtml = '<div class="popup-needs">';
      needs.slice(0, 5).forEach(function (n) {
        needsHtml += '<span class="tag">' + escapeHtml(n.nombre) + '</span>';
      });
      if (needs.length > 5) {
        needsHtml += '<span class="tag">+' + (needs.length - 5) + ' mas</span>';
      }
      needsHtml += '</div>';
    }

    return '<div class="popup-content">' +
      '<h3>' + escapeHtml(centro.nombre) + '</h3>' +
      '<p>' + escapeHtml(buildAddressString(centro.direccion)) + '</p>' +
      needsHtml +
      '<a href="/centro?id=' + id + '" class="popup-link">Ver detalles &rarr;</a>' +
      '</div>';
  }

  function renderList(centros) {
    var ids = Object.keys(centros);
    if (ids.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-state-icon">📦</div>' +
        '<p>No hay centros de acopio registrados aun.</p>' +
        '<a href="/registro" class="btn btn-primary">Registrar el primero</a>' +
        '</div>';
      return;
    }

    var html = "";
    ids.forEach(function (id) {
      var c = centros[id];
      var needs = c.necesidades ? Object.values(c.necesidades) : [];
      var needsHtml = "";
      if (needs.length > 0) {
        needsHtml = '<div class="centro-card-needs">';
        needs.slice(0, 4).forEach(function (n) {
          needsHtml += '<span class="tag">' + escapeHtml(n.nombre) + '</span>';
        });
        if (needs.length > 4) {
          needsHtml += '<span class="tag">+' + (needs.length - 4) + '</span>';
        }
        needsHtml += '</div>';
      }

      html +=
        '<div class="centro-card" data-id="' + id + '">' +
        '<div class="centro-card-name">' + escapeHtml(c.nombre) + '</div>' +
        '<div class="centro-card-address">' + escapeHtml(buildAddressString(c.direccion)) + '</div>' +
        needsHtml +
        '</div>';
    });

    listEl.innerHTML = html;

    // Click handlers
    listEl.querySelectorAll(".centro-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var id = card.getAttribute("data-id");
        window.location.href = "/centro?id=" + id;
      });
    });
  }

  function setupViewToggle() {
    var toggle = document.getElementById("view-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", function (e) {
      if (!e.target.classList.contains("list-toggle-btn")) return;
      var view = e.target.getAttribute("data-view");
      toggle.querySelectorAll(".list-toggle-btn").forEach(function (btn) {
        btn.classList.remove("active");
      });
      e.target.classList.add("active");

      if (view === "map") {
        mapContainerEl.style.display = "";
        sidebarEl.style.display = "none";
      } else {
        mapContainerEl.style.display = "none";
        sidebarEl.style.display = "";
      }
      if (view === "map") {
        map.invalidateSize();
      }
    });

    // On mobile, default to map view, hide sidebar
    if (window.innerWidth < 768) {
      sidebarEl.style.display = "none";
    }
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
})();
