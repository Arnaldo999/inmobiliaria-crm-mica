// Panel Asesores — gestión del equipo (agencias + desarrolladoras)
(function(){
  let ASESORES = [];

  window.cargarAsesores = async function() {
    try {
      const data = await crmList('asesores');
      ASESORES = data.items || [];
      renderAsesores();
    } catch (e) {
      console.error('[ASESORES]', e);
      notif('❌ Error cargando asesores', e.message);
    }
  };

  function renderAsesores() {
    const cont = document.getElementById('asesoresLista');
    if (!cont) return;
    if (ASESORES.length === 0) {
      cont.innerHTML = `<div class="p-8 text-center text-txt-2">
        <div class="text-4xl mb-2">👨‍💼</div>
        <p class="text-sm">Aún no hay asesores cargados.</p>
        <button onclick="abrirModalAsesor()" class="mt-3 btn-primary">+ Agregar primer asesor</button>
      </div>`;
      return;
    }
    cont.innerHTML = ASESORES.map(a => `
      <div class="bg-surface border border-brd rounded-lg p-4 flex gap-4 items-center">
        <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
          ${(a.nombre || '?').charAt(0).toUpperCase()}
        </div>
        <div class="flex-1">
          <div class="font-semibold">${a.nombre || ''} ${a.apellido || ''}</div>
          <div class="text-xs text-txt-2">${a.email || ''} · ${a.telefono || ''}</div>
          <div class="text-xs text-txt-2">Rol: ${a.rol || 'asesor'} ${a.comision_pct ? `· Comisión: ${a.comision_pct}%` : ''}</div>
        </div>
        <div class="flex gap-2">
          <span class="text-xs px-2 py-1 rounded ${a.activo ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}">${a.activo ? '✅ Activo' : '⏸ Inactivo'}</span>
          <button onclick='abrirModalAsesor(${JSON.stringify(a).replace(/'/g, "&apos;")})' class="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30">Editar</button>
          <button onclick="eliminarAsesor(${a.id})" class="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">🗑</button>
        </div>
      </div>
    `).join('');
  }

  window.abrirModalAsesor = function(data = null) {
    const a = data || {};
    const modal = document.getElementById('modalAsesor');
    if (!modal) return;
    document.getElementById('asesorId').value = a.id || '';
    document.getElementById('asesorNombre').value = a.nombre || '';
    document.getElementById('asesorApellido').value = a.apellido || '';
    document.getElementById('asesorEmail').value = a.email || '';
    document.getElementById('asesorTelefono').value = a.telefono || '';
    document.getElementById('asesorRol').value = a.rol || 'asesor';
    document.getElementById('asesorComision').value = a.comision_pct || '';
    document.getElementById('asesorNotas').value = a.notas || '';
    document.getElementById('asesorActivo').checked = a.activo !== false;
    abrirModal('modalAsesor');
  };

  window.guardarAsesor = async function() {
    const id = document.getElementById('asesorId').value;
    const campos = {
      nombre: document.getElementById('asesorNombre').value,
      apellido: document.getElementById('asesorApellido').value,
      email: document.getElementById('asesorEmail').value,
      telefono: document.getElementById('asesorTelefono').value,
      rol: document.getElementById('asesorRol').value,
      comision_pct: parseFloat(document.getElementById('asesorComision').value) || null,
      notas: document.getElementById('asesorNotas').value,
      activo: document.getElementById('asesorActivo').checked,
    };
    try {
      if (id) await crmUpdate('asesores', id, campos);
      else await crmCreate('asesores', campos);
      cerrarModal('modalAsesor');
      notif('✅ Asesor guardado', `${campos.nombre} ${campos.apellido}`);
      cargarAsesores();
    } catch (e) {
      notif('❌ Error', e.message);
    }
  };

  window.eliminarAsesor = async function(id) {
    if (!confirm('¿Eliminar este asesor?')) return;
    try {
      await crmDelete('asesores', id);
      notif('✅ Asesor eliminado');
      cargarAsesores();
    } catch (e) { notif('❌ Error', e.message); }
  };
})();
