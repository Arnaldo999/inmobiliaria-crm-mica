// Panel Reportes — ventas, conversión, performance por asesor/fuente
(function(){
  let chartVentas = null, chartFuentes = null, chartAsesores = null;

  window.cargarReportes = async function() {
    try {
      const data = await crmFetch('/crm/reportes');
      renderReportes(data);
    } catch (e) {
      console.error('[REPORTES]', e);
      notif('❌ Error cargando reportes', e.message);
    }
  };

  function renderReportes(data) {
    // Ventas por mes
    const ventasEl = document.getElementById('chartVentasMes');
    if (ventasEl && typeof Chart !== 'undefined') {
      if (chartVentas) chartVentas.destroy();
      const meses = data.ventas_por_mes || [];
      chartVentas = new Chart(ventasEl, {
        type: 'line',
        data: {
          labels: meses.map(m => m.mes),
          datasets: [{
            label: 'Ventas',
            data: meses.map(m => m.ventas),
            borderColor: '#10b981',
            backgroundColor: '#10b98133',
            tension: 0.3,
            fill: true,
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }

    // Fuentes
    const fuentesEl = document.getElementById('chartFuentes');
    if (fuentesEl && typeof Chart !== 'undefined') {
      if (chartFuentes) chartFuentes.destroy();
      const fuentes = data.por_fuente || [];
      chartFuentes = new Chart(fuentesEl, {
        type: 'doughnut',
        data: {
          labels: fuentes.map(f => f.fuente || 'sin fuente'),
          datasets: [{
            data: fuentes.map(f => f.total),
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // Asesores
    const asesoresCont = document.getElementById('tablaAsesoresRanking');
    if (asesoresCont) {
      const asesores = data.por_asesor || [];
      if (asesores.length === 0) {
        asesoresCont.innerHTML = '<p class="text-xs text-txt-2 italic">Aún no hay leads asignados a asesores.</p>';
      } else {
        asesoresCont.innerHTML = `
          <table class="w-full text-sm">
            <thead class="text-xs uppercase text-txt-2">
              <tr>
                <th class="text-left p-2">Asesor</th>
                <th class="text-right p-2">Total Leads</th>
                <th class="text-right p-2">Cerrados</th>
                <th class="text-right p-2">Tasa</th>
              </tr>
            </thead>
            <tbody>
              ${asesores.map(a => `
                <tr class="border-b border-brd">
                  <td class="p-2 font-medium">${a.asesor}</td>
                  <td class="p-2 text-right">${a.total_leads}</td>
                  <td class="p-2 text-right text-green-400">${a.ganados}</td>
                  <td class="p-2 text-right">${a.total_leads ? Math.round((a.ganados / a.total_leads) * 100) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    // Fuentes tabla
    const fuentesTbl = document.getElementById('tablaFuentes');
    if (fuentesTbl) {
      const fuentes = data.por_fuente || [];
      fuentesTbl.innerHTML = fuentes.length === 0 ? '<p class="text-xs text-txt-2 italic">Sin datos</p>' : `
        <table class="w-full text-sm">
          <thead class="text-xs uppercase text-txt-2">
            <tr>
              <th class="text-left p-2">Fuente</th>
              <th class="text-right p-2">Leads</th>
              <th class="text-right p-2">Citas</th>
              <th class="text-right p-2">Cerrados</th>
            </tr>
          </thead>
          <tbody>
            ${fuentes.map(f => `
              <tr class="border-b border-brd">
                <td class="p-2 font-medium">${f.fuente || '—'}</td>
                <td class="p-2 text-right">${f.total}</td>
                <td class="p-2 text-right">${f.con_cita}</td>
                <td class="p-2 text-right text-green-400">${f.ganados}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }
})();
