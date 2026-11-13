/**
 * EV Charging Station Analysis — 3D Dual-Hub Campus & Vehicle Simulation Platform
 * CSE221 – Interactive Data Visualization Using D3.js & Three.js
 *
 * Architecture:
 *  1.  Constants & Color Palette System
 *  2.  Application State (Campus + Vehicle Telemetry)
 *  3.  Global Cyber Tooltip Helpers
 *  4.  Data Loading, Cleaning & Validation
 *  5.  Preset Filters & Sidebar Controls
 *  6.  Vehicle ID Filtering & Selection System
 *  7.  Filter Application & Campus KPI Calculations
 *  8.  Large-Scale 3D Dual-Hub EV Charging Campus (Three.js WebGL)
 *  9.  3D Electric Vehicle Simulation Studio & Live-Style Playback (Three.js WebGL)
 * 10.  Vehicle 3D Battery Pack & Telemetry HUD System
 * 11.  Vehicle-Specific 3D KPI Cards (7 Cards)
 * 12.  Vehicle Interactive Session Timeline & Carousel
 * 13.  Vehicle-Specific D3 Analytics Charts (4 Visualizations)
 * 14.  CSS 3D Perspective Tilt System
 * 15.  Campus-Level D3 Charts (8 Visualizations)
 * 16.  Synthesized Grid Intelligence & Heuristics
 * 17.  UI State Handlers & Fullscreen Controls
 * 18.  Bootstrap & Initialization
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   1. CONSTANTS & COLOR PALETTE SYSTEM
═══════════════════════════════════════════════════════ */
const DAYS_OF_WEEK   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const HOURS_OF_DAY   = Array.from({ length: 24 }, (_, i) => i);
const TYPE_LABELS    = { '0': 'Slow AC', '1': 'Fast DC' };

// Enterprise Master Palette
const COLOR_CYAN     = '#00E5FF';   // Electric Cyan - Interactive highlights & energy flows
const COLOR_VIOLET   = '#A855F7';   // Vibrant Violet - Analytics & secondary accents
const COLOR_AC       = '#39FF88';   // Electric Green - Slow AC Hub identity & positive metrics
const COLOR_DC       = '#FF9F43';   // Amber Orange - Fast DC Hub identity & energy intensity
const COLOR_PINK     = '#F472B6';   // Neon Pink - Vehicle identity & regression lines
const COLOR_BG_VOID  = '#0b0f19';   // Deep void
const COLOR_BG_NAVY  = '#111827';   // Midnight Navy

const TYPE_COLOR = d => d === 'Slow AC' ? COLOR_AC : COLOR_DC;

// Custom High-Contrast Cyber Heatmap Palette
const heatColor = d3.scaleSequential()
  .interpolator(d3.interpolateTurbo);

const FMT_NUM   = d3.format(',');
const FMT_FLOAT = d3.format(',.1f');
const FMT_PCT   = d3.format('.1%');
const FMT_DATE  = d3.timeFormat('%d %b %Y');

const REQUIRED_COLS = [
  'UserID','ChargerID','ChargerCompany','Location','ChargerType',
  'StartDay','StartTime','EndDay','EndTime',
  'StartDatetime','EndDatetime','Duration','Demand'
];

const DEFAULT_CSV = 'data/ChargingRecords.csv';
const DEFAULT_CSV_FALLBACKS = ['data/ChargingRecords(1).csv', 'ChargingRecords.csv'];

/* ═══════════════════════════════════════════════════════
   2. APPLICATION STATE
═══════════════════════════════════════════════════════ */
const state = {
  rawData              : [],     // All 72,856 parsed and cleaned rows
  filteredData         : [],     // Rows matching current filter parameters
  totalLoaded          : 0,
  parseErrors          : 0,
  excludedDuration     : 0,
  selectedStation      : null,   // Selected Station ID in 3D scene or matrix
  campusChargers       : [],     // Unique hardware chargers directory
  
  // Vehicle Simulation State
  selectedVehicle      : null,   // Active Vehicle ID (e.g. '95', '31')
  selectedSessionIndex : 0,      // Current session index for active vehicle
  vehicleSessions      : [],     // All sessions for the selected vehicle sorted by date
  vehiclePlayback      : {
    isPlaying     : true,
    progress      : 0.0,         // 0.0 to 1.0
    speed         : 1,           // 1x, 2x, 5x
    durationMs    : 8000,        // 8 seconds per full session simulation
    lastTimestamp : 0,
    cableConnected: true,
  },
  vehiclePaintColor    : 0x00E5FF, // Default Electric Cyan
};

/* ═══════════════════════════════════════════════════════
   3. GLOBAL CYBER TOOLTIP HELPERS
═══════════════════════════════════════════════════════ */
const tooltipEl = document.getElementById('globalTooltip');

function showTooltip(event, html) {
  if (!tooltipEl) return;
  tooltipEl.innerHTML = html;
  tooltipEl.classList.add('visible');
  tooltipEl.setAttribute('aria-hidden', 'false');
  moveTooltip(event);
}

function moveTooltip(event) {
  if (!tooltipEl) return;
  const margin = 16;
  const tw = tooltipEl.offsetWidth  || 240;
  const th = tooltipEl.offsetHeight || 130;
  let x = event.clientX + margin;
  let y = event.clientY + margin;
  if (x + tw > window.innerWidth - 12) x = event.clientX - tw - margin;
  if (y + th > window.innerHeight - 12) y = event.clientY - th - margin;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top  = y + 'px';
}

function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.classList.remove('visible');
  tooltipEl.setAttribute('aria-hidden', 'true');
}

function buildTooltipHTML(title, rows) {
  const titleDiv = `<div class="tooltip-title">${esc(title)}</div>`;
  const rowsHTML = rows.map(r =>
    `<div class="tooltip-row">
       <span class="tooltip-label">${esc(r.label)}</span>
       <span class="tooltip-value">${esc(String(r.value))}</span>
     </div>`
  ).join('');
  return titleDiv + rowsHTML;
}

function esc(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════
   4. DATA LOADING & PARSING
═══════════════════════════════════════════════════════ */
const parseDateTime = d3.timeParse('%d-%m-%Y %H:%M');

function cleanData(raw) {
  let parseErrors = 0;
  let excludedDur = 0;

  const cleaned = raw.map((r, idx) => {
    const row = {};
    for (const k of Object.keys(r)) {
      row[k.replace(/^\uFEFF/, '').trim()] = r[k];
    }

    const chargerType = String(row.ChargerType ?? '').trim();
    const typeLabel   = TYPE_LABELS[chargerType] ?? chargerType;

    const duration = parseFloat(row.Duration);
    const demand   = parseFloat(row.Demand);
    const validDur = isFinite(duration) && duration > 0;
    const validDem = isFinite(demand)   && demand   >= 0;

    const dtRaw    = String(row.StartDatetime ?? '').trim();
    const dtParsed = parseDateTime(dtRaw);
    if (!dtParsed && dtRaw) parseErrors++;
    if (!validDur) excludedDur++;

    return {
      userID        : String(row.UserID        ?? '').trim(),
      chargerID     : String(row.ChargerID     ?? '').trim(),
      chargerCompany: String(row.ChargerCompany ?? '').trim(),
      location      : String(row.Location      ?? '').trim(),
      chargerType   : typeLabel,
      startDay      : String(row.StartDay      ?? '').trim(),
      startTime     : String(row.StartTime     ?? '').trim(),
      endDay        : String(row.EndDay        ?? '').trim(),
      endTime       : String(row.EndTime       ?? '').trim(),
      startDatetime : dtParsed,
      endDatetime   : parseDateTime(String(row.EndDatetime ?? '').trim()),
      duration      : validDur ? duration : null,
      demand        : validDem ? demand   : null,
      _rowIndex     : idx,
      _validDur     : validDur,
    };
  });

  return { cleaned, parseErrors, excludedDur };
}

function validateColumns(rawRow) {
  const keys = Object.keys(rawRow).map(k => k.replace(/^\uFEFF/, '').trim());
  return REQUIRED_COLS.filter(c => !keys.includes(c));
}

function loadData(csvText) {
  showLoading('Synthesizing campus & vehicle telemetry stream...');
  try {
    const raw = d3.csvParse(csvText);
    if (!raw || raw.length === 0) {
      showError('The CSV file appears to be empty.');
      hideLoading();
      return;
    }
    const missing = validateColumns(raw[0]);
    if (missing.length > 0) {
      showError(`Missing required columns: ${missing.join(', ')}`);
      hideLoading();
      return;
    }

    const { cleaned, parseErrors, excludedDur } = cleanData(raw);
    state.rawData          = cleaned;
    state.totalLoaded      = raw.length;
    state.parseErrors      = parseErrors;
    state.excludedDuration = excludedDur;

    updateDataQualityPanel();
    setupFilters();
    initVehicleFilterSystem();
    applyFilters();
    setStatusOK(`${FMT_NUM(raw.length)} telemetry records loaded`);
    showDashboard();

    // Initialize 3D Campus
    initThreeCampus();

    // Initialize 3D Electric Vehicle Simulation Studio
    initThreeVehicle();

    // Default to high-activity Vehicle #95 for immediate visual demonstration
    selectVehicleById('95', true);
  } catch (e) {
    console.error(e);
    showError('Failed to parse CSV dataset: ' + e.message);
  }
  hideLoading();
}

function tryLoadDefaultCSV() {
  setStatusLoading('Connecting to telemetry stream...');
  const candidates = [DEFAULT_CSV, ...DEFAULT_CSV_FALLBACKS];
  let attempt = 0;

  function loadNextCandidate() {
    if (attempt >= candidates.length) {
      setStatusIdle('Telemetry stream offline. Please upload a CSV dataset.');
      hideLoading();
      return;
    }

    const path = candidates[attempt];
    d3.text(path)
      .then(text => loadData(text))
      .catch(() => {
        attempt += 1;
        loadNextCandidate();
      });
  }

  loadNextCandidate();
}

document.getElementById('csvUpload')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  setStatusLoading(`Reading ${file.name}…`);
  const reader = new FileReader();
  reader.onload = evt => loadData(evt.target.result);
  reader.onerror = () => showError('Failed to read file from disk.');
  reader.readAsText(file, 'UTF-8');
  this.value = '';
});

/* ═══════════════════════════════════════════════════════
   5. FILTER SETUP & CAMPUS CONTROLS
═══════════════════════════════════════════════════════ */
function setupFilters() {
  const data = state.rawData;

  populateSelect('filterLocation',
    [...new Set(data.map(d => d.location))].filter(Boolean).sort(), 'All Locations');
  populateSelect('filterCompany',
    [...new Set(data.map(d => d.chargerCompany))].filter(Boolean).sort(), 'All Operators');
  populateSelect('filterCharger',
    [...new Set(data.map(d => d.chargerID))].filter(Boolean).sort((a,b) => +a - +b || a.localeCompare(b)), 'All Stations (2,119)');

  const validDates = data.map(d => d.startDatetime).filter(Boolean);
  if (validDates.length) {
    const [minD, maxD] = d3.extent(validDates);
    document.getElementById('filterStart').value = fmtInputDate(minD);
    document.getElementById('filterEnd').value   = fmtInputDate(maxD);
    
    const tickerWindow = document.getElementById('tickerWindow');
    if (tickerWindow) {
      tickerWindow.textContent = `${d3.timeFormat('%b %Y')(minD).toUpperCase()} — ${d3.timeFormat('%b %Y')(maxD).toUpperCase()}`;
    }
  }

  const distinctVehicles = new Set(data.map(d => d.userID)).size;
  const tickerVehicles = document.getElementById('tickerVehicles');
  if (tickerVehicles) tickerVehicles.textContent = `${FMT_NUM(distinctVehicles)} VEHICLES`;

  const tickerRecs = document.getElementById('tickerRecords');
  if (tickerRecs) tickerRecs.textContent = `${FMT_NUM(data.length)} RECORDS`;
}

