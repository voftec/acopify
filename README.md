# Acopify

Plataforma de codigo abierto para localizar y coordinar centros de acopio para ayuda humanitaria en Venezuela.

## Que es Acopify?

Acopify centraliza la informacion de centros de acopio para que:
- **Donantes** encuentren rapidamente donde enviar recursos.
- **Organizadores** registren y gestionen sus centros, publicando que necesitan en tiempo real.

## Funcionalidades

- Mapa interactivo con todos los centros de acopio (Leaflet + OpenStreetMap)
- Registro de centros con direccion detallada y pin arrastrable en el mapa
- Lista de necesidades en tiempo real (Firebase Realtime Database)
- Autenticacion con email/contrasena o Google
- Panel de gestion para organizadores (editar, eliminar centros)
- Boton de reporte para contenido sospechoso
- Responsive: mobile-first con soporte desktop

## Tech Stack

- **Hosting:** Firebase Hosting
- **Base de datos:** Firebase Realtime Database
- **Autenticacion:** Firebase Auth (email + Google)
- **Mapa:** Leaflet + OpenStreetMap (gratis, sin API key)
- **Frontend:** HTML, CSS, vanilla JavaScript
- Sin dependencias de build (sin npm, sin bundler)

## Estructura del proyecto

```
acopify/
├── public/
│   ├── index.html              # Pagina principal (mapa + lista)
│   ├── login.html              # Inicio de sesion / registro
│   ├── registro.html           # Registrar centro de acopio
│   ├── centro.html             # Detalle de un centro
│   ├── mis-centros.html        # Dashboard del organizador
│   ├── editar.html             # Editar centro de acopio
│   ├── 404.html                # Pagina de error
│   └── assets/
│       ├── css/styles.css      # Estilos (CSS puro, mobile-first)
│       └── js/
│           ├── firebase-init.js  # Configuracion Firebase
│           ├── auth.js           # Estado de autenticacion
│           ├── login.js          # Logica de login
│           ├── app.js            # Homepage: mapa + lista
│           ├── registro.js       # Formulario de registro
│           ├── centro.js         # Detalle + reportes
│           ├── mis-centros.js    # Dashboard
│           └── crear-centro-p1.js # Crear y editar centro (vista compartida)
├── firebase.json               # Configuracion Firebase Hosting
├── .firebaserc                 # Alias del proyecto
├── rtdb.rules.json             # Reglas de seguridad RTDB
└── LICENSE                     # MIT
```

## Inicio rapido

### Requisitos

- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

### Configuracion

1. Clona el repositorio:
   ```bash
   git clone https://github.com/voftec/acopify.git
   cd acopify
   ```

2. Configura Firebase: edita `public/assets/js/firebase-init.js` con las credenciales de tu proyecto Firebase (Firebase Console > Project Settings > Your apps).

3. Habilita los proveedores de autenticacion en Firebase Console:
   - Email/Password
   - Google

4. Inicia el servidor local:
   ```bash
   firebase login
   firebase serve
   ```

5. Abre `http://localhost:5000` en tu navegador.

### Despliegue

```bash
firebase deploy
```

## Reglas de seguridad RTDB

- **Centros:** lectura publica; escritura solo para usuarios autenticados (creador del centro).
- **Necesidades:** solo el organizador del centro puede agregar/eliminar.
- **Reportes:** escritura publica; lectura restringida.

## Licencia

MIT
