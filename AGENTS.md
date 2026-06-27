# Acopify - Firebase Analytics Integration

This document outlines the Firebase Analytics setup and the custom event tracking implemented for Acopify.

## Core Setup
- **Firebase Version**: v10 (Compat / Namespaced API).
- **Scripts Included**: In all 14 HTML pages, the analytics compat script is loaded from CDN:
  ```html
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics-compat.js"></script>
  ```
- **Crash-Resistant Analytics**: To ensure pages do not crash when ad-blockers block Firebase Analytics, a global helper is defined in `public/assets/js/firebase-init.js`:
  ```javascript
  window.logAnalyticsEvent(eventName, params)
  ```
  This function safely accesses Firebase Analytics and logs events only if the library is loaded and initialized, avoiding global execution exceptions.

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
| `add_centro_de_acopio` | `crear-centro-p2.js` | Logged when a center is successfully registered in the database. | `nombre`, `estado`, `necesidades_count` |
| `add_insumo` | `agregar-insumo.js` | Logged when a resource/insumo is successfully added by the owner. | `nombre`, `categoria`, `prioridad`, `centro_id` |
| `login` | `login.js` | Standard login event tracking the auth method. | `method` ("email", "google") |
| `sign_up` | `registro.js` | Standard sign-up event tracking registration method. | `method` ("email", "google") |

## Verification
JavaScript parsing and compilation can be verified statically with:
```bash
node --check public/assets/js/firebase-init.js
node --check public/assets/js/app.js
node --check public/assets/js/centro.js
node --check public/assets/js/crear-centro-p2.js
node --check public/assets/js/agregar-insumo.js
node --check public/assets/js/login.js
node --check public/assets/js/registro.js
```