function populateSelect(id, options, defaultLabel = 'All') {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${defaultLabel}</option>`;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    sel.appendChild(o);
  });
}

function fmtInputDate(d) {
  if (!d) return '';
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Preset Quick Filter Buttons
document.querySelectorAll('.preset-pill-group:not(.quick-vehicles-pills) .preset-pill').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.preset-pill-group:not(.quick-vehicles-pills) .preset-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');

    const preset = this.getAttribute('data-preset');
    resetFilterInputsOnly();

    if (preset === 'fast-dc') {
      document.getElementById('filterType').value = 'Fast DC';
      focusCampusZone('dc');
    } else if (preset === 'slow-ac') {
      document.getElementById('filterType').value = 'Slow AC';
      focusCampusZone('ac');
    } else if (preset === 'hotels') {
      document.getElementById('filterLocation').value = 'hotel';
    } else if (preset === 'public') {
      document.getElementById('filterLocation').value = 'public area';
    } else {
      focusCampusZone('hub');
    }
    applyFilters();
  });
});

function resetFilterInputsOnly() {
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterCompany').value  = '';
  document.getElementById('filterType').value     = '';
  document.getElementById('filterCharger').value  = '';
  const validDates = state.rawData.map(d => d.startDatetime).filter(Boolean);
  if (validDates.length) {
    const [minD, maxD] = d3.extent(validDates);
    document.getElementById('filterStart').value = fmtInputDate(minD);
    document.getElementById('filterEnd').value   = fmtInputDate(maxD);
  }
}

function resetFilters() {
  document.querySelectorAll('.preset-pill-group:not(.quick-vehicles-pills) .preset-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.preset-pill[data-preset="all"]')?.classList.add('active');
  resetFilterInputsOnly();
  state.selectedStation = null;
  closeStationHologram();
  applyFilters();
  focusCampusZone('hub');
}

document.getElementById('resetBtn')?.addEventListener('click', resetFilters);

['filterLocation','filterCompany','filterType','filterCharger','filterStart','filterEnd'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => {
    if (id === 'filterCharger') {
      const cid = document.getElementById('filterCharger').value;
      if (cid) {
        selectStationById(cid, true);
      } else {
        closeStationHologram();
      }
    }
    applyFilters();
  });
});

/* ═══════════════════════════════════════════════════════
   6. VEHICLE ID FILTERING & SELECTION SYSTEM
═══════════════════════════════════════════════════════ */
function initVehicleFilterSystem() {
  const data = state.rawData;
  const userRollup = d3.rollup(data, v => v.length, d => d.userID);

  // Sort: top frequent recurring users first (excluding '0' or labeling '0' as Guest/Unregistered)
  const rankedUsers = [...userRollup.entries()]
    .sort((a,b) => b[1] - a[1]);

  const sel = document.getElementById('filterVehicleSelect');
  if (sel) {
    sel.innerHTML = '<option value="">All Vehicles</option>';

    // Top active recurring vehicles group
    const topGroup = document.createElement('optgroup');
    topGroup.label = '⚡ Top Recurring Vehicles';
    rankedUsers.slice(0, 30).forEach(([uid, count]) => {
      const opt = document.createElement('option');
      opt.value = uid;
      opt.textContent = uid === '0' 
        ? `Vehicle #0 (Guest / Unregistered - ${FMT_NUM(count)} sess)`
        : `Vehicle #${uid} (${FMT_NUM(count)} sessions)`;
      topGroup.appendChild(opt);
    });
    sel.appendChild(topGroup);

    // Remaining vehicles group
    const allGroup = document.createElement('optgroup');
    allGroup.label = '🚗 All Vehicle Fleet';
    const remaining = rankedUsers.slice(30).sort((a,b) => +a[0] - +b[0] || a[0].localeCompare(b[0]));
    remaining.forEach(([uid, count]) => {
      const opt = document.createElement('option');
      opt.value = uid;
      opt.textContent = `Vehicle #${uid} (${count} sess)`;
      allGroup.appendChild(opt);
    });
    sel.appendChild(allGroup);

    sel.addEventListener('change', function() {
      if (this.value) {
        selectVehicleById(this.value, true);
      } else {
        resetVehicleSelection();
      }
    });
  }

  // Quick switch pills
  document.querySelectorAll('.quick-vehicles-pills .preset-pill').forEach(btn => {
    btn.addEventListener('click', function() {
      const vid = this.getAttribute('data-vehicle');
      document.querySelectorAll('.quick-vehicles-pills .preset-pill').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      selectVehicleById(vid, true);
    });
  });

  // Search input with instant autocomplete
  const searchInput = document.getElementById('filterVehicleSearch');
  searchInput?.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    if (!q) return;
    const match = rankedUsers.find(([uid]) => uid.toLowerCase().startsWith(q) || uid.toLowerCase() === q);
    if (match) {
      if (sel) sel.value = match[0];
      selectVehicleById(match[0], true);
    }
  });

  // Session selector dropdown
  document.getElementById('filterVehicleSessionSelect')?.addEventListener('change', function() {
    selectVehicleSession(+this.value);
  });

  // Reset Vehicle Filter button
  document.getElementById('resetVehicleBtn')?.addEventListener('click', resetVehicleSelection);

  // Filter dashboard by this vehicle button
  document.getElementById('filterByThisVehicleBtn')?.addEventListener('click', function() {
    if (state.selectedVehicle !== null) {
      filterDashboardByVehicle(state.selectedVehicle);
    }
  });
}

function selectVehicleById(vehicleId, autoPlay = true) {
  state.selectedVehicle = String(vehicleId);

  // Sync Select Dropdown & Search Input
  const sel = document.getElementById('filterVehicleSelect');
  if (sel && sel.value !== state.selectedVehicle) sel.value = state.selectedVehicle;
  
  const searchInput = document.getElementById('filterVehicleSearch');
  if (searchInput && searchInput.value !== state.selectedVehicle) {
    searchInput.value = state.selectedVehicle;
  }

  // Highlight pill if present
  document.querySelectorAll('.quick-vehicles-pills .preset-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-vehicle') === state.selectedVehicle);
  });

  // Show Reset Vehicle button and Session dropdown in sidebar
  const resetBtn = document.getElementById('resetVehicleBtn');
  if (resetBtn) resetBtn.style.display = 'block';
  
  const sessionGroup = document.getElementById('vehicleSessionGroup');
  if (sessionGroup) sessionGroup.style.display = 'block';

  // Extract all sessions for this vehicle sorted chronologically
  const vSessions = state.rawData.filter(d => d.userID === state.selectedVehicle)
    .sort((a,b) => (a.startDatetime || 0) - (b.startDatetime || 0));

  state.vehicleSessions = vSessions;
  state.selectedSessionIndex = Math.max(0, vSessions.length - 1); // Default to most recent session

  // Populate Vehicle Session Selector
  const sessionSel = document.getElementById('filterVehicleSessionSelect');
  if (sessionSel) {
    sessionSel.innerHTML = '';
    vSessions.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const dateStr = s.startDatetime ? FMT_DATE(s.startDatetime) : s.startDay;
      opt.textContent = `Session ${idx + 1}: ${dateStr} @ St #${s.chargerID} (${s.chargerType}, ${FMT_FLOAT(s.demand || 0)} kWh)`;
      sessionSel.appendChild(opt);
    });
    sessionSel.value = state.selectedSessionIndex;
  }

  // Update Vehicle KPIs
  updateVehicleKPIs(vSessions);

  // Update Interactive Session Timeline
  renderVehicleTimeline(vSessions);

  // Update Vehicle D3 Charts
  drawVehicleAnalyticsCharts(vSessions);

  // Update Active Session Details & 3D Playback
  selectVehicleSession(state.selectedSessionIndex, autoPlay);
}

function selectVehicleSession(sessionIndex, autoPlay = true) {
  if (!state.vehicleSessions || state.vehicleSessions.length === 0) return;
  state.selectedSessionIndex = Math.max(0, Math.min(sessionIndex, state.vehicleSessions.length - 1));

  const session = state.vehicleSessions[state.selectedSessionIndex];
  if (!session) return;

  // Sync Session Dropdown
  const sessionSel = document.getElementById('filterVehicleSessionSelect');
  if (sessionSel) sessionSel.value = state.selectedSessionIndex;

  // Update Timeline Chip Highlight
  document.querySelectorAll('.timeline-session-chip').forEach(chip => {
    chip.classList.toggle('active', +chip.getAttribute('data-session-idx') === state.selectedSessionIndex);
  });

  // Scroll active timeline chip into view smoothly
  const activeChip = document.querySelector(`.timeline-session-chip[data-session-idx="${state.selectedSessionIndex}"]`);
  activeChip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  // Update HUD Readouts
  const vIdText = session.userID === '0' ? '#0 (Guest)' : `#${session.userID}`;
  document.getElementById('vStageVehicleId').textContent = `VEHICLE ${vIdText}`;
  document.getElementById('vStageChargerInfo').textContent = `Station #${session.chargerID} • ${session.chargerType} (${session.location})`;
  document.getElementById('vSessionBadge').textContent = `SESSION ${state.selectedSessionIndex + 1} OF ${state.vehicleSessions.length}`;
  document.getElementById('vMatVehicleId').textContent = vIdText;
  document.getElementById('vMatChargerId').textContent = `Station #${session.chargerID}`;
  document.getElementById('vBtnIdText').textContent = session.userID;

  const typePill = document.getElementById('vMatChargerType');
  if (typePill) {
    typePill.innerHTML = session.chargerType === 'Fast DC'
      ? '<span class="type-pill-dc">Fast DC Superhub</span>'
      : '<span class="type-pill-ac">Slow AC Level 2</span>';
  }

  document.getElementById('vMatLocation').textContent = session.location || '—';
  document.getElementById('vMatDate').textContent = session.startDatetime ? FMT_DATE(session.startDatetime) : session.startDay;
  document.getElementById('vMatTimeWindow').textContent = `${session.startTime} → ${session.endTime}`;
  document.getElementById('vMatDuration').textContent = `${FMT_FLOAT(session.duration || 0)} min`;
  document.getElementById('vMatEnergy').textContent = `${FMT_FLOAT(session.demand || 0)} kWh`;

  // Average Calculated Power (kW) = Energy (kWh) / (Duration (min) / 60)
  const durationHours = (session.duration || 0) > 0 ? (session.duration / 60) : 0;
  const avgKw = durationHours > 0 ? (session.demand || 0) / durationHours : 0;
  document.getElementById('vMatPower').textContent = `${FMT_FLOAT(avgKw)} kW`;
  document.getElementById('batAvgPower').textContent = `${FMT_FLOAT(avgKw)} kW`;

  // Update 3D Vehicle Charger Type Styling (Fast DC vs Slow AC)
  updateVehicleStationModel(session.chargerType);

  // Reset Playback Progress
  state.vehiclePlayback.progress = 0.0;
  state.vehiclePlayback.isPlaying = autoPlay;
  updatePlaybackHUD();

  // Highlight Charger in 3D Campus
  highlightCampusStation(session.chargerID);
}

function resetVehicleSelection() {
  state.selectedVehicle = null;
  state.vehicleSessions = [];
  
  const sel = document.getElementById('filterVehicleSelect');
  if (sel) sel.value = '';

  const searchInput = document.getElementById('filterVehicleSearch');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('.quick-vehicles-pills .preset-pill').forEach(p => p.classList.remove('active'));

  const resetBtn = document.getElementById('resetVehicleBtn');
  if (resetBtn) resetBtn.style.display = 'none';

  const sessionGroup = document.getElementById('vehicleSessionGroup');
  if (sessionGroup) sessionGroup.style.display = 'none';

  // Restore dashboard
  applyFilters();
}

function filterDashboardByVehicle(vehicleId) {
  state.filteredData = state.rawData.filter(d => d.userID === vehicleId);
  updateKPIs();
  updateAllCharts();
  updateInsights();
  update3DCampusEntities();
  showToast(`Dashboard filtered to Vehicle #${vehicleId} (${state.filteredData.length} records)`);
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.style.background = 'rgba(0, 229, 255, 0.95)';
  toast.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  toast.textContent = '⚡ ' + msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ═══════════════════════════════════════════════════════
   7. FILTER APPLICATION & CAMPUS KPI CALCULATIONS
═══════════════════════════════════════════════════════ */
function applyFilters() {
  const loc     = document.getElementById('filterLocation').value;
  const company = document.getElementById('filterCompany').value;
  const type    = document.getElementById('filterType').value;
  const charger = document.getElementById('filterCharger').value;
  const startV  = document.getElementById('filterStart').value;
  const endV    = document.getElementById('filterEnd').value;

  let startDate = startV ? new Date(startV + 'T00:00:00') : null;
  let endDate   = endV   ? new Date(endV   + 'T23:59:59') : null;

  if (startDate && endDate && startDate > endDate) {
    showError('Start date cannot be after end date.');
    return;
  }

  state.filteredData = state.rawData.filter(d => {
    if (state.selectedVehicle && d.userID !== state.selectedVehicle) return false;
    if (loc     && d.location       !== loc)     return false;
    if (company && d.chargerCompany !== company)  return false;
    if (type    && d.chargerType    !== type)     return false;
    if (charger && d.chargerID      !== charger)  return false;
    if (d.startDatetime) {
      if (startDate && d.startDatetime < startDate) return false;
      if (endDate   && d.startDatetime > endDate)   return false;
    }
    return true;
  });

  if (state.filteredData.length === 0) {
    showEmptyFilterMessage();
  } else {
    hideEmptyFilterMessage();
    updateKPIs();
    updateAllCharts();
    updateInsights();
    update3DCampusEntities();
  }
}

function updateKPIs() {
  const data = state.filteredData;

  const totalStations = new Set(data.map(d => d.chargerID)).size;
  document.getElementById('kpiStations').textContent = FMT_NUM(totalStations);

  document.getElementById('kpiSessions').textContent = FMT_NUM(data.length);

  const totalEnergy = d3.sum(data, d => d.demand ?? 0);
  document.getElementById('kpiEnergy').textContent = FMT_NUM(Math.round(totalEnergy));

  const durations = data.map(d => d.duration).filter(v => v !== null && v > 0);
  const avgDur = durations.length ? d3.mean(durations) : 0;
  document.getElementById('kpiAvgDur').textContent = FMT_FLOAT(avgDur);

  const byCharger = d3.rollup(data, v => v.length, d => d.chargerID);
  const mostUsed = [...byCharger.entries()].sort((a,b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
  if (mostUsed) {
    document.getElementById('kpiMostUsedCharger').textContent = `ID #${mostUsed[0]}`;
    document.getElementById('kpiMostUsedCount').textContent = `${FMT_NUM(mostUsed[1])} sessions`;
  } else {
    document.getElementById('kpiMostUsedCharger').textContent = '—';
    document.getElementById('kpiMostUsedCount').textContent = 'sessions';
  }

  document.getElementById('kpiActive').textContent = FMT_NUM(totalStations);

  const byDay = d3.rollup(
    data,
    v => v.length,
    d => d.startDatetime ? d3.timeDay(d.startDatetime).toISOString() : 'unknown'
  );
  if (byDay.size > 0) {
    const [peakDayKey, peakCount] = [...byDay.entries()].reduce(
      (best, cur) => cur[1] > best[1] ? cur : best
    );
    const peakDate = peakDayKey !== 'unknown' ? new Date(peakDayKey) : null;
    document.getElementById('kpiPeakDay').textContent = peakDate ? FMT_DATE(peakDate) : 'Unknown';
    document.getElementById('kpiPeakDayCount').textContent = `${FMT_NUM(peakCount)} sessions`;
  }

  const totalAcChargers = new Set(data.filter(d => d.chargerType === 'Slow AC').map(d => d.chargerID)).size;
  const totalDcChargers = new Set(data.filter(d => d.chargerType === 'Fast DC').map(d => d.chargerID)).size;
  
  const totalEl = document.getElementById('campusTotalChargers');
  const acEl    = document.getElementById('campusAcChargers');
  const dcEl    = document.getElementById('campusDcChargers');
  if (totalEl) totalEl.textContent = `${FMT_NUM(totalStations)} CHARGERS`;
  if (acEl)    acEl.textContent    = `${FMT_NUM(totalAcChargers)} STATIONS`;
  if (dcEl)    dcEl.textContent    = `${FMT_NUM(totalDcChargers)} STATIONS`;
}

function updateAllCharts() {
  drawLineChart();
  drawChargerTypeBarChart();
  drawDonutChart();
  drawScatterPlot();
  drawHeatMap();
  drawTopStationsChart();
  drawStationTable();
  drawLocationChart();
}

/* ═══════════════════════════════════════════════════════
   8. LARGE-SCALE 3D DUAL-HUB CHARGING CAMPUS (THREE.JS)
═══════════════════════════════════════════════════════ */
let hubScene, hubCamera, hubRenderer, hubControls;
let campusGroup = null;
let stationMeshes = [];
let raycaster, mouseCoords;
let isCampusInitialized = false;
let isAutoRotating = false;

function initThreeCampus() {
  const container = document.getElementById('threeCanvasContainer');
  if (!container || isCampusInitialized || !window.THREE) return;

  const w = container.clientWidth || 800;
  const h = container.clientHeight || 560;

  hubScene = new THREE.Scene();
  hubScene.background = new THREE.Color(0x0b0f19);
  // Reduced fog density from 0.016 to 0.006 — was making scene too dark and invisible
  hubScene.fog = new THREE.FogExp2(0x0b0f19, 0.006);

  hubCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  hubCamera.position.set(0, 36, 44);

  hubRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  hubRenderer.setSize(w, h);
  hubRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  hubRenderer.shadowMap.enabled = true;
  hubRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  hubRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  hubRenderer.toneMappingExposure = 1.25;

  container.innerHTML = '';
  container.appendChild(hubRenderer.domElement);

  if (THREE.OrbitControls) {
    hubControls = new THREE.OrbitControls(hubCamera, hubRenderer.domElement);
    hubControls.enableDamping = true;
    hubControls.dampingFactor = 0.05;
    hubControls.maxPolarAngle = Math.PI / 2 - 0.04;
    hubControls.minDistance = 8;
    hubControls.maxDistance = 90;
    hubControls.target.set(0, 1.8, 0);
  }

  setupCampusLighting();
  buildCampusInfrastructure();

  raycaster = new THREE.Raycaster();
  mouseCoords = new THREE.Vector2();

  container.addEventListener('mousemove', onCampusMouseMove);
  container.addEventListener('click', onCampusClick);
  window.addEventListener('resize', onCampusResize);

  setupCampusCameraControls();
  isCampusInitialized = true;
  update3DCampusEntities();
  animateCampus();
}

function setupCampusLighting() {
  // Brighter ambient light - white-tinted for better scene visibility
  const ambientLight = new THREE.AmbientLight(0x3a4d6b, 3.5);
  hubScene.add(ambientLight);

  // Hemisphere light for natural sky/ground gradient
  const hemiLight = new THREE.HemisphereLight(0x1a3560, 0x0b1525, 2.5);
  hubScene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  sunLight.position.set(25, 45, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.bias = -0.0004;
  hubScene.add(sunLight);

  const acPointLight = new THREE.PointLight(0x39FF88, 4.0, 65);
  acPointLight.position.set(-20, 10, 0);
  hubScene.add(acPointLight);

  const dcPointLight = new THREE.PointLight(0xFF9F43, 4.0, 65);
  dcPointLight.position.set(20, 10, 0);
  hubScene.add(dcPointLight);

  const centerPointLight = new THREE.PointLight(0x00E5FF, 3.5, 50);
  centerPointLight.position.set(0, 8, 0);
  hubScene.add(centerPointLight);
}

function buildCampusInfrastructure() {
  const groundGeo = new THREE.PlaneGeometry(160, 160);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0c1322,
    roughness: 0.45,
    metalness: 0.6,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  hubScene.add(ground);

  const gridHelper = new THREE.GridHelper(140, 70, 0x1f293d, 0x111c30);
  gridHelper.position.y = 0.02;
  hubScene.add(gridHelper);

  const roadGeo = new THREE.PlaneGeometry(10, 80);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x080c14, roughness: 0.8 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, 0);
  road.receiveShadow = true;
  hubScene.add(road);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  const line1 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 78), lineMat);
  line1.rotation.x = -Math.PI / 2;
  line1.position.set(-0.25, 0.04, 0);
  hubScene.add(line1);

  const line2 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 78), lineMat);
  line2.rotation.x = -Math.PI / 2;
  line2.position.set(0.25, 0.04, 0);
  hubScene.add(line2);

  const acApronGeo = new THREE.PlaneGeometry(36, 68);
  const acApronMat = new THREE.MeshStandardMaterial({ color: 0x0f1828, roughness: 0.5 });
  const acApron = new THREE.Mesh(acApronGeo, acApronMat);
  acApron.rotation.x = -Math.PI / 2;
  acApron.position.set(-24, 0.03, 0);
  acApron.receiveShadow = true;
  hubScene.add(acApron);

  const dcApronGeo = new THREE.PlaneGeometry(36, 68);
  const dcApronMat = new THREE.MeshStandardMaterial({ color: 0x0f1828, roughness: 0.5 });
  const dcApron = new THREE.Mesh(dcApronGeo, dcApronMat);
  dcApron.rotation.x = -Math.PI / 2;
  dcApron.position.set(24, 0.03, 0);
  dcApron.receiveShadow = true;
  hubScene.add(dcApron);

  buildHubCanopy(-24, 0, 0x39FF88);
  buildHubCanopy(24, 0, 0xFF9F43);
}

