/*
 * Acopify - My centros dashboard
 */

(function () {
  var container = document.getElementById("centros-container");
  var authRequired = document.getElementById("auth-required");

  auth.onAuthStateChanged(function (user) {
    if (user) {
      authRequired.classList.add("hidden");
      loadMyCentros(user.uid);
    } else {
      authRequired.classList.remove("hidden");
      container.innerHTML = "";
    }
  });

  function loadMyCentros(uid) {
    db.ref("centros")
      .orderByChild("organizadorId")
      .equalTo(uid)
      .on("value", function (snapshot) {
        var centros = snapshot.val();
        renderCentros(centros);
      });
  }

  function renderCentros(centros) {
    if (!centros || Object.keys(centros).length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-state-icon">📦</div>' +
        '<p>No tienes centros de acopio registrados.</p>' +
        '<a href="/registro" class="btn btn-primary">Registrar uno ahora</a>' +
        '</div>';
      return;
    }

    var html = '<div class="my-centros-list">';
    Object.keys(centros).forEach(function (id) {
      var c = centros[id];
      var needs = c.necesidades ? Object.keys(c.necesidades).length : 0;
      html +=
        '<div class="my-centro-card">' +
        '<div>' +
        '<div class="centro-card-name">' + escapeHtml(c.nombre) + '</div>' +
        '<div class="centro-card-address">' + escapeHtml(buildAddressString(c.direccion)) + '</div>' +
        '<span class="tag tag-warning" style="margin-top: 4px;">' + needs + ' necesidades</span>' +
        '</div>' +
        '<div class="my-centro-actions">' +
        '<a href="/centro?id=' + id + '" class="btn btn-sm btn-secondary">Ver</a>' +
        '<a href="/editar?id=' + id + '" class="btn btn-sm btn-primary">Editar</a>' +
        '<button class="btn btn-sm btn-danger btn-delete" data-id="' + id + '" data-name="' + escapeHtml(c.nombre) + '">Eliminar</button>' +
        '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    // Delete buttons
    container.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var centroId = btn.getAttribute("data-id");
        var nombre = btn.getAttribute("data-name");
        if (confirm('Estas seguro que deseas eliminar "' + nombre + '"? Esta accion no se puede deshacer.')) {
          db.ref("centros/" + centroId).remove()
            .catch(function (error) {
              alert("Error al eliminar: " + error.message);
            });
        }
      });
    });
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
