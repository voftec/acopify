/*
 * Acopify - Generador de "historia" 9:16 para compartir un centro de acopio.
 *
 * Dibuja una imagen 1080x1920 (formato historia de Instagram/WhatsApp) en un
 * <canvas>: mapa del centro como fondo (tiles de CartoDB Voyager, con CORS para
 * poder exportar el PNG), degradado azul oscuro inferior, marcador rojo, badge
 * "Acopify" arriba a la derecha y, abajo, nombre + dirección + país/estado.
 *
 * Se usan tiles de CartoDB (no los de OSM que usa el mapa de detalle) porque
 * envían cabeceras CORS; con OSM el canvas quedaría "tainted" y toBlob() fallaría.
 *
 * API: window.AcopifyStory.open(centro, { id })
 * Si se pasa `id`, se copia al portapapeles el enlace directo a la vista de
 * detalle del centro (https://www.acopify.com/centro?id=...) y se muestra una
 * confirmación dentro del modal.
 */
(function () {
  var W = 1080, H = 1920;
  // Zona segura: 250px de margen arriba y abajo (UI 2026 de historias).
  var SAFE_TOP = 250, SAFE_BOTTOM = H - 250; // 250 .. 1670
  var MARGIN = 72;
  var MAP_ZOOM = 15;     // zoom base de los tiles (entero)
  var MAP_SCALE = 1.35;  // ~35% más cerca (zoom efectivo ~15.43)

  var STAR_PATH = "M20.79 9.23l-2-3.46L14 8.54V3h-4v5.54L5.21 5.77l-2 3.46L8 12l-4.79 2.77l2 3.46L10 15.46V21h4v-5.54l4.79 2.77l2-3.46L16 12z";
  var BLUE = "#004ac6";
  var DARK = "2,18,52"; // rgb base del degradado
  var SHARE_BASE = "https://www.acopify.com"; // dominio canónico para enlaces

  /* ----------------------------- Tiles / mapa ----------------------------- */
  function lngToTileX(lng, z) { return (lng + 180) / 360 * Math.pow(2, z); }
  function latToTileY(lat, z) {
    var r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  // Dibuja el mapa centrado en (lat,lng) sobre el canvas completo.
  // `scale` permite un zoom fraccional (p.ej. 1.35 = ~35% más cerca) dibujando
  // los tiles más grandes que su tamaño nominal de 256px.
  function drawMap(ctx, lat, lng, zoom, scale) {
    scale = scale || 1;
    var n = Math.pow(2, zoom);
    var TS = 256 * scale; // huella de cada tile en el canvas
    var centerPxX = lngToTileX(lng, zoom) * TS;
    var centerPxY = latToTileY(lat, zoom) * TS;
    var originX = centerPxX - W / 2;
    var originY = centerPxY - H / 2;

    var txMin = Math.floor(originX / TS);
    var txMax = Math.floor((originX + W) / TS);
    var tyMin = Math.floor(originY / TS);
    var tyMax = Math.floor((originY + H) / TS);

    var subs = ["a", "b", "c", "d"];
    var jobs = [];
    for (var tx = txMin; tx <= txMax; tx++) {
      for (var ty = tyMin; ty <= tyMax; ty++) {
        if (ty < 0 || ty >= n) continue;
        var wx = ((tx % n) + n) % n; // envuelve horizontalmente
        var dx = Math.round(tx * TS - originX);
        var dy = Math.round(ty * TS - originY);
        var s = subs[(Math.abs(tx) + Math.abs(ty)) % subs.length];
        var url = "https://" + s + ".basemaps.cartocdn.com/rastertiles/voyager/" +
          zoom + "/" + wx + "/" + ty + "@2x.png";
        jobs.push({ url: url, dx: dx, dy: dy });
      }
    }

    return Promise.all(jobs.map(function (j) { return loadImage(j.url); }))
      .then(function (imgs) {
        // Relleno base por si algún tile falla.
        ctx.fillStyle = "#eef2ff";
        ctx.fillRect(0, 0, W, H);
        // +1px de solapado para evitar costuras al escalar (TS fraccional).
        var drawSize = Math.ceil(TS) + 1;
        imgs.forEach(function (img, i) {
          if (img) ctx.drawImage(img, jobs[i].dx, jobs[i].dy, drawSize, drawSize);
        });
      });
  }

  /* ------------------------------- Dibujo UI ------------------------------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function teardrop(ctx, cx, tipY, R) {
    var cyHead = tipY - R * 2.55;
    ctx.beginPath();
    ctx.arc(cx, cyHead, R, Math.PI, 0, false); // semicírculo superior
    ctx.quadraticCurveTo(cx + R * 0.62, cyHead + (tipY - cyHead) * 0.55, cx, tipY);
    ctx.quadraticCurveTo(cx - R * 0.62, cyHead + (tipY - cyHead) * 0.55, cx - R, cyHead);
    ctx.closePath();
    return cyHead;
  }

  // Marcador rojo con contorno blanco uniforme (borde centrado en el trazo) y
  // punto blanco interior. La punta apunta exactamente a (cx, tipY).
  function drawPin(ctx, cx, tipY) {
    var R = 44;
    // Relleno rojo (con sombra).
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    var cyHead = teardrop(ctx, cx, tipY, R);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.restore();
    // Contorno blanco uniforme alrededor de la misma silueta.
    teardrop(ctx, cx, tipY, R);
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    // Punto interior blanco.
    ctx.beginPath();
    ctx.arc(cx, cyHead, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  function drawBadge(ctx) {
    var icon = 58, gap = 16, padX = 30, padY = 22;
    ctx.font = "800 46px Inter, sans-serif";
    var label = "Acopify";
    var textW = ctx.measureText(label).width;
    var w = padX + icon + gap + textW + padX;
    var h = icon + padY * 2;
    var x = W - MARGIN - w;
    var y = SAFE_TOP;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = BLUE;
    ctx.fill();
    ctx.restore();

    // Estrella (favicon) en blanco
    ctx.save();
    ctx.translate(x + padX, y + padY);
    ctx.scale(icon / 24, icon / 24);
    ctx.fillStyle = "#ffffff";
    ctx.fill(new Path2D(STAR_PATH));
    ctx.restore();

    // Texto
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 46px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label, x + padX + icon + gap, y + h / 2 + 2);
  }

  function drawGradient(ctx) {
    var g = ctx.createLinearGradient(0, H * 0.42, 0, H);
    g.addColorStop(0, "rgba(" + DARK + ",0)");
    g.addColorStop(0.5, "rgba(" + DARK + ",0.78)");
    g.addColorStop(1, "rgba(" + DARK + ",0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function wrapText(ctx, text, maxW) {
    var words = (text || "").split(/\s+/);
    var lines = [], line = "";
    words.forEach(function (word) {
      var test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawText(ctx, centro) {
    var maxW = W - MARGIN * 2;
    var x = MARGIN;
    var bottom = SAFE_BOTTOM - 30;

    // País – Estado (línea inferior)
    var dir = centro.direccion || {};
    var geo = [];
    if (dir.estado) geo.push(dir.estado);
    geo.push(dir.pais || "Venezuela");
    var geoLine = geo.join("  \u00B7  ").toUpperCase();

    var address = buildAddressString(dir);
    var name = centro.nombre || "Centro de acopio";

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Medir bloques de abajo hacia arriba.
    ctx.font = "700 34px Inter, sans-serif";
    var geoH = 34;

    ctx.font = "500 40px Inter, sans-serif";
    var addrLines = wrapText(ctx, address, maxW).slice(0, 3);
    var addrLH = 52;

    ctx.font = "800 88px Inter, sans-serif";
    var nameLines = wrapText(ctx, name, maxW).slice(0, 3);
    var nameLH = 96;

    // Posiciones (baseline) calculadas desde abajo.
    var y = bottom;

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 34px Inter, sans-serif";
    ctx.fillText(geoLine, x, y);
    y -= geoH + 22;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "500 40px Inter, sans-serif";
    for (var i = addrLines.length - 1; i >= 0; i--) {
      ctx.fillText(addrLines[i], x, y);
      y -= addrLH;
    }
    y -= 16;

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 88px Inter, sans-serif";
    for (var j = nameLines.length - 1; j >= 0; j--) {
      ctx.fillText(nameLines[j], x, y);
      y -= nameLH;
    }
  }

  function buildAddressString(dir) {
    if (!dir) return "";
    var parts = [];
    if (dir.calle) parts.push(dir.calle);
    if (dir.barrio) parts.push(dir.barrio);
    if (dir.sector && dir.sector !== dir.barrio) parts.push(dir.sector);
    if (dir.ciudad) parts.push(dir.ciudad);
    if (dir.municipio) parts.push("Mun. " + dir.municipio);
    return parts.join(", ");
  }

  /* ------------------------------- Render ------------------------------- */
  function render(centro) {
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    var coords = centro.coordenadas || {};
    var lat = typeof coords.lat === "number" ? coords.lat : 10.4806;
    var lng = typeof coords.lng === "number" ? coords.lng : -66.9036;

    var fontsReady = (document.fonts && document.fonts.ready) ?
      document.fonts.ready.catch(function () {}) : Promise.resolve();

    return Promise.all([drawMap(ctx, lat, lng, MAP_ZOOM, MAP_SCALE), fontsReady]).then(function () {
      drawGradient(ctx);
      drawPin(ctx, W / 2, H / 2);
      drawBadge(ctx);
      drawText(ctx, centro);
      return new Promise(function (resolve, reject) {
        try {
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob); else reject(new Error("toBlob vacío"));
          }, "image/png");
        } catch (e) { reject(e); }
      });
    });
  }

  /* ----------------------------- Enlace / copiar ----------------------------- */
  function buildLink(opts) {
    var id = opts && opts.id;
    if (!id) return "";
    return SHARE_BASE + "/centro?id=" + encodeURIComponent(id);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyToClipboard(text) {
    return new Promise(function (resolve) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { resolve(true); },
          function () { resolve(fallbackCopy(text)); }
        );
      } else {
        resolve(fallbackCopy(text));
      }
    });
  }

  /* ------------------------------- Modal/UI ------------------------------- */
  var overlay = null;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);padding:16px;font-family:'Inter',sans-serif;";
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  function close() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  var COPY_TOAST_MSG = "Un link del centro de acopio fue copiado. Comparte la imagen y pega el link directo al centro de acopio.";
  var activeToast = null;

  // Toast efímero (se desvanece a los 5s) sobre el modal.
  function showToast(msg) {
    if (activeToast && activeToast.parentNode) activeToast.parentNode.removeChild(activeToast);
    var t = document.createElement("div");
    t.style.cssText =
      "position:fixed;left:50%;top:24px;transform:translateX(-50%) translateY(-8px);z-index:3100;" +
      "max-width:360px;width:calc(100% - 32px);background:#0f172a;color:#fff;padding:13px 16px;" +
      "border-radius:14px;font:600 14px/1.45 'Inter',sans-serif;box-shadow:0 12px 34px rgba(0,0,0,0.4);" +
      "display:flex;gap:10px;align-items:flex-start;opacity:0;transition:opacity .25s,transform .25s;";
    t.innerHTML = '<span style="font-size:16px;line-height:1.3;flex-shrink:0;">\u2713</span><span>' + msg + '</span>';
    document.body.appendChild(t);
    activeToast = t;
    requestAnimationFrame(function () {
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(function () {
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(-8px)";
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
        if (activeToast === t) activeToast = null;
      }, 300);
    }, 5000);
  }

  function spinnerCard() {
    return '<div style="background:#fff;border-radius:24px;padding:48px 40px;max-width:360px;text-align:center;">' +
      '<img src="/favicon.svg" alt="" style="width:40px;height:40px;animation:acpspin 1s linear infinite;margin:0 auto 18px;display:block;" />' +
      '<p style="color:#0f172a;font-weight:600;font-size:17px;margin:0;">Generando tu historia...</p>' +
      '<p style="color:#64748b;font-size:14px;margin:8px 0 0;">Cargando el mapa del centro</p>' +
      '<style>@keyframes acpspin{to{transform:rotate(360deg)}}</style></div>';
  }

  // Chip de confirmación del enlace copiado. `copied` indica si la copia
  // automática al abrir tuvo éxito; al hacer clic se vuelve a copiar.
  function copyChip(link, copied) {
    var chip = document.createElement("button");
    chip.style.cssText =
      "display:flex;align-items:center;gap:8px;width:100%;margin-bottom:12px;border:1px solid;" +
      "padding:11px 14px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;text-align:left;" +
      "transition:background .15s;";
    function paint(ok) {
      if (ok) {
        chip.style.background = "#ecfdf5";
        chip.style.borderColor = "#a7f3d0";
        chip.style.color = "#047857";
        chip.innerHTML = '<span style="font-size:18px;line-height:1;">\u2713</span>' +
          '<span>Link directo al centro de acopio, copiado</span>';
      } else {
        chip.style.background = "#eff6ff";
        chip.style.borderColor = "#bfdbfe";
        chip.style.color = BLUE;
        chip.innerHTML = '<span style="font-size:17px;line-height:1;">\uD83D\uDD17</span>' +
          '<span>Copiar enlace directo al centro</span>';
      }
    }
    paint(copied);
    chip.addEventListener("click", function () {
      copyToClipboard(link).then(function (ok) {
        paint(ok);
        if (ok) showToast(COPY_TOAST_MSG);
      });
    });
    return chip;
  }

  function resultCard(url, blob, centro, link, copied) {
    var card = document.createElement("div");
    card.style.cssText =
      "background:#fff;border-radius:24px;padding:16px;max-width:380px;width:100%;max-height:92vh;" +
      "display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.4);";
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px 12px;">' +
        '<p style="margin:0;font-weight:800;font-size:18px;color:#0f172a;">Compartir historia</p>' +
        '<button id="acp-close" aria-label="Cerrar" style="border:none;background:#f1f5f9;width:36px;height:36px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;color:#334155;">&times;</button>' +
      '</div>' +
      '<img src="' + url + '" alt="Vista previa" style="width:100%;border-radius:14px;object-fit:contain;flex:1;min-height:0;border:1px solid #e2e8f0;margin-bottom:14px;" />' +
      '<div id="acp-chip-slot"></div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button id="acp-share" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border:none;background:' + BLUE + ';color:#fff;font-weight:700;font-size:16px;padding:14px;border-radius:12px;cursor:pointer;">Compartir</button>' +
        '<a id="acp-download" download="acopify-centro.png" href="' + url + '" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid ' + BLUE + ';color:' + BLUE + ';font-weight:700;font-size:16px;padding:14px;border-radius:12px;text-decoration:none;">Descargar</a>' +
      '</div>';

    card.querySelector("#acp-close").addEventListener("click", close);

    // Inserta el chip de "copiado" sólo cuando hay un enlace (id conocido).
    if (link) card.querySelector("#acp-chip-slot").appendChild(copyChip(link, copied));

    var shareBtn = card.querySelector("#acp-share");
    var canShareFiles = false;
    try {
      var probe = new File([blob], "acopify-centro.png", { type: "image/png" });
      canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch (e) { canShareFiles = false; }

    if (!canShareFiles) {
      // Sin Web Share de archivos: el botón principal descarga (y reafirma copia).
      shareBtn.textContent = "Descargar imagen";
      shareBtn.addEventListener("click", function () {
        if (link) copyToClipboard(link);
        card.querySelector("#acp-download").click();
      });
    } else {
      shareBtn.addEventListener("click", function () {
        if (link) copyToClipboard(link);
        var file = new File([blob], "acopify-centro.png", { type: "image/png" });
        var data = {
          files: [file],
          title: centro.nombre || "Centro de acopio",
          text: "Centro de acopio en Acopify"
        };
        if (link) data.url = link;
        navigator.share(data).catch(function () {});
      });
    }

    return card;
  }

  function open(centro, opts) {
    if (!centro) return;
    opts = opts || {};
    if (overlay) close();

    // Copiar el enlace directo durante el gesto del usuario (más fiable).
    var link = buildLink(opts);
    var copyPromise = link ? copyToClipboard(link) : Promise.resolve(false);

    buildOverlay();
    overlay.innerHTML = spinnerCard();

    if (typeof logAnalyticsEvent === "function") {
      logAnalyticsEvent("share", {
        method: "historia_9_16",
        centro_nombre: centro.nombre || "Desconocido"
      });
    }

    Promise.all([render(centro), copyPromise]).then(function (results) {
      if (!overlay) return; // cerrado mientras cargaba
      var blob = results[0];
      var copied = results[1];
      var url = URL.createObjectURL(blob);
      overlay.innerHTML = "";
      overlay.appendChild(resultCard(url, blob, centro, link, copied));
      if (link && copied) showToast(COPY_TOAST_MSG);
    }).catch(function (err) {
      console.error("No se pudo generar la historia:", err);
      if (!overlay) return;
      overlay.innerHTML =
        '<div style="background:#fff;border-radius:24px;padding:40px 32px;max-width:340px;text-align:center;">' +
        '<p style="color:#0f172a;font-weight:700;font-size:17px;margin:0 0 8px;">No se pudo generar la imagen</p>' +
        '<p style="color:#64748b;font-size:14px;margin:0 0 20px;">Revisa tu conexión e inténtalo de nuevo.</p>' +
        '<button id="acp-err-close" style="border:none;background:' + BLUE + ';color:#fff;font-weight:700;font-size:15px;padding:12px 28px;border-radius:12px;cursor:pointer;">Cerrar</button></div>';
      var b = document.getElementById("acp-err-close");
      if (b) b.addEventListener("click", close);
    });
  }

  window.AcopifyStory = { open: open };
})();
