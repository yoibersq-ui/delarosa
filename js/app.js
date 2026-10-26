/**
 * app.js - Delarosa Nail Designer
 * Sistema integral de agendamiento, panel protegido con contraseña, cálculo de horas inteligente,
 * edición inmediata de redes sociales/fotos y sistema de alarmas sonoras (24h, 2h, 1h, 5min).
 */

// Formateador oficial de Pesos Colombianos (COP)
function formatCOP(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '$0 COP';
  return '$' + Number(amount).toLocaleString('es-CO') + ' COP';
}
window.formatCOP = formatCOP;

// Normalizador y Validador Oficial de Teléfonos de Colombia (+57)
function normalizeColombianPhone(rawPhone) {
  if (!rawPhone) return '573226376819';
  let str = rawPhone.toString().trim();
  let digits = str.replace(/[^0-9]/g, '');
  
  // Ya viene completo con indicativo 57 y 10 dígitos celulares (12 dígitos total)
  if (digits.startsWith('57') && digits.length === 12) {
    return digits;
  }
  // Celular estándar colombiano de 10 dígitos (ej: 3226376819) -> anteponer 57
  if (digits.length === 10 && digits.startsWith('3')) {
    return '57' + digits;
  }
  // 11 dígitos iniciando con 03 (ej: 03226376819) -> cambiar 0 por 57
  if (digits.length === 11 && digits.startsWith('03')) {
    return '57' + digits.substring(1);
  }
  // Si tiene exactamente 10 dígitos
  if (digits.length === 10) {
    return '57' + digits;
  }
  // Si ya tiene más de 10 dígitos y empieza por 57
  if (digits.startsWith('57') && digits.length >= 11) {
    return digits;
  }
  // Fallback seguro: si tiene 10 dígitos o menos
  if (digits.length <= 10 && digits.length > 0) {
    return '57' + digits;
  }
  return digits || '573226376819';
}
window.normalizeColombianPhone = normalizeColombianPhone;

function formatColombianPhoneDisplay(phone) {
  const norm = normalizeColombianPhone(phone);
  if (norm.startsWith('57') && norm.length === 12) {
    const m = norm.substring(2);
    return `+57 ${m.substring(0,3)} ${m.substring(3,6)} ${m.substring(6)}`;
  }
  return phone || '+57 322 637 6819';
}
window.formatColombianPhoneDisplay = formatColombianPhoneDisplay;

// Estado Global de la Aplicación
const AppState = {
  view: 'client', // 'client' | 'admin'
  step: 1,
  totalSteps: 5,
  config: null,
  services: [],
  addons: [],
  nailLengths: [],
  designLevels: [],
  ambienceOptions: null,
  blockedSlots: [],
  appointments: [],
  finances: {
    goal: {
      title: "Mueble de Lujo para el Estudio",
      targetAmount: 1000000,
      currentAmount: 350000,
      icon: "🪑"
    },
    movements: [
      { id: "mov_1", date: "2026-10-21", type: "income", title: "Cita Uñas Acrílicas - Sofía", amount: 110000 },
      { id: "mov_2", date: "2026-10-21", type: "goal_deposit", title: "Aporte al Mueble del Estudio", amount: 100000 },
      { id: "mov_3", date: "2026-10-22", type: "expense", title: "Compra de Monómero y Pincel Kolinsky", amount: 85000 },
      { id: "mov_4", date: "2026-10-22", type: "income", title: "Cita Semipermanente", amount: 45000 },
      { id: "mov_5", date: "2026-10-23", type: "goal_deposit", title: "Aporte al Mueble del Estudio", amount: 250000 }
    ]
  },
  activeFilter: 'all',
  searchQuery: '',
  isAdminAuthenticated: false,
  selectedAppointmentForReminder: null,
  alarmAudioCtx: null,
  onAuthSuccess: null, // Callback tras ingresar contraseña exitosamente

  // Datos temporales del formulario de agendamiento
  booking: {
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientInstagram: '',
    gender: 'woman', // 'woman' | 'man'
    isFirstTime: true,
    serviceId: 'semi-manos-dama',
    shape: 'almond',
    length: 'medium',
    addons: [],
    designLevel: 'basic',
    designNotes: '',
    images: [],
    ambience: {
      vibe: 'silent',
      entertainmentType: 'music', // 'music' | 'movie' | 'silence'
      movieSeriesTitle: '',
      music: 'lofi',
      drink: 'latte',
      sensitivities: []
    },
    date: '',
    time: '',
    durationMin: 240
  }
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  await initApplication();
  startAlarmBackgroundMonitor();
});

async function initApplication() {
  try {
    // 1. Cargar Configuración del Estudio
    let savedConfig = await DB.getSetting('studioConfig');
    if (!savedConfig) {
      savedConfig = window.SAMPLE_CONFIG;
      await DB.setSetting('studioConfig', savedConfig);
    } else {
      // Si tiene el número placeholder antiguo, actualizar al número real de Julieth
      if (savedConfig.phone === '573001234567' || !savedConfig.phone) {
        savedConfig.phone = '573226376819';
        savedConfig.paymentMethods = 'Nequi / Daviplata: 322 637 6819 | Bancolombia Ahorros (A nombre de Julieth De la Rosa)';
        await DB.setSetting('studioConfig', savedConfig);
      }
      if (!savedConfig.email) {
        savedConfig.email = 'delarosaa02@gmail.com';
      }
      if (!savedConfig.workingHours) {
        savedConfig.workingHours = { start: "09:00", end: "19:00", slotInterval: 30, daysOpen: [1, 2, 3, 4, 5, 6] };
      } else {
        if (!savedConfig.workingHours.start || savedConfig.workingHours.start === "08:00") {
          savedConfig.workingHours.start = "09:00";
        }
        if (!savedConfig.workingHours.end || savedConfig.workingHours.end === "20:00") {
          savedConfig.workingHours.end = "19:00";
        }
      }
      await DB.setSetting('studioConfig', savedConfig);
    }
    AppState.config = savedConfig;

    // 2. Cargar Catálogo de Servicios
    let savedServices = await DB.getAllServices();
    if (!savedServices || savedServices.length === 0) {
      for (const s of window.OFFICIAL_SERVICES) {
        await DB.saveService(s);
      }
      savedServices = await DB.getAllServices();
    }
    AppState.services = savedServices;

    // 3. Cargar Adicionales
    let savedAddons = await DB.getAllAddons();
    if (!savedAddons || savedAddons.length === 0) {
      for (const a of window.OFFICIAL_ADDONS) {
        await DB.saveAddon(a);
      }
      savedAddons = await DB.getAllAddons();
    }
    AppState.addons = savedAddons;

    // 3.1 Cargar Tarifas de Largos de Uña
    let savedLengths = await DB.getSetting('nailLengths');
    if (!savedLengths || !savedLengths.length) {
      savedLengths = JSON.parse(JSON.stringify(window.NAIL_LENGTHS));
      await DB.setSetting('nailLengths', savedLengths);
    }
    AppState.nailLengths = savedLengths;

    // 3.2 Cargar Niveles de Nail Art
    let savedDesignLevels = await DB.getSetting('designLevels');
    if (!savedDesignLevels || !savedDesignLevels.length) {
      savedDesignLevels = JSON.parse(JSON.stringify(window.DESIGN_LEVELS));
      await DB.setSetting('designLevels', savedDesignLevels);
    }
    AppState.designLevels = savedDesignLevels;

    // 3.3 Cargar Opciones de Ambiente VIP & Menú de Bebidas
    let savedAmbience = await DB.getSetting('ambienceOptions');
    if (!savedAmbience || !savedAmbience.drink) {
      savedAmbience = JSON.parse(JSON.stringify(window.AMBIENCE_OPTIONS));
      await DB.setSetting('ambienceOptions', savedAmbience);
    }
    AppState.ambienceOptions = savedAmbience;

    // 4. Cargar Horarios Bloqueados
    AppState.blockedSlots = await DB.getAllBlockedSlots();

    // 5. Cargar Citas (Sin citas ficticias)
    let appointments = await DB.getAllAppointments();
    if (appointments && appointments.length > 0) {
      const fakeIds = appointments.filter(a => a && (a.clientName === 'Valentina Gómez' || a.clientName === 'Carlos Méndez' || a.clientName === 'Valentina Gmez' || a.clientName === 'Carlos Mndez' || String(a.id || '').startsWith('CITA-20261022-'))).map(a => a.id);
      for (const fId of fakeIds) { await DB.deleteAppointment(fId); }
      appointments = appointments.filter(a => !fakeIds.includes(a.id));
    }
    AppState.appointments = appointments || [];

    // 5.1 Cargar Finanzas y Meta del Mueble ($1.000.000 COP)
    try {
      let savedFinances = await DB.getSetting('studioFinances');
      if (!savedFinances || !savedFinances.goal) {
        const stored = localStorage.getItem('delarosa_finances');
        if (stored) savedFinances = JSON.parse(stored);
      }
      if (savedFinances && savedFinances.goal) {
        AppState.finances = savedFinances;
      }
    } catch (e) {}

    // 6. Verificar sesión de administradora
    if (sessionStorage.getItem('delarosa_admin_auth') === 'true') {
      AppState.isAdminAuthenticated = true;
    }

    // 7. Fecha por defecto (hoy)
    const todayStr = new Date().toISOString().split('T')[0];
    AppState.booking.date = todayStr;

    // 8. Renderizar UI
    updateBrandingText();
    renderBookingWizard();
    setupEventListeners();
    initPWA();

    // 9. Comprobar permisos y visibilidad del Panel de Manicurista
    checkAdminAccessVisibility();

    // 10. Iniciar Sincronización en la Nube (Tiempo Real)
    if (typeof CloudSync !== 'undefined') {
      CloudSync.startPolling();
    }

    // Vista inicial
    const hash = window.location.hash;
    if ((hash === '#admin' || hash === '#designer') && AppState.isAdminAuthenticated) {
      switchView('admin');
    } else {
      switchView('client');
    }

  } catch (error) {
    console.error('Error al inicializar la app:', error);
    showToast('Error cargando los datos locales.', 'error');
  }
}

// Actualizar textos, fotos y enlaces clicables de redes sociales en tiempo real
function updateBrandingText() {
  const cfg = AppState.config;
  if (!cfg) return;

  // Textos del estudio y artista
  document.querySelectorAll('.studio-name-text').forEach(el => el.textContent = cfg.studioName);
  document.querySelectorAll('.designer-name-text').forEach(el => el.textContent = cfg.designerName);
  document.querySelectorAll('.studio-slogan-text').forEach(el => el.textContent = cfg.slogan);
  document.querySelectorAll('.studio-phone-text').forEach(el => el.textContent = cfg.phone);
  document.querySelectorAll('.studio-instagram-text').forEach(el => el.textContent = cfg.instagram);
  document.querySelectorAll('.studio-location-text').forEach(el => el.textContent = cfg.location);

  const emailDisplay = document.getElementById('adminJuliethEmailDisplay');
  if (emailDisplay) emailDisplay.textContent = cfg.email || 'delarosaa02@gmail.com';
  const phoneDisplay = document.getElementById('adminJuliethPhoneDisplay');
  if (phoneDisplay) phoneDisplay.textContent = formatColombianPhoneDisplay(cfg.phone || '573226376819');
  updateScheduleBadges();

  // Fotos de perfil y portada
  const profileSrc = cfg.customProfilePhoto || (window.DELAROSA_PROFILE_B64 || 'assets/img/delarosa_profile.jpg');
  document.querySelectorAll('.profile-avatar-img').forEach(img => img.src = profileSrc);

  // Foto de la lista de precios
  const priceSrc = cfg.customPriceFlyerPhoto || (window.DELAROSA_PRICES_B64 || 'assets/img/delarosa_prices.jpg');
  document.querySelectorAll('.price-flyer-img').forEach(img => img.src = priceSrc);

  // Enlaces directos a Redes Sociales
  const cleanPhone = normalizeColombianPhone(cfg.phone || '573226376819');
  const instaHandle = (cfg.instagram || '').replace('@', '').trim();

  const instaLinks = document.querySelectorAll('.link-instagram');
  instaLinks.forEach(a => {
    a.href = cfg.instagramUrl || `https://instagram.com/${instaHandle}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  const fbLinks = document.querySelectorAll('.link-facebook');
  fbLinks.forEach(a => {
    a.href = cfg.facebookUrl || `https://facebook.com/search/top?q=${encodeURIComponent(cfg.designerName)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  const tiktokLinks = document.querySelectorAll('.link-tiktok');
  tiktokLinks.forEach(a => {
    a.href = cfg.tiktokUrl || `https://tiktok.com/@${instaHandle}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  const waLinks = document.querySelectorAll('.link-whatsapp');
  waLinks.forEach(a => {
    a.href = `https://wa.me/${cleanPhone}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  const mapLinks = document.querySelectorAll('.link-maps');
  mapLinks.forEach(a => {
    a.href = cfg.locationMapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(cfg.location)}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

// Configuración de eventos
function setupEventListeners() {
  // Cambio de vista
  const navClientBtn = document.getElementById('navClientBtn');
  const navAdminBtn = document.getElementById('navAdminBtn');
  if (navClientBtn) navClientBtn.addEventListener('click', () => switchView('client'));
  if (navAdminBtn) navAdminBtn.addEventListener('click', () => {
    AppState.onAuthSuccess = null;
    handleAdminAccess();
  });

  // Wizard Navigation
  const nextStepBtn = document.getElementById('nextStepBtn');
  const prevStepBtn = document.getElementById('prevStepBtn');
  if (nextStepBtn) nextStepBtn.addEventListener('click', goToNextStep);
  if (prevStepBtn) prevStepBtn.addEventListener('click', goToPrevStep);

  // Autenticación Admin
  const adminLoginForm = document.getElementById('adminLoginForm');
  const cancelAuthBtn = document.getElementById('cancelAuthBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  if (adminLoginForm) adminLoginForm.addEventListener('submit', handleAdminLoginSubmit);
  if (cancelAuthBtn) cancelAuthBtn.addEventListener('click', () => document.getElementById('adminAuthModal').classList.add('hidden'));
  if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleAdminLogout);

  // Género (Dama vs Caballero)
  document.querySelectorAll('input[name="clientGender"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      AppState.booking.gender = e.target.value;
      if (AppState.booking.gender === 'man') {
        const firstManService = AppState.services.find(s => s.category === 'hombre') || AppState.services[0];
        AppState.booking.serviceId = firstManService.id;
      } else {
        const firstWomanService = AppState.services.find(s => s.category === 'dama') || AppState.services[0];
        AppState.booking.serviceId = firstWomanService.id;
      }
      renderServicesCatalog();
      updateLivePriceSummary();
    });
  });

  // Manejo de Imágenes de Referencia
  const imageInput = document.getElementById('nailImagesInput');
  const dropzone = document.getElementById('imageDropzone');
  if (imageInput) imageInput.addEventListener('change', handleImageFilesSelect);
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
    });
  }

  // Ver carta oficial de precios en Lightbox
  document.querySelectorAll('.open-pricelist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = AppState.config.customPriceFlyerPhoto || (window.DELAROSA_PRICES_B64 || 'assets/img/delarosa_prices.jpg');
      openLightboxDirect(src, 'Carta Oficial de Precios - Delarosa Nail Designer');
    });
  });

  // Subida de nueva foto de precios desde el Lightbox
  const lightboxPriceFlyerUploadInput = document.getElementById('lightboxPriceFlyerUploadInput');
  if (lightboxPriceFlyerUploadInput) {
    lightboxPriceFlyerUploadInput.addEventListener('change', handleLightboxPriceFlyerUpload);
  }

  // Modal Lightbox Close
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);

  // Filtros Admin
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-filter-btn').forEach(b => {
        b.classList.remove('btn-chrome', 'text-stone-950', 'font-black');
        b.classList.add('bg-[#12121b]', 'text-slate-300', 'border', 'border-slate-700');
      });
      btn.classList.remove('bg-[#12121b]', 'text-slate-300', 'border', 'border-slate-700');
      btn.classList.add('btn-chrome', 'text-stone-950', 'font-black');
      AppState.activeFilter = btn.dataset.filter;
      renderAdminAppointments();
    });
  });

  // Pestañas del Panel de Administradora
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectAdminTab(btn.dataset.tab);
    });
  });

  // Búsqueda en admin
  const adminSearchInput = document.getElementById('adminSearchInput');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value.toLowerCase().trim();
      renderAdminAppointments();
    });
  }

  // Agendar Cita Libre (Modal)
  const openFreeBookingModalBtn = document.getElementById('openFreeBookingModalBtn');
  const closeFreeBookingModalBtn = document.getElementById('closeFreeBookingModalBtn');
  const freeBookingForm = document.getElementById('freeBookingForm');
  if (openFreeBookingModalBtn) openFreeBookingModalBtn.addEventListener('click', openFreeBookingModal);
  if (closeFreeBookingModalBtn) closeFreeBookingModalBtn.addEventListener('click', () => document.getElementById('freeBookingModal').classList.add('hidden'));
  if (freeBookingForm) freeBookingForm.addEventListener('submit', handleFreeBookingSubmit);

  // Bloqueo Manual de Horarios
  const openBlockSlotModalBtn = document.getElementById('openBlockSlotModalBtn');
  const closeBlockSlotModalBtn = document.getElementById('closeBlockSlotModalBtn');
  const blockSlotForm = document.getElementById('blockSlotForm');
  if (openBlockSlotModalBtn) openBlockSlotModalBtn.addEventListener('click', openBlockSlotModal);
  if (closeBlockSlotModalBtn) closeBlockSlotModalBtn.addEventListener('click', () => document.getElementById('blockSlotModal').classList.add('hidden'));
  if (blockSlotForm) blockSlotForm.addEventListener('submit', handleBlockSlotSubmit);

  // Formulario de Configuración de Horario de Atención
  const studioScheduleForm = document.getElementById('studioScheduleForm');
  if (studioScheduleForm) studioScheduleForm.addEventListener('submit', handleStudioScheduleSubmit);

  // Agregar / Editar Servicio
  const openNewServiceModalBtn = document.getElementById('openNewServiceModalBtn');
  const closeServiceModalBtn = document.getElementById('closeServiceModalBtn');
  const serviceCrudForm = document.getElementById('serviceCrudForm');
  if (openNewServiceModalBtn) openNewServiceModalBtn.addEventListener('click', () => openServiceModal(null));
  if (closeServiceModalBtn) closeServiceModalBtn.addEventListener('click', () => document.getElementById('serviceCrudModal').classList.add('hidden'));
  if (serviceCrudForm) serviceCrudForm.addEventListener('submit', handleSaveServiceCrud);

  // Restaurar Servicios Oficiales
  const restoreDefaultServicesBtn = document.getElementById('restoreDefaultServicesBtn');
  if (restoreDefaultServicesBtn) restoreDefaultServicesBtn.addEventListener('click', restoreDefaultServices);

  // Formulario de Tarifas de Largos de Uña
  const lengthPriceForm = document.getElementById('lengthPriceForm');
  if (lengthPriceForm) lengthPriceForm.addEventListener('submit', handleSaveLengthPrice);

  // Formulario de Servicios Adicionales (Addons)
  const addonCrudForm = document.getElementById('addonCrudForm');
  if (addonCrudForm) addonCrudForm.addEventListener('submit', handleSaveAddon);

  // Formulario de Niveles de Nail Art
  const designLevelCrudForm = document.getElementById('designLevelCrudForm');
  if (designLevelCrudForm) designLevelCrudForm.addEventListener('submit', handleSaveDesignLevel);

  // Formulario de Bebidas de Cortesía
  const drinkCrudForm = document.getElementById('drinkCrudForm');
  if (drinkCrudForm) drinkCrudForm.addEventListener('submit', handleSaveDrink);

  // Formulario de Opciones de Música
  const musicCrudForm = document.getElementById('musicCrudForm');
  if (musicCrudForm) musicCrudForm.addEventListener('submit', handleSaveMusic);

  // Guardar Marca, Redes Sociales y Fotos (Formulario dentro del panel)
  const brandSettingsForm = document.getElementById('brandSettingsForm');
  if (brandSettingsForm) brandSettingsForm.addEventListener('submit', handleSaveBrandSettings);

  // Modal de Edición Rápida de Perfil, Fotos y Redes
  const quickEditBrandForm = document.getElementById('quickEditBrandForm');
  const closeQuickEditModalBtn = document.getElementById('closeQuickEditModalBtn');
  if (quickEditBrandForm) quickEditBrandForm.addEventListener('submit', handleQuickEditBrandSubmit);
  if (closeQuickEditModalBtn) closeQuickEditModalBtn.addEventListener('click', () => document.getElementById('quickEditBrandModal').classList.add('hidden'));

  // Subida de nueva foto de perfil
  const uploadProfilePhotoInput = document.getElementById('uploadProfilePhotoInput');
  if (uploadProfilePhotoInput) uploadProfilePhotoInput.addEventListener('change', handleUploadProfilePhoto);

  const editModalProfileInput = document.getElementById('editModalProfileInput');
  if (editModalProfileInput) editModalProfileInput.addEventListener('change', handleUploadProfilePhotoModal);

  // Subida de nueva foto de lista de precios
  const uploadPriceFlyerInput = document.getElementById('uploadPriceFlyerInput');
  if (uploadPriceFlyerInput) uploadPriceFlyerInput.addEventListener('change', handleUploadPriceFlyer);

  const editModalPriceInput = document.getElementById('editModalPriceInput');
  if (editModalPriceInput) editModalPriceInput.addEventListener('change', handleUploadPriceFlyerModal);

  // Modal Recordatorio
  const closeReminderModalBtn = document.getElementById('closeReminderModalBtn');
  if (closeReminderModalBtn) closeReminderModalBtn.addEventListener('click', () => document.getElementById('appointmentReminderModal').classList.add('hidden'));

  // Confirmar Cita Final (Cliente)
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  if (confirmBookingBtn) confirmBookingBtn.addEventListener('click', finalizeBooking);

  // WhatsApp post-confirmación
  const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
  if (sendWhatsAppBtn) sendWhatsAppBtn.addEventListener('click', openWhatsAppDirect);

  // Exportar CSV
  const exportDataBtn = document.getElementById('exportDataBtn');
  if (exportDataBtn) exportDataBtn.addEventListener('click', exportAppointmentsCSV);
}