function buildHubCanopy(posX, posZ, themeColorHex) {
  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(posX, 0, posZ);

  const colGeo = new THREE.CylinderGeometry(0.25, 0.35, 9, 16);
  const colMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.2 });

  const colOffsets = [
    [-15, -26], [0, -26], [15, -26],
    [-15, 26],  [0, 26],  [15, 26]
  ];

  colOffsets.forEach(([ox, oz]) => {
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(ox, 4.5, oz);
    col.castShadow = true;
    canopyGroup.add(col);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.04, 16, 32),
      new THREE.MeshBasicMaterial({ color: themeColorHex })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(ox, 0.08, oz);
    canopyGroup.add(ring);
  });

  const roofGeo = new THREE.BoxGeometry(34, 0.2, 56);
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    metalness: 0.7,
    roughness: 0.15,
    transmission: 0.65,
    transparent: true,
    opacity: 0.85,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 9.2, 0);
  roof.castShadow = true;
  canopyGroup.add(roof);

  const edgeGeo = new THREE.BoxGeometry(34.4, 0.15, 0.15);
  const edgeMat = new THREE.MeshBasicMaterial({ color: themeColorHex });
  
  const edgeFront = new THREE.Mesh(edgeGeo, edgeMat);
  edgeFront.position.set(0, 9.3, 28);
  canopyGroup.add(edgeFront);

  const edgeBack = new THREE.Mesh(edgeGeo, edgeMat);
  edgeBack.position.set(0, 9.3, -28);
  canopyGroup.add(edgeBack);

  hubScene.add(canopyGroup);
}

function update3DCampusEntities() {
  if (!hubScene) return;

  if (campusGroup) {
    hubScene.remove(campusGroup);
    stationMeshes = [];
  }

  campusGroup = new THREE.Group();

  const byStation = d3.rollup(
    state.filteredData,
    v => ({
      stationID : v[0].chargerID,
      type      : v[0].chargerType,
      company   : v[0].chargerCompany,
      location  : v[0].location,
      sessions  : v.length,
      energy    : d3.sum(v, d => d.demand ?? 0),
      avgDur    : d3.mean(v.filter(d => d.duration > 0), d => d.duration) ?? 0,
    }),
    d => d.chargerID
  );

  const allStations = [...byStation.values()];
  state.campusChargers = allStations;

  const acList = allStations.filter(s => s.type === 'Slow AC')
    .sort((a,b) => b.sessions - a.sessions);
  const dcList = allStations.filter(s => s.type === 'Fast DC')
    .sort((a,b) => b.sessions - a.sessions);

  populateHubBays(acList, -24, 0x39FF88, 'Slow AC');
  populateHubBays(dcList, 24, 0xFF9F43, 'Fast DC');

  hubScene.add(campusGroup);
}

function populateHubBays(stationList, centerHubX, themeHex, hubType) {
  const colSpacing = 9.5;
  const rowSpacing = 6.2;
  const numCols = 3;
  const numRows = 8;
  const startX = centerHubX - ((numCols - 1) * colSpacing) / 2;
  const startZ = -((numRows - 1) * rowSpacing) / 2;

  let bayIdx = 0;
  for (let c = 0; c < numCols; c++) {
    for (let r = 0; r < numRows; r++) {
      const posX = startX + c * colSpacing;
      const posZ = startZ + r * rowSpacing;

      const stationData = stationList[bayIdx] || {
        stationID : `DEMO-${hubType === 'Slow AC' ? 'AC' : 'DC'}-${bayIdx + 1}`,
        type      : hubType,
        company   : '1',
        location  : 'Campus Reserve',
        sessions  : 0,
        energy    : 0,
        avgDur    : 0,
      };

      const pillar = createChargingBayPillar(stationData, posX, posZ, themeHex, c === 0 ? Math.PI / 2 : (c === 2 ? -Math.PI / 2 : 0));
      campusGroup.add(pillar);
      bayIdx++;
    }
  }
}

function createChargingBayPillar(data, x, z, themeHex, rotY) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  group.userData = { stationData: data };

  const stallMat = new THREE.MeshBasicMaterial({ color: themeHex, transparent: true, opacity: 0.65 });
  const stallBorder = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.5, 4), stallMat);
  stallBorder.rotation.x = -Math.PI / 2;
  stallBorder.rotation.z = Math.PI / 4;
  stallBorder.scale.set(1.4, 1.1, 1);
  stallBorder.position.y = 0.05;
  group.add(stallBorder);

  const curbGeo = new THREE.BoxGeometry(2.2, 0.16, 0.35);
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
  const curb = new THREE.Mesh(curbGeo, curbMat);
  curb.position.set(0, 0.08, -1.8);
  curb.castShadow = true;
  group.add(curb);

  const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.3, 16);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.2 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.2;
  base.castShadow = true;
  group.add(base);

  const isFastDC = data.type === 'Fast DC';
  const towerHeight = isFastDC ? 3.4 : 2.8;
  const towerWidth  = isFastDC ? 0.95 : 0.75;
  const towerDepth  = isFastDC ? 0.65 : 0.5;

  const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x162238,
    metalness: 0.85,
    roughness: 0.2
  });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.y = towerHeight / 2 + 0.3;
  tower.castShadow = true;
  group.add(tower);

  const crownGeo = new THREE.BoxGeometry(towerWidth + 0.04, 0.18, towerDepth + 0.04);
  const crownMat = new THREE.MeshBasicMaterial({ color: themeHex });
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.position.y = towerHeight + 0.35;
  group.add(crown);

  const hitGeo = new THREE.BoxGeometry(2.2, towerHeight + 1.0, 2.2);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.y = (towerHeight + 1.0) / 2;
  hitMesh.userData = { parentGroup: group, stationData: data };
  group.add(hitMesh);
  stationMeshes.push(hitMesh);

  const pLight = new THREE.PointLight(themeHex, 0.75, 4.5);
  pLight.position.set(0, towerHeight + 0.2, 0.4);
  group.add(pLight);

  return group;
}

function highlightCampusStation(stationID) {
  if (!campusGroup) return;
  campusGroup.children.forEach(child => {
    if (child.userData?.stationData?.stationID === stationID) {
      child.scale.set(1.15, 1.15, 1.15);
    } else {
      child.scale.set(1.0, 1.0, 1.0);
    }
  });
}

function setupCampusCameraControls() {
  document.getElementById('viewHubBtn')?.addEventListener('click', () => {
    setActiveHubBtn('viewHubBtn');
    focusCampusZone('hub');
  });

  document.getElementById('viewAcHubBtn')?.addEventListener('click', () => {
    setActiveHubBtn('viewAcHubBtn');
    focusCampusZone('ac');
  });

  document.getElementById('viewDcHubBtn')?.addEventListener('click', () => {
    setActiveHubBtn('viewDcHubBtn');
    focusCampusZone('dc');
  });

  document.getElementById('viewStationFocusBtn')?.addEventListener('click', () => {
    setActiveHubBtn('viewStationFocusBtn');
    if (state.selectedStation) {
      focusStationIn3D(state.selectedStation);
    } else if (state.campusChargers.length > 0) {
      focusStationIn3D(state.campusChargers[0].stationID);
    }
  });

  document.getElementById('viewOverheadBtn')?.addEventListener('click', () => {
    setActiveHubBtn('viewOverheadBtn');
    focusCampusZone('aerial');
  });

  document.getElementById('resetCameraBtn')?.addEventListener('click', () => {
    focusCampusZone('hub');
    closeStationHologram();
    state.selectedStation = null;
  });

  const autoRotBtn = document.getElementById('toggleAutoRotateBtn');
  autoRotBtn?.addEventListener('click', () => {
    isAutoRotating = !isAutoRotating;
    if (hubControls) hubControls.autoRotate = isAutoRotating;
    autoRotBtn.classList.toggle('active', isAutoRotating);
  });

  document.getElementById('holoCloseBtn')?.addEventListener('click', closeStationHologram);

  document.getElementById('holoFilterBtn')?.addEventListener('click', () => {
    if (state.selectedStation) {
      const sel = document.getElementById('filterCharger');
      if (sel) {
        sel.value = state.selectedStation;
        applyFilters();
      }
    }
  });
}

function focusCampusZone(zone) {
  if (zone === 'hub') {
    smoothMoveCamera(new THREE.Vector3(0, 36, 44), new THREE.Vector3(0, 2, 0));
  } else if (zone === 'ac') {
    smoothMoveCamera(new THREE.Vector3(-24, 18, 24), new THREE.Vector3(-24, 2, 0));
  } else if (zone === 'dc') {
    smoothMoveCamera(new THREE.Vector3(24, 18, 24), new THREE.Vector3(24, 2, 0));
  } else if (zone === 'aerial') {
    smoothMoveCamera(new THREE.Vector3(0, 56, 0.1), new THREE.Vector3(0, 0, 0));
  }
}

function setActiveHubBtn(id) {
  document.querySelectorAll('.hub3d-controls .hub-btn').forEach(b => {
    if (!b.classList.contains('hub-btn--action') && !b.classList.contains('hub-btn--glow')) {
      b.classList.remove('active');
    }
  });
  document.getElementById(id)?.classList.add('active');
}

function onCampusMouseMove(event) {
  if (!hubRenderer || !hubCamera) return;
  const rect = hubRenderer.domElement.getBoundingClientRect();
  mouseCoords.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseCoords.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouseCoords, hubCamera);
  const intersects = raycaster.intersectObjects(stationMeshes);

  const hoverTag = document.getElementById('hub3dHoverTag');
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const d = hit.userData.stationData;
    if (d) {
      document.body.style.cursor = 'pointer';
      if (hoverTag) {
        hoverTag.style.display = 'block';
        hoverTag.style.left = `${event.clientX - rect.left}px`;
        hoverTag.style.top  = `${event.clientY - rect.top}px`;
        document.getElementById('hub3dHoverName').textContent = `STATION #${d.stationID}`;
        document.getElementById('hub3dHoverInfo').textContent = `${d.type} • ${d.location} • ${FMT_NUM(d.sessions)} sess`;
      }
    }
  } else {
    document.body.style.cursor = 'default';
    if (hoverTag) hoverTag.style.display = 'none';
  }
}

