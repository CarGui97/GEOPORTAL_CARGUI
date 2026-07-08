const SUPABASE_URL = 'https://ngyhbdmsetntijitxjxo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neWhiZG1zZXRudGlqaXR4anhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzY0MjQsImV4cCI6MjA5NjcxMjQyNH0.pllYMiHBt7dvJEUIv-zKNWgxxB9CTmZG_imA4H3uWNM';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession:false, autoRefreshToken:false }
});

const LAYERS = [
  { table:'agua_potable_wgs84',          label:'Agua Potable',           geomType:'line',    color:'#5fb3d9', weight:2.6, dash:null,   fill:false, fillOpacity:0,   order:0 },
  { table:'catastro_rural_wgs84',        label:'Catastro Rural',         geomType:'polygon', color:'#d97757', weight:1.2, dash:null,   fill:true,  fillOpacity:.16, order:1 },
  { table:'energia_electrica_wgs84',     label:'Energía Eléctrica',      geomType:'line',    color:'#f2c14e', weight:2,   dash:'8,3',  fill:false, fillOpacity:0,   order:2 },
  { table:'recoleccion_basura_wgs84',    label:'Recolección Basura',     geomType:'line',    color:'#7cb87f', weight:2,   dash:'1,5',  fill:false, fillOpacity:0,   order:3 },
  { table:'red_alcantarillado_wgs84',    label:'Alcantarillado',         geomType:'line',    color:'#b98a5e', weight:2.2, dash:'4,4',  fill:false, fillOpacity:0,   order:4 },
  { table:'red_vial_cantonal_wgs84',     label:'Red Vial Cantonal',      geomType:'line',    color:'#e8e3d6', weight:1.6, dash:null,   fill:false, fillOpacity:0,   order:5 },
];

const state = {};
let coordMode = 'utm';
let markerLayer = null;
let queryMarker = null;
let tempMarkers = [];

/* =========================================================
   Map
   ========================================================= */
const map = L.map('map', { zoomControl:true, attributionControl:false }).setView([-1.5, -79.5], 7);
markerLayer = L.layerGroup().addTo(map);

const basemaps = {
  dark:  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains:'abcd', maxZoom:19 }),
  light: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains:'abcd', maxZoom:19 }),
  sat:   L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom:19 }),
};
basemaps.dark.addTo(map);
let currentBasemap = 'dark';

document.querySelector('.chip-group').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  const key = btn.dataset.basemap;
  if (key === currentBasemap) return;
  map.removeLayer(basemaps[currentBasemap]);
  basemaps[key].addTo(map);
  currentBasemap = key;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === btn));
});

L.control.scale({ position:'bottomleft', metric:true, imperial:false }).addTo(map);

map.on('mousemove', updateCoordDisplay);

function updateCoordDisplay(e){
  if (coordMode === 'utm'){
    const u = latLngToUTM(e.latlng.lat, e.latlng.lng);
    document.getElementById('rX').textContent = u.x;
    document.getElementById('rY').textContent = u.y;
    document.getElementById('rZone').textContent = u.zone;
  } else {
    document.getElementById('rX').textContent = e.latlng.lat.toFixed(5);
    document.getElementById('rY').textContent = e.latlng.lng.toFixed(5);
    document.getElementById('rZone').textContent = '°';
  }
}

document.getElementById('coordFmtBtn').addEventListener('click', () => {
  coordMode = coordMode === 'utm' ? 'geo' : 'utm';
  document.getElementById('coordFmtBtn').textContent = coordMode === 'utm' ? 'UTM' : '°';
});

/* Copy coordinates */
document.getElementById('coordReadout').addEventListener('click', () => {
  const x = document.getElementById('rX').textContent;
  const y = document.getElementById('rY').textContent;
  const z = document.getElementById('rZone').textContent;
  const txt = coordMode === 'utm' ? `UTM ${z}: ${x}, ${y}` : `${x}, ${y}`;
  navigator.clipboard.writeText(txt).then(() => toast('Copiado: ' + txt));
});

/* =========================================================
   UTM search
   ========================================================= */
document.getElementById('coordGoBtn').addEventListener('click', () => {
  const raw = document.getElementById('coordInput').value.trim();
  const parts = raw.split(',').map(s => parseFloat(s.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])){
    const zones = [17, 18];
    let found = null;
    for (const z of zones){
      for (const h of ['S', 'N']){
        const ll = utmToLatLng(parts[0], parts[1], z + h);
        if (ll.lat >= -90 && ll.lat <= 90 && ll.lng >= -180 && ll.lng <= 180){ found = ll; break; }
      }
      if (found) break;
    }
    if (!found) found = utmToLatLng(parts[0], parts[1], '17S');
    map.setView([found.lat, found.lng], 15);
    const m = L.circleMarker([found.lat, found.lng], { radius:6, color:'#ef8b7f', weight:2, fillColor:'#ef8b7f', fillOpacity:.6 }).addTo(markerLayer);
    const utm = latLngToUTM(found.lat, found.lng);
    m.bindPopup(`<b>UTM ${utm.zone}: ${utm.x}, ${utm.y}</b>`).openPopup();
  }
});
document.getElementById('coordInput').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('coordGoBtn').click(); });

/* =========================================================
   Helpers
   ========================================================= */
