/*
 * Acopify - Crear Centro de Acopio - Pantalla 1 (Formulario inicial)
 */

(function () {
  // Check if Firebase is properly initialized
  if (!auth || !db) {
    console.error("Firebase not initialized in crear-centro-p1.js");
    return;
  }

  var form = document.getElementById("form-crear-centro");
  var errorDiv = document.getElementById("form-error");
  var errorText = document.getElementById("error-text");
  var paisSelect = document.getElementById("pais");
  var estadoSelect = document.getElementById("estado");
  var ciudadInput = document.getElementById("ciudad");
  var ciudadDropdown = document.getElementById("ciudad-dropdown");
  var ciudadHint = document.getElementById("ciudad-hint");
  var allCities = [];        // ciudades activas (del estado o del municipio seleccionado)
  var allStateCities = [];   // respaldo: todas las ciudades del estado
  var ciudadSelectedIdx = -1;

  var municipioWrapper = document.getElementById("municipio-wrapper");
  var municipioInput = document.getElementById("municipio");
  var municipioDropdown = document.getElementById("municipio-dropdown");
  var allMunicipios = [];    // [{ municipio, capital, localidades }] del estado actual
  var municipioSelectedIdx = -1;
  var telefonosList = document.getElementById("telefonos-list");
  var whatsappsList = document.getElementById("whatsapps-list");
  var btnAddTelefono = document.getElementById("btn-add-telefono");
  var btnAddWhatsapp = document.getElementById("btn-add-whatsapp");
  var btnContinuar = document.getElementById("btn-continuar");
  var btnCancelar = document.getElementById("btn-cancelar");

  var horariosList = document.getElementById("horarios-list");

  var geoData = [];
  var formData = {};
  var currentUser = null;

  // ---- Modo edición ----------------------------------------------------
  // Esta misma vista/lógica sirve para crear y para editar. Si la URL trae
  // ?id=<centroId> (página /editar), entramos en modo edición: cargamos el
  // centro desde Firebase, precargamos todos los campos y al guardar hacemos
  // update() (en vez de push()) preservando necesidades/reportes/creadoEn.
  var EDIT_ID = (function () {
    try { return new URLSearchParams(window.location.search).get("id") || null; }
    catch (e) { return null; }
  })();
  var IS_EDIT = !!EDIT_ID;
  var editCentro = null;
  // Valores de dirección a precargar una vez que las listas asíncronas
  // (ciudades / municipios) terminan de cargar y rehabilitan sus inputs.
  var pendingCityValue = null;
  var pendingMunicipioValue = null;

  // ---- Mapa (ubicación exacta, fusionado desde el antiguo paso 2) ----
  var coordDisplay = document.getElementById("coord-display");
  var btnMyLocation = document.getElementById("btn-my-location");
  var mapLoading = document.getElementById("map-loading");

  var map = null;
  var mapInitialized = false;
  var selectedLat = null;
  var selectedLng = null;

  // Geocodificación inversa (pin -> barrio/sector).
  var lastGeo = null;
  var reverseGeoTimer = null;
  // Geocodificación directa (dirección escrita -> centrar mapa).
  var addrGeoTimer = null;

  // Centro por defecto (Caracas, Venezuela) hasta que se geocodifique o se use GPS.
  var DEFAULT_CENTER = [10.4806, -66.9036];
  var DEFAULT_ZOOM = 13;

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

  // ---- País / Estado (dropdowns con datos consistentes) ----

  // Aplica el país por defecto del proyecto cuando no se puede detectar la
  // ubicación del usuario (geolocalización denegada, sin conexión, etc.).
  function applyDefaultCountry(list) {
    var def = AcopifyGeo.DEFAULT_COUNTRY;
    var hasDef = list.some(function (c) { return c.name === def; });
    paisSelect.value = hasDef ? def : "";
    populateEstados(paisSelect.value);
  }

  // sessionStorage key that caches the resolved country name so geolocation
  // and Nominatim are only called once per session (permission not re-asked).
  var GEO_COUNTRY_KEY = "acopify:geoCountry";

  function applyCountry(list, name) {
    paisSelect.value = name;
    populateEstados(name);
  }

  function saveAndApplyCountry(list, match) {
    try { sessionStorage.setItem(GEO_COUNTRY_KEY, match.name); } catch (e) {}
    applyCountry(list, match.name);
  }

  // Intenta detectar el país del usuario por geolocalización + Nominatim.
  // El resultado se cachea en sessionStorage para que las visitas siguientes
  // a este formulario no repitan la consulta ni el permiso de ubicación.
  function detectCountryByGeo(list) {
    // 1. Servir desde caché si ya lo resolvimos en esta sesión.
    try {
      var cached = sessionStorage.getItem(GEO_COUNTRY_KEY);
      if (cached) {
        var hit = list.find(function (c) { return c.name === cached; });
        if (hit) { applyCountry(list, hit.name); return; }
      }
    } catch (e) {}

    // 2. Sin caché: pedir la posición (el navegador no vuelve a preguntar si
    //    el permiso ya fue otorgado).
    if (!navigator.geolocation) { applyDefaultCountry(list); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var url = "https://nominatim.openstreetmap.org/reverse" +
        "?format=jsonv2&zoom=3&addressdetails=1&accept-language=en" +
        "&lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng);
      fetch(url, { headers: { "Accept": "application/json" } })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          var rawCountry = (json && json.address && json.address.country) || "";
          // Case-insensitive match against the canonical dataset names.
          var match = list.find(function (c) {
            return c.name.toLowerCase() === rawCountry.toLowerCase();
          });
          if (match) {
            saveAndApplyCountry(list, match);
          } else {
            applyDefaultCountry(list);
          }
        })
        .catch(function () { applyDefaultCountry(list); });
    }, function () {
      // Geolocation denied or unavailable – fall back to project default.
      applyDefaultCountry(list);
    }, { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 });
  }

  function initGeoSelects() {
    if (!window.AcopifyGeo || !paisSelect || !estadoSelect) return;

    AcopifyGeo.load().then(function (list) {
      geoData = list;

      paisSelect.innerHTML = '<option value="">Selecciona un país</option>';
      list.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name;
        paisSelect.appendChild(opt);
      });

      geoReady = true;
      if (IS_EDIT) {
        // En edición no autodetectamos el país: precargamos lo guardado en
        // cuanto el centro esté disponible.
        maybePrefillGeo();
      } else {
        // Auto-detect the user's country; falls back to DEFAULT_COUNTRY.
        detectCountryByGeo(list);
      }
    });
  }

  // Aplica la dirección guardada (país→estado→municipio→ciudad) cuando tanto
  // la lista de países como el centro ya están cargados.
  var geoReady = false;
  var geoPrefilled = false;
  function maybePrefillGeo() {
    if (geoPrefilled || !geoReady || !editCentro) return;
    geoPrefilled = true;
    var dir = editCentro.direccion || {};

    var hasCountry = geoData.some(function (c) { return c.name === dir.pais; });
    paisSelect.value = hasCountry ? dir.pais : "";
    populateEstados(paisSelect.value); // construye estados + updateCity (deshabilitado)

    if (dir.estado) estadoSelect.value = dir.estado;

    // Estos valores se aplican dentro de setCitiesLoaded / setMunicipiosLoaded
    // (y sus variantes de texto libre) una vez que rehabilitan los inputs.
    pendingMunicipioValue = dir.municipio || null;
    pendingCityValue = dir.ciudad || null;

    updateMunicipios(estadoSelect.value);
    updateCity();
  }

  function populateEstados(country) {
    if (!estadoSelect) return;
    var states = window.AcopifyGeo ? AcopifyGeo.getStates(geoData, country) : [];

    if (!country) {
      estadoSelect.innerHTML = '<option value="">Selecciona un país primero</option>';
      estadoSelect.disabled = true;
    } else if (states.length === 0) {
      estadoSelect.innerHTML = '<option value="">Sin estados disponibles</option>';
      estadoSelect.disabled = true;
    } else {
      estadoSelect.disabled = false;
      estadoSelect.innerHTML = '<option value="">Selecciona un estado</option>';
      states.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        estadoSelect.appendChild(opt);
      });
    }
    updateCity();
  }

  if (paisSelect) {
    paisSelect.addEventListener("change", function () {
      populateEstados(paisSelect.value);
      scheduleAddressGeocode();
    });
  }
  if (estadoSelect) {
    estadoSelect.addEventListener("change", function () {
      updateCity();
      updateMunicipios(estadoSelect.value);
      scheduleAddressGeocode();
    });
  }

  initGeoSelects();

  // =====================================================================
  // Mapa: caja cuadrada con pin central fijo. El usuario mueve el mapa
  // (o usa "Estoy aquí" / GPS) para fijar la ubicación exacta del centro.
  // La dirección escrita centra el mapa automáticamente (geocodificación).
  // =====================================================================
  function initMapOnce() {
    if (mapInitialized || typeof L === "undefined") return;
    var mapEl = document.getElementById("map");
    if (!mapEl) return;
    mapInitialized = true;

    map = L.map("map", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      scrollWheelZoom: 'center',
      touchZoom: 'center',
      doubleClickZoom: 'center'
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    selectedLat = DEFAULT_CENTER[0];
    selectedLng = DEFAULT_CENTER[1];
    updateCoordsDisplay();

    map.on("move", function () {
      var c = map.getCenter();
      selectedLat = c.lat;
      selectedLng = c.lng;
      updateCoordsDisplay();
    });
    map.on("moveend", scheduleReverseGeocode);

    if (mapLoading) mapLoading.classList.add("hidden");

    // El contenedor estaba oculto hasta el login: recalcular tamaño.
    setTimeout(function () { if (map) map.invalidateSize(); }, 60);

    // En modo edición NO autocentramos por dirección: respetamos las
    // coordenadas guardadas (loadCentroForEdit hace el setView). El usuario
    // sigue pudiendo recentrar al editar la dirección o usar "Estoy aquí".
    if (!IS_EDIT) {
      // Si el usuario ya escribió dirección antes del login, centrar.
      scheduleAddressGeocode();
    }
  }

  function updateCoordsDisplay() {
    if (!coordDisplay || selectedLat == null || selectedLng == null) return;
    var latDir = selectedLat >= 0 ? "N" : "S";
    var lngDir = selectedLng >= 0 ? "E" : "W";
    coordDisplay.textContent =
      Math.abs(selectedLat).toFixed(4) + "° " + latDir + ", " +
      Math.abs(selectedLng).toFixed(4) + "° " + lngDir;
  }

  // ---- Geocodificación directa: dirección escrita -> centrar el mapa ----
  function buildAddressQuery() {
    var parts = [
      document.getElementById("calle") ? document.getElementById("calle").value.trim() : "",
      getCiudadValue(),
      getMunicipioValue(),
      estadoSelect ? estadoSelect.value : "",
      paisSelect ? paisSelect.value : ""
    ];
    return parts.filter(function (p) { return !!p; }).join(", ");
  }

  function scheduleAddressGeocode() {
    if (!window.AcopifyGeocode || !map) return;
    if (addrGeoTimer) clearTimeout(addrGeoTimer);
    addrGeoTimer = setTimeout(runAddressGeocode, 1000);
  }

  function runAddressGeocode() {
    var query = buildAddressQuery();
    // Necesitamos al menos ciudad + estado/país para una búsqueda útil.
    if (!query || query.split(",").length < 2) return;

    AcopifyGeocode.search(query).then(function (res) {
      if (!res || res.lat == null || res.lng == null || !map) return;
      // Zoom según el detalle: si hay calle, acercar más.
      var hasStreet = document.getElementById("calle") && document.getElementById("calle").value.trim();
      map.setView([res.lat, res.lng], hasStreet ? 17 : 14);
    }).catch(function () { /* best-effort */ });
  }

  // ---- Geocodificación inversa: pin -> barrio / sector ----
  // Barrio/sector is now auto-detected from reverse geocoding only

  function scheduleReverseGeocode() {
    if (!window.AcopifyGeocode) return;
    if (reverseGeoTimer) clearTimeout(reverseGeoTimer);
    reverseGeoTimer = setTimeout(runReverseGeocode, 1200);
  }

  function runReverseGeocode() {
    if (selectedLat == null || selectedLng == null) return;
    var reqLat = selectedLat, reqLng = selectedLng;

    AcopifyGeocode.reverse(reqLat, reqLng).then(function (geo) {
      lastGeo = geo;
    }).catch(function () {
      // Silently fail - barrio/sector is optional
    });
  }

  // ---- "Estoy aquí": usar la ubicación actual del dispositivo (GPS) ----
  if (btnMyLocation) {
    btnMyLocation.addEventListener("click", function () {
      if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
      }
      btnMyLocation.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (position) {
          if (map) map.setView([position.coords.latitude, position.coords.longitude], 18);
          if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
          btnMyLocation.disabled = false;
        },
        function () {
          alert("No se pudo obtener tu ubicación actual.");
          btnMyLocation.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // Al terminar de escribir la calle, recentrar el mapa en la dirección.
  var calleInput = document.getElementById("calle");
  if (calleInput) {
    calleInput.addEventListener("change", scheduleAddressGeocode);
  }

  // ---- Ciudad (combobox con autocompletado + texto libre) ----
  // Muestra sugerencias mientras el usuario escribe y también permite escribir
  // cualquier ciudad que no esté en la lista (p.ej. municipios, caseríos, etc.).

  function normCity(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function closeCityDropdown() {
    if (ciudadDropdown) ciudadDropdown.classList.add("hidden");
    ciudadSelectedIdx = -1;
  }

  function setDropdownItem(idx) {
    if (!ciudadDropdown) return;
    var items = ciudadDropdown.querySelectorAll("li");
    ciudadSelectedIdx = idx;
    items.forEach(function (li, i) {
      li.classList.toggle("bg-surface-container-low", i === idx);
    });
    if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }

  function openCityDropdown(items) {
    if (!ciudadDropdown || !items.length) { closeCityDropdown(); return; }
    ciudadSelectedIdx = -1;
    ciudadDropdown.innerHTML = "";
    items.forEach(function (city) {
      var li = document.createElement("li");
      li.className = "px-4 py-3 cursor-pointer text-sm text-on-surface hover:bg-surface-container-low transition-colors";
      li.setAttribute("role", "option");
      li.textContent = city;
      li.addEventListener("mousedown", function (e) {
        e.preventDefault(); // evitar que el blur se dispare antes del click
        ciudadInput.value = city;
        closeCityDropdown();
        scheduleAddressGeocode();
      });
      ciudadDropdown.appendChild(li);
    });
    ciudadDropdown.classList.remove("hidden");
  }

  function setCityDisabled(placeholder) {
    if (!ciudadInput) return;
    ciudadInput.disabled = true;
    ciudadInput.value = "";
    ciudadInput.placeholder = placeholder;
    allCities = [];
    closeCityDropdown();
    if (ciudadHint) ciudadHint.classList.add("hidden");
  }

  // Consume el valor de ciudad pendiente de precarga (modo edición), si lo hay.
  function takePendingCity() {
    if (pendingCityValue == null) return "";
    var v = pendingCityValue;
    pendingCityValue = null;
    return v;
  }

  function setCitiesLoaded(cities) {
    if (!ciudadInput) return;
    allCities = cities;
    allStateCities = cities; // respaldo para cuando el municipio se deselecciona
    ciudadInput.disabled = false;
    ciudadInput.value = takePendingCity();
    ciudadInput.placeholder = "Busca o escribe una ciudad";
    if (ciudadHint) ciudadHint.classList.add("hidden");
  }

  function setCityFreeText(hintMsg) {
    if (!ciudadInput) return;
    allCities = [];
    ciudadInput.disabled = false;
    ciudadInput.value = takePendingCity();
    ciudadInput.placeholder = "Escribe la ciudad";
    if (ciudadHint) {
      if (hintMsg) { ciudadHint.textContent = hintMsg; ciudadHint.classList.remove("hidden"); }
      else ciudadHint.classList.add("hidden");
    }
  }

  if (ciudadInput) {
    ciudadInput.addEventListener("focus", function () {
      if (!allCities.length) return;
      var val = ciudadInput.value.trim();
      var list = val
        ? allCities.filter(function (c) { return normCity(c).indexOf(normCity(val)) !== -1; })
        : allCities;
      openCityDropdown(list);
    });

    ciudadInput.addEventListener("input", function () {
      if (!allCities.length) return;
      var val = ciudadInput.value.trim();
      if (!val) { openCityDropdown(allCities); return; }
      var filtered = allCities.filter(function (c) { return normCity(c).indexOf(normCity(val)) !== -1; });
      if (filtered.length) openCityDropdown(filtered);
      else closeCityDropdown();
    });

    ciudadInput.addEventListener("change", scheduleAddressGeocode);

    ciudadInput.addEventListener("blur", function () {
      setTimeout(closeCityDropdown, 150);
    });

    ciudadInput.addEventListener("keydown", function (e) {
      if (!ciudadDropdown || ciudadDropdown.classList.contains("hidden")) return;
      var items = ciudadDropdown.querySelectorAll("li");
      if (e.key === "Escape") { closeCityDropdown(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setDropdownItem(Math.min(ciudadSelectedIdx + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setDropdownItem(Math.max(ciudadSelectedIdx - 1, 0)); }
      else if (e.key === "Enter" && ciudadSelectedIdx >= 0 && items[ciudadSelectedIdx]) {
        e.preventDefault();
        ciudadInput.value = items[ciudadSelectedIdx].textContent;
        closeCityDropdown();
      }
    });
  }

  function updateCity() {
    var country = paisSelect ? paisSelect.value : "";
    var state = estadoSelect ? estadoSelect.value : "";

    if (!country) { setCityDisabled("Selecciona un país primero"); return; }

    // País con estados pero ninguno elegido aún.
    if (estadoSelect && !estadoSelect.disabled && !state) {
      setCityDisabled("Selecciona un estado primero");
      return;
    }

    // País sin estados en el catálogo: no hay con qué consultar ciudades.
    if (!state) { setCityFreeText(""); return; }

    if (!window.AcopifyCities) { setCityFreeText(""); return; }

    setCityDisabled("Cargando ciudades...");
    var reqCountry = country, reqState = state;
    AcopifyCities.load(country, state).then(function (cities) {
      if (paisSelect.value !== reqCountry || estadoSelect.value !== reqState) return;
      setCitiesLoaded(cities);
    }).catch(function () {
      if (paisSelect.value !== reqCountry || estadoSelect.value !== reqState) return;
      setCityFreeText("No encontramos una lista de ciudades para este estado. Escríbela manualmente.");
    });
  }

  function getCiudadValue() {
    if (!ciudadInput) return "";
    return ciudadInput.value.trim();
  }

  // ---- Municipio (solo Venezuela) ----

  function closeMunicipioDropdown() {
    if (municipioDropdown) municipioDropdown.classList.add("hidden");
    municipioSelectedIdx = -1;
  }

  function setMunicipioDropdownItem(idx) {
    if (!municipioDropdown) return;
    var items = municipioDropdown.querySelectorAll("li");
    municipioSelectedIdx = idx;
    items.forEach(function (li, i) { li.classList.toggle("bg-surface-container-low", i === idx); });
    if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: "nearest" });
  }

  function openMunicipioDropdown(items) {
    if (!municipioDropdown || !items.length) { closeMunicipioDropdown(); return; }
    municipioSelectedIdx = -1;
    municipioDropdown.innerHTML = "";
    items.forEach(function (m) {
      var li = document.createElement("li");
      li.className = "px-4 py-3 cursor-pointer text-sm text-on-surface hover:bg-surface-container-low transition-colors";
      li.setAttribute("role", "option");
      li.textContent = m.municipio + (m.capital && m.capital !== m.municipio ? " – " + m.capital : "");
      li.addEventListener("mousedown", function (e) {
        e.preventDefault();
        municipioInput.value = m.municipio;
        closeMunicipioDropdown();
        applyMunicipioFilter(m.municipio);
      });
      municipioDropdown.appendChild(li);
    });
    municipioDropdown.classList.remove("hidden");
  }

  function setMunicipioDisabled(placeholder) {
    if (!municipioInput) return;
    municipioInput.disabled = true;
    municipioInput.value = "";
    municipioInput.placeholder = placeholder;
    allMunicipios = [];
    closeMunicipioDropdown();
  }

  function setMunicipiosLoaded(municipios) {
    if (!municipioInput) return;
    allMunicipios = municipios;
    municipioInput.disabled = false;
    municipioInput.placeholder = "Busca o escribe un municipio";
    if (pendingMunicipioValue != null) {
      municipioInput.value = pendingMunicipioValue;
      pendingMunicipioValue = null;
    } else {
      municipioInput.value = "";
    }
  }

  // Aplica el filtro de ciudad según el municipio seleccionado/escrito.
  function applyMunicipioFilter(municipioName) {
    if (!municipioName) {
      allCities = allStateCities.slice();
      if (ciudadInput) ciudadInput.value = "";
      closeCityDropdown();
      return;
    }
    var match = allMunicipios.find(function (m) {
      return normCity(m.municipio) === normCity(municipioName);
    });
    if (match && match.localidades && match.localidades.length) {
      allCities = match.localidades.slice();
    } else {
      allCities = allStateCities.slice();
    }
    if (ciudadInput) ciudadInput.value = "";
    closeCityDropdown();
  }

  if (municipioInput) {
    municipioInput.addEventListener("focus", function () {
      if (!allMunicipios.length) return;
      var val = normCity(municipioInput.value.trim());
      var list = val
        ? allMunicipios.filter(function (m) { return normCity(m.municipio).indexOf(val) !== -1; })
        : allMunicipios;
      openMunicipioDropdown(list.slice(0, 30));
    });

    municipioInput.addEventListener("input", function () {
      if (!allMunicipios.length) return;
      var val = normCity(municipioInput.value.trim());
      if (!val) { openMunicipioDropdown(allMunicipios.slice(0, 30)); return; }
      var filtered = allMunicipios.filter(function (m) { return normCity(m.municipio).indexOf(val) !== -1; });
      if (filtered.length) openMunicipioDropdown(filtered.slice(0, 30));
      else closeMunicipioDropdown();
    });

    municipioInput.addEventListener("blur", function () {
      setTimeout(function () {
        closeMunicipioDropdown();
        applyMunicipioFilter(municipioInput.value.trim());
      }, 150);
    });

    municipioInput.addEventListener("keydown", function (e) {
      if (!municipioDropdown || municipioDropdown.classList.contains("hidden")) return;
      var items = municipioDropdown.querySelectorAll("li");
      if (e.key === "Escape") { closeMunicipioDropdown(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setMunicipioDropdownItem(Math.min(municipioSelectedIdx + 1, items.length - 1)); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setMunicipioDropdownItem(Math.max(municipioSelectedIdx - 1, 0)); }
      else if (e.key === "Enter" && municipioSelectedIdx >= 0 && items[municipioSelectedIdx]) {
        e.preventDefault();
        var text = items[municipioSelectedIdx].textContent.split(" – ")[0].trim();
        municipioInput.value = text;
        closeMunicipioDropdown();
        applyMunicipioFilter(text);
      }
    });
  }

  function updateMunicipios(state) {
    var country = paisSelect ? paisSelect.value : "";
    if (country !== "Venezuela" || !state) {
      if (municipioWrapper) municipioWrapper.classList.add("hidden");
      setMunicipioDisabled("Selecciona un estado primero");
      allMunicipios = [];
      return;
    }
    if (!window.AcopifyMunicipios) { return; }
    if (municipioWrapper) municipioWrapper.classList.remove("hidden");
    setMunicipioDisabled("Cargando municipios...");
    var reqState = state;
    AcopifyMunicipios.load(state).then(function (municipios) {
      if ((estadoSelect ? estadoSelect.value : "") !== reqState) return;
      if (municipios.length) {
        setMunicipiosLoaded(municipios);
      } else {
        if (municipioWrapper) municipioWrapper.classList.add("hidden");
      }
    }).catch(function () {
      if (municipioWrapper) municipioWrapper.classList.add("hidden");
    });
  }

  function getMunicipioValue() {
    if (!municipioInput) return "";
    return municipioInput.value.trim();
  }

  // ---- Contacto (múltiples teléfonos / WhatsApp, todos opcionales) ----
  function addPhoneRow(container, value) {
    if (!container) return null;
    var row = document.createElement("div");
    row.className = "flex items-center gap-sm";

    var input = document.createElement("input");
    input.type = "tel";
    input.className = "phone-entry flex-1 px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all";
    input.placeholder = "+58 412 1234567";
    if (value) input.value = value;

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "shrink-0 p-2 text-on-surface-variant hover:text-error transition-colors";
    remove.setAttribute("aria-label", "Eliminar número");
    remove.innerHTML = '<span class="material-symbols-outlined" data-icon="close">close</span>';
    remove.addEventListener("click", function () { row.remove(); });

    row.appendChild(input);
    row.appendChild(remove);
    container.appendChild(row);
    return input;
  }

  function collectPhones(container) {
    var values = [];
    if (!container) return values;
    container.querySelectorAll(".phone-entry").forEach(function (inp) {
      var v = inp.value.trim();
      if (v && values.indexOf(v) === -1) values.push(v);
    });
    return values;
  }

  if (btnAddTelefono) {
    btnAddTelefono.addEventListener("click", function () {
      var input = addPhoneRow(telefonosList);
      if (input) input.focus();
    });
  }
  if (btnAddWhatsapp) {
    btnAddWhatsapp.addEventListener("click", function () {
      var input = addPhoneRow(whatsappsList);
      if (input) input.focus();
    });
  }

  // En modo creación empezamos con una fila vacía en cada lista. En modo
  // edición las filas se rellenan desde el contacto guardado (prefillContacto).
  if (!IS_EDIT) {
    addPhoneRow(telefonosList);
    addPhoneRow(whatsappsList);
  }

  // Normaliza el contacto guardado (formato nuevo arrays telefonos/whatsapps
  // y el antiguo singular telefono/whatsapp) a listas para precargar las filas.
  function prefillContacto(contacto) {
    var telefonos = [];
    var whatsapps = [];
    if (contacto) {
      if (Array.isArray(contacto.telefonos)) telefonos = contacto.telefonos.filter(Boolean);
      else if (contacto.telefono) telefonos = [contacto.telefono];
      if (Array.isArray(contacto.whatsapps)) whatsapps = contacto.whatsapps.filter(Boolean);
      else if (contacto.whatsapp) whatsapps = [contacto.whatsapp];
    }
    if (telefonosList) telefonosList.innerHTML = "";
    if (whatsappsList) whatsappsList.innerHTML = "";
    telefonos.forEach(function (t) { addPhoneRow(telefonosList, t); });
    whatsapps.forEach(function (w) { addPhoneRow(whatsappsList, w); });
    // Deja al menos una fila vacía para que el usuario pueda añadir más.
    if (!telefonos.length) addPhoneRow(telefonosList);
    if (!whatsapps.length) addPhoneRow(whatsappsList);
  }

  // Marca los días/horarios guardados al editar.
  function prefillHorarios(horarios) {
    if (!horarios || !horariosList) return;
    Object.keys(horarios).forEach(function (dia) {
      var cb = horariosList.querySelector('.horario-toggle[data-dia="' + dia + '"]');
      var timesWrap = horariosList.querySelector('.horario-times[data-dia="' + dia + '"]');
      if (!cb || !timesWrap) return;
      cb.checked = true;
      var inputs = timesWrap.querySelectorAll("input");
      inputs.forEach(function (inp) { inp.disabled = false; });
      timesWrap.classList.remove("opacity-50");
      var desde = timesWrap.querySelector(".horario-desde");
      var hasta = timesWrap.querySelector(".horario-hasta");
      if (desde && horarios[dia].desde) desde.value = horarios[dia].desde;
      if (hasta && horarios[dia].hasta) hasta.value = horarios[dia].hasta;
    });
  }

  // Rellena los campos básicos (nombre, descripción, calle, piso) al editar.
  function prefillBasicFields(centro) {
    var dir = centro.direccion || {};
    var nombreEl = document.getElementById("nombre");
    var descEl = document.getElementById("descripcion");
    var calleEl = document.getElementById("calle");
    var pisoEl = document.getElementById("piso");
    if (nombreEl) nombreEl.value = centro.nombre || "";
    if (descEl) descEl.value = centro.descripcion || "";
    if (calleEl) calleEl.value = dir.calle || "";
    if (pisoEl) pisoEl.value = dir.piso || "";
    // Conserva barrio/sector existentes salvo que el usuario mueva el pin.
    lastGeo = { barrio: dir.barrio || "", suburb: dir.sector || "" };
  }

  // Elemento de carga (solo presente en la vista de edición).
  var editLoading = document.getElementById("edit-loading");

  // Revela el formulario e inicializa el mapa (su contenedor debe ser visible).
  // Idempotente: initMapOnce ya se protege con su propia bandera.
  function revealForm() {
    if (editLoading) editLoading.classList.add("hidden");
    form.classList.remove("hidden");
    btnContinuar.disabled = false;
    initMapOnce();
  }

  // Check auth state
  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    if (user) {
      if (IS_EDIT) {
        // En edición mantenemos el formulario oculto tras un spinner hasta que
        // los datos del centro estén precargados, para que no se vea el
        // formulario vacío "parpadear" antes de rellenarse.
        if (editLoading) editLoading.classList.remove("hidden");
        form.classList.add("hidden");
        btnContinuar.disabled = true;
        loadCentroForEdit(user);
      } else {
        revealForm();
      }
    } else {
      // No mostramos un mensaje en línea: enviamos al usuario al login y lo
      // devolvemos aquí tras iniciar sesión (mismo patrón que agregar-insumo).
      form.classList.add("hidden");
      btnContinuar.disabled = true;
      // Tras iniciar sesión, volver a esta misma vista (crear o editar).
      var back = IS_EDIT ? (window.location.pathname + window.location.search) : "/crear-centro-p1.html";
      sessionStorage.setItem("postLoginRedirect", back);
      window.location.replace("/login.html");
    }
  });

  // Carga el centro a editar, valida la propiedad y precarga todos los campos.
  var editLoaded = false;
  function loadCentroForEdit(user) {
    if (editLoaded || !window.FirebaseDataManager) return;
    editLoaded = true;
    FirebaseDataManager.getCentro(EDIT_ID).then(function (centro) {
      if (!centro) { revealForm(); showError("No encontramos este centro."); return; }
      var isOwner = centro.organizadorId === user.uid;
      var isCollaborator = !!(centro.colaboradores && centro.colaboradores[user.uid]);
      if (!isOwner && !isCollaborator) {
        revealForm();
        showError("No tienes permiso para editar este centro.");
        btnContinuar.disabled = true;
        return;
      }
      editCentro = centro;
      prefillBasicFields(centro);
      prefillContacto(centro.contacto);
      prefillHorarios(centro.horarios);
      maybePrefillGeo();
      setupColaboradores(centro, user, isOwner);

      // Datos listos: revela el formulario (e inicializa el mapa) sin parpadeo.
      revealForm();

      // Centrar el mapa en las coordenadas guardadas (el evento "move" del
      // mapa sincroniza selectedLat/selectedLng).
      var coords = centro.coordenadas;
      if (coords && coords.lat != null && coords.lng != null) {
        if (map) {
          map.setView([coords.lat, coords.lng], 17);
        } else {
          selectedLat = coords.lat;
          selectedLng = coords.lng;
          updateCoordsDisplay();
        }
      }
    }).catch(function () {
      revealForm();
      showError("Error al cargar el centro. Intenta de nuevo.");
    });
  }

  // Continue button - validate and save form data
  btnContinuar.addEventListener("click", function () {
    if (!currentUser) {
      showError("Debes iniciar sesión para continuar.");
      return;
    }

    // Validate required fields
    var nombre = document.getElementById("nombre").value.trim();
    var pais = paisSelect ? paisSelect.value : "";
    var estado = estadoSelect ? estadoSelect.value : "";
    var ciudad = getCiudadValue();
    var calle = document.getElementById("calle").value.trim();

    if (!nombre) {
      showError("Por favor ingresa el nombre del centro.");
      document.getElementById("nombre").focus();
      return;
    }

    if (!pais) {
      showError("Por favor selecciona el país.");
      paisSelect.focus();
      return;
    }

    // El estado solo es obligatorio si el país tiene subdivisiones disponibles.
    if (!estado && estadoSelect && !estadoSelect.disabled) {
      showError("Por favor selecciona el estado o provincia.");
      estadoSelect.focus();
      return;
    }

    if (!ciudad) {
      showError("Por favor selecciona o ingresa la ciudad.");
      if (ciudadInput) ciudadInput.focus();
      return;
    }

    if (!calle) {
      showError("Por favor ingresa la calle/avenida.");
      document.getElementById("calle").focus();
      return;
    }

    // La ubicación exacta proviene del centro del mapa (pin fijo).
    if (selectedLat == null || selectedLng == null) {
      showError("Por favor fija la ubicación del centro en el mapa.");
      var mapEl = document.getElementById("map");
      if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // Dirección hiper-segmentada: país/estado/ciudad de los desplegables y el
    // barrio/sector derivado del pin exacto (geocodificación inversa).
    var municipio = getMunicipioValue();
    var direccion = {
      pais: pais,
      estado: estado,
      ciudad: ciudad,
      calle: calle,
      piso: document.getElementById("piso").value.trim()
    };
    // Firebase RTDB rechaza valores `undefined` (lanza una excepción síncrona
    // que escaparía al .catch del botón), así que solo añadimos los campos
    // opcionales cuando tienen un valor.
    if (municipio) direccion.municipio = municipio;
    if (lastGeo && lastGeo.barrio) direccion.barrio = lastGeo.barrio;
    if (lastGeo && lastGeo.suburb) direccion.sector = lastGeo.suburb;

    // Estado de carga en el botón.
    btnContinuar.disabled = true;
    var originalBtnHtml = btnContinuar.innerHTML;
    btnContinuar.innerHTML = '<span class="material-symbols-outlined animate-spin" data-icon="progress_activity">progress_activity</span> ' +
      (IS_EDIT ? "GUARDANDO..." : "REGISTRANDO...");

    // Campos editables comunes a crear y editar.
    var centroData = {
      nombre: nombre,
      descripcion: document.getElementById("descripcion").value.trim(),
      direccion: direccion,
      coordenadas: { lat: selectedLat, lng: selectedLng },
      contacto: {
        telefonos: collectPhones(telefonosList),
        whatsapps: collectPhones(whatsappsList)
      },
      horarios: collectHorarios(),
      // El nombre del organizador identifica al dueño del centro. Al editar lo
      // preservamos para que un colaborador no lo sobrescriba con su propio
      // nombre; solo se fija con el usuario actual al crear el centro.
      organizadorNombre: (IS_EDIT && editCentro && editCentro.organizadorNombre)
        ? editCentro.organizadorNombre
        : (currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "Usuario")
    };
    if (!IS_EDIT) {
      // Solo al crear fijamos los campos de sistema; al editar se preservan
      // (necesidades, reportes, creadoEn, organizadorId) usando update().
      centroData.organizadorId = currentUser.uid;
      centroData.creadoEn = firebase.database.ServerValue.TIMESTAMP;
      centroData.reportes = 0;
      centroData.necesidades = {};
    }

    function failSave(error) {
      showError((IS_EDIT ? "Error al guardar los cambios: " : "Error al registrar el centro: ") +
        (error && error.message ? error.message : error));
      btnContinuar.disabled = false;
      btnContinuar.innerHTML = originalBtnHtml;
    }

    function onSaveSuccess() {
      if (typeof logAnalyticsEvent === "function") {
        logAnalyticsEvent(IS_EDIT ? "edit_centro_de_acopio" : "add_centro_de_acopio", {
          nombre: centroData.nombre,
          estado: centroData.direccion.estado || "Desconocido",
          necesidades_count: 0
        });
      }
      // Invalida cachés para que "Mi Centro" y la ficha reflejen el cambio.
      if (window.FirebaseDataManager) {
        if (FirebaseDataManager.invalidateUserCentros) FirebaseDataManager.invalidateUserCentros(currentUser.uid);
        if (IS_EDIT && FirebaseDataManager.clearCache) FirebaseDataManager.clearCache("centro", EDIT_ID);
      }
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      btnContinuar.innerHTML = '<span class="material-symbols-outlined" data-icon="check_circle">check_circle</span> ' +
        (IS_EDIT ? "CAMBIOS GUARDADOS" : "CENTRO REGISTRADO");
      btnContinuar.classList.replace("bg-primary-container", "bg-tertiary-container");
      setTimeout(function () { window.location.href = "/mi-centro.html"; }, 1000);
    }

    // `set()`/`update()` validan los datos de forma síncrona y lanzan ante
    // valores inválidos (p. ej. `undefined`); el try/catch evita que el botón
    // quede atascado en el estado de carga si eso ocurriera.
    try {
      var op = IS_EDIT
        ? db.ref("centros/" + EDIT_ID).update(centroData)
        : db.ref("centros").push().set(centroData);
      op.then(onSaveSuccess).catch(failSave);
    } catch (error) {
      failSave(error);
    }
  });

  function showError(msg) {
    errorText.textContent = msg;
    errorDiv.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function hideError() {
    errorDiv.classList.add("hidden");
  }

  // Cancel button
  if (btnCancelar) {
    btnCancelar.addEventListener("click", function () {
      if (confirm("¿Estás seguro de que deseas cancelar? Los datos ingresados se perderán.")) {
        window.location.href = "/mi-centro.html";
      }
    });
  }

  /* =================================================================
   * COLABORADORES — invitaciones, aceptar/rechazar, salir y transferir
   * (solo en modo edición). Las reglas de seguridad RTDB garantizan que
   * solo el organizador gestione la lista; un colaborador solo puede
   * editar campos del centro y quitarse a sí mismo.
   * ================================================================= */

  // La clave de invitación debe coincidir EXACTAMENTE con la transformación
  // de las reglas RTDB: email.toLowerCase().replace('.', ',') (todos los puntos).
  function emailToKey(email) {
    return String(email || "").trim().toLowerCase().replace(/\./g, ",");
  }

  function escapeHtmlCC(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function colabName(value) {
    if (!value) return "";
    return value.nombre || value.email || "";
  }

  // Muestra y rellena la sección de colaboradores según el rol del usuario.
  function setupColaboradores(centro, user, isOwner) {
    var section = document.getElementById("colaboradores-section");
    var content = document.getElementById("colaboradores-content");
    if (!section || !content) return;
    section.classList.remove("hidden");
    renderColaboradores(centro, user, isOwner);

    // Si la URL apunta al ancla #colaboradores, desplázate hasta la sección.
    // En la primera carga (sin caché) el mapa de Leaflet hace varios
    // invalidateSize diferidos (100/300/600 ms) y la carga de teselas provoca
    // reflujos que reinician el scroll, por eso un único scroll a 400 ms falla
    // (en una recarga las teselas están cacheadas y sí funciona). Reintentamos
    // tras estabilizarse el diseño para que el desplazamiento sea fiable.
    if ((window.location.hash || "").indexOf("colaboradores") !== -1) {
      var scrollToSection = function () {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      [700, 1100, 1600].forEach(function (ms) { setTimeout(scrollToSection, ms); });
    }
  }

  // Re-lee el centro (sin caché) y vuelve a pintar la sección tras un cambio.
  function refreshColaboradores(user) {
    if (!window.FirebaseDataManager) return;
    if (FirebaseDataManager.clearCache) FirebaseDataManager.clearCache("centro", EDIT_ID);
    FirebaseDataManager.getCentro(EDIT_ID, true).then(function (c) {
      if (!c) return;
      editCentro = c;
      renderColaboradores(c, user, c.organizadorId === user.uid);
    }).catch(function () {});
  }

  function renderColaboradores(centro, user, isOwner) {
    var content = document.getElementById("colaboradores-content");
    if (!content) return;
    if (isOwner) {
      content.innerHTML = ownerColaboradoresHtml(centro);
      wireOwnerColaboradores(centro, user);
    } else {
      content.innerHTML = collaboratorSelfHtml(centro, user);
      wireCollaboratorSelf(centro, user);
    }
  }

  function ownerColaboradoresHtml(centro) {
    var colaboradores = centro.colaboradores || {};
    var invitaciones = centro.invitaciones || {};

    // Colaboradores aceptados (uid -> datos).
    var acceptedHtml = "";
    var acceptedCount = 0;
    Object.keys(colaboradores).forEach(function (uid) {
      var c = colaboradores[uid];
      acceptedCount++;
      acceptedHtml +=
        '<div class="flex items-center justify-between gap-sm p-3 bg-surface-container-low rounded-xl border border-outline-variant">' +
          '<div class="min-w-0">' +
            '<p class="text-body-md font-semibold text-on-surface truncate">' + escapeHtmlCC(colabName(c)) + '</p>' +
            (c && c.email ? '<p class="text-label-md text-on-surface-variant truncate">' + escapeHtmlCC(c.email) + '</p>' : '') +
          '</div>' +
          '<button type="button" class="cc-remove shrink-0 inline-flex items-center gap-xs text-label-md text-error hover:bg-error-container/40 rounded-full px-3 py-2 transition-colors" data-uid="' + escapeHtmlCC(uid) + '" data-email="' + escapeHtmlCC(c && c.email ? c.email : "") + '">' +
            '<span class="material-symbols-outlined text-base" data-icon="person_remove">person_remove</span>Quitar</button>' +
        '</div>';
    });
    if (!acceptedCount) {
      acceptedHtml = '<p class="text-body-md text-on-surface-variant text-sm">Aún no hay colaboradores confirmados.</p>';
    }

    // Invitaciones aún no aceptadas (pendientes / rechazadas).
    var pendingHtml = "";
    Object.keys(invitaciones).forEach(function (key) {
      var inv = invitaciones[key] || {};
      if (inv.estado === "aceptada") return;
      var rejected = inv.estado === "rechazada";
      var badge = rejected
        ? '<span class="text-status-sm font-status-sm text-error uppercase">Rechazada</span>'
        : '<span class="text-status-sm font-status-sm text-tertiary uppercase">Pendiente</span>';
      pendingHtml +=
        '<div class="flex items-center justify-between gap-sm p-3 bg-surface-container-low rounded-xl border border-outline-variant">' +
          '<div class="min-w-0">' +
            '<p class="text-body-md text-on-surface truncate">' + escapeHtmlCC(inv.email || key) + '</p>' +
            badge +
          '</div>' +
          '<button type="button" class="cc-cancel shrink-0 inline-flex items-center gap-xs text-label-md text-on-surface-variant hover:text-error transition-colors rounded-full px-3 py-2" data-key="' + escapeHtmlCC(key) + '">' +
            '<span class="material-symbols-outlined text-base" data-icon="close">close</span>Cancelar</button>' +
        '</div>';
    });
    if (!pendingHtml) {
      pendingHtml = '<p class="text-body-md text-on-surface-variant text-sm">No hay invitaciones pendientes.</p>';
    }

    return '' +
      // Invitar por correo
      '<div class="space-y-sm">' +
        '<label class="text-label-md font-label-md text-on-surface block">Invitar por correo electrónico</label>' +
        '<div class="flex items-center gap-sm">' +
          '<input type="email" id="cc-email" autocomplete="off" ' +
            'class="flex-1 px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent transition-all" ' +
            'placeholder="colaborador@email.com">' +
          '<button type="button" id="cc-invite" class="shrink-0 inline-flex items-center gap-xs bg-primary text-on-primary px-4 py-3 rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all">' +
            '<span class="material-symbols-outlined text-base" data-icon="mail">mail</span>Invitar</button>' +
        '</div>' +
        '<p id="cc-error" class="hidden text-error text-label-md"></p>' +
        '<p id="cc-info" class="hidden text-primary text-label-md"></p>' +
      '</div>' +

      // Colaboradores confirmados
      '<div class="space-y-sm">' +
        '<h3 class="text-label-md font-label-md text-outline uppercase tracking-widest text-xs">Colaboradores confirmados</h3>' +
        '<div class="space-y-sm">' + acceptedHtml + '</div>' +
      '</div>' +

      // Invitaciones
      '<div class="space-y-sm">' +
        '<h3 class="text-label-md font-label-md text-outline uppercase tracking-widest text-xs">Invitaciones</h3>' +
        '<div class="space-y-sm">' + pendingHtml + '</div>' +
      '</div>' +

      // Transferir / salir
      '<div class="space-y-sm pt-md border-t border-outline-variant">' +
        '<h3 class="text-label-md font-label-md text-outline uppercase tracking-widest text-xs">Transferir administración</h3>' +
        '<p class="text-body-md text-on-surface-variant text-sm">Al salir, la administración del centro se transfiere a un colaborador confirmado. Dejarás de ver y administrar este centro.</p>' +
        '<button type="button" id="cc-transfer" class="inline-flex items-center gap-xs bg-error-container text-on-error-container px-4 py-3 rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"' +
          (acceptedCount ? '' : ' disabled title="Primero confirma a un colaborador"') + '>' +
          '<span class="material-symbols-outlined text-base" data-icon="logout">logout</span>Salir y transferir administración</button>' +
        (acceptedCount ? '' : '<p class="text-on-surface-variant text-label-md">Invita y confirma a un colaborador para poder transferir la administración.</p>') +
      '</div>';
  }

  function collaboratorSelfHtml(centro, user) {
    return '' +
      '<div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant space-y-sm">' +
        '<p class="text-body-md text-on-surface flex items-center gap-sm">' +
          '<span class="material-symbols-outlined text-primary" data-icon="handshake">handshake</span>' +
          'Eres colaborador de este centro. Puedes editar su información y su lista de recursos.' +
        '</p>' +
      '</div>' +
      '<div class="space-y-sm pt-md border-t border-outline-variant">' +
        '<p class="text-body-md text-on-surface-variant text-sm">Si ya no deseas colaborar, puedes salir. Dejarás de ver y administrar este centro.</p>' +
        '<button type="button" id="cc-leave" class="inline-flex items-center gap-xs bg-error-container text-on-error-container px-4 py-3 rounded-xl font-label-md hover:opacity-90 active:scale-95 transition-all">' +
          '<span class="material-symbols-outlined text-base" data-icon="logout">logout</span>Salir como colaborador</button>' +
      '</div>';
  }

  function ccShowError(msg) {
    var el = document.getElementById("cc-error");
    var info = document.getElementById("cc-info");
    if (info) info.classList.add("hidden");
    if (el) { el.textContent = msg; el.classList.remove("hidden"); }
  }
  function ccShowInfo(msg) {
    var el = document.getElementById("cc-info");
    var err = document.getElementById("cc-error");
    if (err) err.classList.add("hidden");
    if (el) { el.textContent = msg; el.classList.remove("hidden"); }
  }

  function wireOwnerColaboradores(centro, user) {
    var emailInput = document.getElementById("cc-email");
    var inviteBtn = document.getElementById("cc-invite");
    var transferBtn = document.getElementById("cc-transfer");

    if (inviteBtn) {
      inviteBtn.addEventListener("click", function () {
        var email = (emailInput && emailInput.value ? emailInput.value : "").trim().toLowerCase();
        if (!isValidEmail(email)) { ccShowError("Ingresa un correo electrónico válido."); return; }
        if (user.email && email === user.email.trim().toLowerCase()) {
          ccShowError("Ya eres el organizador de este centro."); return;
        }
        var key = emailToKey(email);
        var invitaciones = centro.invitaciones || {};
        var colaboradores = centro.colaboradores || {};
        var alreadyCollab = Object.keys(colaboradores).some(function (uid) {
          return colaboradores[uid] && (colaboradores[uid].email || "").trim().toLowerCase() === email;
        });
        if (alreadyCollab) { ccShowError("Esa persona ya es colaboradora."); return; }
        if (invitaciones[key] && invitaciones[key].estado === "pendiente") {
          ccShowError("Ya existe una invitación pendiente para ese correo."); return;
        }
        inviteBtn.disabled = true;
        db.ref("centros/" + EDIT_ID + "/invitaciones/" + key).set({
          email: email,
          estado: "pendiente",
          invitadoEn: firebase.database.ServerValue.TIMESTAMP
        }).then(function () {
          if (typeof logAnalyticsEvent === "function") {
            logAnalyticsEvent("invite_collaborator", { centro_id: EDIT_ID });
          }
          if (emailInput) emailInput.value = "";
          inviteBtn.disabled = false;
          refreshColaboradores(user);
          showInviteSuccessModal(email);
        }).catch(function (err) {
          ccShowError("No se pudo enviar la invitación. " + (err && err.message ? err.message : ""));
          inviteBtn.disabled = false;
        });
      });
    }

    // Quitar colaborador (elimina su entrada y su invitación).
    document.querySelectorAll(".cc-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var uid = btn.getAttribute("data-uid");
        var email = btn.getAttribute("data-email");
        showConfirmModal({
          title: "Quitar colaborador",
          message: "¿Quitar a esta persona como colaboradora? Dejará de poder administrar el centro.",
          confirmText: "Quitar",
          danger: true
        }, function () {
          var updates = {};
          updates["colaboradores/" + uid] = null;
          if (email) updates["invitaciones/" + emailToKey(email)] = null;
          db.ref("centros/" + EDIT_ID).update(updates).then(function () {
            if (typeof logAnalyticsEvent === "function") logAnalyticsEvent("remove_collaborator", { centro_id: EDIT_ID });
            refreshColaboradores(user);
          }).catch(function (err) {
            ccShowError("No se pudo quitar al colaborador. " + (err && err.message ? err.message : ""));
          });
        });
      });
    });

    // Cancelar invitación.
    document.querySelectorAll(".cc-cancel").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-key");
        db.ref("centros/" + EDIT_ID + "/invitaciones/" + key).remove().then(function () {
          if (typeof logAnalyticsEvent === "function") logAnalyticsEvent("cancel_invitation", { centro_id: EDIT_ID });
          refreshColaboradores(user);
        }).catch(function (err) {
          ccShowError("No se pudo cancelar la invitación. " + (err && err.message ? err.message : ""));
        });
      });
    });

    // Salir y transferir administración.
    if (transferBtn && !transferBtn.disabled) {
      transferBtn.addEventListener("click", function () {
        var colaboradores = centro.colaboradores || {};
        var options = Object.keys(colaboradores).map(function (uid) {
          return { value: uid, label: colabName(colaboradores[uid]) };
        });
        if (!options.length) { ccShowError("No hay colaboradores confirmados a quien transferir."); return; }
        showConfirmModal({
          title: "Salir y transferir administración",
          message: "Vas a transferir la administración de este centro a otra persona y dejarás de tener acceso. Esta acción no se puede deshacer.",
          confirmText: "Transferir y salir",
          danger: true,
          selectLabel: "Nuevo organizador",
          selectOptions: options
        }, function (newOwnerUid) {
          if (!newOwnerUid) { return; }
          var newOwner = colaboradores[newOwnerUid] || {};
          var updates = {
            organizadorId: newOwnerUid,
            organizadorNombre: colabName(newOwner) || "Organizador"
          };
          updates["colaboradores/" + newOwnerUid] = null;
          db.ref("centros/" + EDIT_ID).update(updates).then(function () {
            if (typeof logAnalyticsEvent === "function") logAnalyticsEvent("transfer_ownership", { centro_id: EDIT_ID });
            if (window.FirebaseDataManager) {
              if (FirebaseDataManager.clearCache) FirebaseDataManager.clearCache("centro", EDIT_ID);
              if (FirebaseDataManager.invalidateUserCentros) FirebaseDataManager.invalidateUserCentros(user.uid);
            }
            window.location.href = "/mi-centro.html";
          }).catch(function (err) {
            ccShowError("No se pudo transferir la administración. " + (err && err.message ? err.message : ""));
          });
        });
      });
    }
  }

  function wireCollaboratorSelf(centro, user) {
    var leaveBtn = document.getElementById("cc-leave");
    if (!leaveBtn) return;
    leaveBtn.addEventListener("click", function () {
      showConfirmModal({
        title: "Salir como colaborador",
        message: "¿Seguro que deseas dejar de colaborar en este centro? Dejarás de verlo y administrarlo.",
        confirmText: "Salir",
        danger: true
      }, function () {
        var updates = {};
        updates["colaboradores/" + user.uid] = null;
        if (user.email) updates["invitaciones/" + emailToKey(user.email)] = null;
        db.ref("centros/" + EDIT_ID).update(updates).then(function () {
          if (typeof logAnalyticsEvent === "function") logAnalyticsEvent("leave_collaborator", { centro_id: EDIT_ID });
          if (window.FirebaseDataManager && FirebaseDataManager.clearCache) FirebaseDataManager.clearCache("centro", EDIT_ID);
          window.location.href = "/mi-centro.html";
        }).catch(function (err) {
          alert("No se pudo completar la acción. " + (err && err.message ? err.message : ""));
        });
      });
    });
  }

  // Popup tras invitar: confirma el correo y ofrece un enlace de registro
  // para compartir con la persona invitada.
  function showInviteSuccessModal(email) {
    var registerUrl = "https://www.acopify.com/registro";

    var overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[1000] flex items-center justify-center p-md bg-black/50";
    overlay.innerHTML =
      '<div class="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-lg space-y-md">' +
        '<div class="flex items-center gap-sm">' +
          '<span class="material-symbols-outlined text-primary" data-icon="mark_email_read">mark_email_read</span>' +
          '<h3 class="text-headline-md font-headline-md font-semibold text-on-surface">Invitación creada</h3>' +
        '</div>' +
        '<p class="text-body-md text-on-surface">Has invitado a <strong>' + escapeHtmlCC(email) + '</strong> a colaborar en este centro.</p>' +
        '<p class="text-body-md text-on-surface-variant text-sm">Comparte este enlace para que la persona se registre (o inicie sesión) con ese mismo correo y vea la invitación:</p>' +
        '<div class="flex items-center gap-sm">' +
          '<input id="cc-share-link" type="text" readonly value="' + escapeHtmlCC(registerUrl) + '" ' +
            'class="flex-1 min-w-0 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container">' +
          '<button type="button" id="cc-share-copy" class="shrink-0 inline-flex items-center gap-xs bg-surface-container-high text-on-surface px-3 py-2 rounded-xl border border-outline-variant hover:bg-surface-variant active:scale-95 transition-all font-label-md">' +
            '<span class="material-symbols-outlined text-base" data-icon="content_copy">content_copy</span>Copiar</button>' +
        '</div>' +
        '<div class="flex justify-end pt-sm">' +
          '<button type="button" id="cc-share-ok" class="px-5 py-2 rounded-full bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all font-label-md">OK</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    var input = overlay.querySelector("#cc-share-link");
    var copyBtn = overlay.querySelector("#cc-share-copy");
    var okBtn = overlay.querySelector("#cc-share-ok");

    if (copyBtn) copyBtn.addEventListener("click", function () {
      copyTextToClipboard(registerUrl, input);
      copyBtn.innerHTML = '<span class="material-symbols-outlined text-base" data-icon="check">check</span>¡Copiado!';
      setTimeout(function () {
        copyBtn.innerHTML = '<span class="material-symbols-outlined text-base" data-icon="content_copy">content_copy</span>Copiar';
      }, 1800);
    });
    if (okBtn) okBtn.addEventListener("click", close);
  }

  // Copia texto al portapapeles con respaldo para navegadores sin la API.
  function copyTextToClipboard(text, inputEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { legacyCopy(inputEl); });
    } else {
      legacyCopy(inputEl);
    }
    function legacyCopy(el) {
      if (!el) return;
      el.focus();
      el.select();
      try { document.execCommand("copy"); } catch (e) {}
    }
  }

  // Modal de confirmación reutilizable (con selector opcional).
  function showConfirmModal(opts, onConfirm) {
    opts = opts || {};
    var overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[1000] flex items-center justify-center p-md bg-black/50";

    var selectHtml = "";
    if (opts.selectOptions && opts.selectOptions.length) {
      var optsHtml = opts.selectOptions.map(function (o) {
        return '<option value="' + escapeHtmlCC(o.value) + '">' + escapeHtmlCC(o.label) + '</option>';
      }).join("");
      selectHtml =
        '<div class="space-y-sm mt-md">' +
          '<label class="text-label-md font-label-md text-on-surface block">' + escapeHtmlCC(opts.selectLabel || "Selecciona") + '</label>' +
          '<select id="cc-modal-select" class="w-full px-4 py-3 pr-10 bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-container">' + optsHtml + '</select>' +
        '</div>';
    }

    overlay.innerHTML =
      '<div class="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-lg space-y-md">' +
        '<h3 class="text-headline-md font-headline-md font-semibold text-on-surface">' + escapeHtmlCC(opts.title || "Confirmar") + '</h3>' +
        '<p class="text-body-md text-on-surface-variant">' + escapeHtmlCC(opts.message || "") + '</p>' +
        selectHtml +
        '<div class="flex justify-end gap-sm pt-sm">' +
          '<button type="button" id="cc-modal-cancel" class="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors font-label-md">Cancelar</button>' +
          '<button type="button" id="cc-modal-confirm" class="px-4 py-2 rounded-full ' + (opts.danger ? 'bg-error text-on-error' : 'bg-primary text-on-primary') + ' hover:opacity-90 active:scale-95 transition-all font-label-md">' + escapeHtmlCC(opts.confirmText || "Confirmar") + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    var cancelBtn = overlay.querySelector("#cc-modal-cancel");
    var confirmBtn = overlay.querySelector("#cc-modal-confirm");
    if (cancelBtn) cancelBtn.addEventListener("click", close);
    if (confirmBtn) confirmBtn.addEventListener("click", function () {
      var sel = overlay.querySelector("#cc-modal-select");
      var value = sel ? sel.value : null;
      close();
      if (typeof onConfirm === "function") onConfirm(value);
    });
  }
})();