function onCampusClick(event) {
  if (!raycaster || !hubCamera) return;
  const rect = hubRenderer.domElement.getBoundingClientRect();
  mouseCoords.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseCoords.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouseCoords, hubCamera);
  const intersects = raycaster.intersectObjects(stationMeshes);

  if (intersects.length > 0) {
    const d = intersects[0].object.userData.stationData;
    if (d) {
      selectStationById(d.stationID, true);
    }
  }
}

function selectStationById(stationID, moveCamera = true) {
  state.selectedStation = stationID;

  const matching = state.filteredData.filter(d => d.chargerID === stationID);
  if (matching.length === 0) return;

  const totalSessions = matching.length;
  const totalEnergy   = d3.sum(matching, d => d.demand ?? 0);
  const validDurs     = matching.map(d => d.duration).filter(v => v > 0);
  const avgDur        = validDurs.length ? d3.mean(validDurs) : 0;
  const type          = matching[0].chargerType;
  const location      = matching[0].location;
  const company       = matching[0].chargerCompany;

  const holoCard = document.getElementById('stationHologram');
  if (holoCard) {
    holoCard.style.display = 'block';
    document.getElementById('holoStationId').textContent = `STATION #${stationID}`;
    const typeEl = document.getElementById('holoType');
    typeEl.textContent = type;
    typeEl.style.color = TYPE_COLOR(type);
    document.getElementById('holoLocation').textContent  = location;
    document.getElementById('holoCompany').textContent   = `Operator ${company}`;
    document.getElementById('holoSessions').textContent  = FMT_NUM(totalSessions);
    document.getElementById('holoEnergy').textContent    = `${FMT_NUM(Math.round(totalEnergy))} kWh`;
    document.getElementById('holoAvgDur').textContent    = `${FMT_FLOAT(avgDur)} min`;
  }

  if (moveCamera) {
    focusStationIn3D(stationID);
  }
}

function focusStationIn3D(stationID) {
  if (!campusGroup) return;
  let targetGroup = null;
  campusGroup.children.forEach(child => {
    if (child.userData?.stationData?.stationID === stationID) {
      targetGroup = child;
    }
  });

  if (targetGroup) {
    const targetPos = targetGroup.position;
    const camDest = new THREE.Vector3(targetPos.x, targetPos.y + 4.5, targetPos.z + 9.5);
    smoothMoveCamera(camDest, new THREE.Vector3(targetPos.x, targetPos.y + 1.8, targetPos.z));
  }
}

function closeStationHologram() {
  const holoCard = document.getElementById('stationHologram');
  if (holoCard) holoCard.style.display = 'none';
}

function smoothMoveCamera(targetCamPos, targetLookAt, durationMs = 850) {
  if (!hubCamera || !hubControls) return;
  const startCamPos = hubCamera.position.clone();
  const startLookAt = hubControls.target.clone();
  const startTime   = performance.now();

  function animateCam() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

    hubCamera.position.lerpVectors(startCamPos, targetCamPos, ease);
    hubControls.target.lerpVectors(startLookAt, targetLookAt, ease);
    hubControls.update();

    if (progress < 1) {
      requestAnimationFrame(animateCam);
    }
  }
  animateCam();
}

function onCampusResize() {
  const container = document.getElementById('threeCanvasContainer');
  if (!container || !hubRenderer || !hubCamera) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  hubCamera.aspect = w / h;
  hubCamera.updateProjectionMatrix();
  hubRenderer.setSize(w, h);
}

function animateCampus() {
  requestAnimationFrame(animateCampus);
  if (hubControls) hubControls.update();
  if (hubRenderer && hubScene && hubCamera) {
    hubRenderer.render(hubScene, hubCamera);
  }
}

/* ═══════════════════════════════════════════════════════
   9. 3D ELECTRIC VEHICLE SIMULATION STUDIO (THREE.JS)
═══════════════════════════════════════════════════════ */
let vScene, vCamera, vRenderer, vControls;
let vCarGroup = null;
let vChargerGroup = null;
let vCableCurve = null;
let vCableMesh = null;
let vParticles = [];
let vParticlesGroup = null;
let isVehicleStudioInitialized = false;

function initThreeVehicle() {
  const container = document.getElementById('vehicleCanvasContainer');
  if (!container || isVehicleStudioInitialized || !window.THREE) return;

  const w = container.clientWidth || 700;
  const h = container.clientHeight || 500;

  vScene = new THREE.Scene();
  vScene.background = new THREE.Color(0x090e1a);
  vScene.fog = new THREE.FogExp2(0x090e1a, 0.025);

  vCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
  vCamera.position.set(-5.5, 3.8, 6.2);

  vRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  vRenderer.setSize(w, h);
  vRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  vRenderer.shadowMap.enabled = true;
  vRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  vRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  vRenderer.toneMappingExposure = 1.35;

  container.innerHTML = '';
  container.appendChild(vRenderer.domElement);

  if (THREE.OrbitControls) {
    vControls = new THREE.OrbitControls(vCamera, vRenderer.domElement);
    vControls.enableDamping = true;
    vControls.dampingFactor = 0.06;
    vControls.maxPolarAngle = Math.PI / 2 - 0.02;
    vControls.minDistance = 3.5;
    vControls.maxDistance = 18;
    vControls.target.set(0, 1.0, 0);
  }

  setupVehicleStudioLighting();
  buildVehicleStudioTurntable();

  // Create 3D Car
  vCarGroup = buildElectricVehicleMesh(state.vehiclePaintColor);
  vScene.add(vCarGroup);

  // Create Charging Dispenser & Cable
  vChargerGroup = new THREE.Group();
  vScene.add(vChargerGroup);

  updateVehicleStationModel('Slow AC');

  window.addEventListener('resize', onVehicleStudioResize);
  setupVehicleStudioControls();

  isVehicleStudioInitialized = true;
  animateVehicle();
}

function setupVehicleStudioLighting() {
  const ambLight = new THREE.AmbientLight(0x162238, 2.4);
  vScene.add(ambLight);

  // Key Studio Softbox
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(10, 16, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0005;
  vScene.add(keyLight);

  // Fill Light (Electric Cyan)
  const fillLight = new THREE.DirectionalLight(0x00E5FF, 1.2);
  fillLight.position.set(-12, 8, -6);
  vScene.add(fillLight);

  // Rim Light (Vibrant Violet / Pink)
  const rimLight = new THREE.DirectionalLight(0xA855F7, 1.5);
  rimLight.position.set(0, 6, -14);
  vScene.add(rimLight);

  // Underglow light below car
  const underglow = new THREE.PointLight(0x00E5FF, 2.0, 8);
  underglow.position.set(0, 0.2, 0);
  vScene.add(underglow);
}

function buildVehicleStudioTurntable() {
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x070b14, roughness: 0.6, metalness: 0.4 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  vScene.add(floor);

  // Circular Turntable Platform
  const turnGeo = new THREE.CylinderGeometry(5.2, 5.4, 0.1, 48);
  const turnMat = new THREE.MeshStandardMaterial({ color: 0x0f1828, roughness: 0.2, metalness: 0.85 });
  const turntable = new THREE.Mesh(turnGeo, turnMat);
  turntable.position.y = 0.05;
  turntable.receiveShadow = true;
  vScene.add(turntable);

  // Turntable Glowing Ring
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, wireframe: true, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 5.15, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.11;
  vScene.add(ring);
}

function buildElectricVehicleMesh(colorHex) {
  const car = new THREE.Group();

  const paintMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    metalness: 0.85,
    roughness: 0.22,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0b111e,
    metalness: 0.6,
    roughness: 0.5
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070c14,
    metalness: 0.3,
    roughness: 0.1,
    transmission: 0.82,
    transparent: true,
    opacity: 0.9
  });

  // 1. Lower chassis / floor
  const chassisGeo = new THREE.BoxGeometry(2.1, 0.45, 4.7);
  const chassis = new THREE.Mesh(chassisGeo, trimMat);
  chassis.position.y = 0.45;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  car.add(chassis);

  // Front splitter
  const lipGeo = new THREE.BoxGeometry(2.0, 0.1, 0.4);
  const lip = new THREE.Mesh(lipGeo, paintMat);
  lip.position.set(0, 0.25, 2.35);
  car.add(lip);

  // 2. Main vehicle body
  const bodyGeo = new THREE.BoxGeometry(2.14, 0.6, 4.4);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.y = 0.82;
  bodyMesh.castShadow = true;
  car.add(bodyMesh);
  car.userData.bodyMesh = bodyMesh;

  // Sculpted hood
  const hoodGeo = new THREE.BoxGeometry(1.85, 0.22, 1.4);
  const hood = new THREE.Mesh(hoodGeo, paintMat);
  hood.position.set(0, 1.05, 1.3);
  hood.rotation.x = 0.08;
  car.add(hood);

  // 3. Cabin & Fastback Greenhouse
  const cabinGeo = new THREE.BoxGeometry(1.72, 0.62, 2.4);
  const cabin = new THREE.Mesh(cabinGeo, paintMat);
  cabin.position.set(0, 1.38, -0.2);
  cabin.castShadow = true;
  car.add(cabin);

  // Windshield
  const windshieldGeo = new THREE.BoxGeometry(1.66, 0.6, 0.08);
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, 1.32, 0.95);
  windshield.rotation.x = -Math.PI / 4.5;
  car.add(windshield);

  // Rear Window
  const rearWindowGeo = new THREE.BoxGeometry(1.66, 0.62, 0.08);
  const rearWindow = new THREE.Mesh(rearWindowGeo, glassMat);
  rearWindow.position.set(0, 1.32, -1.35);
  rearWindow.rotation.x = Math.PI / 4.2;
  car.add(rearWindow);

  // Side Windows
  const sideWinGeo = new THREE.BoxGeometry(0.04, 0.44, 2.0);
  const sideWinL = new THREE.Mesh(sideWinGeo, glassMat);
  sideWinL.position.set(-0.88, 1.35, -0.15);
  car.add(sideWinL);

  const sideWinR = new THREE.Mesh(sideWinGeo, glassMat);
  sideWinR.position.set(0.88, 1.35, -0.15);
  car.add(sideWinR);

  // Sunroof
  const sunroofGeo = new THREE.BoxGeometry(1.4, 0.04, 1.7);
  const sunroof = new THREE.Mesh(sunroofGeo, glassMat);
  sunroof.position.set(0, 1.7, -0.15);
  car.add(sunroof);

  // 4. LED Headlights & DRL Light Strip
  const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hlGeo = new THREE.BoxGeometry(0.42, 0.12, 0.2);
  
  const hlL = new THREE.Mesh(hlGeo, headLightMat);
  hlL.position.set(-0.76, 0.92, 2.18);
  hlL.rotation.y = -0.2;
  car.add(hlL);

  const hlR = new THREE.Mesh(hlGeo, headLightMat);
  hlR.position.set(0.76, 0.92, 2.18);
  hlR.rotation.y = 0.2;
  car.add(hlR);

  const drlMat = new THREE.MeshBasicMaterial({ color: 0x00E5FF });
  const drlStrip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.05), drlMat);
  drlStrip.position.set(0, 0.82, 2.22);
  car.add(drlStrip);

  // 5. Rear Taillight Lightbar
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff1e56 });
  const tlBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.1), tlMat);
  tlBar.position.set(0, 1.0, -2.22);
  car.add(tlBar);

  // 6. Wheels (4 alloy wheels)
  const wheelPositions = [
    [-1.02, 0.42, 1.45],
    [1.02,  0.42, 1.45],
    [-1.02, 0.42, -1.45],
    [1.02,  0.42, -1.45],
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);

    const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.29, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.31, 16), new THREE.MeshBasicMaterial({ color: 0x00E5FF }));
    cap.rotation.z = Math.PI / 2;
    wheelGroup.add(cap);

    car.add(wheelGroup);
  });

  // 7. Mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.26, 0.12, 0.15);
  const mirrorL = new THREE.Mesh(mirrorGeo, paintMat);
  mirrorL.position.set(-1.12, 1.25, 0.7);
  car.add(mirrorL);

  const mirrorR = new THREE.Mesh(mirrorGeo, paintMat);
  mirrorR.position.set(1.12, 1.25, 0.7);
  car.add(mirrorR);

  // 8. Charging Port Assembly (Rear Left Quarter Panel)
  const portGroup = new THREE.Group();
  portGroup.position.set(-1.08, 0.95, -1.25);

  const socketHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
  );
  socketHousing.rotation.z = Math.PI / 2;
  portGroup.add(socketHousing);

  const haloRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.025, 16, 32),
    new THREE.MeshBasicMaterial({ color: 0x39FF88 })
  );
  haloRing.rotation.y = Math.PI / 2;
  haloRing.position.x = -0.04;
  portGroup.add(haloRing);
  car.userData.haloRing = haloRing;

  // Charging Flap Door
  const flap = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.34, 0.34),
    new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.85, roughness: 0.25 })
  );
  flap.position.set(-0.06, 0, 0.17);
  portGroup.add(flap);
  car.userData.portFlap = flap;

  // Charging Connector Plug
  const plugGroup = new THREE.Group();
  plugGroup.position.set(-0.16, 0, 0);

  const plugHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.45, 16),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 })
  );
  plugHandle.rotation.z = Math.PI / 2;
  plugGroup.add(plugHandle);

  portGroup.add(plugGroup);
  car.userData.plugGroup = plugGroup;

  car.add(portGroup);
  return car;
}

/**
 * Updates 3D Charging Kiosk model, cable spline, and glowing energy stream
 * based on whether session is Fast DC (Amber) or Slow AC (Green)
 */