/* ========================================================
   AUTENTICACIÓN, PRIVACIDAD Y SEGURIDAD CON CONTRASEÑA
   ======================================================== */

// Revelar botón de administrador en la barra superior
function revealAdminButton() {
  const navAdminBtn = document.getElementById('navAdminBtn');
  if (navAdminBtn) {
    navAdminBtn.classList.remove('hidden');
  }
}
window.revealAdminButton = revealAdminButton;

// Ocultar botón de administrador del dispositivo actual
function hideAdminButtonPermanently() {
  localStorage.removeItem('delarosa_is_designer');
  sessionStorage.removeItem('delarosa_admin_auth');
  AppState.isAdminAuthenticated = false;
  const navAdminBtn = document.getElementById('navAdminBtn');
  if (navAdminBtn) {
    navAdminBtn.classList.add('hidden');
  }
  switchView('client');
  showToast('Acceso de manicurista ocultado en este dispositivo.', 'info');
}
window.hideAdminButtonPermanently = hideAdminButtonPermanently;

// Verificar visibilidad del panel de manicurista:
// - Para clientas: Oculto 100% de la barra superior
// - Para Julieth: Visible si ya inició sesión en su celular/PC, o si entra por admin.html o ?admin=true
function checkAdminAccessVisibility() {
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const hasAdminQuery = urlParams.has('admin') || urlParams.has('designer') || hash === '#admin' || hash === '#designer';
  const isDesignerStored = localStorage.getItem('delarosa_is_designer') === 'true';

  if (hasAdminQuery || isDesignerStored || AppState.isAdminAuthenticated) {
    revealAdminButton();
  }

  if (hasAdminQuery) {
    if (!AppState.isAdminAuthenticated) {
      setTimeout(() => handleAdminAccess(), 150);
    } else {
      switchView('admin');
    }
  }
}
window.checkAdminAccessVisibility = checkAdminAccessVisibility;

// Triple toque secreto en el Logo o Avatar de Julieth
let secretLogoClicks = 0;
let secretLogoTimer = null;
window.handleSecretLogoClick = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  secretLogoClicks++;
  clearTimeout(secretLogoTimer);

  if (secretLogoClicks >= 3) {
    secretLogoClicks = 0;
    revealAdminButton();
    localStorage.setItem('delarosa_is_designer', 'true');
    handleAdminAccess();
    showToast('🔑 Acceso Especialista Desbloqueado', 'info');
    return;
  }

  secretLogoTimer = setTimeout(() => {
    // Si fue 1 solo clic normal de una clienta, vuelve a la vista de reserva
    if (secretLogoClicks === 1) {
      switchView('client');
    }
    secretLogoClicks = 0;
  }, 450);
};

function handleAdminAccess() {
  revealAdminButton();
  if (AppState.isAdminAuthenticated) {
    switchView('admin');
  } else {
    const modal = document.getElementById('adminAuthModal');
    const input = document.getElementById('adminPasswordInput');
    const errorEl = document.getElementById('adminAuthError');
    if (input) input.value = '';
    if (errorEl) errorEl.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
    if (input) input.focus();
  }
}

function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('adminPasswordInput');
  const errorEl = document.getElementById('adminAuthError');
  const enteredPass = input.value.trim();

  const correctPass = AppState.config.adminPassword || "GabrielyEly25";

  if (enteredPass === correctPass) {
    AppState.isAdminAuthenticated = true;
    sessionStorage.setItem('delarosa_admin_auth', 'true');
    localStorage.setItem('delarosa_is_designer', 'true');
    revealAdminButton();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    document.getElementById('adminAuthModal').classList.add('hidden');
    showToast('¡Bienvenida, Julieth! Acceso concedido.', 'success');

    // Si había una acción pendiente (ej. abrir modal de edición de perfil o cambiar foto)
    if (AppState.onAuthSuccess) {
      const cb = AppState.onAuthSuccess;
      AppState.onAuthSuccess = null;
      cb();
    } else {
      switchView('admin');
    }
  } else {
    if (errorEl) {
      errorEl.textContent = 'Contraseña incorrecta. Acceso restringido únicamente a la manicurista.';
      errorEl.classList.remove('hidden');
    }
    input.focus();
    input.select();
  }
}

function handleAdminLogout() {
  AppState.isAdminAuthenticated = false;
  sessionStorage.removeItem('delarosa_admin_auth');
  showToast('Sesión del panel cerrada correctamente.', 'info');
  switchView('client');
}

function switchView(viewName) {
  AppState.view = viewName;
  const clientSection = document.getElementById('clientBookingSection');
  const adminSection = document.getElementById('adminDashboardSection');
  const navClientBtn = document.getElementById('navClientBtn');
  const navAdminBtn = document.getElementById('navAdminBtn');

  if (viewName === 'client') {
    clientSection.classList.remove('hidden');
    adminSection.classList.add('hidden');
    navClientBtn.classList.add('btn-chrome', 'text-stone-950', 'font-black');
    navClientBtn.classList.remove('text-slate-300', 'font-bold');
    navAdminBtn.classList.remove('btn-chrome', 'text-stone-950', 'font-black');
    navAdminBtn.classList.add('text-slate-300', 'font-bold');
  } else {
    if (!AppState.isAdminAuthenticated) {
      handleAdminAccess();
      return;
    }
    clientSection.classList.add('hidden');
    adminSection.classList.remove('hidden');
    navAdminBtn.classList.add('btn-chrome', 'text-stone-950', 'font-black');
    navAdminBtn.classList.remove('text-slate-300', 'font-bold');
    navClientBtn.classList.remove('btn-chrome', 'text-stone-950', 'font-black');
    navClientBtn.classList.add('text-slate-300', 'font-bold');

    renderAdminAppointments();
    updateAdminMetrics();
  }
}

/* ========================================================
   MODAL DE EDICIÓN RÁPIDA DE PERFIL, FOTOS Y REDES SOCIALES
   ======================================================== */

function selectAdminTab(targetTab) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    if (b.dataset.tab === targetTab) {
      b.classList.add('border-b-2', 'border-white', 'text-white', 'font-bold');
      b.classList.remove('text-slate-400');
    } else {
      b.classList.remove('border-b-2', 'border-white', 'text-white', 'font-bold');
      b.classList.add('text-slate-400');
    }
  });

  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
  const activeContent = document.getElementById(`admin-tab-${targetTab}`);
  if (activeContent) activeContent.classList.remove('hidden');

  if (targetTab === 'services') {
    renderAdminServicesTable();
    renderAdminLengthsTable();
    renderAdminAddonsTable();
    renderAdminDesignLevelsTable();
    renderAdminDrinksList();
    renderAdminMusicList();
  }
  if (targetTab === 'finances') renderFinancesDashboard();
  if (targetTab === 'blocks') renderBlockedSlotsTable();
  if (targetTab === 'brand') loadBrandSettingsForm();
  if (targetTab === 'cloud') loadCloudSyncForm();
}
window.selectAdminTab = selectAdminTab;

function goToAdminPricesTab() {
  if (!AppState.isAdminAuthenticated) {
    AppState.onAuthSuccess = () => goToAdminPricesTab();
    handleAdminAccess();
    return;
  }
  switchView('admin');
  selectAdminTab('services');
  showToast('Aquí puedes editar cada precio en COP, nombres o agregar técnicas', 'info');
}
window.goToAdminPricesTab = goToAdminPricesTab;

function openBrandEditModal() {
  if (!AppState.isAdminAuthenticated) {
    // Si no está autenticada, solicitar la contraseña antes de abrir el editor
    AppState.onAuthSuccess = () => openBrandEditModal();
    handleAdminAccess();
    return;
  }

  const modal = document.getElementById('quickEditBrandModal');
  if (!modal) return;

  const cfg = AppState.config;
  document.getElementById('editModalStudioName').value = cfg.studioName || '';
  document.getElementById('editModalDesignerName').value = cfg.designerName || '';
  document.getElementById('editModalSlogan').value = cfg.slogan || '';
  document.getElementById('editModalPhone').value = cfg.phone || '';
  const emailInput = document.getElementById('editModalEmail');
  if (emailInput) emailInput.value = cfg.email || 'delarosaa02@gmail.com';
  document.getElementById('editModalInstagram').value = cfg.instagram || '';
  document.getElementById('editModalInstagramUrl').value = cfg.instagramUrl || '';
  document.getElementById('editModalFacebook').value = cfg.facebook || '';
  document.getElementById('editModalFacebookUrl').value = cfg.facebookUrl || '';
  document.getElementById('editModalLocation').value = cfg.location || '';
  document.getElementById('editModalPaymentMethods').value = cfg.paymentMethods || '';
  const qStart = document.getElementById('editModalWorkStart');
  if (qStart) qStart.value = (cfg.workingHours && cfg.workingHours.start) || '09:00';
  const qEnd = document.getElementById('editModalWorkEnd');
  if (qEnd) qEnd.value = (cfg.workingHours && cfg.workingHours.end) || '19:00';

  // Actualizar previews de fotos dentro del modal
  const profilePreview = document.getElementById('editModalProfilePreview');
  const pricePreview = document.getElementById('editModalPricePreview');
  if (profilePreview) profilePreview.src = cfg.customProfilePhoto || (window.DELAROSA_PROFILE_B64 || 'assets/img/delarosa_profile.jpg');
  if (pricePreview) pricePreview.src = cfg.customPriceFlyerPhoto || (window.DELAROSA_PRICES_B64 || 'assets/img/delarosa_prices.jpg');

  modal.classList.remove('hidden');
}
window.openBrandEditModal = openBrandEditModal;

async function handleQuickEditBrandSubmit(e) {
  e.preventDefault();
  try {
    AppState.config.studioName = document.getElementById('editModalStudioName').value.trim();
    AppState.config.designerName = document.getElementById('editModalDesignerName').value.trim();
    AppState.config.slogan = document.getElementById('editModalSlogan').value.trim();
    const rawEditPhone = document.getElementById('editModalPhone').value.trim();
    AppState.config.phone = normalizeColombianPhone(rawEditPhone);
    const rawEditEmail = document.getElementById('editModalEmail');
    if (rawEditEmail) AppState.config.email = rawEditEmail.value.trim() || 'delarosaa02@gmail.com';
    AppState.config.instagram = document.getElementById('editModalInstagram').value.trim();
    AppState.config.instagramUrl = document.getElementById('editModalInstagramUrl').value.trim();
    AppState.config.facebook = document.getElementById('editModalFacebook').value.trim();
    AppState.config.facebookUrl = document.getElementById('editModalFacebookUrl').value.trim();
    AppState.config.location = document.getElementById('editModalLocation').value.trim();
    AppState.config.paymentMethods = document.getElementById('editModalPaymentMethods').value.trim();
    const qStart = document.getElementById('editModalWorkStart');
    const qEnd = document.getElementById('editModalWorkEnd');
    if (qStart && qEnd) {
      if (!AppState.config.workingHours) AppState.config.workingHours = {};
      AppState.config.workingHours.start = qStart.value || '09:00';
      AppState.config.workingHours.end = qEnd.value || '19:00';
    }

    await DB.setSetting('studioConfig', AppState.config);
    updateBrandingText();

    document.getElementById('quickEditBrandModal').classList.add('hidden');
    showToast('¡Nombre, fotos y redes sociales guardados exitosamente!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al guardar los cambios.', 'error');
  }
}

// Cambiar foto de perfil desde el modal de edición
async function handleUploadProfilePhotoModal(e) {
  if (e.target.files && e.target.files[0]) {
    try {
      showToast('Optimizando foto de perfil...', 'info');
      const compressed = await DB.compressImage(e.target.files[0], 1200, 0.9);
      AppState.config.customProfilePhoto = compressed;
      await DB.setSetting('studioConfig', AppState.config);
      
      const preview = document.getElementById('editModalProfilePreview');
      if (preview) preview.src = compressed;
      updateBrandingText();
      showToast('¡Foto de perfil actualizada!', 'success');
    } catch (err) {
      showToast('Error al procesar la foto de perfil', 'error');
    }
  }
}

// Cambiar flyer de precios desde el modal de edición
async function handleUploadPriceFlyerModal(e) {
  if (e.target.files && e.target.files[0]) {
    try {
      showToast('Optimizando carta de precios...', 'info');
      const compressed = await DB.compressImage(e.target.files[0], 1400, 0.92);
      AppState.config.customPriceFlyerPhoto = compressed;
      await DB.setSetting('studioConfig', AppState.config);
      
      const preview = document.getElementById('editModalPricePreview');
      if (preview) preview.src = compressed;
      updateBrandingText();
      showToast('¡Carta de precios actualizada!', 'success');
    } catch (err) {
      showToast('Error al procesar la foto de precios', 'error');
    }
  }
}

// Botón para cambiar foto de precios directamente desde el Lightbox
function triggerChangePriceFlyer() {
  if (!AppState.isAdminAuthenticated) {
    AppState.onAuthSuccess = () => triggerChangePriceFlyer();
    handleAdminAccess();
    return;
  }
  const input = document.getElementById('lightboxPriceFlyerUploadInput');
  if (input) input.click();
}
window.triggerChangePriceFlyer = triggerChangePriceFlyer;

async function handleLightboxPriceFlyerUpload(e) {
  if (e.target.files && e.target.files[0]) {
    try {
      showToast('Actualizando carta de precios oficial...', 'info');
      const compressed = await DB.compressImage(e.target.files[0], 1400, 0.92);
      AppState.config.customPriceFlyerPhoto = compressed;
      await DB.setSetting('studioConfig', AppState.config);
      updateBrandingText();

      // Actualizar la foto en el lightbox abierto
      const imgEl = document.getElementById('lightboxModalImage');
      if (imgEl) imgEl.src = compressed;

      showToast('¡La foto de la carta de precios se actualizó con éxito!', 'success');
    } catch (err) {
      showToast('Error al actualizar la foto de precios.', 'error');
    }
  }
}

/* ========================================================
   FLUJO DE AGENDAMIENTO (CLIENT WIZARD)
   ======================================================== */

function renderBookingWizard() {
  updateStepIndicators();
  showCurrentStepCard();
  renderServicesCatalog();
  renderNailShapes();
  renderNailLengths();
  renderAddonsList();
  renderDesignLevels();
  renderAmbienceSection();
  renderDateTimePickers();
  updateLivePriceSummary();
}