function toast(msg, ms=3500){
  let t = document.getElementById('toast');
  if (!t){
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--panel-2);border:1px solid var(--agua);color:var(--text);padding:8px 14px;border-radius:6px;font-size:11px;z-index:2000;opacity:0;transition:opacity .2s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = '0', ms);
}

function setStatus(kind, text){
  document.getElementById('statusDot').className = 'status-dot' + (kind ? ' '+kind : '');
  document.getElementById('statusText').textContent = text;
}
function setProgress(pct){
  document.getElementById('progressFill').style.width = Math.min(pct,100) + '%';
  document.getElementById('emptyProgress').style.width = Math.min(pct,100) + '%';
}

/* =========================================================
   UTM conversion (WGS84)
   ========================================================= */
function latLngToUTM(lat, lng){
  const zone = Math.floor((lng + 180) / 6) + 1;
  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  const latRad = lat * Math.PI / 180, lonRad = lng * Math.PI / 180, cmRad = centralMeridian * Math.PI / 180;
  const a = 6378137, f = 1/298.257223563, b = a * (1 - f), e2 = (a*a - b*b) / (a*a), e4 = e2*e2, e6 = e4*e2;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad)**2);
  const T = Math.tan(latRad)**2, C = e2/(1-e2) * Math.cos(latRad)**2, A = Math.cos(latRad) * (lonRad - cmRad);
  const M = a * ((1 - e2/4 - 3*e4/64 - 5*e6/256)*latRad - (3*e2/8 + 3*e4/32 + 45*e6/1024)*Math.sin(2*latRad) + (15*e4/256 + 45*e6/1024)*Math.sin(4*latRad) - (35*e6/3072)*Math.sin(6*latRad));
  const easting = 0.9996 * N * (A + (1-T+C)*A**3/6 + (5-18*T+T**2+72*C-58*e2)*A**5/120) + 500000;
  let northing = 0.9996 * (M + N * Math.tan(latRad) * (A**2/2 + (5-T+9*C+4*C**2)*A**4/24 + (61-58*T+T**2+600*C-330*e2)*A**6/720));
  if (lat < 0) northing += 10000000;
  return { x:Math.round(easting), y:Math.round(northing), zone:zone + (lat >= 0 ? 'N' : 'S') };
}

function utmToLatLng(x, y, zoneStr){
  const zone = parseInt(zoneStr), hem = zoneStr.slice(-1) === 'S' ? -1 : 1;
  const centralMeridian = (zone - 1) * 6 - 180 + 3, cmRad = centralMeridian * Math.PI / 180;
  const a = 6378137, f = 1/298.257223563, b = a * (1 - f), e2 = (a*a - b*b) / (a*a);
  const e1 = (1 - Math.sqrt(1-e2)) / (1 + Math.sqrt(1-e2)), k0 = 0.9996;
  const xAdj = x - 500000, yAdj = hem === -1 ? y - 10000000 : y;
  const M = yAdj / k0;
  const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));
  const phi1 = mu + (3*e1/2 - 27*e1**3/32)*Math.sin(2*mu) + (21*e1**2/16 - 55*e1**4/32)*Math.sin(4*mu) + (151*e1**3/96)*Math.sin(6*mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1)**2), T1 = Math.tan(phi1)**2, C1 = e2/(1-e2) * Math.cos(phi1)**2;
  const R1 = a * (1-e2) / ((1 - e2 * Math.sin(phi1)**2)**1.5), D = xAdj / (N1 * k0);
  const latRad = phi1 - (N1 * Math.tan(phi1)/R1) * (D**2/2 - (5+3*T1+10*C1-4*C1**2-9*e2)*D**4/24 + (61+90*T1+298*C1+45*T1**2-252*e2-3*C1**2)*D**6/720);
  const lonRad = cmRad + (D - (1+2*T1+C1)*D**3/6 + (5-2*C1+28*T1-3*C1**2+8*e2+24*T1**2)*D**5/120) / Math.cos(phi1);
  return { lat: latRad * 180/Math.PI, lng: lonRad * 180/Math.PI };
}

/* =========================================================
   WKB hex -> GeoJSON
   ========================================================= */
function wkbHexToGeoJSON(hex){
  hex = hex.trim();
  if (!/^[0-9A-Fa-f]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length/2);
  for (let i=0;i<bytes.length;i++) bytes[i] = parseInt(hex.substr(i*2,2),16);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  function readByte(){ const v = view.getUint8(offset); offset+=1; return v; }
  function readUInt32(le){ const v = view.getUint32(offset, le); offset+=4; return v; }
  function readDouble(le){ const v = view.getFloat64(offset, le); offset+=8; return v; }
  function readGeom(){
    const bo = readByte(), le = bo === 1;
    let type = readUInt32(le); const hasSRID = (type & 0x20000000) !== 0;
    type = type & 0xFFFF; if (hasSRID) readUInt32(le);
    switch(type){
      case 1: return {type:'Point', coordinates:[readDouble(le),readDouble(le)]};
      case 2: { const n=readUInt32(le); const c=[]; for(let i=0;i<n;i++) c.push([readDouble(le),readDouble(le)]); return {type:'LineString', coordinates:c}; }
      case 3: { const nR=readUInt32(le); const rings=[]; for(let r=0;r<nR;r++){ const nP=readUInt32(le); const ring=[]; for(let i=0;i<nP;i++) ring.push([readDouble(le),readDouble(le)]); rings.push(ring);} return {type:'Polygon', coordinates:rings}; }
      case 4: { const n=readUInt32(le); const pts=[]; for(let i=0;i<n;i++){ readByte(); readUInt32(le); pts.push([readDouble(le),readDouble(le)]); } return {type:'MultiPoint', coordinates:pts}; }
      case 5: { const n=readUInt32(le); const lines=[]; for(let i=0;i<n;i++){ readByte(); readUInt32(le); const nP=readUInt32(le); const line=[]; for(let j=0;j<nP;j++) line.push([readDouble(le),readDouble(le)]); lines.push(line);} return {type:'MultiLineString', coordinates:lines}; }
      case 6: { const n=readUInt32(le); const polys=[]; for(let i=0;i<n;i++){ readByte(); readUInt32(le); const nR=readUInt32(le); const rings=[]; for(let r=0;r<nR;r++){ const nP=readUInt32(le); const ring=[]; for(let p=0;p<nP;p++) ring.push([readDouble(le),readDouble(le)]); rings.push(ring);} polys.push(rings);} return {type:'MultiPolygon', coordinates:polys}; }
      default: return null;
    }
  }
  try{ return readGeom(); } catch(e){ return null; }
}

