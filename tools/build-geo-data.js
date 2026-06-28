/*
 * Acopify - geo data generator.
 *
 * Reads the local dr5hn "countries+states+cities.json" (ODbL) and emits ONLY the
 * names we need to populate cascading dropdowns (no ISO codes, lat/lng, etc.)
 * into a single self-contained folder, public/country-state-city-metadata/:
 *
 *   country-state-city-metadata/countries-states.js   window.ACOPIFY_PAISES_DATA
 *       -> [{ name, states:[string] }]  (countries + first-level subdivisions)
 *
 *   country-state-city-metadata/cities/<slug>.json
 *       -> { "<state name>": ["<city>", ...], ... }  (one file per country)
 *
 * Cities are split per country so the browser only fetches the selected
 * country's list (same-origin, works offline once cached) instead of a 46 MB blob.
 * Once generated, the source clone (countries-states-cities-database-master/) can
 * be deleted — nothing at runtime depends on it.
 *
 * Usage:
 *   node tools/build-geo-data.js [path-to-countries+states+cities.json]
 * Defaults to the cloned repo at ../countries-states-cities-database-master.
 * (tools/ is NOT deployed; Firebase serves only public/.)
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_SRC = path.join(
  __dirname, "..",
  "countries-states-cities-database-master", "json", "countries+states+cities.json"
);
const srcPath = process.argv[2] || DEFAULT_SRC;

// Subdivisiones que faltan o están mal en la fuente (se agregan por unión).
const CORRECTIONS = {
  "Venezuela": ["Dependencias Federales"]
};

// Renombres: corrige nombres en inglés del dataset → nombre local correcto.
// Formato: { "<País>": { "<nombre inglés>": "<nombre local>" } }
const STATE_RENAMES = {
  "Argentina": { "Autonomous City of Buenos Aires": "Ciudad Autónoma de Buenos Aires" }
};

function slug(name) {
  return String(name)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSorted(arr) {
  var seen = {}, out = [];
  (arr || []).forEach(function (v) {
    var s = String(v == null ? "" : v).trim();
    if (s && !seen[s.toLowerCase()]) { seen[s.toLowerCase()] = true; out.push(s); }
  });
  out.sort(function (a, b) { return a.localeCompare(b); });
  return out;
}

const raw = JSON.parse(fs.readFileSync(srcPath, "utf8"));

const baseDir = path.join(__dirname, "..", "public", "country-state-city-metadata");
const citiesDir = path.join(baseDir, "cities");
fs.mkdirSync(citiesDir, { recursive: true });

const countries = [];
let totalStates = 0, totalCities = 0, cityFiles = 0;
const usedSlugs = {};

raw.filter(function (c) { return c && c.name; }).forEach(function (c) {
  const name = String(c.name).trim();
  const seen = {};
  const states = [];
  const citiesByState = {};

  const countryRenames = STATE_RENAMES[name] || {};

  (Array.isArray(c.states) ? c.states : []).forEach(function (st) {
    const rawName = String(st && st.name ? st.name : "").trim();
    // Aplica renombres (p.ej. nombres en inglés → nombre local correcto).
    const sName = countryRenames[rawName] || rawName;
    // Salta vacíos, duplicados y artefactos autorreferenciales (un "estado" con
    // el mismo nombre que su país, p.ej. el "Venezuela" suelto del dataset).
    if (!sName || seen[sName.toLowerCase()] || sName.toLowerCase() === name.toLowerCase()) return;
    seen[sName.toLowerCase()] = true;
    states.push(sName);

    const cityNames = uniqueSorted((Array.isArray(st.cities) ? st.cities : [])
      .map(function (ct) { return ct && ct.name; }));
    if (cityNames.length) citiesByState[sName] = cityNames;
  });

  // Correcciones: agrega subdivisiones faltantes (sin ciudades).
  (CORRECTIONS[name] || []).forEach(function (s) {
    if (s && !seen[s.toLowerCase()] && s.toLowerCase() !== name.toLowerCase()) {
      seen[s.toLowerCase()] = true;
      states.push(s);
    }
  });

  states.sort(function (a, b) { return a.localeCompare(b); });
  countries.push({ name: name, states: states });
  totalStates += states.length;

  // Escribe el archivo de ciudades del país (solo si tiene alguna ciudad).
  if (Object.keys(citiesByState).length) {
    let s = slug(name);
    if (usedSlugs[s]) s = s + "-" + slug(c.iso2 || c.iso3 || String(countries.length));
    usedSlugs[s] = true;
    fs.writeFileSync(path.join(citiesDir, s + ".json"), JSON.stringify(citiesByState));
    cityFiles++;
    Object.keys(citiesByState).forEach(function (k) { totalCities += citiesByState[k].length; });
  }
});

countries.sort(function (a, b) { return a.name.localeCompare(b.name); });

const banner =
  "/*\n" +
  " * Acopify - Catálogo de países y estados/provincias (datos embebidos).\n" +
  " *\n" +
  " * Fuente: dr5hn/countries-states-cities-database (countries+states+cities.json),\n" +
  " * licencia ODbL. Generado por tools/build-geo-data.js — NO editar a mano.\n" +
  " * Las ciudades viven en country-state-city-metadata/cities/<slug>.json (una por país).\n" +
  " */\n";

const target = path.join(baseDir, "countries-states.js");
fs.writeFileSync(target, banner + "window.ACOPIFY_PAISES_DATA = " + JSON.stringify(countries) + ";\n", "utf8");

const vz = countries.find(function (c) { return c.name === "Venezuela"; });
console.log("Wrote " + target);
console.log("countries: " + countries.length + ", states: " + totalStates);
console.log("city files: " + cityFiles + ", cities: " + totalCities);
console.log("Venezuela states (" + vz.states.length + "): " + vz.states.join(", "));
