/*
 * Acopify - Homepage: map + draggable bottom-sheet list with real-time updates
 */

(function () {
  var map;
  var markers = {};
  var centrosData = {};
  var selectedId = null;
  var userLocation = null;
  var onlyUrgent = false;
  var searchTerm = "";

  // DOM
  var listEl = document.getElementById("centros-list");
  var peekEl = document.getElementById("sheet-peek");
  var sheetEl = document.getElementById("bottom-sheet");
  var handleEl = document.getElementById("sheet-handle");
  var sheetListEl = document.getElementById("sheet-list");
  var searchInput = document.getElementById("search-input");
  var filterBtn = document.getElementById("filter-btn");
  var tabMapa = document.getElementById("tab-mapa");
  var tabLista = document.getElementById("tab-lista");
  var avatarBtn = document.getElementById("avatar-btn");

  // Venezuela default view
  var VZ_CENTER = [8.0, -66.0];
  var VZ_ZOOM = 6;

  // Marker icons (default blue / selected red)
  var iconDefault = L.divIcon({
    className: "",
    html: '<span class="material-symbols-outlined icon-filled" style="font-size:34px;color:#2563eb;line-height:1;">location_on</span>',
    iconSize: [34, 34], iconAnchor: [17, 32]
  });
  var iconSelected = L.divIcon({
    className: "",
    html: '<span class="material-symbols-outlined icon-filled" style="font-size:44px;color:#ba1a1a;line-height:1;">location_on</span>',
    iconSize: [44, 44], iconAnchor: [22, 40]
  });

  init();

  function init() {
    initMap();
    initSheet();
    initAuthAvatar();
    listenCentros();
    tryGeolocate();

    searchInput.addEventListener("input", function () {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderAll();
    });

    filterBtn.addEventListener("click", function () {
      onlyUrgent = !onlyUrgent;
      filterBtn.classList.toggle("bg-primary", onlyUrgent);
      filterBtn.classList.toggle("text-on-primary", onlyUrgent);
      filterBtn.classList.toggle("bg-surface-container-lowest", !onlyUrgent);
      renderAll();
    });

    tabMapa.addEventListener("click", function () { setTab("mapa"); collapseSheet(); });
    tabLista.addEventListener("click", function () { setTab("lista"); expandSheet(); });
  }

  /* ---------------- Map ---------------- */
  function initMap() {
    map = L.map("map", { zoomControl: true }).setView(VZ_CENTER, VZ_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
    map.on("click", function () { clearSelection(); });
  }

  function listenCentros() {
    db.ref("centros").on("value", function (snapshot) {
      centrosData = snapshot.val() || {};
      renderMarkers();
      renderAll();
    });
  }

  function renderMarkers() {
    Object.keys(markers).forEach(function (id) {
      if (!centrosData[id]) { map.removeLayer(markers[id]); delete markers[id]; }
    });
    Object.keys(centrosData).forEach(function (id) {
      var c = centrosData[id];
      if (!c.coordenadas) return;
      var latlng = [c.coordenadas.lat, c.coordenadas.lng];
      if (markers[id]) {
        markers[id].setLatLng(latlng);
      } else {
        var m = L.marker(latlng, { icon: iconDefault }).addTo(map);
        m.on("click", function (e) {
          if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
          selectCentro(id, true);
        });
        markers[id] = m;
      }
    });
  }

  /* ---------------- Selection ---------------- */
  function selectCentro(id, panTo) {
    selectedId = id;
    // update marker icons
    Object.keys(markers).forEach(function (mid) {
      markers[mid].setIcon(mid === id ? iconSelected : iconDefault);
    });
    var c = centrosData[id];
    if (panTo && c && c.coordenadas) {
      map.setView([c.coordenadas.lat, c.coordenadas.lng], Math.max(map.getZoom(), 14), { animate: true });
    }
    setTab("mapa");
    renderPeek();
    computeBounds();
    collapseSheet();
  }

  function clearSelection() {
    selectedId = null;
    Object.keys(markers).forEach(function (mid) { markers[mid].setIcon(iconDefault); });
    renderPeek();
    applyPeek();
  }

  /* ---------------- Rendering ---------------- */
  function renderAll() {
    renderPeek();
    renderList();
  }

  function getFilteredIds() {
    var ids = Object.keys(centrosData).filter(function (id) {
      var c = centrosData[id];
      if (onlyUrgent && needsCount(c) === 0) return false;
      if (searchTerm) {
        var hay = (c.nombre || "") + " " + buildAddressString(c.direccion);
        if (hay.toLowerCase().indexOf(searchTerm) === -1) return false;
      }
      return true;
    });
    // Sort by distance if available, else by name
    ids.sort(function (a, b) {
      if (userLocation) {
        return distanceTo(centrosData[a]) - distanceTo(centrosData[b]);
      }
      return (centrosData[a].nombre || "").localeCompare(centrosData[b].nombre || "");
    });
    return ids;
  }

  function renderPeek() {
    if (selectedId && centrosData[selectedId]) {
      peekEl.innerHTML = buildPeekCard(selectedId, centrosData[selectedId]);
      wirePeek();
    } else {
      var total = Object.keys(centrosData).length;
      peekEl.innerHTML =
        '<div class="flex items-center justify-between gap-sm py-1">' +
        '<div class="flex items-center gap-sm">' +
        '<span class="material-symbols-outlined text-primary icon-filled">pin_drop</span>' +
        '<div>' +
        '<p class="font-bold text-on-surface leading-tight">' + total + ' centros activos</p>' +
        '<p class="text-label-md text-on-surface-variant">Desliza hacia arriba para ver la lista</p>' +
        '</div></div>' +
        '<button id="peek-expand" class="text-primary"><span class="material-symbols-outlined">expand_less</span></button>' +
        '</div>';
      var be = document.getElementById("peek-expand");
      if (be) be.addEventListener("click", function () { setTab("lista"); expandSheet(); });
    }
  }

  function buildPeekCard(id, c) {
    var pr = priority(c);
    var needs = c.necesidades ? Object.values(c.necesidades) : [];
    var tags = needs.slice(0, 4).map(function (n) {
      return '<span class="bg-surface-variant text-on-surface-variant text-label-md font-label-md px-3 py-1 rounded-full flex items-center gap-1">' +
        '<span class="material-symbols-outlined text-[16px]">' + needIcon(n.nombre) + '</span>' + escapeHtml(n.nombre) + '</span>';
    }).join("");
    if (needs.length > 4) tags += '<span class="text-label-md text-on-surface-variant px-2 py-1">+' + (needs.length - 4) + '</span>';

    return '' +
      '<div class="relative bg-surface-container-lowest rounded-xl">' +
      '<div class="flex justify-between items-start">' +
      '<h3 class="text-headline-md font-headline-md text-on-surface pr-2">' + escapeHtml(c.nombre) + '</h3>' +
      '<button id="peek-close" class="text-on-surface-variant -mt-1"><span class="material-symbols-outlined">close</span></button>' +
      '</div>' +
      '<p class="flex items-center gap-1 text-label-md font-label-md mt-1 mb-2" style="color:' + pr.color + '">' +
      '<span class="material-symbols-outlined text-[14px] icon-filled">circle</span>' + pr.label + '</p>' +
      (needs.length
        ? '<span class="text-label-md font-label-md text-outline uppercase tracking-wider block mb-1">Necesidades principales</span>' +
          '<div class="flex flex-wrap gap-2 mb-3">' + tags + '</div>'
        : '<p class="text-body-md text-on-surface-variant mb-3">Sin necesidades urgentes registradas.</p>') +
      '<button id="peek-detail" class="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md hover:brightness-110 transition-all active:scale-[0.98] flex justify-center items-center gap-2">' +
      'Ver detalle completo <span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>' +
      '</div>';
  }

  function wirePeek() {
    var close = document.getElementById("peek-close");
    if (close) close.addEventListener("click", function (e) { e.stopPropagation(); clearSelection(); });
    var detail = document.getElementById("peek-detail");
    if (detail) detail.addEventListener("click", function () { window.location.href = "/centro.html?id=" + selectedId; });
  }

  function renderList() {
    var ids = getFilteredIds();
    if (ids.length === 0) {
      listEl.innerHTML =
        '<div class="text-center py-10 text-on-surface-variant">' +
        '<span class="material-symbols-outlined text-5xl text-outline-variant">inventory_2</span>' +
        '<p class="mt-2">' + (Object.keys(centrosData).length === 0 ? "No hay centros de acopio registrados aun." : "No se encontraron centros con ese criterio.") + '</p>' +
        '</div>';
      return;
    }
    listEl.innerHTML = ids.map(function (id) { return buildListCard(id, centrosData[id]); }).join("");

    // Wire buttons
    listEl.querySelectorAll("[data-route]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var c = centrosData[b.getAttribute("data-route")];
        if (c && c.coordenadas) {
          window.open("https://www.google.com/maps/dir/?api=1&destination=" + c.coordenadas.lat + "," + c.coordenadas.lng, "_blank");
        }
      });
    });
    listEl.querySelectorAll("[data-detail]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        window.location.href = "/centro.html?id=" + b.getAttribute("data-detail");
      });
    });
    // Click card -> select on map
    listEl.querySelectorAll("[data-card]").forEach(function (card) {
      card.addEventListener("click", function () {
        selectCentro(card.getAttribute("data-card"), true);
      });
    });
  }

  function buildListCard(id, c) {
    var pr = priority(c);
    var needs = c.necesidades ? Object.values(c.necesidades) : [];
    var hasNeeds = needs.length > 0;

    var distBadge = "";
    if (userLocation && c.coordenadas) {
      distBadge =
        '<span class="bg-surface-variant text-on-surface-variant text-status-sm font-status-sm px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0">' +
        '<span class="material-symbols-outlined text-[16px]">location_on</span> a ' + formatDistance(distanceTo(c)) + '</span>';
    }

    var tags = needs.slice(0, 4).map(function (n) {
      var cls = hasNeeds
        ? "bg-error-container text-on-error-container"
        : "bg-surface-variant text-on-surface-variant";
      return '<span class="' + cls + ' text-label-md font-label-md px-3 py-1 rounded-full flex items-center gap-1">' +
        '<span class="material-symbols-outlined text-[16px] icon-filled">' + needIcon(n.nombre) + '</span>' + escapeHtml(n.nombre) + '</span>';
    }).join("");
    if (needs.length > 4) tags += '<span class="bg-surface-variant text-on-surface-variant text-label-md font-label-md px-3 py-1 rounded-full">+' + (needs.length - 4) + '</span>';

    return '' +
      '<article data-card="' + id + '" class="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm relative overflow-hidden flex flex-col gap-md hover:shadow-md transition-shadow cursor-pointer">' +
      '<div class="absolute left-0 top-0 bottom-0 w-1" style="background:' + pr.color + '"></div>' +
      '<div class="flex-1 w-full">' +
        '<div class="flex justify-between items-start gap-2 mb-2">' +
          '<h3 class="text-headline-md font-headline-md text-on-surface">' + escapeHtml(c.nombre) + '</h3>' +
          distBadge +
        '</div>' +
        '<p class="text-body-md font-body-md text-on-surface-variant mb-3 flex items-start gap-1">' +
          '<span class="material-symbols-outlined text-[18px] mt-0.5">signpost</span>' + escapeHtml(buildAddressString(c.direccion)) +
        '</p>' +
        '<span class="text-label-md font-label-md text-outline uppercase tracking-wider block mb-1">' +
          (hasNeeds ? "Necesidades urgentes" : "Estado") + '</span>' +
        '<div class="flex flex-wrap gap-2">' +
          (hasNeeds ? tags :
            '<span class="bg-primary-fixed text-on-primary-fixed text-label-md font-label-md px-3 py-1 rounded-full flex items-center gap-1">' +
            '<span class="material-symbols-outlined text-[16px]">check_circle</span> Sin necesidades urgentes</span>') +
        '</div>' +
      '</div>' +
      '<div class="w-full flex gap-2">' +
        '<button data-route="' + id + '" class="flex-1 bg-primary-container text-on-primary-container hover:bg-primary-fixed font-label-md text-label-md py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-colors">' +
          '<span class="material-symbols-outlined">directions</span> Ruta</button>' +
        '<button data-detail="' + id + '" class="flex-1 bg-surface-container text-primary border border-outline-variant hover:bg-surface-variant font-label-md text-label-md py-2 px-4 rounded-lg flex justify-center items-center gap-2 transition-colors">' +
          '<span class="material-symbols-outlined">info</span> Detalles</button>' +
      '</div>' +
      '</article>';
  }

  /* ---------------- Bottom sheet drag ---------------- */
  var COLLAPSED_Y = 0; // computed
  var dragging = false, startY = 0, startTransform = 0, currentY = 0;

  // Peek is taller when a center is selected (to fit its quick card).
  function peekHeight() {
    return (selectedId && centrosData[selectedId]) ? 260 : 96;
  }
  function isExpanded() { return currentY < COLLAPSED_Y / 2; }

  function computeBounds() {
    var sheetH = Math.round(window.innerHeight * 0.9);
    sheetEl.style.height = sheetH + "px";
    var peek = peekHeight();
    sheetListEl.style.maxHeight = (sheetH - peek) + "px";
    COLLAPSED_Y = Math.max(sheetH - peek, 0);
  }

  // Recompute peek bounds and keep the current snap state (used on selection change).
  function applyPeek() {
    var wasExpanded = isExpanded();
    computeBounds();
    setTranslate(wasExpanded ? 0 : COLLAPSED_Y, true);
  }

  function setTranslate(y, animate) {
    currentY = Math.min(Math.max(y, 0), COLLAPSED_Y);
    sheetEl.classList.toggle("animate", !!animate);
    sheetEl.style.transform = "translateY(" + currentY + "px)";
  }

  function collapseSheet() { setTranslate(COLLAPSED_Y, true); setTab("mapa"); }
  function expandSheet() { setTranslate(0, true); }

  function initSheet() {
    computeBounds();
    setTranslate(COLLAPSED_Y, false);
    renderPeek();

    window.addEventListener("resize", function () {
      var wasExpanded = currentY < COLLAPSED_Y / 2;
      computeBounds();
      setTranslate(wasExpanded ? 0 : COLLAPSED_Y, false);
      if (map) map.invalidateSize();
    });

    handleEl.addEventListener("pointerdown", onDown);
    // Allow dragging down from the list only when scrolled to top
    sheetListEl.addEventListener("pointerdown", function (e) {
      if (sheetListEl.scrollTop <= 0) onDown(e, true);
    });
  }

  function onDown(e, fromList) {
    dragging = true;
    startY = e.clientY;
    startTransform = currentY;
    sheetEl.classList.remove("animate");
    if (!fromList) { try { handleEl.setPointerCapture(e.pointerId); } catch (x) {} }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function onMove(e) {
    if (!dragging) return;
    var delta = e.clientY - startY;
    // If dragging from list, only react to downward pulls
    setTranslate(startTransform + delta, false);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    // snap to nearest
    if (currentY < COLLAPSED_Y / 2) { expandSheet(); setTab("lista"); }
    else { collapseSheet(); }
  }

  // Click handle toggles
  handleEl.addEventListener("click", function () {
    if (dragging) return;
    if (currentY > COLLAPSED_Y / 2) { expandSheet(); setTab("lista"); }
    else { collapseSheet(); }
  });

  function setTab(which) {
    var mapaActive = which === "mapa";
    tabMapa.classList.toggle("bg-primary", mapaActive);
    tabMapa.classList.toggle("text-on-primary", mapaActive);
    tabMapa.classList.toggle("shadow-sm", mapaActive);
    tabMapa.classList.toggle("text-on-surface-variant", !mapaActive);
    tabLista.classList.toggle("bg-primary", !mapaActive);
    tabLista.classList.toggle("text-on-primary", !mapaActive);
    tabLista.classList.toggle("shadow-sm", !mapaActive);
    tabLista.classList.toggle("text-on-surface-variant", mapaActive);
  }

  /* ---------------- Auth avatar ---------------- */
  function initAuthAvatar() {
    if (typeof auth === "undefined") return;
    auth.onAuthStateChanged(function (user) {
      if (user) {
        avatarBtn.href = "/mis-centros.html";
        avatarBtn.title = user.displayName || user.email;
        if (user.photoURL) {
          avatarBtn.innerHTML = '<img src="' + user.photoURL + '" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer">';
        }
      } else {
        avatarBtn.href = "/login.html";
        avatarBtn.title = "Iniciar sesion";
      }
    });
  }

  /* ---------------- Geolocation / distance ---------------- */
  function tryGeolocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      renderAll();
    }, function () {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
  }

  function distanceTo(c) {
    if (!userLocation || !c.coordenadas) return Infinity;
    return haversine(userLocation.lat, userLocation.lng, c.coordenadas.lat, c.coordenadas.lng);
  }

  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(km) {
    if (km === Infinity) return "";
    if (km < 1) return Math.round(km * 1000) + "m";
    return km.toFixed(1) + "km";
  }

  /* ---------------- Priority / helpers ---------------- */
  // Priority derived from number of registered needs (no fake data).
  function needsCount(c) { return c && c.necesidades ? Object.keys(c.necesidades).length : 0; }

  function priority(c) {
    var n = needsCount(c);
    if (n >= 3) return { label: "Alta prioridad", color: "#d52022" };   // tertiary-container
    if (n >= 1) return { label: "Prioridad media", color: "#fd761a" };  // secondary-container
    return { label: "Operativo", color: "#004ac6" };                     // primary
  }

  function needIcon(name) {
    var s = (name || "").toLowerCase();
    if (/agua/.test(s)) return "water_drop";
    if (/medic|farmac|medica/.test(s)) return "medication";
    if (/sangre/.test(s)) return "bloodtype";
    if (/ropa|abrigo|frio|frío/.test(s)) return "checkroom";
    if (/aliment|comida|pereced|enlatad/.test(s)) return "restaurant";
    if (/pa\u00f1al|bebe|beb\u00e9|infant/.test(s)) return "child_care";
    if (/higien|jab|aseo/.test(s)) return "soap";
    if (/voluntar/.test(s)) return "volunteer_activism";
    return "inventory_2";
  }

  function buildAddressString(dir) {
    if (!dir) return "Sin direccion";
    var parts = [];
    if (dir.calle) parts.push(dir.calle);
    if (dir.piso) parts.push(dir.piso);
    if (dir.ciudad) parts.push(dir.ciudad);
    if (dir.estado) parts.push(dir.estado);
    return parts.join(", ") || "Sin direccion";
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();