function detectAndConvert(value){
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value.type && value.coordinates) return value;
  if (typeof value === 'string'){
    const t = value.trim();
    if (/^[0-9A-Fa-f]+$/.test(t) && t.length > 10){ const g = wkbHexToGeoJSON(t); if (g) return g; }
    if (t.startsWith('{')){ try{ return JSON.parse(t); } catch(e){} }
  }
  return null;
}

/* =========================================================
   Build layer list (with zoom button)
   ========================================================= */
const layerListEl = document.getElementById('layerList');
LAYERS.forEach(def => {
  const row = document.createElement('div');
  row.className = 'layer-row';
  row.innerHTML = `
    <input type="checkbox" checked data-table="${def.table}">
    <span class="layer-swatch" style="background:${swatchStyle(def)}"></span>
    <div class="layer-info">
      <div class="layer-info-top">
        <span class="layer-name" data-select="${def.table}">${def.label}</span>
        <button class="zoom-layer-btn" data-table="${def.table}" title="Zoom a esta capa">◎</button>
      </div>
      <div class="layer-meta">
        <span class="state-wait" id="state-${def.table}">en espera</span>
        <span class="count" id="count-${def.table}">—</span>
      </div>
    </div>
  `;
  layerListEl.appendChild(row);
  state[def.table] = { def, rows:[], geojsonLayer:null, featureCount:0, checkbox:row.querySelector('input') };
});

function swatchStyle(def){
  if (def.geomType === 'polygon') return `repeating-linear-gradient(45deg, ${def.color}55, ${def.color}55 3px, transparent 3px, transparent 6px), ${def.color}22`;
  if (def.dash) return `repeating-linear-gradient(90deg, ${def.color} 0 5px, transparent 5px 9px)`;
  return def.color;
}

layerListEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
  cb.addEventListener('change', () => {
    const s = state[cb.dataset.table];
    if (!s || !s.geojsonLayer) return;
    if (cb.checked) s.geojsonLayer.addTo(map); else map.removeLayer(s.geojsonLayer);
    updateFeatCount();
  });
});

layerListEl.querySelectorAll('.layer-name').forEach(el => {
  el.addEventListener('click', () => {
    const sel = document.getElementById('tableSelector');
    sel.value = el.dataset.select;
    showTableData(el.dataset.select);
    document.getElementById('dataPanel').classList.remove('collapsed');
    document.getElementById('collapseBtn').textContent = '▾';
  });
});

layerListEl.querySelectorAll('.zoom-layer-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const s = state[btn.dataset.table];
    if (s && s.geojsonLayer){
      try{
        const b = s.geojsonLayer.getBounds();
        map.fitBounds(b, { padding:[40,40] });
      } catch(e){}
    }
  });
});

document.getElementById('toggleAllBtn').addEventListener('click', () => {
  const boxes = Array.from(layerListEl.querySelectorAll('input[type=checkbox]'));
  const allOn = boxes.every(b => b.checked);
  boxes.forEach(b => { b.checked = !allOn; b.dispatchEvent(new Event('change')); });
});
document.getElementById('reloadBtn').addEventListener('click', loadAll);

/* =========================================================
   Opacity controls
   ========================================================= */
function buildOpacityControls(){
  const el = document.getElementById('opacityControls');
  el.innerHTML = '';
  LAYERS.forEach(def => {
    const row = document.createElement('div');
    row.className = 'opacity-row';
    row.innerHTML = `<label>${def.label}</label><input type="range" min="0" max="1" step="0.05" value="1" data-table="${def.table}"><span class="val">1.00</span>`;
    el.appendChild(row);
    row.querySelector('input').addEventListener('input', function(){
      const s = state[this.dataset.table];
      const v = parseFloat(this.value);
      row.querySelector('.val').textContent = v.toFixed(2);
      if (s && s.geojsonLayer) s.geojsonLayer.eachLayer(l => { if (l.setStyle) l.setStyle({ opacity:v, fillOpacity:s.def.fill ? v * s.def.fillOpacity : 0 }); });
    });
  });
}
buildOpacityControls();

/* =========================================================
   Style by attribute (catastral focus)
   ========================================================= */
