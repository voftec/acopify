# Acopify - Firebase Analytics Integration

This document outlines the Firebase Analytics setup and the custom event tracking implemented for Acopify.

## Core Setup
- **Firebase Version**: v10 (Compat / Namespaced API).
- **Scripts Included**: In all 14 HTML pages, the analytics compat script is loaded from CDN:
  ```html
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics-compat.js"></script>
  ```
- **Crash-Resistant Initialization**: To ensure pages do not crash when ad-blockers block Firebase compat scripts, `public/assets/js/firebase-init.js` guards every service with a `typeof` check before calling it:
  - `firebase.database()`, `firebase.auth()`, and `firebase.analytics()` are each called only when their compat script is loaded; otherwise the corresponding global (`db` / `auth` / `analytics`) is left `null`.
  - A global helper is also defined for safe event logging:
  ```javascript
  window.logAnalyticsEvent(eventName, params)
  ```
  This function safely accesses Firebase Analytics and logs events only if the library is loaded and initialized, avoiding global execution exceptions.
  - All downstream page scripts already guard with `if (!auth || !db)` and show a user-friendly error UI when Firebase is unavailable.

## Tracked Events

| Event Name | File | Description | Parameters |
|---|---|---|---|
| `select_location` | `index.html`, `onboarding.html` | Logged when user selects their location in onboarding. | `location` ("venezuela", "otros") |
| `select_role` | `index.html`, `onboarding.html` | Logged when user selects their role in onboarding. | `role` ("donador", "centro") |
| `onboarding_complete` | `index.html`, `onboarding.html` | Logged when onboarding is successfully finished. | `location`, `role` |
| `search` | `app.js` | Logged with a 1.5s debounce when the user searches on the main map/list. | `search_term` |
| `view_centro_details_click` | `app.js` | Logged when a user clicks to view a center's detail page. | `centro_id`, `centro_nombre`, `source` ("peek", "list") |
| `view_centro` | `centro.js` | Logged once per page session when a center details profile is loaded. | `centro_id`, `centro_nombre`, `estado` |
| `contact_click` | `centro.js` | Logged when a user clicks call or WhatsApp on a center's detail profile. | `centro_id`, `centro_nombre`, `contact_type` ("llamada", "whatsapp", "otro") |
| `add_centro_de_acopio` | `crear-centro-p1.js` | Logged when a center is successfully registered in the database. | `nombre`, `estado`, `necesidades_count` |
| `add_insumo` | `agregar-insumo.js` | Logged when a resource/insumo is successfully added by the owner. | `nombre`, `categoria`, `prioridad`, `centro_id` |
| `share` | `compartir-historia.js` | Logged when a user opens the "Compartir historia" generator on a center's detail page. | `method` ("historia_9_16"), `centro_nombre` |
| `login` | `login.js` | Standard login event tracking the auth method. | `method` ("email", "google") |
| `sign_up` | `registro.js` | Standard sign-up event tracking registration method. | `method` ("email", "google") |
| `invite_collaborator` | `crear-centro-p1.js` | Owner sends a collaboration invite by email from the Editar centro view. | `centro_id` |
| `cancel_invitation` | `crear-centro-p1.js` | Owner cancels a pending invitation. | `centro_id` |
| `remove_collaborator` | `crear-centro-p1.js` | Owner removes a confirmed collaborator. | `centro_id` |
| `transfer_ownership` | `crear-centro-p1.js` | Owner transfers administration to a collaborator and leaves. | `centro_id` |
| `accept_collaborator` | `mi-centro.js` | Invited user accepts a collaboration invitation. | `centro_id` |
| `reject_collaborator` | `mi-centro.js` | Invited user rejects a collaboration invitation. | `centro_id` |
| `leave_collaborator` | `crear-centro-p1.js` | Collaborator removes themselves from a centro. | `centro_id` |

## Colaboradores (co-gestión de centros + transferencia de propiedad)

