// CRM Helpers compartidos entre todos los paneles del CRM completo
// Requiere que API_BASE y showNotif() estén definidos globalmente en crm.html

window.crmFetch = async function(path, options = {}) {
  const token = sessionStorage.getItem(`crm_token_${window.TENANT_SLUG || 'mica-demo'}`);
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const rawText = await res.text();
    let msg = rawText;
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && parsed.detail) msg = parsed.detail;
    } catch (_) { /* no era JSON */ }
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return await res.json();
};

window.crmCreate = async function(recurso, campos) {
  const data = await crmFetch(`/crm/${recurso}`, { method: 'POST', body: JSON.stringify(campos) });
  // El backend puede devolver HTTP 200 pero con {"error":"..."} cuando Airtable rechaza
  if (data && typeof data === 'object' && data.error && !data.id) {
    throw new Error(data.error);
  }
  return data;
};

window.crmUpdate = async function(recurso, id, campos) {
  const data = await crmFetch(`/crm/${recurso}/${id}`, { method: 'PATCH', body: JSON.stringify(campos) });
  // idem — PATCH puede retornar false o {"error":"..."} con HTTP 200
  if (data === false || (data && typeof data === 'object' && data.error)) {
    throw new Error((data && data.error) ? data.error : 'Error al actualizar registro');
  }
  return data;
};

window.crmDelete = async function(recurso, id) {
  return await crmFetch(`/crm/${recurso}/${id}`, { method: 'DELETE' });
};

window.crmList = async function(recurso) {
  return await crmFetch(`/crm/${recurso}`);
};

// Notificación simple (fallback si showNotif no existe)
window.notif = function(title, body = '') {
  if (typeof showNotif === 'function') showNotif(title, body);
  else console.log(`[NOTIF] ${title} ${body}`);
};

// Helpers de modal compatibles con dev (hidden) y prod (show)
window.abrirModal = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof openModal === 'function') { openModal(id); }
  else { el.classList.remove('hidden'); el.classList.add('show'); }
};

window.cerrarModal = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof closeModal === 'function') { closeModal(id); }
  else { el.classList.add('hidden'); el.classList.remove('show'); }
};
