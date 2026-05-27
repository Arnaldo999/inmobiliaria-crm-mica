// Panel Liquidaciones — CRUD real conectado a /crm/liquidaciones
// Mica / System IA — paleta ambar #f59e0b — IDs Airtable (strings rec...)
(function () {
  let _items = [];
  let _propietariosCache = [];

  window.cargarLiquidaciones = async function () {
    const cont = document.getElementById('liquidacionesBody');
    if (!cont) return;
    cont.innerHTML = _skeletonRow(4);
    try {
      const [dataLiq, dataProps] = await Promise.all([
        crmFetch('/crm/liquidaciones'),
        crmFetch('/crm/propietarios').catch(() => ({ items: [] })),
      ]);
      _items = dataLiq.items || [];
      _propietariosCache = dataProps.items || [];
      _renderTablaLiquidaciones();
    } catch (e) {
      console.error('[LIQUIDACIONES]', e);
      notif('Error cargando liquidaciones', e.message);
      if (cont) cont.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--txt-2)">Error: ${e.message}</td></tr>`;
    }
  };

  function _propietarioName(id) {
    const p = _propietariosCache.find(x => String(x.id) === String(id));
    return p ? (p.nombre || 'Propietario #' + id) : '—';
  }

  const ESTADO_COLORS = {
    pagado:   { bg: 'rgba(16,185,129,.14)', color: '#6ee7b7' },
    pendiente:{ bg: 'rgba(245,158,11,.14)', color: '#fcd34d' },
    cancelado:{ bg: 'rgba(139,139,167,.14)', color: '#cbd5e1' },
  };

  function _renderTablaLiquidaciones() {
    const cont = document.getElementById('liquidacionesBody');
    if (!cont) return;
    if (_items.length === 0) {
      cont.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--txt-2)">Sin liquidaciones registradas.</td></tr>`;
      return;
    }
    cont.innerHTML = _items.map(i => {
      const propNombre = _propietarioName(i.propietario_id);
      const est = i.estado || 'pendiente';
      const sc = ESTADO_COLORS[est] || ESTADO_COLORS.pendiente;
      const estadoBadge = `<span style="background:${sc.bg};color:${sc.color};padding:2px 8px;border-radius:5px;font-size:10.5px;font-weight:600">${est}</span>`;
      const neto = i.neto_propietario ? Number(i.neto_propietario).toLocaleString() : '—';
      return `<tr>
        <td style="font-weight:600">${propNombre}</td>
        <td style="color:var(--txt-2)">${i.mes_anio || '—'}</td>
        <td>${neto}</td>
        <td>${estadoBadge}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="cd-icon-btn" title="Editar" data-id="${i.id}" onclick="abrirModalLiquidacion(this.dataset.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="cd-icon-btn danger" title="Eliminar" data-id="${i.id}" onclick="_eliminarLiquidacion(this.dataset.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.abrirModalLiquidacion = function (id) {
    const item = id ? _items.find(x => String(x.id) === String(id)) : null;
    const m = item || {};
    const modal = document.getElementById('modalLiquidacion');
    if (!modal) return;
    document.getElementById('liquidacionId').value = m.id || '';
    document.getElementById('liquidacionMesAnio').value = m.mes_anio || '';
    document.getElementById('liquidacionBruto').value = m.bruto || '';
    document.getElementById('liquidacionComision').value = m.comision_agencia || '';
    document.getElementById('liquidacionNeto').value = m.neto_propietario || '';
    document.getElementById('liquidacionFecha').value = (m.fecha_liquidacion || '').slice(0, 10);
    document.getElementById('liquidacionEstado').value = m.estado || 'pendiente';
    // Dropdown propietarios — IDs como string Airtable
    const selProp = document.getElementById('liquidacionPropietario');
    selProp.innerHTML = '<option value="">— Seleccionar propietario —</option>' +
      _propietariosCache.map(p => `<option value="${p.id}"${String(m.propietario_id) === String(p.id) ? ' selected' : ''}>${p.nombre || 'Propietario #' + p.id}</option>`).join('');
    modal.classList.add('show');
  };

  window._calcularNeto = function () {
    const bruto = parseFloat(document.getElementById('liquidacionBruto').value) || 0;
    const comision = parseFloat(document.getElementById('liquidacionComision').value) || 0;
    const neto = bruto - comision;
    document.getElementById('liquidacionNeto').value = neto > 0 ? neto.toFixed(2) : '';
  };

  window.guardarLiquidacion = async function () {
    const id = document.getElementById('liquidacionId').value;
    const btn = document.getElementById('btnGuardarLiquidacion');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    const campos = {
      propietario_id: document.getElementById('liquidacionPropietario').value || null, // string Airtable
      mes_anio: document.getElementById('liquidacionMesAnio').value,
      bruto: parseFloat(document.getElementById('liquidacionBruto').value) || null,
      comision_agencia: parseFloat(document.getElementById('liquidacionComision').value) || null,
      neto_propietario: parseFloat(document.getElementById('liquidacionNeto').value) || null,
      fecha_liquidacion: document.getElementById('liquidacionFecha').value || null,
      estado: document.getElementById('liquidacionEstado').value,
    };
    try {
      if (id) await crmUpdate('liquidaciones', id, campos);
      else await crmCreate('liquidaciones', campos);
      document.getElementById('modalLiquidacion').classList.remove('show');
      notif('Liquidacion guardada', campos.mes_anio);
      cargarLiquidaciones();
    } catch (e) {
      notif('Error al guardar', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
  };

  window._eliminarLiquidacion = async function (id) {
    if (!confirm('Eliminar esta liquidacion?')) return;
    try {
      await crmDelete('liquidaciones', id);
      notif('Liquidacion eliminada');
      cargarLiquidaciones();
    } catch (e) {
      notif('Error', e.message);
    }
  };

  function _skeletonRow(n) {
    return Array(n).fill(0).map(() =>
      `<tr>${Array(5).fill('<td><div style="background:rgba(255,255,255,.05);height:14px;border-radius:4px;margin:4px 0"></div></td>').join('')}</tr>`
    ).join('');
  }

})();
