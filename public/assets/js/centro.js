/*
 * Acopify - Centro detail page with real-time needs updates
 */

(function () {
  var contentEl = document.getElementById("centro-content");
  var modalEl = document.getElementById("modal-reportar");

  var params = new URLSearchParams(window.location.search);
  var centroId = params.get("id");

  if (!centroId) {
    contentEl.innerHTML =
      '<div class="empty-state">' +
      '<p>Centro no encontrado.</p>' +
      '<a href="/" class="btn btn-primary">Volver al mapa</a>' +
      '</div>';
    return;
  }

  var centroRef = db.ref("centros/" + centroId);

  // Real-time listener
  centroRef.on("value", function (snapshot) {
    var centro = snapshot.val();
    if (!centro) {
      contentEl.innerHTML =
        '<div class="empty-state">' +
        '<p>Este centro de acopio no existe o fue eliminado.</p>' +
        '<a href="/" class="btn btn-primary">Volver al mapa</a>' +
        '</div>';
      return;
    }
    renderCentro(centroId, centro);
  });

  function renderCentro(id, c) {
    var addressStr = buildAddressString(c.direccion);
    var needs = c.necesidades ? Object.entries(c.necesidades) : [];
    var isOwner = currentUser && currentUser.uid === c.organizadorId;

    // Needs HTML
    var needsHtml = "";
    if (needs.length > 0) {
      needsHtml = '<div class="needs-list">';
      needs.forEach(function (entry) {
        needsHtml += '<span class="tag tag-warning">' + escapeHtml(entry[1].nombre) + '</span>';
      });
      needsHtml += '</div>';
    } else {
      needsHtml = '<p class="needs-empty">Este centro no tiene necesidades registradas actualmente.</p>';
    }

    // Contact HTML
    var contactHtml = '<ul class="detail-contact">';
    if (c.contacto && c.contacto.telefono) {
      contactHtml += '<li>📞 <a href="tel:' + escapeHtml(c.contacto.telefono) + '">' + escapeHtml(c.contacto.telefono) + '</a></li>';
    }
    if (c.contacto && c.contacto.whatsapp) {
      var waNumber = c.contacto.whatsapp.replace(/[^0-9+]/g, "");
      contactHtml += '<li>💬 <a href="https://wa.me/' + waNumber.replace("+", "") + '" target="_blank" rel="noopener">WhatsApp: ' + escapeHtml(c.contacto.whatsapp) + '</a></li>';
    }
    if (!c.contacto || (!c.contacto.telefono && !c.contacto.whatsapp)) {
      contactHtml += '<li style="color: var(--color-text-light);">Sin informacion de contacto</li>';
    }
    contactHtml += '</ul>';

    // Actions
    var actionsHtml = '<div class="detail-actions">';
    actionsHtml += '<a href="/" class="btn btn-secondary">&#8592; Volver al mapa</a>';
    if (isOwner) {
      actionsHtml += '<a href="/editar?id=' + id + '" class="btn btn-primary">Editar centro</a>';
    }
    actionsHtml += '<button class="btn btn-sm btn-secondary" id="btn-reportar">Reportar</button>';
    actionsHtml += '</div>';

    var html =
      '<div class="detail-header">' +
      '<h1>' + escapeHtml(c.nombre) + '</h1>' +
      '<p class="detail-address">' + escapeHtml(addressStr) + '</p>' +
      '</div>' +

      actionsHtml +

      (c.descripcion ? '<div class="detail-section"><p>' + escapeHtml(c.descripcion) + '</p></div>' : '') +

      '<div class="detail-section">' +
      '<h2>Ubicacion</h2>' +
      '<div class="detail-map" id="detail-map"></div>' +
      '</div>' +

      '<div class="detail-section">' +
      '<h2>Necesidades actuales</h2>' +
      needsHtml +
      '</div>' +

      '<div class="detail-section">' +
      '<h2>Contacto</h2>' +
      contactHtml +
      '</div>' +

      '<div class="detail-section" style="font-size: 0.8125rem; color: var(--color-text-light);">' +
      '<p>Organizado por: ' + escapeHtml(c.organizadorNombre || "Anonimo") + '</p>' +
      '</div>';

    contentEl.innerHTML = html;
    document.title = escapeHtml(c.nombre) + " - Acopify";

    // Init detail map
    if (c.coordenadas) {
      var detailMap = L.map("detail-map", { scrollWheelZoom: false }).setView([c.coordenadas.lat, c.coordenadas.lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(detailMap);
      L.marker([c.coordenadas.lat, c.coordenadas.lng]).addTo(detailMap);
    }

    // Report button
    var reportBtn = document.getElementById("btn-reportar");
    if (reportBtn) {
      reportBtn.addEventListener("click", function () {
        modalEl.classList.remove("hidden");
      });
    }

    setupReportModal(id);
  }

  function setupReportModal(centroId) {
    var cancelBtn = document.getElementById("btn-cancel-report");
    var sendBtn = document.getElementById("btn-send-report");
    var motivoInput = document.getElementById("motivo-reporte");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        modalEl.classList.add("hidden");
        motivoInput.value = "";
      });
    }

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
            modalEl.classList.add("hidden");
            motivoInput.value = "";
            alert("Reporte enviado. Gracias por tu colaboracion.");
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

  function buildAddressString(dir) {
    if (!dir) return "";
    var parts = [];
    if (dir.calle) parts.push(dir.calle);
    if (dir.piso) parts.push(dir.piso);
    if (dir.ciudad) parts.push(dir.ciudad);
    if (dir.estado) parts.push(dir.estado);
    return parts.join(", ");
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