function updateVehicleStationModel(chargerType) {
  if (!vChargerGroup) return;
  vChargerGroup.clear();

  const isFastDC = chargerType === 'Fast DC';
  const themeHex = isFastDC ? 0xFF9F43 : 0x39FF88;

  // 1. Charging Kiosk Tower
  const kioskWidth  = isFastDC ? 1.0 : 0.7;
  const kioskHeight = isFastDC ? 3.4 : 2.6;
  const kioskDepth  = isFastDC ? 0.8 : 0.55;

  const kioskGeo = new THREE.BoxGeometry(kioskWidth, kioskHeight, kioskDepth);
  const kioskMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.85, roughness: 0.2 });
  const kiosk = new THREE.Mesh(kioskGeo, kioskMat);
  kiosk.position.set(-2.8, kioskHeight / 2 + 0.1, -1.25);
  kiosk.castShadow = true;
  vChargerGroup.add(kiosk);

  // Kiosk Base Pad
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(kioskWidth + 0.5, 0.12, kioskDepth + 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1f2937 })
  );
  pad.position.set(-2.8, 0.06, -1.25);
  pad.receiveShadow = true;
  vChargerGroup.add(pad);

  // Kiosk Neon Crown Lightbar
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(kioskWidth + 0.05, 0.15, kioskDepth + 0.05),
    new THREE.MeshBasicMaterial({ color: themeHex })
  );
  crown.position.set(-2.8, kioskHeight + 0.18, -1.25);
  vChargerGroup.add(crown);

  // Kiosk Status Telemetry Screen
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.7),
    new THREE.MeshBasicMaterial({ color: 0x020712 })
  );
  screen.rotation.y = Math.PI / 2;
  screen.position.set(-2.8 + kioskWidth / 2 + 0.01, kioskHeight - 0.7, -1.25);
  vChargerGroup.add(screen);

  // 2. Flexible 3D Charging Cable Curve
  const startPt = new THREE.Vector3(-2.8 + kioskWidth / 2, 1.4, -1.25);
  const midPt1  = new THREE.Vector3(-2.1, 0.45, -1.15);
  const midPt2  = new THREE.Vector3(-1.5, 0.4, -1.3);
  const endPt   = new THREE.Vector3(-1.22, 0.95, -1.25);

  vCableCurve = new THREE.CatmullRomCurve3([startPt, midPt1, midPt2, endPt]);
  const cableGeo = new THREE.TubeGeometry(vCableCurve, 32, isFastDC ? 0.055 : 0.04, 12, false);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
  vCableMesh = new THREE.Mesh(cableGeo, cableMat);
  vChargerGroup.add(vCableMesh);

  // 3. Glowing Energy Particle Pulse Stream
  vParticlesGroup = new THREE.Group();
  vParticles = [];
  const particleCount = isFastDC ? 12 : 8;

  for (let i = 0; i < particleCount; i++) {
    const pGeo = new THREE.SphereGeometry(isFastDC ? 0.075 : 0.055, 12, 12);
    const pMat = new THREE.MeshBasicMaterial({ color: themeHex });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    vParticlesGroup.add(pMesh);
    vParticles.push({
      mesh: pMesh,
      offset: i / particleCount,
    });
  }
  vChargerGroup.add(vParticlesGroup);

  // Update Car Halo Color & open port flap
  if (vCarGroup?.userData?.haloRing) {
    vCarGroup.userData.haloRing.material.color.setHex(themeHex);
  }
  if (vCarGroup?.userData?.portFlap) {
    vCarGroup.userData.portFlap.rotation.y = -Math.PI / 2.5; // open
  }
}

function setupVehicleStudioControls() {
  document.getElementById('vCamIsoBtn')?.addEventListener('click', () => {
    setActiveVCamBtn('vCamIsoBtn');
    smoothMoveVehicleCamera(new THREE.Vector3(-5.5, 3.8, 6.2), new THREE.Vector3(0, 1.0, 0));
  });

  document.getElementById('vCamFrontBtn')?.addEventListener('click', () => {
    setActiveVCamBtn('vCamFrontBtn');
    smoothMoveVehicleCamera(new THREE.Vector3(0, 2.0, 7.5), new THREE.Vector3(0, 0.9, 0));
  });

  document.getElementById('vCamSideBtn')?.addEventListener('click', () => {
    setActiveVCamBtn('vCamSideBtn');
    smoothMoveVehicleCamera(new THREE.Vector3(-6.8, 1.8, -0.6), new THREE.Vector3(-1.0, 0.95, -0.6));
  });

  document.getElementById('vCamRearBtn')?.addEventListener('click', () => {
    setActiveVCamBtn('vCamRearBtn');
    smoothMoveVehicleCamera(new THREE.Vector3(0, 2.2, -7.5), new THREE.Vector3(0, 0.9, 0));
  });

  document.getElementById('vCamClosePortBtn')?.addEventListener('click', () => {
    setActiveVCamBtn('vCamClosePortBtn');
    smoothMoveVehicleCamera(new THREE.Vector3(-2.8, 1.8, -1.4), new THREE.Vector3(-1.15, 0.95, -1.25));
  });

  document.getElementById('vResetCamBtn')?.addEventListener('click', () => {
    setActiveVCamBtn('vCamIsoBtn');
    smoothMoveVehicleCamera(new THREE.Vector3(-5.5, 3.8, 6.2), new THREE.Vector3(0, 1.0, 0));
  });

  // Paint color selector pills
  document.querySelectorAll('.paint-swatch').forEach(swatch => {
    swatch.addEventListener('click', function() {
      document.querySelectorAll('.paint-swatch').forEach(s => s.classList.remove('active'));
      this.classList.add('active');
      const hex = this.getAttribute('data-color');
      setVehiclePaintColor(hex);
    });
  });

  // Play / Pause Playback
  const playBtn = document.getElementById('vPlayPauseBtn');
  playBtn?.addEventListener('click', () => {
    state.vehiclePlayback.isPlaying = !state.vehiclePlayback.isPlaying;
    updatePlayPauseButtonUI();
  });

  // Rewind
  document.getElementById('vRewindBtn')?.addEventListener('click', () => {
    state.vehiclePlayback.progress = 0.0;
    state.vehiclePlayback.isPlaying = true;
    updatePlayPauseButtonUI();
  });

  // Previous Session
  document.getElementById('vPrevSessionBtn')?.addEventListener('click', () => {
    if (state.selectedSessionIndex > 0) {
      selectVehicleSession(state.selectedSessionIndex - 1);
    }
  });

  // Next Session
  document.getElementById('vNextSessionBtn')?.addEventListener('click', () => {
    if (state.selectedSessionIndex < state.vehicleSessions.length - 1) {
      selectVehicleSession(state.selectedSessionIndex + 1);
    }
  });

  // Playback Speed buttons
  document.querySelectorAll('.playback-speed-group .speed-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.playback-speed-group .speed-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      state.vehiclePlayback.speed = +this.getAttribute('data-speed');
    });
  });

  // Timeline buttons
  document.getElementById('timelinePrevBtn')?.addEventListener('click', () => {
    if (state.selectedSessionIndex > 0) {
      selectVehicleSession(state.selectedSessionIndex - 1);
    }
  });
  document.getElementById('timelineNextBtn')?.addEventListener('click', () => {
    if (state.selectedSessionIndex < state.vehicleSessions.length - 1) {
      selectVehicleSession(state.selectedSessionIndex + 1);
    }
  });

  // Progress Scrubber click
  document.getElementById('vScrubTrack')?.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    state.vehiclePlayback.progress = Math.max(0, Math.min(1, clickX / rect.width));
    updatePlaybackHUD();
  });

  // Locate in Campus
  document.getElementById('vLocateInCampusBtn')?.addEventListener('click', () => {
    const session = state.vehicleSessions[state.selectedSessionIndex];
    if (session) {
      document.getElementById('hub3dSection')?.scrollIntoView({ behavior: 'smooth' });
      focusStationIn3D(session.chargerID);
    }
  });
}

function setActiveVCamBtn(id) {
  document.querySelectorAll('.vehicle-studio-controls .hub-btn').forEach(b => {
    if (!b.classList.contains('hub-btn--action')) b.classList.remove('active');
  });
  document.getElementById(id)?.classList.add('active');
}

function setVehiclePaintColor(colorHexStr) {
  const hex = parseInt(colorHexStr.replace('#', '0x'), 16);
  state.vehiclePaintColor = hex;
  if (vCarGroup?.userData?.bodyMesh) {
    vCarGroup.userData.bodyMesh.material.color.setHex(hex);
  }
}

function smoothMoveVehicleCamera(targetPos, targetLookAt, durationMs = 750) {
  if (!vCamera || !vControls) return;
  const startPos    = vCamera.position.clone();
  const startLookAt = vControls.target.clone();
  const startTime   = performance.now();

  function animateCam() {
    const elapsed  = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const ease     = 0.5 - Math.cos(progress * Math.PI) / 2;

    vCamera.position.lerpVectors(startPos, targetPos, ease);
    vControls.target.lerpVectors(startLookAt, targetLookAt, ease);
    vControls.update();

    if (progress < 1) requestAnimationFrame(animateCam);
  }
  animateCam();
}

function updatePlayPauseButtonUI() {
  const isPlaying = state.vehiclePlayback.isPlaying;
  const icon = document.getElementById('vPlayIcon');
  const txt  = document.getElementById('vPlayText');
  if (icon) icon.textContent = isPlaying ? '⏸' : '▶';
  if (txt)  txt.textContent  = isPlaying ? 'Pause' : 'Play Playback';

  const statusBadge = document.getElementById('vStageStatus');
  if (statusBadge) {
    if (state.vehiclePlayback.progress >= 1.0) {
      statusBadge.textContent = 'CHARGING COMPLETED';
      statusBadge.className = 'vbadge-status status-completed';
    } else {
      statusBadge.textContent = isPlaying ? 'CHARGING IN PROGRESS' : 'PLAYBACK PAUSED';
      statusBadge.className = isPlaying ? 'vbadge-status status-charging' : 'vbadge-status';
    }
  }
}

function updatePlaybackHUD() {
  const p = state.vehiclePlayback.progress;
  const session = state.vehicleSessions[state.selectedSessionIndex];
  if (!session) return;

  const totalKwh = session.demand || 0;
  const totalMin = session.duration || 0;
  const currKwh  = totalKwh * p;
  const currMin  = totalMin * p;

  // Scrubber bar
  const fill = document.getElementById('vScrubFill');
  const handle = document.getElementById('vScrubHandle');
  if (fill) fill.style.width = `${p * 100}%`;
  if (handle) handle.style.left = `${p * 100}%`;

  const timeEl = document.getElementById('vScrubTime');
  if (timeEl) {
    const curSec = Math.round(currMin * 60);
    const totSec = Math.round(totalMin * 60);
    const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    timeEl.textContent = `${fmt(curSec)} / ${fmt(totSec)}`;
  }

  // Battery Readout
  const pctEl = document.getElementById('batProgressPct');
  if (pctEl) pctEl.textContent = `${Math.round(p * 100)}%`;

  const energyEl = document.getElementById('batEnergyDelivered');
  if (energyEl) energyEl.textContent = `${FMT_FLOAT(currKwh)} kWh`;

  // Battery Stack Cells
  const cells = document.querySelectorAll('#batteryCellsContainer .battery-cell');
  const filledCount = Math.floor(p * cells.length);
  const isDC = session.chargerType === 'Fast DC';

  cells.forEach((cell, idx) => {
    if (idx < filledCount) {
      cell.classList.add('filled');
      cell.classList.toggle('filled--dc', isDC);
    } else {
      cell.classList.remove('filled', 'filled--dc');
    }
  });

  updatePlayPauseButtonUI();
}

function animateVehicle() {
  requestAnimationFrame(animateVehicle);

  const now = performance.now();
  if (!state.vehiclePlayback.lastTimestamp) state.vehiclePlayback.lastTimestamp = now;
  const delta = now - state.vehiclePlayback.lastTimestamp;
  state.vehiclePlayback.lastTimestamp = now;

  // Progress charging simulation
  if (state.vehiclePlayback.isPlaying) {
    const rate = (delta / state.vehiclePlayback.durationMs) * state.vehiclePlayback.speed;
    state.vehiclePlayback.progress += rate;

    if (state.vehiclePlayback.progress >= 1.0) {
      state.vehiclePlayback.progress = 1.0;
      state.vehiclePlayback.isPlaying = false;
    }
    updatePlaybackHUD();
  }

  // Animate Glowing Energy Particles along Cable
  if (vCableCurve && vParticles.length > 0 && state.vehiclePlayback.progress < 1.0) {
    const speedFactor = (state.vehiclePlayback.speed * 0.0015);
    vParticles.forEach(p => {
      p.offset = (p.offset + speedFactor) % 1.0;
      const pt = vCableCurve.getPointAt(p.offset);
      p.mesh.position.copy(pt);
    });
  }

  if (vControls) vControls.update();
  if (vRenderer && vScene && vCamera) {
    vRenderer.render(vScene, vCamera);
  }
}

function onVehicleStudioResize() {
  const container = document.getElementById('vehicleCanvasContainer');
  if (!container || !vRenderer || !vCamera) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  vCamera.aspect = w / h;
  vCamera.updateProjectionMatrix();
  vRenderer.setSize(w, h);
}

/* ═══════════════════════════════════════════════════════
   11. VEHICLE-SPECIFIC 3D KPI CARDS (7 CARDS)
═══════════════════════════════════════════════════════ */
function updateVehicleKPIs(sessions) {
  if (!sessions || sessions.length === 0) return;

  // 1. Total Recorded Sessions
  document.getElementById('vKpiSessions').textContent = FMT_NUM(sessions.length);

  // 2. Total Energy Delivered (kWh)
  const totalEnergy = d3.sum(sessions, s => s.demand || 0);
  document.getElementById('vKpiEnergy').textContent = FMT_NUM(Math.round(totalEnergy));

  // 3. Average Charging Duration (minutes)
  const validDurs = sessions.map(s => s.duration).filter(d => d > 0);
  const avgDur = validDurs.length ? d3.mean(validDurs) : 0;
  document.getElementById('vKpiAvgDur').textContent = FMT_FLOAT(avgDur);

  // 4. Average Calculated Power (kW) = Total Energy / (Total Valid Duration / 60)
  const totalHours = d3.sum(validDurs) / 60;
  const avgKw = totalHours > 0 ? (totalEnergy / totalHours) : 0;
  document.getElementById('vKpiAvgPower').textContent = `${FMT_FLOAT(avgKw)} kW`;

  // 5. Primary Charger Type
  const acCount = sessions.filter(s => s.chargerType === 'Slow AC').length;
  const dcCount = sessions.filter(s => s.chargerType === 'Fast DC').length;
  const primaryType = dcCount > acCount ? 'Fast DC' : 'Slow AC';
  const dominantPct = sessions.length ? Math.max(acCount, dcCount) / sessions.length : 0;
  
  const typeEl = document.getElementById('vKpiPrimaryType');
  if (typeEl) {
    typeEl.textContent = primaryType;
    typeEl.style.color = TYPE_COLOR(primaryType);
  }
  const subEl = document.getElementById('vKpiPrimaryTypeSub');
  if (subEl) subEl.textContent = `${FMT_PCT(dominantPct)} of sessions`;

  // 6. Distinct Stations Visited
  const distinctStations = new Set(sessions.map(s => s.chargerID)).size;
  document.getElementById('vKpiStationsCount').textContent = FMT_NUM(distinctStations);

  // 7. Latest Recorded Session
  const latest = sessions[sessions.length - 1];
  if (latest) {
    const dt = latest.startDatetime ? FMT_DATE(latest.startDatetime) : latest.startDay;
    document.getElementById('vKpiLatestSession').textContent = dt;
    const latSub = document.getElementById('vKpiLatestSessionSub');
    if (latSub) latSub.textContent = `Station #${latest.chargerID} (${latest.location})`;
  }
}

