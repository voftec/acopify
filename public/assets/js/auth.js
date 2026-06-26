/*
 * Acopify - Auth state management (shared across pages)
 */

var currentUser = null;

auth.onAuthStateChanged(function (user) {
  currentUser = user;
  updateNavAuth(user);
});

function updateNavAuth(user) {
  var navActions = document.getElementById("nav-actions");
  if (!navActions) return;

  if (user) {
    var displayName = user.displayName || user.email.split("@")[0];
    navActions.innerHTML =
      '<a href="/mis-centros" class="nav-link">Mis centros</a>' +
      '<a href="/registro" class="nav-link">+ Registrar</a>' +
      '<span class="nav-user">' + escapeHtml(displayName) + '</span>' +
      '<a href="#" class="nav-link" id="btn-logout">Salir</a>';
    var logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function (e) {
        e.preventDefault();
        auth.signOut().then(function () {
          window.location.href = "/";
        });
      });
    }
  } else {
    navActions.innerHTML = '<a href="/login" class="nav-link" id="nav-login">Iniciar sesion</a>';
  }
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
