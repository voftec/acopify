/**
 * build-venezuela-cities.js
 *
 * Fetches the hand-curated Venezuela locality data from
 * github.com/aranajhonny/ciudades-de-vzla and writes a richer
 * venezuela.json to public/country-state-city-metadata/cities/.
 *
 * Each state entry merges:
 *   - ciudades[]          (main recognized cities)
 *   - municipios[].municipio   (municipality names)
 *   - municipios[].capital     (capital of each municipality)
 *   - municipios[].parroquias  (parishes / localities)
 *
 * State keys are patched to match the Acopify dropdown:
 *   Vargas  → La Guaira  (official name since 2021)
 * Dependencias Federales is manually added.
 *
 * Usage:
 *   node tools/build-venezuela-cities.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SOURCE_URL    = 'https://raw.githubusercontent.com/aranajhonny/ciudades-de-vzla/master/venezuela.json';
const OUT_FILE      = path.join(__dirname, '../public/country-state-city-metadata/cities/venezuela.json');
const OUT_MUNICIPIOS = path.join(__dirname, '../public/country-state-city-metadata/venezuela-municipios.json');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(get(res.headers.location));
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function addUnique(arr, val) {
  if (!val) return;
  val = String(val).trim();
  if (val && !arr.includes(val)) arr.push(val);
}

get(SOURCE_URL).then(raw => {
  const estados = JSON.parse(raw);
  const result  = {};

  estados.forEach(e => {
    const cities = [];
    (e.ciudades   || []).forEach(c => addUnique(cities, c));
    (e.municipios || []).forEach(m => {
      addUnique(cities, m.municipio);
      addUnique(cities, m.capital);
      (m.parroquias || []).forEach(p => addUnique(cities, p));
    });
    cities.sort((a, b) => a.localeCompare(b, 'es'));
    result[e.estado] = cities;
  });

  // Rename Vargas → La Guaira (2021 official rename)
  if (result['Vargas']) {
    result['La Guaira'] = result['Vargas'];
    delete result['Vargas'];
  }

  // Dependencias Federales (federal island territories, not in source data)
  result['Dependencias Federales'] = [
    'Isla Aves', 'Isla La Blanquilla', 'Isla La Orchila', 'Isla de Patos',
    'Islas Las Aves', 'Islas Las Hermanas', 'Islas Los Monjes',
    'Islas Los Roques', 'Islas Los Testigos', 'Los Roques'
  ].sort((a, b) => a.localeCompare(b, 'es'));

  // Sort keys alphabetically
  const sorted = {};
  Object.keys(result).sort((a, b) => a.localeCompare(b, 'es')).forEach(k => {
    sorted[k] = result[k];
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(sorted, null, 2));
  console.log('Written:', OUT_FILE);
  Object.entries(sorted).forEach(([k, v]) => console.log('  ' + k + ': ' + v.length + ' entries'));

  // ---- venezuela-municipios.json ----
  const munResult = {};
  estados.forEach(e => {
    const key = e.estado === 'Vargas' ? 'La Guaira' : e.estado;
    const munList = (e.municipios || []).map(m => {
      const localidades = [];
      if (m.capital) { const c = m.capital.trim(); if (c && !localidades.includes(c)) localidades.push(c); }
      (m.parroquias || []).forEach(p => { p = String(p).trim(); if (p && !localidades.includes(p)) localidades.push(p); });
      localidades.sort((a, b) => a.localeCompare(b, 'es'));
      return { municipio: m.municipio, capital: m.capital || '', localidades };
    });
    munList.sort((a, b) => a.municipio.localeCompare(b.municipio, 'es'));
    munResult[key] = munList;
  });
  const sortedMun = {};
  Object.keys(munResult).sort((a, b) => a.localeCompare(b, 'es')).forEach(k => sortedMun[k] = munResult[k]);
  fs.writeFileSync(OUT_MUNICIPIOS, JSON.stringify(sortedMun));
  console.log('Written:', OUT_MUNICIPIOS, '(' + (fs.statSync(OUT_MUNICIPIOS).size / 1024).toFixed(1) + ' KB)');
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