function updateStepIndicators() {
  const steps = [1, 2, 3, 4, 5];
  steps.forEach(num => {
    const stepEl = document.getElementById(`step-indicator-${num}`);
    if (!stepEl) return;
    stepEl.classList.remove('active', 'completed');
    if (num === AppState.step) {
      stepEl.classList.add('active');
    } else if (num < AppState.step) {
      stepEl.classList.add('completed');
    }
  });

  const prevStepBtn = document.getElementById('prevStepBtn');
  const nextStepBtn = document.getElementById('nextStepBtn');

  if (prevStepBtn) {
    if (AppState.step === 1) prevStepBtn.classList.add('invisible');
    else prevStepBtn.classList.remove('invisible');
  }

  if (nextStepBtn) {
    if (AppState.step === AppState.totalSteps) {
      nextStepBtn.classList.add('hidden');
    } else {
      nextStepBtn.classList.remove('hidden');
      nextStepBtn.innerHTML = `Continuar <svg class="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
    }
  }
}

function showCurrentStepCard() {
  for (let i = 1; i <= 6; i++) {
    const card = document.getElementById(`step-card-${i}`);
    if (card) {
      if (i === AppState.step) {
        card.classList.remove('hidden');
        card.classList.add('animate-fade-in');
      } else {
        card.classList.add('hidden');
        card.classList.remove('animate-fade-in');
      }
    }
  }
  const topEl = document.getElementById('bookingFormTop');
  if (topEl) topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToNextStep() {
  if (AppState.step === 1) {
    const nameInput = document.getElementById('clientNameInput');
    const phoneInput = document.getElementById('clientPhoneInput');
    const emailInput = document.getElementById('clientEmailInput');
    const instaInput = document.getElementById('clientInstagramInput');

    if (!nameInput.value.trim()) {
      showToast('Por favor, ingresa tu nombre completo', 'warning');
      nameInput.focus();
      return;
    }
    if (!phoneInput.value.trim() || phoneInput.value.trim().length < 7) {
      showToast('Por favor, ingresa tu número de WhatsApp para confirmar tu cupo', 'warning');
      phoneInput.focus();
      return;
    }

    const rawClientPhone = phoneInput.value.trim();
    AppState.booking.clientName = nameInput.value.trim();
    AppState.booking.clientPhone = normalizeColombianPhone(rawClientPhone);
    AppState.booking.clientPhoneDisplay = formatColombianPhoneDisplay(rawClientPhone);
    AppState.booking.clientEmail = emailInput ? emailInput.value.trim() : '';
    AppState.booking.clientInstagram = instaInput ? instaInput.value.trim() : '';
  }

  if (AppState.step === 3) {
    const notesInput = document.getElementById('designNotesInput');
    if (notesInput) AppState.booking.designNotes = notesInput.value.trim();
  }

  if (AppState.step < AppState.totalSteps) {
    AppState.step++;
    if (AppState.step === 5) {
      renderSummaryConfirmationStep();
    }
    updateStepIndicators();
    showCurrentStepCard();
    updateLivePriceSummary();
  }
}

function goToPrevStep() {
  if (AppState.step > 1) {
    AppState.step--;
    updateStepIndicators();
    showCurrentStepCard();
    updateLivePriceSummary();
  }
}

function renderServicesCatalog() {
  const container = document.getElementById('servicesListContainer');
  if (!container) return;

  const currentGender = AppState.booking.gender;

  const filteredServices = AppState.services.filter(s => {
    if (currentGender === 'woman') {
      return s.targetGender === 'woman' || s.targetGender === 'both' || s.category === 'dama' || s.category === 'general';
    } else {
      return s.targetGender === 'man' || s.targetGender === 'both' || s.category === 'hombre' || s.category === 'general';
    }
  });

  container.innerHTML = filteredServices.map(service => {
    const isSelected = AppState.booking.serviceId === service.id;
    const hoursText = Math.floor(service.durationMin / 60);
    const minsText = service.durationMin % 60;
    const durationLabel = `${hoursText > 0 ? hoursText + 'h ' : ''}${minsText > 0 ? minsText + 'm' : ''}`.trim();

    return `
      <div onclick="selectService('${service.id}')" 
           class="selectable-card p-4 rounded-2xl shadow-sm transition-all cursor-pointer ${isSelected ? 'selected' : ''}">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3">
            <div class="w-10 h-10 rounded-xl bg-[#141420] text-white flex items-center justify-center font-bold text-base flex-shrink-0 mt-0.5 border border-slate-700">
              ${service.category === 'hombre' ? '👔' : '✨'}
            </div>
            <div>
              <div class="flex items-center space-x-2 flex-wrap">
                <h4 class="font-bold text-white text-sm sm:text-base">${service.name}</h4>
                ${service.badge ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">${service.badge}</span>` : ''}
              </div>
              <p class="text-xs text-slate-400 mt-1">${service.description || ''}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0 pl-2">
            <span class="text-sm sm:text-base font-extrabold text-white block">${formatCOP(service.price)}</span>
            <span class="text-[11px] text-slate-200 font-bold bg-slate-800 px-2 py-0.5 rounded-md inline-block mt-1 border border-slate-700">⏱️ ~${durationLabel}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.selectService = function(serviceId) {
  AppState.booking.serviceId = serviceId;
  renderServicesCatalog();
  renderDateTimePickers();
  updateLivePriceSummary();
};

function renderNailShapes() {
  const container = document.getElementById('nailShapesContainer');
  if (!container) return;

  container.innerHTML = window.NAIL_SHAPES.map(shape => {
    const isSelected = AppState.booking.shape === shape.id;
    return `
      <div onclick="selectNailShape('${shape.id}')"
           class="selectable-card p-3 rounded-xl text-center transition-all cursor-pointer ${isSelected ? 'selected' : ''}">
        <div class="text-2xl mb-1">${shape.preview}</div>
        <div class="font-bold text-xs text-white">${shape.name}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${shape.desc}</div>
      </div>
    `;
  }).join('');
}

window.selectNailShape = function(shapeId) {
  AppState.booking.shape = shapeId;
  renderNailShapes();
  updateLivePriceSummary();
};

function renderNailLengths() {
  const container = document.getElementById('nailLengthsContainer');
  if (!container) return;

  const lengths = AppState.nailLengths || window.NAIL_LENGTHS;
  container.innerHTML = lengths.map(length => {
    const isSelected = AppState.booking.length === length.id;
    return `
      <button type="button" onclick="selectNailLength('${length.id}')"
              class="flex-1 min-w-[70px] py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                isSelected 
                  ? 'btn-chrome text-stone-950 font-black shadow-md' 
                  : 'bg-[#12121b] text-slate-300 border-slate-700 hover:bg-[#1a1a28] hover:text-white'
              }">
        <span class="block font-bold">${length.tag}</span>
        <span class="text-[10px] opacity-90">${length.name}</span>
        ${length.addPrice > 0 ? `<span class="block text-[10px] font-bold ${isSelected ? 'text-stone-950' : 'text-slate-200'}">+${formatCOP(length.addPrice)}</span>` : ''}
      </button>
    `;
  }).join('');
}

window.selectNailLength = function(lengthId) {
  AppState.booking.length = lengthId;
  renderNailLengths();
  updateLivePriceSummary();
};

function renderAddonsList() {
  const container = document.getElementById('addonsListContainer');
  if (!container) return;

  container.innerHTML = AppState.addons.map(addon => {
    const isChecked = AppState.booking.addons.includes(addon.id);
    return `
      <label class="selectable-card flex items-center justify-between p-3.5 rounded-xl cursor-pointer ${isChecked ? 'selected' : ''}">
        <div class="flex items-center space-x-3">
          <input type="checkbox" onchange="toggleAddon('${addon.id}')" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-slate-200 rounded border-slate-600 focus:ring-slate-500">
          <div>
            <div class="font-bold text-xs text-white">${addon.name}</div>
            <div class="text-[11px] text-slate-400">⏱️ +${addon.extraTime} min · ${addon.desc || ''}</div>
          </div>
        </div>
        <span class="text-xs font-bold text-white">+${formatCOP(addon.price)}</span>
      </label>
    `;
  }).join('');
}

window.toggleAddon = function(addonId) {
  const index = AppState.booking.addons.indexOf(addonId);
  if (index > -1) AppState.booking.addons.splice(index, 1);
  else AppState.booking.addons.push(addonId);
  renderAddonsList();
  renderDateTimePickers();
  updateLivePriceSummary();
};

function renderDesignLevels() {
  const container = document.getElementById('designLevelsContainer');
  if (!container) return;

  const levels = AppState.designLevels || window.DESIGN_LEVELS;
  container.innerHTML = levels.map(level => {
    const isSelected = AppState.booking.designLevel === level.id;
    return `
      <div onclick="selectDesignLevel('${level.id}')"
           class="selectable-card p-3.5 rounded-2xl transition-all cursor-pointer ${isSelected ? 'selected' : ''}">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5">
            <span class="text-xl">${level.icon || '🎨'}</span>
            <div>
              <h5 class="font-bold text-xs text-white">${level.name}</h5>
              <p class="text-[11px] text-slate-400">${level.desc || ''}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold text-white">${level.addPrice > 0 ? `+${formatCOP(level.addPrice)}` : 'Incluido'}</span>
            ${level.extraTime > 0 ? `<span class="block text-[10px] text-slate-400">+${level.extraTime}m</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.selectDesignLevel = function(levelId) {
  AppState.booking.designLevel = levelId;
  renderDesignLevels();
  renderDateTimePickers();
  updateLivePriceSummary();
};

/* ========================================================
   SUBIDA DE FOTOS DE REFERENCIA (CLIENTA)
   ======================================================== */

async function handleImageFilesSelect(e) {
  if (e.target.files && e.target.files.length > 0) {
    await processFiles(e.target.files);
    e.target.value = '';
  }
}

async function processFiles(fileList) {
  const maxImages = 10;
  const remainingSlots = maxImages - AppState.booking.images.length;

  if (remainingSlots <= 0) {
    showToast(`Límite de ${maxImages} fotos alcanzado.`, 'warning');
    return;
  }

  const filesToProcess = Array.from(fileList).slice(0, remainingSlots);
  showToast(`Cargando ${filesToProcess.length} foto(s)...`, 'info');

  for (const file of filesToProcess) {
    try {
      const compressedData = await DB.compressImage(file, 1200, 0.85);
      AppState.booking.images.push({
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: file.name,
        data: compressedData,
        notes: ''
      });
    } catch (err) {
      console.error(err);
      showToast(`Error al procesar ${file.name}`, 'error');
    }
  }

  renderUploadedImagesGallery();
  showToast('¡Fotos agregadas a tu solicitud!', 'success');
}

function renderUploadedImagesGallery() {
  const container = document.getElementById('uploadedImagesGallery');
  const countBadge = document.getElementById('uploadedImagesCount');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${AppState.booking.images.length} fotos`;

  if (AppState.booking.images.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-6 text-center text-stone-400 text-xs">
        Sin fotos adjuntas aún. Puedes subir capturas de Instagram, Pinterest o tus fotos personales.
      </div>
    `;
    return;
  }

  container.innerHTML = AppState.booking.images.map((img, idx) => `
    <div class="image-thumb-card">
      <img src="${img.data}" alt="${img.name}" onclick="openLightbox('${img.id}')" class="cursor-pointer" />
      <div class="overlay-actions">
        <span class="text-[10px] text-white font-bold bg-black/60 px-2 py-0.5 rounded-full">#${idx + 1}</span>
        <div class="flex items-center space-x-1">
          <button type="button" onclick="editImageNotes('${img.id}')" title="Nota" class="p-1.5 rounded-lg bg-white/90 text-stone-800 text-xs">✏️</button>
          <button type="button" onclick="removeUploadedImage('${img.id}')" title="Borrar" class="p-1.5 rounded-lg bg-stone-900/90 text-white text-xs">🗑️</button>
        </div>
      </div>
      ${img.notes ? `<div class="absolute bottom-0 inset-x-0 bg-black/90 text-[10px] text-white font-bold px-2 py-0.5 truncate border-t border-slate-700">📝 ${img.notes}</div>` : ''}
    </div>
  `).join('');
}

window.removeUploadedImage = function(imgId) {
  AppState.booking.images = AppState.booking.images.filter(i => i.id !== imgId);
  renderUploadedImagesGallery();
};

window.editImageNotes = function(imgId) {
  const img = AppState.booking.images.find(i => i.id === imgId);
  if (!img) return;
  const newNote = prompt('Indica qué detalle te gusta de esta foto (ej. "Solo el tono de base", "La forma de la uña"):', img.notes || '');
  if (newNote !== null) {
    img.notes = newNote.trim();
    renderUploadedImagesGallery();
  }
};

/* ========================================================
   AMBIENTE Y EXPERIENCIA VIP
   ======================================================== */

function renderAmbienceSection() {
  const ambience = AppState.ambienceOptions || window.AMBIENCE_OPTIONS;

  const vibeContainer = document.getElementById('ambienceVibeContainer');
  if (vibeContainer && ambience.vibe) {
    vibeContainer.innerHTML = ambience.vibe.map(v => {
      const isSelected = AppState.booking.ambience.vibe === v.id;
      return `
        <div onclick="selectAmbienceVibe('${v.id}')"
             class="selectable-card p-3 rounded-xl cursor-pointer ${isSelected ? 'selected' : ''}">
          <h5 class="font-bold text-xs text-white">${v.label}</h5>
          <p class="text-[11px] text-slate-400 mt-0.5">${v.desc || ''}</p>
        </div>
      `;
    }).join('');
  }

  const drinkContainer = document.getElementById('ambienceDrinkContainer');
  if (drinkContainer && ambience.drink) {
    drinkContainer.innerHTML = ambience.drink.map(d => {
      const isSelected = AppState.booking.ambience.drink === d.id;
      return `
        <button type="button" onclick="selectAmbienceDrink('${d.id}')"
                class="py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                  isSelected ? 'btn-chrome text-stone-950 font-black shadow-md' : 'bg-[#12121b] border-slate-700 text-slate-300 hover:bg-[#1a1a28] hover:text-white'
                }">
          ${d.label}
        </button>
      `;
    }).join('');
  }

  // Control de Entretenimiento (Música vs Película/Serie vs Silencio)
  const entType = AppState.booking.ambience.entertainmentType || 'music';
  const entBtnMusic = document.getElementById('entBtnMusic');
  const entBtnMovie = document.getElementById('entBtnMovie');
  const entBtnSilence = document.getElementById('entBtnSilence');
  const musicSection = document.getElementById('entertainmentMusicSection');
  const movieSection = document.getElementById('entertainmentMovieSection');
  const silenceSection = document.getElementById('entertainmentSilenceSection');

  if (entBtnMusic && entBtnMovie && entBtnSilence) {
    [entBtnMusic, entBtnMovie, entBtnSilence].forEach(b => {
      b.classList.remove('btn-chrome', 'text-stone-950', 'font-black', 'shadow-md');
      b.classList.add('bg-[#12121b]', 'border-slate-700', 'text-slate-300');
    });

    if (entType === 'movie') {
      entBtnMovie.classList.remove('bg-[#12121b]', 'border-slate-700', 'text-slate-300');
      entBtnMovie.classList.add('btn-chrome', 'text-stone-950', 'font-black', 'shadow-md');
      if (movieSection) movieSection.classList.remove('hidden');
      if (musicSection) musicSection.classList.add('hidden');
      if (silenceSection) silenceSection.classList.add('hidden');
    } else if (entType === 'silence') {
      entBtnSilence.classList.remove('bg-[#12121b]', 'border-slate-700', 'text-slate-300');
      entBtnSilence.classList.add('btn-chrome', 'text-stone-950', 'font-black', 'shadow-md');
      if (silenceSection) silenceSection.classList.remove('hidden');
      if (musicSection) musicSection.classList.add('hidden');
      if (movieSection) movieSection.classList.add('hidden');
    } else {
      entBtnMusic.classList.remove('bg-[#12121b]', 'border-slate-700', 'text-slate-300');
      entBtnMusic.classList.add('btn-chrome', 'text-stone-950', 'font-black', 'shadow-md');
      if (musicSection) musicSection.classList.remove('hidden');
      if (movieSection) movieSection.classList.add('hidden');
      if (silenceSection) silenceSection.classList.add('hidden');
    }
  }

  const movieInput = document.getElementById('movieSeriesTitleInput');
  if (movieInput && AppState.booking.ambience.movieSeriesTitle !== undefined) {
    if (document.activeElement !== movieInput) {
      movieInput.value = AppState.booking.ambience.movieSeriesTitle;
    }
  }

  const musicContainer = document.getElementById('ambienceMusicContainer');
  if (musicContainer && ambience.music) {
    musicContainer.innerHTML = ambience.music.map(m => {
      const isSelected = AppState.booking.ambience.music === m.id;
      return `
        <button type="button" onclick="selectAmbienceMusic('${m.id}')"
                class="py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-left ${
                  isSelected ? 'btn-chrome text-stone-950 font-black shadow-md' : 'bg-[#12121b] border-slate-700 text-slate-300 hover:bg-[#1a1a28] hover:text-white'
                }">
          ${m.label}
        </button>
      `;
    }).join('');
  }

  const sensContainer = document.getElementById('ambienceSensitivitiesContainer');
  if (sensContainer && ambience.sensitivities) {
    sensContainer.innerHTML = ambience.sensitivities.map(s => {
      const isChecked = AppState.booking.ambience.sensitivities.includes(s.id);
      return `
        <label class="selectable-card flex items-center space-x-2.5 p-2.5 rounded-xl cursor-pointer text-xs text-slate-200 ${isChecked ? 'selected' : ''}">
          <input type="checkbox" onchange="toggleSensitivity('${s.id}')" ${isChecked ? 'checked' : ''} class="w-4 h-4 text-slate-200 rounded border-slate-600">
          <span>${s.label}</span>
        </label>
      `;
    }).join('');
  }
}

window.selectAmbienceVibe = function(v) { AppState.booking.ambience.vibe = v; renderAmbienceSection(); };
window.selectAmbienceDrink = function(d) { AppState.booking.ambience.drink = d; renderAmbienceSection(); };
window.selectAmbienceMusic = function(m) { AppState.booking.ambience.music = m; renderAmbienceSection(); };

window.setEntertainmentType = function(type) {
  AppState.booking.ambience.entertainmentType = type;
  renderAmbienceSection();
};

window.updateMovieSeriesTitle = function(title) {
  AppState.booking.ambience.movieSeriesTitle = title;
};

window.quickSelectMovie = function(title) {
  AppState.booking.ambience.movieSeriesTitle = title;
  const input = document.getElementById('movieSeriesTitleInput');
  if (input) input.value = title;
};

window.toggleSensitivity = function(s) {
  const list = AppState.booking.ambience.sensitivities;
  const idx = list.indexOf(s);
  if (idx > -1) list.splice(idx, 1);
  else list.push(s);
  renderAmbienceSection();
};

/* ========================================================
   CÁLCULO INTELIGENTE DE TIEMPOS Y BLOQUEO DE HORARIOS
   ======================================================== */

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function calculateAppointmentDuration() {
  const service = AppState.services.find(s => s.id === AppState.booking.serviceId) || AppState.services[0];
  let duration = service ? service.durationMin : 240;

  AppState.booking.addons.forEach(addonId => {
    const add = AppState.addons.find(a => a.id === addonId);
    if (add && add.extraTime) duration += add.extraTime;
  });

  const designLevels = AppState.designLevels || window.DESIGN_LEVELS;
  const design = designLevels.find(d => d.id === AppState.booking.designLevel);
  if (design && design.extraTime) duration += design.extraTime;

  return duration;
}

function renderDateTimePickers() {
  const dateInput = document.getElementById('bookingDateInput');
  const today = new Date().toISOString().split('T')[0];
  if (dateInput) {
    dateInput.min = today;
    if (!dateInput.value) {
      dateInput.value = today;
      AppState.booking.date = today;
    }
    dateInput.addEventListener('change', (e) => {
      AppState.booking.date = e.target.value;
      renderTimeSlots();
      updateLivePriceSummary();
    });
  }

  renderTimeSlots();
}

function renderTimeSlots() {
  const slotsContainer = document.getElementById('timeSlotsContainer');
  const infoDurationEl = document.getElementById('slotDurationInfo');
  if (!slotsContainer) return;

  const durationMin = calculateAppointmentDuration();
  AppState.booking.durationMin = durationMin;

  const hoursNeeded = Math.floor(durationMin / 60);
  const minsNeeded = durationMin % 60;
  const durationLabel = `${hoursNeeded > 0 ? hoursNeeded + ' hora(s) ' : ''}${minsNeeded > 0 ? minsNeeded + ' min' : ''}`.trim();

  if (infoDurationEl) {
    infoDurationEl.innerHTML = `⏱️ Duración estimada del servicio: <strong class="text-white">${durationLabel}</strong> (bloquea el horario completo para asegurar un trabajo sin prisas).`;
  }

  const workStart = timeToMinutes(AppState.config.workingHours?.start || "09:00");
  const workEnd = timeToMinutes(AppState.config.workingHours?.end || "19:00");
  const interval = AppState.config.workingHours?.slotInterval || 30;

  const candidateSlots = [];
  for (let m = workStart; m <= workEnd - durationMin; m += interval) {
    candidateSlots.push(minutesToTime(m));
  }

  const activeAppointments = AppState.appointments.filter(a => a.date === AppState.booking.date && a.status !== 'cancelled');
  const manualBlocks = AppState.blockedSlots.filter(b => b.date === AppState.booking.date);

  const occupiedIntervals = [];

  activeAppointments.forEach(apt => {
    const startM = timeToMinutes(apt.time);
    const endM = startM + (apt.durationMin || 180);
    occupiedIntervals.push({ start: startM, end: endM, label: `${apt.clientName} (${apt.serviceName})` });
  });

  manualBlocks.forEach(b => {
    occupiedIntervals.push({ start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime), label: b.reason || 'Bloqueado por estudio' });
  });

  let selectedIsAvailable = false;

  const slotButtonsHtml = candidateSlots.map(slotTime => {
    const slotStart = timeToMinutes(slotTime);
    const slotEnd = slotStart + durationMin;

    const conflict = occupiedIntervals.find(occ => {
      return Math.max(slotStart, occ.start) < Math.min(slotEnd, occ.end);
    });

    const isOccupied = !!conflict;
    const isSelected = AppState.booking.time === slotTime && !isOccupied;
    if (isSelected) selectedIsAvailable = true;

    if (isOccupied) {
      return `
        <div class="p-2 rounded-xl text-center border border-slate-800 bg-[#0c0c14] text-slate-500 text-xs cursor-not-allowed opacity-50">
          <span class="font-bold line-through">${slotTime}</span>
          <span class="block text-[9px] text-slate-500">Ocupado</span>
        </div>
      `;
    }

    return `
      <button type="button" onclick="selectTimeSlot('${slotTime}')"
              class="p-2.5 rounded-xl text-center border transition-all text-xs font-bold ${
                isSelected 
                  ? 'btn-chrome text-stone-950 font-black shadow-md ring-2 ring-white' 
                  : 'bg-[#12121b] text-slate-200 border-slate-700 hover:border-slate-400 hover:bg-[#1a1a28]'
              }">
        <span>${slotTime}</span>
        <span class="block text-[10px] ${isSelected ? 'text-stone-900' : 'text-slate-400'} font-normal">Hasta ${minutesToTime(slotEnd)}</span>
      </button>
    `;
  }).join('');

  slotsContainer.innerHTML = slotButtonsHtml || `<div class="col-span-full py-4 text-center text-xs text-slate-400">No hay cupos disponibles de ${durationLabel} en esta fecha. Selecciona otro día.</div>`;

  if (!selectedIsAvailable) {
    const firstFree = candidateSlots.find(slotTime => {
      const s = timeToMinutes(slotTime);
      const e = s + durationMin;
      return !occupiedIntervals.some(occ => Math.max(s, occ.start) < Math.min(e, occ.end));
    });
    if (firstFree) AppState.booking.time = firstFree;
  }
}

window.selectTimeSlot = function(time) {
  AppState.booking.time = time;
  renderTimeSlots();
  updateLivePriceSummary();
};

/* ========================================================
   COTIZACIÓN Y RESUMEN EN PESOS COLOMBIANOS
   ======================================================== */

function calculatePricing() {
  const service = AppState.services.find(s => s.id === AppState.booking.serviceId) || AppState.services[0];
  const lengths = AppState.nailLengths || window.NAIL_LENGTHS;
  const designLevels = AppState.designLevels || window.DESIGN_LEVELS;
  const length = lengths.find(l => l.id === AppState.booking.length) || lengths[0];
  const design = designLevels.find(d => d.id === AppState.booking.designLevel) || designLevels[0];

  let addonsTotal = 0;
  AppState.booking.addons.forEach(addonId => {
    const add = AppState.addons.find(a => a.id === addonId);
    if (add) addonsTotal += add.price;
  });

  const basePrice = service ? service.price : 40000;
  const lengthPrice = length ? length.addPrice : 0;
  const designPrice = design ? design.addPrice : 0;
  const totalPrice = basePrice + lengthPrice + designPrice + addonsTotal;

  const depositPercent = AppState.config.depositPercentage || 30;
  const depositAmount = Math.round((totalPrice * depositPercent) / 100);
  const durationMin = calculateAppointmentDuration();

  return {
    service,
    length,
    design,
    totalPrice,
    depositAmount,
    durationMin
  };
}

function updateLivePriceSummary() {
  const calc = calculatePricing();

  document.querySelectorAll('.summary-total-price').forEach(el => el.textContent = formatCOP(calc.totalPrice));
  document.querySelectorAll('.summary-deposit-price').forEach(el => el.textContent = formatCOP(calc.depositAmount));
  document.querySelectorAll('.summary-service-name').forEach(el => el.textContent = calc.service ? calc.service.name : '');

  const h = Math.floor(calc.durationMin / 60);
  const m = calc.durationMin % 60;
  const durStr = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
  document.querySelectorAll('.summary-duration-time').forEach(el => el.textContent = `~${durStr}`);
}

function renderSummaryConfirmationStep() {
  const calc = calculatePricing();
  const shape = window.NAIL_SHAPES.find(s => s.id === AppState.booking.shape) || window.NAIL_SHAPES[0];
  const ambience = AppState.ambienceOptions || window.AMBIENCE_OPTIONS;
  const vibe = ambience.vibe?.find(v => v.id === AppState.booking.ambience.vibe);
  const drink = ambience.drink?.find(d => d.id === AppState.booking.ambience.drink);
  const music = ambience.music?.find(m => m.id === AppState.booking.ambience.music);

  let entLabel = '🎵 Música / Playlists';
  if (AppState.booking.ambience.entertainmentType === 'movie') {
    entLabel = `🎬 Película o Serie TV: ${AppState.booking.ambience.movieSeriesTitle || 'A coordinar al llegar'}`;
  } else if (AppState.booking.ambience.entertainmentType === 'silence') {
    entLabel = '🔇 Modo Zen (Silencio total y descanso)';
  } else if (music) {
    entLabel = `🎵 Música: ${music.label}`;
  }

  const container = document.getElementById('confirmationSummaryTicket');
  if (!container) return;

  const endTime = minutesToTime(timeToMinutes(AppState.booking.time || "09:00") + calc.durationMin);

  container.innerHTML = `
    <div class="ticket-container rounded-2xl p-6 shadow-xl border border-slate-700 bg-[#101018]">
      <div class="text-center pb-4 border-b border-slate-800">
        <div class="logo-chrome-badge w-12 h-12 mx-auto mb-2">
          <img src="assets/img/delarosa_logo_clean.png" onerror="if(window.DELAROSA_LOGO_B64){this.onerror=null;this.src=window.DELAROSA_LOGO_B64;}" alt="Delarosa Logo" class="w-full h-full object-contain rounded-full">
        </div>
        <h3 class="font-extrabold text-xl text-white font-serif-luxury">${AppState.config.studioName}</h3>
        <p class="text-xs text-slate-300 font-bold tracking-wider uppercase mt-0.5">${AppState.config.designerName} · ${AppState.config.slogan}</p>
        <span class="text-[11px] text-slate-400 block mt-1">📍 ${AppState.config.location}</span>
      </div>

      <div class="py-4 space-y-2.5 text-xs">
        <div class="flex justify-between items-center text-slate-300">
          <span class="font-medium">Clienta:</span>
          <span class="font-bold text-white">${AppState.booking.clientName}</span>
        </div>
        <div class="flex justify-between items-center text-slate-300">
          <span class="font-medium">WhatsApp:</span>
          <span class="font-bold text-white">${formatColombianPhoneDisplay(AppState.booking.clientPhone)}</span>
        </div>
        ${AppState.booking.clientInstagram ? `
          <div class="flex justify-between items-center text-slate-300">
            <span class="font-medium">Instagram:</span>
            <span class="font-bold text-white">${AppState.booking.clientInstagram}</span>
          </div>
        ` : ''}

        <div class="ticket-divider my-2.5"></div>

        <div class="flex justify-between items-center text-slate-300">
          <span class="font-medium">Servicio Principal:</span>
          <span class="font-bold text-white">${calc.service ? calc.service.name : ''}</span>
        </div>
        <div class="flex justify-between items-center text-slate-300">
          <span class="font-medium">Estructura & Largo:</span>
          <span class="font-semibold text-slate-200">${shape.name} · ${calc.length.name}</span>
        </div>
        <div class="flex justify-between items-center text-slate-300">
          <span class="font-medium">Nail Art:</span>
          <span class="font-semibold text-slate-200">${calc.design.name}</span>
        </div>

        <div class="ticket-divider my-2.5"></div>

        <div class="flex justify-between items-center text-slate-200 font-bold">
          <span>Fecha y Horario Reservado:</span>
          <span class="text-white text-sm">📅 ${AppState.booking.date} · ⏰ ${AppState.booking.time} a ${endTime}</span>
        </div>
        <div class="flex justify-between items-center text-slate-400">
          <span>Tiempo Bloqueado en Agenda:</span>
          <span class="font-bold text-white">⏱️ ${Math.floor(calc.durationMin / 60)}h ${calc.durationMin % 60}m</span>
        </div>

        <div class="p-3 rounded-xl bg-[#0c0c14] border border-slate-800 text-[11px] text-slate-300 space-y-1">
          <span class="font-bold text-white block">🤍 Experiencia de Ambiente Elegida:</span>
          <div>• ${vibe ? vibe.label : 'Normal'}</div>
          <div>• Bebida: ${drink ? drink.label : 'Ninguna'}</div>
          <div>• Entretenimiento: ${entLabel}</div>
          <div>• Fotos de inspiración adjuntas: <strong>${AppState.booking.images.length} fotos</strong></div>
        </div>

        <div class="ticket-divider my-2.5"></div>

        <div class="flex justify-between items-center text-white text-sm">
          <span class="font-extrabold">Total del Servicio:</span>
          <span class="font-extrabold text-lg text-white">${formatCOP(calc.totalPrice)}</span>
        </div>
        <div class="flex justify-between items-center text-slate-100 font-bold text-xs bg-[#161622] p-2.5 rounded-xl border border-slate-700">
          <span>Anticipo para apartar cupo (${AppState.config.depositPercentage}%):</span>
          <span class="font-extrabold text-base text-white">${formatCOP(calc.depositAmount)}</span>
        </div>
      </div>

      <div class="mt-3 p-3 bg-[#0d0d14] rounded-xl text-[11px] text-slate-300 border border-slate-800">
        <span class="font-bold block text-white">💳 Métodos de Pago del Anticipo:</span>
        <p class="mt-1">${AppState.config.paymentMethods}</p>
      </div>
    </div>
  `;
}

/* ========================================================
   CONFIRMACIÓN Y ENVÍO A WHATSAPP
   ======================================================== */

async function finalizeBooking() {
  try {
    const calc = calculatePricing();
    const shape = window.NAIL_SHAPES.find(s => s.id === AppState.booking.shape) || window.NAIL_SHAPES[0];
    const ambience = AppState.ambienceOptions || window.AMBIENCE_OPTIONS;
    const vibe = ambience.vibe?.find(v => v.id === AppState.booking.ambience.vibe);
    const drink = ambience.drink?.find(d => d.id === AppState.booking.ambience.drink);

    const newAppointment = {
      id: 'CITA-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000),
      clientName: AppState.booking.clientName,
      clientPhone: AppState.booking.clientPhone,
      clientEmail: AppState.booking.clientEmail,
      clientInstagram: AppState.booking.clientInstagram,
      gender: AppState.booking.gender,
      isFirstTime: AppState.booking.isFirstTime,
      serviceId: AppState.booking.serviceId,
      serviceName: calc.service ? calc.service.name : 'Servicio de Uñas',
      shape: shape.name,
      length: calc.length.name,
      designLevel: calc.design.name,
      designNotes: AppState.booking.designNotes,
      addons: AppState.booking.addons.map(id => AppState.addons.find(a => a.id === id)?.name).filter(Boolean),
      ambience: {
        vibe: vibe ? vibe.label : 'Normal',
        entertainmentType: AppState.booking.ambience.entertainmentType || 'music',
        movieSeriesTitle: AppState.booking.ambience.movieSeriesTitle || '',
        music: AppState.booking.ambience.music,
        drink: drink ? drink.label : 'Ninguna',
        sensitivities: AppState.booking.ambience.sensitivities
      },
      date: AppState.booking.date,
      time: AppState.booking.time,
      durationMin: calc.durationMin,
      totalPrice: calc.totalPrice,
      depositAmount: calc.depositAmount,
      status: 'pending',
      images: AppState.booking.images,
      createdAt: new Date().toISOString()
    };

    await DB.saveAppointment(newAppointment);
    AppState.appointments.unshift(newAppointment);
    AppState.lastBookedAppointment = newAppointment;

    // Disparar envío automático de notificación por correo (estilo lista universitaria)
    if (newAppointment.clientEmail && newAppointment.clientEmail.includes('@')) {
      sendAutomatedEmailNotification(newAppointment, 'booking');
      const emailMsgEl = document.getElementById('clientEmailAutoStatusMsg');
      if (emailMsgEl) {
        emailMsgEl.innerHTML = `¡Listo! Se ha enviado la confirmación y alarma automática a tu correo <strong>${newAppointment.clientEmail}</strong>.`;
      }
    }

    AppState.step = 6;
    showCurrentStepCard();
    document.getElementById('bookingSuccessAppointmentId').textContent = newAppointment.id;

    showToast('¡Cita agendada y alarma preparada con éxito!', 'success');

  } catch (err) {
    console.error('Error al guardar cita:', err);
    showToast('Error al registrar la cita.', 'error');
  }
}

function dataURLtoFile(dataurl, filename) {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.error('Error convirtiendo imagen a archivo:', e);
    return null;
  }
}
window.dataURLtoFile = dataURLtoFile;

function generateGoogleCalendarLinkForDesigner(apt) {
  if (!apt) return '#';
  const startIso = apt.date.replace(/-/g, '') + 'T' + apt.time.replace(':', '') + '00';
  const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
  const endIso = apt.date.replace(/-/g, '') + 'T' + minutesToTime(endMin).replace(':', '') + '00';
  const title = encodeURIComponent(`💅 Cita: ${apt.clientName} - ${apt.serviceName} (${apt.shape || 'Uñas'})`);
  const details = encodeURIComponent(
    `🔔 CITA AGENDADA EN DELAROSA NAIL DESIGNER\n` +
    `👤 Clienta: ${apt.clientName}\n` +
    `📱 Cel/WhatsApp: ${formatColombianPhoneDisplay(apt.clientPhone)}\n` +
    (apt.clientInstagram ? `📸 Instagram: ${apt.clientInstagram}\n` : '') +
    `💅 Servicio: ${apt.serviceName}\n` +
    `💎 Estructura: ${apt.shape || 'Natural'} (${apt.length || 'Estándar'})\n` +
    `🎨 Nivel de Diseño: ${apt.designLevel || 'Básico'}\n` +
    (apt.designNotes ? `📝 Notas: ${apt.designNotes}\n` : '') +
    `☕ Bebida: ${apt.ambience?.drink || 'Sin bebida'}\n` +
    `🎬 Entretenimiento: ${apt.ambience?.movieSeriesTitle ? `Película/Serie: ${apt.ambience.movieSeriesTitle}` : (apt.ambience?.music || 'Música')}\n` +
    `💰 Total: ${formatCOP(apt.totalPrice)} | Anticipo: ${formatCOP(apt.depositAmount)}\n` +
    `📍 Ubicación: ${AppState.config.location}\n\n` +
    `⏰ Alarma con sonido configurada en tu celular: 24h, 2h, 1h y 10 minutos antes.`
  );
  const location = encodeURIComponent(AppState.config.location);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}
window.generateGoogleCalendarLinkForDesigner = generateGoogleCalendarLinkForDesigner;

function generateOutlookCalendarLinkForDesigner(apt) {
  if (!apt) return '#';
  const startDt = `${apt.date}T${apt.time}:00`;
  const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
  const endDt = `${apt.date}T${minutesToTime(endMin)}:00`;
  const subject = encodeURIComponent(`💅 Cita: ${apt.clientName} - ${apt.serviceName}`);
  const body = encodeURIComponent(
    `🔔 CITA AGENDADA EN DELAROSA NAIL DESIGNER\n` +
    `👤 Clienta: ${apt.clientName}\n` +
    `📱 Cel/WhatsApp: ${formatColombianPhoneDisplay(apt.clientPhone)}\n` +
    (apt.clientInstagram ? `📸 Instagram: ${apt.clientInstagram}\n` : '') +
    `💅 Servicio: ${apt.serviceName}\n` +
    `💎 Estructura: ${apt.shape || 'Natural'} (${apt.length || 'Estándar'})\n` +
    `🎨 Nivel: ${apt.designLevel || 'Básico'}\n` +
    (apt.designNotes ? `📝 Notas: ${apt.designNotes}\n` : '') +
    `☕ Bebida: ${apt.ambience?.drink || 'Sin bebida'}\n` +
    `🎬 Entretenimiento: ${apt.ambience?.movieSeriesTitle ? `Película/Serie: ${apt.ambience.movieSeriesTitle}` : (apt.ambience?.music || 'Música')}\n` +
    `💰 Total: ${formatCOP(apt.totalPrice)} | Anticipo: ${formatCOP(apt.depositAmount)}\n` +
    `📍 Ubicación: ${AppState.config.location}\n\n` +
    `⏰ Alarma con sonido configurada a los 4 tiempos (24h, 2h, 1h, 10min).`
  );
  const location = encodeURIComponent(AppState.config.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&startdt=${encodeURIComponent(startDt)}&enddt=${encodeURIComponent(endDt)}&subject=${subject}&body=${body}&location=${location}`;
}
window.generateOutlookCalendarLinkForDesigner = generateOutlookCalendarLinkForDesigner;

async function openWhatsAppDirect() {
  const apt = AppState.lastBookedAppointment;
  if (!apt) return;

  const endTime = minutesToTime(timeToMinutes(apt.time) + (apt.durationMin || 180));

  let entMsg = '';
  if (apt.ambience?.entertainmentType === 'movie') {
    entMsg = `🎬 *En Pantalla TV:* Película/Serie: ${apt.ambience.movieSeriesTitle || 'Por acordar al llegar'}\n`;
  } else if (apt.ambience?.entertainmentType === 'silence') {
    entMsg = `🔇 *Entretenimiento:* Silencio Total / Modo Zen\n`;
  } else {
    entMsg = `🎵 *Música:* ${apt.ambience?.music || 'Lofi / Relajante'}\n`;
  }

  const calLink = generateGoogleCalendarLinkForDesigner(apt);
  const outlookLink = generateOutlookCalendarLinkForDesigner(apt);

  const plainMessage = `✨ *¡Hola ${AppState.config.designerName} / ${AppState.config.studioName}!* ✨\n\n` +
    `Acabo de agendar una cita desde la app. Aquí están mis detalles:\n\n` +
    `📋 *Código:* ${apt.id}\n` +
    `👤 *Clienta:* ${apt.clientName}\n` +
    `📱 *WhatsApp:* ${formatColombianPhoneDisplay(apt.clientPhone)}\n` +
    (apt.clientInstagram ? `📸 *Instagram:* ${apt.clientInstagram}\n` : '') +
    `💅 *Servicio:* ${apt.serviceName}\n` +
    `💎 *Estructura:* ${apt.shape || 'Natural'} (${apt.length || 'Estándar'})\n` +
    `🎨 *Nivel de Diseño:* ${apt.designLevel || 'Básico'}\n` +
    (apt.designNotes ? `📝 *Detalles de Diseño:* ${apt.designNotes}\n` : '') +
    `📅 *Fecha:* ${apt.date}\n` +
    `⏰ *Horario Reservado:* ${apt.time} a ${endTime} (${Math.floor((apt.durationMin||180)/60)}h ${(apt.durationMin||180)%60}m)\n\n` +
    `🤫 *Preferencia de Ambiente:* ${apt.ambience?.vibe || 'Normal'}\n` +
    `☕ *Bebida:* ${apt.ambience?.drink || 'Sin bebida'}\n` +
    entMsg +
    `🖼️ *Fotos de Referencia:* ${apt.images && apt.images.length > 0 ? `${apt.images.length} fotos adjuntas` : 'Sin fotos adjuntas'}\n\n` +
    `💰 *Total:* ${formatCOP(apt.totalPrice)}\n` +
    `💳 *Anticipo a transferir:* ${formatCOP(apt.depositAmount)}\n\n` +
    `_Quedo pendiente de tus datos para enviarte el comprobante de pago del anticipo. ¡Muchas gracias!_\n\n` +
    `────────────────────────\n` +
    `🔔 *Julieth: Toca para agregar la cita y activar alarma a tu calendario:* 👇\n` +
    `📅 *Google / Gmail:* ${calLink}\n\n` +
    `📬 *Outlook / Hotmail:* ${outlookLink}`;

  const phone = normalizeColombianPhone(AppState.config.phone || '573226376819');

  // Si hay fotos de referencia, intentar compartirlas como archivos nativos con Web Share API (WhatsApp móvil)
  if (apt.images && apt.images.length > 0 && navigator.canShare) {
    try {
      const filesToShare = [];
      for (let i = 0; i < apt.images.length; i++) {
        const imgObj = apt.images[i];
        if (imgObj && imgObj.data && imgObj.data.startsWith('data:')) {
          const ext = imgObj.data.includes('png') ? 'png' : 'jpg';
          const file = dataURLtoFile(imgObj.data, `referencia_uñas_${i + 1}.${ext}`);
          if (file) filesToShare.push(file);
        }
      }

      if (filesToShare.length > 0 && navigator.canShare({ files: filesToShare })) {
        showToast('Abriendo WhatsApp con tus fotos adjuntas...', 'info');
        await navigator.share({
          title: `Cita ${apt.id} - ${apt.clientName}`,
          text: plainMessage,
          files: filesToShare
        });
        return;
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') {
        return; // Usuario canceló la hoja de compartir
      }
      console.warn('Web Share no disponible, usando enlace wa.me:', shareErr);
    }
  }

  // Fallback directo a WhatsApp wa.me
  const encodedMessage = encodeURIComponent(plainMessage);
  window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
}

/* ========================================================
   PANEL ADMINISTRADORA / MANICURISTA
   ======================================================== */

function updateAdminMetrics() {
  const todayStr = new Date().toISOString().split('T')[0];
  const activeApts = AppState.appointments.filter(a => a.status !== 'cancelled');

  const todayCount = activeApts.filter(a => a.date === todayStr).length;
  const pendingCount = AppState.appointments.filter(a => a.status === 'pending').length;
  const confirmedCount = AppState.appointments.filter(a => a.status === 'confirmed').length;
  const totalRevenue = activeApts.reduce((sum, a) => sum + (a.totalPrice || 0), 0);

  const mToday = document.getElementById('metricTodayCount');
  const mPending = document.getElementById('metricPendingCount');
  const mConfirmed = document.getElementById('metricConfirmedCount');
  const mRevenue = document.getElementById('metricTotalRevenue');

  if (mToday) mToday.textContent = todayCount;
  if (mPending) mPending.textContent = pendingCount;
  if (mConfirmed) mConfirmed.textContent = confirmedCount;
  if (mRevenue) mRevenue.textContent = formatCOP(totalRevenue);
}

function renderAdminAppointments() {
  const container = document.getElementById('adminAppointmentsList');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  let filtered = AppState.appointments.filter(apt => {
    if (AppState.activeFilter === 'today' && apt.date !== todayStr) return false;
    if (AppState.activeFilter === 'tomorrow' && apt.date !== tomorrowStr) return false;
    if (AppState.activeFilter === 'pending' && apt.status !== 'pending') return false;
    if (AppState.activeFilter === 'confirmed' && apt.status !== 'confirmed') return false;

    if (AppState.searchQuery) {
      const matchName = apt.clientName.toLowerCase().includes(AppState.searchQuery);
      const matchPhone = apt.clientPhone.toLowerCase().includes(AppState.searchQuery);
      const matchService = apt.serviceName.toLowerCase().includes(AppState.searchQuery);
      const matchId = apt.id.toLowerCase().includes(AppState.searchQuery);
      return matchName || matchPhone || matchService || matchId;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center glass-panel rounded-2xl border border-slate-800">
        <div class="text-3xl mb-2">📋</div>
        <h4 class="font-bold text-white text-sm">No hay citas en este filtro</h4>
        <p class="text-xs text-slate-400 mt-1">Puedes agendar citas libres con el botón de arriba.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(apt => {
    const statusBadges = {
      pending: '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-200 border border-slate-600">⏳ Pendiente</span>',
      confirmed: '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/60">✅ Confirmada</span>',
      completed: '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">🎉 Completada</span>',
      cancelled: '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-950/80 text-rose-300 border border-rose-700/60">❌ Cancelada</span>'
    };

    const endTime = minutesToTime(timeToMinutes(apt.time) + (apt.durationMin || 180));
    const h = Math.floor((apt.durationMin || 180) / 60);
    const m = (apt.durationMin || 180) % 60;
    const durLabel = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();

    return `
      <div class="glass-panel rounded-2xl p-5 border border-slate-800 shadow-md transition-all">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-slate-800 text-white font-black flex items-center justify-center text-sm border border-slate-700">
              ${apt.clientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h4 class="font-bold text-white text-sm sm:text-base">${apt.clientName}</h4>
                ${apt.gender === 'man' ? '<span class="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">Caballero 👨</span>' : '<span class="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">Dama 👩</span>'}
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                <span>📱 ${formatColombianPhoneDisplay(apt.clientPhone)}</span>
                <span class="text-slate-600">•</span>
                <span class="text-slate-400">#${apt.id}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-3 self-start sm:self-auto">
            ${statusBadges[apt.status] || ''}
            <div class="text-right pl-3 border-l border-slate-800">
              <span class="text-base font-extrabold text-white">${formatCOP(apt.totalPrice)}</span>
              <span class="block text-[11px] text-slate-300 font-semibold">Anticipo: ${formatCOP(apt.depositAmount)}</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs text-slate-300">
          <div>
            <span class="block font-bold text-slate-400 uppercase text-[10px]">Horario Reservado</span>
            <div class="font-bold text-white mt-0.5">📅 ${apt.date} · ⏰ ${apt.time} a ${endTime}</div>
            <div class="text-[11px] text-slate-300 font-semibold">Bloqueo de ${durLabel}</div>
          </div>
          <div>
            <span class="block font-bold text-slate-400 uppercase text-[10px]">Servicio & Nail Art</span>
            <div class="font-bold text-white mt-0.5">${apt.serviceName}</div>
            <div class="text-[11px] text-slate-400">${apt.shape} · ${apt.length} · ${apt.designLevel}</div>
          </div>
          <div>
            <span class="block font-bold text-slate-400 uppercase text-[10px]">Ambiente & Entretenimiento</span>
            <div class="font-semibold text-slate-200 mt-0.5">${apt.ambience?.vibe || 'Normal'} · ☕ ${apt.ambience?.drink || 'Sin bebida'}</div>
            <div class="text-[11px] text-emerald-300 font-medium mt-0.5">
              ${apt.ambience?.entertainmentType === 'movie' 
                ? `🎬 TV: <strong>${apt.ambience.movieSeriesTitle || 'Película / Serie a elegir'}</strong>` 
                : apt.ambience?.entertainmentType === 'silence' 
                ? '🔇 Modo Zen (Silencio Total)' 
                : `🎵 Música: ${apt.ambience?.music || 'Lofi'}`}
            </div>
          </div>
        </div>

        ${apt.designNotes ? `<div class="p-2.5 rounded-xl bg-[#0c0c14] border border-slate-800 text-xs text-slate-300 mb-2"><strong>Notas:</strong> "${apt.designNotes}"</div>` : ''}

        ${apt.images && apt.images.length > 0 ? `
          <div class="mt-2 mb-3">
            <span class="text-[11px] font-bold text-slate-400 block mb-1">📸 Fotos de referencia adjuntas (${apt.images.length}):</span>
            <div class="flex items-center space-x-2 overflow-x-auto pb-1">
              ${apt.images.map(img => `
                <div class="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 flex-shrink-0 cursor-pointer shadow-sm relative group" onclick="openLightboxDirect('${img.data}', '${escapeHtml(img.notes || img.name)}')">
                  <img src="${img.data}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs">🔍</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Pase de Lista / Control de Asistencia (Estilo Universitario) -->
        <div class="py-2.5 px-3.5 my-2 rounded-2xl bg-[#0c0c14] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-[11px] font-extrabold text-white">📋 Pase de Lista:</span>
            <button onclick="setAppointmentAttendance('${apt.id}', 'present')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${apt.attendanceStatus === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#141420] text-slate-300 hover:bg-emerald-950/60 border border-slate-700'}">✅ Asistió</button>
            <button onclick="setAppointmentAttendance('${apt.id}', 'pending')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${!apt.attendanceStatus || apt.attendanceStatus === 'pending' ? 'bg-slate-700 text-white font-extrabold shadow-xs' : 'bg-[#141420] text-slate-300 hover:bg-slate-800 border border-slate-700'}">⏳ Por Llegar</button>
            <button onclick="setAppointmentAttendance('${apt.id}', 'absent')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${apt.attendanceStatus === 'absent' ? 'bg-rose-600 text-white shadow-xs' : 'bg-[#141420] text-slate-300 hover:bg-rose-950/60 border border-slate-700'}">❌ Falta</button>
          </div>
          <div class="text-[11px]">
            ${apt.clientEmail ? `<span class="text-slate-300 font-semibold">📧 ${apt.clientEmail}</span>` : '<span class="text-slate-500">Sin correo</span>'}
          </div>
        </div>

        <!-- Barra de Ajuste Rápido de Horario (Correr 30 min / Adelantar 30 min / Cambiar Hora) -->
        <div class="py-2.5 px-3.5 my-2 rounded-2xl bg-[#090910] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              <span>⏰</span><span>Ajustar Cita:</span>
            </span>
            <button onclick="shiftAppointmentTime('${apt.id}', 30)" class="px-2.5 py-1 rounded-lg bg-[#141424] hover:bg-[#1e1e34] text-amber-300 font-bold text-xs border border-amber-500/40 transition-all flex items-center space-x-1 cursor-pointer" title="Correr media hora después (ej. 9:00 a 9:30) para tener tiempo de alistar el espacio">
              <span>⏩ +30 min (Correr)</span>
            </button>
            <button onclick="shiftAppointmentTime('${apt.id}', -30)" class="px-2.5 py-1 rounded-lg bg-[#141424] hover:bg-[#1e1e34] text-sky-300 font-bold text-xs border border-sky-500/40 transition-all flex items-center space-x-1 cursor-pointer" title="Adelantar media hora antes">
              <span>⏪ -30 min</span>
            </button>
            <button onclick="openRescheduleModal('${apt.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center space-x-1 cursor-pointer" title="Elegir otra hora exacta">
              <span>✏️ Cambiar Hora</span>
            </button>
          </div>
          <button onclick="notifyClientRescheduleWhatsApp('${apt.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-bold text-xs border border-emerald-600/50 transition-all flex items-center space-x-1 cursor-pointer" title="Avisar a la clienta por WhatsApp del nuevo horario">
            <span>💬 Avisar por WhatsApp</span>
          </button>
        </div>

        <!-- Botones de Acción -->
        <div class="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            ${apt.status === 'pending' ? `
              <button onclick="changeAppointmentStatus('${apt.id}', 'confirmed')" class="px-3 py-1.5 rounded-xl btn-chrome text-stone-950 font-black text-xs shadow-sm">
                ✅ Confirmar Cupo
              </button>
            ` : ''}
            ${apt.status === 'confirmed' ? `
              <button onclick="changeAppointmentStatus('${apt.id}', 'completed')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-sm border border-slate-700">
                🎉 Completada
              </button>
            ` : ''}
            <button onclick="openGoogleCalendarDirect('${apt.id}')" class="px-3 py-1.5 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-slate-200 font-bold text-xs border border-slate-700 shadow-xs transition-all flex items-center space-x-1" title="Abrir y guardar en Google Calendar">
              <span>📅 Google Cal</span>
            </button>
            <button onclick="openOutlookCalendarDirect('${apt.id}')" class="px-3 py-1.5 rounded-xl bg-[#0b2545] hover:bg-[#133b6b] text-sky-200 font-bold text-xs border border-sky-600/60 shadow-xs transition-all flex items-center space-x-1" title="Abrir y guardar en Outlook / Hotmail">
              <span>📬 Outlook</span>
            </button>
            <button onclick="downloadICSAlarmFileDirect('${apt.id}')" class="px-3 py-1.5 rounded-xl bg-[#09090c] hover:bg-[#151522] text-white border border-slate-700 font-bold text-xs shadow-xs transition-all flex items-center space-x-1" title="Descargar alarma con sonido para tu iPhone / Android">
              <span>⏰ Alarma .ICS</span>
            </button>
            <button onclick="openReminderModal('${apt.id}')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-600 transition-all flex items-center space-x-1">
              <span>🔔 Recordatorios</span>
            </button>
          </div>

          <div class="flex items-center space-x-2">
            ${apt.status !== 'cancelled' ? `
              <button onclick="changeAppointmentStatus('${apt.id}', 'cancelled')" class="px-2.5 py-1.5 rounded-xl text-slate-400 hover:bg-slate-800 text-xs font-semibold">
                Cancelar
              </button>
            ` : ''}
            <button onclick="deleteAppointmentConfirm('${apt.id}')" class="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs" title="Eliminar">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.changeAppointmentStatus = async function(id, newStatus) {
  try {
    await DB.updateAppointmentStatus(id, newStatus);
    const apt = AppState.appointments.find(a => a.id === id);
    if (apt) apt.status = newStatus;
    renderAdminAppointments();
    updateAdminMetrics();
    showToast(`Estado de cita actualizado: ${newStatus}`, 'success');
  } catch (err) {
    showToast('Error al actualizar el estado', 'error');
  }
};

window.deleteAppointmentConfirm = async function(id) {
  if (confirm('¿Estás segura de eliminar esta cita de la agenda?')) {
    try {
      await DB.deleteAppointment(id);
      AppState.appointments = AppState.appointments.filter(a => a.id !== id);
      renderAdminAppointments();
      updateAdminMetrics();
      showToast('Cita eliminada.', 'info');
    } catch (err) {
      showToast('Error al eliminar', 'error');
    }
  }
};

/* ========================================================
   REAGENDAMIENTO Y AJUSTE DE HORARIO (CORRER MEDIA HORA)
   ======================================================== */

let currentRescheduleAptId = null;

window.shiftAppointmentTime = async function(id, deltaMinutes) {
  const apt = AppState.appointments.find(a => a.id === id);
  if (!apt) return;

  const currentMins = timeToMinutes(apt.time);
  let newMins = currentMins + deltaMinutes;
  if (newMins < 360) newMins = 360; // 06:00 AM
  if (newMins > 1320) newMins = 1320; // 10:00 PM

  const oldTime = apt.time;
  const newTime = minutesToTime(newMins);
  apt.time = newTime;

  await DB.saveAppointment(apt);
  saveToLocalStorage();
  renderAdminAppointments();
  updateAdminMetrics();

  const dur = apt.durationMin || 180;
  const endTime = minutesToTime(newMins + dur);

  const direction = deltaMinutes > 0 ? `+${deltaMinutes} min más tarde` : `${Math.abs(deltaMinutes)} min antes`;
  showToast(`⏰ Cita de ${apt.clientName} rodada (${direction}): ${oldTime} ➔ ${newTime} (Termina: ${endTime})`, 'success');

  // Abrir WhatsApp para avisar a la clienta con 1 clic
  notifyClientRescheduleWhatsApp(apt.id);
};

window.openRescheduleModal = function(id) {
  const apt = AppState.appointments.find(a => a.id === id);
  if (!apt) return;
  currentRescheduleAptId = id;

  const header = document.getElementById('rescheduleClientNameHeader');
  if (header) header.textContent = `Clienta: ${apt.clientName} (${apt.serviceName} · Cita #${apt.id})`;

  const dateInput = document.getElementById('rescheduleDateInput');
  if (dateInput) dateInput.value = apt.date;

  const timeInput = document.getElementById('rescheduleTimeInput');
  if (timeInput) {
    timeInput.value = apt.time;
    timeInput.oninput = updateReschedulePreview;
  }

  updateReschedulePreview();

  const modal = document.getElementById('rescheduleAppointmentModal');
  if (modal) modal.classList.remove('hidden');
};

window.closeRescheduleModal = function() {
  const modal = document.getElementById('rescheduleAppointmentModal');
  if (modal) modal.classList.add('hidden');
  currentRescheduleAptId = null;
};

window.applyModalQuickShift = function(deltaMinutes) {
  const timeInput = document.getElementById('rescheduleTimeInput');
  if (!timeInput || !timeInput.value) return;

  let mins = timeToMinutes(timeInput.value) + deltaMinutes;
  if (mins < 360) mins = 360;
  if (mins > 1320) mins = 1320;
  timeInput.value = minutesToTime(mins);
  updateReschedulePreview();
};

function updateReschedulePreview() {
  if (!currentRescheduleAptId) return;
  const apt = AppState.appointments.find(a => a.id === currentRescheduleAptId);
  if (!apt) return;

  const timeInput = document.getElementById('rescheduleTimeInput');
  const durText = document.getElementById('rescheduleDurationText');
  const endText = document.getElementById('rescheduleEndTimeText');

  const dur = apt.durationMin || 180;
  if (durText) durText.textContent = `${Math.floor(dur/60)}h ${dur%60}m`;

  if (timeInput && timeInput.value && endText) {
    const endMin = timeToMinutes(timeInput.value) + dur;
    endText.textContent = `${minutesToTime(endMin)} (${timeInput.value} a ${minutesToTime(endMin)})`;
  }
}

window.saveRescheduledAppointment = async function() {
  if (!currentRescheduleAptId) return;
  const apt = AppState.appointments.find(a => a.id === currentRescheduleAptId);
  if (!apt) return;

  const dateInput = document.getElementById('rescheduleDateInput');
  const timeInput = document.getElementById('rescheduleTimeInput');
  const notifyCheck = document.getElementById('rescheduleNotifyWhatsAppCheck');

  const oldTime = apt.time;
  const newDate = dateInput ? dateInput.value : apt.date;
  const newTime = timeInput ? timeInput.value : apt.time;

  apt.date = newDate;
  apt.time = newTime;

  await DB.saveAppointment(apt);
  saveToLocalStorage();
  renderAdminAppointments();
  updateAdminMetrics();

  closeRescheduleModal();

  showToast(`⏰ Horario actualizado para ${apt.clientName}: ahora a las ${newTime}`, 'success');

  if (notifyCheck && notifyCheck.checked) {
    notifyClientRescheduleWhatsApp(apt.id);
  }
};

window.notifyClientRescheduleWhatsApp = function(id) {
  const apt = AppState.appointments.find(a => a.id === id);
  if (!apt) return;

  const dur = apt.durationMin || 180;
  const endTime = minutesToTime(timeToMinutes(apt.time) + dur);

  const msg = `🤍 *Ajuste de Horario - ${AppState.config.studioName}* 💅%0A%0A` +
    `¡Hola ${apt.clientName}! Te escribo para comentarte que ajustamos el horario de tu cita de hoy *${apt.date}* para las *${apt.time}* (hasta las ${endTime}).%0A%0A` +
    `💅 *Servicio:* ${apt.serviceName}%0A` +
    `⏱️ *Duración:* ${Math.floor(dur/60)} horas%0A` +
    `📍 *Ubicación:* ${AppState.config.location}%0A%0A` +
    `_Lo corrimos para tener todo impecable y consentirte con el mejor tiempo y tranquilidad. ¡Te espero!_ ✨`;

  const cleanPhone = normalizeColombianPhone(apt.clientPhone);
  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
};

/* ========================================================
   SISTEMA DE ALARMAS SONORAS (24h, 2h, 1h, 5min)
   ======================================================== */

// Generador de sonido de alarma de lujo utilizando Web Audio API
function playAlarmChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!AppState.alarmAudioCtx) {
      AppState.alarmAudioCtx = new AudioContext();
    }
    const ctx = AppState.alarmAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const notes = [659.25, 830.61, 987.77, 1318.51];
    let startTime = ctx.currentTime;

    for (let cycle = 0; cycle < 3; cycle++) {
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime + (idx * 0.12));

        gain.gain.setValueAtTime(0.3, startTime + (idx * 0.12));
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + (idx * 0.12) + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime + (idx * 0.12));
        osc.stop(startTime + (idx * 0.12) + 0.4);
      });
      startTime += 0.65;
    }

    if ('vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 200, 600]);
    }

  } catch (err) {
    console.warn('Error al reproducir sonido de alarma:', err);
  }
}
window.playAlarmChime = playAlarmChime;

function triggerAlarmAlert(title, message) {
  playAlarmChime();

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: AppState.config.customProfilePhoto || (window.DELAROSA_PROFILE_B64 || 'assets/img/delarosa_profile.jpg')
    });
  }

  const alertModal = document.getElementById('liveAlarmNotificationModal');
  const titleEl = document.getElementById('liveAlarmTitle');
  const msgEl = document.getElementById('liveAlarmMessage');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (alertModal) alertModal.classList.remove('hidden');
}
window.triggerAlarmAlert = triggerAlarmAlert;

