// Panel Contratos — reservas, ventas, alquileres con PDFs
(function(){
  let CONTRATOS = [];

  window.cargarContratos = async function() {
    try {
      const data = await crmList('contratos');
      CONTRATOS = data.items || [];
      renderContratos();
    } catch (e) {
      console.error('[CONTRATOS]', e);
      notif('❌ Error cargando contratos', e.message);
    }
  };

  // Mapeo estado → clase CSS Claude Design
  const ESTADO_CLASS = {
    pendiente: 'pending',
    firmado: 'active',
    vencido: 'risk',
    cancelado: 'closed',
  };

  const TIPO_CLASS = {
    reserva: 'reserva',
    venta: 'venta',
    alquiler: 'alquiler',
    boleto: 'boleto',
    otro: 'otro',
  };

  function fmtMonto(c) {
    if (!c.monto) return '—';
    const moneda = c.moneda || 'USD';
    return `<span class="u">${moneda}</span>${Number(c.monto).toLocaleString()}`;
  }

  function fmtFecha(f) {
    if (!f) return '—';
    return f.substring(0, 10);
  }

  function renderContratoCard(c) {
    const estClass = ESTADO_CLASS[c.estado] || 'pending';
    const tipoClass = TIPO_CLASS[c.tipo] || 'otro';
    const dataAttr = JSON.stringify(c).replace(/"/g, '&quot;');
    return `
      <div class="cd-contract">
        <div class="cd-contract-top">
          <div class="cd-contract-id mono">#${c.id || '—'}</div>
          <div class="cd-contract-type ${tipoClass}">${c.tipo || 'otro'}</div>
        </div>
        <div class="cd-contract-title">${c.titulo || '(sin título)'}</div>
        <div class="cd-contract-amount mono">${fmtMonto(c)}</div>
        <div class="cd-contract-meta">
          <div class="cd-meta-cell">
            <div class="cd-meta-label">Firma</div>
            <div class="cd-meta-value mono">${fmtFecha(c.fecha_firma)}</div>
          </div>
          <div class="cd-meta-cell">
            <div class="cd-meta-label">Vence</div>
            <div class="cd-meta-value mono">${fmtFecha(c.fecha_vencimiento)}</div>
          </div>
        </div>
        <div class="cd-contract-foot">
          <div class="cd-status ${estClass}">
            <span class="d"></span>${c.estado || 'pendiente'}
          </div>
          <div class="cd-contract-actions">
            ${c.archivo_url ? `<a href="${c.archivo_url}" target="_blank" class="cd-chip-link" title="Ver PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              PDF
            </a>` : ''}
            <button class="cd-icon-btn" title="Editar" data-c="${dataAttr}" onclick="abrirModalContrato(JSON.parse(this.dataset.c))">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="cd-icon-btn danger" title="Eliminar" onclick="eliminarContrato(${c.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderContratos() {
    const cont = document.getElementById('contratosLista');
    if (!cont) return;

    // Agregados
    const count = CONTRATOS.length;
    const byEst = { pendiente: 0, firmado: 0, vencido: 0, cancelado: 0 };
    let montoTotal = 0;
    CONTRATOS.forEach(c => {
      const e = c.estado || 'pendiente';
      if (byEst[e] !== undefined) byEst[e]++;
      if (c.estado === 'firmado' && c.monto) montoTotal += Number(c.monto) || 0;
    });

    const overview = `
      <div class="overview cd-overview cd-overview-contratos">
        <div class="ov" style="--c:#f59e0b">
          <div class="ov-label"><span class="d"></span>Contratos</div>
          <div class="ov-val mono">${count}</div>
          <div class="ov-foot">En la cartera</div>
        </div>
        <div class="ov" style="--c:#10b981">
          <div class="ov-label"><span class="d"></span>Firmados</div>
          <div class="ov-val mono">${byEst.firmado}</div>
          <div class="ov-foot">Activos</div>
        </div>
        <div class="ov" style="--c:#f59e0b">
          <div class="ov-label"><span class="d"></span>Pendientes</div>
          <div class="ov-val mono">${byEst.pendiente}</div>
          <div class="ov-foot">Por firmar</div>
        </div>
        <div class="ov" style="--c:#ef4444">
          <div class="ov-label"><span class="d"></span>Vencidos</div>
          <div class="ov-val mono">${byEst.vencido}</div>
          <div class="ov-foot">Requieren acción</div>
        </div>
        <div class="ov" style="--c:#06b6d4">
          <div class="ov-label"><span class="d"></span>Vol. firmado</div>
          <div class="ov-val mono">USD ${montoTotal.toLocaleString()}</div>
          <div class="ov-foot">Suma contratos activos</div>
        </div>
      </div>
    `;

    if (count === 0) {
      cont.innerHTML = overview + `
        <div class="cd-empty">
          <div class="cd-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          </div>
          <div class="cd-empty-title">Aún no hay contratos</div>
          <div class="cd-empty-sub">Cargá reservas, ventas o alquileres para seguirlos desde acá</div>
          <button onclick="abrirModalContrato()" class="cd-btn-primary">+ Agregar primer contrato</button>
        </div>
      `;
      return;
    }

    cont.innerHTML = overview + `<div class="cd-contracts-grid">
      ${CONTRATOS.map(renderContratoCard).join('')}
    </div>`;
  }

  window.abrirModalContrato = function(data = null) {
    const c = data || {};
    const modal = document.getElementById('modalContrato');
    if (!modal) return;
    document.getElementById('contratoId').value = c.id || '';
    document.getElementById('contratoTitulo').value = c.titulo || '';
    document.getElementById('contratoTipo').value = c.tipo || 'reserva';
    document.getElementById('contratoMonto').value = c.monto || '';
    document.getElementById('contratoMoneda').value = c.moneda || 'USD';
    document.getElementById('contratoFechaFirma').value = (c.fecha_firma || '').substring(0,10);
    document.getElementById('contratoFechaVenc').value = (c.fecha_vencimiento || '').substring(0,10);
    document.getElementById('contratoEstado').value = c.estado || 'pendiente';
    document.getElementById('contratoArchivoUrl').value = c.archivo_url || '';
    document.getElementById('contratoNotas').value = c.notas || '';
    abrirModal('modalContrato');
  };

  window.subirPdfContrato = async function(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        notif('📤 Subiendo PDF...', 'Esto puede tardar unos segundos');
        const data = await crmFetch('/crm/upload-pdf', { method: 'POST', body: JSON.stringify({ file: reader.result }) });
        if (data.url) {
          document.getElementById('contratoArchivoUrl').value = data.url;
          notif('✅ PDF subido');
        } else throw new Error('No se recibió URL');
      } catch (e) { notif('❌ Error subiendo', e.message); }
    };
    reader.readAsDataURL(file);
  };

  window.guardarContrato = async function() {
    const id = document.getElementById('contratoId').value;
    const campos = {
      titulo: document.getElementById('contratoTitulo').value,
      tipo: document.getElementById('contratoTipo').value,
      monto: parseFloat(document.getElementById('contratoMonto').value) || null,
      moneda: document.getElementById('contratoMoneda').value,
      fecha_firma: document.getElementById('contratoFechaFirma').value || null,
      fecha_vencimiento: document.getElementById('contratoFechaVenc').value || null,
      estado: document.getElementById('contratoEstado').value,
      archivo_url: document.getElementById('contratoArchivoUrl').value,
      notas: document.getElementById('contratoNotas').value,
    };
    try {
      if (id) await crmUpdate('contratos', id, campos);
      else await crmCreate('contratos', campos);
      cerrarModal('modalContrato');
      notif('✅ Contrato guardado', campos.titulo);
      cargarContratos();
    } catch (e) { notif('❌ Error', e.message); }
  };

  window.eliminarContrato = async function(id) {
    if (!confirm('¿Eliminar este contrato?')) return;
    try {
      await crmDelete('contratos', id);
      notif('✅ Contrato eliminado');
      cargarContratos();
    } catch (e) { notif('❌ Error', e.message); }
  };
})();
