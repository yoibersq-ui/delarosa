/**
 * sample-data.js - Configuración oficial y catálogo de Delarosa Nail Designer
 * Ubicación: Apartadó - Antioquia (Barrio Laureles)
 * Instagram: @delarosaa_02
 * Precios reales en Pesos Colombianos (COP)
 */

const SAMPLE_CONFIG = {
  studioName: "Delarosa Nail Designer",
  designerName: "Julieth De la Rosa",
  slogan: "Destaca tu personalidad con uñas únicas 🤍",
  instagram: "@delarosaa_02",
  instagramUrl: "https://instagram.com/delarosaa_02",
  facebook: "Julieth De la Rosa",
  facebookUrl: "https://www.facebook.com/search/top?q=Julieth%20De%20la%20Rosa",
  tiktok: "@delarosaa_02",
  tiktokUrl: "https://www.tiktok.com/@delarosaa_02",
  location: "Apartadó - Antioquia (Barrio Laureles), Colombia",
  locationMapsUrl: "https://www.google.com/maps/search/Apartad%C3%B3+Antioquia+Barrio+Laureles",
  phone: "573226376819", // Celular real de Julieth De la Rosa
  email: "delarosaa02@gmail.com",
  currency: "COP",
  adminPassword: "GabrielyEly25", // Contraseña obligatoria del panel
  depositPercentage: 30, // 30% de anticipo para apartar cupo
  paymentMethods: "Nequi / Daviplata: 322 637 6819 | Bancolombia Ahorros (A nombre de Julieth De la Rosa)",
  cloudDbUrl: "/api/sync", // Sincronización en tiempo real automática en la nube (Vercel API)
  
  // Fotos personalizadas (por defecto usan las imágenes de assets)
  customProfilePhoto: null,
  customPriceFlyerPhoto: null,

  // Sistema de Alarmas y Recordatorios (24h, 2h, 1h, 10min)
  alarmsEnabled: true,
  alarmIntervals: [
    { id: "24h", label: "24 Horas Antes", minutesBefore: 1440, msg: "Faltan 24 horas para tu cita de uñas en Delarosa Nail Designer." },
    { id: "2h", label: "2 Horas Antes", minutesBefore: 120, msg: "Faltan 2 horas para tu cita. Te esperamos en el estudio." },
    { id: "1h", label: "1 Hora Antes", minutesBefore: 60, msg: "Falta solo 1 hora para tu cita de uñas. ¡Prepara tus manos!" },
    { id: "10m", label: "10 Minutos Antes", minutesBefore: 10, msg: "¡Tu cita comienza en 10 minutos! Te estamos esperando." }
  ],

  // Reglas de tiempo inteligentes (Modificables en el panel)
  timingRules: {
    womanDefaultMinutes: 240, // 4 horas promedio para damas (rango 3-4 horas)
    manDefaultMinutes: 120,   // 2 horas promedio para caballeros (rango 1.5-2 horas)
    feetExtraMinutes: 60,     // 1 hora adicional si incluye pies
    cleaningBufferMinutes: 15 // Margen de esterilización y descanso entre citas
  },

  workingHours: {
    start: "09:00", // Horario inicial por defecto: 9:00 AM (Modificable en el panel)
    end: "19:00",   // Horario final por defecto: 7:00 PM (Modificable en el panel)
    slotInterval: 30, // Intervalo para chequear disponibilidad
    daysOpen: [1, 2, 3, 4, 5, 6] // Lunes a Sábado
  }
};

