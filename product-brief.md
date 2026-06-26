# Acopify — Brief de Producto

> Plataforma de coordinación de centros de acopio para la ayuda humanitaria tras el terremoto en Venezuela.

Este documento resume el descubrimiento del producto: el problema, los usuarios, las decisiones de diseño y el alcance, tal como surgieron durante la entrevista de requisitos. Sirve como fuente de verdad para entender *qué* se construyó y *por qué*.

---

## 1. Problema

Tras un terremoto en Venezuela, los recursos de ayuda (agua, comida, medicinas, ropa, etc.) llegan de forma descoordinada. No existe un lugar centralizado donde:

- Los **donantes** sepan a dónde llevar o enviar recursos.
- Los **centros de acopio** publiquen su ubicación exacta y lo que necesitan en cada momento.

Los centros más pequeños recolectan y luego canalizan los recursos hacia centros más grandes, pero sin visibilidad compartida el proceso es lento y propenso a duplicar esfuerzos.

**Acopify centraliza esta información** para que donar y coordinar sea rápido, preciso y en tiempo real.

---

## 2. Usuarios objetivo

| Usuario | Necesidad | Qué hace en Acopify |
|---------|-----------|---------------------|
| **Donante** | Saber dónde enviar recursos y qué se necesita | Ve un mapa con todos los centros, abre el detalle de uno, consulta sus necesidades y contacto |
| **Organizador de un centro** | Publicar su centro y mantener actualizada su lista de necesidades | Se registra, crea su centro con ubicación precisa, agrega/elimina necesidades en tiempo real, edita o elimina su centro |

El registro de centros es **abierto**: cualquier persona puede crear uno (no hay aprobación previa por administrador).

---

## 3. Decisiones clave (de la entrevista)

Cada decisión proviene directamente de la conversación de descubrimiento.

1. **Registro abierto, sin moderación previa.** Cualquiera puede registrar un centro. Dada la urgencia, no hay flujo de aprobación administrativa.
2. **Ubicación precisa con pin arrastrable.** El organizador escribe la dirección (calle, piso, apartamento) para mostrarla y **arrastra un pin en el mapa** para fijar las coordenadas GPS exactas. Se eligió el pin sobre la geocodificación automática porque Nominatim/OSM es impreciso en Venezuela.
3. **Mapa gratuito y sin API key.** Leaflet + OpenStreetMap, para mantener el proyecto 100% gratuito.
4. **Autenticación.** Email/contraseña **y** login con Google (Firebase Auth), para que los organizadores puedan editar/eliminar sus propios centros.
5. **Necesidades en tiempo real.** El organizador agrega o quita ítems de su lista de necesidades y los donantes ven los cambios **al instante** (Firebase Realtime Database).
6. **Contacto: teléfono y WhatsApp.** Cada centro muestra ambos.
7. **Botón de reporte.** Cualquiera puede reportar un centro con información incorrecta o sospechosa. No hay moderación proactiva, pero sí un canal de denuncia.
8. **Idioma: español (LATAM)** en toda la interfaz.
9. **Mobile-first** y que funcione bien también en escritorio.
10. **Sin Tailwind ni build step.** Solo HTML, CSS plano y JavaScript vanilla, por simplicidad y robustez a largo plazo.

---

## 4. Funcionalidades

### En alcance (MVP)
- **Mapa de inicio** (Leaflet + OSM) con todos los centros como pines.
- **Registro/login** (email/contraseña + Google).
- **Registro de centro** con:
  - Nombre y descripción
  - Dirección completa (calle, piso, apartamento) — escrita para mostrar
  - Pin arrastrable en el mapa para coordenadas GPS exactas
  - Teléfono + enlace de WhatsApp
  - Lista de necesidades (agua, comida, medicinas, ropa, mantas, etc.)
- **Gestión de necesidades en tiempo real** (agregar/eliminar ítems, visibles al instante para donantes).
- **Detalle de centro** con info completa, mapa, contacto y botón de reporte.
- **Dashboard del organizador** ("Mis centros") para ver/editar/eliminar sus propios centros.
- **Reglas de seguridad RTDB** basadas en autenticación (cada organizador gestiona solo lo suyo).
- **Página 404** personalizada.

