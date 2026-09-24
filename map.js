/**
 * Renders a grouped boundary map. Expects window.MAP_CONFIG:
 *   geojson  - boundary GeoJSON URL (features need a GROUP property)
 *   ruc      - rural/urban JSON URL, keyed by codeField
 *   codeField, nameField - property names for the area code and label
 *   page     - current page id, used to mark the nav link
 */
(function () {
  const cfg = window.MAP_CONFIG;
  const pages = [
    { id: 'msoa', label: 'MSOA', href: 'index.html' },
    { id: 'lsoa', label: 'LSOA', href: 'lsoa.html' }
  ];

  const map = L.map('map');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const groupColors = {
    'York': '#eab308',
    'A1 Corridor': '#dc2626',
    'Harrogate & The Dales': '#2563eb',
    'The Vale, Moors & Coast': '#16a34a'
  };
  const fillOpacity = (feature, rural) =>
    feature.properties.Urban_rural_flag === 'Urban' ? rural + 0.3 : rural;
  const baseStyle = feature => {
    const c = groupColors[feature.properties.GROUP] || '#888';
    return { color: c, weight: 1, opacity: 0.5, fillColor: c, fillOpacity: fillOpacity(feature, 0.2) };
  };
  const hoverStyle = feature => ({ weight: 2.5, opacity: 0.9, fillOpacity: fillOpacity(feature, 0.3) });
  const selectedStyle = feature => ({ weight: 4, opacity: 1, fillOpacity: fillOpacity(feature, 0.4) });
  let selected = null;

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function propsTable(props) {
    const rows = Object.entries(props)
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join('');
    return `<table class="props">${rows}</table>`;
  }

  function addControl(position, className, html) {
    const ctl = L.control({ position });
    ctl.onAdd = () => {
      const div = L.DomUtil.create('div', className);
      div.innerHTML = html;
      return div;
    };
    ctl.addTo(map);
  }

  const getJson = url => fetch(url).then(r => {
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json();
  });

  addControl('topright', 'nav', pages
    .map(p => p.id === cfg.page
      ? `<span class="current">${p.label}</span>`
      : `<a href="${p.href}">${p.label}</a>`)
    .join(' | '));

  Promise.all([getJson(cfg.geojson), getJson(cfg.ruc)])
    .then(([data, ruc]) => {
      data.features.forEach(f => Object.assign(f.properties, ruc[f.properties[cfg.codeField]]));
      const layer = L.geoJSON(data, {
        style: baseStyle,
        onEachFeature: (feature, lyr) => {
          lyr.bindPopup(propsTable(feature.properties), { maxWidth: 400 });
          lyr.bindTooltip(feature.properties[cfg.nameField], { sticky: true });
          lyr.on({
            mouseover: e => { if (e.target !== selected) e.target.setStyle(hoverStyle(feature)); },
            mouseout: e => { if (e.target !== selected) layer.resetStyle(e.target); },
            click: e => {
              if (selected) layer.resetStyle(selected);
              selected = e.target;
              selected.setStyle(selectedStyle(feature)).bringToFront();
            },
            popupclose: e => {
              if (e.target === selected) {
                layer.resetStyle(selected);
                selected = null;
              }
            }
          });
        }
      }).addTo(map);
      map.fitBounds(layer.getBounds());

      addControl('bottomright', 'legend', Object.entries(groupColors)
        .map(([g, c]) => `<i style="background:${c}"></i>${escapeHtml(g)}`)
        .join('<br>'));
    })
    .catch(err => {
      map.setView([54.0, -1.2], 8);
      alert('Failed to load map data: ' + err.message);
    });
})();
