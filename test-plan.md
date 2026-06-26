# Acopify Test Plan

## What Changed
Full rewrite from generic Firebase template to a disaster relief coordination platform for the Venezuela earthquake. 6 HTML pages, 8 JS files, 843-line CSS design system (no Tailwind). Key features: Leaflet map homepage, Firebase Auth, centro registration with draggable map pin, real-time needs management, organizer dashboard, report system.

## Environment
- Local http-server at `localhost:5000`
- Real Firebase project: `acopify-venezuela` (credentials configured)
- Must use `.html` extensions in URLs (http-server doesn't support `cleanUrls`)
- Note: internal nav links use clean URLs (e.g. `/registro`) which won't resolve on http-server. This is expected - Firebase Hosting handles this in production via `cleanUrls: true`.

## Code Evidence
- login.js:22-37 — toggle between login/register modes
- login.js:40-59 — form submit calls Firebase Auth createUser or signIn
- login.js:82-94 — translateError maps Firebase error codes to Spanish messages
- registro.js:23-32 — auth guard hides form, shows "auth-required" when not logged in
- registro.js:34-60 — draggable marker on Leaflet map for location selection
- registro.js:75-111 — client-side needs list add/remove before submission
- registro.js:116-177 — form submit writes to Firebase RTDB
- app.js:29-36 — real-time listener on db.ref("centros")
- app.js:87-131 — renderList shows empty state or centro cards
- centro.js:9-18 — no ID param shows "Centro no encontrado"
- centro.js:24-35 — real-time listener renders centro or "no existe" message
- mis-centros.js:9-17 — auth guard shows "auth-required" when not logged in

---

## Test 1: Primary E2E Flow — Create Account, Register Centro, Verify on Map

This is the single most important flow: it proves the entire platform works end-to-end.

### Step 1: Homepage loads with map and empty state
- Navigate to `http://localhost:5000/index.html`
- **Pass:** Leaflet map visible with OpenStreetMap tiles (not grey/blank). Nav shows "Iniciar sesion" link. Sidebar shows empty state text "No hay centros de acopio registrados aun." or loading spinner.
- **Fail:** Blank page, no map tiles, or JS error prevents rendering.

### Step 2: Navigate to login page and create an account
- Navigate to `http://localhost:5000/login.html`
- Click "Crear cuenta" toggle link
- **Pass:** Heading changes to "Crear cuenta", submit button text changes to "Crear cuenta", footer shows "Ya tienes cuenta? Iniciar sesion"
- **Fail:** Toggle doesn't work, text doesn't change, or page errors.

### Step 3: Submit registration form
- Fill email field with a test email (e.g. `test@acopify.com`)
- Fill password field with `Test123456`
- Click "Crear cuenta" submit button
- **Pass (if Auth enabled):** User is created, page redirects to homepage "/" (which on http-server will show the directory listing or index.html). Nav now shows user name, "Mis centros", "+ Registrar", "Salir" links.
- **Pass (if Auth NOT enabled):** Error banner appears with Spanish error message (from translateError). This proves the error handling works correctly.
- **Fail:** No response, JS crash, or English error message.

### Step 4: Navigate to registration page (if authenticated)
- Navigate to `http://localhost:5000/registro.html`
- **Pass (if authenticated):** Auth-required message is hidden, registration form is visible with fields: nombre, descripcion, calle, ciudad, estado, piso, telefono, whatsapp. Leaflet map centered on Caracas is visible with draggable marker. Coords display shows "Lat: 10.480000, Lng: -66.870000".
- **Pass (if NOT authenticated):** Blue alert shows "Debes iniciar sesion para registrar un centro de acopio". Form is hidden with class "hidden".
- **Fail:** Both form and auth-required visible, or neither visible, or map doesn't render.

### Step 5: Test draggable pin and needs list (if form visible)
- Click on a different location on the map
- **Pass:** Marker moves to clicked location, coords display updates to new lat/lng values.
- Add a need by typing "Agua" in the need input and clicking "Agregar"
- **Pass:** Tag "Agua" appears in the needs list with an "x" remove button.
- Add "Medicinas" as another need
- **Pass:** Both "Agua" and "Medicinas" tags visible.
- Remove "Agua" by clicking its "x" button
- **Pass:** Only "Medicinas" remains.
- **Fail:** Map click doesn't move marker, needs don't appear, or remove doesn't work.

### Step 6: Submit centro registration (if authenticated)
- Fill required fields: nombre="Centro de Prueba", calle="Av. Libertador", ciudad="Caracas", estado="Distrito Capital"
- Click "Registrar Centro" submit button
- **Pass (if RTDB enabled):** Page redirects to centro detail page. Centro name, address, map, and needs are displayed.
- **Pass (if RTDB NOT enabled):** Error message appears: "Error al registrar: ..." This proves error handling works.
- **Fail:** No response, JS crash, or no error feedback.

### Step 7: Verify centro appears on homepage map (if registration succeeded)
- Navigate back to `http://localhost:5000/index.html`
- **Pass:** Map now shows a marker pin. Sidebar shows a centro card with name "Centro de Prueba" and address.
- **Fail:** Map still shows no markers, sidebar still shows empty state.

## Test 2: Auth Guard on Protected Pages (No Login Required)

### Step 1: Registration page shows auth guard
- In a fresh/unauthenticated state, navigate to `http://localhost:5000/registro.html`
- **Pass:** Blue info alert visible with text "Debes iniciar sesion para registrar un centro de acopio". Login link present. Form inputs NOT visible.
- **Fail:** Form visible without authentication, or auth-required message missing.

### Step 2: Mis-centros page shows auth guard
- Navigate to `http://localhost:5000/mis-centros.html`
- **Pass:** Blue info alert visible with text "Debes iniciar sesion para ver tus centros." Login link present.
- **Fail:** No auth guard message, or centros listing visible without auth.

### Step 3: Centro detail handles missing ID
- Navigate to `http://localhost:5000/centro.html` (no `?id=` param)
- **Pass:** Shows "Centro no encontrado." with "Volver al mapa" button.
- **Fail:** Loading spinner stuck, blank page, or JS error.

## Test 3: 404 Page and CSS Verification

### Step 1: 404 page renders
- Navigate to `http://localhost:5000/404.html`
- **Pass:** Shows "404" heading, "Pagina no encontrada" text, "Volver al mapa" link. Magnifying glass emoji visible.
- **Fail:** Blank page or unstyled content.

### Step 2: CSS is plain CSS (no Tailwind)
- On any page, verify visual styling uses custom CSS (rounded buttons, #1a73e8 blue primary color, proper spacing)
- **Pass:** Styled consistently with custom design system. No Tailwind utility classes (bg-, text-, flex, grid) in HTML source.
- **Fail:** Raw unstyled elements or Tailwind classes present.
