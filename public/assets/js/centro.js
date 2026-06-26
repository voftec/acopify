/*
 * Acopify - Centro detail page with real-time needs updates.
 *
 * Connected to Firebase RTDB (centros/{id}). If no id is provided or the
 * center does not exist, a mock center is shown so the layout is always
 * previewable ("datos de demostración").
 */

(function () {
  var contentEl = document.getElementById("centro-content");
  var modalEl = document.getElementById("modal-reportar");
  var needsModalEl = document.getElementById("modal-needs");

  var params = new URLSearchParams(window.location.search);
  var centroId = params.get("id");

  // ---- Mock fallback (used when there is no id or the center is missing) ----
  var MOCK_CENTRO = {
    nombre: "Polideportivo Municipal",
    descripcion: "",
    direccion: {
      calle: "Av. Libertador 1234",
      piso: "Piso 3",
      ciudad: "Caracas",
      estado: "Distrito Capital"
    },
    coordenadas: { lat: 10.4806, lng: -66.9036 },
    contacto: { telefono: "+58 412 1234567", whatsapp: "+58 412 7654321" },
    horarios: {
      lunes: { desde: "8:00 AM", hasta: "6:00 PM" },
      martes: { desde: "8:00 AM", hasta: "6:00 PM" },
      miercoles: { desde: "8:00 AM", hasta: "6:00 PM" },
      jueves: { desde: "8:00 AM", hasta: "6:00 PM" },
      viernes: { desde: "8:00 AM", hasta: "6:00 PM" }
    },
    organizadorNombre: "Lic. Elena Rodríguez",
    necesidades: {
      n1: { nombre: "Agua Potable" },
      n2: { nombre: "Alimentos no perecederos" },
      n3: { nombre: "Antibióticos / Gasas" }
    },
    creadoEn: Date.now() - 15 * 60 * 1000,
    _isMock: true
  };

  var shellBuilt = false;
  var detailMap = null;
  var lastCentro = null;
  var usingMock = false;

  if (!centroId) {
    // No id: show the mock center as a first-instance preview.
    usingMock = true;
    render(MOCK_CENTRO);
  } else {
    var centroRef = db.ref("centros/" + centroId);
    centroRef.on("value", function (snapshot) {
      var centro = snapshot.val();
      if (!centro) {
        usingMock = true;
        render(MOCK_CENTRO);
        return;
      }
      usingMock = false;
      render(centro);
    });
  }

  // Re-render owner actions once auth state is known (auth resolves async).
  auth.onAuthStateChanged(function (user) {
    var navLogin = document.getElementById("nav-login");
    if (navLogin) {
      if (user) {
        navLogin.textContent = "Mis centros";
        navLogin.href = "/mis-centros.html";
      } else {
        navLogin.textContent = "Iniciar sesión";
        navLogin.href = "/login.html";
      }
    }
    if (lastCentro) updateActions(lastCentro);
  });

  function render(centro) {
    lastCentro = centro;
    if (!shellBuilt) buildShell(centro);
    updateDynamic(centro);
  }

  /* ----------------------------- Shell ----------------------------- */
  // Builds the static structure once. The Leaflet map lives here so it is
  // created a single time and never destroyed by realtime updates.
  function buildShell(c) {
    contentEl.innerHTML =
      '<div class="space-y-lg">' +

      // Demo banner
      '<div id="demo-banner" class="hidden flex items-center gap-2 p-sm rounded-xl bg-secondary-container/20 text-on-secondary-fixed-variant text-label-md font-label-md border border-secondary-container/40">' +
        '<span class="material-symbols-outlined text-[18px]">science</span>' +
        'Datos de demostración. Conéctate a un centro real desde el mapa.' +
      '</div>' +

      // Center identity
      '<section class="space-y-sm">' +
        '<h2 id="d-nombre" class="text-headline-lg font-headline-lg text-on-background"></h2>' +
        '<div class="flex items-start gap-2 text-on-surface-variant">' +
          '<span class="material-symbols-outlined text-primary mt-1">location_on</span>' +
          '<p id="d-address" class="text-body-md font-body-md"></p>' +
        '</div>' +
        '<div id="d-desc" class="text-body-md font-body-md text-on-surface-variant" style="display:none;"></div>' +
      '</section>' +

      // Map + Urgent needs bento
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-lg">' +
        '<div class="md:col-span-2 bg-white rounded-xl overflow-hidden shadow-sm border border-outline-variant group">' +
          '<div class="relative h-64 md:h-80 w-full bg-surface-container">' +
            '<div id="detail-map" class="w-full h-full"></div>' +
            '<div class="absolute bottom-4 right-4 z-[500] flex flex-col gap-2">' +
              '<button id="map-zoom-in" class="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-primary hover:bg-surface-container-high active:scale-95 transition-all">' +
                '<span class="material-symbols-outlined">add</span></button>' +
              '<button id="map-zoom-out" class="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-primary hover:bg-surface-container-high active:scale-95 transition-all">' +
                '<span class="material-symbols-outlined">remove</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="bg-white rounded-xl p-md shadow-sm border border-outline-variant crisis-card-border border-l-tertiary flex flex-col justify-between">' +
          '<div>' +
            '<h3 id="needs-title" class="text-label-md font-label-md text-tertiary mb-xs flex items-center gap-2">' +
              '<span class="material-symbols-outlined text-[18px]">warning</span>NECESIDADES URGENTES</h3>' +
            '<ul id="d-needs" class="space-y-sm mt-md"></ul>' +
            '<button id="btn-full-needs" class="mt-md w-full flex items-center justify-center gap-2 p-sm border border-primary text-primary rounded-lg font-label-md hover:bg-surface-container-low transition-colors active:scale-95">' +
              '<span class="material-symbols-outlined text-[18px]">list_alt</span>Lista completa de insumos</button>' +
          '</div>' +
          '<div class="mt-lg pt-lg border-t border-outline-variant">' +
            '<p id="d-updated" class="text-status-sm font-status-sm text-outline mb-xs uppercase"></p>' +
            '<div class="flex items-center gap-2">' +
              '<div id="d-status-dot" class="w-2 h-2 rounded-full animate-pulse"></div>' +
              '<span id="d-status" class="text-label-md font-label-md"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Horarios + Contacto
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-lg">' +
        '<section class="space-y-md">' +
          '<h3 class="text-headline-md font-headline-md text-on-background">Días y Horarios</h3>' +
          '<div id="d-horarios" class="space-y-sm"></div>' +
        '</section>' +
        '<section class="space-y-md">' +
          '<h3 class="text-headline-md font-headline-md text-on-background">Contacto centro acopio</h3>' +
          '<div id="d-contact" class="space-y-sm"></div>' +
        '</section>' +
      '</div>' +

      // Creado por
      '<section class="bg-surface-container rounded-xl p-md flex items-center gap-md">' +
        '<div class="flex-grow">' +
          '<p class="text-status-sm font-status-sm text-outline uppercase tracking-widest">Creado por</p>' +
          '<h4 id="d-org" class="text-body-lg font-bold text-on-surface"></h4>' +
          '<p class="text-body-md font-body-md text-on-surface-variant">Coordinación del centro de acopio</p>' +
        '</div>' +
      '</section>' +

      // Actions
      '<div id="d-actions" class="flex flex-col md:flex-row justify-between items-center py-lg border-t border-outline-variant gap-md"></div>' +

      '</div>';

    // Init Leaflet map once.
    if (c.coordenadas) {
      detailMap = L.map("detail-map", { scrollWheelZoom: false, zoomControl: false })
        .setView([c.coordenadas.lat, c.coordenadas.lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(detailMap);
      L.marker([c.coordenadas.lat, c.coordenadas.lng]).addTo(detailMap);

      var zin = document.getElementById("map-zoom-in");
      var zout = document.getElementById("map-zoom-out");
      if (zin) zin.addEventListener("click", function () { detailMap.zoomIn(); });
      if (zout) zout.addEventListener("click", function () { detailMap.zoomOut(); });

      // Ensure correct sizing once the container has laid out.
      setTimeout(function () { if (detailMap) detailMap.invalidateSize(); }, 100);
    }

    document.getElementById("btn-full-needs").addEventListener("click", openNeedsModal);
    setupReportModal();
    setupNeedsModal();
    shellBuilt = true;
  }

  /* --------------------------- Dynamic --------------------------- */
  function updateDynamic(c) {
    var demo = document.getElementById("demo-banner");
    if (demo) demo.classList.toggle("hidden", !usingMock);

    document.getElementById("d-nombre").textContent = c.nombre || "Centro de acopio";
    document.getElementById("d-address").textContent = buildAddressString(c.direccion);
    document.title = (c.nombre || "Centro") + " - Acopify";

    var descEl = document.getElementById("d-desc");
    if (c.descripcion) {
      descEl.textContent = c.descripcion;
      descEl.style.display = "";
    } else {
      descEl.style.display = "none";
    }

    renderNeeds(c.necesidades);
    document.getElementById("d-horarios").innerHTML = buildHorariosHtml(c.horarios);
    document.getElementById("d-contact").innerHTML = buildContactHtml(c.contacto);
    document.getElementById("d-org").textContent = c.organizadorNombre || "Anónimo";

    // Status + last update.
    var hasNeeds = c.necesidades && Object.keys(c.necesidades).length > 0;
    var statusEl = document.getElementById("d-status");
    var dotEl = document.getElementById("d-status-dot");
    statusEl.textContent = hasNeeds ? "Estado: Recibiendo Donaciones" : "Estado: Operativo";
    statusEl.className = "text-label-md font-label-md " + (hasNeeds ? "text-tertiary" : "text-primary");
    dotEl.className = "w-2 h-2 rounded-full animate-pulse " + (hasNeeds ? "bg-tertiary" : "bg-primary");
    document.getElementById("d-updated").textContent = "ACTUALIZADO " + relativeTime(latestUpdate(c));

    updateActions(c);
  }

  function renderNeeds(necesidades) {
    var ul = document.getElementById("d-needs");
    var title = document.getElementById("needs-title");
    var needs = necesidades ? Object.values(necesidades) : [];

    if (needs.length === 0) {
      title.innerHTML = '<span class="material-symbols-outlined text-[18px]">check_circle</span>SIN NECESIDADES URGENTES';
      title.className = "text-label-md font-label-md text-primary mb-xs flex items-center gap-2";
      ul.innerHTML = '<li class="text-body-md text-on-surface-variant p-sm">Este centro no tiene necesidades registradas actualmente.</li>';
      return;
    }

    title.innerHTML = '<span class="material-symbols-outlined text-[18px]">warning</span>NECESIDADES URGENTES';
    title.className = "text-label-md font-label-md text-tertiary mb-xs flex items-center gap-2";

    // Show up to 3 in the bento; the first is highlighted (most urgent).
    ul.innerHTML = needs.slice(0, 3).map(function (n, i) {
      var highlight = i === 0;
      var cls = highlight
        ? "bg-error-container text-on-error-container"
        : "bg-surface-container-low text-on-surface";
      return '<li class="flex items-center gap-3 p-sm rounded-lg ' + cls + '">' +
        '<span class="material-symbols-outlined">' + needIcon(n.nombre) + '</span>' +
        '<span class="text-label-md font-label-md">' + escapeHtml(n.nombre) + '</span></li>';
    }).join("");
  }

  function updateActions(c) {
    var el = document.getElementById("d-actions");
    if (!el) return;

    var isOwner = !usingMock && currentUser && c.organizadorId && currentUser.uid === c.organizadorId;
    var left =
      '<button id="btn-reportar" class="flex items-center gap-2 text-outline hover:text-tertiary transition-colors group">' +
      '<span class="material-symbols-outlined">flag</span>' +
      '<span class="font-label-md text-label-md">Reportar centro</span></button>';

    var right = '<a href="/" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant text-primary font-label-md text-label-md hover:bg-surface-container-low active:scale-95 transition-all">' +
      '<span class="material-symbols-outlined text-[18px]">arrow_back</span>Volver al mapa</a>';
    if (isOwner) {
      right += '<a href="/editar.html?id=' + centroId + '" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 active:scale-95 transition-all">' +
        '<span class="material-symbols-outlined text-[18px]">edit</span>Editar centro</a>';
    }

    el.innerHTML = left + '<div class="flex items-center gap-sm">' + right + '</div>';

    var reportBtn = document.getElementById("btn-reportar");
    if (reportBtn) {
      reportBtn.addEventListener("click", function () {
        if (usingMock) {
          alert("Esta es una vista de demostración. Selecciona un centro real desde el mapa para reportarlo.");
          return;
        }
        showModal(modalEl);
      });
    }
  }

  function buildContactHtml(contacto) {
    var html = "";
    if (contacto && contacto.telefono) {
      html +=
        '<a class="flex items-center justify-between w-full p-md bg-primary text-on-primary rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md group" href="tel:' + escapeHtml(contacto.telefono) + '">' +
          '<div class="flex items-center gap-4"><span class="material-symbols-outlined">call</span>' +
          '<div class="text-left"><p class="text-status-sm font-status-sm opacity-80 uppercase">Llamada directa</p>' +
          '<p class="text-body-lg font-bold">' + escapeHtml(contacto.telefono) + '</p></div></div>' +
          '<span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">chevron_right</span></a>';
    }
    if (contacto && contacto.whatsapp) {
      var wa = contacto.whatsapp.replace(/[^0-9+]/g, "").replace("+", "");
      html +=
        '<a class="flex items-center justify-between w-full p-md bg-[#25D366] text-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md group" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' +
          '<div class="flex items-center gap-4"><span class="material-symbols-outlined">chat</span>' +
          '<div class="text-left"><p class="text-status-sm font-status-sm opacity-80 uppercase">WhatsApp coordinación</p>' +
          '<p class="text-body-lg font-bold">' + escapeHtml(contacto.whatsapp) + '</p></div></div>' +
          '<span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">chevron_right</span></a>';
    }
    if (!html) {
      html = '<p class="p-md bg-surface-container-low rounded-xl text-on-surface-variant text-body-md">Sin información de contacto.</p>';
    }
    return html;
  }

  function buildHorariosHtml(horarios) {
    var DIAS = [
      { key: "lunes", label: "Lunes" },
      { key: "martes", label: "Martes" },
      { key: "miercoles", label: "Miércoles" },
      { key: "jueves", label: "Jueves" },
      { key: "viernes", label: "Viernes" },
      { key: "sabado", label: "Sábado" },
      { key: "domingo", label: "Domingo" }
    ];

    if (!horarios || Object.keys(horarios).length === 0) {
      return '<p class="p-md bg-surface-container-low rounded-xl text-on-surface-variant text-body-md">Sin horarios registrados.</p>';
    }

    return DIAS.filter(function (d) {
      var h = horarios[d.key];
      return h && h.desde && h.hasta;
    }).map(function (d) {
      var h = horarios[d.key];
      return '<div class="p-md bg-surface-container-low rounded-xl border border-outline-variant flex items-center gap-4">' +
        '<span class="material-symbols-outlined text-primary">schedule</span>' +
        '<div><p class="text-body-md font-bold text-on-surface">' + d.label + '</p>' +
        '<p class="text-body-md text-on-surface-variant">' + escapeHtml(h.desde) + ' - ' + escapeHtml(h.hasta) + '</p></div></div>';
    }).join("") ||
      '<p class="p-md bg-surface-container-low rounded-xl text-on-surface-variant text-body-md">Sin horarios registrados.</p>';
  }

  /* --------------------------- Modals --------------------------- */
  // Catálogo general de insumos para donantes. Lista de referencia fija
  // (no depende de las necesidades puntuales de cada centro).
  var INSUMOS_CATALOGO = [
    {
      titulo: "Prioridad Crítica",
      critica: true,
      categorias: [
        {
          emoji: "💧", label: "Agua y Alimentos",
          items: [
            "Agua potable (prioridad alta)", "Atún, sardinas y otros enlatados",
            "Arroz y Pasta", "Harina de maíz", "Avena y Leche en polvo",
            "Galletas y Barras energéticas", "Frutos secos y Compotas", "Fórmula infantil"
          ]
        },
        {
          emoji: "💊", label: "Insumos Médicos",
          items: [
            "Gasas estériles y Vendas", "Curitas y Esparadrapo", "Solución salina y Alcohol",
            "Clorhexidina o povidona yodada", "Guantes desechables y Mascarillas",
            "Paracetamol e Ibuprofeno", "Sales de rehidratación oral"
          ]
        }
      ]
    },
    {
      titulo: "Insumos sin prioridad",
      critica: false,
      categorias: [
        {
          emoji: "🧼", label: "Higiene Personal", text: "text-secondary", border: "border-l-secondary",
          items: [
            "Jabón y Pasta dental", "Cepillos dentales", "Papel higiénico",
            "Toallas sanitarias", "Pañales para bebés y adultos", "Toallitas húmedas", "Gel antibacterial"
          ]
        },
        {
          emoji: "🦺", label: "Para Rescatistas", text: "text-primary-container", border: "border-l-primary-container",
          items: ["Guantes de trabajo", "Mascarillas N95", "Protector solar", "Bebidas con electrolitos"]
        },
        {
          emoji: "🔦", label: "Equipos de Apoyo", text: "text-primary", border: "border-l-primary",
          items: ["Linternas y Pilas", "Power banks", "Palas y Herramientas manuales"]
        },
        {
          emoji: "⛺", label: "Refugio y Ropa", text: "text-secondary-container", border: "border-l-secondary-container",
          items: [
            "Ropa limpia en buen estado", "Ropa interior y medias (Nuevas)", "Zapatos cerrados",
            "Cobijas y Colchonetas", "Carpas y Lonas plásticas"
          ]
        },
        {
          emoji: "🐾", label: "Para Mascotas", text: "text-on-surface-variant", border: "border-l-outline", wide: true,
          items: ["Alimento seco para perros y gatos", "Alimento húmedo enlatado"]
        }
      ]
    }
  ];

  var needsModalBuilt = false;

  function openNeedsModal() {
    if (!needsModalBuilt) {
      var body = document.getElementById("modal-needs-body");
      body.innerHTML = INSUMOS_CATALOGO.map(buildNeedsSection).join("");
      needsModalBuilt = true;
    }
    showModal(needsModalEl);
  }

  function buildNeedsSection(section) {
    var header = section.critica
      ? '<div class="flex items-center gap-sm mb-sm">' +
        '<span class="material-symbols-outlined text-error">priority_high</span>' +
        '<h3 class="font-headline-md text-error uppercase tracking-wider">' + section.titulo + '</h3></div>'
      : '<h3 class="font-headline-md text-on-surface-variant uppercase tracking-wider mb-sm">' + section.titulo + '</h3>';

    var cards = section.categorias.map(function (cat) {
      return buildNeedsCard(cat, section.critica);
    }).join("");

    return '<section class="mb-lg last:mb-0">' + header +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-md">' + cards + '</div></section>';
  }

  function buildNeedsCard(cat, critical) {
    var borderClass = critical ? "border-l-4 border-l-error" : ("border-l-4 " + (cat.border || "border-l-outline"));
    var headClass = critical ? "text-primary" : (cat.text || "text-on-surface-variant");
    var wide = cat.wide ? " md:col-span-2" : "";

    var lis = cat.items.map(function (nombre) {
      return '<li class="flex items-start gap-xs"><span>•</span> ' + escapeHtml(nombre) + '</li>';
    }).join("");

    return '<article class="bg-surface-container-lowest border border-outline-variant rounded-xl p-md ' + borderClass + ' shadow-sm' + wide + '">' +
      '<div class="flex items-center gap-sm mb-md">' +
      '<span class="text-2xl">' + cat.emoji + '</span>' +
      '<h3 class="font-headline-md text-label-md uppercase tracking-wider ' + headClass + '">' + escapeHtml(cat.label) + '</h3>' +
      '</div>' +
      '<ul class="space-y-sm text-on-surface-variant font-body-md text-body-md">' + lis + '</ul>' +
      '</article>';
  }

  function setupNeedsModal() {
    var close = document.getElementById("btn-close-needs");
    if (close) close.addEventListener("click", function () { hideModal(needsModalEl); });
    needsModalEl.addEventListener("click", function (e) {
      if (e.target === needsModalEl) hideModal(needsModalEl);
    });
  }

  function setupReportModal() {
    var cancelBtn = document.getElementById("btn-cancel-report");
    var sendBtn = document.getElementById("btn-send-report");
    var motivoInput = document.getElementById("motivo-reporte");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        hideModal(modalEl);
        motivoInput.value = "";
      });
    }
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) hideModal(modalEl);
    });

    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        var motivo = motivoInput.value.trim();
        if (!motivo) {
          alert("Por favor describe el motivo del reporte.");
          return;
        }
        sendBtn.disabled = true;
        sendBtn.textContent = "Enviando...";

        var reporteData = {
          centroId: centroId,
          motivo: motivo,
          creadoEn: firebase.database.ServerValue.TIMESTAMP,
          reportadoPor: currentUser ? currentUser.uid : "anonimo"
        };

        db.ref("reportes").push(reporteData)
          .then(function () {
            return db.ref("centros/" + centroId + "/reportes").transaction(function (current) {
              return (current || 0) + 1;
            });
          })
          .then(function () {
            hideModal(modalEl);
            motivoInput.value = "";
            alert("Reporte enviado. Gracias por tu colaboración.");
          })
          .catch(function (error) {
            alert("Error al enviar reporte: " + error.message);
          })
          .finally(function () {
            sendBtn.disabled = false;
            sendBtn.textContent = "Enviar reporte";
          });
      });
    }
  }

  function showModal(el) {
    el.classList.remove("hidden");
    el.classList.add("flex");
  }
  function hideModal(el) {
    el.classList.add("hidden");
    el.classList.remove("flex");
  }

  /* --------------------------- Helpers --------------------------- */
  function latestUpdate(c) {
    var t = c.creadoEn || 0;
    if (c.necesidades) {
      Object.values(c.necesidades).forEach(function (n) {
        if (n.agregado && n.agregado > t) t = n.agregado;
      });
    }
    return t;
  }

  function relativeTime(ts) {
    if (!ts) return "RECIENTEMENTE";
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var min = Math.floor(diff / 60000);
    if (min < 1) return "HACE UN MOMENTO";
    if (min < 60) return "HACE " + min + " MIN";
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return "HACE " + hrs + " H";
    var days = Math.floor(hrs / 24);
    return "HACE " + days + " D";
  }

  function needIcon(name) {
    var s = (name || "").toLowerCase();
    if (/agua/.test(s)) return "water_drop";
    if (/medic|farmac|antibi|gasa|medica/.test(s)) return "medication";
    if (/sangre/.test(s)) return "bloodtype";
    if (/ropa|abrigo|frio|fr\u00edo/.test(s)) return "checkroom";
    if (/aliment|comida|pereced|enlatad/.test(s)) return "restaurant";
    if (/pa\u00f1al|bebe|beb\u00e9|infant/.test(s)) return "child_care";
    if (/higien|jab|aseo/.test(s)) return "soap";
    if (/voluntar/.test(s)) return "volunteer_activism";
    return "inventory_2";
  }

  function buildAddressString(dir) {
    if (!dir) return "Sin dirección registrada";
    var parts = [];
    if (dir.calle) parts.push(dir.calle);
    if (dir.piso) parts.push(dir.piso);
    if (dir.ciudad) parts.push(dir.ciudad);
    if (dir.estado) parts.push(dir.estado);
    return parts.join(", ") || "Sin dirección registrada";
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
