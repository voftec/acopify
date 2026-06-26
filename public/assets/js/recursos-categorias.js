/*
 * Acopify - Categorías de recursos (compartido entre lista-recursos y agregar-insumo)
 */

var RECURSO_CATEGORIAS = [
  { id: "agua-alimentos", label: "Agua y Alimentos", icon: "water_drop", emoji: "💧" },
  { id: "insumos-medicos", label: "Insumos Médicos", icon: "medical_services", emoji: "💊" },
  { id: "higiene", label: "Higiene Personal", icon: "clean_hands", emoji: "🧼" },
  { id: "rescatistas", label: "Para Rescatistas", icon: "engineering", emoji: "🦺" },
  { id: "equipos", label: "Equipos de Apoyo", icon: "construction", emoji: "🛠️" },
  { id: "refugio", label: "Refugio y Ropa", icon: "checkroom", emoji: "🧸" }
];

// Categoría de respaldo para insumos antiguos o sin categoría asignada.
var RECURSO_CATEGORIA_OTROS = { id: "otros", label: "Otros", icon: "category", emoji: "📦" };

function getCategoriaById(id) {
  for (var i = 0; i < RECURSO_CATEGORIAS.length; i++) {
    if (RECURSO_CATEGORIAS[i].id === id) return RECURSO_CATEGORIAS[i];
  }
  return RECURSO_CATEGORIA_OTROS;
}

var RECURSO_PRIORIDADES = {
  alta: { label: "Alta", badge: "bg-tertiary-container text-on-tertiary" },
  media: { label: "Media", badge: "bg-secondary-container text-on-secondary-container" },
  baja: { label: "Baja", badge: "bg-primary-container text-on-primary-container" }
};
