# Acopify — Visión de Producto

> Plataforma para coordinar centros de acopio y canalizar ayuda humanitaria tras el terremoto en Venezuela.

Este documento describe **qué debe hacer Acopify y cómo debe funcionar**, sin detalles técnicos. Se centra en las intenciones, los flujos de uso y todas las funcionalidades que debe tener.

---

## 1. Intención

Tras un terremoto en Venezuela, la ayuda llega de forma descoordinada. Acopify existe para resolver una pregunta simple pero crítica:

> **"¿A dónde llevo lo que quiero donar, y qué necesitan ahí ahora mismo?"**

La plataforma centraliza la ubicación de los centros de acopio y lo que cada uno necesita, en tiempo real, para que:

- **Donar sea rápido y preciso** — sin llamadas ni búsquedas a ciegas.
- **Los centros publiquen y actualicen sus necesidades** al instante.
- **Los recursos fluyan** de los centros pequeños hacia los grandes sin duplicar esfuerzos.

Principios que guían cada decisión:
- **Urgencia primero** — registrarse y publicar debe ser inmediato, sin trabas ni aprobaciones previas.
- **Precisión** — la ubicación de cada centro debe ser exacta.
- **Tiempo real** — lo que un centro necesita hoy puede cambiar en una hora; los donantes deben ver siempre lo más actual.
- **Accesible para todos** — gratis, en español, y fácil de usar desde el teléfono.

---

## 2. Para quién es

| Usuario | Qué busca | Qué hace |
|---------|-----------|----------|
| **Donante** | Saber a dónde llevar recursos y qué se necesita | Explora el mapa, entra al detalle de un centro, ve sus necesidades y lo contacta |
| **Organizador de un centro** | Hacer visible su centro y mantener su lista de necesidades al día | Crea su centro, fija su ubicación, agrega/quita necesidades, edita o elimina su centro |

Cualquier persona puede registrar un centro: **no hay aprobación previa**.

---

## 3. Cómo debe funcionar (flujos principales)

### Flujo del donante
1. Entra a la plataforma y ve un **mapa con todos los centros** marcados.
2. Puede ver los centros como pines en el mapa o como una **lista**.
3. Toca un centro y ve su **detalle**: nombre, dirección, ubicación en el mapa, **qué necesita ahora mismo** y cómo contactarlo.
4. Contacta al centro (teléfono o WhatsApp) y coordina su donación.
5. Si algo se ve incorrecto o sospechoso, puede **reportar** el centro.

### Flujo del organizador
1. **Crea una cuenta** o inicia sesión.
2. **Registra su centro**: escribe el nombre, la descripción y la dirección.
3. **Fija la ubicación exacta** arrastrando un pin sobre el mapa (la dirección escrita es para mostrar; el pin define el punto preciso).
4. Agrega su **contacto** (teléfono y WhatsApp).
5. Publica una **lista de necesidades** (agua, comida, medicinas, ropa, mantas, etc.).
6. A medida que cambian las cosas, **agrega o quita necesidades** y los donantes lo ven al instante.
7. Desde su panel puede **ver, editar o eliminar** sus centros en cualquier momento.

---

## 4. Funcionalidades

### Descubrimiento (donante)
- **Mapa de inicio** con todos los centros como pines.
- **Vista de lista** alternativa al mapa.
- **Detalle de centro** con: nombre, descripción, dirección, ubicación en el mapa, lista de necesidades actual y datos de contacto.
- **Necesidades en tiempo real**: lo que se ve siempre está actualizado.
- **Botón de reporte** para señalar información incorrecta o sospechosa.

### Cuenta y acceso (organizador)
- **Registro e inicio de sesión** (correo/contraseña y opción de cuenta de Google).
- Cada organizador solo puede **editar o eliminar sus propios centros**.

### Registro y gestión de centros
- **Crear centro** con:
  - Nombre y descripción.
  - Dirección detallada: **calle, piso, apartamento**, ciudad, estado.
  - **Pin arrastrable en el mapa** para coordenadas exactas.
  - Contacto: **teléfono y WhatsApp**.
  - **Lista de necesidades** inicial.
- **Gestión de necesidades en tiempo real**: agregar y quitar ítems; los cambios se reflejan al instante para los donantes.
- **Editar** cualquier dato del centro (incluida la ubicación).
- **Eliminar** un centro.
- **Panel "Mis centros"** para administrar todos los centros propios (ver / editar / eliminar).

### Confianza y seguridad
- **Reporte de centros** abierto a cualquiera.
- Cada centro está asociado a su organizador; solo él lo modifica.

---

## 5. Experiencia esperada

- **Mobile-first**: la mayoría usará el teléfono, así que debe sentirse natural en pantallas pequeñas.
- **Funciona bien en escritorio** también.
- **Idioma: español (Latinoamérica)** en toda la interfaz.
- **Inmediato**: pocos pasos para donar o registrar un centro.
- **Claro**: en todo momento el usuario entiende qué centro es, dónde queda y qué necesita.

---

## 6. Qué NO entra por ahora

Para mantener el foco en lo urgente, queda fuera del alcance inicial:
- Jerarquía formal entre centros grandes y pequeños (vincular "hijos" a un "hub").
- Tamaños o categorías de centros.
- Moderación proactiva de contenido (solo existe el botón de reporte).
- Versión bilingüe (por ahora solo español LATAM).

---

## 7. Cómo sabemos que funciona

- Un donante puede, en menos de un minuto, encontrar el centro más cercano y saber qué necesita.
- Un organizador puede registrar su centro con ubicación precisa y publicar sus necesidades sin ayuda.
- Cuando un centro actualiza sus necesidades, los donantes ven el cambio de inmediato.
- Cualquiera puede reportar un centro dudoso.