// Catálogo oficial de servicios según el flyer de precios oficial
const OFFICIAL_SERVICES = [
  // SERVICIOS PARA DAMA (Promedio 3 a 4 horas)
  {
    id: "semi-manos-dama",
    name: "Semi manos para dama",
    category: "dama",
    targetGender: "woman",
    price: 40000,
    durationMin: 180, // 3 horas
    description: "Limpieza profunda de cutículas con técnica combinada, nivelación y esmaltado semipermanente de larga duración.",
    badge: "Básico Dama"
  },
  {
    id: "semi-pies-dama",
    name: "Semi pies dama",
    category: "dama",
    targetGender: "woman",
    price: 40000,
    durationMin: 60, // 1 hora
    description: "Pedicura estética completa, exfoliación, limado y esmaltado semipermanente en pies.",
    badge: "Pies Dama"
  },
  {
    id: "duo-semi-dama",
    name: "Dúo Semi Manos + Pies Dama",
    category: "dama",
    targetGender: "woman",
    price: 80000,
    durationMin: 240, // 4 horas
    description: "Sesión completa para manos y pies. Manicura y pedicura rusa con esmaltado semipermanente.",
    badge: "Combo Favorito"
  },
  {
    id: "soft-gel",
    name: "Soft gel (Press on)",
    category: "dama",
    targetGender: "woman",
    price: 75000,
    durationMin: 180, // 3 horas
    description: "Extensiones de gel completo adheridas con base estructural. Ultra ligeras, resistentes y naturales.",
    badge: "Tendencia"
  },
  {
    id: "polygel-extensiones",
    name: "Polygel con extensiones",
    category: "dama",
    targetGender: "woman",
    price: 80000,
    durationMin: 210, // 3.5 horas
    description: "Extensiones con técnica híbrida de polygel. Máxima resistencia, sin olor fuerte y acabado impecable.",
    badge: "Resistente"
  },
  {
    id: "esculturales-poly",
    name: "Esculturales en poly",
    category: "dama",
    targetGender: "woman",
    price: 100000,
    durationMin: 240, // 4 horas
    description: "Uñas esculpidas a mano sobre molde con técnica artística en polygel. Alta gama y durabilidad extrema.",
    badge: "Alta Gama"
  },
  {
    id: "forrado-polygel",
    name: "Forrado en polygel",
    category: "dama",
    targetGender: "woman",
    price: 60000,
    durationMin: 180, // 3 horas
    description: "Blindaje de polygel sobre la uña natural para protegerla contra roturas y permitir su crecimiento.",
    badge: "Blindaje"
  },
  {
    id: "rubber-semi",
    name: "Rubber + Semi",
    category: "dama",
    targetGender: "woman",
    price: 55000,
    durationMin: 180, // 3 horas
    description: "Alineación y nivelación con Rubber Base para aportar volumen y curvatura natural + esmalte semi.",
    badge: "Salud Uña"
  },
  {
    id: "dipping-semi",
    name: "Dipping + Semi",
    category: "dama",
    targetGender: "woman",
    price: 60000,
    durationMin: 180, // 3 horas
    description: "Inmersión en polvo acrílico enriquecido con calcio y vitaminas + sellado semipermanente.",
    badge: "Fortalecedor"
  },

  // SERVICIOS PARA CABALLERO (HOMBRES - Promedio 1:30 a 2 horas)
  {
    id: "semi-manos-hombre",
    name: "Semi manos para hombre",
    category: "hombre",
    targetGender: "man",
    price: 25000,
    durationMin: 90, // 1.5 horas
    description: "Cuidado masculino integral: corte clínico, remoción de cutícula, pulido mate o brillo natural y exfoliación.",
    badge: "Caballero"
  },
  {
    id: "semi-pies-hombre",
    name: "Semi para pies hombre",
    category: "hombre",
    targetGender: "man",
    price: 25000,
    durationMin: 60, // 1 hora
    description: "Pedicura higiénica masculina, remoción de durezas, corte y masoterapia hidratante.",
    badge: "Caballero"
  },
  {
    id: "duo-hombre",
    name: "Dúo Manos + Pies Hombre",
    category: "hombre",
    targetGender: "man",
    price: 50000,
    durationMin: 120, // 2 horas
    description: "Servicio completo para caballeros: limpieza profunda de manos y pies con acabado impecable.",
    badge: "Combo Caballero"
  },
  {
    id: "solo-limpieza",
    name: "Solo limpieza",
    category: "general",
    targetGender: "both",
    price: 20000,
    durationMin: 45, // 45 minutos
    description: "Corte higiénico, limado de bordes y remoción de cutícula sin esmaltado.",
    badge: "Express"
  }
];

// Adicionales oficiales
const OFFICIAL_ADDONS = [
  {
    id: "accesorios",
    name: "Accesorios (Cristales, dijes, stickers)",
    price: 2000,
    extraTime: 15,
    desc: "Acentos decorativos de pedrería fina y aplicaciones 3D"
  },
  {
    id: "una-adicional-fuera",
    name: "Uña adicional fuera del servicio",
    price: 8000,
    extraTime: 20,
    desc: "Reconstrucción o reparación de una uña sin realizar un set completo"
  },
  {
    id: "una-adicional-en-servicio",
    name: "Uña adicional en el servicio",
    price: 5000,
    extraTime: 15,
    desc: "Reparación o alargamiento de una uña durante el servicio agendado"
  },
  {
    id: "retiro-material",
    name: "Retiro de set o material previo",
    price: 10000,
    extraTime: 30,
    desc: "Retiro seguro con torno profesional protegiendo la lámina ungueal"
  }
];

