// Panel Propietarios — autocomplete persona unica + rol propietario
// Mica / System IA — paleta ambar #f59e0b — IDs Airtable (strings rec...)
(function(){
  let PROPIETARIOS = [];
  let _personaSeleccionada = null;
  let _autocompleteTid = null;

  window.cargarPropietarios = async function() {
    try {
      const data = await crmList('propietarios');
      PROPIETARIOS = data.items || [];
      renderPropietarios();
    } catch (e) {
      console.error('[PROPIETARIOS]', e);
      notif('Error cargando propietarios', e.message);
    }
  };

  function renderPropietarios() {
    const cont = document.getElementById('propietariosLista');
    if (!cont) return;
    if (PROPIETARIOS.length === 0) {
      cont.innerHTML = `<div class="p-8 text-center text-txt-2">
        <div class="text-4xl mb-2">📑</div>
        <p class="text-sm">Aun no hay propietarios cargados.</p>
        <button onclick="abrirModalPropietario()" class="mt-3 btn-primary">+ Agregar primer propietario</button>
      </div>`;
      return;
    }
    cont.innerHTML = `
      <div class="overflow-auto">
        <table class="w-full text-sm">
          <thead class="bg-surface-alt text-txt-2 text-xs uppercase">
            <tr>
              <th class="text-left p-2">Nombre</th>
              <th class="text-left p-2">Telefono</th>
              <th class="text-left p-2">Email</th>
              <th class="text-left p-2">DNI/CUIT</th>
              <th class="text-left p-2">Comision</th>
              <th class="text-left p-2">Props</th>
              <th class="text-right p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${PROPIETARIOS.map(p => `
              <tr class="border-b border-brd hover:bg-surface-alt">
                <td class="p-2 font-medium">${p.nombre || ''}</td>
                <td class="p-2 text-xs">${p.telefono || ''}</td>
                <td class="p-2 text-xs">${p.email || ''}</td>
                <td class="p-2 text-xs">${p.dni_cuit || ''}</td>
                <td class="p-2 text-xs">${p.comision_pactada ? p.comision_pactada + '%' : '—'}</td>
                <td class="p-2 text-xs">${p.cantidad_propiedades || 0}</td>
                <td class="p-2 text-right">
                  <button onclick='abrirModalPropietario(${JSON.stringify(p).replace(/'/g, "&apos;")})' class="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Editar</button>
                  <button onclick="eliminarPropietario('${p.id}')" class="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  window.abrirModalPropietario = function(data) {
    const p = data || {};
    const modal = document.getElementById('modalPropietario');
    if (!modal) return;

    _personaSeleccionada = null;
    document.getElementById('propietarioId').value = p.id || '';
    document.getElementById('propietarioNombre').value = p.nombre || '';
    document.getElementById('propietarioTelefono').value = p.telefono || '';
    document.getElementById('propietarioEmail').value = p.email || '';
    document.getElementById('propietarioDni').value = p.dni_cuit || '';
    document.getElementById('propietarioDireccion').value = p.direccion || '';
    document.getElementById('propietarioComision').value = p.comision_pactada || '';
    document.getElementById('propietarioNotas').value = p.notas || '';

    // Si es nuevo, mostrar bloque autocomplete; si edicion, ocultarlo
    const acBloque = document.getElementById('propBusquedaBloque');
    if (acBloque) acBloque.style.display = p.id ? 'none' : '';
    const acLista = document.getElementById('propAutocompleteLista');
    if (acLista) { acLista.innerHTML = ''; acLista.style.display = 'none'; }
    const acInput = document.getElementById('propBusqueda');
    if (acInput) acInput.value = '';
    _limpiarPropBadge();

    abrirModal('modalPropietario');
  };

  // ── Autocomplete busqueda ──────────────────────────────────────────────────

  window.propBuscarPersona = function(input) {
    const q = input.value.trim();
    const lista = document.getElementById('propAutocompleteLista');
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
          lista.innerHTML = '<div style="padding:8px;color:var(--txt-2);font-size:12px">Sin resultados — completa los campos manualmente.</div>';
        } else {
          lista.innerHTML = items.map(p => {
            const nombre = [p.nombre || '', p.apellido || ''].join(' ').trim();
            const roles = (p.roles || []).join(', ');
            return `<div onclick="propSeleccionarPersona(${JSON.stringify(JSON.stringify(p))})"
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

  window.propSeleccionarPersona = function(personaJson) {
    const p = JSON.parse(personaJson);
    _personaSeleccionada = p;
    const lista = document.getElementById('propAutocompleteLista');
    if (lista) lista.style.display = 'none';
    const input = document.getElementById('propBusqueda');
    if (input) input.value = [p.nombre || '', p.apellido || ''].join(' ').trim();
    // Auto-rellenar campos del form
    document.getElementById('propietarioNombre').value = [p.nombre || '', p.apellido || ''].join(' ').trim();
    document.getElementById('propietarioTelefono').value = p.telefono || '';
    document.getElementById('propietarioEmail').value = p.email || '';
    document.getElementById('propietarioDni').value = p.documento || '';
    // Mostrar badge
    const badge = document.getElementById('propPersonaBadge');
    if (badge) {
      badge.innerHTML = `<span style="background:rgba(245,158,11,.15);color:#fbbf24;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600">
        Persona existente: ${[p.nombre, p.apellido].join(' ').trim()} · ${p.telefono || ''}
        — se agregara rol "propietario"
        <button onclick="propLimpiarPersona()" style="background:none;border:none;color:#f87171;cursor:pointer;margin-left:6px;font-size:13px">x</button>
      </span>`;
      badge.style.display = '';
    }
  };

  window.propLimpiarPersona = function() {
    _personaSeleccionada = null;
    _limpiarPropBadge();
    const input = document.getElementById('propBusqueda');
    if (input) { input.value = ''; input.focus(); }
    ['propietarioNombre','propietarioTelefono','propietarioEmail','propietarioDni'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  };

  function _limpiarPropBadge() {
    const badge = document.getElementById('propPersonaBadge');
    if (badge) { badge.innerHTML = ''; badge.style.display = 'none'; }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  window.guardarPropietario = async function() {
    const id = document.getElementById('propietarioId').value;
    const campos = {
      nombre: document.getElementById('propietarioNombre').value,
      telefono: document.getElementById('propietarioTelefono').value,
      email: document.getElementById('propietarioEmail').value,
      dni_cuit: document.getElementById('propietarioDni').value,
      direccion: document.getElementById('propietarioDireccion').value,
      comision_pactada: parseFloat(document.getElementById('propietarioComision').value) || null,
      notas: document.getElementById('propietarioNotas').value,
    };

    try {
      if (id) {
        // Edicion directa
        await crmUpdate('propietarios', id, campos);
      } else if (_personaSeleccionada) {
        // Persona existente — agregar rol propietario + crear registro propietario si no existe
        await crmFetch('/crm/personas/agregar-rol', {
          method: 'POST',
          body: JSON.stringify({ cliente_id: _personaSeleccionada.id, rol: 'propietario' }),
        });
        await crmCreate('propietarios', campos);
        notif('Propietario vinculado', 'Rol propietario agregado a ' + campos.nombre);
      } else {
        // Crear nuevo cliente + propietario
        await crmCreate('propietarios', campos);
        try {
          await crmCreate('clientes_activos', {
            nombre: campos.nombre.split(' ')[0],
            apellido: campos.nombre.split(' ').slice(1).join(' '),
            telefono: campos.telefono || null,
            email: campos.email || null,
            documento: campos.dni_cuit || null,
            origen_creacion: 'crm_manual',
            roles: ['propietario'],
          });
        } catch (_) { /* si ya existe, no romper */ }
        notif('Propietario creado', campos.nombre);
      }
      cerrarModal('modalPropietario');
      _personaSeleccionada = null;
      cargarPropietarios();
    } catch (e) {
      notif('Error', e.message);
    }
  };

  window.eliminarPropietario = async function(id) {
    if (!confirm('Eliminar este propietario? (sus propiedades quedaran sin vincular)')) return;
    try {
      await crmDelete('propietarios', id);
      notif('Propietario eliminado');
      cargarPropietarios();
    } catch (e) { notif('Error', e.message); }
  };
})();