### Fuera de alcance (por ahora)
- Jerarquía hub/satélite (centros pequeños vinculados a centros grandes).
- Tamaños o categorías de centros.
- Moderación proactiva de contenido (solo existe el botón de reporte).
- Bilingüe (solo español LATAM por ahora).

---

## 5. Tech stack

| Capa | Tecnología | Por qué |
|------|------------|---------|
| Hosting | Firebase Hosting | Gratis, rápido, integrado con el resto de Firebase |
| Base de datos | Firebase Realtime Database | Actualizaciones en tiempo real para las necesidades |
| Autenticación | Firebase Auth (email + Google) | Permite a organizadores gestionar sus centros |
| Mapa | Leaflet + OpenStreetMap | Gratis, sin API key, ubicación precisa con pin |
| Frontend | HTML + CSS plano + JavaScript vanilla | Sin build step; simple, robusto y fácil de mantener |

Principio rector establecido durante el desarrollo: **construir tecnología robusta y escalable que no se rompa con el tiempo ni al crecer** — evitar soluciones a medias. Por ejemplo, todas las páginas cargan el mismo conjunto de SDKs de Firebase de forma consistente, en lugar de usar condicionales frágiles.

---

## 6. Estructura del proyecto

```
acopify/
├── public/
│   ├── index.html          # Mapa + lista de centros
│   ├── login.html          # Inicio de sesión / registro
│   ├── registro.html       # Registrar centro (pin arrastrable)
│   ├── centro.html         # Detalle de un centro + reporte
│   ├── mis-centros.html    # Dashboard del organizador
│   ├── editar.html         # Editar centro + necesidades
│   ├── 404.html
│   └── assets/
│       ├── css/styles.css  # Sistema de diseño (CSS plano)
│       └── js/             # firebase-init, auth, login, app,
│                           # registro, centro, mis-centros, editar
├── firebase.json           # Hosting (cleanUrls, cache headers)
├── .firebaserc             # Proyecto: acopify-venezuela
├── rtdb.rules.json         # Reglas de seguridad RTDB
└── LICENSE                 # MIT (open source)
```

---

## 7. Modelo de datos (RTDB)

```
centros/
  <centroId>/
    nombre, descripcion
    direccion: { calle, piso, ciudad, estado }
    coordenadas: { lat, lng }
    contacto: { telefono, whatsapp }
    organizadorId, organizadorNombre
    necesidades/ { <key>: { nombre } }
    reportes (contador)

reportes/
  <reporteId>/ { centroId, motivo, reportadoPor, creadoEn }
```

Reglas de seguridad:
- **Centros:** lectura pública; escritura solo del organizador autenticado dueño del centro.
- **Necesidades:** solo el organizador del centro las modifica.
- **Reportes:** escritura pública; lectura restringida.

---

## 8. Configuración y despliegue

1. Configurar credenciales en `public/assets/js/firebase-init.js` (proyecto `acopify-venezuela`, RTDB `https://acopify-venezuela-default-rtdb.firebaseio.com`).
2. Habilitar en Firebase Console los proveedores: **Email/Password** y **Google**.
3. Local: `firebase serve` (respeta `cleanUrls`). Con otros servidores estáticos usar extensiones `.html` en las URLs.
4. Producción: `firebase deploy`.

---

## 9. Estado

- Plataforma completa construida (6+ páginas, JS vanilla, sistema de diseño CSS sin Tailwind).
- Pruebas E2E ejecutadas con el proyecto Firebase real `acopify-venezuela`: **11/11 pasaron**.
- Flujo verificado: creación de cuenta, registro de centro con pin, gestión de necesidades, detalle, dashboard (Ver/Editar/Eliminar), guards de autenticación y página 404.
- Open source bajo licencia **MIT**.

Ver `test-plan.md` y `test-report.md` para el detalle de las pruebas.