/* ═══════════════════════════════════════════════════════
   12. VEHICLE INTERACTIVE SESSION TIMELINE & CAROUSEL
═══════════════════════════════════════════════════════ */
function renderVehicleTimeline(sessions) {
  const track = document.getElementById('vehicleTimelineTrack');
  const countEl = document.getElementById('timelineSessionCount');
  if (!track) return;
  track.innerHTML = '';

  if (countEl) countEl.textContent = `Total ${FMT_NUM(sessions.length)} Sessions Recorded`;

  sessions.forEach((s, idx) => {
    const chip = document.createElement('div');
    chip.className = `timeline-session-chip ${idx === state.selectedSessionIndex ? 'active' : ''}`;
    chip.setAttribute('data-session-idx', idx);

    const dateStr = s.startDatetime ? FMT_DATE(s.startDatetime) : s.startDay;
    const durHours = (s.duration || 0) > 0 ? (s.duration / 60) : 0;
    const kw = durHours > 0 ? (s.demand || 0) / durHours : 0;

    chip.innerHTML = `
      <div class="tchip-header">
        <span class="tchip-num">#${idx + 1}</span>
        <span class="tchip-date">${dateStr}</span>
      </div>
      <div class="tchip-station">Station #${s.chargerID} &bull; ${s.location}</div>
      <div class="tchip-metrics">
        <span class="tchip-kwh">${FMT_FLOAT(s.demand || 0)} kWh</span>
        <span class="tchip-power">${FMT_FLOAT(kw)} kW avg</span>
      </div>
    `;

    chip.addEventListener('click', () => {
      selectVehicleSession(idx);
    });

    track.appendChild(chip);
  });
}

/* ═══════════════════════════════════════════════════════
   13. VEHICLE-SPECIFIC D3 ANALYTICS CHARTS (4 CHARTS)
═══════════════════════════════════════════════════════ */
function drawVehicleAnalyticsCharts(sessions) {
  drawVehicleEnergyChart(sessions);
  drawVehicleDurationPowerChart(sessions);
  drawVehicleStandardDonut(sessions);
  drawVehicleLocationBar(sessions);
}

// V1: Energy Delivered per Session (D3 Stem / Bar Chart)
function drawVehicleEnergyChart(sessions) {
  if (!prepareContainer('vChartEnergyContainer', sessions)) return;

  const margin = { top: 20, right: 25, bottom: 45, left: 55 };
  const { w, h, innerW, innerH } = getDims('vChartEnergyContainer', margin, 260);

  const svg = d3.select('#vChartEnergyContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([1, sessions.length]).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([0, d3.max(sessions, d => d.demand || 0) * 1.15 || 10]).range([innerH, 0]).nice();

  g.append('g').attr('class', 'gridline')
    .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(sessions.length, 8)).tickFormat(d => `#${d}`));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(FMT_FLOAT));

  // Bars / Stems
  const barWidth = Math.max(2, Math.min(14, innerW / sessions.length - 2));

  g.selectAll('.venergy-bar')
    .data(sessions).join('rect')
    .attr('class', 'bar-rect')
    .attr('x', (_, i) => xScale(i + 1) - barWidth / 2)
    .attr('y', d => yScale(d.demand || 0))
    .attr('width', barWidth)
    .attr('height', d => Math.max(0, innerH - yScale(d.demand || 0)))
    .attr('rx', 2)
    .attr('fill', d => TYPE_COLOR(d.chargerType))
    .on('mousemove', (e, d, i) => showTooltip(e, buildTooltipHTML(`Session #${i + 1}`, [
      { label: 'Energy Demand', value: `${FMT_FLOAT(d.demand || 0)} kWh` },
      { label: 'Station',       value: `Station #${d.chargerID}` },
      { label: 'Standard',      value: d.chargerType },
      { label: 'Duration',      value: `${FMT_FLOAT(d.duration || 0)} min` },
    ])))
    .on('mouseleave', hideTooltip)
    .on('click', (_, __, i) => selectVehicleSession(i));
}

// V2: Duration vs Calculated Average Power (D3 Scatter / Correlation)
function drawVehicleDurationPowerChart(sessions) {
  if (!prepareContainer('vChartDurationPowerContainer', sessions)) return;

  const validSessions = sessions.filter(s => (s.duration || 0) > 0 && (s.demand || 0) >= 0)
    .map(s => {
      const hrs = s.duration / 60;
      const kw = hrs > 0 ? s.demand / hrs : 0;
      return { ...s, calculatedPower: kw };
    });

  const margin = { top: 20, right: 30, bottom: 45, left: 55 };
  const { w, h, innerW, innerH } = getDims('vChartDurationPowerContainer', margin, 260);

  const svg = d3.select('#vChartDurationPowerContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, d3.max(validSessions, d => d.duration) * 1.1 || 60]).range([0, innerW]).nice();
  const yScale = d3.scaleLinear().domain([0, d3.max(validSessions, d => d.calculatedPower) * 1.15 || 20]).range([innerH, 0]).nice();

  g.append('g').attr('class', 'gridline')
    .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(FMT_NUM));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(FMT_FLOAT));

  g.selectAll('.vdot')
    .data(validSessions).join('circle')
    .attr('class', 'scatter-dot')
    .attr('cx', d => xScale(d.duration))
    .attr('cy', d => yScale(d.calculatedPower))
    .attr('r', 4.5)
    .attr('fill', d => TYPE_COLOR(d.chargerType))
    .attr('opacity', 0.75)
    .on('mousemove', (e, d, i) => showTooltip(e, buildTooltipHTML(`Session #${i + 1}`, [
      { label: 'Calculated Power', value: `${FMT_FLOAT(d.calculatedPower)} kW` },
      { label: 'Dwell Duration',   value: `${FMT_FLOAT(d.duration)} min` },
      { label: 'Energy Delivered', value: `${FMT_FLOAT(d.demand)} kWh` },
      { label: 'Charger',          value: `Station #${d.chargerID}` },
    ])))
    .on('mouseleave', hideTooltip)
    .on('click', (_, __, i) => selectVehicleSession(i));
}

// V3: Fast DC vs Slow AC Share for this Vehicle (D3 Donut)
function drawVehicleStandardDonut(sessions) {
  if (!prepareContainer('vChartStandardContainer', sessions)) return;

  const total = sessions.length;
  const byType = d3.rollup(sessions, v => v.length, d => d.chargerType);
  const slices = [...byType.entries()].map(([type, count]) => ({
    type, count, pct: count / total
  })).sort((a,b) => b.count - a.count);

  const margin = { top: 10, right: 10, bottom: 20, left: 10 };
  const { w, h } = getDims('vChartStandardContainer', margin, 260);
  const cx = w / 2, cy = h / 2 - 12;
  const outerR = Math.min(cx, cy) * 0.76;
  const innerR = outerR * 0.58;

  const svg = d3.select('#vChartStandardContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const pie = d3.pie().value(d => d.count).sort(null).padAngle(0.04);
  const arc = d3.arc().innerRadius(innerR).outerRadius(outerR).cornerRadius(4);
  const arcs = pie(slices);

  g.selectAll('.varc')
    .data(arcs).join('path')
    .attr('d', arc)
    .attr('fill', d => TYPE_COLOR(d.data.type))
    .attr('stroke', '#111827')
    .attr('stroke-width', 2)
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(d.data.type, [
      { label: 'Sessions', value: FMT_NUM(d.data.count) },
      { label: 'Share',    value: FMT_PCT(d.data.pct) },
    ])))
    .on('mouseleave', hideTooltip);

  g.append('text').attr('text-anchor', 'middle').attr('y', 4)
    .attr('fill', '#ffffff').attr('font-size', '16').attr('font-weight', '700')
    .text(FMT_NUM(total));

  // Legend
  const legendG = svg.append('g').attr('transform', `translate(${cx - (slices.length * 80) / 2}, ${cy + outerR + 20})`);
  slices.forEach((s, i) => {
    const lg = legendG.append('g').attr('transform', `translate(${i * 90}, 0)`);
    lg.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', TYPE_COLOR(s.type));
    lg.append('text').attr('x', 14).attr('y', 9).attr('fill', '#9ca3af').attr('font-size', '11')
      .text(`${s.type}: ${FMT_PCT(s.pct)}`);
  });
}

// V4: Locations Visited by this Vehicle (D3 Horizontal Bar Chart)
function drawVehicleLocationBar(sessions) {
  if (!prepareContainer('vChartLocationContainer', sessions)) return;

  const byLoc = d3.rollup(sessions, v => v.length, d => d.location || 'Unknown');
  const locSeries = [...byLoc.entries()]
    .map(([loc, count]) => ({ loc, count, pct: count / sessions.length }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 6);

  const margin = { top: 15, right: 60, bottom: 35, left: 110 };
  const barH = 26;
  const h = locSeries.length * barH + margin.top + margin.bottom;
  const { w, innerW } = getDims('vChartLocationContainer', margin, h);
  const innerH = locSeries.length * barH;

  const svg = d3.select('#vChartLocationContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, d3.max(locSeries, d => d.count) * 1.15 || 5]).range([0, innerW]).nice();
  const yScale = d3.scaleBand().domain(locSeries.map(d => d.loc)).range([0, innerH]).padding(0.25);

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).tickSize(0))
    .select('.domain').remove();

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(FMT_NUM));

  g.selectAll('.vloc-bar')
    .data(locSeries).join('rect')
    .attr('class', 'bar-rect')
    .attr('x', 0)
    .attr('y', d => yScale(d.loc))
    .attr('width', d => xScale(d.count))
    .attr('height', yScale.bandwidth())
    .attr('rx', 3)
    .attr('fill', COLOR_VIOLET)
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(d.loc, [
      { label: 'Sessions', value: FMT_NUM(d.count) },
      { label: 'Share',    value: FMT_PCT(d.pct) },
    ])))
    .on('mouseleave', hideTooltip);

  g.selectAll('.vloc-label')
    .data(locSeries).join('text')
    .attr('x', d => xScale(d.count) + 5)
    .attr('y', d => yScale(d.loc) + yScale.bandwidth() / 2)
    .attr('dominant-baseline', 'central')
    .attr('fill', '#e5e7eb').attr('font-size', '10.5')
    .text(d => `${d.count} (${FMT_PCT(d.pct)})`);
}