const CATEGORICAL_COLORS = ['#d97757','#5fb3d9','#f2c14e','#7cb87f','#b98a5e','#e8e3d6','#ef8b7f','#9b8ec4','#6ab0a6','#d4a06a'];
let origStyles = {};

document.getElementById('applyAttrStyle').addEventListener('click', applyAttrStyle);
document.getElementById('resetAttrStyle').addEventListener('click', resetAttrStyle);

function populateAttrStyleSelects(){
  const capaSel = document.getElementById('attrStyleSelect');
  const attrSel = document.getElementById('attrFieldSelect');
  capaSel.innerHTML = '<option value="">— capa —</option>' + LAYERS.map(d => `<option value="${d.table}">${d.label}</option>`).join('');
  capaSel.addEventListener('change', () => {
    const s = state[capaSel.value];
    attrSel.innerHTML = '<option value="">— atributo —</option>';
    if (s && s.rows.length > 0){
      const cols = Object.keys(s.rows[0]).filter(k => k !== 'geom');
      attrSel.innerHTML += cols.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  });
}
populateAttrStyleSelects();

function applyAttrStyle(){
  const table = document.getElementById('attrStyleSelect').value;
  const field = document.getElementById('attrFieldSelect').value;
  if (!table || !field) return;
  const s = state[table];
  if (!s || !s.geojsonLayer) return;
  const values = [...new Set(s.rows.map(r => String(r[field] ?? '(vacio)')).filter(Boolean))];
  const colorMap = {};
  values.forEach((v, i) => { colorMap[v] = CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]; });
  if (!origStyles[table]) origStyles[table] = { color: s.def.color, weight: s.def.weight, fillOpacity: s.def.fill ? s.def.fillOpacity : 0 };
  s.geojsonLayer.eachLayer(l => {
    if (l.feature && l.feature.properties){
      const v = String(l.feature.properties[field] ?? '(vacio)');
      const c = colorMap[v] || '#888';
      l.setStyle({ color:c, fillColor:c });
    }
  });
  toast(`Estilo aplicado: ${table} → ${field} (${values.length} categorías)`);
}

function resetAttrStyle(){
  Object.keys(origStyles).forEach(table => {
    const s = state[table];
    if (s && s.geojsonLayer){
      const os = origStyles[table];
      s.geojsonLayer.eachLayer(l => l.setStyle({
        color: os.color, weight: os.weight, fillColor: os.color,
        fillOpacity: os.fillOpacity, opacity: 0.9, dashArray: s.def.dash || null
      }));
    }
  });
  origStyles = {};
  toast('Estilo original restaurado');
}

/* =========================================================
   Data loading
   ========================================================= */
async function fetchTable(tableName, limit){
  const { data, error } = await client.from(tableName).select('*').limit(limit);
  if (error) throw error;
  return data || [];
}

