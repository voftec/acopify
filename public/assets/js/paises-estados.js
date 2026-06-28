/*
 * Acopify - Catálogo de Países y Estados/Provincias
 *
 * Provee un listado consistente de países y sus divisiones de primer nivel
 * (estados / provincias) para los formularios, de modo que los usuarios
 * seleccionen valores de una lista en vez de escribirlos a mano.
 *
 * Fuente: dataset abierto "countries+states" (dr5hn, licencia ODbL),
 * embebido localmente en `country-state-city-metadata/countries-states.js`
 * (window.ACOPIFY_PAISES_DATA)
 * para que funcione completamente sin conexión. Si por algún motivo ese archivo
 * no cargó, se usa un respaldo mínimo (Venezuela + vecinos).
 */
(function () {
  // País por defecto del proyecto.
  var DEFAULT_COUNTRY = "Venezuela";

  // Respaldo local mínimo (se usa solo si falla la descarga del dataset).
  var FALLBACK = [
    {
      name: "Venezuela",
      states: [
        "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar",
        "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital",
        "Falcón", "Guárico", "La Guaira", "Lara", "Mérida", "Miranda",
        "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", "Táchira",
        "Trujillo", "Yaracuy", "Zulia", "Dependencias Federales"
      ]
    },
    {
      name: "Colombia",
      states: [
        "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá",
        "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba",
        "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
        "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo",
        "Quindío", "Risaralda", "San Andrés y Providencia", "Santander",
        "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
        "Bogotá D.C."
      ]
    },
    {
      name: "Brazil",
      states: [
        "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará",
        "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão",
        "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará",
        "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro",
        "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima",
        "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"
      ]
    }
  ];

  var cache = null; // Promesa cacheada con el dataset resuelto.

  function normalize(list) {
    // Asegura el formato { name, states[] } y ordena alfabéticamente.
    var clean = (list || [])
      .filter(function (c) { return c && c.name; })
      .map(function (c) {
        return { name: c.name, states: Array.isArray(c.states) ? c.states.slice() : [] };
      });
    clean.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return clean;
  }

  function load() {
    if (cache) return cache;

    var bundled = window.ACOPIFY_PAISES_DATA;
    var list = Array.isArray(bundled) && bundled.length
      ? normalize(bundled)
      : normalize(FALLBACK);

    if (!Array.isArray(bundled) || !bundled.length) {
      console.warn("Catálogo de países embebido no disponible, usando respaldo local.");
    }

    // Se mantiene una API basada en promesas para no acoplar a los llamadores.
    cache = Promise.resolve(list);
    return cache;
  }

  function getStates(list, countryName) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === countryName) return list[i].states || [];
    }
    return [];
  }

  window.AcopifyGeo = {
    DEFAULT_COUNTRY: DEFAULT_COUNTRY,
    load: load,
    getStates: getStates
  };

  // ---------------------------------------------------------------------------
  // Ciudades (carga bajo demanda, desde nuestro propio dominio)
  //
  // El catálogo mundial de ciudades es muy grande para embeberlo en un solo
  // archivo (~46 MB), así que se divide por país en
  // `/country-state-city-metadata/cities/<slug>.json` (objeto { "<estado>": ["<ciudad>", ...] }).
  // El navegador solo descarga el país seleccionado (p.ej. Venezuela ~2 KB) y se
  // cachea. El `slug` debe coincidir con el de tools/build-geo-data.js.
  // ---------------------------------------------------------------------------
  var CITIES_BASE = "/country-state-city-metadata/cities/";
  var fileCache = {}; // slug -> Promise<{ estado: [ciudades] }>

  function norm(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
      .toLowerCase().trim();
  }

  function slug(name) {
    return String(name)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function loadCountryCities(country) {
    var s = slug(country);
    if (fileCache[s]) return fileCache[s];
    fileCache[s] = fetch(CITIES_BASE + s + ".json", { cache: "force-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    fileCache[s].catch(function () { delete fileCache[s]; }); // permitir reintentos
    return fileCache[s];
  }

  // Devuelve una promesa con la lista de ciudades para país + estado.
  // Rechaza si no hay datos disponibles (el llamador puede ofrecer texto libre).
  function loadCities(country, state) {
    if (!country || !state) return Promise.reject(new Error("country/state requeridos"));
    return loadCountryCities(country).then(function (byState) {
      var cities = byState[state];
      if (!cities) {
        // Coincidencia insensible a acentos por si difiere la grafía.
        var key = Object.keys(byState).find(function (k) { return norm(k) === norm(state); });
        if (key) cities = byState[key];
      }
      if (!cities || !cities.length) throw new Error("sin ciudades");
      return cities;
    });
  }

  window.AcopifyCities = { load: loadCities };

  // ---------------------------------------------------------------------------
  // Municipios venezolanos (solo Venezuela)
  //
  // Carga `/country-state-city-metadata/venezuela-municipios.json` (41 KB) una
  // sola vez y devuelve el arreglo de municipios para el estado solicitado.
  // Cada elemento: { municipio, capital, localidades: [string] }
  // ---------------------------------------------------------------------------
  var MUNICIPIOS_FILE  = "/country-state-city-metadata/venezuela-municipios.json";
  var municipiosCache  = null;

  function loadVenezuelaMunicipios() {
    if (municipiosCache) return municipiosCache;
    municipiosCache = fetch(MUNICIPIOS_FILE, { cache: "force-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    municipiosCache.catch(function () { municipiosCache = null; });
    return municipiosCache;
  }

  window.AcopifyMunicipios = {
    // Devuelve Promise<[{ municipio, capital, localidades }]> para el estado dado.
    load: function (estado) {
      if (!estado) return Promise.resolve([]);
      return loadVenezuelaMunicipios().then(function (data) {
        // Coincidencia exacta primero, luego insensible a acentos.
        var list = data[estado];
        if (!list) {
          var key = Object.keys(data).find(function (k) { return norm(k) === norm(estado); });
          list = key ? data[key] : [];
        }
        return list || [];
      });
    }
  };
})();