Centros live at `centros/$id` (not under a user account), so administration can be
**transferred** by reassigning `organizadorId`. Multiple people can co-manage a centro
via email invitations. No Cloud Functions — everything is enforced by RTDB rules.

**Data model (per centro):**
- `invitaciones/{emailKey} = { email, invitadoEn, estado }` where `estado` ∈
  `"pendiente" | "aceptada" | "rechazada"`. `emailKey` = the email lowercased with **all**
  `.` replaced by `,` — JS uses `email.trim().toLowerCase().replace(/\./g, ",")`; the rules
  use `auth.token.email.toLowerCase().replace('.', ',')` (Firebase `.replace()` is
  replace-all, so the two match). Must use `.toLowerCase()` in rules — `.lower()` does **not**
  exist and throws "Function call on target that is not a function".
- `colaboradores/{uid} = { email, nombre, aceptadoEn }`.

**Security model (`rtdb.rules.json`):** the node-level `$centroId` `.write` stays
**owner-only** (`organizadorId === auth.uid`), so only the owner can change `organizadorId`,
delete the centro, or manage the invite/collaborator lists wholesale — this is also what
authorizes the owner's atomic ownership-transfer `update()`. Accepted collaborators get
write access only on explicit editable child paths (`nombre`, `descripcion`, `direccion`,
`coordenadas`, `contacto`, `horarios`, `organizadorNombre`, `necesidades/$needId`) via the
predicate `organizadorId === auth.uid || colaboradores/auth.uid exists`. RTDB evaluates each
path of the edit form's multi-key `update()`, and in edit mode the form only writes those
granted keys. An invitee can flip their own `invitaciones/<emailKey>` (accept/reject) and
add/remove **only their own** `colaboradores/<uid>` node, gated on a matching invitation
(prevents un-invited self-join).

**Flows:**
- **Invite/manage:** owner-only section at the bottom of `editar.html` (markup
  `#colaboradores-section`/`#colaboradores-content`, logic in `crear-centro-p1.js`). Mi Centro
  cards have an **Invitar Colaborador** button → `/editar.html?id=…#colaboradores`.
- **Accept/reject:** `mi-centro.js` scans the publicly-readable `centros` tree for
  `invitaciones[myEmailKey] === "pendiente"` and renders an inbox; Mi Centro also lists
  "Centros donde colaboro" (`colaboradores[uid]` exists, rendered with Editar/Lista actions
  since collaborators can edit info + needs).
- **Edit mode now allows collaborators:** `crear-centro-p1.js` `loadCentroForEdit` permits
  owner **or** collaborator; on save, `organizadorNombre` is **preserved** in edit mode so a
  collaborator's save doesn't overwrite the owner's name.
- **Ownership transfer:** owner picks a confirmed collaborator (a modal `select` when there
  are several), and a single owner-authored `update()` sets `organizadorId` to the new uid,
  copies their name to `organizadorNombre`, and removes them from `colaboradores`. The former
  owner then has no role and the centro disappears from their dashboard. Blocked with 0
  confirmed collaborators.
- `crear-centro-p1.js` includes a small reusable `showConfirmModal({title, message,
  confirmText, danger, selectLabel, selectOptions}, onConfirm)` overlay used for the
  destructive confirmations (remove / leave / transfer).

## CSS / Tailwind Build

All 15 HTML pages load a single compiled stylesheet: `/assets/css/tailwind.css`.
It is generated by the **Tailwind CLI** (v3) from `src/input.css` + `tailwind.config.js`.

- The 10 app pages use Tailwind utility classes directly in their markup.
- The 5 auth/auxiliary pages (`404`, `login`, `registro`, `recuperar`, `editar`) use
  semantic component classes (`.btn`, `.nav`, `.auth-card`, `.form-input`, `.alert`,
  `.tag`, `.needs-list`, …) defined in the `@layer components` block of `src/input.css`,
  ported from the legacy `styles.css` and remapped to the blue MD3 theme. This keeps
  `editar.js` / `auth.js` dynamic markup untouched.
