/**
 * db.js - Gestión de almacenamiento persistente usando IndexedDB
 * Soporta citas, fotos en alta resolución, catálogo editable de servicios y bloqueos de horarios.
 */

const DB_NAME = 'DeLaRosaNailsDB';
const DB_VERSION = 2;
let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Citas
      if (!db.objectStoreNames.contains('appointments')) {
        const appointmentStore = db.createObjectStore('appointments', { keyPath: 'id' });
        appointmentStore.createIndex('date', 'date', { unique: false });
        appointmentStore.createIndex('status', 'status', { unique: false });
        appointmentStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Catálogo de Servicios Editables
      if (!db.objectStoreNames.contains('services')) {
        db.createObjectStore('services', { keyPath: 'id' });
      }

      // Adicionales Editables
      if (!db.objectStoreNames.contains('addons')) {
        db.createObjectStore('addons', { keyPath: 'id' });
      }

      // Horarios bloqueados manualmente por la manicurista
      if (!db.objectStoreNames.contains('blockedSlots')) {
        const blockStore = db.createObjectStore('blockedSlots', { keyPath: 'id' });
        blockStore.createIndex('date', 'date', { unique: false });
      }

      // Configuraciones generales
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Error al abrir IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

const DB = {
  // --- CITAS ---
  async getAllAppointments() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readonly');
      const store = tx.objectStore('appointments');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = request.result || [];
        list.sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async getAppointmentById(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readonly');
      const store = tx.objectStore('appointments');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveAppointment(appointment) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      const request = store.put(appointment);
      request.onsuccess = () => resolve(appointment);
      request.onerror = () => reject(request.error);
    });
  },

  async updateAppointmentStatus(id, newStatus) {
    const appointment = await this.getAppointmentById(id);
    if (!appointment) throw new Error('Cita no encontrada');
    appointment.status = newStatus;
    appointment.updatedAt = new Date().toISOString();
    return await this.saveAppointment(appointment);
  },

  async deleteAppointment(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // --- SERVICIOS EDITABLES (CRUD) ---
  async getAllServices() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('services', 'readonly');
      const store = tx.objectStore('services');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveService(service) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('services', 'readwrite');
      const store = tx.objectStore('services');
      const request = store.put(service);
      request.onsuccess = () => resolve(service);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteService(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('services', 'readwrite');
      const store = tx.objectStore('services');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // --- ADICIONALES EDITABLES ---
  async getAllAddons() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('addons', 'readonly');
      const store = tx.objectStore('addons');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveAddon(addon) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('addons', 'readwrite');
      const store = tx.objectStore('addons');
      const request = store.put(addon);
      request.onsuccess = () => resolve(addon);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteAddon(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('addons', 'readwrite');
      const store = tx.objectStore('addons');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // --- BLOQUEOS DE HORARIO (MANICURISTA) ---
  async getAllBlockedSlots() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blockedSlots', 'readonly');
      const store = tx.objectStore('blockedSlots');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async saveBlockedSlot(slot) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blockedSlots', 'readwrite');
      const store = tx.objectStore('blockedSlots');
      const request = store.put(slot);
      request.onsuccess = () => resolve(slot);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteBlockedSlot(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blockedSlots', 'readwrite');
      const store = tx.objectStore('blockedSlots');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // --- AJUSTES ---
  async getSetting(key, defaultValue = null) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result && request.result.value !== undefined) {
            resolve(request.result.value);
          } else {
            resolve(defaultValue);
          }
        };
        request.onerror = () => resolve(defaultValue);
      });
    } catch {
      return defaultValue;
    }
  },

  async setSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  },

  // --- COMPRESIÓN DE FOTOS ---
  compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
      if (!file.type.match(/image.*/)) {
        return reject(new Error('El archivo no es una imagen válida'));
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

window.DB = DB;
