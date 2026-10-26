/**
 * cloud-sync.js - Sincronizador en la Nube en Tiempo Real para Delarosa Nail Designer
 * Permite que los cambios de precios, servicios nuevos y horarios bloqueados hechos
 * por Julieth en su panel de administración se sincronicen de inmediato con los celulares
 * de todas las clientas.
 */

const CloudSync = {
  STORAGE_KEY_URL: 'delarosa_cloud_db_url',
  STORAGE_KEY_LAST_SYNC: 'delarosa_cloud_last_sync',
  pollingIntervalId: null,

  // Obtener URL de la base de datos en la nube (ej. Firebase Realtime Database)
  getDatabaseUrl() {
    let url = localStorage.getItem(this.STORAGE_KEY_URL);
    if (!url && typeof AppState !== 'undefined' && AppState.config && AppState.config.cloudDbUrl) {
      url = AppState.config.cloudDbUrl;
    }
    return (url || '').trim();
  },

  // Guardar URL normalizada (si es Firebase, asegura que termine en .json)
  setDatabaseUrl(url) {
    if (!url) {
      localStorage.removeItem(this.STORAGE_KEY_URL);
      if (typeof AppState !== 'undefined' && AppState.config) AppState.config.cloudDbUrl = '';
      return;
    }
    url = url.trim().replace(/\/$/, '');
    if (url.includes('firebaseio.com') && !url.endsWith('.json')) {
      url = url + '/delarosa_estudio.json';
    }
    localStorage.setItem(this.STORAGE_KEY_URL, url);
    if (typeof AppState !== 'undefined' && AppState.config) {
      AppState.config.cloudDbUrl = url;
    }
  },

  isConfigured() {
    const url = this.getDatabaseUrl();
    return !!(url && (url.startsWith('https://') || url.startsWith('http://')));
  },

  // Enviar catálogo completo y bloqueos a la nube (llamado tras guardar en Admin)
  async pushToCloud(silent = false) {
    const url = this.getDatabaseUrl();
    if (!url) {
      this.updateBadge('offline', 'Modo Local (Sin Nube)');
      return false;
    }

    try {
      if (!silent) this.updateBadge('syncing', 'Sincronizando...');

      const payload = {
        updatedAt: new Date().toISOString(),
        updatedBy: 'Julieth De la Rosa (Admin)',
        services: AppState.services || [],
        addons: AppState.addons || [],
        designLevels: AppState.designLevels || [],
        blockedSlots: AppState.blockedSlots || [],
        ambienceOptions: AppState.ambienceOptions || {},
        finances: AppState.finances || {},
        workingHours: {
          start: (AppState.config && AppState.config.workStart) || "09:00",
          end: (AppState.config && AppState.config.workEnd) || "19:00"
        },
        studioInfo: {
          studioName: AppState.config ? AppState.config.studioName : "Delarosa Nail Designer",
          designerName: AppState.config ? AppState.config.designerName : "Julieth De la Rosa",
          phone: AppState.config ? AppState.config.phone : "573226376819",
          location: AppState.config ? AppState.config.location : "Apartadó - Antioquia"
        }
      };

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
        this.updateBadge('online', '🟢 Nube Actualizada en Vivo');
        if (!silent && typeof showToast === 'function') {
          showToast('☁️ Catálogo y horarios sincronizados en la nube.', 'success');
        }
        return true;
      } else {
        this.updateBadge('error', '⚠️ Error al subir a la nube');
        return false;
      }
    } catch (err) {
      console.warn('Error en CloudSync.pushToCloud:', err);
      this.updateBadge('error', '⚠️ Sin conexión a la nube');
      return false;
    }
  },

  // Descargar cambios más recientes de la nube (llamado al cargar en clientas y admin)
  async pullFromCloud(silent = true) {
    const url = this.getDatabaseUrl();
    if (!url) {
      this.updateBadge('offline', 'Modo Local');
      return false;
    }

    try {
      if (!silent) this.updateBadge('syncing', 'Descargando...');

      // Agregar timestamp anticaché
      const queryUrl = url + (url.includes('?') ? '&' : '?') + '_nocache=' + Date.now();
      const res = await fetch(queryUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        this.updateBadge('error', '⚠️ Error de descarga');
        return false;
      }

      const cloudData = await res.json();
      if (!cloudData || typeof cloudData !== 'object') {
        this.updateBadge('online', '🟢 Nube vacía / lista');
        return false;
      }

      let hasUpdated = false;

      // 1. Sincronizar Catálogo de Servicios y Precios
      if (Array.isArray(cloudData.services) && cloudData.services.length > 0) {
        AppState.services = cloudData.services;
        if (typeof DB !== 'undefined') {
          for (const s of cloudData.services) {
            await DB.saveService(s);
          }
        }
        hasUpdated = true;
      }

      // 2. Sincronizar Horarios Bloqueados (ej. 2 a 4 PM)
      if (Array.isArray(cloudData.blockedSlots)) {
        AppState.blockedSlots = cloudData.blockedSlots;
        if (typeof DB !== 'undefined') {
          for (const b of cloudData.blockedSlots) {
            await DB.saveBlockedSlot(b);
          }
        }
        hasUpdated = true;
      }

      // 3. Sincronizar Adicionales y Diseños
      if (Array.isArray(cloudData.addons)) AppState.addons = cloudData.addons;
      if (Array.isArray(cloudData.designLevels)) AppState.designLevels = cloudData.designLevels;

      // 4. Sincronizar Horario de Trabajo (9:00 a 19:00)
      if (cloudData.workingHours && AppState.config) {
        if (cloudData.workingHours.start) AppState.config.workStart = cloudData.workingHours.start;
        if (cloudData.workingHours.end) AppState.config.workEnd = cloudData.workingHours.end;
        hasUpdated = true;
      }

      // 5. Opciones de Ambiente
      if (cloudData.ambienceOptions) {
        AppState.ambienceOptions = cloudData.ambienceOptions;
      }

      // 6. Sincronizar Finanzas y Meta del Mueble ($1.000.000 COP)
      if (cloudData.finances && cloudData.finances.goal) {
        AppState.finances = cloudData.finances;
        if (typeof DB !== 'undefined') DB.setSetting('studioFinances', cloudData.finances);
        if (typeof renderFinancesDashboard === 'function') renderFinancesDashboard();
      }

      if (hasUpdated) {
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof renderServicesCatalog === 'function') renderServicesCatalog();
        if (typeof renderTimeSlotsForSelectedDate === 'function') renderTimeSlotsForSelectedDate();
        if (typeof renderAdminServicesTable === 'function') renderAdminServicesTable();
        if (typeof renderAdminBlockedSlotsTable === 'function') renderAdminBlockedSlotsTable();
        if (typeof updateBrandingText === 'function') updateBrandingText();
      }

      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.updateBadge('online', '🟢 Nube Sincronizada');
      return true;
    } catch (err) {
      console.warn('Error en CloudSync.pullFromCloud:', err);
      return false;
    }
  },

  // Probar conexión a la URL ingresada
  async testConnection(testUrl) {
    if (!testUrl) return { success: false, message: 'Ingresa una URL válida.' };
    testUrl = testUrl.trim().replace(/\/$/, '');
    if (testUrl.includes('firebaseio.com') && !testUrl.endsWith('.json')) {
      testUrl = testUrl + '/delarosa_estudio.json';
    }

    try {
      // 1. Probar lectura
      const readRes = await fetch(testUrl + '?t=' + Date.now());
      if (!readRes.ok) {
        return { success: false, message: `El servidor respondió con error ${readRes.status}. Verifica los permisos de lectura.` };
      }

      // 2. Probar escritura de prueba
      const pingPayload = {
        connectionTest: true,
        checkedAt: new Date().toISOString(),
        message: "Conexión exitosa desde Delarosa Nail Designer"
      };

      const writeRes = await fetch(testUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pingPayload)
      });

      if (!writeRes.ok) {
        return { success: false, message: `Permiso de escritura denegado (${writeRes.status}). Asegúrate de que las reglas de Firebase tengan ".write": true.` };
      }

      // Guardar URL comprobada
      this.setDatabaseUrl(testUrl);
      // Subir datos actuales de inmediato
      await this.pushToCloud(true);

      return { success: true, message: '¡Conexión establecida con éxito! Los datos ya se sincronizan en la nube.' };
    } catch (err) {
      return { success: false, message: 'Error de red al conectar: ' + (err.message || 'Verifica tu conexión y la URL') };
    }
  },

  // Generador de archivo sample-data.js descargable (para sincronización offline en Netlify)
  exportCatalogAsFile() {
    const services = AppState.services || [];
    const addons = AppState.addons || [];
    const blockedSlots = AppState.blockedSlots || [];
    const cfg = AppState.config || {};
    const ambience = AppState.ambienceOptions || {};

    const fileContent = `/**
 * sample-data.js - Catálogo Oficial de Delarosa Nail Designer
 * Generado automáticamente desde el Panel de Julieth el ${new Date().toLocaleDateString('es-CO')}
 * Precios oficiales en COP y horarios actualizados.
 */

const SAMPLE_CONFIG = ${JSON.stringify(cfg, null, 2)};

const OFFICIAL_SERVICES = ${JSON.stringify(services, null, 2)};

const OFFICIAL_ADDONS = ${JSON.stringify(addons, null, 2)};

const AMBIENCE_OPTIONS = ${JSON.stringify(ambience, null, 2)};

const INITIAL_BLOCKED_SLOTS = ${JSON.stringify(blockedSlots, null, 2)};

// Exposición Global
window.STUDIO_CONFIG = SAMPLE_CONFIG;
window.OFFICIAL_SERVICES = OFFICIAL_SERVICES;
window.OFFICIAL_ADDONS = OFFICIAL_ADDONS;
window.AMBIENCE_OPTIONS = AMBIENCE_OPTIONS;
window.INITIAL_BLOCKED_SLOTS = INITIAL_BLOCKED_SLOTS;
`;

    const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-data.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') {
      showToast('📥 Archivo sample-data.js descargado. Puedes reemplazarlo en tu carpeta.', 'success');
    }
  },

  // Actualizar el badge visual en el panel
  updateBadge(status, label) {
    const badges = document.querySelectorAll('.cloud-sync-badge');
    badges.forEach(badge => {
      badge.textContent = label;
      if (status === 'online') {
        badge.className = 'cloud-sync-badge px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-950/80 border border-emerald-500/70 text-emerald-300 shadow-xs flex items-center space-x-1';
      } else if (status === 'syncing') {
        badge.className = 'cloud-sync-badge px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-sky-950/80 border border-sky-500/70 text-sky-300 shadow-xs flex items-center space-x-1 animate-pulse';
      } else if (status === 'error') {
        badge.className = 'cloud-sync-badge px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-950/80 border border-rose-500/70 text-rose-300 shadow-xs flex items-center space-x-1';
      } else {
        badge.className = 'cloud-sync-badge px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-800/80 border border-slate-600 text-slate-300 shadow-xs flex items-center space-x-1';
      }
    });
  },

  // Iniciar sincronización periódica automática (cada 25 segundos)
  startPolling(intervalMs = 25000) {
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    
    // Ejecutar de inmediato al arrancar
    this.pullFromCloud(true);

    this.pollingIntervalId = setInterval(() => {
      if (this.isConfigured()) {
        this.pullFromCloud(true);
      }
    }, intervalMs);
  }
};

window.CloudSync = CloudSync;