- The config scans `public/**/*.html` and `public/assets/js/**/*.js` for class usage, so
  dynamically-toggled classes (e.g. `bg-primary`, `animate-pulse`) are included.
- Plugins: `@tailwindcss/forms`, `@tailwindcss/container-queries`.

**Build commands** (run before deploying):
```bash
npm install              # first time only
npm run build:css        # compile + minify -> public/assets/css/tailwind.css
npm run watch:css        # rebuild on file change during development
```
> The `tailwind.css` output is committed (the site is static, no build step on deploy).
> Re-run `npm run build:css` whenever HTML/JS class usage changes.

## País / Estado / Ciudad catalog (consistent location data)

`public/assets/js/paises-estados.js` exposes `window.AcopifyGeo` and
`window.AcopifyCities` so the create-center form uses **cascading dropdowns**
(País → Estado → Ciudad) instead of free-text, for unified backend data.
- **Country + state**: `AcopifyGeo.load()` → promise of `[{ name, states:[string] }]`.
  Bundled in `public/country-state-city-metadata/countries-states.js`
  (`window.ACOPIFY_PAISES_DATA`, ~71 KB, 250 countries / ~5.2k states), fully
  offline. Small inline `FALLBACK`
  if that file fails. `AcopifyGeo.DEFAULT_COUNTRY` (`"Venezuela"`) is preselected.
