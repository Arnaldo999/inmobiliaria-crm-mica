// Modal Unificado "Nuevo Contrato" — 3 pasos
// Soporta 3 puertas: A (Clientes), B (Mapa Lote libre), C (Leads tabla)
// Mica / System IA — IDs Airtable (strings rec...), paleta ambar #f59e0b
// Requiere API_BASE, TENANT_SLUG, notif(), openModal/closeModal disponibles globalmente.
(function () {

  // ── Estado del wizard ────────────────────────────────────────────────────
  let _paso = 1;
  let _preload = {}; // pre-datos desde la puerta de entrada
  let _asesoresCache = [];
  let _clientesCache = [];
  let _leadsCache = [];

  // ── Abrir modal desde las 3 puertas ──────────────────────────────────────

  // Puerta A: desde panel Clientes Activos (sin pre-selección o con cliente)
  window.abrirContratoUnificado = function (opts) {
    opts = opts || {};
    _preload = opts;
    _paso = opts.paso_inicial || 1;
    _resetWizard();
    _aplicarPreload();
    _renderPaso();
    document.getElementById('modalContratoUnificado').classList.add('show');
  };

  // Puerta B: desde mapa → lote disponible
  window.abrirContratoDesideLote = function (loteId, loteoNombre, loteNumero) {
    abrirContratoUnificado({
      paso_inicial: 2,
      item_tipo: 'lote',
      item_id: loteId, // string Airtable rec...
      item_label: `${loteoNombre} · ${loteNumero}`,
      bloqueado: true,
      origen_creacion: 'activo_mapa',
    });
  };

  // Puerta C: desde tabla Leads → convertir
  window.abrirContratoDesideLead = function (leadAtId, leadNombre) {
    abrirContratoUnificado({
      paso_inicial: 1,
      modo_cliente: 'convertir_lead',
      lead_at_id: leadAtId,
      lead_nombre: leadNombre,
      origen_creacion: 'lead_convertido',
    });
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  function _resetWizard() {
    // paso 1
    const modoRadio = document.querySelector('input[name="cu-modo-cliente"][value="existente"]');
    if (modoRadio) modoRadio.checked = true;
    _setModoCliente('existente');
    // paso 2
    const tipoVentaLote = document.querySelector('input[name="cu-tipo"][value="venta_lote"]');
    if (tipoVentaLote) tipoVentaLote.checked = true;
    _onTipoChange('venta_lote');
    // paso 3
    const hoy = new Date().toISOString().slice(0, 10);
    _setVal('cu-fecha-firma', hoy);
    _setVal('cu-cuotas-total', '');
    _setVal('cu-monto-total', '');
    _setVal('cu-monto-cuota', '');
    _setVal('cu-proximo-venc', '');
    _setVal('cu-estado-pago', 'al_dia');
    _setVal('cu-moneda', 'USD');
    _setVal('cu-notas', '');
    _setVal('cu-asesor', '');
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function _getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  // ── Aplicar pre-carga desde la puerta ────────────────────────────────────
  function _aplicarPreload() {
    const p = _preload;

    // Paso 1 — cliente
    if (p.modo_cliente) {
      _setModoCliente(p.modo_cliente);
      const r = document.querySelector(`input[name="cu-modo-cliente"][value="${p.modo_cliente}"]`);
      if (r) r.checked = true;
    }
    if (p.cliente_activo_id) {
      const sel = document.getElementById('cu-cliente-select');
      if (sel) sel.value = p.cliente_activo_id;
    }
    if (p.lead_at_id) {
      const sel = document.getElementById('cu-lead-select');
      if (sel) sel.value = p.lead_at_id;
    }

    // Paso 2 — activo
    if (p.item_tipo) {
      const r = document.querySelector(`input[name="cu-tipo"][value="${_tipoContratoFromItemTipo(p.item_tipo)}"]`);
      if (r) {
        r.checked = true;
        _onTipoChange(r.value);
      }
      if (p.bloqueado) {
        document.querySelectorAll('input[name="cu-tipo"]').forEach(el => el.disabled = true);
      }
    }
    if (p.item_id) {
      setTimeout(() => {
        const sel = document.getElementById('cu-item-select');
        if (sel) sel.value = p.item_id;
      }, 600);
    }
  }

  function _tipoContratoFromItemTipo(itemTipo) {
    const map = { lote: 'venta_lote', propiedad: 'venta_casa', inmueble_renta: 'alquiler' };
    return map[itemTipo] || 'venta_lote';
  }

  // ── Render paso actual ────────────────────────────────────────────────────
  function _renderPaso() {
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById('cu-paso-' + i);
      if (el) el.style.display = i === _paso ? '' : 'none';
    }
    // Step indicators
    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById('cu-step-' + i);
      if (!dot) continue;
      dot.className = 'cu-step' + (i === _paso ? ' active' : (i < _paso ? ' done' : ''));
    }
    // Botones
    const btnPrev = document.getElementById('cu-btn-prev');
    const btnNext = document.getElementById('cu-btn-next');
    const btnSave = document.getElementById('cu-btn-save');
    if (btnPrev) btnPrev.style.display = _paso > 1 ? '' : 'none';
    if (btnNext) btnNext.style.display = _paso < 3 ? '' : 'none';
    if (btnSave) btnSave.style.display = _paso === 3 ? '' : 'none';

    if (_paso === 1) _cargarDatosPaso1();
    if (_paso === 2) _cargarDatosPaso2();
    if (_paso === 3) _cargarDatosPaso3();
  }

  // ── PASO 1 — Clientes ─────────────────────────────────────────────────────
  async function _cargarDatosPaso1() {
    try {
      const data = await crmFetch('/crm/activos');
      _clientesCache = data.records || [];
      const sel = document.getElementById('cu-cliente-select');
      if (sel) {
        sel.innerHTML = '<option value="">— Seleccionar cliente —</option>' +
          _clientesCache.map(c => `<option value="${c.id}">${c.Nombre || c.nombre || 'Cliente #' + c.id}</option>`).join('');
        if (_preload.cliente_activo_id) sel.value = _preload.cliente_activo_id;
      }
    } catch (e) {
      console.warn('[CU] Error cargando clientes:', e.message);
    }
    try {
      const data = await crmFetch('/crm/clientes');
      const todos = data.records || [];
      const ESTADOS_CONV = ['contactado', 'calificado', 'visita_agendada', 'visito', 'en_negociacion', 'seguimiento', 'nuevo', 'no_contactado'];
      _leadsCache = todos.filter(l => {
        const est = (l.Estado || '').toLowerCase();
        return ESTADOS_CONV.some(e => est.includes(e)) && !est.includes('cerrado') && !est.includes('perdido');
      });
      const sel = document.getElementById('cu-lead-select');
      if (sel) {
        sel.innerHTML = '<option value="">— Seleccionar lead —</option>' +
          _leadsCache.map(l => {
            const n = [l.Nombre || '', l.Apellido || ''].join(' ').trim() || l.Telefono || 'Lead';
            return `<option value="${l.id}">${n}</option>`;
          }).join('');
        if (_preload.lead_at_id) sel.value = _preload.lead_at_id;
      }
    } catch (e) {
      console.warn('[CU] Error cargando leads:', e.message);
    }
  }

  window._cuSetModoCliente = function (modo) {
    _setModoCliente(modo);
  };

  function _setModoCliente(modo) {
    const areas = { existente: 'cu-area-existente', convertir_lead: 'cu-area-lead', cliente_nuevo: 'cu-area-nuevo' };
    Object.entries(areas).forEach(([k, id]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = k === modo ? '' : 'none';
    });
  }

  function _validarPaso1() {
    const modo = document.querySelector('input[name="cu-modo-cliente"]:checked')?.value;
    if (!modo) return 'Selecciona un tipo de cliente';
    if (modo === 'existente') {
      if (!_getVal('cu-cliente-select')) return 'Selecciona un cliente activo';
    }
    if (modo === 'convertir_lead') {
      if (!_getVal('cu-lead-select')) return 'Selecciona un lead a convertir';
    }
    if (modo === 'cliente_nuevo') {
      if (!_getVal('cu-nuevo-nombre')) return 'El nombre es obligatorio';
      if (!_getVal('cu-nuevo-apellido')) return 'El apellido es obligatorio';
      if (!_getVal('cu-nuevo-tel')) return 'El telefono es obligatorio';
    }
    return null;
  }

  // ── PASO 2 — Activo ───────────────────────────────────────────────────────
  window._cuOnTipoChange = function (val) { _onTipoChange(val); };

  async function _onTipoChange(tipo) {
    const spinner = document.getElementById('cu-item-spinner');
    const selWrap = document.getElementById('cu-item-wrap');
    if (spinner) spinner.style.display = '';
    if (selWrap) selWrap.style.display = 'none';
    const sel = document.getElementById('cu-item-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando...</option>';

    try {
      let items = [];
      if (tipo === 'venta_lote') {
        const d = await crmFetch('/crm/lotes-mapa?estado=disponible');
        items = (d.items || []).map(l => ({ id: l.id, label: `${l.loteo_nombre || ''} · Lote ${l.numero}` }));
      } else if (['venta_casa', 'venta_terreno', 'venta_unidad'].includes(tipo)) {
        const d = await crmFetch('/crm/propiedades?disponible=true');
        const tipoMap = { venta_casa: 'casa', venta_terreno: 'terreno', venta_unidad: 'departamento' };
        const tipoFilt = tipoMap[tipo];
        const recs = d.records || [];
        const filtrados = tipoFilt ? recs.filter(p => (p.Tipo || p.tipo || '').toLowerCase().includes(tipoFilt)) : recs;
        items = filtrados.map(p => ({ id: p.id || p.ID, label: p.Titulo || p.titulo || 'Propiedad #' + (p.id || p.ID) }));
      } else if (tipo === 'alquiler') {
        const d = await crmFetch('/crm/inmuebles-renta?disponible=true');
        items = (d.items || []).map(i => ({ id: i.id, label: i.titulo || 'Inmueble #' + i.id }));
      }
      // Los IDs ya son strings (rec...) en Airtable — no hacer parseInt
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        items.map(i => `<option value="${i.id}">${i.label}</option>`).join('');
      if (_preload.item_id) sel.value = _preload.item_id;
    } catch (e) {
      sel.innerHTML = `<option value="">Error: ${e.message}</option>`;
    } finally {
      if (spinner) spinner.style.display = 'none';
      if (selWrap) selWrap.style.display = '';
    }
  }

  async function _cargarDatosPaso2() {
    const checked = document.querySelector('input[name="cu-tipo"]:checked');
    if (checked) await _onTipoChange(checked.value);
  }

  function _validarPaso2() {
    if (!_getVal('cu-item-select')) return 'Selecciona el activo (lote, propiedad o inmueble)';
    return null;
  }

  // ── PASO 3 — Contrato ─────────────────────────────────────────────────────
  async function _cargarDatosPaso3() {
    try {
      const d = await crmFetch('/crm/asesores');
      _asesoresCache = d.items || [];
      const sel = document.getElementById('cu-asesor');
      if (sel) {
        sel.innerHTML = '<option value="">— Sin asesor —</option>' +
          _asesoresCache.map(a => {
            const n = [a.nombre || '', a.apellido || ''].join(' ').trim();
            return `<option value="${a.id}">${n}</option>`;
          }).join('');
      }
    } catch (e) {
      console.warn('[CU] Error cargando asesores:', e.message);
    }
  }

  window._cuCalcularCuota = function () {
    const total = parseFloat(_getVal('cu-monto-total')) || 0;
    const cuotas = parseInt(_getVal('cu-cuotas-total')) || 1;
    const cuota = cuotas > 0 ? Math.round((total / cuotas) * 100) / 100 : 0;
    _setVal('cu-monto-cuota', cuota > 0 ? cuota : '');
  };

  function _validarPaso3() {
    if (!_getVal('cu-fecha-firma')) return 'Ingresa la fecha de firma';
    if (!_getVal('cu-monto-total')) return 'Ingresa el monto total';
    if (!_getVal('cu-cuotas-total')) return 'Ingresa las cuotas totales';
    return null;
  }

  // ── Navegacion ────────────────────────────────────────────────────────────
  window._cuPrev = function () {
    if (_paso > 1) { _paso--; _renderPaso(); }
  };

  window._cuNext = function () {
    const err = _paso === 1 ? _validarPaso1() : _validarPaso2();
    if (err) { _showError(err); return; }
    _clearError();
    _paso++;
    _renderPaso();
  };

  function _showError(msg) {
    const el = document.getElementById('cu-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }
  function _clearError() {
    const el = document.getElementById('cu-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  window._cuGuardar = async function () {
    const err3 = _validarPaso3();
    if (err3) { _showError(err3); return; }
    _clearError();

    const btn = document.getElementById('cu-btn-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      const body = _construirBody();
      const res = await crmFetch('/crm/contratos', { method: 'POST', body: JSON.stringify(body) });
      document.getElementById('modalContratoUnificado').classList.remove('show');
      notif('Contrato creado', `ID ${res.id || ''}`);
      // Auto-refresh paneles
      if (typeof cargarActivos === 'function') await cargarActivos();
      if (typeof cargarContratos === 'function') cargarContratos();
      if (typeof cargarLoteos === 'function') cargarLoteos();
    } catch (e) {
      _showError('Error al guardar: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Crear contrato'; }
    }
  };

  function _construirBody() {
    const modo = document.querySelector('input[name="cu-modo-cliente"]:checked')?.value;
    const tipo = document.querySelector('input[name="cu-tipo"]:checked')?.value;
    // Airtable: IDs son strings rec..., no se castean a Number
    const itemId = _getVal('cu-item-select') || null;

    const itemTipoMap = {
      venta_lote: 'lote',
      venta_casa: 'propiedad',
      venta_terreno: 'propiedad',
      venta_unidad: 'propiedad',
      alquiler: 'inmueble_renta',
    };

    const body = {
      tenant_slug: TENANT_SLUG,
      tipo,
      item_tipo: itemTipoMap[tipo] || 'lote',
      item_id: itemId, // string Airtable — no parseInt
      asesor_id: _getVal('cu-asesor') || null, // string Airtable
      fecha_firma: _getVal('cu-fecha-firma'),
      monto_total: parseFloat(_getVal('cu-monto-total')) || null,
      cuotas_total: parseInt(_getVal('cu-cuotas-total')) || null,
      cuotas_pagadas: 0,
      monto_cuota: parseFloat(_getVal('cu-monto-cuota')) || null,
      moneda: _getVal('cu-moneda') || 'USD',
      proximo_vencimiento: _getVal('cu-proximo-venc') || null,
      estado_pago: _getVal('cu-estado-pago') || 'al_dia',
      notas: _getVal('cu-notas') || null,
      origen_creacion: _preload.origen_creacion || 'manual_directo',
    };

    // Cliente segun modo
    if (modo === 'existente') {
      body.cliente_activo_id = _getVal('cu-cliente-select') || null; // string Airtable
    } else if (modo === 'convertir_lead') {
      body.convertir_lead_id = _getVal('cu-lead-select'); // string Airtable
    } else if (modo === 'cliente_nuevo') {
      body.cliente_nuevo = {
        nombre: _getVal('cu-nuevo-nombre'),
        apellido: _getVal('cu-nuevo-apellido'),
        telefono: _getVal('cu-nuevo-tel'),
        email: _getVal('cu-nuevo-email'),
        documento: _getVal('cu-nuevo-doc'),
      };
    }

    return body;
  }

  // ── Cerrar modal ──────────────────────────────────────────────────────────
  window._cuCerrar = function () {
    document.getElementById('modalContratoUnificado').classList.remove('show');
    // Rehabilitar radios de tipo (por si venian bloqueados desde mapa)
    document.querySelectorAll('input[name="cu-tipo"]').forEach(el => el.disabled = false);
  };

})();