let loadedCount = 0;
async function loadAll(){
  const limit = 2500;
  setStatus('wait', 'Conectando a Supabase…');
  document.getElementById('mapEmpty').style.display = 'flex';
  document.getElementById('emptyMsg').textContent = 'Cargando las 6 capas desde Supabase…';
  document.getElementById('reloadBtn').disabled = true;
  loadedCount = 0; setProgress(0);
  markerLayer.clearLayers();

  const stats = { agua:0, alcantarillado:0, elect:0, basura:0, vial:0, catastro:0, predios:0 };

  Object.values(state).forEach(s => {
    if (s.geojsonLayer) map.removeLayer(s.geojsonLayer);
    s.geojsonLayer = null; s.rows = []; s.featureCount = 0;
    document.getElementById(`state-${s.def.table}`).className = 'state-wait';
    document.getElementById(`state-${s.def.table}`).textContent = 'cargando…';
    document.getElementById(`count-${s.def.table}`).textContent = '—';
  });

  const ordered = [...LAYERS].sort((a,b) => a.order - b.order);
  const errors = [];
  const totalLayers = ordered.length;

  for (let idx = 0; idx < ordered.length; idx++){
    const def = ordered[idx];
    const stateEl = document.getElementById(`state-${def.table}`);
    const countEl = document.getElementById(`count-${def.table}`);
    try{
      const rows = await fetchTable(def.table, limit);
      const features = [];
      let geomCol = null;
      rows.forEach(row => {
        if (!geomCol) geomCol = Object.keys(row).find(k => k === 'geom') || Object.keys(row).find(k => detectAndConvert(row[k]) !== null);
        const geom = geomCol ? detectAndConvert(row[geomCol]) : null;
        if (geom){
          const props = {...row};
          if (geomCol) delete props[geomCol];
          features.push({ type:'Feature', geometry:geom, properties:props });
        }
      });

      let geojsonLayer = null;
      if (features.length > 0){
        const baseStyle = { color: def.color, weight: def.weight, dashArray: def.dash || null, fillColor: def.color, fillOpacity: def.fill ? def.fillOpacity : 0, opacity: .9 };
        geojsonLayer = L.geoJSON({ type:'FeatureCollection', features }, {
          style: () => baseStyle,
          pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius:5, color:def.color, weight:1.5, fillColor:def.color, fillOpacity:.75 }),
          onEachFeature: (f, l) => {
            const entries = Object.entries(f.properties || {}).slice(0, 8);
            l.bindPopup(`<div style="font-family:'JetBrains Mono',monospace;font-size:11px;max-width:260px"><b style="color:${def.color}">${def.label}</b><br>${entries.map(([k,v])=>`<b>${k}:</b> ${v}`).join('<br>')||'(sin atributos)'}</div>`);
            const firstVal = f.properties ? Object.values(f.properties).find(v => v !== null && v !== undefined) : null;
            l.bindTooltip(firstVal ? String(firstVal) : def.label, { sticky:true, direction:'top', offset:[0,-4] });
          }
        });
        if (state[def.table].checkbox.checked) geojsonLayer.addTo(map);
      }

      state[def.table].rows = rows;
      state[def.table].geomCol = geomCol || 'geom';
      state[def.table].geojsonLayer = geojsonLayer;
      state[def.table].featureCount = features.length;

      stateEl.className = 'state-ok';
      stateEl.textContent = features.length > 0 ? 'ok' : 'sin geometría';
      countEl.textContent = `${rows.length} filas`;

      /* Calculate stats */
      if (features.length > 0){
        if (def.geomType === 'line'){
          let km = 0;
          features.forEach(f => {
            km += measureGeoJSON(f.geometry);
          });
          km = Math.round(km * 100) / 100;
          if (def.table.includes('agua')) stats.agua = km;
          else if (def.table.includes('alcantarillado')) stats.alcantarillado = km;
          else if (def.table.includes('electrica')) stats.elect = km;
          else if (def.table.includes('basura')) stats.basura = km;
          else if (def.table.includes('vial')) stats.vial = km;
        } else if (def.geomType === 'polygon'){
          let ha = 0;
          features.forEach(f => { ha += measureAreaHA(f.geometry); });
          stats.catastro = Math.round(ha * 100) / 100;
          stats.predios = features.length;
        }
      }

    } catch(e){
      errors.push(`${def.label}: ${e.message}`);
      stateEl.className = 'state-err';
      stateEl.textContent = 'error';
      countEl.textContent = '—';
    }
    loadedCount = idx + 1;
    setProgress((loadedCount / totalLayers) * 100);
  }

  fitAllLayers();
  updateFeatCount();
  populateTableSelector();

  const totalFeatures = Object.values(state).reduce((a,s) => a + s.featureCount, 0);
  document.getElementById('mapEmpty').style.display = totalFeatures === 0 ? 'flex' : 'none';
  if (totalFeatures === 0){
    document.getElementById('emptyMsg').textContent = errors.length
      ? 'No se pudo cargar ninguna capa. Revisa la consola / RLS.'
      : 'Las 6 tablas respondieron pero ninguna tiene geometría interpretable.';
  }
  setStatus(errors.length ? 'err' : 'on', errors.length ? `Cargado con ${errors.length} aviso(s)` : 'Conectado — 6 capas leídas');
  document.getElementById('reloadBtn').disabled = false;

  /* Render stats */
  updateStats(stats);
}

function measureGeoJSON(geom){
  let total = 0;
  const coords = geom.coordinates;
  if (geom.type === 'LineString'){ for (let i=1;i<coords.length;i++) total += haversine(coords[i-1][1],coords[i-1][0],coords[i][1],coords[i][0]); }
  else if (geom.type === 'MultiLineString'){ coords.forEach(line => { for (let i=1;i<line.length;i++) total += haversine(line[i-1][1],line[i-1][0],line[i][1],line[i][0]); }); }
  else if (geom.type === 'Polygon'){ coords[0].forEach((c,i) => { if (i>0) total += haversine(coords[0][i-1][1],coords[0][i-1][0],c[1],c[0]); }); }
  else if (geom.type === 'MultiPolygon'){ coords.forEach(p => { p[0].forEach((c,i) => { if (i>0) total += haversine(p[0][i-1][1],p[0][i-1][0],c[1],c[0]); }); }); }
  return total;
}

