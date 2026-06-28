/*
 * Acopify - Centralized Firebase Data Manager with Caching
 * 
 * This module provides efficient data access with caching to reduce Firebase calls
 * and improve performance across the application.
 */

(function () {
  // Check if Firebase is properly initialized
  if (!db || !auth) {
    console.error("Firebase not initialized in firebase-data-manager.js");
    return;
  }

  // Cache storage with timestamps
  var cache = {
    centros: {
      data: null,
      timestamp: null,
      ttl: 5 * 60 * 1000, // 5 minutes cache
      listener: null
    },
    centro: {
      data: {}, // Individual centro data by ID
      timestamps: {},
      ttl: 10 * 60 * 1000, // 10 minutes cache
      listeners: {}
    },
    userProfiles: {
      data: {}, // User profiles by UID
      timestamps: {},
      ttl: 15 * 60 * 1000, // 15 minutes cache
      listeners: {}
    },
    userCentros: {
      data: {}, // User's centros by UID
      timestamps: {},
      ttl: 5 * 60 * 1000, // 5 minutes cache
      listeners: {}
    }
  };

  // Cache validation
  function isCacheValid(cacheType, key) {
    if (!cache[cacheType]) return false;
    
    if (key != null) {
      var timestamp = cache[cacheType].timestamps[key];
      return timestamp && (Date.now() - timestamp < cache[cacheType].ttl);
    } else {
      var timestamp = cache[cacheType].timestamp;
      return timestamp && (Date.now() - timestamp < cache[cacheType].ttl);
    }
  }

  function setCache(cacheType, key, data) {
    if (!cache[cacheType]) return;
    
    if (key != null) {
      // Defensive: keyed caches store data in an object. If it was cleared to
      // null (or never initialized), re-create it before indexing to avoid
      // "Cannot set properties of null" crashes.
      if (cache[cacheType].data == null || typeof cache[cacheType].data !== "object") {
        cache[cacheType].data = {};
      }
      if (cache[cacheType].timestamps == null) {
        cache[cacheType].timestamps = {};
      }
      cache[cacheType].data[key] = data;
      cache[cacheType].timestamps[key] = Date.now();
    } else {
      cache[cacheType].data = data;
      cache[cacheType].timestamp = Date.now();
    }
  }

  function getCache(cacheType, key) {
    if (!cache[cacheType]) return null;
    
    if (key != null) {
      if (isCacheValid(cacheType, key)) {
        return cache[cacheType].data[key];
      }
    } else {
      if (isCacheValid(cacheType)) {
        return cache[cacheType].data;
      }
    }
    return null;
  }

  function clearCache(cacheType, key) {
    if (!cache[cacheType]) return;
    
    if (key != null) {
      delete cache[cacheType].data[key];
      delete cache[cacheType].timestamps[key];
    } else {
      cache[cacheType].data = cache[cacheType].timestamps ? {} : null;
      cache[cacheType].timestamp = null;
      cache[cacheType].timestamps = {};
    }
  }

  // Listener cleanup
  function cleanupListener(cacheType, key) {
    if (!cache[cacheType]) return;
    
    var listener = key != null ? cache[cacheType].listeners[key] : cache[cacheType].listener;
    if (listener) {
      var ref = key != null ? 
        db.ref(cacheType === "centro" ? "centros/" + key : cacheType) :
        db.ref("centros");
      
      if (ref && ref.off) {
        ref.off("value", listener);
      }
      
      if (key != null) {
        delete cache[cacheType].listeners[key];
      } else {
        cache[cacheType].listener = null;
      }
    }
  }

  function cleanupAllListeners() {
    Object.keys(cache).forEach(function (cacheType) {
      if (cache[cacheType].listeners) {
        Object.keys(cache[cacheType].listeners).forEach(function (key) {
          cleanupListener(cacheType, key);
        });
      } else if (cache[cacheType].listener) {
        cleanupListener(cacheType);
      }
    });
  }

  // Public API
  window.FirebaseDataManager = {
    // Get all centros with caching
    getCentros: function (forceRefresh) {
      return new Promise(function (resolve, reject) {
        var cached = getCache("centros");
        if (cached && !forceRefresh) {
          resolve(cached);
          return;
        }

        db.ref("centros").once("value")
          .then(function (snapshot) {
            var data = snapshot.val() || {};
            setCache("centros", null, data);
            resolve(data);
          })
          .catch(reject);
      });
    },

    // Listen to all centros with caching
    listenCentros: function (callback, forceRefresh) {
      return new Promise(function (resolve, reject) {
        var cached = getCache("centros");
        if (cached && !forceRefresh) {
          callback(cached);
          resolve(cached);
          return;
        }

        // Cleanup existing listener
        cleanupListener("centros");

        var listener = function (snapshot) {
          var data = snapshot.val() || {};
          setCache("centros", null, data);
          callback(data);
        };

        cache.centros.listener = listener;
        db.ref("centros").on("value", listener);
        
        // Return initial data from cache if available
        if (cached) {
          resolve(cached);
        }
      });
    },

    // Get single centro with caching
    getCentro: function (centroId, forceRefresh) {
      return new Promise(function (resolve, reject) {
        if (!centroId) {
          reject(new Error("centroId is required"));
          return;
        }

        var cached = getCache("centro", centroId);
        if (cached && !forceRefresh) {
          resolve(cached);
          return;
        }

        db.ref("centros/" + centroId).once("value")
          .then(function (snapshot) {
            var data = snapshot.val();
            setCache("centro", centroId, data);
            resolve(data);
          })
          .catch(reject);
      });
    },

    // Listen to single centro with caching
    listenCentro: function (centroId, callback, forceRefresh) {
      return new Promise(function (resolve, reject) {
        if (!centroId) {
          reject(new Error("centroId is required"));
          return;
        }

        var cached = getCache("centro", centroId);
        if (cached && !forceRefresh) {
          callback(cached);
          resolve(cached);
          return;
        }

        // Cleanup existing listener
        cleanupListener("centro", centroId);

        var listener = function (snapshot) {
          var data = snapshot.val();
          setCache("centro", centroId, data);
          callback(data);
        };

        cache.centro.listeners[centroId] = listener;
        db.ref("centros/" + centroId).on("value", listener);
        
        // Return initial data from cache if available
        if (cached) {
          resolve(cached);
        }
      });
    },

    // Get user profile with caching
    getUserProfile: function (uid, forceRefresh) {
      return new Promise(function (resolve, reject) {
        if (!uid) {
          reject(new Error("uid is required"));
          return;
        }

        var cached = getCache("userProfiles", uid);
        if (cached && !forceRefresh) {
          resolve(cached);
          return;
        }

        db.ref("usuarios/" + uid).once("value")
          .then(function (snapshot) {
            var data = snapshot.val();
            setCache("userProfiles", uid, data);
            resolve(data);
          })
          .catch(reject);
      });
    },

    // Get user's centros with caching.
    //
    // One-shot indexed query: `centros` is indexed on `organizadorId`
    // (see rtdb.rules.json), so the server returns only this owner's centers
    // — fast and bandwidth-light. We use `once()` (not a persistent `on()`
    // listener) so there is nothing to leak; mi-centro re-queries with
    // forceRefresh after a write to get fresh data instantly.
    getUserCentros: function (uid, forceRefresh) {
      return new Promise(function (resolve, reject) {
        if (!uid) {
          reject(new Error("uid is required"));
          return;
        }

        var cached = getCache("userCentros", uid);
        if (cached && !forceRefresh) {
          resolve(cached);
          return;
        }

        db.ref("centros")
          .orderByChild("organizadorId")
          .equalTo(uid)
          .once("value")
          .then(function (snapshot) {
            var data = snapshot.val();
            setCache("userCentros", uid, data);
            resolve(data);
          })
          .catch(reject);
      });
    },

    // Invalidate a user's cached centros (call after creating/deleting one so
    // the dashboard reflects the change without serving a stale list).
    invalidateUserCentros: function (uid) {
      if (uid != null) clearCache("userCentros", uid);
    },

    // Update centro data and invalidate cache
    updateCentro: function (centroId, data) {
      return new Promise(function (resolve, reject) {
        if (!centroId) {
          reject(new Error("centroId is required"));
          return;
        }

        db.ref("centros/" + centroId).update(data)
          .then(function () {
            // Invalidate cache for this centro
            clearCache("centro", centroId);
            clearCache("centros"); // Also invalidate full list
            resolve();
          })
          .catch(reject);
      });
    },

    // Update user profile and invalidate cache
    updateUserProfile: function (uid, data) {
      return new Promise(function (resolve, reject) {
        if (!uid) {
          reject(new Error("uid is required"));
          return;
        }

        db.ref("usuarios/" + uid).update(data)
          .then(function () {
            // Invalidate cache for this user
            clearCache("userProfiles", uid);
            resolve();
          })
          .catch(reject);
      });
    },

    // Clear specific cache
    clearCache: function (cacheType, key) {
      clearCache(cacheType, key);
    },

    // Clear all caches
    clearAllCaches: function () {
      Object.keys(cache).forEach(function (cacheType) {
        clearCache(cacheType);
      });
    },

    // Cleanup all listeners (call this when navigating away from pages)
    cleanup: function () {
      cleanupAllListeners();
    },

    // Stop listening to specific data
    stopListening: function (cacheType, key) {
      cleanupListener(cacheType, key);
    }
  };

  // Auto-cleanup on page unload
  window.addEventListener("beforeunload", function () {
    cleanupAllListeners();
  });

  console.log("Firebase Data Manager initialized with caching");
})();