- **Cities**: `AcopifyCities.load(country, state)` → promise of `[string]`.
  The world city list is too big for one file (~46 MB), so it's split **per
  country** into `public/country-state-city-metadata/cities/<slug>.json`
  (`{ "<state>": ["<city>"] }`, ~2 MB total / 223 files / ~152k cities).
  The browser fetches only the selected country from our **own domain** — no
  external API. `<slug>` is the accent-stripped, lowercased, dash-joined country
  name (identical logic in the loader and generator).
  - **Venezuela** (`venezuela.json`, ~32 KB) uses a **richer hand-curated dataset**
    from [`aranajhonny/ciudades-de-vzla`](https://github.com/aranajhonny/ciudades-de-vzla)
    instead of the sparse dr5hn data. Each state entry merges `ciudades` +
    municipio names + municipio capitals + parroquias, giving comprehensive
    coverage (e.g. Nueva Esparta: 44 localities vs the previous 3). State keys
    match the dropdown exactly; `Vargas` is stored as `La Guaira` (2021 rename)
    and `Dependencias Federales` is manually included. To regenerate, run the
    one-liner in `tools/build-venezuela-cities.js` (fetches from GitHub raw URL,
    patches keys, writes the file).
- Both datasets are generated by **`tools/build-geo-data.js`** and committed under
  `public/country-state-city-metadata/`. The generator reads the dr5hn
  `countries+states+cities.json` (not committed); to refresh, clone/download
  `dr5hn/countries-states-cities-database` into the repo root (it's gitignored)
  and run `node tools/build-geo-data.js`. The generator drops self-referential
  artifacts (a state named like its country, e.g. Venezuela's stray `"Venezuela"`),
  applies `CORRECTIONS` (adds Venezuela's missing **Dependencias Federales**),
  dedupes, and sorts. Nothing at runtime depends on the source clone.
- The dr5hn data has **no neighborhood level** — so the **barrio/sector** is
  derived at runtime by reverse-geocoding the exact map pin. `reverse-geocode.js`
  exposes `window.AcopifyGeocode.reverse(lat, lng)` (OpenStreetMap **Nominatim**,
  debounced on `moveend`, cached per rounded coord, best-effort) **and**
  `window.AcopifyGeocode.search(query)` (forward geocode of the typed address →
  `{lat, lng}`, used to auto-center the map as País→Estado→Ciudad→Calle are
  filled). In `crear-centro-p1` (the single merged create flow), the detected
  `neighbourhood`/`suburb` auto-fills the editable `#barrio` field; on save,
  `direccion.barrio` (+ `direccion.sector` when distinct) are stored alongside the
  dropdown-sourced `pais`/`estado`/`ciudad` for hyper-segmented address data.
  `centro.js` shows them; the edit flow preserves them.
- **Create flow is a single page** (`crear-centro-p1`): the form fields **and** an
  embedded square Leaflet map (fixed center pin — move the map / use the “Estoy
  aquí” GPS button to set the exact spot) live together, and the `#btn-continuar`
  button saves the center directly to RTDB (`centros`). The old separate map step
  (`crear-centro-p2.html` / `crear-centro-p2.js`) was removed. Load order adds
  `reverse-geocode.js` and the Leaflet CDN script before `crear-centro-p1.js`.
- **Edit flow reuses the create view** (`editar.html`): `editar.html` is a
  faithful mirror of `crear-centro-p1.html` (same markup, same fields, same map)
  and loads the **same** `crear-centro-p1.js`. That script detects the `?id=`
  query param and switches to **edit mode**: it loads the centro via
  `FirebaseDataManager.getCentro`, verifies ownership (`organizadorId`), prefills
  every field (basic info, País→Estado→Municipio→Ciudad cascade via deferred
  `pendingCityValue`/`pendingMunicipioValue`, contact rows, horarios, and the map
  pin from saved `coordenadas`), and on save uses `.update()` (preserving
  `necesidades`/`reportes`/`creadoEn`/`organizadorId`) instead of `push().set()`.
  The standalone `editar.js` was removed. Needs are still managed separately via
  the `lista-recursos` / `agregar-insumo` flow, not on the edit page.
- `crear-centro-p1.html` has `#pais`, `#estado`, `#ciudad` `<select>`s plus a
  `#ciudad-text` fallback input. Load order: `countries-states.js` →
  `paises-estados.js` → `crear-centro-p1.js`. When a state has no city list (e.g.
  offline, or a country/state with no data), the city field falls back to the
  optional text input (`#ciudad-text`) shown via JS. `direccion` stored in RTDB
  has `pais` / `estado` / `ciudad` (canonical names; `estado` optional when a
  country has no subdivisions). `calle` remains free text.
- The **Necesidades Iniciales** step was removed from center creation — needs
  are added later via the `agregar-insumo` flow (category-based catalog).
- **Contacto** now supports multiple, optional numbers. `centro.contacto` is
  stored as `{ telefonos: [string], whatsapps: [string] }` (regular phones are
  call-only; WhatsApp numbers open `wa.me`). The shared create/edit flow
  (`crear-centro-p1.js`) renders dynamic add/remove rows and reads both the new
  array format and the **legacy** singular `telefono`/`whatsapp` strings when
  prefilling, so existing centers keep working; `centro.js` does the same when
  displaying.
- Both `crear-centro-p1/2` footers sit at `bottom-16` (above the persistent
  bottom nav) so the primary action button is no longer occluded.

## SEO / Social Meta

Every page (all 16 HTML files) carries a consistent SEO block in `<head>`, placed
right after the favicon `<link rel="manifest">`:
- `<title>` follows the format **`Acopify - <Página>`** and matches the active bottom-nav
  tab where applicable (`Inicio`, `Donde Donar` → `/mapa`, `Mi Centro` → `/mi-centro`).
- `<meta name="description">`, `<link rel="canonical">`, and **Open Graph** tags
  (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` +
  `og:image:width/height/type/alt`). **No Twitter Card tags** (the project has no
  Twitter presence).
- Canonical domain is **`https://www.acopify.com`** with clean URLs (Firebase `cleanUrls`).
- `og:title` is kept in sync with `<title>`. `404.html` uses `robots: noindex, follow`
  instead of a canonical.

### Social preview image
A single shared 1200×630 preview lives at `public/og-image.png` (served at
`https://www.acopify.com/og-image.png`). It is a "map style" card (Venezuela map +
center pins + Acopify header + tagline). Regenerate it from the committed generator:
```
# render tools/og-image.html at 1200x630 and screenshot -> public/og-image.png
# (uses a headless browser; tools/ is NOT deployed since Firebase serves only public/)
```
`tools/og-image.html` is the editable source; re-screenshot it whenever the design or
domain changes.

## Compartir centro como "historia" 9:16

`public/assets/js/compartir-historia.js` (loaded on `centro.html` after
`centro.js`) generates a shareable **1080×1920 (9:16)** Instagram/WhatsApp-story
image of a center, fully client-side on a `<canvas>` — no extra dependencies.
- Exposes `window.AcopifyStory.open(centro)`. Two entry points, both shown only
  when the center has `coordenadas`:
  - `centro.js` adds a **"Compartir historia"** button (`#btn-share`) in the
    center-identity section of the public detail page, shown to **everyone**.
  - `mi-centro.js` adds a per-card **"Compartir historia"** button
    (`.btn-compartir`) on each owned/collaborated center card; the click handler
    looks the full centro object up in `centrosById` and calls `AcopifyStory.open`.
    `mi-centro.html` loads `compartir-historia.js` after `mi-centro.js`.
- Layout mirrors `og-image.png`: stitched **CartoDB Voyager** map tiles centered
  on the center's pin, a bottom transparent→dark-blue gradient, a red teardrop
  pin, an **Acopify** star+wordmark blue pill top-right, and the center **name /
  address / país·estado** in white at the bottom. Text and badge stay within the
  1080×1420 safe zone (250px top/bottom buffers).
- Map zoom is a **fractional zoom**: base integer tile zoom `MAP_ZOOM=15` with a
  `MAP_SCALE=1.35` factor (≈35% closer / effective ~15.43). `drawMap(...scale)`
  draws each `@2x` tile at `256*scale` px (with +1px overlap to avoid seams).
- The pin is a single red teardrop with a **uniform white stroke outline**
  (`drawPin`) and a white center dot; the tip points exactly at the map center
  (the center's coordinate).
- **Direct link + clipboard**: when opened with `{ id }`, the module copies
  `https://www.acopify.com/centro?id=<id>` to the clipboard during the click
  gesture (`navigator.clipboard` with an `execCommand` fallback) and shows a
  green **"Link directo al centro de acopio, copiado"** chip in the modal (the
  chip is also a button to re-copy) plus a transient **toast** ("Un link del
  centro de acopio fue copiado. Comparte la imagen y pega el link directo…")
  that auto-dismisses after 5s. That link opens the center's detail view.
  The Web Share payload also carries the link as `url`. `centro.js` passes the
  `?id` (null for the demo center); `mi-centro.js` passes the card's id.
- **CartoDB tiles are used (not the OSM tiles of the detail map)** because they
  send CORS headers; OSM would taint the canvas and break `toBlob()`. Tiles load
  with `crossOrigin="anonymous"`; a failed tile degrades gracefully (base fill).
- The result opens in a self-contained modal (inline styles, no Tailwind classes
  needed) with **Compartir** (Web Share API `navigator.share({files})` when
  available, otherwise the button downloads) and **Descargar** (PNG download).
- Awaits `document.fonts.ready` before drawing so the Inter text renders (not a
  fallback font); the Acopify star is drawn from the `favicon.svg` path via
  `Path2D`. Logs a `share` analytics event when opened.

## Verification
JavaScript parsing and compilation can be verified statically with:
```bash
node --check public/assets/js/firebase-init.js
node --check public/assets/js/bottom-nav.js
node --check public/assets/js/app.js
node --check public/assets/js/centro.js
node --check public/assets/js/compartir-historia.js
node --check public/assets/js/crear-centro-p1.js
node --check public/assets/js/reverse-geocode.js
node --check public/assets/js/agregar-insumo.js
node --check public/assets/js/login.js
node --check public/assets/js/registro.js
node --check public/assets/js/paises-estados.js
node --check public/country-state-city-metadata/countries-states.js
```
CSS can be rebuilt and verified with:
```bash
npm run build:css
```