function haversine(lat1,lon1,lat2,lon2){
  const R = 6371; const dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function measureAreaHA(geom){
  try{
    const coords = geom.coordinates;
    if (geom.type === 'Polygon') return polygonAreaHA(coords[0]);
    if (geom.type === 'MultiPolygon'){ let t=0; coords.forEach(p => t += polygonAreaHA(p[0])); return t; }
    return 0;
  } catch(e){ return 0; }
}

function polygonAreaHA(ring){
  if (ring.length < 3) return 0;
  let area = 0;
  for (let i=0; i<ring.length; i++){
    const j = (i+1) % ring.length;
    const x1 = ring[i][0] * Math.PI / 180, y1 = ring[i][1] * Math.PI / 180;
    const x2 = ring[j][0] * Math.PI / 180, y2 = ring[j][1] * Math.PI / 180;
    area += (x2 - x1) * (2 + Math.sin(y1) + Math.sin(y2));
  }
  area = area * 6378137 * 6378137 / 2;
  return Math.abs(area) / 10000; /* m2 -> ha */
}

function updateStats(stats){
  document.getElementById('statAgua').textContent = stats.agua ? stats.agua + ' km' : '—';
  document.getElementById('statAlcant').textContent = stats.alcantarillado ? stats.alcantarillado + ' km' : '—';
  document.getElementById('statElect').textContent = stats.elect ? stats.elect + ' km' : '—';
  document.getElementById('statBasura').textContent = stats.basura ? stats.basura + ' km' : '—';
  document.getElementById('statVial').textContent = stats.vial ? stats.vial + ' km' : '—';
  document.getElementById('statCatastro').textContent = stats.catastro ? stats.catastro + ' ha' : '—';
  const card = document.getElementById('summaryCard');
  if (stats.agua || stats.alcantarillado || stats.elect || stats.basura || stats.vial || stats.catastro){
    card.style.display = 'block';
    document.getElementById('sumRedes').textContent = (stats.agua + stats.alcantarillado + stats.elect + stats.basura + stats.vial).toFixed(2) + ' km';
    document.getElementById('sumCatastro').textContent = stats.catastro ? stats.catastro + ' ha' : '—';
    document.getElementById('sumPredios').textContent = stats.predios || '—';
  }
}

function fitAllLayers(){
  const bounds = [];
  Object.values(state).forEach(s => {
    if (s.geojsonLayer && s.checkbox.checked) try{ bounds.push(s.geojsonLayer.getBounds()); } catch(e){}
  });
  if (bounds.length === 0) return;
  let combined = bounds[0];
  bounds.slice(1).forEach(b => combined.extend(b));
  try{ map.fitBounds(combined, { padding:[30,30] }); } catch(e){}
}

function updateFeatCount(){
  let total = 0;
  Object.values(state).forEach(s => { if (s.checkbox.checked) total += s.featureCount; });
  document.getElementById('featCount').textContent = total;
}

/* =========================================================
   Data panel with filter
   ========================================================= */
function populateTableSelector(){
  const sel = document.getElementById('tableSelector');
  const names = LAYERS.map(d => d.table).filter(t => state[t].rows.length > 0);
  sel.style.display = names.length > 0 ? 'inline-block' : 'none';
  sel.innerHTML = names.map(n => `<option value="${n}">${state[n].def.label}</option>`).join('');
  if (names.length > 0){
    sel.value = names[0];
    showTableData(names[0]);
    document.getElementById('tableFilter').disabled = false;
  }
}
document.getElementById('tableSelector').addEventListener('change', e => showTableData(e.target.value));

let currentTableRows = [];
let currentTableGeom = 'geom';

function showTableData(tableName){
  const s = state[tableName];
  if (!s) return;
  currentTableRows = s.rows;
  currentTableGeom = s.geomCol || 'geom';
  document.getElementById('tableFilter').value = '';
  renderTable(currentTableRows, currentTableGeom);
}

function renderTable(rows, geomCol){
  const head = document.getElementById('tableHead');
  const body = document.getElementById('tableBody');
  document.getElementById('rowCount').textContent = rows.length;
  head.innerHTML = ''; body.innerHTML = '';
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; head.appendChild(th); });
  rows.forEach(row => {
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const td = document.createElement('td');
      let v = row[c];
      if (c === geomCol){
        td.className = 'geom';
        td.textContent = typeof v === 'string' ? (v.length > 40 ? v.slice(0,40)+'…' : v) : '[geometría]';
      } else {
        td.textContent = (v === null || v === undefined) ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

document.getElementById('tableFilter').addEventListener('input', function(){
  const q = this.value.toLowerCase();
  const rows = document.querySelectorAll('#tableBody tr');
  let visible = 0;
  rows.forEach(tr => {
    const match = Array.from(tr.cells).some(td => td.textContent.toLowerCase().includes(q));
    tr.classList.toggle('hide', !match);
    if (match) visible++;
  });
  document.getElementById('rowCount').textContent = visible + '/' + currentTableRows.length;
});

document.getElementById('collapseBtn').addEventListener('click', () => {
  const panel = document.getElementById('dataPanel');
  panel.classList.toggle('collapsed');
  document.getElementById('collapseBtn').textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
});

/* =========================================================
   Spatial query (click on map)
   ========================================================= */
map.on('click', (e) => {
  if (measuring) return;
  const lat = e.latlng.lat, lng = e.latlng.lng;
  if (queryMarker) markerLayer.removeLayer(queryMarker);
  queryMarker = L.circleMarker([lat, lng], { radius:5, color:'#fff', weight:2, fillColor:'#ef8b7f', fillOpacity:.8 }).addTo(markerLayer);

  const results = [];
  Object.values(state).forEach(s => {
    if (!s.geojsonLayer || !s.checkbox.checked) return;
    s.geojsonLayer.eachLayer(l => {
      if (l.feature && l.getBounds && l.getBounds().contains(e.latlng)){
        if (l.feature.geometry.type === 'Point'){
          const d = map.distance(e.latlng, l.getLatLng());
          if (d < 100) results.push({ layer:s.def.label, props:l.feature.properties, dist:Math.round(d) });
        } else {
          results.push({ layer:s.def.label, props:l.feature.properties, dist:0 });
        }
      }
    });
  });

  if (results.length === 0){
    queryMarker.bindPopup(`<b>${lat.toFixed(5)}, ${lng.toFixed(5)}</b><br><span style="color:var(--text-faint)">Sin features cercanos</span>`).openPopup();
    return;
  }

  const limit = Math.min(results.length, 15);
  let html = `<b>${results.length} feature(s) en este punto</b><br><br>`;
  for (let i=0; i<limit; i++){
    const r = results[i];
    const firstVal = Object.values(r.props || {}).find(v => v !== null && v !== undefined) || '(sin datos)';
    html += `<b style="color:var(--agua)">${r.layer}</b>: ${String(firstVal).slice(0,30)}<br>`;
  }
  if (results.length > limit) html += `<span style="color:var(--text-faint)">…y ${results.length - limit} más</span>`;
  queryMarker.bindPopup(`<div style="font-family:'JetBrains Mono',monospace;font-size:10px;max-width:220px">${html}</div>`).openPopup();
});

/* =========================================================
   Right-click marker
   ========================================================= */
map.on('contextmenu', (e) => {
  const lat = e.latlng.lat.toFixed(5), lng = e.latlng.lng.toFixed(5);
  const utm = latLngToUTM(e.latlng.lat, e.latlng.lng);
  const m = L.circleMarker([e.latlng.lat, e.latlng.lng], { radius:5, color:'#f2c14e', weight:2, fillColor:'#f2c14e', fillOpacity:.6 }).addTo(markerLayer);
  m.bindPopup(`<b>UTM ${utm.zone}: ${utm.x}, ${utm.y}</b><br><span style="color:var(--text-faint)">${lat}, ${lng}</span>`).openPopup();
  tempMarkers.push(m);
  toast(`Marca temporal: UTM ${utm.zone} ${utm.x}, ${utm.y}`, 2500);
  if (tempMarkers.length > 10){
    const old = tempMarkers.shift();
    markerLayer.removeLayer(old);
  }
});

/* =========================================================
   Measurement tool
   ========================================================= */
let measuring = false;
let measurePoints = [];
let measureLine = null;
let measureMarkers = [];

document.getElementById('measureBtn').addEventListener('click', () => {
  measuring = !measuring;
  document.getElementById('measureBtn').classList.toggle('active');
  document.getElementById('measureInfo').style.display = measuring ? 'block' : 'none';
  if (!measuring) clearMeasurement();
  else map.getContainer().style.cursor = 'crosshair';
});
document.getElementById('closeMeasureBtn').addEventListener('click', () => { measuring = false; document.getElementById('measureBtn').classList.remove('active'); document.getElementById('measureInfo').style.display = 'none'; clearMeasurement(); map.getContainer().style.cursor = ''; });
document.getElementById('clearMeasureBtn').addEventListener('click', clearMeasurement);

function clearMeasurement(){
  if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
  measureMarkers.forEach(m => map.removeLayer(m));
  measureMarkers = []; measurePoints = [];
  document.getElementById('measureDist').textContent = '0.00';
  if (!measuring) map.getContainer().style.cursor = '';
}

map.on('click', (e) => {
  if (!measuring) return;
  measurePoints.push(e.latlng);
  const marker = L.circleMarker(e.latlng, { radius:4, color:'#ef8b7f', weight:2, fillColor:'#ef8b7f', fillOpacity:.8 }).addTo(map);
  measureMarkers.push(marker);
  if (measureLine) map.removeLayer(measureLine);
  measureLine = L.polyline(measurePoints, { color:'#ef8b7f', weight:2, dashArray:'4,4' }).addTo(map);
  let total = 0;
  for (let i = 1; i < measurePoints.length; i++) total += measurePoints[i-1].distanceTo(measurePoints[i]);
  document.getElementById('measureDist').textContent = (total / 1000).toFixed(2);
});

/* =========================================================
   Export
   ========================================================= */
document.getElementById('exportGeoJSON').addEventListener('click', () => {
  const allFeatures = [];
  Object.values(state).forEach(s => {
    if (s.geojsonLayer && s.checkbox.checked) s.geojsonLayer.eachLayer(l => { if (l.feature) allFeatures.push(l.feature); });
  });
  if (allFeatures.length === 0) return;
  const blob = new Blob([JSON.stringify({ type:'FeatureCollection', features:allFeatures }, null, 2)], { type:'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'geoportal_export_' + new Date().toISOString().slice(0,10) + '.geojson';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('GeoJSON exportado');
});

document.getElementById('exportPNG').addEventListener('click', () => {
  if (typeof html2canvas === 'undefined'){ toast('html2canvas no disponible'); return; }
  const container = document.getElementById('map');
  const buttons = container.querySelectorAll('.toolbar, .leaflet-control-zoom');
  buttons.forEach(b => b.style.display = 'none');
  html2canvas(container).then(canvas => {
    buttons.forEach(b => b.style.display = '');
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = 'geoportal_' + new Date().toISOString().slice(0,10) + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('PNG exportado');
  }).catch(() => {
    buttons.forEach(b => b.style.display = '');
    toast('Error al exportar PNG');
  });
});

/* =========================================================
   Print: vista actual + atributos visibles
   ========================================================= */
document.getElementById('printBtn').addEventListener('click', () => {
  const mapContainer = document.getElementById('map');
  const hideEls = mapContainer.querySelectorAll('.toolbar, .leaflet-control-zoom, .empty-state, .measure-info, .map-topbar');
  hideEls.forEach(el => { if (el) el.style.display = 'none'; });

  html2canvas(mapContainer, { useCORS:true, backgroundColor:'#0a1420' }).then(canvas => {
    hideEls.forEach(el => { if (el) el.style.display = ''; });
    const mapDataUrl = canvas.toDataURL('image/png');

    const center = map.getCenter();
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const cUtm = latLngToUTM(center.lat, center.lng);
    const swUtm = latLngToUTM(bounds.getSouthWest().lat, bounds.getSouthWest().lng);
    const neUtm = latLngToUTM(bounds.getNorthEast().lat, bounds.getNorthEast().lng);

    let legendHtml = '', tableRows = '', allCount = 0;

    LAYERS.forEach(def => {
      const s = state[def.table];
      if (!s || !s.geojsonLayer || !s.checkbox.checked) return;
      const count = s.featureCount;
      allCount += count;
      const dashStyle = def.dash ? `border-top:2px ${def.dash.includes('4,4')?'dashed':def.dash.includes('8,3')?'dotted':'dashed'} ${def.color}` : `border-top:2px solid ${def.color}`;
      legendHtml += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="display:inline-block;width:28px;height:3px;${def.geomType==='polygon'?`background:${def.color}44;border:1.5px solid ${def.color};width:16px;height:16px;border-radius:2px`:dashStyle}"></span><span style="font-size:11px">${def.label}</span><span style="font-size:10px;color:#888">(${count} features)</span></div>`;

      s.geojsonLayer.eachLayer(l => {
        if (!l.feature || !l.getBounds) return;
        try{
          if (!bounds.intersects(l.getBounds())) return;
        } catch(e){ return; }
        const props = l.feature.properties || {};
        const vals = Object.entries(props).slice(0, 8);
        const utmCenter = l.getCenter ? latLngToUTM(l.getCenter().lat, l.getCenter().lng) : null;
        tableRows += `<tr>
          <td style="padding:4px 6px;font-size:9px;border:1px solid #ddd;color:${def.color};font-weight:600">${def.label}</td>
          <td style="padding:4px 6px;font-size:9px;border:1px solid #ddd">${utmCenter ? `UTM ${utmCenter.zone}: ${utmCenter.x}, ${utmCenter.y}` : '—'}</td>
          <td style="padding:4px 6px;font-size:9px;border:1px solid #ddd">${vals.map(([k,v]) => `<b>${k}:</b> ${String(v).slice(0,25)}`).join(' | ') || '—'}</td>
        </tr>`;
      });
    });

    const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Imprimir Geoportal</title>
    <style>
      @page{size:A4 landscape;margin:1.2cm;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#222;font-size:10px;padding:0;margin:0;}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1a3a5c;padding-bottom:8px;margin-bottom:12px;}
      .header h1{margin:0;font-size:18px;color:#1a3a5c;}
      .header .meta{text-align:right;font-size:9px;color:#666;}
      .map-wrap{text-align:center;margin:10px 0;border:1px solid #ccc;}
      .map-wrap img{max-width:100%;height:auto;max-height:320px;}
      .info-grid{display:flex;gap:20px;margin:10px 0;font-size:9px;color:#444;}
      .info-grid div{flex:1;background:#f5f7fa;padding:6px 8px;border-radius:4px;}
      .info-grid b{color:#1a3a5c;}
      h2{font-size:13px;color:#1a3a5c;margin:14px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px;}
      table{width:100%;border-collapse:collapse;font-size:8.5px;margin:6px 0;}
      th{background:#1a3a5c;color:#fff;padding:5px 6px;text-align:left;font-size:9px;}
      td{max-width:200px;overflow:hidden;}
      tr:nth-child(even){background:#f9f9f9;}
      .footer{text-align:center;font-size:8px;color:#999;margin-top:14px;border-top:1px solid #ddd;padding-top:6px;}
      .leyenda{margin:8px 0;}
      @media print{body{font-size:8px;} h2{font-size:11px;} .header h1{font-size:15px;}}
    </style></head><body>
      <div class="header">
        <div><h1>Geoportal · Gestión Catastral y Redes</h1><div style="font-size:9px;color:#666">Reporte de vista actual del mapa</div></div>
        <div class="meta">${new Date().toLocaleDateString('es-EC',{year:'numeric',month:'long',day:'numeric'})}<br>${new Date().toLocaleTimeString('es-EC')}</div>
      </div>
      <div class="map-wrap"><img src="${mapDataUrl}" alt="Mapa"></div>
      <div class="info-grid">
        <div><b>Centro (UTM):</b> ${cUtm.zone} ${cUtm.x}, ${cUtm.y}</div>
        <div><b>Esquina SO:</b> ${swUtm.zone} ${swUtm.x}, ${swUtm.y}</div>
        <div><b>Esquina NE:</b> ${neUtm.zone} ${neUtm.x}, ${neUtm.y}</div>
        <div><b>Zoom:</b> ${zoom} | <b>Features totales:</b> ${allCount}</div>
      </div>
      <h2>Leyenda de capas</h2>
      <div class="leyenda">${legendHtml}</div>
      <h2>Detalle de features visibles (${tableRows ? 'mostrando hasta 200 registros' : 'sin datos'})</h2>
      <table>
        <thead><tr><th>Capa</th><th>Ubicación (UTM)</th><th>Atributos</th></tr></thead>
        <tbody>${tableRows || '<tr><td colspan="3" style="text-align:center;color:#999">No hay features visibles</td></tr>'}</tbody>
      </table>
      <div class="footer">Geoportal — Datos desde Supabase/PostGIS — Coordenadas UTM WGS84 — Este reporte es generado automáticamente</div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes');
    w.document.write(printHtml);
    w.document.close();

  }).catch(() => {
    hideEls.forEach(el => { if (el) el.style.display = ''; });
    toast('Error al generar vista previa para impresión');
  });
});

/* =========================================================
   Start
   ========================================================= */
loadAll();
