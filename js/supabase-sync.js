/**
 * supabase-sync.js - Integración Oficial con Supabase para Delarosa Nail Designer
 * Sincronización en la Nube y en Tiempo Real (PostgreSQL + Realtime WebSockets)
 * Conecta celulares, computadores y el panel de administración al instante.
 */

const SupabaseSync = {
  STORAGE_URL: 'delarosa_supabase_url',
  STORAGE_KEY: 'delarosa_supabase_anon_key',
  client: null,
  realtimeChannel: null,
  isListening: false,

  getUrl() {
    let u = localStorage.getItem(this.STORAGE_URL);
    if (!u && typeof AppState !== 'undefined' && AppState.config && AppState.config.supabaseUrl) {
      u = AppState.config.supabaseUrl;
    }
    if (!u && typeof window.SAMPLE_CONFIG !== 'undefined' && window.SAMPLE_CONFIG.supabaseUrl) {
      u = window.SAMPLE_CONFIG.supabaseUrl;
    }
    return (u || '').trim();
  },

  getKey() {
    let k = localStorage.getItem(this.STORAGE_KEY);
    if (!k && typeof AppState !== 'undefined' && AppState.config && AppState.config.supabaseAnonKey) {
      k = AppState.config.supabaseAnonKey;
    }
    if (!k && typeof window.SAMPLE_CONFIG !== 'undefined' && window.SAMPLE_CONFIG.supabaseAnonKey) {
      k = window.SAMPLE_CONFIG.supabaseAnonKey;
    }
    return (k || '').trim();
  },

  setCredentials(url, key) {
    if (!url || !key) {
      localStorage.removeItem(this.STORAGE_URL);
      localStorage.removeItem(this.STORAGE_KEY);
      this.client = null;
      if (typeof AppState !== 'undefined' && AppState.config) {
        AppState.config.supabaseUrl = '';
        AppState.config.supabaseAnonKey = '';
      }
      this.updateBadge('offline', 'Modo Local (Sin Nube)');
      return;
    }
    url = url.trim().replace(/\/$/, '');
    key = key.trim();
    localStorage.setItem(this.STORAGE_URL, url);
    localStorage.setItem(this.STORAGE_KEY, key);
    if (typeof AppState !== 'undefined' && AppState.config) {
      AppState.config.supabaseUrl = url;
      AppState.config.supabaseAnonKey = key;
    }
    this.client = null; // Reiniciar instancia
    this.getClient();
    this.updateBadge('online', '🟢 Supabase Conectado');
  },

  isConfigured() {
    const u = this.getUrl();
    const k = this.getKey();
    return !!(u && k && u.startsWith('https://') && k.length > 20);
  },

  getClient() {
    if (this.client) return this.client;
    if (!this.isConfigured()) return null;

    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.warn('[SupabaseSync] Librería supabase-js no está cargada aún.');
      return null;
    }

    try {
      this.client = window.supabase.createClient(this.getUrl(), this.getKey(), {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      return this.client;
    } catch (err) {
      console.error('[SupabaseSync] Error al crear cliente Supabase:', err);
      return null;
    }
  },

  // Probar credenciales con una consulta rápida
  async testConnection(testUrl, testKey) {
    testUrl = (testUrl || this.getUrl()).trim().replace(/\/$/, '');
    testKey = (testKey || this.getKey()).trim();

    if (!testUrl || !testKey) {
      return { success: false, message: 'Debes ingresar la URL del proyecto y la Anon Key.' };
    }

    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      return { success: false, message: 'La librería Supabase no se ha cargado. Verifica tu conexión a internet.' };
    }

    try {
      const tempClient = window.supabase.createClient(testUrl, testKey, {
        auth: { persistSession: false }
      });

      // Probar lectura de la tabla appointments
      const { data, error } = await tempClient
        .from('appointments')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          return {
            success: false,
            message: 'Conexión a Supabase exitosa, pero las tablas aún no existen. Por favor ejecuta el script SQL en el SQL Editor de Supabase.'
          };
        }
        return { success: false, message: 'Error de Supabase: ' + (error.message || error.details || 'Verifica la Anon Key y los permisos RLS.') };
      }

      // Guardar credenciales validadas
      this.setCredentials(testUrl, testKey);
      this.initRealtime();
      return { success: true, message: '¡Conexión exitosa con Supabase! Base de datos en la nube lista y sincronizada.' };
    } catch (err) {
      return { success: false, message: 'Error de red al conectar: ' + (err.message || 'Verifica la URL.') };
    }
  },

  // --------------------------------------------------------------------------
  // CITAS (APPOINTMENTS)
  // --------------------------------------------------------------------------
  async getAllAppointments() {
    const sb = this.getClient();
    if (!sb) return null;

    try {
      const { data, error } = await sb
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (error) {
        console.warn('[SupabaseSync] Error al leer citas:', error);
        return null;
      }

      // Mapear campos de snake_case (Postgres) a camelCase (App)
      return (data || []).map(row => ({
        id: row.id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        clientEmail: row.client_email,
        clientInstagram: row.client_instagram,
        gender: row.gender,
        isFirstTime: row.is_first_time,
        serviceId: row.service_id,
        serviceName: row.service_name,
        shape: row.shape,
        length: row.length,
        designLevel: row.design_level,
        designNotes: row.design_notes,
        addons: Array.isArray(row.addons) ? row.addons : [],
        ambience: row.ambience || {},
        date: row.date,
        time: row.time,
        durationMin: row.duration_min,
        totalPrice: Number(row.total_price) || 0,
        depositAmount: Number(row.deposit_amount) || 0,
        status: row.status || 'confirmed',
        images: Array.isArray(row.images) ? row.images : [],
        createdAt: row.created_at
      }));
    } catch (err) {
      console.warn('[SupabaseSync] Excepción al leer citas:', err);
      return null;
    }
  },

  async saveAppointment(apt) {
    const sb = this.getClient();
    if (!sb || !apt || !apt.id) return false;

    try {
      const row = {
        id: apt.id,
        client_name: apt.clientName || 'Cliente',
        client_phone: apt.clientPhone || '',
        client_email: apt.clientEmail || '',
        client_instagram: apt.clientInstagram || '',
        gender: apt.gender || 'woman',
        is_first_time: !!apt.isFirstTime,
        service_id: apt.serviceId || '',
        service_name: apt.serviceName || '',
        shape: apt.shape || '',
        length: apt.length || '',
        design_level: apt.designLevel || '',
        design_notes: apt.designNotes || '',
        addons: Array.isArray(apt.addons) ? apt.addons : [],
        ambience: apt.ambience || {},
        date: apt.date,
        time: apt.time,
        duration_min: apt.durationMin || 120,
        total_price: apt.totalPrice || 0,
        deposit_amount: apt.depositAmount || 0,
        status: apt.status || 'confirmed',
        images: Array.isArray(apt.images) ? apt.images : [],
        updated_at: new Date().toISOString()
      };

      const { error } = await sb
        .from('appointments')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        console.error('[SupabaseSync] Error al guardar cita en Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseSync] Excepción al guardar cita:', err);
      return false;
    }
  },

  async deleteAppointment(id) {
    const sb = this.getClient();
    if (!sb || !id) return false;

    try {
      const { error } = await sb
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[SupabaseSync] Error al eliminar cita en Supabase:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseSync] Excepción al eliminar cita:', err);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // HORARIOS BLOQUEADOS (BLOCKED SLOTS)
  // --------------------------------------------------------------------------
  async getAllBlockedSlots() {
    const sb = this.getClient();
    if (!sb) return null;

    try {
      const { data, error } = await sb
        .from('blocked_slots')
        .select('*')
        .order('date', { ascending: true });

      if (error) return null;

      return (data || []).map(row => ({
        id: row.id,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        reason: row.reason,
        isFullDay: row.is_full_day,
        createdAt: row.created_at
      }));
    } catch (err) {
      return null;
    }
  },

  async saveBlockedSlot(slot) {
    const sb = this.getClient();
    if (!sb || !slot) return false;

    try {
      const row = {
        id: slot.id || ('block_' + Date.now()),
        date: slot.date,
        start_time: slot.startTime || null,
        end_time: slot.endTime || null,
        reason: slot.reason || 'Horario no disponible',
        is_full_day: !!slot.isFullDay
      };

      const { error } = await sb
        .from('blocked_slots')
        .upsert(row, { onConflict: 'id' });

      return !error;
    } catch (err) {
      return false;
    }
  },

  async deleteBlockedSlot(id) {
    const sb = this.getClient();
    if (!sb || !id) return false;

    try {
      const { error } = await sb
        .from('blocked_slots')
        .delete()
        .eq('id', id);

      return !error;
    } catch (err) {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // SERVICIOS (SERVICES)
  // --------------------------------------------------------------------------
  async getAllServices() {
    const sb = this.getClient();
    if (!sb) return null;

    try {
      const { data, error } = await sb
        .from('services')
        .select('*')
        .order('order_index', { ascending: true });

      if (error || !data || data.length === 0) return null;

      return data.map(r => ({
        id: r.id,
        name: r.name,
        price: Number(r.price) || 0,
        duration: r.duration_min || 120,
        desc: r.description || '',
        category: r.category || 'manicura',
        popular: !!r.is_popular
      }));
    } catch (err) {
      return null;
    }
  },

  async syncAllServices(servicesList) {
    const sb = this.getClient();
    if (!sb || !Array.isArray(servicesList) || servicesList.length === 0) return false;

    try {
      const rows = servicesList.map((s, idx) => ({
        id: s.id,
        name: s.name,
        price: s.price || 0,
        duration_min: s.duration || 120,
        description: s.desc || '',
        category: s.category || 'manicura',
        is_popular: !!s.popular,
        order_index: idx,
        updated_at: new Date().toISOString()
      }));

      const { error } = await sb
        .from('services')
        .upsert(rows, { onConflict: 'id' });

      return !error;
    } catch (err) {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // FINANZAS (FINANCES)
  // --------------------------------------------------------------------------
  async getFinances() {
    const sb = this.getClient();
    if (!sb) return null;

    try {
      const { data, error } = await sb
        .from('finances')
        .select('*')
        .eq('id', 'studio_finances')
        .single();

      if (error || !data) return null;

      return {
        goal: Number(data.goal) || 1000000,
        saved: Number(data.saved) || 0,
        goalName: data.goal_name || 'Mueble Organizador Profesional',
        movements: Array.isArray(data.movements) ? data.movements : []
      };
    } catch (err) {
      return null;
    }
  },

  async saveFinances(fin) {
    const sb = this.getClient();
    if (!sb || !fin) return false;

    try {
      const row = {
        id: 'studio_finances',
        goal: fin.goal || 1000000,
        saved: fin.saved || 0,
        goal_name: fin.goalName || 'Mueble Organizador Profesional',
        movements: Array.isArray(fin.movements) ? fin.movements : [],
        updated_at: new Date().toISOString()
      };

      const { error } = await sb
        .from('finances')
        .upsert(row, { onConflict: 'id' });

      return !error;
    } catch (err) {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // TIEMPO REAL (REALTIME SUBSCRIPTIONS)
  // --------------------------------------------------------------------------
  initRealtime() {
    const sb = this.getClient();
    if (!sb || this.isListening) return;

    try {
      this.realtimeChannel = sb.channel('delarosa_realtime_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, async payload => {
          console.log('[Supabase Realtime] Cambio en Citas detectado:', payload.eventType);
          // Recargar citas desde Supabase
          const freshAppointments = await this.getAllAppointments();
          if (freshAppointments && typeof AppState !== 'undefined') {
            AppState.appointments = freshAppointments;
            if (typeof DB !== 'undefined') {
              for (const a of freshAppointments) { await DB.saveAppointment(a); }
            }
            if (typeof renderAdminAppointmentsTable === 'function') renderAdminAppointmentsTable();
            if (typeof renderAppointmentsCalendar === 'function') renderAppointmentsCalendar();
            if (typeof renderAdminDashboardStats === 'function') renderAdminDashboardStats();
            if (typeof renderAvailableSlots === 'function' && AppState.selectedDate) {
              renderAvailableSlots(AppState.selectedDate);
            }
          }
          if (typeof showToast === 'function') {
            if (payload.eventType === 'INSERT') {
              showToast('✨ Nueva cita agendada en tiempo real desde la nube', 'success');
            } else if (payload.eventType === 'DELETE') {
              showToast('🗑️ Cita eliminada en tiempo real', 'info');
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_slots' }, async () => {
          console.log('[Supabase Realtime] Cambio en Horarios Bloqueados detectado');
          const freshSlots = await this.getAllBlockedSlots();
          if (freshSlots && typeof AppState !== 'undefined') {
            AppState.blockedSlots = freshSlots;
            if (typeof renderBlockedSlotsTable === 'function') renderBlockedSlotsTable();
            if (typeof renderAvailableSlots === 'function' && AppState.selectedDate) {
              renderAvailableSlots(AppState.selectedDate);
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, async () => {
          console.log('[Supabase Realtime] Cambio en Catálogo de Servicios detectado');
          const freshServices = await this.getAllServices();
          if (freshServices && freshServices.length > 0 && typeof AppState !== 'undefined') {
            AppState.services = freshServices;
            if (typeof renderServiceSelection === 'function') renderServiceSelection();
            if (typeof renderAdminServicesTable === 'function') renderAdminServicesTable();
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.isListening = true;
            this.updateBadge('online', '🟢 Supabase en Tiempo Real');
          }
        });
    } catch (err) {
      console.warn('[Supabase Realtime] Error al iniciar suscripción:', err);
    }
  },

  // Actualizar el badge visual en la barra y en el panel
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
  }
};

window.SupabaseSync = SupabaseSync;
