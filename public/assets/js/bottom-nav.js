/*
 * Acopify - Persistent bottom navigation.
 * Injected on every page. Auto-highlights the active tab based on the
 * current pathname and adds bottom clearance so content isn't hidden.
 */
(function () {
  if (document.getElementById("acopify-bottom-nav")) return;

  // Normalize the page name, handling both clean URLs (/inicio) and .html
  // (/inicio.html), plus the root path ("" or "index").
  var file = (location.pathname || "").toLowerCase().split("/").pop().replace(/\.html$/, "");
  if (!file || file === "index") file = "inicio";

  // Map each page to the section it belongs to (extension-less).
  var groups = {
    inicio: ["inicio", "onboarding"],
    donar: ["mapa", "centro", "lista-recursos"],
    centros: [
      "mi-centro", "crear-centro-p1",
      "agregar-insumo", "ajustes", "editar",
      "login", "registro", "recuperar"
    ]
  };
  var active = "";
  Object.keys(groups).forEach(function (k) {
    if (groups[k].indexOf(file) !== -1) active = k;
  });

  var items = [
    { key: "inicio", href: "/inicio.html", icon: "home", label: "Inicio" },
    { key: "donar", href: "/mapa.html", icon: "map", label: "Donde Donar" },
    { key: "centros", href: "/mi-centro.html", icon: "inventory_2", label: "Mi Centro" }
  ];

  var inner = items.map(function (it) {
    var on = it.key === active;
    var color = on ? "text-primary" : "text-on-surface-variant hover:text-primary transition-colors";
    var fill = on ? " style=\"font-variation-settings:'FILL' 1;\"" : "";
    var weight = on ? "font-bold" : "font-medium";
    var cur = on ? " aria-current=\"page\"" : "";
    // Active tab gets a Material-style pill behind the icon so the current
    // section is unmistakable, in addition to the blue text/fill.
    var pill = on
      ? "inline-flex items-center justify-center px-5 py-0.5 rounded-full bg-surface-variant"
      : "inline-flex items-center justify-center px-5 py-0.5 rounded-full";
    return '<a href="' + it.href + '"' + cur +
      ' class="flex-1 flex flex-col items-center justify-center gap-0.5 ' + color + '">' +
      '<span class="' + pill + '">' +
      '<span class="material-symbols-outlined"' + fill + '>' + it.icon + '</span>' +
      '</span>' +
      '<span class="text-[11px] ' + weight + ' tracking-wide">' + it.label + '</span>' +
      '</a>';
  }).join("");

  function mount() {
    if (document.getElementById("acopify-bottom-nav")) return;
    var nav = document.createElement("nav");
    nav.id = "acopify-bottom-nav";
    nav.className = "fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-outline-variant shadow-[0_-2px_10px_rgba(0,0,0,0.06)]";
    nav.innerHTML = '<div class="max-w-5xl mx-auto h-16 flex items-stretch justify-around">' + inner + "</div>";
    document.body.appendChild(nav);

    // Reserve space at the bottom so fixed nav doesn't cover content.
    // Skip pages that manage their own fixed layout (e.g. the full-screen map).
    if (getComputedStyle(document.body).overflowY !== "hidden") {
      var pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      if (pad < 80) document.body.style.paddingBottom = "5rem";
    }
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
