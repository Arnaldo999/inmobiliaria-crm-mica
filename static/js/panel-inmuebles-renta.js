// Panel Inmuebles en Renta — CRUD real conectado a /crm/inmuebles-renta
// Mica / System IA — paleta ambar #f59e0b — IDs Airtable (strings rec...)
(function () {
  let _items = [];
  let _propietariosCache = [];

  window.cargarInmueblesRenta = async function () {
    const cont = document.getElementById('inmueblesRentaBody');
    if (!cont) return;
    cont.innerHTML = _skeletonRow(5);
    try {
      const [dataInm, dataProps] = await Promise.all([
        crmFetch('/crm/inmuebles-renta'),
        crmFetch('/crm/propietarios').catch(() => ({ items: [] })),
      ]);
      _items = dataInm.items || [];
      _propietariosCache = dataProps.items || [];
      _renderTablaInmuebles();
    } catch (e) {
      console.error('[INMUEBLES-RENTA]', e);
      notif('Error cargando inmuebles', e.message);
      if (cont) cont.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--txt-2)">Error: ${e.message}</td></tr>`;
    }
  };

  function _renderTablaInmuebles() {
    const cont = document.getElementById('inmueblesRentaBody');
    if (!cont) return;
    if (_items.length === 0) {
      cont.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--txt-2)">
        Sin inmuebles registrados. Agrega el primero con el boton + Nuevo.
      </td></tr>`;
      return;
    }
    cont.innerHTML = _items.map(i => {
      const disponible = i.disponible ? '<span style="color:#10b981">Disponible</span>' : '<span style="color:#8b8ba7">Ocupado</span>';
      const precio = i.precio_alquiler ? `${i.moneda || 'USD'} ${Number(i.precio_alquiler).toLocaleString()}` : '—';
      return `<tr>
        <td style="font-weight:600">${i.titulo || '—'}</td>
        <td style="color:var(--txt-2)">${i.tipo || '—'}</td>
        <td style="color:var(--txt-2)">${i.zona || '—'}</td>
        <td>${precio}</td>
        <td>${disponible}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="cd-icon-btn" title="Editar" data-id="${i.id}" onclick="abrirModalInmueble(this.dataset.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="cd-icon-btn danger" title="Eliminar" data-id="${i.id}" data-titulo="${(i.titulo || '').replace(/"/g, '&quot;')}" onclick="_eliminarInmueble(this.dataset.id, this.dataset.titulo)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.abrirModalInmueble = function (id) {
    const item = id ? _items.find(x => String(x.id) === String(id)) : null;
    const m = item || {};
    const modal = document.getElementById('modalInmueble');
    if (!modal) return;
    document.getElementById('inmuebleId').value = m.id || '';
    document.getElementById('inmuebleTitulo').value = m.titulo || '';
    document.getElementById('inmuebleTipo').value = m.tipo || 'depto';
    document.getElementById('inmuebleZona').value = m.zona || '';
    document.getElementById('inmuebleDireccion').value = m.direccion || '';
    document.getElementById('inmueblePrecio').value = m.precio_alquiler || '';
    document.getElementById('inmuebleExpensas').value = m.expensas || '';
    document.getElementById('inmuebleMoneda').value = m.moneda || 'USD';
    document.getElementById('inmuebleDisponible').checked = m.disponible !== false;
    document.getElementById('inmuebleFechaDisp').value = (m.fecha_disponibilidad || '').slice(0, 10);
    document.getElementById('inmuebleNotas').value = m.notas || '';
    // Cargar propietarios en el select — usar cache ya cargado
    const selProp = document.getElementById('inmueblePropietario');
    if (selProp) {
      selProp.innerHTML = '<option value="">— Sin propietario —</option>' +
        _propietariosCache.map(p => {
          const label = [p.nombre || '', p.apellido || ''].join(' ').trim() + (p.telefono ? ' — ' + p.telefono : '');
          // Comparar como string (IDs Airtable)
          return `<option value="${p.id}"${String(m.propietario_id) === String(p.id) ? ' selected' : ''}>${label || 'Propietario #' + p.id}</option>`;
        }).join('');
    }
    modal.classList.add('show');
  };

  window.guardarInmueble = async function () {
    const id = document.getElementById('inmuebleId').value;
    const btn = document.getElementById('btnGuardarInmueble');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    const campos = {
      titulo: document.getElementById('inmuebleTitulo').value,
      tipo: document.getElementById('inmuebleTipo').value,
      zona: document.getElementById('inmuebleZona').value,
      direccion: document.getElementById('inmuebleDireccion').value,
      propietario_id: document.getElementById('inmueblePropietario').value || null, // string Airtable
      precio_alquiler: parseFloat(document.getElementById('inmueblePrecio').value) || null,
      expensas: parseFloat(document.getElementById('inmuebleExpensas').value) || null,
      moneda: document.getElementById('inmuebleMoneda').value,
      disponible: document.getElementById('inmuebleDisponible').checked,
      fecha_disponibilidad: document.getElementById('inmuebleFechaDisp').value || null,
      notas: document.getElementById('inmuebleNotas').value || null,
    };
    try {
      if (id) await crmUpdate('inmuebles-renta', id, campos);
      else await crmCreate('inmuebles-renta', campos);
      document.getElementById('modalInmueble').classList.remove('show');
      notif('Inmueble guardado', campos.titulo);
      cargarInmueblesRenta();
    } catch (e) {
      notif('Error al guardar', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
    }
  };

  window._eliminarInmueble = async function (id, titulo) {
    if (!confirm('Eliminar "' + titulo + '"?')) return;
    try {
      await crmDelete('inmuebles-renta', id);
      notif('Inmueble eliminado', titulo);
      cargarInmueblesRenta();
    } catch (e) {
      notif('Error', e.message);
    }
  };

  function _skeletonRow(n) {
    return Array(n).fill(0).map(() =>
      `<tr>${Array(6).fill('<td><div style="background:rgba(255,255,255,.05);height:14px;border-radius:4px;margin:4px 0"></div></td>').join('')}</tr>`
    ).join('');
  }

})();
