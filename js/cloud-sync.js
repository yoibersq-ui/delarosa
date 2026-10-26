/**
 * cloud-sync.js - Sincronizador en la Nube en Tiempo Real para Delarosa Nail Designer
 * Permite que los cambios de citas, cancelaciones, precios, servicios nuevos y horarios bloqueados
 * se sincronicen de inmediato entre el computador, el iPhone y cualquier dispositivo.
 */

const CloudSync = {
  STORAGE_KEY_URL: 'delarosa_cloud_db_url',
  STORAGE_KEY_LAST_SYNC: 'delarosa_cloud_last_sync',
  pollingIntervalId: null,
  isSyncing: false,

  // Obtener URL de la base de datos (por defecto la API Serverless /api/sync en Vercel)
  getDatabaseUrl() {
    let url = localStorage.getItem(this.STORAGE_KEY_URL);
    if (!url && typeof AppState !== 'undefined' && AppState.config && AppState.config.cloudDbUrl) {
      url = AppState.config.cloudDbUrl;
    }
    // Si no hay ninguna URL configurada, usar el endpoint integrado de Vercel
    if (!url || !url.trim()) {
      url = '/api/sync';
    }
    return url.trim();
  },

  // Guardar URL personalizada (ej. Firebase Realtime Database)
  setDatabaseUrl(url) {
    if (!url || !url.trim()) {
      localStorage.removeItem(this.STORAGE_KEY_URL);
      if (typeof AppState !== 'undefined' && AppState.config) AppState.config.cloudDbUrl = '/api/sync';
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
    return true; // Siempre activo gracias a la API integrada
  },

  // Subir citas, catálogo y bloqueos a la nube
  async pushToCloud(silent = false) {
    if (this.isSyncing) return false;
    const url = this.getDatabaseUrl();
    if (!url) return false;

    this.isSyncing = true;
    try {
      if (!silent) this.updateBadge('syncing', 'Sincronizando...');

      // Filtrar citas falsas o demo
      const cleanAppointments = (AppState.appointments || []).filter(a =>
        a && a.clientName !== 'Valentina Gómez' && 
        a.clientName !== 'Carlos Méndez' && 
        !String(a.id || '').startsWith('CITA-20261022-')
      );

      const payload = {
        updatedAt: new Date().toISOString(),
        updatedBy: AppState.isAdminAuthenticated ? 'Julieth De la Rosa (Admin)' : 'Clienta Web',
        appointments: cleanAppointments,
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

      const isApiRoute = url.startsWith('/api/') || url.includes('/api/sync');
      const method = isApiRoute ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
        this.updateBadge('online', 'En Vivo (Sincronizado)');
        if (!silent && typeof showToast === 'function') {
          showToast('Nube actualizada correctamente.', 'success');
        }
        return true;
      } else {
        this.updateBadge('offline', 'Guardado Local');
        return false;
      }
    } catch (err) {
      console.warn('Error en CloudSync.pushToCloud:', err);
      this.updateBadge('offline', 'Modo Local');
      return false;
    } finally {
      this.isSyncing = false;
    }
  },

  // Descargar cambios más recientes de la nube (citas nuevas, citas eliminadas, bloqueos)
  async pullFromCloud(silent = true) {
    const url = this.getDatabaseUrl();
    if (!url) return false;

    try {
      if (!silent) this.updateBadge('syncing', 'Comprobando...');

      const queryUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      const res = await fetch(queryUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        return false;
      }

      let cloudData = await res.json();
      if (cloudData && cloudData.data && typeof cloudData.data === 'object') {
        cloudData = cloudData.data;
      }
      if (!cloudData || typeof cloudData !== 'object') {
        return false;
      }

      let hasUpdated = false;

      // 1. Sincronizar Citas (tanto creadas como eliminadas en otros dispositivos)
      if (Array.isArray(cloudData.appointments)) {
        const cleanCloudApts = cloudData.appointments.filter(a =>
          a && a.clientName !== 'Valentina Gómez' && 
          a.clientName !== 'Carlos Méndez' && 
          !String(a.id || '').startsWith('CITA-20261022-')
        );

        const currentIds = (AppState.appointments || []).map(a => `${a.id}_${a.status}_${a.date}_${a.time}`).sort().join('|');
        const incomingIds = cleanCloudApts.map(a => `${a.id}_${a.status}_${a.date}_${a.time}`).sort().join('|');

        if (currentIds !== incomingIds) {
          AppState.appointments = cleanCloudApts;

          // Sincronizar con IndexedDB local
          if (typeof DB !== 'undefined') {
            try {
              const db = await openDB();
              const tx = db.transaction('appointments', 'readwrite');
              const store = tx.objectStore('appointments');
              store.clear();
              cleanCloudApts.forEach(apt => store.put(apt));
            } catch (e) {
              console.warn('Error actualizando IndexedDB en pull:', e);
            }
          }

          hasUpdated = true;
          if (typeof renderAdminAppointments === 'function') renderAdminAppointments();
          if (typeof updateAdminMetrics === 'function') updateAdminMetrics();
          if (typeof renderTimeSlots === 'function') renderTimeSlots();
        }
      }

      // 2. Sincronizar Catálogo de Servicios y Precios
      if (Array.isArray(cloudData.services) && cloudData.services.length > 0) {
        if (JSON.stringify(AppState.services) !== JSON.stringify(cloudData.services)) {
          AppState.services = cloudData.services;
          if (typeof DB !== 'undefined') {
            for (const s of cloudData.services) {
              await DB.saveService(s);
            }
          }
          hasUpdated = true;
        }
      }

      // 3. Sincronizar Horarios Bloqueados
      if (Array.isArray(cloudData.blockedSlots)) {
        if (JSON.stringify(AppState.blockedSlots) !== JSON.stringify(cloudData.blockedSlots)) {
          AppState.blockedSlots = cloudData.blockedSlots;
          if (typeof DB !== 'undefined') {
            try {
              const db = await openDB();
              const tx = db.transaction('blockedSlots', 'readwrite');
              const store = tx.objectStore('blockedSlots');
              store.clear();
              cloudData.blockedSlots.forEach(b => store.put(b));
            } catch (e) {}
          }
          hasUpdated = true;
        }
      }

      // 4. Sincronizar Adicionales y Diseños
      if (Array.isArray(cloudData.addons)) AppState.addons = cloudData.addons;
      if (Array.isArray(cloudData.designLevels)) AppState.designLevels = cloudData.designLevels;

      // 5. Horario de Trabajo
      if (cloudData.workingHours && AppState.config) {
        if (cloudData.workingHours.start) AppState.config.workStart = cloudData.workingHours.start;
        if (cloudData.workingHours.end) AppState.config.workEnd = cloudData.workingHours.end;
      }

      // 6. Opciones de Ambiente
      if (cloudData.ambienceOptions) {
        AppState.ambienceOptions = cloudData.ambienceOptions;
      }

      // 7. Finanzas
      if (cloudData.finances && cloudData.finances.goal) {
        AppState.finances = cloudData.finances;
        if (typeof DB !== 'undefined') DB.setSetting('studioFinances', cloudData.finances);
        if (typeof renderFinancesDashboard === 'function') renderFinancesDashboard();
      }

      if (hasUpdated) {
        if (typeof renderServicesCatalog === 'function') renderServicesCatalog();
        if (typeof renderAdminServicesTable === 'function') renderAdminServicesTable();
        if (typeof renderAdminBlockedSlotsTable === 'function') renderAdminBlockedSlotsTable();
        if (typeof updateBrandingText === 'function') updateBrandingText();
      }

      localStorage.setItem(this.STORAGE_KEY_LAST_SYNC, new Date().toISOString());
      this.updateBadge('online', 'En Vivo (Sincronizado)');
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
      const readRes = await fetch(testUrl + '?t=' + Date.now());
      if (!readRes.ok) {
        return { success: false, message: `El servidor respondió con código ${readRes.status}.` };
      }

      const pingPayload = {
        connectionTest: true,
        checkedAt: new Date().toISOString(),
        message: "Conexión exitosa desde Delarosa Nail Designer"
      };

      const writeRes = await fetch(testUrl, {
        method: testUrl.startsWith('/api/') ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pingPayload)
      });

      if (!writeRes.ok) {
        return { success: false, message: `Permiso de escritura denegado (${writeRes.status}).` };
      }

      this.setDatabaseUrl(testUrl);
      await this.pushToCloud(true);
      return { success: true, message: '¡Conexión establecida con éxito! Los datos ya se sincronizan en la nube.' };
    } catch (err) {
      return { success: false, message: 'Error de red al conectar: ' + (err.message || 'Verifica tu conexión y la URL') };
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
      } else {
        badge.className = 'cloud-sync-badge px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-800/80 border border-slate-600 text-slate-300 shadow-xs flex items-center space-x-1';
      }
    });
  },

  // Iniciar sincronización periódica automática (cada 12 segundos)
  startPolling(intervalMs = 12000) {
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);

    // Ejecutar de inmediato al arrancar
    this.pullFromCloud(true);

    this.pollingIntervalId = setInterval(() => {
      this.pullFromCloud(true);
    }, intervalMs);

    // Sincronizar automáticamente cuando el usuario regresa a la pestaña o abre la app
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.pullFromCloud(true));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.pullFromCloud(true);
      });
    }
  }
};

window.CloudSync = CloudSync;
