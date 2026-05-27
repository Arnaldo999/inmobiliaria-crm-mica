// Panel Inquilinos — persona unica + alquiler unificado
// Mica / System IA — paleta ambar #f59e0b — IDs Airtable (strings rec...)
// Flujo modal: Paso 1 buscar/crear persona -> Paso 2 datos del alquiler
(function () {
  let _items = [];
  let _inmueblesCache = [];
  let _personaSeleccionada = null; // { id, nombre, apellido, telefono, email, documento }
  let _autocompleteTid = null;

  window.cargarInquilinos = async function () {
    const cont = document.getElementById('inquilinosBody');
    if (!cont) return;
    cont.innerHTML = _skeletonRow(4);
    try {
      const [dataInq, dataInm] = await Promise.all([
        crmFetch('/crm/inquilinos'),
        crmFetch('/crm/inmuebles-renta').catch(() => ({ items: [] })),
      ]);
      _items = dataInq.items || [];
      _inmueblesCache = dataInm.items || [];
      _renderTablaInquilinos();
    } catch (e) {
      console.error('[INQUILINOS]', e);
      notif('Error cargando inquilinos', e.message);
      if (cont) cont.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--txt-2)">Error: ${e.message}</td></tr>`;
    }
  };

  function _inmuebleName(id) {
    const i = _inmueblesCache.find(x => String(x.id) === String(id));
    return i ? (i.titulo || 'Inmueble #' + id) : '—';
  }

  const ESTADO_COLORS = {
    activo:    { bg: 'rgba(16,185,129,.14)', color: '#6ee7b7' },
    vigente:   { bg: 'rgba(16,185,129,.14)', color: '#6ee7b7' },
    deuda:     { bg: 'rgba(245,158,11,.14)', color: '#fcd34d' },
    atrasado:  { bg: 'rgba(245,158,11,.14)', color: '#fcd34d' },
    finalizado:{ bg: 'rgba(139,139,167,.14)', color: '#cbd5e1' },
    rescindido:{ bg: 'rgba(239,68,68,.14)', color: '#fca5a5' },
  };

  function _renderTablaInquilinos() {
    const cont = document.getElementById('inquilinosBody');
    if (!cont) return;
    if (_items.length === 0) {
      cont.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--txt-2)">Sin inquilinos registrados.</td></tr>`;
      return;
    }
    cont.innerHTML = _items.map(i => {
      const nombre = [i.nombre || '', i.apellido || ''].join(' ').trim() || '—';
      const inmueble = _inmuebleName(i.inmueble_renta_id);
      const est = i.estado || 'activo';
      const sc = ESTADO_COLORS[est] || ESTADO_COLORS.activo;
      const estadoBadge = `<span style="background:${sc.bg};color:${sc.color};padding:2px 8px;border-radius:5px;font-size:10.5px;font-weight:600">${est}</span>`;
      return `<tr>
        <td style="font-weight:600">${nombre}</td>
        <td style="color:var(--txt-2)">${inmueble}</td>
        <td>${estadoBadge}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="cd-icon-btn" title="Editar" data-id="${i.id}" onclick="abrirModalInquilino(this.dataset.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="cd-icon-btn danger" title="Eliminar" data-id="${i.id}" data-nombre="${nombre.replace(/"/g, '&quot;')}" onclick="_eliminarInquilino(this.dataset.id, this.dataset.nombre)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Modal nuevo inquilino (2 pasos) ────────────────────────────────────────

  window.abrirModalInquilino = function (id) {
    const item = id ? _items.find(x => String(x.id) === String(id)) : null;
    const modal = document.getElementById('modalInquilino');
    if (!modal) return;

    if (item) {
      _abrirModoEdicion(item);
    } else {
      _abrirModoCreacion();
    }
    modal.classList.add('show');
  };

  function _abrirModoCreacion() {
    _personaSeleccionada = null;
    const paso1 = document.getElementById('inqPaso1');
    const paso2 = document.getElementById('inqPaso2');
    if (paso1 && paso2) {
      paso1.style.display = '';
      paso2.style.display = 'none';
      document.getElementById('inqBusqueda').value = '';
      document.getElementById('inqAutocompleteLista').innerHTML = '';
      document.getElementById('inqAutocompleteLista').style.display = 'none';
      _limpiarPersonaSeleccionada();
      // Limpiar campos paso2
      ['inqFechaInicio','inqFechaFin','inqMonto','inqDeposito',
       'inqGaranteNombre','inqGaranteTel','inqGaranteDni'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const selInm = document.getElementById('inqInmueble');
      if (selInm) {
        selInm.innerHTML = '<option value="">— Cargando... —</option>';
        crmFetch('/crm/inmuebles-renta').then(data => {
          const disponibles = (data.items || []).filter(i => i.disponible !== false);
          selInm.innerHTML = '<option value="">— Seleccionar inmueble —</option>' +
            disponibles.map(i => `<option value="${i.id}">${i.titulo || 'Inmueble #' + i.id}${i.zona ? ' — ' + i.zona : ''}</option>`).join('');
        }).catch(() => {
          selInm.innerHTML = '<option value="">— Sin inmuebles disponibles —</option>';
        });
      }
    } else {
      _abrirModoEdicion({});
    }
    const idEl = document.getElementById('inquilinoId');
    if (idEl) idEl.value = '';
  }

  function _abrirModoEdicion(m) {
    const paso1 = document.getElementById('inqPaso1');
    const paso2 = document.getElementById('inqPaso2');
    if (paso1 && paso2) {
      paso1.style.display = 'none';
      paso2.style.display = '';
    }
    document.getElementById('inquilinoId').value = m.id || '';
    _setVal('inquilinoNombre', m.nombre);
    _setVal('inquilinoApellido', m.apellido);
    _setVal('inquilinoTel', m.telefono);
    _setVal('inquilinoEmail', m.email);
    _setVal('inquilinoDoc', m.documento);
    _setVal('inquilinoEstado', m.estado || 'activo');
    _setVal('inquilinoFechaInicio', (m.fecha_inicio || '').slice(0, 10));
    _setVal('inquilinoFechaFin', (m.fecha_fin || '').slice(0, 10));
    _setVal('inquilinoMonto', m.monto_alquiler_actual);
    _setVal('inquilinoGaranteNombre', m.garante_nombre);
    _setVal('inquilinoGaranteTel', m.garante_telefono);
    _setVal('inquilinoNotas', m.notas);
    const selInm = document.getElementById('inquilinoInmueble') || document.getElementById('inqInmueble');
    if (selInm) {
      selInm.innerHTML = '<option value="">— Sin inmueble —</option>' +
        _inmueblesCache.map(inm => `<option value="${inm.id}"${String(m.inmueble_renta_id) === String(inm.id) ? ' selected' : ''}>${inm.titulo || 'Inmueble #' + inm.id}</option>`).join('');
    }
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val != null ? val : '';
  }

  // ── Autocomplete busqueda de persona ──────────────────────────────────────

  window.inqBuscarPersona = function (input) {
    const q = input.value.trim();
    const lista = document.getElementById('inqAutocompleteLista');
    if (!lista) return;
    clearTimeout(_autocompleteTid);
    if (q.length < 2) {
      lista.innerHTML = '';
      lista.style.display = 'none';
      return;
    }
    lista.innerHTML = '<div style="padding:8px;color:var(--txt-2);font-size:12px">Buscando...</div>';
    lista.style.display = '';
    _autocompleteTid = setTimeout(async () => {
      try {
        const data = await crmFetch('/crm/personas/buscar?q=' + encodeURIComponent(q));
        const items = data.items || [];
        if (items.length === 0) {
          lista.innerHTML = '<div style="padding:8px;color:var(--txt-2);font-size:12px">Sin resultados — podes crear como nuevo cliente.</div>';
        } else {
          lista.innerHTML = items.map(p => {
            const nombre = [p.nombre || '', p.apellido || ''].join(' ').trim();
            const roles = (p.roles || []).join(', ');
            return `<div class="inq-ac-item" onclick="inqSeleccionarPersona(${JSON.stringify(JSON.stringify(p))})"
              style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--brd);font-size:13px">
              <strong>${nombre}</strong>
              <span style="color:var(--txt-2);margin-left:6px;font-size:11px">${p.telefono || ''}</span>
              <span style="float:right;font-size:10px;color:#f59e0b">${roles}</span>
            </div>`;
          }).join('');
        }
      } catch (err) {
        lista.innerHTML = '<div style="padding:8px;color:#f87171;font-size:12px">Error: ' + err.message + '</div>';
      }
    }, 300);
  };

  window.inqSeleccionarPersona = function (personaJson) {
    const p = JSON.parse(personaJson);
    _personaSeleccionada = p;
    const lista = document.getElementById('inqAutocompleteLista');
    if (lista) lista.style.display = 'none';
    const busqueda = document.getElementById('inqBusqueda');
    if (busqueda) busqueda.value = [p.nombre || '', p.apellido || ''].join(' ').trim();
    const badge = document.getElementById('inqPersonaBadge');
    if (badge) {
      badge.innerHTML = `<span style="background:rgba(245,158,11,.15);color:#fbbf24;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600">
        Persona existente: ${[p.nombre, p.apellido].join(' ').trim()} · ${p.telefono || ''}
        <button onclick="inqLimpiarPersona()" style="background:none;border:none;color:#f87171;cursor:pointer;margin-left:6px;font-size:13px">x</button>
      </span>`;
      badge.style.display = '';
    }
    _avanzarPaso2();
  };

  window.inqLimpiarPersona = function () {
    _personaSeleccionada = null;
    _limpiarPersonaSeleccionada();
    const paso1 = document.getElementById('inqPaso1');
    const paso2 = document.getElementById('inqPaso2');
    if (paso1) paso1.style.display = '';
    if (paso2) paso2.style.display = 'none';
    const busqueda = document.getElementById('inqBusqueda');
    if (busqueda) { busqueda.value = ''; busqueda.focus(); }
  };

  function _limpiarPersonaSeleccionada() {
    const badge = document.getElementById('inqPersonaBadge');
    if (badge) { badge.innerHTML = ''; badge.style.display = 'none'; }
  }

  window.inqCrearNuevo = function () {
    _personaSeleccionada = null;
    _limpiarPersonaSeleccionada();
    const badge = document.getElementById('inqPersonaBadge');
    if (badge) {
      badge.innerHTML = `<span style="background:rgba(245,158,11,.15);color:#fbbf24;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600">
        Crear cliente nuevo
        <button onclick="inqLimpiarPersona()" style="background:none;border:none;color:#f87171;cursor:pointer;margin-left:6px;font-size:13px">x</button>
      </span>`;
      badge.style.display = '';
    }
    const camposNuevo = document.getElementById('inqCamposNuevo');
    if (camposNuevo) camposNuevo.style.display = '';
    _avanzarPaso2();
  };

  function _avanzarPaso2() {
    const paso1 = document.getElementById('inqPaso1');
    const paso2 = document.getElementById('inqPaso2');
    if (paso1) paso1.style.display = 'none';
    if (paso2) paso2.style.display = '';
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  window.guardarInquilino = async function () {
    const id = document.getElementById('inquilinoId') ? document.getElementById('inquilinoId').value : '';
    const btn = document.getElementById('btnGuardarInquilino');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      const paso1El = document.getElementById('inqPaso1');
      const usaFlujoNuevo = !!paso1El;

      if (usaFlujoNuevo && !id) {
        // Flujo nuevo — contrato alquiler
        const inmuebleId = document.getElementById('inqInmueble').value || null; // string Airtable
        if (!inmuebleId) throw new Error('Selecciona un inmueble');

        let clienteActivoId = _personaSeleccionada ? _personaSeleccionada.id : null;

        if (!clienteActivoId) {
          const nombreNuevo = document.getElementById('inqNombreNuevo') ? document.getElementById('inqNombreNuevo').value.trim() : '';
          const telNuevo = document.getElementById('inqTelNuevo') ? document.getElementById('inqTelNuevo').value.trim() : '';
          if (!nombreNuevo) throw new Error('Ingresa el nombre del inquilino');
          const nuevoCliente = await crmCreate('clientes_activos', {
            nombre: nombreNuevo.split(' ')[0],
            apellido: nombreNuevo.split(' ').slice(1).join(' '),
            telefono: telNuevo || null,
            email: document.getElementById('inqEmailNuevo') ? document.getElementById('inqEmailNuevo').value || null : null,
            origen_creacion: 'crm_manual',
          });
          clienteActivoId = nuevoCliente.id;
          if (!clienteActivoId) throw new Error('Error creando cliente');
        }

        const body = {
          cliente_activo_id: clienteActivoId, // string Airtable
          item_tipo: 'inmueble_renta',
          item_id: inmuebleId, // string Airtable
          monto_total: parseFloat(document.getElementById('inqMonto').value) || null,
          fecha_firma: new Date().toISOString().slice(0, 10),
          moneda: 'ARS',
          alquiler: {
            fecha_inicio: document.getElementById('inqFechaInicio').value || null,
            fecha_fin: document.getElementById('inqFechaFin').value || null,
            monto_mensual: parseFloat(document.getElementById('inqMonto').value) || null,
            deposito_pagado: parseFloat(document.getElementById('inqDeposito').value) || null,
            garante_nombre: document.getElementById('inqGaranteNombre').value || null,
            garante_telefono: document.getElementById('inqGaranteTel').value || null,
            garante_dni: document.getElementById('inqGaranteDni').value || null,
          },
        };

        await crmFetch('/crm/contratos/alquiler', { method: 'POST', body: JSON.stringify(body) });
        notif('Alquiler creado', 'Contrato + alquiler registrado correctamente');

      } else {
        // Flujo legacy — edicion directa en tabla inquilinos
        const campos = {
          nombre: _getVal('inquilinoNombre'),
          apellido: _getVal('inquilinoApellido'),
          telefono: _getVal('inquilinoTel') || null,
          email: _getVal('inquilinoEmail') || null,
          documento: _getVal('inquilinoDoc') || null,
          inmueble_renta_id: _getVal('inquilinoInmueble') || _getVal('inqInmueble') || null, // string Airtable
          estado: _getVal('inquilinoEstado') || 'activo',
          fecha_inicio: _getVal('inquilinoFechaInicio') || null,
          fecha_fin: _getVal('inquilinoFechaFin') || null,
          monto_alquiler_actual: parseFloat(_getVal('inquilinoMonto')) || null,
          garante_nombre: _getVal('inquilinoGaranteNombre') || null,
          garante_telefono: _getVal('inquilinoGaranteTel') || null,
          notas: _getVal('inquilinoNotas') || null,
        };
        if (id) await crmUpdate('inquilinos', id, campos);
        else await crmCreate('inquilinos', campos);
        notif('Inquilino guardado', [campos.nombre, campos.apellido].join(' ').trim());
      }

      document.getElementById('modalInquilino').classList.remove('show');
      document.getElementById('modalInquilino').style.display = 'none';
      _personaSeleccionada = null;
      cargarInquilinos();
    } catch (e) {
      notif('Error al guardar', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
  };

  function _getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  window._eliminarInquilino = async function (id, nombre) {
    if (!confirm('Eliminar "' + nombre + '"?')) return;
    try {
      await crmDelete('inquilinos', id);
      notif('Inquilino eliminado', nombre);
      cargarInquilinos();
    } catch (e) {
      notif('Error', e.message);
    }
  };

  function _skeletonRow(n) {
    return Array(n).fill(0).map(() =>
      `<tr>${Array(4).fill('<td><div style="background:rgba(255,255,255,.05);height:14px;border-radius:4px;margin:4px 0"></div></td>').join('')}</tr>`
    ).join('');
  }

})();
