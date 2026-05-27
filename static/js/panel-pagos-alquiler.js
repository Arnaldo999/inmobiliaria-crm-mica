// Panel Pagos de Alquiler — CRUD real conectado a /crm/pagos-alquiler
// Mica / System IA — paleta ambar #f59e0b — IDs Airtable (strings rec...)
(function () {
  let _items = [];
  let _inquilinosCache = [];

  window.cargarPagosAlquiler = async function () {
    const cont = document.getElementById('pagosAlquilerBody');
    if (!cont) return;
    cont.innerHTML = _skeletonRow(4);
    try {
      const [dataPagos, dataInq] = await Promise.all([
        crmFetch('/crm/pagos-alquiler'),
        crmFetch('/crm/inquilinos').catch(() => ({ items: [] })),
      ]);
      _items = dataPagos.items || [];
      _inquilinosCache = dataInq.items || [];
      _renderTablaPagos();
    } catch (e) {
      console.error('[PAGOS-ALQUILER]', e);
      notif('Error cargando pagos', e.message);
      if (cont) cont.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--txt-2)">Error: ${e.message}</td></tr>`;
    }
  };

  function _inquilinoName(id) {
    const i = _inquilinosCache.find(x => String(x.id) === String(id));
    if (!i) return '—';
    return [i.nombre || '', i.apellido || ''].join(' ').trim() || 'Inquilino #' + id;
  }

  const ESTADO_COLORS = {
    pagado:   { bg: 'rgba(16,185,129,.14)', color: '#6ee7b7' },
    pendiente:{ bg: 'rgba(245,158,11,.14)', color: '#fcd34d' },
    atrasado: { bg: 'rgba(239,68,68,.12)', color: '#fca5a5' },
  };

  function _renderTablaPagos() {
    const cont = document.getElementById('pagosAlquilerBody');
    if (!cont) return;
    if (_items.length === 0) {
      cont.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--txt-2)">Sin pagos registrados.</td></tr>`;
      return;
    }
    cont.innerHTML = _items.map(i => {
      const inq = _inquilinoName(i.inquilino_id);
      const est = i.estado || 'pendiente';
      const sc = ESTADO_COLORS[est] || ESTADO_COLORS.pendiente;
      const estadoBadge = `<span style="background:${sc.bg};color:${sc.color};padding:2px 8px;border-radius:5px;font-size:10.5px;font-weight:600">${est}</span>`;
      const monto = i.monto ? `${i.moneda || 'ARS'} ${Number(i.monto).toLocaleString()}` : '—';
      return `<tr>
        <td style="font-weight:600">${inq}</td>
        <td style="color:var(--txt-2)">${i.mes_anio || '—'}</td>
        <td>${monto}</td>
        <td>${estadoBadge}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="cd-icon-btn" title="Editar" data-id="${i.id}" onclick="abrirModalPago(this.dataset.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="cd-icon-btn danger" title="Eliminar" data-id="${i.id}" onclick="_eliminarPago(this.dataset.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.abrirModalPago = function (id) {
    const item = id ? _items.find(x => String(x.id) === String(id)) : null;
    const m = item || {};
    const modal = document.getElementById('modalPago');
    if (!modal) return;
    document.getElementById('pagoId').value = m.id || '';
    document.getElementById('pagoMesAnio').value = m.mes_anio || '';
    document.getElementById('pagoMonto').value = m.monto || '';
    document.getElementById('pagoFechaPago').value = (m.fecha_pago || '').slice(0, 10);
    document.getElementById('pagoMetodo').value = m.metodo || 'transferencia';
    document.getElementById('pagoEstado').value = m.estado || 'pendiente';
    // Dropdown inquilinos — IDs como string Airtable
    const selInq = document.getElementById('pagoInquilino');
    selInq.innerHTML = '<option value="">— Seleccionar inquilino —</option>' +
      _inquilinosCache.map(inq => {
        const n = [inq.nombre || '', inq.apellido || ''].join(' ').trim() || 'Inquilino #' + inq.id;
        return `<option value="${inq.id}"${String(m.inquilino_id) === String(inq.id) ? ' selected' : ''}>${n}</option>`;
      }).join('');
    modal.classList.add('show');
  };

  window.guardarPago = async function () {
    const id = document.getElementById('pagoId').value;
    const btn = document.getElementById('btnGuardarPago');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    const campos = {
      inquilino_id: document.getElementById('pagoInquilino').value || null, // string Airtable
      mes_anio: document.getElementById('pagoMesAnio').value,
      monto: parseFloat(document.getElementById('pagoMonto').value) || null,
      fecha_pago: document.getElementById('pagoFechaPago').value || null,
      metodo: document.getElementById('pagoMetodo').value || null,
      estado: document.getElementById('pagoEstado').value,
    };
    try {
      if (id) await crmUpdate('pagos-alquiler', id, campos);
      else await crmCreate('pagos-alquiler', campos);
      document.getElementById('modalPago').classList.remove('show');
      notif('Pago guardado', campos.mes_anio);
      cargarPagosAlquiler();
    } catch (e) {
      notif('Error al guardar', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
  };

  window._eliminarPago = async function (id) {
    if (!confirm('Eliminar este pago?')) return;
    try {
      await crmDelete('pagos-alquiler', id);
      notif('Pago eliminado');
      cargarPagosAlquiler();
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