function startAlarmBackgroundMonitor() {
  // Monitoreo de fondo en tiempo real: SOLO se ejecuta si la Manicurista está autenticada en su panel
  // Las clientas NUNCA recibirán alarmas ni notificaciones de otras citas mientras navegan por la app.
  setInterval(() => {
    if (AppState.isAdminAuthenticated) {
      checkUpcomingAppointmentsForAlarms();
      updateLiveAlarmTestCountdown();
    }
  }, 5000);
}

function checkUpcomingAppointmentsForAlarms() {
  // PRIVACIDAD TOTAL: Las alarmas en vivo del sistema solo suenan y se muestran a la Manicurista autenticada.
  if (!AppState.isAdminAuthenticated) return;

  const now = new Date();
  const notifiedKeys = JSON.parse(sessionStorage.getItem('delarosa_notified_alarms') || '{}');

  AppState.appointments.forEach(apt => {
    if (apt.status === 'cancelled') return;

    // Calcular diferencia en minutos
    const aptDateTime = new Date(`${apt.date}T${apt.time}:00`);
    const diffMs = aptDateTime - now;
    const diffMinutes = Math.round(diffMs / 60000);

    // Si la cita ya pasó hace más de 30 minutos, ignorar
    if (diffMinutes < -30) return;

    // 1. Alarma 24 Horas antes (<= 1440 min y > 120 min)
    if (diffMinutes <= 1440 && diffMinutes > 120) {
      const key = `${apt.id}_24h`;
      if (!notifiedKeys[key]) {
        notifiedKeys[key] = true;
        triggerAlarmAlert('⏰ Faltan 24 Horas para tu Cita', `Cita con ${apt.clientName} mañana a las ${apt.time} (${apt.serviceName}).`);
      }
    }

    // 2. Alarma 2 Horas antes (<= 120 min y > 60 min)
    if (diffMinutes <= 120 && diffMinutes > 60) {
      const key = `${apt.id}_2h`;
      if (!notifiedKeys[key]) {
        notifiedKeys[key] = true;
        triggerAlarmAlert('⏰ Faltan 2 Horas para la Cita', `Cita con ${apt.clientName} hoy a las ${apt.time} en Delarosa Nail Designer.`);
      }
    }

    // 3. Alarma 1 Hora antes (<= 60 min y > 10 min)
    if (diffMinutes <= 60 && diffMinutes > 10) {
      const key = `${apt.id}_1h`;
      if (!notifiedKeys[key]) {
        notifiedKeys[key] = true;
        triggerAlarmAlert('⏰ Falta 1 Hora para la Cita', `Prepárate, tu cita con ${apt.clientName} es a las ${apt.time}.`);
      }
    }

    // 4. Alarma 10 Minutos antes (<= 10 min y >= -2 min)
    if (diffMinutes <= 10 && diffMinutes >= -2) {
      const key = `${apt.id}_10m`;
      if (!notifiedKeys[key]) {
        notifiedKeys[key] = true;
        triggerAlarmAlert('🔔 ¡Tu Cita Comienza en 10 Minutos!', `¡Atención! Tu cita con ${apt.clientName} para su servicio de ${apt.serviceName} comienza en 10 minutos.`);
      }
    }
  });

  sessionStorage.setItem('delarosa_notified_alarms', JSON.stringify(notifiedKeys));
}