const NAIL_SHAPES = [
  {
    id: "almond",
    name: "Almendra",
    desc: "Alarga visualmente y estiliza los dedos con punta suavemente redondeada",
    preview: "Almendra",
    svg: `<svg viewBox="0 0 60 90" class="w-10 h-14 mx-auto mb-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 74 C14 54, 16 36, 22 20 C25 12, 28 8, 30 8 C32 8, 35 12, 38 20 C44 36, 46 54, 46 74 C46 80, 14 80, 14 74 Z" fill="url(#gradAlmond)" stroke="#e2d4be" stroke-width="1.6"/>
      <path d="M22 26 C26 18, 30 16, 34 20" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <ellipse cx="30" cy="74" rx="13" ry="4.5" fill="#181822" opacity="0.6"/>
      <defs>
        <linearGradient id="gradAlmond" x1="0" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3d2c3e"/>
          <stop offset="0.6" stop-color="#1f1624"/>
          <stop offset="1" stop-color="#110d14"/>
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    id: "coffin",
    name: "Coffin / Bailarina",
    desc: "Sofisticada, recta con punta cortada horizontal",
    preview: "Coffin",
    svg: `<svg viewBox="0 0 60 90" class="w-10 h-14 mx-auto mb-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 74 C15 54, 18 36, 23 13 L37 13 C42 36, 45 54, 46 74 C46 80, 14 80, 14 74 Z" fill="url(#gradCoffin)" stroke="#e2d4be" stroke-width="1.6"/>
      <path d="M23 13 L37 13" stroke="#ffffff" stroke-width="2.2" stroke-linecap="square"/>
      <path d="M25 24 C28 17, 32 17, 35 24" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <ellipse cx="30" cy="74" rx="13" ry="4.5" fill="#181822" opacity="0.6"/>
      <defs>
        <linearGradient id="gradCoffin" x1="0" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3d2c3e"/>
          <stop offset="0.6" stop-color="#1f1624"/>
          <stop offset="1" stop-color="#110d14"/>
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    id: "square",
    name: "Cuadrada Clásica",
    desc: "Bordes limpios, paralelos y rectos definidos",
    preview: "Cuadrada",
    svg: `<svg viewBox="0 0 60 90" class="w-10 h-14 mx-auto mb-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 74 L15 13 L45 13 L45 74 C45 80, 15 80, 15 74 Z" fill="url(#gradSquare)" stroke="#e2d4be" stroke-width="1.6"/>
      <path d="M15 13 L45 13" stroke="#ffffff" stroke-width="2.2" stroke-linecap="square"/>
      <line x1="20" y1="20" x2="20" y2="36" stroke="#ffffff" stroke-width="1.2" opacity="0.6" stroke-linecap="round"/>
      <ellipse cx="30" cy="74" rx="13" ry="4.5" fill="#181822" opacity="0.6"/>
      <defs>
        <linearGradient id="gradSquare" x1="0" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3d2c3e"/>
          <stop offset="0.6" stop-color="#1f1624"/>
          <stop offset="1" stop-color="#110d14"/>
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    id: "squoval",
    name: "Squoval (Cuadrada Oval)",
    desc: "Cuadrada con esquinas suavemente redondeadas",
    preview: "Squoval",
    svg: `<svg viewBox="0 0 60 90" class="w-10 h-14 mx-auto mb-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 74 L15 20 Q15 13 22 13 L38 13 Q45 13 45 20 L45 74 C45 80, 15 80, 15 74 Z" fill="url(#gradSquoval)" stroke="#e2d4be" stroke-width="1.6"/>
      <path d="M20 13 L40 13" stroke="#ffffff" stroke-width="1.8"/>
      <ellipse cx="30" cy="74" rx="13" ry="4.5" fill="#181822" opacity="0.6"/>
      <defs>
        <linearGradient id="gradSquoval" x1="0" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3d2c3e"/>
          <stop offset="0.6" stop-color="#1f1624"/>
          <stop offset="1" stop-color="#110d14"/>
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    id: "stiletto",
    name: "Stiletto (En punta)",
    desc: "Puntiaguda y de alto impacto estético",
    preview: "Stiletto",
    svg: `<svg viewBox="0 0 60 90" class="w-10 h-14 mx-auto mb-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 74 C15 54, 18 36, 30 6 C42 36, 45 54, 46 74 C46 80, 14 80, 14 74 Z" fill="url(#gradStiletto)" stroke="#e2d4be" stroke-width="1.6"/>
      <circle cx="30" cy="7" r="1.5" fill="#ffffff"/>
      <path d="M26 22 L30 10 L34 22" stroke="#ffffff" stroke-width="1.2" opacity="0.7"/>
      <ellipse cx="30" cy="74" rx="13" ry="4.5" fill="#181822" opacity="0.6"/>
      <defs>
        <linearGradient id="gradStiletto" x1="0" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3d2c3e"/>
          <stop offset="0.6" stop-color="#1f1624"/>
          <stop offset="1" stop-color="#110d14"/>
        </linearGradient>
      </defs>
    </svg>`
  },
  {
    id: "oval",
    name: "Ovalada Natural",
    desc: "Curva delicada que respeta el contorno natural",
    preview: "Ovalada",
    svg: `<svg viewBox="0 0 60 90" class="w-10 h-14 mx-auto mb-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 74 C15 50, 17 28, 30 13 C43 28, 45 50, 45 74 C45 80, 15 80, 15 74 Z" fill="url(#gradOval)" stroke="#e2d4be" stroke-width="1.6"/>
      <path d="M22 24 C26 18, 34 18, 38 24" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <ellipse cx="30" cy="74" rx="13" ry="4.5" fill="#181822" opacity="0.6"/>
      <defs>
        <linearGradient id="gradOval" x1="0" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3d2c3e"/>
          <stop offset="0.6" stop-color="#1f1624"/>
          <stop offset="1" stop-color="#110d14"/>
        </linearGradient>
      </defs>
    </svg>`
  }
];