/* ═══════════════════════════════════════════════════════
   14. CSS 3D PERSPECTIVE TILT SYSTEM
═══════════════════════════════════════════════════════ */
function initTiltEffect() {
  const tiltCards = document.querySelectorAll('.tilt-card');
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotateX = ((y - cy) / cy) * -12;
      const rotateY = ((x - cx) / cx) * 12;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.025, 1.025, 1.025)`;

      const glare = card.querySelector('.tilt-glare');
      if (glare) {
        glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.16) 0%, transparent 60%)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });
}

function prepareContainer(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return false;
  el.innerHTML = '';
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="chart-empty-msg" style="padding:40px;text-align:center;color:#6b7280;">No telemetry data available for the selected parameters.</div>';
    return false;
  }
  return true;
}

function getDims(containerId, margin, minH = 300) {
  const el = document.getElementById(containerId);
  const w  = el ? el.clientWidth || 600 : 600;
  const h  = el ? Math.max(minH, el.clientHeight || minH) : minH;
  return {
    w, h,
    innerW: Math.max(0, w - margin.left - margin.right),
    innerH: Math.max(0, h - margin.top  - margin.bottom),
  };
}

/* ═══════════════════════════════════════════════════════
   15. CAMPUS-LEVEL D3 CHARTS (8 CHARTS)
═══════════════════════════════════════════════════════ */
function drawLineChart() {
  const data = state.filteredData;
  if (!prepareContainer('lineChartContainer', data)) return;

  const agg = document.getElementById('lineAggSelect')?.value || 'month';

  const grouped = d3.rollup(
    data,
    v => ({
      sessions: v.length,
      energy  : d3.sum(v, d => d.demand ?? 0),
      avgDur  : d3.mean(v.filter(d => d.duration > 0), d => d.duration) ?? 0,
    }),
    d => {
      if (!d.startDatetime) return null;
      return agg === 'day'
        ? d3.timeDay(d.startDatetime).getTime()
        : d3.timeMonth(d.startDatetime).getTime();
    }
  );
  grouped.delete(null);

  const series = [...grouped.entries()]
    .map(([ts, v]) => ({ date: new Date(+ts), ...v }))
    .sort((a,b) => a.date - b.date);

  if (series.length === 0) {
    prepareContainer('lineChartContainer', []);
    return;
  }

  const margin = { top: 25, right: 40, bottom: 50, left: 70 };
  const { w, h, innerW, innerH } = getDims('lineChartContainer', margin, 320);

  const svg = d3.select('#lineChartContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  const areaGrad = defs.append('linearGradient')
    .attr('id', 'areaGrad')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '0%').attr('y2', '100%');
  areaGrad.append('stop').attr('offset', '0%').attr('stop-color', COLOR_CYAN).attr('stop-opacity', 0.45);
  areaGrad.append('stop').attr('offset', '100%').attr('stop-color', COLOR_CYAN).attr('stop-opacity', 0.0);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleTime().domain(d3.extent(series, d => d.date)).range([0, innerW]);
  const yScale = d3.scaleLinear().domain([0, d3.max(series, d => d.sessions) * 1.15]).range([innerH, 0]).nice();

  g.append('g').attr('class', 'gridline')
    .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

  const xFmt = agg === 'day' ? d3.timeFormat('%d %b') : d3.timeFormat('%b %Y');
  const xTickCount = Math.min(series.length, agg === 'day' ? 9 : 7);

  g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(xTickCount).tickFormat(xFmt))
    .selectAll('text')
    .attr('transform', 'rotate(-25)')
    .style('text-anchor', 'end');

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(FMT_NUM));

  const area = d3.area().x(d => xScale(d.date)).y0(innerH).y1(d => yScale(d.sessions)).curve(d3.curveMonotoneX);
  g.append('path').datum(series).attr('class', 'area-path').attr('d', area);

  const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.sessions)).curve(d3.curveMonotoneX);
  g.append('path').datum(series).attr('class', 'line-path').attr('d', line);

  const dotData = series.length > 250 ? [] : series;
  g.selectAll('.dot-circle')
    .data(dotData).join('circle')
    .attr('class', 'dot-circle')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.sessions))
    .attr('r', 4.5)
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(
      agg === 'day' ? FMT_DATE(d.date) : d3.timeFormat('%B %Y')(d.date),
      [
        { label: 'Sessions',          value: FMT_NUM(d.sessions) },
        { label: 'Energy (kWh)',      value: FMT_NUM(Math.round(d.energy)) },
        { label: 'Avg Duration (min)',value: FMT_FLOAT(d.avgDur) },
      ]
    )))
    .on('mouseleave', hideTooltip);
}

document.getElementById('lineAggSelect')?.addEventListener('change', drawLineChart);

function drawChargerTypeBarChart() {
  const data = state.filteredData;
  if (!prepareContainer('barTypeContainer', data)) return;

  const total = data.length;
  const byType = d3.rollup(
    data,
    v => ({
      sessions: v.length,
      energy  : d3.sum(v, d => d.demand ?? 0),
      avgDur  : d3.mean(v.filter(d => d.duration > 0), d => d.duration) ?? 0,
    }),
    d => d.chargerType
  );

  const typeSeries = [...byType.entries()].map(([type, v]) => ({
    type, ...v, pct: v.sessions / total,
  })).sort((a,b) => b.sessions - a.sessions);

  const margin = { top: 25, right: 30, bottom: 50, left: 70 };
  const { w, h, innerW, innerH } = getDims('barTypeContainer', margin, 280);

  const svg = d3.select('#barTypeContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleBand().domain(typeSeries.map(d => d.type)).range([0, innerW]).padding(0.4);
  const yScale = d3.scaleLinear().domain([0, d3.max(typeSeries, d => d.sessions) * 1.2]).range([innerH, 0]).nice();

  g.append('g').attr('class', 'gridline')
    .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale));

  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(FMT_NUM));

  g.selectAll('.bar-rect')
    .data(typeSeries).join('rect')
    .attr('class', 'bar-rect')
    .attr('x', d => xScale(d.type))
    .attr('y', d => yScale(d.sessions))
    .attr('width', xScale.bandwidth())
    .attr('height', d => innerH - yScale(d.sessions))
    .attr('rx', 6)
    .attr('fill', d => TYPE_COLOR(d.type))
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(d.type, [
      { label: 'Sessions',          value: FMT_NUM(d.sessions) },
      { label: '% of Total',        value: FMT_PCT(d.pct) },
      { label: 'Total Energy (kWh)',value: FMT_NUM(Math.round(d.energy)) },
      { label: 'Avg Duration (min)',value: FMT_FLOAT(d.avgDur) },
    ])))
    .on('mouseleave', hideTooltip);

  g.selectAll('.bar-label')
    .data(typeSeries).join('text')
    .attr('class', 'bar-label')
    .attr('x', d => xScale(d.type) + xScale.bandwidth() / 2)
    .attr('y', d => yScale(d.sessions) - 8)
    .attr('text-anchor', 'middle')
    .attr('fill', '#ffffff')
    .attr('font-size', '12')
    .attr('font-weight', '600')
    .text(d => `${FMT_NUM(d.sessions)} (${FMT_PCT(d.pct)})`);
}

function drawDonutChart() {
  const data = state.filteredData;
  if (!prepareContainer('donutContainer', data)) return;

  const total = data.length;
  const byType = d3.rollup(
    data,
    v => ({
      sessions: v.length,
      energy  : d3.sum(v, d => d.demand ?? 0),
    }),
    d => d.chargerType
  );

  const slices = [...byType.entries()].map(([type, v]) => ({
    type, ...v, pct: v.sessions / total
  })).sort((a,b) => b.sessions - a.sessions);

  const margin = { top: 15, right: 15, bottom: 25, left: 15 };
  const { w, h } = getDims('donutContainer', margin, 280);
  const cx = w / 2, cy = h / 2 - 15;
  const outerR = Math.min(cx, cy) * 0.76;
  const innerR = outerR * 0.58;

  const svg = d3.select('#donutContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const pie  = d3.pie().value(d => d.sessions).sort(null).padAngle(0.035);
  const arc  = d3.arc().innerRadius(innerR).outerRadius(outerR).cornerRadius(4);
  const arcs = pie(slices);

  g.selectAll('.arc-path')
    .data(arcs).join('path')
    .attr('class', 'arc-path')
    .attr('d', arc)
    .attr('fill', d => TYPE_COLOR(d.data.type))
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(d.data.type, [
      { label: 'Sessions',          value: FMT_NUM(d.data.sessions) },
      { label: 'Share of Grid',    value: FMT_PCT(d.data.pct) },
      { label: 'Total Energy (kWh)',value: FMT_NUM(Math.round(d.data.energy)) },
    ])))
    .on('mouseleave', hideTooltip);

  g.append('text').attr('text-anchor', 'middle').attr('y', -8)
    .attr('fill', '#9ca3af').attr('font-size', '11.5').text('TOTAL SESSIONS');
  g.append('text').attr('text-anchor', 'middle').attr('y', 14)
    .attr('fill', '#00E5FF').attr('font-size', '20').attr('font-weight', '700')
    .text(FMT_NUM(total));

  const legendG = svg.append('g').attr('transform', `translate(${cx - (slices.length * 95) / 2}, ${cy + outerR + 24})`);
  slices.forEach((s, i) => {
    const lg = legendG.append('g').attr('transform', `translate(${i * 105}, 0)`);
    lg.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3).attr('fill', TYPE_COLOR(s.type));
    lg.append('text').attr('x', 18).attr('y', 10).attr('fill', '#e5e7eb').attr('font-size', '11.5')
      .text(`${s.type}: ${FMT_PCT(s.pct)}`);
  });
}

function drawScatterPlot() {
  const allData = state.filteredData;
  if (!prepareContainer('scatterContainer', allData)) return;

  const validData = allData.filter(d =>
    d.duration > 0 && isFinite(d.duration) &&
    d.demand   >= 0 && isFinite(d.demand)
  );

  if (validData.length === 0) {
    prepareContainer('scatterContainer', []);
    return;
  }

  const sampleVal = document.getElementById('scatterSampleSelect')?.value || '5000';
  const maxPts    = sampleVal === 'all' ? Infinity : +sampleVal;
  const plotData  = validData.length > maxPts
    ? d3.shuffle([...validData]).slice(0, maxPts)
    : validData;

  const showTrend = document.getElementById('trendlineCheck')?.checked ?? true;

  const margin = { top: 25, right: 120, bottom: 55, left: 70 };
  const { w, h, innerW, innerH } = getDims('scatterContainer', margin, 340);

  const svg = d3.select('#scatterContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const clipId = 'scatter-clip-' + Math.random().toString(36).substring(2, 9);
  svg.append('defs').append('clipPath').attr('id', clipId)
    .append('rect').attr('width', innerW).attr('height', innerH);

  const xScale = d3.scaleLinear().domain([0, d3.max(plotData, d => d.duration) * 1.05]).range([0, innerW]).nice();
  const yScale = d3.scaleLinear().domain([0, d3.max(plotData, d => d.demand) * 1.05]).range([innerH, 0]).nice();

  g.append('g').attr('class', 'gridline').call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(''));
  g.append('g').attr('class', 'gridline').call(d3.axisBottom(xScale).tickSize(innerH).tickFormat(''));

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(FMT_NUM));
  g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(yScale).ticks(7).tickFormat(FMT_FLOAT));

  if (showTrend && plotData.length >= 2) {
    const n = plotData.length;
    const sumX  = d3.sum(plotData, d => d.duration);
    const sumY  = d3.sum(plotData, d => d.demand);
    const sumXX = d3.sum(plotData, d => d.duration * d.duration);
    const sumXY = d3.sum(plotData, d => d.duration * d.demand);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const xMin = d3.min(plotData, d => d.duration);
    const xMax = d3.max(plotData, d => d.duration);

    const meanX = sumX / n, meanY = sumY / n;
    const num = d3.sum(plotData, d => (d.duration - meanX) * (d.demand - meanY));
    const dX  = Math.sqrt(d3.sum(plotData, d => (d.duration - meanX) ** 2));
    const dY  = Math.sqrt(d3.sum(plotData, d => (d.demand - meanY) ** 2));
    const r   = (dX && dY) ? num / (dX * dY) : 0;

    g.append('line')
      .attr('clip-path', `url(#${clipId})`)
      .attr('x1', xScale(xMin)).attr('y1', yScale(xMin * slope + intercept))
      .attr('x2', xScale(xMax)).attr('y2', yScale(xMax * slope + intercept))
      .attr('stroke', COLOR_PINK).attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6, 3').attr('opacity', 0.9);

    g.append('text')
      .attr('x', 10).attr('y', 18)
      .attr('fill', COLOR_PINK).attr('font-size', '12').attr('font-weight', '600')
      .text(`Linear Regression r = ${d3.format('.3f')(r)}`);
  }

  g.append('g').attr('clip-path', `url(#${clipId})`)
    .selectAll('.scatter-dot')
    .data(plotData).join('circle')
    .attr('class', 'scatter-dot')
    .attr('cx', d => xScale(d.duration))
    .attr('cy', d => yScale(d.demand))
    .attr('r', 3.5)
    .attr('fill', d => TYPE_COLOR(d.chargerType))
    .attr('opacity', 0.6)
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(`Station #${d.chargerID}`, [
      { label: 'Standard',       value: d.chargerType },
      { label: 'Location',       value: d.location },
      { label: 'Duration (min)', value: FMT_FLOAT(d.duration) },
      { label: 'Energy (kWh)',   value: FMT_FLOAT(d.demand) },
    ])))
    .on('mouseleave', hideTooltip);
}

document.getElementById('scatterSampleSelect')?.addEventListener('change', drawScatterPlot);
document.getElementById('trendlineCheck')?.addEventListener('change', drawScatterPlot);

function drawHeatMap() {
  const data = state.filteredData;
  if (!prepareContainer('heatmapContainer', data)) return;

  const validRows = data.filter(d => d.startDatetime !== null);
  if (validRows.length === 0) {
    document.getElementById('heatmapContainer').innerHTML =
      '<div class="chart-empty-msg">No parseable datetime records available.</div>';
    return;
  }

  const matrix = new Map();
  const energyMatrix = new Map();

  for (const d of validRows) {
    const dt  = d.startDatetime;
    const jsDay = dt.getDay();
    const monDay = jsDay === 0 ? 6 : jsDay - 1;
    const hour   = dt.getHours();
    const key    = `${monDay}_${hour}`;

    matrix.set(key, (matrix.get(key) || 0) + 1);
    if (d.demand !== null) {
      energyMatrix.set(key, (energyMatrix.get(key) || 0) + d.demand);
    }
  }

  const maxVal = Math.max(...matrix.values(), 1);
  heatColor.domain([0, maxVal]);

  const margin = { top: 25, right: 30, bottom: 70, left: 80 };
  const { w, innerW, innerH } = getDims('heatmapContainer', margin, 320);
  const h = innerH + margin.top + margin.bottom;

  const cellW = Math.floor(innerW / 24);
  const cellH = Math.floor(innerH / 7);

  const svg = d3.select('#heatmapContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let hour = 0; hour < 24; hour++) {
      const key    = `${dayIdx}_${hour}`;
      const count  = matrix.get(key) || 0;
      const energy = energyMatrix.get(key) || 0;

      g.append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', hour * cellW)
        .attr('y', dayIdx * cellH)
        .attr('width', cellW - 2)
        .attr('height', cellH - 2)
        .attr('rx', 3)
        .attr('fill', count === 0 ? '#111827' : heatColor(count))
        .on('mousemove', e => showTooltip(e, buildTooltipHTML(
          `${DAYS_OF_WEEK[dayIdx]} @ ${String(hour).padStart(2, '0')}:00`,
          [
            { label: 'Sessions',        value: FMT_NUM(count) },
            { label: '% of Filtered',   value: FMT_PCT(count / validRows.length) },
            { label: 'Cumulative Energy',value: `${FMT_NUM(Math.round(energy))} kWh` },
          ]
        )))
        .on('mouseleave', hideTooltip);
    }
  }

  DAYS_OF_WEEK.forEach((day, i) => {
    g.append('text')
      .attr('x', -10).attr('y', i * cellH + cellH / 2)
      .attr('text-anchor', 'end').attr('dominant-baseline', 'central')
      .attr('fill', '#9ca3af').attr('font-size', '11.5')
      .text(day.substring(0, 3));
  });

  HOURS_OF_DAY.forEach(h => {
    if (h % 2 === 0) {
      g.append('text')
        .attr('x', h * cellW + cellW / 2)
        .attr('y', 7 * cellH + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9ca3af').attr('font-size', '10.5')
        .text(`${String(h).padStart(2, '0')}:00`);
    }
  });

  const lgW = Math.min(innerW, 260), lgH = 10;
  const lgX = innerW / 2 - lgW / 2;
  const lgY = 7 * cellH + 36;

  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', 'heatGrad');
  for (let i = 0; i <= 10; i++) {
    grad.append('stop')
      .attr('offset', `${i * 10}%`)
      .attr('stop-color', heatColor(maxVal * i / 10));
  }

  g.append('rect')
    .attr('x', lgX).attr('y', lgY)
    .attr('width', lgW).attr('height', lgH).attr('rx', 3)
    .attr('fill', 'url(#heatGrad)');

  g.append('text').attr('x', lgX).attr('y', lgY + 22)
    .attr('fill', '#6b7280').attr('font-size', '10.5').text('Low (0)');
  g.append('text').attr('x', lgX + lgW).attr('y', lgY + 22)
    .attr('text-anchor', 'end').attr('fill', '#6b7280').attr('font-size', '10.5')
    .text(`Peak (${FMT_NUM(maxVal)})`);
}