// Creador de Citas de Prueba en Vivo para verificar Alarmas
window.createTestAppointmentForAlarm = function(minutesAhead) {
  const targetDate = new Date(Date.now() + minutesAhead * 60000);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const hh = String(targetDate.getHours()).padStart(2, '0');
  const min = String(targetDate.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${min}`;

  const testApt = {
    id: 'PRUEBA-' + Math.floor(1000 + Math.random() * 9000),
    clientName: 'Prueba de Alarma (Julieth)',
    clientPhone: AppState.config.phone || '573226376819',
    gender: 'woman',
    category: 'systems',
    serviceId: 'polygel-tech',
    serviceName: 'Prueba de Alarma Sonora (' + minutesAhead + ' min)',
    shape: 'Almond',
    length: 'Largo 2',
    designLevel: 'Nivel 1 (Minimalista)',
    ambience: { vibe: 'Normal', drink: 'Café', playlist: 'Pop / Acústico' },
    date: dateStr,
    time: timeStr,
    durationMin: 120,
    totalPrice: 100000,
    depositAmount: 30000,
    status: 'confirmed',
    images: []
  };

  AppState.appointments.unshift(testApt);
  AppState.lastTestAppointment = testApt;
  saveToLocalStorage();
  renderAdminAppointments();
  updateAdminMetrics();

  // Descargar archivo .ics de calendario automáticamente para vincular con el teléfono
  AppState.selectedAppointmentForReminder = testApt;
  downloadICSAlarmFile();

  showToast(`¡Cita de prueba creada para las ${timeStr}! Alarma sonora e iCalendar programados.`, 'success');
  updateLiveAlarmTestCountdown();
};

function updateLiveAlarmTestCountdown() {
  const container = document.getElementById('liveAlarmTestBanner');
  if (!container) return;

  const apt = AppState.lastTestAppointment;
  if (!apt) {
    container.classList.add('hidden');
    return;
  }

  const aptDateTime = new Date(`${apt.date}T${apt.time}:00`);
  const now = new Date();
  const diffMs = aptDateTime - now;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < -60) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const timerEl = document.getElementById('testAlarmCountdownTimer');
  if (timerEl) {
    if (diffSec <= 0) {
      timerEl.textContent = '¡LA CITA COMENZÓ AHORA!';
      timerEl.className = 'font-mono font-extrabold text-rose-600 animate-pulse';
    } else {
      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
      timerEl.className = 'font-mono font-extrabold text-white';
    }
  }
}
window.updateLiveAlarmTestCountdown = updateLiveAlarmTestCountdown;

window.simulateAlarmInterval = function(intervalId) {
  const intervals = {
    '24h': { title: '⏰ Faltan 24 Horas para tu Cita', msg: 'Recordatorio oficial: Mañana tienes tu cita en Delarosa Nail Designer a las 09:00 AM.' },
    '2h': { title: '⏰ Faltan 2 Horas para tu Cita', msg: 'Recordatorio: Faltan 2 horas para tu cita de uñas con Julieth De la Rosa.' },
    '1h': { title: '⏰ Falta 1 Hora para tu Cita', msg: 'Recordatorio: Falta 1 hora. Por favor llegar con uñas limpias.' },
    '10m': { title: '🔔 ¡Tu Cita Comienza en 10 Minutos!', msg: '¡Tu cita está por comenzar en Delarosa Nail Designer! Te esperamos en el estudio.' }
  };

  const item = intervals[intervalId] || intervals['2h'];
  triggerAlarmAlert(item.title, item.msg);
};

window.requestNotificationPermission = async function() {
  if (!('Notification' in window)) {
    showToast('Tu navegador no tiene soporte directo para notificaciones push.', 'warning');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playAlarmChime();
      new Notification('🔔 Notificaciones y Timbre Activados', {
        body: '¡Listo! Tu celular te avisará con sonido las citas a las 24h, 2h, 1h y 10 minutos.',
        icon: AppState.config.customProfilePhoto || (window.DELAROSA_PROFILE_B64 || 'assets/img/delarosa_profile.jpg')
      });
      showToast('¡Notificaciones y sonido activados con éxito!', 'success');
    } else {
      showToast('Permiso de notificaciones denegado en tu navegador.', 'warning');
    }
  } catch (e) {
    showToast('Activa las notificaciones en los ajustes de tu navegador.', 'info');
  }
};

/* ========================================================
   MODAL DE RECORDATORIOS Y ALARMAS DE CALENDARIO
   ======================================================== */

function downloadICSAlarmFileDirect(appointmentId) {
  const apt = AppState.appointments.find(a => a.id === appointmentId);
  if (!apt) return;
  AppState.selectedAppointmentForReminder = apt;
  downloadICSAlarmFile();
}
window.downloadICSAlarmFileDirect = downloadICSAlarmFileDirect;

function openReminderModal(appointmentId) {
  const apt = AppState.appointments.find(a => a.id === appointmentId);
  if (!apt) return;

  AppState.selectedAppointmentForReminder = apt;
  const modal = document.getElementById('appointmentReminderModal');
  const detailsEl = document.getElementById('reminderAppointmentDetails');

  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-800 space-y-1">
        <div><strong>Clienta:</strong> ${apt.clientName}</div>
        <div><strong>Fecha y Hora:</strong> ${apt.date} a las ${apt.time}</div>
        <div><strong>Servicio:</strong> ${apt.serviceName}</div>
        <div><strong>Celular:</strong> ${apt.clientPhone}</div>
      </div>
    `;
  }

  if (modal) modal.classList.remove('hidden');
}
window.openReminderModal = openReminderModal;

window.sendClientWhatsAppCustomReminder = function(intervalType) {
  const apt = AppState.selectedAppointmentForReminder;
  if (!apt) return;

  const phrases = {
    '24h': 'Faltan 24 horas para tu cita de mañana',
    '2h': 'Te recordamos que faltan 2 horas para tu cita de hoy',
    '1h': 'Falta solo 1 hora para tu cita de hoy',
    '10m': '¡Tu cita comienza en 10 minutos!'
  };

  const phrase = phrases[intervalType] || 'Te recordamos tu cita agendada';

  const msg = `🤍 *${phrase} en ${AppState.config.studioName}* 🤍%0A%0A` +
    `¡Hola ${apt.clientName}! ${phrase} programada para el *${apt.date} a las ${apt.time}*.%0A%0A` +
    `💅 *Servicio:* ${apt.serviceName}%0A` +
    `📍 *Ubicación:* ${AppState.config.location}%0A` +
    `⏱️ *Tiempo:* ${Math.floor((apt.durationMin||180)/60)} horas%0A%0A` +
    `_Por favor llegar 5 minutos antes con tus uñas listas. ¡Te esperamos para consentirte!_ ✨`;

  const cleanPhone = normalizeColombianPhone(apt.clientPhone);
  window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
};

window.testWhatsAppMessageDirect = function(intervalType) {
  const phone = normalizeColombianPhone(AppState.config?.phone || '573226376819');
  const phrases = {
    '24h': 'Faltan 24 horas para tu cita de mañana',
    '2h': 'Te recordamos que faltan 2 horas para tu cita de hoy',
    '1h': 'Falta solo 1 hora para tu cita de hoy',
    '10m': '¡Tu cita comienza en 10 minutos!'
  };
  const phrase = phrases[intervalType] || 'Recordatorio de tu cita';
  const msg = `🔔 *${phrase} en ${AppState.config.studioName}* 💅%0A%0A` +
    `¡Hola! ${phrase} programada en Delarosa Nail Designer.%0A%0A` +
    `📍 *Ubicación:* ${AppState.config.location}%0A` +
    `💅 *Especialista:* ${AppState.config.designerName}%0A%0A` +
    `_Por favor llegar 5 minutos antes con tus uñas listas. ¡Te esperamos para consentirte!_ ✨`;

  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
};

