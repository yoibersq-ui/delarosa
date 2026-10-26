// api/sync.js - Vercel Serverless Function para Delarosa Nail Designer
// Sincronización en tiempo real y persistencia en la nube vía GitHub API
const GITHUB_REPO = 'yoibersq-ui/delarosa';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'data/db.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';

let memoryCache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 3000; // 3 segundos de cache en memoria

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. GET: Consultar datos
    if (req.method === 'GET') {
      const now = Date.now();
      if (memoryCache && (now - cacheTime < CACHE_TTL_MS)) {
        return res.status(200).json(memoryCache);
      }

      const ghUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
      const ghRes = await fetch(ghUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Delarosa-Sync'
        }
      });

      if (!ghRes.ok) {
        if (ghRes.status === 404) {
          const initialData = {
            updatedAt: new Date().toISOString(),
            appointments: [],
            blockedSlots: [],
            services: [],
            addons: []
          };
          memoryCache = initialData;
          cacheTime = now;
          return res.status(200).json(initialData);
        }
        return res.status(ghRes.status).json({ error: 'Error al consultar GitHub' });
      }

      const fileData = await ghRes.json();
      const contentStr = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const parsedData = JSON.parse(contentStr);

      // Limpiar cualquier cita demo
      if (Array.isArray(parsedData.appointments)) {
        parsedData.appointments = parsedData.appointments.filter(a => 
          a && a.clientName !== 'Valentina Gómez' && a.clientName !== 'Carlos Méndez' && !String(a.id||'').startsWith('CITA-20261022-')
        );
      }

      memoryCache = parsedData;
      cacheTime = now;
      return res.status(200).json(parsedData);
    }

    // 2. POST / PUT: Guardar datos
    if (req.method === 'POST' || req.method === 'PUT') {
      let incomingData = req.body;
      if (typeof incomingData === 'string') {
        try {
          incomingData = JSON.parse(incomingData);
        } catch (e) {}
      }

      if (!incomingData || typeof incomingData !== 'object') {
        return res.status(400).json({ error: 'Payload inválido' });
      }

      // Obtener el SHA actual de GitHub
      const ghUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
      const ghRes = await fetch(ghUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Delarosa-Sync'
        }
      });

      let sha = null;
      let existingData = {};
      if (ghRes.ok) {
        const fileData = await ghRes.json();
        sha = fileData.sha;
        try {
          existingData = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
        } catch (e) {}
      }

      // Limpiar citas demo existentes
      if (Array.isArray(existingData.appointments)) {
        existingData.appointments = existingData.appointments.filter(a => 
          a && a.clientName !== 'Valentina Gómez' && a.clientName !== 'Carlos Méndez' && !String(a.id||'').startsWith('CITA-20261022-')
        );
      }

      // Mezclar datos
      const mergedData = {
        ...existingData,
        ...incomingData,
        updatedAt: new Date().toISOString()
      };

      // Si se envían citas, asegurar que no tengan citas falsas
      if (Array.isArray(mergedData.appointments)) {
        mergedData.appointments = mergedData.appointments.filter(a => 
          a && a.clientName !== 'Valentina Gómez' && a.clientName !== 'Carlos Méndez' && !String(a.id||'').startsWith('CITA-20261022-')
        );
      }

      // Guardar en GitHub
      const newContentBase64 = Buffer.from(JSON.stringify(mergedData, null, 2)).toString('base64');
      const putBody = {
        message: `Sync: Actualización de datos (${new Date().toLocaleTimeString('es-CO')})`,
        content: newContentBase64,
        branch: GITHUB_BRANCH
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(ghUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Delarosa-Sync'
        },
        body: JSON.stringify(putBody)
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        console.error('Error al guardar en GitHub:', errText);
        memoryCache = mergedData;
        cacheTime = Date.now();
        return res.status(200).json({ success: true, memoryOnly: true, data: mergedData });
      }

      memoryCache = mergedData;
      cacheTime = Date.now();
      return res.status(200).json({ success: true, updatedAt: mergedData.updatedAt, data: mergedData });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en /api/sync:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
};