function drawTopStationsChart() {
  const data = state.filteredData;
  if (!prepareContainer('topStationsContainer', data)) return;

  const byCharger = d3.rollup(
    data,
    v => ({
      sessions: v.length,
      energy  : d3.sum(v, d => d.demand ?? 0),
      avgDur  : d3.mean(v.filter(d => d.duration > 0), d => d.duration) ?? 0,
      topLoc  : topValue(v.map(d => d.location)),
      type    : v[0].chargerType,
    }),
    d => d.chargerID
  );

  const ranked = [...byCharger.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a,b) => b.sessions - a.sessions)
    .slice(0, 20);

  if (ranked.length === 0) {
    prepareContainer('topStationsContainer', []);
    return;
  }

  const margin = { top: 15, right: 80, bottom: 40, left: 110 };
  const barH   = 28;
  const h      = ranked.length * barH + margin.top + margin.bottom;
  const { w, innerW } = getDims('topStationsContainer', margin, h);
  const innerH = ranked.length * barH;

  const svg = d3.select('#topStationsContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, d3.max(ranked, d => d.sessions) * 1.14]).range([0, innerW]).nice();
  const yScale = d3.scaleBand().domain(ranked.map(d => `Station #${d.id}`)).range([0, innerH]).padding(0.25);

  g.append('g').attr('class', 'gridline').call(d3.axisTop(xScale).tickSize(-innerH).tickFormat(''));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xScale).ticks(6).tickFormat(FMT_NUM));

  g.selectAll('.bar-rect')
    .data(ranked).join('rect')
    .attr('class', 'bar-rect')
    .attr('x', 0)
    .attr('y', d => yScale(`Station #${d.id}`))
    .attr('width', d => xScale(d.sessions))
    .attr('height', yScale.bandwidth())
    .attr('rx', 4)
    .attr('fill', d => TYPE_COLOR(d.type))
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(`Station #${d.id}`, [
      { label: 'Standard',          value: d.type },
      { label: 'Sessions',          value: FMT_NUM(d.sessions) },
      { label: 'Total Energy (kWh)',value: FMT_NUM(Math.round(d.energy)) },
      { label: 'Avg Duration (min)',value: FMT_FLOAT(d.avgDur) },
      { label: 'Location Category', value: d.topLoc },
    ])))
    .on('mouseleave', hideTooltip)
    .on('click', (_, d) => selectStationById(d.id, true));

  g.selectAll('.bar-val-label')
    .data(ranked).join('text')
    .attr('x', d => xScale(d.sessions) + 6)
    .attr('y', d => yScale(`Station #${d.id}`) + yScale.bandwidth() / 2)
    .attr('dominant-baseline', 'central')
    .attr('fill', '#e5e7eb').attr('font-size', '11').attr('font-weight', '600')
    .text(d => FMT_NUM(d.sessions));
}

let cachedTableRows = [];

function drawStationTable() {
  const data = state.filteredData;
  const tableBody = document.querySelector('#stationTable tbody');
  if (!tableBody) return;

  tableBody.innerHTML = '';
  if (!data || data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" style="text-align:center;padding:24px;color:#6b7280;">No matching station records found.</td>';
    tableBody.appendChild(tr);
    return;
  }

  const byStation = d3.rollup(
    data,
    v => ({
      company : v[0].chargerCompany || '—',
      location: v[0].location || '—',
      type    : v[0].chargerType || '—',
      sessions: v.length,
      avgDur  : d3.mean(v.filter(d => d.duration > 0), d => d.duration) ?? 0,
      energy  : d3.sum(v, d => d.demand ?? 0),
    }),
    d => d.chargerID
  );

  cachedTableRows = [...byStation.entries()]
    .map(([chargerID, info]) => ({ chargerID, ...info }))
    .sort((a,b) => b.sessions - a.sessions || String(a.chargerID).localeCompare(String(b.chargerID)));

  renderTableFiltered('');
}

function renderTableFiltered(searchTerm) {
  const tableBody = document.querySelector('#stationTable tbody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const term = searchTerm.toLowerCase().trim();
  const rows = term
    ? cachedTableRows.filter(r =>
        String(r.chargerID).toLowerCase().includes(term) ||
        String(r.location).toLowerCase().includes(term) ||
        String(r.type).toLowerCase().includes(term)
      )
    : cachedTableRows.slice(0, 60);

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" style="text-align:center;padding:24px;color:#6b7280;">No stations match the search query.</td>';
    tableBody.appendChild(tr);
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${esc(r.chargerID)}</td>
      <td>${esc(r.company)}</td>
      <td>${esc(r.location)}</td>
      <td><span style="color:${TYPE_COLOR(r.type)};font-weight:600;">${esc(r.type)}</span></td>
      <td><strong>${FMT_NUM(r.sessions)}</strong></td>
      <td>${FMT_FLOAT(r.avgDur)} min</td>
      <td>${FMT_NUM(Math.round(r.energy))} kWh</td>
    `;
    tr.addEventListener('click', () => selectStationById(r.chargerID, true));
    tableBody.appendChild(tr);
  });
}

document.getElementById('tableSearchInput')?.addEventListener('input', function() {
  renderTableFiltered(this.value);
});

function drawLocationChart() {
  const data = state.filteredData;
  if (!prepareContainer('locationContainer', data)) return;

  const total = data.length;
  const byLoc = d3.rollup(
    data,
    v => ({
      sessions: v.length,
      energy  : d3.sum(v, d => d.demand ?? 0),
      avgDur  : d3.mean(v.filter(d => d.duration > 0), d => d.duration) ?? 0,
    }),
    d => d.location
  );

  const locSeries = [...byLoc.entries()]
    .map(([loc, v]) => ({ loc, ...v, pct: v.sessions / total }))
    .sort((a,b) => b.sessions - a.sessions);

  if (locSeries.length === 0) {
    prepareContainer('locationContainer', []);
    return;
  }

  const margin = { top: 15, right: 80, bottom: 40, left: 140 };
  const barH   = 28;
  const h      = locSeries.length * barH + margin.top + margin.bottom;
  const { w, innerW } = getDims('locationContainer', margin, h);
  const innerH = locSeries.length * barH;

  const svg = d3.select('#locationContainer')
    .append('svg').attr('class', 'chart-svg')
    .attr('width', w).attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleLinear().domain([0, d3.max(locSeries, d => d.sessions) * 1.12]).range([0, innerW]).nice();
  const yScale = d3.scaleBand().domain(locSeries.map(d => d.loc)).range([0, innerH]).padding(0.25);

  g.append('g').attr('class', 'gridline').call(d3.axisTop(xScale).tickSize(-innerH).tickFormat(''));
  g.append('g').attr('class', 'axis').call(d3.axisLeft(yScale).tickSize(0)).select('.domain').remove();
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xScale).ticks(6).tickFormat(FMT_NUM));

  g.selectAll('.bar-rect')
    .data(locSeries).join('rect')
    .attr('class', 'bar-rect')
    .attr('x', 0)
    .attr('y', d => yScale(d.loc))
    .attr('width', d => xScale(d.sessions))
    .attr('height', yScale.bandwidth())
    .attr('rx', 4)
    .attr('fill', COLOR_VIOLET)
    .on('mousemove', (e, d) => showTooltip(e, buildTooltipHTML(d.loc, [
      { label: 'Sessions',          value: FMT_NUM(d.sessions) },
      { label: '% of Total',        value: FMT_PCT(d.pct) },
      { label: 'Total Energy (kWh)',value: FMT_NUM(Math.round(d.energy)) },
      { label: 'Avg Duration (min)',value: FMT_FLOAT(d.avgDur) },
    ])))
    .on('mouseleave', hideTooltip);

  g.selectAll('.bar-val-label')
    .data(locSeries).join('text')
    .attr('x', d => xScale(d.sessions) + 6)
    .attr('y', d => yScale(d.loc) + yScale.bandwidth() / 2)
    .attr('dominant-baseline', 'central')
    .attr('fill', '#e5e7eb').attr('font-size', '11').attr('font-weight', '600')
    .text(d => `${FMT_NUM(d.sessions)} (${FMT_PCT(d.pct)})`);
}

/* ═══════════════════════════════════════════════════════
   16. SYNTHESIZED GRID INTELLIGENCE & HEURISTICS
═══════════════════════════════════════════════════════ */
function updateInsights() {
  const data = state.filteredData;
  const total = data.length;
  if (total === 0) return;

  const insights = [];

  const byType = d3.rollup(data, v => v.length, d => d.chargerType);
  const dominantType = [...byType.entries()].sort((a,b) => b[1] - a[1])[0];
  if (dominantType) {
    const isAc = dominantType[0] === 'Slow AC';
    insights.push(`<strong>${dominantType[0]} Hub</strong> is the dominant infrastructure standard with 
      <strong>${FMT_NUM(dominantType[1])}</strong> sessions 
      (<strong>${FMT_PCT(dominantType[1] / total)}</strong> of grid activity across ${isAc ? 'Hub Alpha' : 'Hub Beta'}).`);
  }

  const byHour = d3.rollup(
    data.filter(d => d.startDatetime),
    v => v.length, d => d.startDatetime.getHours()
  );
  const peakHour = [...byHour.entries()].sort((a,b) => b[1] - a[1])[0];
  if (peakHour) {
    insights.push(`System-wide peak demand occurs at <strong>${String(peakHour[0]).padStart(2, '0')}:00</strong> 
      with <strong>${FMT_NUM(peakHour[1])}</strong> concurrent session connections recorded.`);
  }

  const byLoc = d3.rollup(data, v => v.length, d => d.location);
  const topLoc = [...byLoc.entries()].sort((a,b) => b[1] - a[1])[0];
  if (topLoc && topLoc[0]) {
    insights.push(`High-density charging hotspot: <strong>${topLoc[0]}</strong> 
      accounts for <strong>${FMT_NUM(topLoc[1])}</strong> sessions 
      (<strong>${FMT_PCT(topLoc[1] / total)}</strong>).`);
  }

  const durs = data.map(d => d.duration).filter(v => v > 0);
  if (durs.length) {
    insights.push(`Average valid session dwell time is <strong>${FMT_FLOAT(d3.mean(durs))} minutes</strong> 
      across <strong>${FMT_NUM(durs.length)}</strong> operational sessions.`);
  }

  const totalEnergy = d3.sum(data, d => d.demand ?? 0);
  insights.push(`Cumulative grid energy delivered: <strong>${FMT_NUM(Math.round(totalEnergy))} kWh</strong> 
    across all filtered campus stations.`);

  const container = document.getElementById('insightsGrid');
  if (container) {
    container.innerHTML = insights
      .map(i => `<div class="insight-item">${i}</div>`)
      .join('');
  }
}

function topValue(arr) {
  if (!arr || arr.length === 0) return '—';
  const freq = new Map();
  for (const v of arr) freq.set(v, (freq.get(v) || 0) + 1);
  return [...freq.entries()].sort((a,b) => b[1] - a[1])[0][0] || '—';
}

/* ═══════════════════════════════════════════════════════
   17. UI STATE HANDLERS & FULLSCREEN CONTROLS
═══════════════════════════════════════════════════════ */
function setStatusOK(msg) {
  const dot = document.querySelector('.status-dot');
  if (dot) dot.className = 'status-dot status-dot--ok';
  const txt = document.getElementById('statusText');
  if (txt) txt.textContent = msg;
}
function setStatusLoading(msg) {
  const dot = document.querySelector('.status-dot');
  if (dot) dot.className = 'status-dot status-dot--loading';
  const txt = document.getElementById('statusText');
  if (txt) txt.textContent = msg;
}
function setStatusIdle(msg) {
  const dot = document.querySelector('.status-dot');
  if (dot) dot.className = 'status-dot status-dot--idle';
  const txt = document.getElementById('statusText');
  if (txt) txt.textContent = msg;
}

function showError(msg) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 10000;
    background: rgba(239, 68, 68, 0.95); backdrop-filter: blur(8px);
    color: #ffffff; padding: 14px 22px; border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3); font-weight: 600;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5); font-size: 13px;
  `;
  toast.textContent = '⚠️ ' + msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showLoading(msg) {
  setStatusLoading(msg);
}
function hideLoading() {}

function showDashboard() {
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'none';
  const content = document.getElementById('dashboardContent');
  if (content) content.style.display = '';

  initTiltEffect();
}

function updateDataQualityPanel() {
  const panel = document.getElementById('dataQuality');
  if (panel) panel.style.display = '';
  document.getElementById('dqTotal').textContent    = FMT_NUM(state.totalLoaded);
  document.getElementById('dqVehicles').textContent = FMT_NUM(new Set(state.rawData.map(d => d.userID)).size);
  document.getElementById('dqValid').textContent    = FMT_NUM(state.rawData.length);
  document.getElementById('dqExcluded').textContent = FMT_NUM(state.excludedDuration);
}

function showEmptyFilterMessage() {
  const content = document.getElementById('dashboardContent');
  if (content) content.style.display = '';
  const ins = document.getElementById('insightsPanel');
  if (ins) {
    ins.innerHTML = `<div style="padding:24px;color:#FF9F43;font-weight:600;">
      ⚠️ No records match current filter parameters. Try expanding date boundaries or selecting 'All' locations.
    </div>`;
  }
}

function hideEmptyFilterMessage() {
  const ins = document.getElementById('insightsPanel');
  if (ins && !ins.querySelector('.insights-grid')) {
    ins.innerHTML = `
      <div class="insights-header">
        <div class="insights-badge">
          <span class="pulse-ring"></span>
          <span>SYNTHESIZED HEURISTICS</span>
        </div>
        <h2 class="insights-panel__title">🔍 Automated Analytical Insights & Grid Intelligence</h2>
      </div>
      <div class="insights-grid" id="insightsGrid"></div>
    `;
  }
}

// Sidebar Collapse / Expand Toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  const layout = document.getElementById('mainLayout');
  if (!layout) return;
  layout.classList.toggle('sidebar-collapsed');

  setTimeout(() => {
    onCampusResize();
    onVehicleStudioResize();
    updateAllCharts();
    if (state.vehicleSessions.length) drawVehicleAnalyticsCharts(state.vehicleSessions);
  }, 360);
});

// Fullscreen Toggle
document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.warn(err));
  } else {
    document.exitFullscreen().catch(err => console.warn(err));
  }
});

/* ═══════════════════════════════════════════════════════
   18. BOOTSTRAP & INITIALIZATION
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  tryLoadDefaultCSV();
});