window.downloadICSAlarmFile = function() {
  const apt = AppState.selectedAppointmentForReminder;
  if (!apt) return;

  const startIso = apt.date.replace(/-/g, '') + 'T' + apt.time.replace(':', '') + '00';
  const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
  const endIso = apt.date.replace(/-/g, '') + 'T' + minutesToTime(endMin).replace(':', '') + '00';

  const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Delarosa Nail Designer//App//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${apt.id}@delarosanails.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startIso}
DTEND:${endIso}
SUMMARY:💅 Cita: ${apt.clientName} - ${apt.serviceName}
DESCRIPTION:Clienta: ${apt.clientName} | Cel: ${apt.clientPhone} | Total: ${formatCOP(apt.totalPrice)} | Anticipo: ${formatCOP(apt.depositAmount)} | Notas: ${apt.designNotes || 'Ninguna'}
LOCATION:${AppState.config.location}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:💅 Recordatorio Cita: ${apt.clientName} (${apt.serviceName}) mañana a las ${apt.time}
TRIGGER:-P1D
X-WR-ALARMUID:ALARM-24H-${apt.id}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:⏰ Faltan 2 horas para la cita de uñas con ${apt.clientName} (${apt.time})
TRIGGER:-PT2H
X-WR-ALARMUID:ALARM-2H-${apt.id}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:⏰ Falta 1 hora para tu cita de uñas con ${apt.clientName} (${apt.time})
TRIGGER:-PT1H
X-WR-ALARMUID:ALARM-1H-${apt.id}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:🔔 ¡Tu cita con ${apt.clientName} comienza en 10 minutos!
TRIGGER:-PT10M
X-WR-ALARMUID:ALARM-10M-${apt.id}
END:VALARM
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Alarma_Cita_${apt.clientName.replace(/\s+/g, '_')}_${apt.date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('¡Archivo de alarma .ics descargado con las 4 alertas (24h, 2h, 1h, 10min)!', 'success');
};

// Descargar Alarma para la Clienta al finalizar reserva
window.downloadClientBookingAlarm = function() {
  const apt = AppState.lastBookedAppointment;
  if (!apt) {
    showToast('No hay cita reciente para descargar alarma.', 'warning');
    return;
  }

  const startIso = apt.date.replace(/-/g, '') + 'T' + apt.time.replace(':', '') + '00';
  const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
  const endIso = apt.date.replace(/-/g, '') + 'T' + minutesToTime(endMin).replace(':', '') + '00';

  const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Delarosa Nail Designer//App//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${apt.id}@delarosanails.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startIso}
DTEND:${endIso}
SUMMARY:💅 Cita de Uñas: ${AppState.config.studioName}
DESCRIPTION:Cita con ${AppState.config.designerName}\\nServicio: ${apt.serviceName}\\nTotal: ${formatCOP(apt.totalPrice)}\\nUbicación: ${AppState.config.location}\\nWhatsApp: +${AppState.config.phone}
LOCATION:${AppState.config.location}
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:⏰ Mañana tienes tu cita de uñas en ${AppState.config.studioName} a las ${apt.time}
END:VALARM
BEGIN:VALARM
TRIGGER:-PT2H
ACTION:DISPLAY
DESCRIPTION:⏰ Faltan 2 horas para tu cita de uñas con ${AppState.config.designerName}
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:⏰ Falta 1 hora para tu cita. ¡Prepara tus uñas limpias!
END:VALARM
BEGIN:VALARM
TRIGGER:-PT10M
ACTION:DISPLAY
DESCRIPTION:🔔 ¡Tu cita de uñas comienza en 10 minutos en ${AppState.config.studioName}!
END:VALARM
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Alarma_Cita_${AppState.config.studioName.replace(/\s+/g, '_')}_${apt.date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('¡Alarma generada! Al abrirse en tu iPhone/Android se activarán los 4 avisos con sonido (24h, 2h, 1h, 10min).', 'success');
};

// Generador de Enlace a Google Calendar (1 Clic, sin descargar archivos)
window.generateGoogleCalendarLink = function(apt) {
  if (!apt) return '#';
  const startIso = apt.date.replace(/-/g, '') + 'T' + apt.time.replace(':', '') + '00';
  const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
  const endIso = apt.date.replace(/-/g, '') + 'T' + minutesToTime(endMin).replace(':', '') + '00';
  const title = encodeURIComponent(`💅 Cita: ${apt.serviceName} - ${AppState.config.studioName}`);
  const details = encodeURIComponent(
    `Cita en ${AppState.config.studioName}\n` +
    `Especialista: ${AppState.config.designerName}\n` +
    `Clienta: ${apt.clientName} (${apt.clientPhone})\n` +
    `Servicio: ${apt.serviceName}\n` +
    `Total: ${formatCOP(apt.totalPrice)} | Anticipo: ${formatCOP(apt.depositAmount)}\n` +
    `Ubicación: ${AppState.config.location}\n` +
    `WhatsApp: +${AppState.config.phone}\n\n` +
    `Recordatorio: Tu cita incluye alarmas automáticas con sonido a las 24h, 2h, 1h y 10 minutos.`
  );
  const location = encodeURIComponent(AppState.config.location);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
};

window.openGoogleCalendarDirect = function(appointmentId) {
  const apt = appointmentId ? AppState.appointments.find(a => a.id === appointmentId) : AppState.lastBookedAppointment;
  if (!apt) {
    showToast('No se encontró la información de la cita.', 'warning');
    return;
  }
  const url = window.generateGoogleCalendarLink(apt);
  window.open(url, '_blank');
};

// Generador de Enlace a Outlook Calendar (Hotmail / Live / Microsoft 365)
window.generateOutlookCalendarLink = function(apt) {
  if (!apt) return '#';
  const startDt = `${apt.date}T${apt.time}:00`;
  const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
  const endDt = `${apt.date}T${minutesToTime(endMin)}:00`;
  const subject = encodeURIComponent(`💅 Cita: ${apt.serviceName} - ${AppState.config.studioName}`);
  const body = encodeURIComponent(
    `🔔 RECORDATORIO DE CITA EN ${AppState.config.studioName}\n` +
    `Especialista: ${AppState.config.designerName}\n` +
    `Clienta: ${apt.clientName} (${apt.clientPhone})\n` +
    `Servicio: ${apt.serviceName}\n` +
    `Total: ${formatCOP(apt.totalPrice)} | Anticipo: ${formatCOP(apt.depositAmount)}\n` +
    `Ubicación: ${AppState.config.location}\n` +
    `WhatsApp: +${AppState.config.phone}\n\n` +
    `Recordatorio: Tu cita incluye alarmas automáticas con sonido a las 24h, 2h, 1h y 10 minutos.`
  );
  const location = encodeURIComponent(AppState.config.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&startdt=${encodeURIComponent(startDt)}&enddt=${encodeURIComponent(endDt)}&subject=${subject}&body=${body}&location=${location}`;
};

window.openOutlookCalendarDirect = function(appointmentId) {
  const apt = appointmentId ? AppState.appointments.find(a => a.id === appointmentId) : AppState.lastBookedAppointment;
  if (!apt) {
    showToast('No se encontró la información de la cita.', 'warning');
    return;
  }
  const url = window.generateOutlookCalendarLink(apt);
  window.open(url, '_blank');
};

// Notificación Automática por Correo (Estilo Lista Universitaria)
window.sendAutomatedEmailNotification = async function(apt, emailType = 'booking') {
  if (!apt) return false;

  const clientEmail = apt.clientEmail;
  const juliethEmail = (AppState.config && AppState.config.email) ? AppState.config.email : 'delarosaa02@gmail.com';

  // 1. Enviar notificación al correo de la clienta
  if (clientEmail && clientEmail.includes('@')) {
    const subject = emailType === 'attendance_present'
      ? `✅ Asistencia Confirmada - ${AppState.config.studioName}`
      : emailType === 'attendance_absent'
      ? `⚠️ Registro de Falta en Cita - ${AppState.config.studioName}`
      : `💅 Confirmación y Alarma de tu Cita - ${AppState.config.studioName}`;

    try {
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(clientEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: subject,
          _template: 'table',
          Clienta: apt.clientName,
          Fecha: apt.date,
          Hora: apt.time,
          Servicio: apt.serviceName,
          Total: formatCOP(apt.totalPrice),
          Anticipo: formatCOP(apt.depositAmount),
          Ubicacion: AppState.config.location,
          Especialista: AppState.config.designerName,
          WhatsApp: '+' + AppState.config.phone,
          Sistema_Alarmas: 'Programado a las 24h, 2h, 1h y 10 minutos con sonido',
          Estado: apt.attendanceStatus || apt.status
        })
      }).catch(() => {});
    } catch (e) {}
  }

  // 2. Al agendar nueva cita: Enviar notificación automática a Julieth con enlace de alarma a su Calendario (Google + Outlook)
  if (emailType === 'booking' && juliethEmail && juliethEmail.includes('@')) {
    const gcalLink = window.generateGoogleCalendarLinkForDesigner ? window.generateGoogleCalendarLinkForDesigner(apt) : window.generateGoogleCalendarLink(apt);
    const outlookLink = window.generateOutlookCalendarLinkForDesigner ? window.generateOutlookCalendarLinkForDesigner(apt) : window.generateOutlookCalendarLink(apt);
    try {
      fetch(`https://formsubmit.co/ajax/${encodeURIComponent(juliethEmail)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `🔔 NUEVA CITA REGISTRADA: ${apt.clientName} - ${apt.date} ${apt.time}`,
          _template: 'table',
          Aviso: '¡Tienes una nueva cita agendada en tu sistema de Delarosa Nail Designer!',
          Clienta: apt.clientName,
          WhatsApp_Clienta: formatColombianPhoneDisplay(apt.clientPhone),
          Fecha: apt.date,
          Hora: apt.time,
          Duracion: `${Math.floor((apt.durationMin || 180)/60)}h ${(apt.durationMin || 180)%60}m`,
          Servicio: apt.serviceName,
          Estructura_Largo: `${apt.shape || 'Natural'} (${apt.length || 'Estándar'})`,
          Diseno: apt.designLevel || 'Básico',
          Notas: apt.designNotes || 'Sin notas especiales',
          Bebida: (apt.ambience && apt.ambience.drink) || 'Sin bebida',
          Entretenimiento: (apt.ambience && apt.ambience.movieSeriesTitle) ? `Película/Serie: ${apt.ambience.movieSeriesTitle}` : ((apt.ambience && apt.ambience.music) || 'Música'),
          Total: formatCOP(apt.totalPrice),
          Anticipo_Por_Cobrar: formatCOP(apt.depositAmount),
          Alarma_Google_Calendar: gcalLink,
          Alarma_Outlook_Calendar: outlookLink
        })
      }).catch(() => {});
    } catch (e) {}
  }

  return true;
};

// Control de Asistencia Individual (Pase de Lista)
window.setAppointmentAttendance = async function(id, attendanceStatus) {
  const apt = AppState.appointments.find(a => a.id === id);
  if (!apt) return;
  apt.attendanceStatus = attendanceStatus;
  saveToLocalStorage();
  renderAdminAppointments();

  if (apt.clientEmail && apt.clientEmail.includes('@')) {
    sendAutomatedEmailNotification(apt, attendanceStatus === 'absent' ? 'attendance_absent' : 'attendance_present');
  }

  const label = attendanceStatus === 'present' 
    ? '✅ Asistencia confirmada' 
    : attendanceStatus === 'absent' 
    ? '❌ Falta registrada y notificada a su correo' 
    : '⏳ Cita en espera';
  showToast(`${label} para ${apt.clientName}`, 'info');
};

// Cierre de Lista Masivo (Estilo Universitario)
window.triggerUniversityAttendanceClose = function() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayApts = AppState.appointments.filter(a => a.date === todayStr || a.status !== 'cancelled');

  let processedCount = 0;
  todayApts.forEach(apt => {
    processedCount++;
    if (!apt.attendanceStatus) {
      apt.attendanceStatus = 'present';
    }
    if (apt.clientEmail && apt.clientEmail.includes('@')) {
      sendAutomatedEmailNotification(apt, apt.attendanceStatus === 'absent' ? 'attendance_absent' : 'attendance_present');
    }
  });

  saveToLocalStorage();
  renderAdminAppointments();
  updateAdminMetrics();
  playAlarmChime();

  showToast(`📋 ¡Lista cerrada con éxito! ${processedCount} citas verificadas y notificaciones automáticas enviadas a los correos.`, 'success');

  const alertModal = document.getElementById('liveAlarmNotificationModal');
  const titleEl = document.getElementById('liveAlarmTitle');
  const msgEl = document.getElementById('liveAlarmMessage');
  if (alertModal && titleEl && msgEl) {
    titleEl.textContent = '📋 Lista Cerrada y Notificaciones Disparadas';
    msgEl.innerHTML = `El sistema ha procesado la lista de asistencia.<br><strong>${processedCount} clientas</strong> han recibido su registro y alarma automática en sus correos, tal como en el sistema de tu universidad.`;
    alertModal.classList.remove('hidden');
  }
};

