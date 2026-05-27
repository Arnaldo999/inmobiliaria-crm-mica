// Panel Visitas / Agenda — complementa Cal.com, vista calendario
(function(){
  let VISITAS = [];

  window.cargarVisitas = async function() {
    try {
      const data = await crmList('visitas');
      VISITAS = (data.items || []).sort((a,b) => (a.fecha_visita || '').localeCompare(b.fecha_visita || ''));
      renderVisitas();
    } catch (e) {
      console.error('[VISITAS]', e);
      notif('❌ Error cargando visitas', e.message);
    }
  };

  function estadoBadge(estado) {
    const colores = {
      agendada: 'bg-blue-500/20 text-blue-400',
      realizada: 'bg-green-500/20 text-green-400',
      cancelada: 'bg-red-500/20 text-red-400',
      no_show: 'bg-gray-500/20 text-gray-400'
    };
    return `<span class="text-xs px-2 py-1 rounded ${colores[estado] || 'bg-surface-alt'}">${estado || 'agendada'}</span>`;
  }

  function renderVisitas() {
    const cont = document.getElementById('visitasLista');
    if (!cont) return;
    if (VISITAS.length === 0) {
      cont.innerHTML = `<div class="p-8 text-center text-txt-2">
        <div class="text-4xl mb-2">📅</div>
        <p class="text-sm">Aún no hay visitas agendadas.</p>
        <p class="text-xs mt-2">Las citas que el bot agenda vía Cal.com se sincronizan aquí automáticamente.</p>
        <button onclick="abrirModalVisita()" class="mt-3 btn-primary">+ Agendar visita manual</button>
      </div>`;
      return;
    }
    const hoy = new Date().toISOString().substring(0,10);
    const futuras = VISITAS.filter(v => (v.fecha_visita || '').substring(0,10) >= hoy);
    const pasadas = VISITAS.filter(v => (v.fecha_visita || '').substring(0,10) < hoy);

    cont.innerHTML = `
      <div class="mb-4">
        <h3 class="text-sm font-semibold text-txt-2 mb-2">📆 Próximas (${futuras.length})</h3>
        ${futuras.length === 0 ? '<p class="text-xs text-txt-2 italic">No hay visitas próximas</p>' : ''}
        ${futuras.map(v => renderVisitaCard(v)).join('')}
      </div>
      <div>
        <h3 class="text-sm font-semibold text-txt-2 mb-2">📋 Historial (${pasadas.length})</h3>
        ${pasadas.map(v => renderVisitaCard(v)).join('')}
      </div>
    `;
  }

  function renderVisitaCard(v) {
    const fecha = v.fecha_visita ? new Date(v.fecha_visita) : null;
    const fechaStr = fecha ? fecha.toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    return `
      <div class="bg-surface border border-brd rounded-lg p-3 mb-2 flex gap-3 items-center">
        <div class="text-center w-16">
          <div class="text-xs text-txt-2">${fecha ? fecha.toLocaleDateString('es-AR', { month: 'short' }) : ''}</div>
          <div class="text-2xl font-bold">${fecha ? fecha.getDate() : '?'}</div>
          <div class="text-xs text-txt-2">${fecha ? fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium">${fechaStr}</div>
          <div class="text-xs text-txt-2">Lead #${v.lead_id || '?'} · Propiedad #${v.propiedad_id || '?'} · ${v.duracion_minutos || 60} min</div>
          ${v.notas_pre ? `<div class="text-xs mt-1 italic">${v.notas_pre}</div>` : ''}
          ${v.calcom_booking_id ? `<div class="text-xs mt-1 text-primary">📅 Cal.com: ${v.calcom_booking_id}</div>` : ''}
        </div>
        <div class="flex flex-col gap-1 items-end">
          ${estadoBadge(v.estado)}
          <div class="flex gap-1">
            <button onclick='abrirModalVisita(${JSON.stringify(v).replace(/'/g, "&apos;")})' class="text-xs px-2 py-1 bg-primary/20 text-primary rounded">✏️</button>
            <button onclick="eliminarVisita(${v.id})" class="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">🗑</button>
          </div>
        </div>
      </div>
    `;
  }

  window.abrirModalVisita = function(data = null) {
    const v = data || {};
    const modal = document.getElementById('modalVisita');
    if (!modal) return;
    document.getElementById('visitaId').value = v.id || '';
    document.getElementById('visitaFecha').value = v.fecha_visita ? v.fecha_visita.substring(0,16) : '';
    document.getElementById('visitaDuracion').value = v.duracion_minutos || 60;
    document.getElementById('visitaLead').value = v.lead_id || '';
    document.getElementById('visitaPropiedad').value = v.propiedad_id || '';
    document.getElementById('visitaEstado').value = v.estado || 'agendada';
    document.getElementById('visitaNotasPre').value = v.notas_pre || '';
    document.getElementById('visitaNotasPost').value = v.notas_post || '';
    abrirModal('modalVisita');
  };

  window.guardarVisita = async function() {
    const id = document.getElementById('visitaId').value;
    const campos = {
      fecha_visita: document.getElementById('visitaFecha').value,
      duracion_minutos: parseInt(document.getElementById('visitaDuracion').value) || 60,
      lead_id: parseInt(document.getElementById('visitaLead').value) || null,
      propiedad_id: parseInt(document.getElementById('visitaPropiedad').value) || null,
      estado: document.getElementById('visitaEstado').value,
      notas_pre: document.getElementById('visitaNotasPre').value,
      notas_post: document.getElementById('visitaNotasPost').value,
    };
    try {
      if (id) await crmUpdate('visitas', id, campos);
      else await crmCreate('visitas', campos);
      cerrarModal('modalVisita');
      notif('✅ Visita guardada');
      cargarVisitas();
    } catch (e) { notif('❌ Error', e.message); }
  };

  window.eliminarVisita = async function(id) {
    if (!confirm('¿Eliminar esta visita?')) return;
    try {
      await crmDelete('visitas', id);
      notif('✅ Visita eliminada');
      cargarVisitas();
    } catch (e) { notif('❌ Error', e.message); }
  };
})();
