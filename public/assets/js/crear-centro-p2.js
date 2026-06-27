/*
 * Acopify - Crear Centro de Acopio - Pantalla 2 (Mapa con ubicación exacta)
 */

(function () {
  // Check if Firebase is properly initialized
  if (!db || !auth) {
    console.error("Firebase not initialized in crear-centro-p2.js");
    return;
  }

  var map;
  var selectedLat = null;
  var selectedLng = null;
  var formData = null;
  var currentUser = null;
  
  // DOM Elements
  var loadingOverlay = document.getElementById("loading-overlay");
  var locationRequest = document.getElementById("location-request");
  var coordDisplay = document.getElementById("coord-display");
  var btnConfirmar = document.getElementById("btn-confirmar");
  var btnCancelar = document.getElementById("btn-cancelar");
  var btnAllowLocation = document.getElementById("btn-allow-location");
  var btnSkipLocation = document.getElementById("btn-skip-location");
  var btnMyLocation = document.getElementById("btn-my-location");
  var btnLayers = document.getElementById("btn-layers");

  // Venezuela center (Caracas)
  var VZ_CENTER = [10.4806, -66.9036];
  var VZ_ZOOM = 15;

  // Check if we have form data from step 1
  var savedFormData = sessionStorage.getItem("crearCentroFormData");
  if (!savedFormData) {
    alert("No se encontraron datos del formulario. Por favor comienza desde el primer paso.");
    window.location.href = "/crear-centro-p1.html";
    return;
  }
  
  try {
    formData = JSON.parse(savedFormData);
  } catch (e) {
    alert("Error al cargar los datos del formulario. Por favor comienza desde el primer paso.");
    window.location.href = "/crear-centro-p1.html";
    return;
  }

  // Initialize map
  function initMap(startLocation) {
    var startLat = startLocation ? startLocation[0] : VZ_CENTER[0];
    var startLng = startLocation ? startLocation[1] : VZ_CENTER[1];
    
    map = L.map("map", {
      center: [startLat, startLng],
      zoom: VZ_ZOOM,
      zoomControl: false // We'll add custom zoom control
    });

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // Add zoom control to top-right
    L.control.zoom({
      position: 'topright'
    }).addTo(map);

    // Set initial coordinates
    selectedLat = startLat;
    selectedLng = startLng;
    updateCoordsDisplay();

    // Update coordinates when map moves
    map.on("move", function () {
      var center = map.getCenter();
      selectedLat = center.lat;
      selectedLng = center.lng;
      updateCoordsDisplay();
    });

    // Hide loading overlay
    loadingOverlay.classList.add("hidden");
  }

  // Update coordinates display
  function updateCoordsDisplay() {
    if (selectedLat !== null && selectedLng !== null) {
      var latDir = selectedLat >= 0 ? "N" : "S";
      var lngDir = selectedLng >= 0 ? "E" : "W";
      coordDisplay.textContent = Math.abs(selectedLat).toFixed(4) + "° " + latDir + ", " + Math.abs(selectedLng).toFixed(4) + "° " + lngDir;
    }
  }

  // Request location permission
  function requestLocation() {
    if (!navigator.geolocation) {
      // Geolocation not supported, skip to map init
      initMap();
      return;
    }

    locationRequest.classList.remove("hidden");
  }

  // Allow location button
  btnAllowLocation.addEventListener("click", function () {
    btnAllowLocation.disabled = true;
    btnAllowLocation.textContent = "Obteniendo ubicación...";

    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        
        locationRequest.classList.add("hidden");
        initMap([lat, lng]);
        
        // Vibrate for feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      },
      function (error) {
        var errorMsg = "No se pudo obtener tu ubicación.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Permiso de ubicación denegado.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Ubicación no disponible.";
            break;
          case error.TIMEOUT:
            errorMsg = "Tiempo de espera agotado.";
            break;
        }
        
        alert(errorMsg + " Se usará la ubicación predeterminada.");
        locationRequest.classList.add("hidden");
        initMap();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });

  // Skip location button
  btnSkipLocation.addEventListener("click", function () {
    locationRequest.classList.add("hidden");
    initMap();
  });

  // My location button
  btnMyLocation.addEventListener("click", function () {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }

    btnMyLocation.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        
        map.setView([lat, lng], 17);
        
        // Vibrate for feedback
        if (navigator.vibrate) {
          navigator.vibrate([50, 100, 50]);
        }
        
        btnMyLocation.disabled = false;
      },
      function (error) {
        alert("No se pudo obtener tu ubicación actual.");
        btnMyLocation.disabled = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });

  // Layers button (toggle between different map styles)
  var currentLayer = 0;
  var layers = [
    {
      name: "Standard",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    {
      name: "Satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
    }
  ];

  btnLayers.addEventListener("click", function () {
    currentLayer = (currentLayer + 1) % layers.length;
    
    // Remove all tile layers
    map.eachLayer(function (layer) {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });
    
    // Add new tile layer
    L.tileLayer(layers[currentLayer].url, {
      attribution: layers[currentLayer].attribution,
      maxZoom: 19
    }).addTo(map);
    
    // Vibrate for feedback
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  });

  // Cancel button
  btnCancelar.addEventListener("click", function () {
    if (confirm("¿Estás seguro de que deseas cancelar? Los datos ingresados se perderán.")) {
      sessionStorage.removeItem("crearCentroFormData");
      window.location.href = "/mis-centros.html";
    }
  });

  // Confirm location button
  btnConfirmar.addEventListener("click", function () {
    if (selectedLat === null || selectedLng === null) {
      alert("Por favor selecciona una ubicación en el mapa.");
      return;
    }

    // Vibrate for feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Show loading state
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="material-symbols-outlined animate-spin" data-icon="progress_activity">progress_activity</span> PROCESANDO...';

    // Check auth
    if (!currentUser) {
      alert("Debes iniciar sesión para crear un centro de acopio.");
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = 'CONFIRMAR UBICACIÓN EXACTA <span class="material-symbols-outlined" data-icon="check_circle">check_circle</span>';
      window.location.href = "/login.html";
      return;
    }

    // Prepare data for Firebase
    var centroData = {
      nombre: formData.nombre,
      descripcion: formData.descripcion,
      direccion: formData.direccion,
      coordenadas: {
        lat: selectedLat,
        lng: selectedLng
      },
      contacto: formData.contacto,
      horarios: formData.horarios || {},
      organizadorId: currentUser.uid,
      organizadorNombre: currentUser.displayName || (currentUser.email && currentUser.email.split("@")[0]) || "Usuario",
      creadoEn: firebase.database.ServerValue.TIMESTAMP,
      reportes: 0
    };

    // Build needs object
    var necesidades = {};
    if (formData.necesidades && formData.necesidades.length > 0) {
      formData.necesidades.forEach(function (n) {
        var key = db.ref().push().key;
        necesidades[key] = {
          nombre: n,
          agregado: firebase.database.ServerValue.TIMESTAMP
        };
      });
    }
    centroData.necesidades = necesidades;

    // Save to Firebase
    var newRef = db.ref("centros").push();
    newRef.set(centroData)
      .then(function () {
        if (typeof logAnalyticsEvent === 'function') {
          logAnalyticsEvent("add_centro_de_acopio", {
            nombre: centroData.nombre,
            estado: (centroData.direccion && centroData.direccion.estado) ? centroData.direccion.estado : "Desconocido",
            necesidades_count: centroData.necesidades ? Object.keys(centroData.necesidades).length : 0
          });
        }

        // Clear session storage
        sessionStorage.removeItem("crearCentroFormData");
        
        // Show success state
        btnConfirmar.innerHTML = '<span class="material-symbols-outlined" data-icon="check_circle">check_circle</span> UBICACIÓN FIJADA';
        btnConfirmar.classList.replace('bg-primary-container', 'bg-tertiary-container');
        
        // Vibrate success pattern
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        
        // Redirect to mis centros page
        setTimeout(function () {
          window.location.href = "/mis-centros.html";
        }, 1000);
      })
      .catch(function (error) {
        alert("Error al registrar el centro: " + error.message);
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = 'CONFIRMAR UBICACIÓN EXACTA <span class="material-symbols-outlined" data-icon="check_circle">check_circle</span>';
      });
  });

  // Initialize on page load
  document.addEventListener("DOMContentLoaded", function () {
    // Check auth state
    auth.onAuthStateChanged(function (user) {
      currentUser = user;
      if (!user) {
        // User not logged in, redirect to login and come back to step 1
        sessionStorage.setItem("postLoginRedirect", "/crear-centro-p1.html");
        alert("Debes iniciar sesión para crear un centro de acopio.");
        window.location.href = "/login.html";
        return;
      }
      
      // User is logged in, request location
      requestLocation();
    });
  });

})();