// Exportar Toda la Agenda en .ICS para la Manicurista
window.downloadFullAgendaICSForManicurist = function() {
  const activeApts = AppState.appointments.filter(a => a.status !== 'cancelled');
  if (activeApts.length === 0) {
    showToast('No hay citas activas para exportar.', 'info');
    return;
  }

  let eventsStr = '';
  activeApts.forEach(apt => {
    const startIso = apt.date.replace(/-/g, '') + 'T' + apt.time.replace(':', '') + '00';
    const endMin = timeToMinutes(apt.time) + (apt.durationMin || 180);
    const endIso = apt.date.replace(/-/g, '') + 'T' + minutesToTime(endMin).replace(':', '') + '00';

    eventsStr += `
BEGIN:VEVENT
UID:${apt.id}@delarosanails.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startIso}
DTEND:${endIso}
SUMMARY:💅 [Cita] ${apt.clientName} - ${apt.serviceName}
DESCRIPTION:Clienta: ${apt.clientName}\\nCel: ${apt.clientPhone}\\nServicio: ${apt.serviceName}\\nTotal: ${formatCOP(apt.totalPrice)}\\nAnticipo: ${formatCOP(apt.depositAmount)}\\nNotas: ${apt.designNotes || 'Ninguna'}
LOCATION:${AppState.config.location}
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:⏰ Mañana tienes cita con ${apt.clientName} a las ${apt.time}
TRIGGER:-P1D
X-WR-ALARMUID:AGENDA-24H-${apt.id}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:⏰ En 2 horas: Cita con ${apt.clientName} a las ${apt.time}
TRIGGER:-PT2H
X-WR-ALARMUID:AGENDA-2H-${apt.id}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:⏰ En 1 hora: Preparar mesa para ${apt.clientName} (${apt.time})
TRIGGER:-PT1H
X-WR-ALARMUID:AGENDA-1H-${apt.id}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:🔔 ¡En 10 minutos inicia cita con ${apt.clientName}!
TRIGGER:-PT10M
X-WR-ALARMUID:AGENDA-10M-${apt.id}
END:VALARM
END:VEVENT`;
  });

  const fullIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Delarosa Nail Designer//Manicurista//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH${eventsStr}
END:VCALENDAR`;

  const blob = new Blob([fullIcs], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Agenda_Completa_Delarosa_${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('¡Agenda completa descargada! Se agregaron todas tus citas con sus 4 alarmas a tu calendario.', 'success');
};

// Enviar Comprobante / Recordatorio por Correo para la Clienta (Gmail en Google Web o App Predeterminada)
window.sendClientBookingEmail = function(provider = 'gmail') {
  const apt = AppState.lastBookedAppointment;
  if (!apt) return;

  const subject = `Comprobante de Reserva - ${AppState.config.studioName} (#${apt.id})`;
  const body = 
    `¡Hola ${apt.clientName}!\n\n` +
    `Tu cita en ${AppState.config.studioName} ha sido reservada con éxito.\n\n` +
    `📋 Código de Reserva: ${apt.id}\n` +
    `📅 Fecha: ${apt.date}\n` +
    `⏰ Horario Reservado: ${apt.time}\n` +
    `💅 Servicio: ${apt.serviceName} (${apt.shape || ''}, ${apt.length || ''})\n` +
    `🎨 Nail Art: ${apt.designLevel || 'Básico'}\n` +
    (apt.ambience?.entertainmentType === 'movie' ? `🎬 En Pantalla TV: ${apt.ambience.movieSeriesTitle || 'Película / Serie a convenir'}\n` : '') +
    (apt.ambience?.entertainmentType === 'silence' ? `🔇 Modo Zen: Silencio Total\n` : '') +
    `💰 Total del Servicio: ${formatCOP(apt.totalPrice)}\n` +
    `💳 Anticipo a transferir: ${formatCOP(apt.depositAmount)}\n` +
    `📍 Ubicación: ${AppState.config.location}\n\n` +
    `Alarma programada en tu calendario con sonido a las 24h, 2h, 1h y 10 minutos antes.\n\n` +
    `Recuerda transferir el anticipo a Julieth De la Rosa (WhatsApp: +${AppState.config.phone}) para asegurar tu cupo.\n\n` +
    `¡Te esperamos con el mejor ambiente en Delarosa Nail Designer!`;

  const toEmail = apt.clientEmail || '';

  if (provider === 'gmail') {
    // Abre directamente Gmail Web en Google normal (Navegador)
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  } else if (provider === 'outlook') {
    // Abre directamente Outlook / Hotmail Web (Navegador)
    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(toEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(outlookUrl, '_blank');
  } else {
    // Abre con la aplicación nativa de correo del celular o PC (mailto)
    const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }
};

window.sendClientEmailReminder = function(provider = 'gmail') {
  const apt = AppState.selectedAppointmentForReminder;
  if (!apt) return;

  const subject = `Recordatorio de Cita - ${AppState.config.studioName}`;
  const body = 
    `Hola ${apt.clientName},\n\n` +
    `Te recordamos tu cita de uñas agendada para el día ${apt.date} a las ${apt.time}.\n\n` +
    `Servicio: ${apt.serviceName}\n` +
    `Ubicación: ${AppState.config.location}\n\n` +
    `¡Te esperamos!\n\n` +
    `Julieth De la Rosa - ${AppState.config.studioName}`;

  const toEmail = apt.clientEmail || '';

  if (provider === 'gmail') {
    // Abre directamente Gmail Web en Google normal (Navegador)
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  } else if (provider === 'outlook') {
    // Abre directamente Outlook / Hotmail Web (Navegador)
    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(toEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(outlookUrl, '_blank');
  } else {
    const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }
};

/* ========================================================
   GESTIÓN DE MARCA, FOTOS Y REDES SOCIALES (PANEL)
   ======================================================== */

function loadBrandSettingsForm() {
  const cfg = AppState.config;
  if (!cfg) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('brandStudioName', cfg.studioName);
  setVal('brandDesignerName', cfg.designerName);
  setVal('brandSlogan', cfg.slogan);
  setVal('brandPhone', cfg.phone);
  setVal('brandEmail', cfg.email || 'delarosaa02@gmail.com');
  setVal('brandInstagram', cfg.instagram);
  setVal('brandInstagramUrl', cfg.instagramUrl);
  setVal('brandFacebook', cfg.facebook);
  setVal('brandFacebookUrl', cfg.facebookUrl);
  setVal('brandTiktok', cfg.tiktok);
  setVal('brandTiktokUrl', cfg.tiktokUrl);
  setVal('brandLocation', cfg.location);
  setVal('brandPaymentMethods', cfg.paymentMethods);
  setVal('brandAdminPassword', cfg.adminPassword || 'GabrielyEly25');
  setVal('brandWorkStart', (cfg.workingHours && cfg.workingHours.start) || '09:00');
  setVal('brandWorkEnd', (cfg.workingHours && cfg.workingHours.end) || '19:00');
  updateScheduleBadges();
}

async function handleSaveBrandSettings(e) {
  e.preventDefault();
  try {
    AppState.config.studioName = document.getElementById('brandStudioName').value.trim();
    AppState.config.designerName = document.getElementById('brandDesignerName').value.trim();
    AppState.config.slogan = document.getElementById('brandSlogan').value.trim();
    AppState.config.phone = normalizeColombianPhone(document.getElementById('brandPhone').value.trim());
    const brandEmailInput = document.getElementById('brandEmail');
    if (brandEmailInput) AppState.config.email = brandEmailInput.value.trim() || 'delarosaa02@gmail.com';
    const brandStartInput = document.getElementById('brandWorkStart');
    const brandEndInput = document.getElementById('brandWorkEnd');
    if (brandStartInput && brandEndInput) {
      if (!AppState.config.workingHours) AppState.config.workingHours = {};
      AppState.config.workingHours.start = brandStartInput.value || '09:00';
      AppState.config.workingHours.end = brandEndInput.value || '19:00';
    }
    AppState.config.instagram = document.getElementById('brandInstagram').value.trim();
    AppState.config.instagramUrl = document.getElementById('brandInstagramUrl').value.trim();
    AppState.config.facebook = document.getElementById('brandFacebook').value.trim();
    AppState.config.facebookUrl = document.getElementById('brandFacebookUrl').value.trim();
    AppState.config.tiktok = document.getElementById('brandTiktok').value.trim();
    AppState.config.tiktokUrl = document.getElementById('brandTiktokUrl').value.trim();
    AppState.config.location = document.getElementById('brandLocation').value.trim();
    AppState.config.paymentMethods = document.getElementById('brandPaymentMethods').value.trim();
    AppState.config.adminPassword = document.getElementById('brandAdminPassword').value.trim() || 'GabrielyEly25';

    await DB.setSetting('studioConfig', AppState.config);
    updateBrandingText();
    showToast('¡Datos de marca, teléfono y redes sociales actualizados!', 'success');

  } catch (err) {
    console.error(err);
    showToast('Error al guardar los ajustes de marca', 'error');
  }
}

async function handleUploadProfilePhoto(e) {
  if (e.target.files && e.target.files[0]) {
    try {
      showToast('Actualizando tu foto de portada/perfil...', 'info');
      const compressed = await DB.compressImage(e.target.files[0], 1200, 0.9);
      AppState.config.customProfilePhoto = compressed;
      await DB.setSetting('studioConfig', AppState.config);
      updateBrandingText();
      showToast('¡Foto de perfil actualizada exitosamente!', 'success');
    } catch (err) {
      showToast('Error al procesar la foto de perfil', 'error');
    }
  }
}

async function handleUploadPriceFlyer(e) {
  if (e.target.files && e.target.files[0]) {
    try {
      showToast('Actualizando flyer de precios...', 'info');
      const compressed = await DB.compressImage(e.target.files[0], 1400, 0.92);
      AppState.config.customPriceFlyerPhoto = compressed;
      await DB.setSetting('studioConfig', AppState.config);
      updateBrandingText();
      showToast('¡Foto de lista de precios actualizada!', 'success');
    } catch (err) {
      showToast('Error al procesar la foto de precios', 'error');
    }
  }
}

/* ========================================================
   AGENDAR CITA LIBRE (MANICURISTA)
   ======================================================== */

function openFreeBookingModal() {
  const modal = document.getElementById('freeBookingModal');
  const serviceSelect = document.getElementById('freeServiceSelect');

  if (serviceSelect) {
    serviceSelect.innerHTML = AppState.services.map(s => `
      <option value="${s.id}" data-price="${s.price}" data-duration="${s.durationMin}">
        ${s.name} - ${formatCOP(s.price)} (~${Math.floor(s.durationMin/60)}h)
      </option>
    `).join('') + `<option value="custom">-- Servicio Personalizado --</option>`;

    serviceSelect.onchange = (e) => {
      const opt = e.target.selectedOptions[0];
      if (opt.value !== 'custom') {
        document.getElementById('freePriceInput').value = opt.dataset.price;
        document.getElementById('freeDurationInput').value = opt.dataset.duration;
      }
    };
  }

  document.getElementById('freeDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('freeTimeInput').value = '10:00';
  document.getElementById('freePriceInput').value = AppState.services[0]?.price || 40000;
  document.getElementById('freeDurationInput').value = AppState.services[0]?.durationMin || 180;
  document.getElementById('freeDepositInput').value = 0;

  modal.classList.remove('hidden');
}

async function handleFreeBookingSubmit(e) {
  e.preventDefault();
  try {
    const clientName = document.getElementById('freeClientName').value.trim();
    const clientPhone = document.getElementById('freeClientPhone').value.trim();
    const serviceSelect = document.getElementById('freeServiceSelect');
    const customServiceName = document.getElementById('freeCustomServiceName')?.value.trim();
    const date = document.getElementById('freeDateInput').value;
    const time = document.getElementById('freeTimeInput').value;
    const price = parseInt(document.getElementById('freePriceInput').value) || 0;
    const duration = parseInt(document.getElementById('freeDurationInput').value) || 180;
    const deposit = parseInt(document.getElementById('freeDepositInput').value) || 0;
    const notes = document.getElementById('freeNotesInput').value.trim();

    const selectedServiceObj = AppState.services.find(s => s.id === serviceSelect.value);
    const serviceName = serviceSelect.value === 'custom' ? (customServiceName || 'Servicio Personalizado') : (selectedServiceObj?.name || 'Servicio');

    const freeApt = {
      id: 'CITA-LIBRE-' + Date.now().toString().slice(-6),
      clientName,
      clientPhone: normalizeColombianPhone(clientPhone),
      clientEmail: '',
      clientInstagram: '',
      gender: 'woman',
      isFirstTime: false,
      serviceId: serviceSelect.value,
      serviceName,
      shape: 'Personalizada',
      length: 'A convenir',
      designLevel: 'Personalizado',
      designNotes: notes,
      addons: [],
      ambience: { vibe: 'Normal', drink: 'Café', music: 'Lo-Fi' },
      date,
      time,
      durationMin: duration,
      totalPrice: price,
      depositAmount: deposit,
      status: 'confirmed',
      images: [],
      createdAt: new Date().toISOString()
    };

    await DB.saveAppointment(freeApt);
    AppState.appointments.unshift(freeApt);
    document.getElementById('freeBookingModal').classList.add('hidden');
    renderAdminAppointments();
    updateAdminMetrics();
    showToast('Cita libre agendada exitosamente.', 'success');

  } catch (err) {
    showToast('Error al guardar la cita libre.', 'error');
  }
}

/* ========================================================
   BLOQUEO MANUAL DE HORARIOS (MANICURISTA)
   ======================================================== */

function openBlockSlotModal() {
  const modal = document.getElementById('blockSlotModal');
  document.getElementById('blockDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('blockStartInput').value = '13:00';
  document.getElementById('blockEndInput').value = '14:00';
  document.getElementById('blockReasonInput').value = 'Almuerzo / Descanso';
  modal.classList.remove('hidden');
}

async function handleBlockSlotSubmit(e) {
  e.preventDefault();
  try {
    const date = document.getElementById('blockDateInput').value;
    const startTime = document.getElementById('blockStartInput').value;
    const endTime = document.getElementById('blockEndInput').value;
    const reason = document.getElementById('blockReasonInput').value.trim() || 'Horario bloqueado por manicurista';

    const newBlock = {
      id: 'BLOCK-' + Date.now(),
      date,
      startTime,
      endTime,
      reason
    };

    await DB.saveBlockedSlot(newBlock);
    AppState.blockedSlots.push(newBlock);
    document.getElementById('blockSlotModal').classList.add('hidden');
    renderBlockedSlotsTable();
    showToast(`Horario bloqueado el ${date} de ${startTime} a ${endTime}`, 'success');
  } catch (err) {
    showToast('Error al guardar el bloqueo de horario', 'error');
  }
}

function formatHourAMPM(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${m} ${ampm}`;
}
window.formatHourAMPM = formatHourAMPM;

function updateScheduleBadges() {
  const cfg = AppState.config;
  if (!cfg) return;
  const workStart = (cfg.workingHours && cfg.workingHours.start) || '09:00';
  const workEnd = (cfg.workingHours && cfg.workingHours.end) || '19:00';

  const badge = document.getElementById('currentScheduleBadge');
  if (badge) badge.textContent = `${formatHourAMPM(workStart)} a ${formatHourAMPM(workEnd)}`;

  const schedStartInput = document.getElementById('schedWorkStart');
  if (schedStartInput) schedStartInput.value = workStart;
  const schedEndInput = document.getElementById('schedWorkEnd');
  if (schedEndInput) schedEndInput.value = workEnd;

  const brandStartInput = document.getElementById('brandWorkStart');
  if (brandStartInput) brandStartInput.value = workStart;
  const brandEndInput = document.getElementById('brandWorkEnd');
  if (brandEndInput) brandEndInput.value = workEnd;

  const editStartInput = document.getElementById('editModalWorkStart');
  if (editStartInput) editStartInput.value = workStart;
  const editEndInput = document.getElementById('editModalWorkEnd');
  if (editEndInput) editEndInput.value = workEnd;
}
window.updateScheduleBadges = updateScheduleBadges;

async function handleStudioScheduleSubmit(e) {
  e.preventDefault();
  try {
    const startVal = document.getElementById('schedWorkStart').value || '09:00';
    const endVal = document.getElementById('schedWorkEnd').value || '19:00';

    if (timeToMinutes(startVal) >= timeToMinutes(endVal)) {
      showToast('La hora de apertura debe ser menor a la hora de cierre.', 'warning');
      return;
    }

    if (!AppState.config.workingHours) AppState.config.workingHours = {};
    AppState.config.workingHours.start = startVal;
    AppState.config.workingHours.end = endVal;

    await DB.setSetting('studioConfig', AppState.config);
    updateScheduleBadges();
    showToast(`¡Horario de atención guardado! Ahora atiendes de ${formatHourAMPM(startVal)} a ${formatHourAMPM(endVal)}.`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al actualizar horario de atención', 'error');
  }
}
window.handleStudioScheduleSubmit = handleStudioScheduleSubmit;

function renderBlockedSlotsTable() {
  const container = document.getElementById('blockedSlotsTableBody');
  if (!container) return;

  if (AppState.blockedSlots.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-xs text-slate-400">No hay horarios bloqueados manualmente.</td></tr>`;
    return;
  }

  container.innerHTML = AppState.blockedSlots.map(b => `
    <tr class="border-b border-slate-800 text-xs hover:bg-[#151522]">
      <td class="py-3 px-3 font-bold text-white">${b.date}</td>
      <td class="py-3 px-3 text-slate-300 font-semibold">${b.startTime} a ${b.endTime}</td>
      <td class="py-3 px-3 text-slate-400">${b.reason}</td>
      <td class="py-3 px-3 text-right">
        <button onclick="deleteBlockedSlotConfirm('${b.id}')" class="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 font-bold text-xs transition-all">🗑️ Desbloquear</button>
      </td>
    </tr>
  `).join('');
}

window.deleteBlockedSlotConfirm = async function(id) {
  if (confirm('¿Deseas desbloquear este horario para que vuelva a estar disponible?')) {
    await DB.deleteBlockedSlot(id);
    AppState.blockedSlots = AppState.blockedSlots.filter(b => b.id !== id);
    renderBlockedSlotsTable();
    showToast('Horario desbloqueado.', 'info');
  }
};

window.quickBlockSlot = async function(startTime, endTime, reason = 'No disponible', targetDate = null) {
  try {
    const date = targetDate || new Date().toISOString().split('T')[0];
    const newBlock = {
      id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      date: date,
      startTime: startTime,
      endTime: endTime,
      reason: reason
    };

    await DB.saveBlockedSlot(newBlock);
    AppState.blockedSlots.push(newBlock);
    renderBlockedSlotsTable();
    showToast(`🚫 Bloqueado: ${startTime} a ${endTime} para el ${date}`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al bloquear horario', 'error');
  }
};

window.setBlockModalRange = function(start, end, reason) {
  const startInput = document.getElementById('blockStartInput');
  const endInput = document.getElementById('blockEndInput');
  const reasonInput = document.getElementById('blockReasonInput');
  if (startInput) startInput.value = start;
  if (endInput) endInput.value = end;
  if (reasonInput && reason) reasonInput.value = reason;
  showToast(`Rango seleccionado: ${formatHourAMPM(start)} a ${formatHourAMPM(end)}`, 'info');
};

window.quickBlockSlotForDay = async function(slotType, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const dateStr = d.toISOString().split('T')[0];
  const dayName = dayOffset === 0 ? 'Hoy' : 'Mañana';

  if (slotType === 'afternoon_2_4') {
    await window.quickBlockSlot('14:00', '16:00', `Salida en la tarde 2:00 a 4:00 PM (${dayName})`, dateStr);
  } else if (slotType === 'morning_9_11') {
    await window.quickBlockSlot('09:00', '11:00', `Salida en la mañana 9:00 a 11:00 AM (${dayName})`, dateStr);
  } else if (slotType === 'lunch_12_2') {
    await window.quickBlockSlot('12:00', '14:00', `Almuerzo y descanso (${dayName})`, dateStr);
  } else if (slotType === 'full_day') {
    const startH = AppState.config.workingHours?.start || '09:00';
    const endH = AppState.config.workingHours?.end || '19:00';
    await window.quickBlockSlot(startH, endH, `Día completo no laboral (${dayName})`, dateStr);
  } else if (slotType === '08:00') {
    await window.quickBlockSlot('08:00', '09:00', `No atiendo 8:00 AM (${dayName})`, dateStr);
  } else if (slotType === '09:00') {
    await window.quickBlockSlot('09:00', '10:00', `No atiendo 9:00 AM (${dayName})`, dateStr);
  } else if (slotType === 'morning') {
    await window.quickBlockSlot('08:00', '10:00', `Inicio a las 10:00 AM (${dayName})`, dateStr);
  }
};

/* ========================================================
   GESTIÓN DINÁMICA DE SERVICIOS (CRUD)
   ======================================================== */

function renderAdminServicesTable() {
  const container = document.getElementById('adminServicesTableBody');
  if (!container) return;

  container.innerHTML = AppState.services.map(s => {
    const h = Math.floor(s.durationMin / 60);
    const m = s.durationMin % 60;
    const durStr = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();

    return `
      <tr class="border-b border-slate-800 text-xs">
        <td class="py-3 px-3">
          <div class="font-bold text-white">${s.name}</div>
          <div class="text-[11px] text-slate-400">${s.description || ''}</div>
        </td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.category === 'hombre' ? 'bg-slate-800 text-slate-200' : 'bg-slate-700 text-white'}">
            ${s.category === 'hombre' ? 'Caballero' : s.category === 'dama' ? 'Dama' : 'General'}
          </span>
        </td>
        <td class="py-3 px-3 font-extrabold text-white">${formatCOP(s.price)}</td>
        <td class="py-3 px-3 font-bold text-slate-300">⏱️ ${durStr}</td>
        <td class="py-3 px-3 text-right space-x-1.5">
          <button onclick="openServiceModal('${s.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700">✏️ Editar</button>
          <button onclick="deleteServiceConfirm('${s.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-[11px] border border-slate-800">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openServiceModal(serviceId) {
  const modal = document.getElementById('serviceCrudModal');
  const titleEl = document.getElementById('serviceCrudModalTitle');
  const form = document.getElementById('serviceCrudForm');

  if (serviceId) {
    const s = AppState.services.find(item => item.id === serviceId);
    if (!s) return;
    titleEl.textContent = 'Editar Servicio';
    document.getElementById('serviceCrudId').value = s.id;
    document.getElementById('serviceCrudName').value = s.name;
    document.getElementById('serviceCrudCategory').value = s.category;
    document.getElementById('serviceCrudPrice').value = s.price;
    document.getElementById('serviceCrudDuration').value = s.durationMin;
    document.getElementById('serviceCrudDesc').value = s.description || '';
  } else {
    titleEl.textContent = 'Nuevo Servicio';
    form.reset();
    document.getElementById('serviceCrudId').value = '';
    document.getElementById('serviceCrudDuration').value = 180;
  }

  modal.classList.remove('hidden');
}
window.openServiceModal = openServiceModal;

async function handleSaveServiceCrud(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('serviceCrudId').value.trim() || ('srv_' + Date.now());
    const name = document.getElementById('serviceCrudName').value.trim();
    const category = document.getElementById('serviceCrudCategory').value;
    const price = parseInt(document.getElementById('serviceCrudPrice').value) || 0;
    const durationMin = parseInt(document.getElementById('serviceCrudDuration').value) || 180;
    const description = document.getElementById('serviceCrudDesc').value.trim();

    const serviceObj = {
      id,
      name,
      category,
      targetGender: category === 'hombre' ? 'man' : category === 'dama' ? 'woman' : 'both',
      price,
      durationMin,
      description,
      badge: category === 'hombre' ? 'Caballero' : 'Dama'
    };

    await DB.saveService(serviceObj);

    const existingIdx = AppState.services.findIndex(s => s.id === id);
    if (existingIdx > -1) AppState.services[existingIdx] = serviceObj;
    else AppState.services.push(serviceObj);

    document.getElementById('serviceCrudModal').classList.add('hidden');
    renderAdminServicesTable();
    renderServicesCatalog();
    showToast('Servicio guardado con éxito.', 'success');
  } catch (err) {
    showToast('Error al guardar el servicio.', 'error');
  }
}

window.deleteServiceConfirm = async function(id) {
  if (confirm('¿Estás segura de eliminar este servicio del catálogo?')) {
    await DB.deleteService(id);
    AppState.services = AppState.services.filter(s => s.id !== id);
    renderAdminServicesTable();
    renderServicesCatalog();
    showToast('Servicio eliminado.', 'info');
  }
};

async function restoreDefaultServices() {
  if (confirm('¿Deseas restaurar todos los servicios a la carta oficial de precios?')) {
    for (const s of window.OFFICIAL_SERVICES) {
      await DB.saveService(s);
    }
    AppState.services = await DB.getAllServices();
    renderAdminServicesTable();
    renderServicesCatalog();
    showToast('Servicios restaurados a los precios oficiales del flyer.', 'success');
  }
}

/* ========================================================
   CENTRO DE CONTROL PERSONALIZABLE: SUB-PESTAÑAS Y CRUD
   ======================================================== */

window.switchCatalogSubtab = function(subtabId) {
  document.querySelectorAll('.catalog-subtab-btn').forEach(btn => {
    btn.classList.remove('btn-chrome', 'text-stone-950', 'font-black');
    btn.classList.add('text-slate-300', 'hover:text-white', 'bg-[#12121b]', 'border', 'border-slate-700', 'font-bold');
  });
  const activeBtn = document.getElementById(`subtabBtn-${subtabId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-300', 'hover:text-white', 'bg-[#12121b]', 'border', 'border-slate-700', 'font-bold');
    activeBtn.classList.add('btn-chrome', 'text-stone-950', 'font-black');
  }

  document.querySelectorAll('.catalog-subtab-content').forEach(c => c.classList.add('hidden'));
  const target = document.getElementById(`catalog-subtab-${subtabId}`);
  if (target) target.classList.remove('hidden');
};

/* --- 1. TARIFAS DE LARGO DE UÑA --- */
function renderAdminLengthsTable() {
  const container = document.getElementById('adminLengthsTableBody');
  if (!container) return;
  const lengths = AppState.nailLengths || window.NAIL_LENGTHS;
  container.innerHTML = lengths.map(l => `
    <tr class="border-b border-slate-800 text-xs">
      <td class="py-3 px-3 font-bold text-white">${l.name}</td>
      <td class="py-3 px-3"><span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono font-bold">${l.tag}</span></td>
      <td class="py-3 px-3 font-extrabold text-white">${l.addPrice > 0 ? '+' + formatCOP(l.addPrice) : '+$0 COP (Sin recargo)'}</td>
      <td class="py-3 px-3 text-right">
        <button type="button" onclick="openEditLengthPriceModal('${l.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700">
          ✏️ Cambiar Tarifa COP
        </button>
      </td>
    </tr>
  `).join('');
}

window.openEditLengthPriceModal = function(id) {
  const lengths = AppState.nailLengths || window.NAIL_LENGTHS;
  const l = lengths.find(item => item.id === id);
  if (!l) return;
  document.getElementById('lengthPriceId').value = l.id;
  document.getElementById('lengthPriceName').value = `${l.name} (${l.tag})`;
  document.getElementById('lengthPriceValue').value = l.addPrice || 0;
  document.getElementById('lengthPriceModal').classList.remove('hidden');
};

async function handleSaveLengthPrice(e) {
  e.preventDefault();
  const id = document.getElementById('lengthPriceId').value;
  const price = parseInt(document.getElementById('lengthPriceValue').value) || 0;
  const l = AppState.nailLengths.find(item => item.id === id);
  if (l) {
    l.addPrice = price;
    await DB.setSetting('nailLengths', AppState.nailLengths);
    document.getElementById('lengthPriceModal').classList.add('hidden');
    renderAdminLengthsTable();
    renderNailLengths();
    updateLivePriceSummary();
    showToast(`Tarifa de ${l.name} actualizada a ${formatCOP(price)}.`, 'success');
  }
}

/* --- 2. SERVICIOS ADICIONALES (ADDONS) --- */
function renderAdminAddonsTable() {
  const container = document.getElementById('adminAddonsTableBody');
  if (!container) return;
  container.innerHTML = AppState.addons.map(a => `
    <tr class="border-b border-slate-800 text-xs">
      <td class="py-3 px-3">
        <div class="font-bold text-white">${a.name}</div>
        <div class="text-[11px] text-slate-400">${a.desc || ''}</div>
      </td>
      <td class="py-3 px-3 font-extrabold text-white">${formatCOP(a.price)}</td>
      <td class="py-3 px-3 text-slate-300 font-semibold">+${a.extraTime || 0} min</td>
      <td class="py-3 px-3 text-right space-x-1.5">
        <button type="button" onclick="openAddonModal('${a.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700">✏️ Editar</button>
        <button type="button" onclick="deleteAddonConfirm('${a.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-[11px] border border-slate-800">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.openAddonModal = function(id) {
  const modal = document.getElementById('addonCrudModal');
  const title = document.getElementById('addonCrudModalTitle');
  const form = document.getElementById('addonCrudForm');
  if (id) {
    const a = AppState.addons.find(item => item.id === id);
    if (!a) return;
    title.textContent = 'Editar Servicio Adicional';
    document.getElementById('addonCrudId').value = a.id;
    document.getElementById('addonCrudName').value = a.name;
    document.getElementById('addonCrudPrice').value = a.price;
    document.getElementById('addonCrudExtraTime').value = a.extraTime || 15;
    document.getElementById('addonCrudDesc').value = a.desc || '';
  } else {
    title.textContent = 'Nuevo Servicio Adicional';
    form.reset();
    document.getElementById('addonCrudId').value = '';
    document.getElementById('addonCrudExtraTime').value = 15;
  }
  modal.classList.remove('hidden');
};

async function handleSaveAddon(e) {
  e.preventDefault();
  const id = document.getElementById('addonCrudId').value.trim() || ('addon_' + Date.now());
  const name = document.getElementById('addonCrudName').value.trim();
  const price = parseInt(document.getElementById('addonCrudPrice').value) || 0;
  const extraTime = parseInt(document.getElementById('addonCrudExtraTime').value) || 15;
  const desc = document.getElementById('addonCrudDesc').value.trim();

  const addonObj = { id, name, price, extraTime, desc };
  await DB.saveAddon(addonObj);

  const idx = AppState.addons.findIndex(a => a.id === id);
  if (idx > -1) AppState.addons[idx] = addonObj;
  else AppState.addons.push(addonObj);

  document.getElementById('addonCrudModal').classList.add('hidden');
  renderAdminAddonsTable();
  renderAddonsList();
  updateLivePriceSummary();
  showToast('Servicio adicional guardado.', 'success');
}

window.deleteAddonConfirm = async function(id) {
  if (confirm('¿Deseas eliminar este servicio adicional?')) {
    await DB.deleteAddon(id);
    AppState.addons = AppState.addons.filter(a => a.id !== id);
    renderAdminAddonsTable();
    renderAddonsList();
    updateLivePriceSummary();
    showToast('Servicio adicional eliminado.', 'info');
  }
};

/* --- 3. NIVELES DE NAIL ART --- */
function renderAdminDesignLevelsTable() {
  const container = document.getElementById('adminDesignLevelsTableBody');
  if (!container) return;
  const levels = AppState.designLevels || window.DESIGN_LEVELS;
  container.innerHTML = levels.map(d => `
    <tr class="border-b border-slate-800 text-xs">
      <td class="py-3 px-3 font-bold text-white flex items-center space-x-1.5">
        <span class="text-base">${d.icon || '🎨'}</span>
        <span>${d.name}</span>
      </td>
      <td class="py-3 px-3 text-slate-300 text-[11px]">${d.desc || ''}</td>
      <td class="py-3 px-3 font-extrabold text-white">${d.addPrice > 0 ? '+' + formatCOP(d.addPrice) : 'Incluido ($0)'}</td>
      <td class="py-3 px-3 text-slate-300 font-semibold">+${d.extraTime || 0} min</td>
      <td class="py-3 px-3 text-right space-x-1.5">
        <button type="button" onclick="openDesignLevelModal('${d.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700">✏️ Editar</button>
        <button type="button" onclick="deleteDesignLevelConfirm('${d.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-[11px] border border-slate-800">🗑️</button>
      </td>
    </tr>
  `).join('');
}

window.openDesignLevelModal = function(id) {
  const modal = document.getElementById('designLevelCrudModal');
  const title = document.getElementById('designLevelCrudModalTitle');
  const form = document.getElementById('designLevelCrudForm');
  if (id) {
    const d = AppState.designLevels.find(item => item.id === id);
    if (!d) return;
    title.textContent = 'Editar Nivel de Nail Art';
    document.getElementById('designLevelCrudId').value = d.id;
    document.getElementById('designLevelCrudIcon').value = d.icon || '🎨';
    document.getElementById('designLevelCrudName').value = d.name;
    document.getElementById('designLevelCrudPrice').value = d.addPrice || 0;
    document.getElementById('designLevelCrudExtraTime').value = d.extraTime || 0;
    document.getElementById('designLevelCrudDesc').value = d.desc || '';
  } else {
    title.textContent = 'Nuevo Nivel de Nail Art';
    form.reset();
    document.getElementById('designLevelCrudId').value = '';
    document.getElementById('designLevelCrudIcon').value = '🎨';
    document.getElementById('designLevelCrudExtraTime').value = 20;
  }
  modal.classList.remove('hidden');
};

async function handleSaveDesignLevel(e) {
  e.preventDefault();
  const id = document.getElementById('designLevelCrudId').value.trim() || ('art_' + Date.now());
  const icon = document.getElementById('designLevelCrudIcon').value.trim() || '🎨';
  const name = document.getElementById('designLevelCrudName').value.trim();
  const addPrice = parseInt(document.getElementById('designLevelCrudPrice').value) || 0;
  const extraTime = parseInt(document.getElementById('designLevelCrudExtraTime').value) || 0;
  const desc = document.getElementById('designLevelCrudDesc').value.trim();

  const levelObj = { id, icon, name, addPrice, extraTime, desc };
  const idx = AppState.designLevels.findIndex(d => d.id === id);
  if (idx > -1) AppState.designLevels[idx] = levelObj;
  else AppState.designLevels.push(levelObj);

  await DB.setSetting('designLevels', AppState.designLevels);
  document.getElementById('designLevelCrudModal').classList.add('hidden');
  renderAdminDesignLevelsTable();
  renderDesignLevels();
  updateLivePriceSummary();
  showToast('Nivel de diseño guardado.', 'success');
}

window.deleteDesignLevelConfirm = async function(id) {
  if (AppState.designLevels.length <= 1) {
    showToast('Debe existir al menos un nivel de diseño.', 'warning');
    return;
  }
  if (confirm('¿Deseas eliminar este nivel de diseño del catálogo?')) {
    AppState.designLevels = AppState.designLevels.filter(d => d.id !== id);
    await DB.setSetting('designLevels', AppState.designLevels);
    renderAdminDesignLevelsTable();
    renderDesignLevels();
    updateLivePriceSummary();
    showToast('Nivel de diseño eliminado.', 'info');
  }
};

/* --- 4. BEBIDAS DE CORTESÍA --- */
function renderAdminDrinksList() {
  const container = document.getElementById('adminDrinksList');
  if (!container) return;
  const drinks = (AppState.ambienceOptions && AppState.ambienceOptions.drink) || [];
  container.innerHTML = drinks.map(d => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-[#0d0d14] border border-slate-800 text-xs">
      <div class="font-bold text-white flex items-center space-x-2">
        <span class="text-sm">☕</span>
        <span>${d.label}</span>
      </div>
      <div class="flex items-center space-x-2">
        <button type="button" onclick="openDrinkModal('${d.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700">✏️ Modificar</button>
        <button type="button" onclick="deleteDrinkConfirm('${d.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-[11px] border border-slate-800">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.openDrinkModal = function(id) {
  const modal = document.getElementById('drinkCrudModal');
  const title = document.getElementById('drinkCrudModalTitle');
  const form = document.getElementById('drinkCrudForm');
  if (id) {
    const d = AppState.ambienceOptions.drink.find(item => item.id === id);
    if (!d) return;
    title.textContent = 'Editar Bebida de Cortesía';
    document.getElementById('drinkCrudId').value = d.id;
    document.getElementById('drinkCrudLabel').value = d.label;
  } else {
    title.textContent = 'Nueva Bebida de Cortesía';
    form.reset();
    document.getElementById('drinkCrudId').value = '';
  }
  modal.classList.remove('hidden');
};

async function handleSaveDrink(e) {
  e.preventDefault();
  const id = document.getElementById('drinkCrudId').value.trim() || ('drink_' + Date.now());
  const label = document.getElementById('drinkCrudLabel').value.trim();
  const drinkObj = { id, label };

  const idx = AppState.ambienceOptions.drink.findIndex(d => d.id === id);
  if (idx > -1) AppState.ambienceOptions.drink[idx] = drinkObj;
  else AppState.ambienceOptions.drink.push(drinkObj);

  await DB.setSetting('ambienceOptions', AppState.ambienceOptions);
  document.getElementById('drinkCrudModal').classList.add('hidden');
  renderAdminDrinksList();
  renderAmbienceSection();
  showToast('Bebida guardada en el menú.', 'success');
}

window.deleteDrinkConfirm = async function(id) {
  if (AppState.ambienceOptions.drink.length <= 1) {
    showToast('Debe existir al menos una opción en el menú.', 'warning');
    return;
  }
  if (confirm('¿Deseas eliminar esta bebida de cortesía?')) {
    AppState.ambienceOptions.drink = AppState.ambienceOptions.drink.filter(d => d.id !== id);
    await DB.setSetting('ambienceOptions', AppState.ambienceOptions);
    renderAdminDrinksList();
    renderAmbienceSection();
    showToast('Bebida eliminada del menú.', 'info');
  }
};

/* --- 5. MÚSICA EN EL ESTUDIO --- */
function renderAdminMusicList() {
  const container = document.getElementById('adminMusicList');
  if (!container) return;
  const music = (AppState.ambienceOptions && AppState.ambienceOptions.music) || [];
  container.innerHTML = music.map(m => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-[#0d0d14] border border-slate-800 text-xs">
      <div class="font-bold text-white flex items-center space-x-2">
        <span class="text-sm">🎵</span>
        <span>${m.label}</span>
      </div>
      <div class="flex items-center space-x-2">
        <button type="button" onclick="openMusicModal('${m.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700">✏️ Modificar</button>
        <button type="button" onclick="deleteMusicConfirm('${m.id}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-[11px] border border-slate-800">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');
}

window.openMusicModal = function(id) {
  const modal = document.getElementById('musicCrudModal');
  const title = document.getElementById('musicCrudModalTitle');
  const form = document.getElementById('musicCrudForm');
  if (id) {
    const m = AppState.ambienceOptions.music.find(item => item.id === id);
    if (!m) return;
    title.textContent = 'Editar Opción Musical';
    document.getElementById('musicCrudId').value = m.id;
    document.getElementById('musicCrudLabel').value = m.label;
  } else {
    title.textContent = 'Nueva Opción Musical';
    form.reset();
    document.getElementById('musicCrudId').value = '';
  }
  modal.classList.remove('hidden');
};

async function handleSaveMusic(e) {
  e.preventDefault();
  const id = document.getElementById('musicCrudId').value.trim() || ('music_' + Date.now());
  const label = document.getElementById('musicCrudLabel').value.trim();
  const musicObj = { id, label };

  const idx = AppState.ambienceOptions.music.findIndex(m => m.id === id);
  if (idx > -1) AppState.ambienceOptions.music[idx] = musicObj;
  else AppState.ambienceOptions.music.push(musicObj);

  await DB.setSetting('ambienceOptions', AppState.ambienceOptions);
  document.getElementById('musicCrudModal').classList.add('hidden');
  renderAdminMusicList();
  renderAmbienceSection();
  showToast('Opción musical guardada.', 'success');
}

window.deleteMusicConfirm = async function(id) {
  if (AppState.ambienceOptions.music.length <= 1) {
    showToast('Debe existir al menos una opción de música.', 'warning');
    return;
  }
  if (confirm('¿Deseas eliminar esta opción musical?')) {
    AppState.ambienceOptions.music = AppState.ambienceOptions.music.filter(m => m.id !== id);
    await DB.setSetting('ambienceOptions', AppState.ambienceOptions);
    renderAdminMusicList();
    renderAmbienceSection();
    showToast('Opción musical eliminada.', 'info');
  }
};

/* ========================================================
   LIGHTBOX VISOR DE FOTOS
   ======================================================== */

function openLightbox(imgId) {
  const img = AppState.booking.images.find(i => i.id === imgId);
  if (img) openLightboxDirect(img.data, img.notes || img.name);
}
window.openLightbox = openLightbox;

function openLightboxDirect(src, caption) {
  const modal = document.getElementById('imageLightboxModal');
  const imgEl = document.getElementById('lightboxModalImage');
  const captionEl = document.getElementById('lightboxModalCaption');
  if (!modal || !imgEl) return;

  imgEl.src = src;
  if (captionEl) captionEl.textContent = caption || '';
  modal.classList.remove('hidden');
}
window.openLightboxDirect = openLightboxDirect;

function closeLightbox() {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) modal.classList.add('hidden');
}
window.closeLightbox = closeLightbox;

/* ========================================================
   EXPORTAR CITAS A EXCEL (CSV)
   ======================================================== */

function exportAppointmentsCSV() {
  if (AppState.appointments.length === 0) {
    showToast('No hay citas para exportar', 'warning');
    return;
  }

  const headers = ['ID Cita', 'Fecha', 'Hora', 'Clienta', 'Teléfono', 'Servicio', 'Forma', 'Largo', 'Total COP', 'Anticipo COP', 'Estado'];
  const rows = AppState.appointments.map(a => [
    `"${a.id}"`,
    `"${a.date}"`,
    `"${a.time}"`,
    `"${a.clientName}"`,
    `"${a.clientPhone}"`,
    `"${a.serviceName}"`,
    `"${a.shape}"`,
    `"${a.length}"`,
    a.totalPrice,
    a.depositAmount,
    `"${a.status}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Citas_Delarosa_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Archivo CSV exportado exitosamente.', 'success');
}

function initPWA() {
  // Service Worker estándar para caché optimizada
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker registrado correctamente'))
      .catch(err => console.log('SW registration error:', err));
  }
}

/* ========================================================
   NOTIFICACIONES TOAST & UTILIDADES
   ======================================================== */

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const bgColors = {
    success: 'bg-[#0f0f18] text-white border-2 border-white shadow-xl',
    warning: 'bg-[#0f0f18] text-slate-200 border border-slate-600',
    error: 'bg-[#180a0e] text-rose-300 border border-rose-700',
    info: 'bg-[#0f0f18] text-slate-100 border border-slate-700'
  };

  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✨' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : '🤍'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 3500);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

/* ========================================================
   CONTROL DE INGRESOS, GASTOS & META DEL MUEBLE ($1.000.000 COP)
   ======================================================== */

function saveFinancesToStorage() {
  if (typeof DB !== 'undefined') {
    DB.setSetting('studioFinances', AppState.finances);
  }
  localStorage.setItem('delarosa_finances', JSON.stringify(AppState.finances));
  if (typeof CloudSync !== 'undefined') {
    CloudSync.pushToCloud(true);
  }
}

function renderFinancesDashboard() {
  if (!AppState.finances) {
    AppState.finances = {
      goal: { title: "Mueble de Lujo para el Estudio", targetAmount: 1000000, currentAmount: 350000, icon: "🪑" },
      movements: []
    };
  }
  const goal = AppState.finances.goal || { title: "Mueble de Lujo para el Estudio", targetAmount: 1000000, currentAmount: 350000 };
  const movements = AppState.finances.movements || [];

  // 1. Calcular Ingresos de Citas Completadas
  const completedAptsRevenue = AppState.appointments
    .filter(a => a.status === 'completed' || a.attendanceStatus === 'present')
    .reduce((sum, a) => sum + (a.totalPrice || 0), 0);

  // Ingresos extras manuales
  const extraIncome = movements
    .filter(m => m.type === 'income')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  const totalIncome = completedAptsRevenue + extraIncome;

  // Gastos
  const totalExpenses = movements
    .filter(m => m.type === 'expense')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  // Ganancia Neta
  const netProfit = totalIncome - totalExpenses;

  // 2. Renderizar Resumen General
  const incEl = document.getElementById('financeTotalIncome');
  const expEl = document.getElementById('financeTotalExpenses');
  const netEl = document.getElementById('financeNetProfit');
  if (incEl) incEl.textContent = formatCOP(totalIncome);
  if (expEl) expEl.textContent = formatCOP(totalExpenses);
  if (netEl) netEl.textContent = formatCOP(netProfit);

  // 3. Renderizar Progreso de la Meta del Mueble ($1.000.000 COP)
  const target = goal.targetAmount || 1000000;
  const current = goal.currentAmount || 0;
  const remaining = Math.max(0, target - current);
  const percent = Math.min(100, Math.round((current / target) * 100));

  const titleEl = document.getElementById('financeGoalTitle');
  const targetEl = document.getElementById('financeGoalTarget');
  const currentEl = document.getElementById('financeGoalCurrent');
  const remainingEl = document.getElementById('financeGoalRemaining');
  const percentTextEl = document.getElementById('financeGoalPercentText');
  const progressLabelEl = document.getElementById('financeGoalProgressLabel');
  const progressBarEl = document.getElementById('financeGoalProgressBar');
  const aptsNeededEl = document.getElementById('financeGoalAptsNeeded');

  if (titleEl) titleEl.textContent = goal.title || 'Mueble de Lujo para el Estudio';
  if (targetEl) targetEl.textContent = formatCOP(target);
  if (currentEl) currentEl.textContent = formatCOP(current);
  if (remainingEl) remainingEl.textContent = formatCOP(remaining);
  if (percentTextEl) percentTextEl.textContent = `${percent}% completado`;
  if (progressLabelEl) progressLabelEl.textContent = `${percent}% (${formatCOP(current)} / ${formatCOP(target)})`;
  if (progressBarEl) progressBarEl.style.width = `${percent}%`;
  if (aptsNeededEl) {
    const aptsAvg = Math.ceil(remaining / 100000);
    aptsNeededEl.textContent = remaining === 0 ? '🎉 ¡Meta Cumplida!' : `~${aptsAvg} citas promedio`;
  }

  // 4. Renderizar Tabla de Movimientos
  const tbody = document.getElementById('financeMovementsTableBody');
  if (tbody) {
    if (movements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-xs text-slate-400">No hay movimientos registrados aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = movements.map(m => {
      const isExpense = m.type === 'expense';
      const isGoal = m.type === 'goal_deposit';
      const badgeClass = isExpense 
        ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60' 
        : isGoal 
        ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
        : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60';
      const badgeText = isExpense ? 'Gasto' : isGoal ? 'Aporte Meta' : 'Ingreso';
      const amountPrefix = isExpense ? '-' : '+';
      const amountColor = isExpense ? 'text-rose-400' : isGoal ? 'text-amber-300' : 'text-emerald-400';

      return `
        <tr class="border-b border-slate-800 text-xs hover:bg-[#151522]">
          <td class="py-3 px-3 text-slate-300 font-semibold">${m.date}</td>
          <td class="py-3 px-3">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${badgeText}</span>
          </td>
          <td class="py-3 px-3 font-bold text-white">${escapeHtml(m.title)}</td>
          <td class="py-3 px-3 font-extrabold ${amountColor}">${amountPrefix}${formatCOP(m.amount)}</td>
          <td class="py-3 px-3 text-right">
            <button onclick="deleteFinanceMovement('${m.id}')" class="px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs" title="Eliminar">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }
}
window.renderFinancesDashboard = renderFinancesDashboard;

// Modal Modificar Meta
window.openFinanceGoalModal = function() {
  const goal = AppState.finances.goal;
  document.getElementById('goalTitleInput').value = goal.title || 'Mueble de Lujo para el Estudio';
  document.getElementById('goalTargetInput').value = goal.targetAmount || 1000000;
  document.getElementById('goalCurrentInput').value = goal.currentAmount || 0;
  document.getElementById('financeGoalModal').classList.remove('hidden');
};

window.closeFinanceGoalModal = function() {
  document.getElementById('financeGoalModal').classList.add('hidden');
};

window.handleSaveFinanceGoal = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const title = document.getElementById('goalTitleInput').value.trim() || 'Mueble de Lujo para el Estudio';
  const target = parseInt(document.getElementById('goalTargetInput').value) || 1000000;
  const current = parseInt(document.getElementById('goalCurrentInput').value) || 0;

  AppState.finances.goal.title = title;
  AppState.finances.goal.targetAmount = target;
  AppState.finances.goal.currentAmount = current;

  saveFinancesToStorage();
  renderFinancesDashboard();
  closeFinanceGoalModal();
  showToast('¡Meta de ahorro actualizada con éxito!', 'success');
};

// Modal Movimiento (Gasto o Ingreso Extra)
window.openFinanceMovementModal = function(type = 'expense') {
  document.getElementById('movementTypeInput').value = type;
  document.getElementById('movementModalTitle').textContent = type === 'expense' ? 'Registrar Gasto o Insumo' : 'Registrar Ingreso Extra';
  document.getElementById('movementModalIcon').textContent = type === 'expense' ? '📉' : '📈';
  document.getElementById('movementTitleInput').placeholder = type === 'expense' ? 'Ej: Compra de Monómero, Pincel y Limas' : 'Ej: Venta de Aceite de Cutícula o Propina';
  document.getElementById('movementSubmitBtn').textContent = type === 'expense' ? 'Guardar Gasto' : 'Guardar Ingreso';
  document.getElementById('movementTitleInput').value = '';
  document.getElementById('movementAmountInput').value = '';
  document.getElementById('movementDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('financeMovementModal').classList.remove('hidden');
};

window.closeFinanceMovementModal = function() {
  document.getElementById('financeMovementModal').classList.add('hidden');
};

window.handleSaveFinanceMovement = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const type = document.getElementById('movementTypeInput').value;
  const title = document.getElementById('movementTitleInput').value.trim();
  const amount = parseInt(document.getElementById('movementAmountInput').value) || 0;
  const date = document.getElementById('movementDateInput').value || new Date().toISOString().split('T')[0];

  if (!title || amount <= 0) {
    showToast('Ingresa un concepto y un monto válido en COP.', 'warning');
    return;
  }

  const newMovement = {
    id: 'mov_' + Date.now(),
    date,
    type,
    title,
    amount
  };

  AppState.finances.movements.unshift(newMovement);
  saveFinancesToStorage();
  renderFinancesDashboard();
  closeFinanceMovementModal();
  showToast(type === 'expense' ? 'Gasto registrado correctamente.' : 'Ingreso extra registrado.', 'success');
};

window.deleteFinanceMovement = function(id) {
  if (confirm('¿Eliminar este movimiento financiero?')) {
    AppState.finances.movements = AppState.finances.movements.filter(m => m.id !== id);
    saveFinancesToStorage();
    renderFinancesDashboard();
    showToast('Movimiento eliminado.', 'info');
  }
};

// Modal Asignar Ganancias a la Meta del Mueble
window.openFinanceAllocateModal = function() {
  document.getElementById('allocateAmountInput').value = '';
  document.getElementById('allocateNoteInput').value = '';
  document.getElementById('financeAllocateModal').classList.remove('hidden');
};

window.closeFinanceAllocateModal = function() {
  document.getElementById('financeAllocateModal').classList.add('hidden');
};

window.handleSaveFinanceAllocate = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const amount = parseInt(document.getElementById('allocateAmountInput').value) || 0;
  const note = document.getElementById('allocateNoteInput').value.trim() || 'Aporte a la Meta del Mueble';

  if (amount <= 0) {
    showToast('Ingresa un monto válido para abonar.', 'warning');
    return;
  }

  AppState.finances.goal.currentAmount = (AppState.finances.goal.currentAmount || 0) + amount;

  const newMovement = {
    id: 'mov_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    type: 'goal_deposit',
    title: note,
    amount
  };

  AppState.finances.movements.unshift(newMovement);
  saveFinancesToStorage();
  renderFinancesDashboard();
  closeFinanceAllocateModal();
  showToast(`¡Abonaste ${formatCOP(amount)} a tu meta del mueble! 🪑`, 'success');
};

/* ========================================================
   GESTIÓN DE SINCRONIZACIÓN EN LA NUBE (FIREBASE / REST)
   ======================================================== */

window.loadCloudSyncForm = function() {
  const input = document.getElementById('cloudDbUrlInput');
  if (input && typeof CloudSync !== 'undefined') {
    input.value = CloudSync.getDatabaseUrl();
  }
};

window.handleSaveCloudDbUrl = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('cloudDbUrlInput');
  const url = input ? input.value.trim() : '';

  if (!url) {
    CloudSync.setDatabaseUrl('');
    CloudSync.updateBadge('offline', 'Modo Local');
    showToast('Base de datos desconectada. Modo local activo.', 'info');
    return;
  }

  showToast('Probando conexión con la nube...', 'info');
  const result = await CloudSync.testConnection(url);
  if (result.success) {
    showToast(result.message, 'success');
  } else {
    showToast(result.message, 'error');
  }
};

window.triggerManualCloudPush = async function() {
  showToast('Subiendo catálogo, finanzas y horarios a la nube...', 'info');
  const success = await CloudSync.pushToCloud();
  if (success) {
    showToast('¡Datos subidos a la nube con éxito!', 'success');
  } else {
    showToast('No se pudo subir a la nube. Verifica tu conexión o URL.', 'error');
  }
};

window.triggerManualCloudPull = async function() {
  showToast('Descargando últimos datos de la nube...', 'info');
  const success = await CloudSync.pullFromCloud(false);
  if (success) {
    showToast('¡Datos descargados y actualizados en pantalla!', 'success');
  } else {
    showToast('No se encontraron datos en la nube o hubo un error.', 'warning');
  }
};