const NAIL_LENGTHS = [
  { id: "natural", name: "Natural (Largo propio)", addPrice: 0, tag: "N" },
  { id: "short", name: "Corto (S)", addPrice: 0, tag: "S" },
  { id: "medium", name: "Medio (M)", addPrice: 5000, tag: "M" },
  { id: "long", name: "Largo (L)", addPrice: 10000, tag: "L" },
  { id: "xlong", name: "Extra Largo (XL)", addPrice: 15000, tag: "XL" }
];

const DESIGN_LEVELS = [
  {
    id: "basic",
    name: "Liso / Básico",
    desc: "1 solo tono sólido, nude o brillo gloss",
    addPrice: 0,
    extraTime: 0,
    icon: "⚪"
  },
  {
    id: "french",
    name: "Francés Clásico o Baby Boomer",
    desc: "Línea francesa impecable o difuminado degradé suave",
    addPrice: 10000,
    extraTime: 20,
    icon: "✨"
  },
  {
    id: "medium",
    name: "Diseño Intermedio (Trend Art)",
    desc: "Glitter, líneas abstractas, foil metalizado o 2-4 uñas decoradas",
    addPrice: 18000,
    extraTime: 30,
    icon: "🎨"
  },
  {
    id: "advanced",
    name: "Full Glam / Arte Avanzado & 3D",
    desc: "Mano alzada compleja, cristales, relieves 3D, encapsulado completo",
    addPrice: 25000,
    extraTime: 45,
    icon: "👑"
  }
];

// Opciones de Ambiente Personalizado (VIP & Opcional)
const AMBIENCE_OPTIONS = {
  vibe: [
    { id: "silent", label: "🤫 Modo Silencioso / Zen", desc: "Deseo descansar, desconectar o leer en paz. Sin conversación obligatoria." },
    { id: "chat", label: "💬 Modo Charla & Social", desc: "¡Me encanta platicar, compartir novedades y pasar un rato divertido!" },
    { id: "headphones", label: "🎧 Modo Mis Audífonos / Pantalla", desc: "Estaré viendo mi serie, podcast o escuchando mi propia música en audífonos." }
  ],
  music: [
    { id: "lofi", label: "☕ Lo-Fi & Acústico Chill" },
    { id: "pop", label: "🎵 Pop & Top Hits" },
    { id: "spa", label: "🌿 Sonidos Zen & Spa Relajante" },
    { id: "none", label: "🔇 Sin música (Silencio total)" }
  ],
  drink: [
    { id: "latte", label: "☕ Café Latte o Capuccino espumoso" },
    { id: "tea", label: "🍵 Té verde o Infusión frutal aromática" },
    { id: "water", label: "🍋 Agua helada con rodajas de limón y menta" },
    { id: "mimosa", label: "🥂 Copa de Mimosa / Vino espumoso de cortesía" },
    { id: "none", label: "🚫 No deseo bebida" }
  ],
  sensitivities: [
    { id: "cuticles", label: "Cutículas hipersensibles" },
    { id: "ticklish", label: "Cosquillas en manos o pies" },
    { id: "dust", label: "Alergia o molestia al polvillo" },
    { id: "none", label: "Ninguna sensibilidad especial" }
  ]
};

// Citas iniciales para la agenda (Vacía por defecto: no generar citas falsas)
const INITIAL_DEMO_APPOINTMENTS = [];

window.SAMPLE_CONFIG = SAMPLE_CONFIG;
window.OFFICIAL_SERVICES = OFFICIAL_SERVICES;
window.OFFICIAL_ADDONS = OFFICIAL_ADDONS;
window.NAIL_SHAPES = NAIL_SHAPES;
window.NAIL_LENGTHS = NAIL_LENGTHS;
window.DESIGN_LEVELS = DESIGN_LEVELS;
window.AMBIENCE_OPTIONS = AMBIENCE_OPTIONS;
window.INITIAL_DEMO_APPOINTMENTS = INITIAL_DEMO_APPOINTMENTS;
