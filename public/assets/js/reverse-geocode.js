/*
 * Acopify - Reverse geocoding (pin -> barrio / sector)
 *
 * El nivel "barrio/sector" no existe como dataset estático mundial, así que se
 * obtiene dinámicamente desde las coordenadas exactas del pin usando el geocoder
 * gratuito de OpenStreetMap (Nominatim). Esto complementa los desplegables
 * País → Estado → Ciudad con el sub-nivel hiper-local.
 *
 * Política de uso de Nominatim: bajo volumen y peticiones individuales (no
 * autocompletar). Por eso solo se consulta cuando el usuario suelta el pin
 * (con "debounce"), y los resultados se cachean por coordenada redondeada.
 * Es de mejor esfuerzo: si falla, el campo barrio simplemente queda manual.
 */
(function () {
  var ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
  var cache = {}; // "lat,lng" redondeado -> Promise<resultado>

  function pick(addr, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (addr[keys[i]]) return addr[keys[i]];
    }
    return "";
  }

  function parse(json) {
    var a = (json && json.address) || {};
    return {
      // Sub-niveles de ciudad (lo "hiper-local").
      neighbourhood: pick(a, ["neighbourhood", "quarter"]),
      suburb: pick(a, ["suburb", "city_district", "borough"]),
      // Mejor etiqueta única para mostrar como "Barrio / Sector".
      barrio: pick(a, ["neighbourhood", "quarter", "suburb", "city_district", "borough", "residential", "hamlet"]),
      // Niveles superiores (referenciales; los canónicos vienen de los selects).
      city: pick(a, ["city", "town", "village", "municipality"]),
      state: a.state || "",
      country: a.country || "",
      raw: a
    };
  }

  // Devuelve una promesa con { neighbourhood, suburb, barrio, city, state, country, raw }.
  function reverse(lat, lng) {
    if (lat == null || lng == null) return Promise.reject(new Error("lat/lng requeridos"));
    var key = Number(lat).toFixed(4) + "," + Number(lng).toFixed(4);
    if (cache[key]) return cache[key];

    var url = ENDPOINT +
      "?format=jsonv2&zoom=18&addressdetails=1&accept-language=es" +
      "&lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng);

    cache[key] = fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(parse);

    cache[key].catch(function () { delete cache[key]; }); // permitir reintentos
    return cache[key];
  }

  // ---- Geocodificación directa (dirección de texto -> lat/lng) ----
  // Se usa para centrar el mapa en la zona que el usuario va escribiendo
  // (País → Estado → Ciudad → Calle). Mismo geocoder gratuito (Nominatim),
  // de mejor esfuerzo, cacheado por consulta normalizada. Devuelve una
  // promesa con { lat, lng, displayName } o null si no hay resultado.
  var SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
  var searchCache = {}; // query normalizada -> Promise<{lat,lng}|null>

  function search(query) {
    var q = String(query || "").trim();
    if (!q) return Promise.resolve(null);
    var key = q.toLowerCase();
    if (searchCache[key]) return searchCache[key];

    var url = SEARCH_ENDPOINT +
      "?format=jsonv2&limit=1&addressdetails=0&accept-language=es" +
      "&q=" + encodeURIComponent(q);

    searchCache[key] = fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (list) {
        if (!list || !list.length) return null;
        var r = list[0];
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name || ""
        };
      });

    searchCache[key].catch(function () { delete searchCache[key]; }); // permitir reintentos
    return searchCache[key];
  }

  window.AcopifyGeocode = { reverse: reverse, search: search };
})();
