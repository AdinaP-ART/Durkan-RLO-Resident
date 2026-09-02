/* ============================================================
   app.js — Durkan Regen v6
   Features: QR auto-login · per-flat QR letter generator
             RLO pop-up notifications · During Works
             Issue reporting · slot locking · feedback
============================================================ */

const pendingSlots = {};
const starRatings  = {};
let defectIdCounter = 1;
let selectedPhoto   = null;
let duringWorksList = [];

/* ============================================================
   AUTO-LOGIN FROM QR CODE URL
   e.g. ?code=DRK-F14-2847
============================================================ */
function checkUrlCode() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const letter = params.get('letter');
  if (letter) openLetterAfterLoad = letter;
  if (code) {
    const inp = document.getElementById('res-code');
    if (inp) { inp.value = code.toUpperCase(); resLogin(true); }
  }
}

/* ============================================================
   SMS via Twilio (through Vercel serverless function)
============================================================ */
async function sendSMS(to, body) {
  if (!to) { console.log('No mobile number — SMS skipped'); return { skipped: true }; }
  try {
    const res = await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body }),
    });
    const data = await res.json();
    if (data.success) {
      console.log('SMS sent:', data.sid);
    } else {
      console.warn('SMS failed:', data.error);
    }
    return data;
  } catch (err) {
    console.warn('SMS error (function may not be deployed yet):', err.message);
    return { success: false, error: err.message };
  }
}

/* ============================================================
   LANDING
============================================================ */
function startAs(role) {
  document.getElementById('landing').style.display = 'none';
  if (role === 'res') {
    document.getElementById('res-shell').classList.add('active');
    buildResNav(0);
    checkUrlCode();
  } else {
    document.getElementById('rlo-shell').classList.add('active');
    buildRloNav(0);
  }
}

function logout(role) {
  if (role === 'res') {
    db.currentResident = null;
    document.getElementById('res-chip').style.display = 'none';
    document.getElementById('res-shell').classList.remove('active');
    resShowPage('rp-login');
    buildResNav(0);
  } else {
    db.currentRLO = null;
    document.getElementById('rlo-chip').style.display = 'none';
    document.getElementById('rlo-shell').classList.remove('active');
    rloShowPage('bp-login');
    buildRloNav(0);
  }
  document.getElementById('landing').style.display = 'flex';
}

/* ============================================================
   RESIDENT NAV
============================================================ */
const resPageMap = { 1:'rp-home', 2:'rp-appts', 3:'rp-defects', 4:'rp-message', 5:'rp-faq', 6:'rp-feedback', 7:'rp-during', 8:'rp-colours', 9:'rp-updates', 10:'rp-infopack', 11:'rp-maintenance', 12:'rp-my-letters' };
const resNavDef  = [
  { i:1,  icon:'ti-home',           label:'Home' },
  { i:10, icon:'ti-book',           label:'Resident Information Pack' },
  { i:2,  icon:'ti-calendar',       label:'Choose Your Start Date' },
  { i:7,  icon:'ti-hard-hat',       label:'During Works' },
  { i:8,  icon:'ti-photo',          label:'Examples of Finished Work' },
  { i:9,  icon:'ti-speakerphone',   label:'Updates & Events' },
  { i:12, icon:'ti-mail-opened',    label:'My Letters' },
  { i:3,  icon:'ti-alert-triangle', label:'Report an Issue' },
  { i:4,  icon:'ti-mail',           label:'Message Durkan' },
  { i:5,  icon:'ti-help',           label:'FAQ & Guides' },
  { i:6,  icon:'ti-star',           label:'Satisfaction Survey' },
  { i:11, icon:'ti-tool',           label:'Maintenance & User Guide' },
];let curResPage = 0;

function buildResNav(cur) {
  document.getElementById('res-nav').innerHTML = resNavDef.map(n =>
    `<button class="si${n.i===cur?' on':''}" onclick="rNav(${n.i})"><i class="ti ${n.icon}"></i>${n.label}</button>`
  ).join('');
  const s = document.getElementById('res-story');
  if (s) s.textContent = db.currentResident
    ? `Logged in as ${db.currentResident.resident} · ${db.currentResident.flat}.`
    : 'Scan your QR code or enter your access code from your welcome letter.';
}

function resShowPage(id) {
  document.querySelectorAll('#res-shell .page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function rNav(i) {
  if (i > 0 && !db.currentResident) { resShowPage('rp-login'); buildResNav(0); return; }
  curResPage = i;
  resShowPage(resPageMap[i] || 'rp-home');
  buildResNav(i);
  if (i === 2) renderResAppts();
  if (i === 3) renderResDefects();
  if (i === 7) renderDuringWorksResident();
  if (i === 8) renderColoursResident();
  if (i === 9) renderUpdatesResident();
  if (i === 12) renderMyLetters();
}

/* ============================================================
   RLO NAV
============================================================ */
const rloPageMap = { 1:'bp-dashboard', 2:'bp-upload', 3:'bp-during', 4:'bp-defects', 5:'bp-messages', 6:'bp-reports', 7:'bp-letters', 8:'bp-colours', 9:'bp-updates', 10:'bp-mandatory' };
const rloNavDef  = [
  { i:1, icon:'ti-layout-dashboard', label:'Dashboard' },
  { i:2, icon:'ti-upload',           label:'Pre Works Schedule' },
  { i:3, icon:'ti-hard-hat',         label:'During Works' },
  { i:8, icon:'ti-photo',            label:'Finished Work Photos' },
  { i:9, icon:'ti-speakerphone',     label:'Updates & Events' },
  { i:4, icon:'ti-alert-triangle',   label:'Issues' },
  { i:5, icon:'ti-mail',             label:'Messages' },
  { i:7, icon:'ti-mail-forward',     label:'Resident Letters' },
  { i:10, icon:'ti-file-text',       label:'Mandatory Letters' },
  { i:6, icon:'ti-chart-bar',        label:'Reports' },
];
let curRloPage = 0;

function buildRloNav(cur) {
  document.getElementById('rlo-nav').innerHTML = rloNavDef.map(n =>
    `<button class="si${n.i===cur?' on':''}" onclick="bNav(${n.i})"><i class="ti ${n.icon}"></i>${n.label}</button>`
  ).join('');
  const mob = document.getElementById('rlo-mobile-nav');
  if (mob) {
    mob.value = cur || 1;
    if (db.currentRLO) mob.classList.add('show');
    else mob.classList.remove('show');
  }
}

function rloShowPage(id) {
  document.querySelectorAll('#rlo-shell .page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function bNav(i) {
  if (i > 0 && !db.currentRLO) { rloShowPage('bp-login'); buildRloNav(0); return; }
  curRloPage = i;
  rloShowPage(rloPageMap[i] || 'bp-dashboard');
  buildRloNav(i);
  if (i === 1) renderDashboard();
  if (i === 2) renderEntryTable();
  if (i === 3) { renderDuringWorksRlo(); document.getElementById('during-review-panel').style.display = duringWorksList.length ? 'block' : 'none'; }
  if (i === 4) renderRloDefects();
  if (i === 6) renderReports();
  if (i === 7) renderLettersPage();
  if (i === 8) renderColoursRlo();
  if (i === 9) renderUpdatesRlo();
  if (i === 10) renderMandatoryLettersPage();
}

/* ============================================================
   LOGIN
============================================================ */
async function resLogin(auto = false) {
  const raw = (document.getElementById('res-code')?.value || '').trim().toUpperCase();
  const err = document.getElementById('res-err');
  const inp = document.getElementById('res-code');
  const demo  = DEMO_CODES[raw];
  const sched = db.schedule.find(e => e.accessCode === raw);
  const match = demo || sched;
  if (match) {
    db.currentResident = { flat: match.flat, resident: match.resident, accessCode: raw };
    const locationLabel = match.address ? match.address.split(',')[0] : 'Highbury Gardens';
    document.getElementById('r-hello').textContent  = 'Hello, ' + match.resident.split(' ')[0];
    document.getElementById('r-addr').textContent   = match.flat + ' · ' + locationLabel;
    document.getElementById('r-appts-hdr').textContent = match.flat + ' · ' + locationLabel;
    const chip = document.getElementById('res-chip');
    chip.textContent = '🔒 ' + match.flat; chip.style.display = 'inline-block';
    await loadReadUpdatesForResident();
    renderResidentHome();
    if (openLetterAfterLoad) {
      rNav(12);
    } else {
      rNav(1);
      setTimeout(() => showResidentUpdatePopup(), 800);
    }
  } else if (!auto) {
    if (inp) inp.classList.add('error');
    if (err) err.style.display = 'block';
    setTimeout(() => { inp?.classList.remove('error'); if(err) err.style.display='none'; }, 3000);
  }
}

async function rloLogin() {
  const raw = (document.getElementById('rlo-code')?.value || '').trim().toUpperCase();
  const err = document.getElementById('rlo-err');
  let match = null;
  try {
    const { data, error } = await sb.from('rlo_users').select('name, role').eq('passcode', raw).eq('active', true).maybeSingle();
    if (!error && data) match = { name: data.name, role: data.role };
  } catch (e) { console.warn('RLO login DB check failed, using local fallback:', e.message); }
  if (!match) match = RLO_CODES[raw];
  if (match) {
    db.currentRLO = match;
    const chip = document.getElementById('rlo-chip');
    chip.textContent = '👤 ' + match.name + ' · ' + match.role;
    chip.style.display = 'inline-block';
    bNav(1);
    setTimeout(() => showPendingNotifications(), 500);
  } else {
    if (err) { err.style.display = 'block'; setTimeout(() => err.style.display='none', 3000); }
  }
}

/* ============================================================
   RLO NOTIFICATIONS
============================================================ */
function pushNotification(type, message) {
  db.notifications.push({ type, message, time: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }), read: false });
  if (db.currentRLO) showPendingNotifications();
  updateNotifBadge();
}

function showPendingNotifications() {
  const unread = db.notifications.filter(n => !n.read);
  if (!unread.length) return;
  unread.forEach(n => {
    n.read = true;
    showRloPopup(n.type, n.message, n.time);
  });
  updateNotifBadge();
}

function showRloPopup(type, message, time) {
  document.getElementById('rlo-notif-popup')?.remove();
  const icons = { appointment:'ti-calendar-check', issue:'ti-alert-triangle', message:'ti-message' };
  const colors = { appointment:'var(--green)', issue:'var(--red)', message:'var(--amber)' };
  const popup = document.createElement('div');
  popup.id = 'rlo-notif-popup';
  popup.style.cssText = `position:fixed;top:70px;right:20px;z-index:9999;background:var(--dw);border:1.5px solid var(--dg);border-radius:12px;padding:14px 16px;box-shadow:0 4px 20px rgba(0,40,86,.15);max-width:300px;display:flex;gap:10px;align-items:flex-start;animation:slideIn .2s ease`;
  popup.innerHTML = `
    <div style="width:36px;height:36px;border-radius:9px;background:${colors[type]||'var(--dj)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.15;position:absolute"></div>
    <div style="width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${colors[type]||'var(--dj)'}"><i class="ti ${icons[type]||'ti-bell'}" style="font-size:18px"></i></div>
    <div style="flex:1">
      <div style="font-size:12px;font-weight:700;color:var(--db);margin-bottom:2px">New notification</div>
      <div style="font-size:11px;color:var(--dgd);line-height:1.4">${message}</div>
      <div style="font-size:10px;color:var(--dg);margin-top:4px">${time}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--dg);font-size:16px;padding:0;line-height:1">×</button>`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 12000);
}

function updateNotifBadge() {
  const unread = db.notifications.filter(n => !n.read).length;
  const badge  = document.getElementById('rlo-notif-badge');
  if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-flex' : 'none'; }
}

/* ============================================================
   UTILITY
============================================================ */
function genCode(flatOrUrpn) {
  // Prefer a clean alphanumeric base from a URPN if one looks present (letters+digits, 8+ chars);
  // otherwise fall back to pulling digits out of a flat/address name.
  const raw = (flatOrUrpn || '').trim();
  const looksLikeUrpn = /^[A-Za-z0-9]{6,}$/.test(raw.replace(/\s/g,''));
  const base = looksLikeUrpn ? raw.replace(/\s/g,'').slice(-6).toUpperCase() : raw.replace(/\D/g,'').padStart(2,'0');
  return `DRK-${base}-${Math.floor(1000+Math.random()*9000)}`;
}
function showToast(id, msg, cls='t-j', dur=3500) {
  const el = document.getElementById(id); if (!el) return;
  el.className=`toast ${cls}`; el.textContent=msg; el.style.display='block';
  setTimeout(() => el.style.display='none', dur);
}
function phToast(id, msg, type='') {
  const t = document.getElementById(id); if (!t) return;
  t.className='ph-toast'+(type?' '+type:''); t.textContent=msg; t.style.display='block';
  setTimeout(() => t.style.display='none', 3500);
}
function toggleFaq(el) {
  const a = el.querySelector('.faq-a');
  if (a) a.style.display = a.style.display==='block'?'none':'block';
}
function getCol(row, ...keys) {
  for (const k of keys) {
    const f = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_-]/g,'') === k.toLowerCase().replace(/[\s_-]/g,''));
    if (f && row[f]) return String(row[f]).trim();
  }
  return '';
}

/* ============================================================
   EXCEL UPLOAD — Pre Works schedule
============================================================ */
function handleFile(evt) {
  const file = evt.target.files[0]; if (!file) return;
  const prog = document.getElementById('upload-prog');
  const fill = document.getElementById('prog-fill');
  prog.style.display='block'; fill.style.width='0%';
  document.getElementById('prog-lbl').textContent=`Reading ${file.name}...`;
  let pct=0;
  const iv = setInterval(() => { pct=Math.min(pct+15,90); fill.style.width=pct+'%'; }, 100);
  const reader = new FileReader();
  reader.onload = function(e) {
    clearInterval(iv); fill.style.width='100%';
    setTimeout(() => {
      prog.style.display='none'; fill.style.width='0%';
      try {
        const wb   = XLSX.read(e.target.result,{type:'array'});
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws,{defval:''});
        parseRows(rows, file.name);
      } catch { showToast('parse-toast','Could not read file. Check column format.','t-r'); }
    }, 300);
  };
  reader.readAsArrayBuffer(file);
}

function parseRows(rows, filename) {
  // URPN is the true unique reference for a property — match on that first.
  // If a row has no URPN (e.g. quick manual entries), fall back to matching
  // on Address No + Address together, so different roads don't collide.
  const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
  const parsed = rows.map(r => {
    const urpn = getCol(r,'URPN','Urpn','PropertyRef','Reference');
    const flat = getCol(r,'AddressNo','Address No','Flat','FlatNo','Unit');
    const address = getCol(r,'Address','FullAddress','PostalAddress','Address1','RestOfAddress');
    const existing = urpn
      ? db.schedule.find(e => e.urpn && norm(e.urpn) === norm(urpn))
      : db.schedule.find(e => norm(e.flat) === norm(flat) && norm(e.address||'') === norm(address));
    return {
      urpn, flat, address,
      resident:  getCol(r,'Resident','ResidentName','Name','Tenant'),
      workType:  getCol(r,'WorkType','Work Type','Work','Type','Job'),
      mobile:    getCol(r,'Mobile','MobileNumber','Mobile Number','Phone','Tel','Contact'),
      slots:     [getCol(r,'Date1','Date 1'),getCol(r,'Date2','Date 2'),getCol(r,'Date3','Date 3')].filter(Boolean),
      status: existing ? existing.status : 'pending',
      confirmedDate: existing ? existing.confirmedDate : '',
      locked: existing ? existing.locked : false,
      accessCode: existing ? existing.accessCode : '',
      contactLog: existing ? (existing.contactLog||[]) : [],
      id: existing ? existing.id : undefined,
    };
  }).filter(r => r.flat);
  if (!parsed.length) { showToast('parse-toast','No valid rows found. Check column headers.','t-r'); return; }
  parsed.forEach(e => { if (!e.accessCode) e.accessCode = genCode(e.urpn || e.flat); });
  db.schedule = parsed;
  renderEntryTable();
  showToast('parse-toast',`✓ ${filename} — ${parsed.length} entries loaded. Click Publish to save.`,'t-g',5000);
}

function loadDemo() {
  db.schedule = DEMO_SCHEDULE.map(e => ({...e}));
  renderEntryTable();
  showToast('parse-toast','✓ Demo schedule loaded. Click Publish to save.','t-g');
}

function renderEntryTable() {
  const tbody = document.getElementById('entry-tbody'); if (!tbody) return;
  tbody.innerHTML = db.schedule.map((e,i) => `
    <tr>
      <td><input style="width:90px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.urpn||''}" placeholder="URPN" onchange="db.schedule[${i}].urpn=this.value"/></td>
      <td><input style="width:110px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.flat}" onchange="db.schedule[${i}].flat=this.value"/></td>
      <td><input style="width:150px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.address||''}" placeholder="e.g. 14 Grove Road, N5 2AB" onchange="db.schedule[${i}].address=this.value"/></td>
      <td><input style="width:100px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.resident}" onchange="db.schedule[${i}].resident=this.value"/></td>
      <td><input style="width:110px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.workType}" onchange="db.schedule[${i}].workType=this.value"/></td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td style="font-size:10px;color:var(--dgd);line-height:1.6">${e.slots.join('<br>')||'—'}</td>
      <td><button class="btn btn-r btn-sm" onclick="db.schedule.splice(${i},1);renderEntryTable()"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
}

function addEntry() {
  db.schedule.push({urpn:'',flat:'Address',address:'',resident:'',workType:'Pre Works',accessCode:genCode('Address'),slots:[],status:'pending',confirmedDate:'',locked:false,contactLog:[]});
  renderEntryTable();
}

async function publishSchedule() {
  if (!db.schedule.length) { showToast('publish-toast','Add at least one entry first.','t-r'); return; }
  showToast('publish-toast','Saving to database...','t-j',8000);
  await saveScheduleToDB();
  db.published = true;
  await setPublishedInDB(true);
  showToast('publish-toast','✓ Published and saved — residents can now log in and select dates.','t-g',5000);
  renderDashboard();
  if (db.currentResident) renderResidentHome();
}

/* ============================================================
   DATABASE — Schedule & appointments (Supabase)
============================================================ */
function scheduleRowToLocal(r) {
  return {
    id: r.id,
    urpn: r.urpn || '',
    flat: r.flat,
    address: r.address || '',
    resident: r.resident,
    workType: r.work_type,
    mobile: r.mobile || '',
    slots: r.slots || [],
    status: r.status,
    confirmedDate: r.confirmed_date || '',
    locked: r.locked,
    accessCode: r.access_code,
    contactLog: [],
  };
}

function scheduleRowToDb(e) {
  return {
    urpn: e.urpn || null,
    flat: e.flat,
    address: e.address || null,
    resident: e.resident,
    work_type: e.workType,
    mobile: e.mobile || null,
    slots: e.slots || [],
    status: e.status,
    confirmed_date: e.confirmedDate || null,
    locked: !!e.locked,
    access_code: e.accessCode,
  };
}

async function loadScheduleFromDB() {
  try {
    const { data, error } = await sb.from('schedule').select('*').order('flat');
    if (error) { console.warn('Load schedule failed:', error.message); return; }
    if (data && data.length) {
      db.schedule = data.map(scheduleRowToLocal);
      await loadContactLogsFromDB();
      await loadWorkElementsFromDB();
    }
    const { data: state, error: stateErr } = await sb.from('project_state').select('published').eq('id', 1).single();
    if (!stateErr && state) db.published = !!state.published;
  } catch (err) {
    console.warn('Could not reach database — using local data for this session.', err.message);
  }
}

async function loadContactLogsFromDB() {
  const ids = db.schedule.map(e => e.id).filter(Boolean);
  if (!ids.length) return;
  const { data, error } = await sb.from('contact_log').select('*').in('schedule_id', ids).order('logged_at');
  if (error) { console.warn('Load contact log failed:', error.message); return; }
  db.schedule.forEach(e => { e.contactLog = []; });
  (data || []).forEach(row => {
    const e = db.schedule.find(x => x.id === row.schedule_id);
    if (e) e.contactLog.push({
      method: row.method, outcome: row.outcome, note: row.note || '',
      date: new Date(row.logged_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
      time: new Date(row.logged_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
    });
  });
}

async function loadWorkElementsFromDB() {
  const ids = db.schedule.map(e => e.id).filter(Boolean);
  db.schedule.forEach(e => { e.workElements = []; });
  if (!ids.length) return;
  try {
    const { data, error } = await sb.from('work_elements').select('*').in('schedule_id', ids).order('created_at');
    if (error) { console.warn('Load work elements failed:', error.message); return; }
    (data || []).forEach(row => {
      const e = db.schedule.find(x => x.id === row.schedule_id);
      if (e) e.workElements.push(workElementRowToLocal(row));
    });
  } catch (err) {
    console.warn('Load work elements error:', err.message);
  }
}

function workElementRowToLocal(r) {
  return {
    id: r.id, name: r.name, status: r.status || 'Not started',
    introLetterSent: r.intro_letter_sent || '', surveyBooked: r.survey_booked || '',
    surveyCompleted: r.survey_completed || '', startDate: r.start_date || '',
    access1Sent: r.access_1_sent || '', access2Sent: r.access_2_sent || '', access3Sent: r.access_3_sent || '',
  };
}

function workElementLocalToRow(scheduleId, el) {
  return {
    schedule_id: scheduleId, name: el.name, status: el.status,
    intro_letter_sent: el.introLetterSent || null, survey_booked: el.surveyBooked || null,
    survey_completed: el.surveyCompleted || null, start_date: el.startDate || null,
    access_1_sent: el.access1Sent || null, access_2_sent: el.access2Sent || null, access_3_sent: el.access3Sent || null,
  };
}

async function saveScheduleToDB() {
  if (!db.schedule.length) return;
  const rows = db.schedule.map(scheduleRowToDb);
  const { data, error } = await sb.from('schedule').upsert(rows, { onConflict: 'access_code' }).select();
  if (error) { console.warn('Save schedule failed:', error.message); showToast('publish-toast','Saved locally, but the database could not be reached.','t-r',6000); return; }
  if (data) {
    data.forEach(row => {
      const e = db.schedule.find(x => x.accessCode === row.access_code);
      if (e) e.id = row.id;
    });
  }
}

function updateScheduleRow(entry) {
  if (!entry.id) { saveScheduleToDB(); return; }
  sb.from('schedule').update(scheduleRowToDb(entry)).eq('id', entry.id)
    .then(({ error }) => { if (error) console.warn('Update schedule row failed:', error.message); });
}

function setPublishedInDB(val) {
  return sb.from('project_state').update({ published: val }).eq('id', 1)
    .then(({ error }) => { if (error) console.warn('Set published failed:', error.message); });
}

/* ============================================================
   RESIDENT LETTERS PAGE — generate per-flat PDF letters
============================================================ */
function renderLettersPage() {
  const wrap = document.getElementById('letters-wrap'); if (!wrap) return;
  if (!db.schedule.length) {
    wrap.innerHTML='<div class="panel" style="text-align:center;padding:32px;color:var(--dgd)"><i class="ti ti-mail-off" style="font-size:32px;display:block;margin:0 auto 10px;color:var(--dg)"></i><p>Upload and publish a schedule first to generate resident letters.</p></div>';
    return;
  }
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel-t">Generate resident letters <span class="spill sp-b">${db.schedule.length} flats</span></div>
      <p style="font-size:12px;color:var(--dgd);margin-bottom:14px">Each letter includes the resident's name, flat number, their unique access code, and a personal QR code that opens the app and logs them in automatically when scanned.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-j" onclick="generateAllLetters()"><i class="ti ti-printer"></i> Print all letters</button>
      </div>
      <div class="toast t-g" id="letters-toast" style="display:none"></div>
    </div>
    <div class="panel">
      <div class="panel-t">Letters preview</div>
      <div style="overflow-x:auto">
        <table class="tbl">
          <thead><tr><th>Flat</th><th>Resident</th><th>Access code</th><th>QR code</th><th>Print</th></tr></thead>
          <tbody id="letters-tbody">
            <tr><td colspan="5" style="text-align:center;color:var(--dgd);padding:16px">Generating QR codes...</td></tr>
          </tbody>
        </table>
      </div>
    </div>`;
  const qrUrls = generateQrDataUrls(db.schedule);
  const tbody = document.getElementById('letters-tbody');
  if (tbody) {
    tbody.innerHTML = db.schedule.map((e, i) => `
      <tr>
        <td><strong>${e.flat}</strong></td>
        <td>${e.resident}</td>
        <td><span class="code-chip">${e.accessCode}</span></td>
        <td><img src="${qrUrls[i]}" width="60" height="60" style="display:block;border:1px solid #eee"/></td>
        <td><button class="btn btn-o btn-sm" onclick="printSingleLetter(${i})"><i class="ti ti-printer"></i> Open &amp; edit</button></td>
      </tr>`).join('');
  }
}

function buildQrUrl(code) {
  return `${LETTER_TEMPLATE.appUrl}?code=${code}`;
}

function buildQrImageUrl(code) {
  const data = encodeURIComponent(buildQrUrl(code));
  return `https://quickchart.io/qr?text=${data}&size=150&dark=002856&light=ffffff&margin=1`;
}

function generateQrDataUrls(schedule) {
  return schedule.map(e => buildQrImageUrl(e.accessCode));
}

function generateAllLetters() {
  const qrUrls = generateQrDataUrls(db.schedule);
  const win = window.open('', '_blank');
  win.document.write(buildAllLettersHTML(qrUrls));
  win.document.close();
  showToast('letters-toast', `✓ Letter pack opened — ${db.schedule.length} letters. Edit then print or save as Word.`, 't-g', 5000);
}

function printSingleLetter(i) {
  const e = db.schedule[i];
  const qrUrl = buildQrImageUrl(e.accessCode);
  const win = window.open('', '_blank');
  win.document.write(buildLetterHTML(e, qrUrl));
  win.document.close();
}

function letterStyles() {
  return `
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:0}
      .letter-wrap{max-width:680px;margin:0 auto;padding:40px;font-size:13px;color:#222;line-height:1.6}
      [contenteditable]{outline:none;border-bottom:1px dashed #ccc;min-width:40px;display:inline-block}
      [contenteditable]:focus{background:#fffbe6;border-bottom:1px solid #f0a500}
      .edit-hint{background:#e0f2ef;border:1px solid #008C79;border-radius:6px;padding:8px 12px;font-size:11px;color:#006655;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
      .edit-hint button{background:#002856;color:#fff;border:none;border-radius:6px;padding:5px 14px;font-size:11px;cursor:pointer}
      @media print{.edit-hint{display:none!important}[contenteditable]{border-bottom:none}.page-break{page-break-after:always}}
    </style>`;
}

function buildAllLettersHTML(qrUrls) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Resident Letters</title>${letterStyles()}</head><body>
    <div class="edit-hint">
      ✏️ Click the <strong style='border-bottom:2px dashed #008C79'>client name</strong> to edit it before printing. All other fields are fixed.
      <button onclick="window.print()">🖨 Print all letters</button>
    </div>
    ${db.schedule.map((e,i) => `<div class="${i<db.schedule.length-1?'page-break':''}">${buildLetterBody(e, qrUrls[i])}</div>`).join('')}
    </body></html>`;
}

function buildLetterHTML(e, qrUrl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Letter — ${e.flat}</title>${letterStyles()}</head><body>
    <div class="edit-hint">
      ✏️ Click the <strong style='border-bottom:2px dashed #008C79'>client name</strong> to edit it before printing. All other fields are fixed.
      <button onclick="window.print()">🖨 Print letter</button>
    </div>
    ${buildLetterBody(e, qrUrl)}</body></html>`;
}

function buildLetterBody(e, qrUrl) {
  const t = LETTER_TEMPLATE;
  const today = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  return `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:40px;font-size:13px;color:#222;line-height:1.6">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #008C79;padding-bottom:16px;margin-bottom:20px">
      <div>
        <span style="font-size:26px;font-weight:700;color:#002856;font-family:Arial,sans-serif">DURKAN</span>
        <span style="font-size:18px;font-weight:700;color:#008C79;font-family:Arial,sans-serif"> regen</span>
        <div style="font-size:11px;color:#888;margin-top:4px">${t.siteOffice}<br>${t.siteAddr}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">T ${t.rloPhone}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#888">
        <div>Our Ref: ${t.ref}</div>
        <div style="margin-top:4px">${today}</div>
      </div>
    </div>

    <div style="margin-bottom:20px;font-size:13px">
      <strong>${e.resident}</strong><br>
      ${e.flat}<br>
      ${e.address || 'Highbury Gardens'}
    </div>

    <div style="margin-bottom:16px"><strong>Dear ${e.resident.split(' ')[0]},</strong></div>

    <div style="font-size:14px;font-weight:700;color:#002856;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Introduction Letter</div>

    <p>Durkan Ltd has been appointed by <span contenteditable="true" style="border-bottom:2px dashed #008C79;padding:0 2px;cursor:text">${t.client}</span> to carry out ${t.workType} works to your home.</p>

    <p>We shall be setting up our site compound at ${t.siteAddr}. We will be contacting you soon to arrange a visit to your home, so we can introduce ourselves, go through our Resident Information Pack, and carry out a survey of your home.</p>

    <p>As part of our commitment to keeping you informed throughout the works, we have set up a <strong>Resident App</strong> — your personal digital link to the Durkan team. The app lets you confirm your appointment dates, see what work is happening at your home each day, report any issues, and message your Resident Liaison Officer directly from your phone.</p>

    <div style="border:2px solid #008C79;border-radius:10px;padding:20px;margin:20px 0;background:#e0f2ef">
      <div style="font-size:13px;font-weight:700;color:#002856;margin-bottom:12px">Your personal access to the resident app</div>
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <div style="text-align:center">
          <img src="${qrUrl}" width="120" height="120" style="display:block"/>
          <div style="font-size:10px;color:#666;margin-top:4px">Scan with your phone camera</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:11px;color:#666;margin-bottom:6px">OR enter this code manually:</div>
          <div style="font-size:22px;font-weight:700;font-family:monospace;color:#002856;background:#fff;border:1.5px solid #D9D8D6;border-radius:8px;padding:10px 16px;letter-spacing:3px;display:inline-block">${e.accessCode}</div>
          <div style="font-size:11px;color:#666;margin-top:6px">${e.flat}${e.address?' · '+e.address:' · Highbury Gardens'}</div>
        </div>
      </div>
      <div style="margin-top:14px;font-size:12px;color:#444">
        <strong style="color:#002856">How to get started:</strong><br>
        1. Point your phone camera at the QR code above — it will open the app automatically and log you straight in.<br>
        2. Or visit <strong>${t.appUrl}</strong> and enter your code above.<br>
        3. Add the app to your home screen for quick access — your RLO can help you with this when they visit.
      </div>
      <div style="margin-top:10px;font-size:11px;color:#666">
        <strong>iPhone:</strong> Open in Safari → tap Share → Add to Home Screen &nbsp;|&nbsp;
        <strong>Android:</strong> Open in Chrome → tap menu → Add to Home Screen
      </div>
    </div>

    <p>In the meantime, if you have any concerns or queries regarding these works, please contact your Resident Liaison Officer, <strong>${t.rloName}</strong>, who will be happy to help. ${t.rloName} can be contacted on <strong>${t.rloPhone}</strong> or <a href="mailto:${t.rloEmail}">${t.rloEmail}</a>.</p>

    <p>All Durkan employees wear Hi-Vis vests and carry photo ID. If you are unsure of anyone claiming to represent Durkan Limited or its subcontractors, please contact ${t.rloName} on ${t.rloPhone} or ${t.siteManager}, site manager, on ${t.smPhone}, prior to allowing access to your home.</p>

    <p>We would like to apologise for any inconvenience this may cause and take this opportunity to thank you in advance for your co-operation and patience.</p>

    <div style="margin-top:28px">
      <div>Yours sincerely,</div>
      <div style="margin-top:28px">
        <div style="font-weight:700;color:#002856">${t.rloName}</div>
        <div>Liaison Officer</div>
        <div><a href="mailto:${t.rloEmail}">${t.rloEmail}</a></div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   DASHBOARD
============================================================ */
const LETTER_CATEGORY_SHORT = {
  'Request to Access Letters (hard-to-reach residents)': 'Access',
  'Design Survey Confirmation': 'Survey',
  'Start Date of Works Confirmation': 'Start Date',
  'Window & Door Installation Confirmation': 'Window/Door',
  'Front Entrance Door Installation Confirmation': 'FED',
};

function letterBadgesFor(contactLog) {
  const letters = (contactLog || []).filter(l => l.method === 'Letter');
  if (!letters.length) return '';
  return letters.map(l => {
    const catLabel = Object.keys(LETTER_CATEGORY_SHORT).find(full => (l.note || '').startsWith(full));
    const short = catLabel ? LETTER_CATEGORY_SHORT[catLabel] : 'Letter';
    const stageMatch = (l.note || '').match(/\((\d\w\w) Request\)/);
    const stage = stageMatch ? ' ' + stageMatch[1] : '';
    return `<span class="spill sp-b" style="font-size:9px;margin:1px 2px 1px 0" title="${l.note} — ${l.date}">${short}${stage}</span>`;
  }).join('');
}

function renderDashboard() {
  const total  = db.schedule.length;
  const conf   = db.schedule.filter(e => e.status==='confirmed').length;
  const awt    = db.published ? db.schedule.filter(e => e.status==='pending'||e.status==='none-requested').length : 0;
  const openDef= db.defects.filter(d => d.status!=='closed').length;
  const msgs   = db.messages.length;
  const fbN    = db.feedback.length;
  const avg    = fbN ? (db.feedback.reduce((s,f)=>s+f.rating,0)/fbN).toFixed(1) : '—';
  document.getElementById('m-total').textContent = total;
  document.getElementById('m-conf').textContent  = conf;
  document.getElementById('m-await').textContent = awt;
  document.getElementById('m-def').textContent   = openDef;
  document.getElementById('m-msgs').textContent  = msgs;
  document.getElementById('m-avg').textContent   = fbN ? avg+'★' : '—';
  const empty = document.getElementById('bo-empty');
  const wrap  = document.getElementById('bo-dash-wrap');
  if (!db.published||!total) { empty.style.display='block'; wrap.style.display='none'; return; }
  empty.style.display='none'; wrap.style.display='block';
  document.getElementById('dash-ts').textContent = 'Updated just now';
  const sPill = {
    pending:`<span class="spill sp-a">Awaiting</span>`,
    confirmed:`<span class="spill sp-g">Confirmed 🔒</span>`,
    'none-requested':`<span class="spill sp-r">New slots needed</span>`,
  };
  document.getElementById('dash-tbody').innerHTML = db.schedule.map((e,i) => {
    const attempts = (e.contactLog||[]).length;
    const rowBg = attempts >= 5 ? 'background:#fff0f0' : attempts >= 3 ? 'background:#fffbea' : '';
    const attemptBadge = attempts > 0
      ? `<span class="spill ${attempts>=5?'sp-r':attempts>=3?'sp-a':'sp-gr'}" style="font-size:10px">${attempts} attempt${attempts!==1?'s':''}</span>`
      : '';
    const escalateBtn = attempts >= 3 && e.status !== 'confirmed'
      ? `<button class="btn btn-sm" style="background:var(--redbg);color:var(--red);border:1px solid var(--red);border-radius:7px;font-weight:600;cursor:pointer;margin-top:4px;width:100%" onclick="escalateResident(${i})">⚠ Escalate to L&Q</button>`
      : '';
    const accessLetterBtn = attempts >= 1 && e.status !== 'confirmed'
      ? `<button class="btn btn-o btn-sm" style="margin-top:4px;width:100%" onclick="openAccessLetterFor(${i})"><i class="ti ti-file-text"></i> Send access letter</button>`
      : '';
    const elCount = (e.workElements||[]).length;
    const workElBtn = `<button class="btn btn-o btn-sm" style="margin-top:4px;width:100%" onclick="openWorkElements(${i})"><i class="ti ti-list-check"></i> Work elements${elCount?' ('+elCount+')':''}</button>`;
    const lettersBtn = `<button class="btn btn-o btn-sm" style="margin-top:4px;width:100%" onclick="openFlatLetters(${i})"><i class="ti ti-mail-opened"></i> Letters</button>`;
    return `<tr style="${rowBg}">
      <td style="font-size:10px;color:var(--dgd);font-family:monospace">${e.urpn||'—'}</td><td><strong>${e.flat}</strong></td><td>${e.resident}<div style="margin-top:3px">${letterBadgesFor(e.contactLog)}</div></td><td>${e.workType}</td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td>${sPill[e.status]||''}</td>
      <td>${e.confirmedDate?`<strong style="color:var(--dj)">${e.confirmedDate}</strong>`:`<span style="color:var(--dg)">—</span>`}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${e.locked
            ? `<button class="btn btn-o btn-sm" onclick="unlockSlot(${i})">🔓 Unlock</button>`
            : e.status==='pending'
              ? `<button class="btn btn-o btn-sm" onclick="logContactAttempt(${i})">📞 Log attempt</button>`
              : e.status==='none-requested'
                ? `<button class="btn btn-sm" style="background:var(--amberbg);color:var(--amber);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="sendNewSlots(${i})">New slots</button>`
                : `<span style="color:var(--dj);font-size:11px;font-weight:600">✓ Done</span>`
          }
          ${attemptBadge}
          ${workElBtn}
          ${lettersBtn}
          ${accessLetterBtn}
          ${escalateBtn}
          ${attempts > 0 ? `<button class="btn btn-o btn-sm" style="font-size:10px" onclick="viewContactLog(${i})">View log</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
  const defPanel = document.getElementById('def-dash-panel');
  if (!openDef) { defPanel.style.display='none'; }
  else {
    defPanel.style.display='block';
    document.getElementById('def-count-pill').textContent = openDef;
    document.getElementById('def-dash-list').innerHTML = db.defects.filter(d=>d.status!=='closed').map(d=>`
      <div class="defect-card ${d.status}" style="margin-bottom:8px">
        <div class="def-row"><span class="def-title">${d.location} — ${d.desc.slice(0,40)}${d.desc.length>40?'...':''}</span><span class="spill ${d.status==='open'?'sp-r':'sp-a'}">${d.status==='in-progress'?'In progress':d.status}</span></div>
        <div class="def-meta">${d.flat} · ${d.date} · ${d.priority.split(' ')[0]}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-o btn-sm" onclick="updateDefectStatus('${d.id}','in-progress')">In progress</button>
          <button class="btn btn-sm" style="background:var(--greenbg);color:var(--green);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="updateDefectStatus('${d.id}','closed')">Close</button>
        </div>
      </div>`).join('');
  }
}

function downloadDashboardCSV() {
  if (!db.schedule.length) { showToast('dash-download-toast', 'No schedule to export yet.', 't-r'); return; }

  const headers = [
    'URPN/Access Code','Flat','Resident','Mobile','Overall Status','Confirmed Date',
    'Contact Attempts','Work Element','Element Status','Intro Letter Sent',
    'Survey Booked','Survey Completed','Element Start Date',
    '1st No Access Letter Sent','2nd No Access Letter Sent','3rd No Access Letter Sent'
  ];

  const rows = [];
  db.schedule.forEach(e => {
    const attempts = (e.contactLog||[]).length;
    const els = (e.workElements&&e.workElements.length) ? e.workElements : [null];
    els.forEach(el => {
      rows.push([
        e.accessCode, e.flat, e.resident, e.mobile||'', e.status, e.confirmedDate||'',
        attempts,
        el ? el.name : '', el ? el.status : '', el ? el.introLetterSent : '',
        el ? el.surveyBooked : '', el ? el.surveyCompleted : '', el ? el.startDate : '',
        el ? (el.access1Sent||'') : '', el ? (el.access2Sent||'') : '', el ? (el.access3Sent||'') : '',
      ]);
    });
  });

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g,'-');
  a.href = url;
  a.download = `Highbury_Gardens_Dashboard_${today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('dash-download-toast', `✓ Downloaded — ${rows.length} row${rows.length!==1?'s':''} across ${db.schedule.length} flat${db.schedule.length!==1?'s':''}.`, 't-g', 5000);
}

function unlockSlot(i) {
  db.schedule[i].locked=false; db.schedule[i].status='pending'; db.schedule[i].confirmedDate='';
  updateScheduleRow(db.schedule[i]);
  renderDashboard();
  if (db.currentResident?.flat===db.schedule[i].flat) renderResAppts();
}
function sendNewSlots(i) {
  db.schedule[i].status='pending';
  db.schedule[i].slots=['Mon 23 Jun','Tue 24 Jun','Wed 25 Jun'];
  if (!db.schedule[i].contactLog) db.schedule[i].contactLog = [];
  updateScheduleRow(db.schedule[i]);
  renderDashboard();
  if (db.currentResident?.flat===db.schedule[i].flat) renderResAppts();
}

/* ============================================================
   DURING WORKS
============================================================ */
function handleDuringFile(evt) {
  const file = evt.target.files[0]; if (!file) return;
  const prog = document.getElementById('during-prog');
  const fill = document.getElementById('during-prog-fill');
  prog.style.display='block'; fill.style.width='0%';
  let pct=0;
  const iv = setInterval(()=>{pct=Math.min(pct+15,90);fill.style.width=pct+'%';},100);
  const reader = new FileReader();
  reader.onload = function(e) {
    clearInterval(iv); fill.style.width='100%';
    setTimeout(()=>{
      prog.style.display='none'; fill.style.width='0%';
      try {
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
        parseDuringRows(rows, file.name);
      } catch { showToast('during-parse-toast','Could not read file.','t-r'); }
    },300);
  };
  reader.readAsArrayBuffer(file);
}

function parseDuringRows(rows, filename) {
  const parsed = rows.map(r => ({
    flat:      getCol(r,'Flat','FlatNo','Unit'),
    resident:  getCol(r,'Resident','ResidentName','Name'),
    trade:     getCol(r,'Trade','Works','Work Type','Job','Description'),
    timeframe: getCol(r,'Timeframe','Time','AM/PM','Period')||'AM',
    date:      getCol(r,'Date','WorkDate','Work Date','Day','Scheduled Date')||'',
    note:      getCol(r,'Note','Notes','Additional','Info')||'',
  })).filter(r=>r.flat&&r.trade);
  if (!parsed.length) { showToast('during-parse-toast','No valid rows found.','t-r'); return; }
  duringWorksList = parsed;
  renderDuringTable();
  showToast('during-parse-toast',`✓ ${filename} — ${parsed.length} entries loaded.`,'t-g',5000);
}

function loadDuringDemo() {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const d = tomorrow.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  duringWorksList = [
    {flat:'Flat 14',resident:'Sarah Ahmed', trade:'Tiler',       timeframe:'AM',date:d,note:'Kitchen floor — please clear the area'},
    {flat:'Flat 9', resident:'James Obi',   trade:'Electrician', timeframe:'PM',date:d,note:'Second fix electrics'},
    {flat:'Flat 21',resident:'Aisha Patel', trade:'Plumber',     timeframe:'AM',date:d,note:'Bathroom installation'},
    {flat:'Flat 3', resident:'Unconfirmed', trade:'Plasterer',   timeframe:'AM',date:d,note:'Bedroom walls'},
    {flat:'Flat 7', resident:'Maria Santos',trade:'Decorator',   timeframe:'PM',date:d,note:'Living room — first coat'},
  ];
  renderDuringTable();
  showToast('during-parse-toast','✓ Demo schedule loaded.','t-g');
}

function renderDuringTable() {
  const panel = document.getElementById('during-review-panel');
  const tbody = document.getElementById('during-tbody');
  if (!panel||!tbody) return;
  panel.style.display='block';
  document.getElementById('during-count').textContent = duringWorksList.length+' flats';
  tbody.innerHTML = duringWorksList.map((e,i) => `
    <tr>
      <td><input style="width:65px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.flat}" onchange="duringWorksList[${i}].flat=this.value"/></td>
      <td><input style="width:90px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.resident}" onchange="duringWorksList[${i}].resident=this.value"/></td>
      <td><input style="width:100px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.trade}" onchange="duringWorksList[${i}].trade=this.value"/></td>
      <td><input style="width:90px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.date}" placeholder="e.g. Mon 23 Jun" onchange="duringWorksList[${i}].date=this.value"/></td>
      <td><select style="border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" onchange="duringWorksList[${i}].timeframe=this.value">
        <option${e.timeframe==='AM'?' selected':''}>AM</option>
        <option${e.timeframe==='PM'?' selected':''}>PM</option>
      </select></td>
      <td><input style="width:130px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.note}" onchange="duringWorksList[${i}].note=this.value"/></td>
      <td><button class="btn btn-r btn-sm" onclick="duringWorksList.splice(${i},1);renderDuringTable()"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
}

function addDuringEntry() {
  duringWorksList.push({flat:'Flat',resident:'',trade:'',timeframe:'AM',note:''});
  renderDuringTable();
}

function publishDuring() {
  if (!duringWorksList.length) { showToast('during-publish-toast','Add at least one entry first.','t-r'); return; }
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const dateStr  = tomorrow.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  db.duringWorks = duringWorksList.map(e => ({...e, publishedAt:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}));
  db.duringWorks.forEach(e => {
    const sched = db.schedule.find(s => s.flat === e.flat);
    const mobile = e.mobile || (sched && sched.mobile);
    if (mobile) {
      sendSMS(mobile, `Hi ${e.resident.split(' ')[0]}, tomorrow${e.date?' ('+e.date+')':''} the ${e.trade} is scheduled at ${e.flat} in the ${e.timeframe}. Please ensure access is available. Durkan Regen.`);
    }
  });
  showToast('during-publish-toast','✓ Published — residents notified of tomorrow\'s works.','t-g',5000);
  renderDuringWorksRlo();
  if (db.currentResident) { renderDuringWorksResident(); updateDuringBadge(); }
}

function renderDuringWorksRlo() {
  const panel = document.getElementById('during-current-panel');
  const list  = document.getElementById('during-current-list');
  const lbl   = document.getElementById('during-live-date');
  if (!panel||!list) return;
  if (!db.duringWorks.length) { panel.style.display='none'; return; }
  panel.style.display='block';
  if (lbl && db.duringWorks[0]) lbl.textContent = db.duringWorks[0].forDate;
  list.innerHTML = db.duringWorks.map(e=>`
    <div style="background:var(--dbg);border-radius:9px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:flex-start;gap:10px">
      <div style="background:${e.timeframe==='AM'?'var(--dbl)':'var(--amberbg)'};color:${e.timeframe==='AM'?'var(--db)':'var(--amber)'};border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;flex-shrink:0;text-align:center">
        ${e.date?`<div style="font-size:9px;font-weight:600;opacity:.8">${e.date}</div>`:''}
        ${e.timeframe}
      </div>
      <div><div style="font-size:13px;font-weight:600;color:var(--db)">${e.flat} — ${e.trade}</div><div style="font-size:11px;color:var(--dgd)">${e.resident}${e.note?' · '+e.note:''}</div></div>
    </div>`).join('');
}

function renderDuringWorksResident() {
  const body = document.getElementById('r-during-body'); if (!body||!db.currentResident) return;
  const myWorks = db.duringWorks.filter(e=>e.flat===db.currentResident.flat);
  if (!db.duringWorks.length||!myWorks.length) {
    body.innerHTML='<div class="empty-msg">No works scheduled for tomorrow yet.<br>Your RLO will update this daily.</div>'; return;
  }
  const dateStr = db.duringWorks[0].forDate;
  body.innerHTML=`
    <div class="vc" style="padding:11px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--dgd);margin-bottom:4px">Tomorrow's works</div>
      <div style="font-size:15px;font-weight:700;color:var(--db)">${dateStr}</div>
    </div>
    ${myWorks.map(e=>`
      <div class="vc" style="padding:12px;margin-bottom:8px;border-left:3px solid ${e.timeframe==='AM'?'var(--db)':'var(--amber)'}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          ${e.date?`<div style="font-size:11px;font-weight:600;color:var(--dgd)">${e.date}</div>`:''}
          <div style="background:${e.timeframe==='AM'?'var(--dbl)':'var(--amberbg)'};color:${e.timeframe==='AM'?'var(--db)':'var(--amber)'};border-radius:7px;padding:3px 10px;font-size:12px;font-weight:700">${e.timeframe}</div>
          <div style="font-size:14px;font-weight:700;color:var(--db)">${e.trade}</div>
        </div>
        ${e.note?`<div style="font-size:11px;color:var(--dgd);line-height:1.5"><i class="ti ti-info-circle" style="color:var(--dj)"></i> ${e.note}</div>`:''}
      </div>`).join('')}
    <div class="vc" style="padding:10px;margin-top:6px">
      <div style="font-size:11px;color:var(--dgd);line-height:1.5">
        <strong>AM</strong> visits: 8:00–13:00 &nbsp;|&nbsp; <strong>PM</strong> visits: 13:00–17:00<br>
        Please ensure access is available during this time.
      </div>
    </div>`;
}

function updateDuringBadge() {
  if (!db.currentResident) return;
  const my    = db.duringWorks.filter(e=>e.flat===db.currentResident.flat);
  const badge = document.getElementById('r-during-n');
  const sub   = document.getElementById('r-during-sub');
  if (my.length) { if(badge)badge.style.display='inline-block'; if(sub)sub.textContent=`${my[0].date?my[0].date+' ':''} ${my[0].timeframe} — ${my[0].trade}`; }
  else           { if(badge)badge.style.display='none'; if(sub)sub.textContent='Tomorrow\'s works schedule'; }
}

/* ============================================================
   RESIDENT HOME
============================================================ */
function renderResidentHome() {
  if (!db.currentResident) return;
  updateResidentUpdatesBadge();
  const my    = db.schedule.filter(e=>e.flat===db.currentResident.flat);
  const first = my[0];
  const badge = document.getElementById('r-home-badge');
  if (!db.published||!first) {
    if(badge){badge.textContent='No schedule yet';badge.style.background='';badge.style.color='';}
    document.getElementById('r-home-date').textContent='Awaiting schedule';
    document.getElementById('r-home-type').textContent='—';
    document.getElementById('r-home-det').textContent='Your RLO will upload the works schedule soon.';
    document.getElementById('r-appt-n').textContent='0';
    document.getElementById('r-appt-sub').textContent='No appointments yet';
    return;
  }
  document.getElementById('r-appt-n').textContent=my.length;
  document.getElementById('r-appt-sub').textContent=`${my.length} appointment${my.length!==1?'s':''} scheduled`;
  if (first.confirmedDate) {
    if(badge){badge.textContent='🔒 Confirmed';badge.style.background='var(--greenbg)';badge.style.color='var(--green)';}
    document.getElementById('r-home-date').textContent=first.confirmedDate;
    document.getElementById('r-home-type').textContent=first.workType;
    document.getElementById('r-home-det').textContent='Date locked. Contact your RLO to make changes.';
  } else {
    if(badge){badge.textContent='Choose date';badge.style.background='var(--amberbg)';badge.style.color='var(--amber)';}
    document.getElementById('r-home-date').textContent='Date not yet selected';
    document.getElementById('r-home-type').textContent=first.workType;
    document.getElementById('r-home-det').textContent=`${first.slots.length} options — please select one.`;
  }
  updateDuringBadge();
  if (curResPage===2) renderResAppts();
}

/* ============================================================
   APPOINTMENTS
============================================================ */
function renderResAppts() {
  const body = document.getElementById('r-appts-body'); if (!body||!db.currentResident) return;
  if (!db.published) { body.innerHTML='<div class="empty-msg">Waiting for schedule from your RLO...</div>'; return; }
  const my = db.schedule.filter(e=>e.flat===db.currentResident.flat);
  if (!my.length) { body.innerHTML=`<div class="empty-msg">No appointments for ${db.currentResident.flat} yet.</div>`; return; }
  body.innerHTML = my.map(e => {
    const si = db.schedule.indexOf(e);
    if (e.locked&&e.confirmedDate) return `
      <div class="ph-sect">${e.workType}</div>
      <div class="lock-banner"><i class="ti ti-lock"></i> Date confirmed and locked</div>
      <div class="conf-screen">
        <div class="conf-icon" style="background:var(--greenbg);color:var(--green)"><i class="ti ti-circle-check"></i></div>
        <div class="conf-title">Date confirmed</div>
        <div class="conf-sub">${e.confirmedDate}</div>
        <div class="mc" style="width:100%"><div class="mi mi-j"><i class="ti ti-bell"></i></div><div style="flex:1"><div class="mi-t">SMS reminder set</div><div class="mi-s">24 hours before visit</div></div></div>
        <div class="vc" style="width:100%;margin-top:7px;padding:9px"><div class="vc-d">To change this date please message your RLO.</div></div>
      </div>`;
    return `
      <div class="ph-sect">${e.workType}</div>
      <div class="vc" style="padding:9px;margin-bottom:7px"><div class="vc-d"><strong>Once confirmed this date is locked</strong> — contact your RLO to change it.</div></div>
      ${e.slots.some(s=>db.schedule.some(o=>o!==e&&o.status==='confirmed'&&o.confirmedDate===s))?`<div class="vc" style="padding:9px;margin-bottom:7px;border-left:3px solid var(--amber)"><div class="vc-d">Some dates have already been taken by other residents and are no longer shown.</div></div>`:''}
      ${e.slots.filter(s=>!db.schedule.some(o=>o!==e&&o.status==='confirmed'&&o.confirmedDate===s)).map((s,idx)=>`
        <div class="slot" id="rslot-${si}-${idx}" onclick="resPick(${si},${idx},'${s.replace(/'/g,"\\'")}')">
          <div class="srad" id="rsrad-${si}-${idx}"></div>
          <div><div class="slot-t">${s}</div><div class="slot-d">Available</div></div>
        </div>`).join('')}
      <div class="slot none" id="rslot-${si}-none" onclick="resPick(${si},'none','none')">
        <div class="srad" id="rsrad-${si}-none"></div>
        <div><div class="slot-t">None of the above</div><div class="slot-d">Request new options</div></div>
      </div>
      <button class="vbtn" id="rconf-${si}" style="display:none" onclick="resConfirm(${si})">Confirm — this cannot be undone</button>
      <div class="ph-toast" id="rtost-${si}"></div>`;
  }).join('');
}

function resPick(si,idx,label) {
  const e = db.schedule[si];
  e.slots.forEach((_,i)=>{ const s=document.getElementById(`rslot-${si}-${i}`);const r=document.getElementById(`rsrad-${si}-${i}`);if(s)s.classList.remove('sel');if(r)r.innerHTML=''; });
  ['none'].forEach(x=>{ const s=document.getElementById(`rslot-${si}-${x}`);const r=document.getElementById(`rsrad-${si}-${x}`);if(s)s.classList.remove('sel');if(r)r.innerHTML=''; });
  const sel=document.getElementById(`rslot-${si}-${idx}`);const rad=document.getElementById(`rsrad-${si}-${idx}`);
  if(sel)sel.classList.add('sel');if(rad)rad.innerHTML='<i class="ti ti-check" style="font-size:9px;color:#fff"></i>';
  pendingSlots[si]={idx,label};
  const btn=document.getElementById(`rconf-${si}`);if(btn)btn.style.display='block';
}

function resConfirm(si) {
  const p=pendingSlots[si]; if(!p) return;
  const e=db.schedule[si];
  if (p.idx!=='none') {
    const takenByOther = db.schedule.some(o=>o!==e&&o.status==='confirmed'&&o.confirmedDate===p.label);
    if (takenByOther) {
      phToast(`rtost-${si}`,'Sorry — that date has just been taken by another resident. Please choose a different one.','err');
      delete pendingSlots[si];
      setTimeout(()=>renderResAppts(),1500);
      return;
    }
  }
  if (p.idx==='none') {
    e.status='none-requested';
    phToast(`rtost-${si}`,'New options requested. Your RLO will contact you within 48 hours.','err');
    pushNotification('appointment',`${e.flat} (${e.resident}) requested new appointment slots.`);
    updateScheduleRow(e);
  } else {
    e.confirmedDate=p.label; e.status='confirmed'; e.locked=true;
    pushNotification('appointment',`${e.flat} (${e.resident}) confirmed their appointment: ${p.label}.`);
    updateScheduleRow(e);
    if (e.mobile) {
      sendSMS(e.mobile, `Hi ${e.resident.split(' ')[0]}, your Pre Works appointment at ${e.flat} Highbury Gardens is confirmed for ${p.label}. Your Durkan RLO will be in touch if anything changes.`);
    }
  }
  renderResidentHome(); renderDashboard(); renderReports(); renderResAppts();
}

/* ============================================================
   DEFECTS / ISSUES
============================================================ */
function photoSelected(inp) {
  if (inp.files[0]) { selectedPhoto=inp.files[0]; document.getElementById('photo-lbl').textContent='📷 '+inp.files[0].name+' attached'; }
}

function renderResDefects() {
  const list=document.getElementById('r-def-list'); if(!list) return;
  const myDefs=db.defects.filter(d=>d.flat===db.currentResident?.flat);
  list.innerHTML=`
    <button class="vbtn" onclick="document.getElementById('r-def-list').style.display='none';document.getElementById('r-def-form').style.display='block'" style="margin-bottom:10px">+ Report new issue</button>
    ${myDefs.length?myDefs.map(d=>`
      <div class="vc" style="padding:10px;margin-bottom:8px;border-left:3px solid ${d.status==='closed'?'var(--green)':d.status==='in-progress'?'var(--amber)':'var(--red)'}">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <div style="font-size:12px;font-weight:700;color:var(--db)">${d.location} issue</div>
          <span class="spill ${d.status==='open'?'sp-r':d.status==='in-progress'?'sp-a':'sp-g'}" style="font-size:10px">${d.status==='in-progress'?'In progress':d.status}</span>
        </div>
        <div style="font-size:10px;color:var(--dgd);margin-bottom:3px">${d.desc.slice(0,60)}${d.desc.length>60?'...':''}</div>
        <div style="font-size:10px;color:var(--dgd)">Reported ${d.date} · ${d.priority.split(' ')[0]}</div>
        ${d.updates.length?`<div class="def-updates">Latest: ${d.updates[d.updates.length-1]}</div>`:''}
      </div>`).join('')
    :'<div class="empty-msg">No issues reported yet</div>'}`;
  document.getElementById('r-def-form').style.display='none';
  const open=myDefs.filter(d=>d.status!=='closed').length;
  const badge=document.getElementById('r-def-n');
  if(badge){badge.textContent=open;badge.style.display=open>0?'inline-block':'none';}
  const sub=document.getElementById('r-def-sub');
  if(sub)sub.textContent=myDefs.length?`${open} open · ${myDefs.length} total`:'Report a problem in your home';
}

async function submitDefect() {
  const desc=document.getElementById('r-def-desc').value.trim();
  if(!desc){phToast('def-toast','Please describe the issue first.','err');return;}

  const location = document.getElementById('r-def-location').value;
  const priority = document.getElementById('r-def-priority').value;
  const photoName = selectedPhoto ? selectedPhoto.name : null;
  const issueRef = 'ISS-' + String(defectIdCounter++).padStart(3, '0');

  const { data, error } = await sb.from('issues').insert({
    issue_ref: issueRef,
    flat: db.currentResident.flat, resident: db.currentResident.resident,
    location, description: desc, priority,
    status: 'open', photo_url: photoName,
  }).select().single();

  if (error) {
    console.warn('Submit issue failed:', error.message);
    phToast('def-toast', 'Could not save — check your connection and try again.', 'err');
    return;
  }

  const def = {
    id: data.id, issue_ref: data.issue_ref,
    flat: data.flat, resident: data.resident,
    desc: data.description, location: data.location, priority: data.priority,
    status: data.status, date: new Date(data.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
    updates: [], photo: data.photo_url, rating: data.rating,
  };
  db.defects.push(def);
  db.messages.push({from:`${def.resident} — ${def.flat}`,time:'Just now',body:`Issue reported: ${def.location} — ${def.desc}`,complaint:false,type:'issue'});
  sb.from('messages').insert({
    flat: def.flat, resident: def.resident,
    from_label: `${def.resident} — ${def.flat}`,
    body: `Issue reported: ${def.location} — ${def.desc}`,
    is_complaint: false, type: 'issue',
  }).then(({ error }) => { if (error) console.warn('Save message failed:', error.message); });
  pushNotification('issue',`${def.flat} (${def.resident}) reported a new issue: ${def.location} — ${def.desc.slice(0,50)}.`);
  selectedPhoto=null;
  document.getElementById('r-def-desc').value='';
  document.getElementById('photo-lbl').textContent='Tap to attach a photo';
  phToast('def-toast','Issue reported. Your RLO has been notified.');
  setTimeout(()=>{
    document.getElementById('r-def-form').style.display='none';
    document.getElementById('r-def-list').style.display='block';
    renderResDefects(); renderDashboard(); renderRloDefects();
  },2000);
}

function renderRloDefects() {
  document.getElementById('d-open').textContent=db.defects.filter(d=>d.status==='open').length;
  document.getElementById('d-prog').textContent=db.defects.filter(d=>d.status==='in-progress').length;
  document.getElementById('d-closed').textContent=db.defects.filter(d=>d.status==='closed').length;
  const list=document.getElementById('bo-def-list'); if(!list) return;
  if(!db.defects.length){list.innerHTML='<div class="panel" style="text-align:center;padding:28px;color:var(--dgd)"><i class="ti ti-circle-check" style="font-size:28px;display:block;margin:0 auto 8px;color:var(--dg)"></i>No issues reported yet</div>';return;}
  list.innerHTML=db.defects.map(d=>`
    <div class="defect-card ${d.status}" style="margin-bottom:10px">
      <div class="def-row">
        <div><div class="def-title">${d.issue_ref || d.id} — ${d.location} (${d.flat})</div>
        <div class="def-meta">${d.resident} · ${d.date} · <strong>${d.priority.split(' ')[0]}</strong></div></div>
        <span class="spill ${d.status==='open'?'sp-r':d.status==='in-progress'?'sp-a':'sp-g'}">${d.status==='in-progress'?'In progress':d.status.charAt(0).toUpperCase()+d.status.slice(1)}</span>
      </div>
      <div style="font-size:12px;color:var(--db);margin-bottom:7px">${d.desc}</div>
      ${d.photo?`<div style="font-size:11px;color:var(--dj);margin-bottom:5px">📷 ${d.photo}</div>`:''}
      ${d.updates.length?`<div class="def-updates">${d.updates.map(u=>'• '+u).join('<br>')}</div>`:''}
      <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
        ${d.status!=='in-progress'&&d.status!=='closed'?`<button class="btn btn-sm" style="background:var(--amberbg);color:var(--amber);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="updateDefectStatus('${d.id}','in-progress')"><i class="ti ti-tool"></i> In progress</button>`:''}
        ${d.status!=='closed'?`<button class="btn btn-sm" style="background:var(--greenbg);color:var(--green);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="updateDefectStatus('${d.id}','closed')"><i class="ti ti-circle-check"></i> Mark closed</button>`:''}
        <button class="btn btn-o btn-sm" onclick="addDefectUpdate('${d.id}')"><i class="ti ti-message"></i> Add update</button>
      </div>
    </div>`).join('');
}

function updateDefectStatus(defId,status) {
  const d=db.defects.find(x=>x.id===defId); if(!d) return;
  d.status=status;
  const note = `${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} — Status: ${status==='in-progress'?'in progress':status}`;
  d.updates.push(note);
  renderRloDefects(); renderDashboard(); renderReports();
  if(db.currentResident?.flat===d.flat) renderResDefects();
  sb.from('issues').update({ status }).eq('id', defId)
    .then(({ error }) => { if (error) console.warn('Update issue status failed:', error.message); });
  sb.from('issue_updates').insert({ issue_id: defId, note })
    .then(({ error }) => { if (error) console.warn('Save issue update failed:', error.message); });
}

function addDefectUpdate(defId) {
  const note=prompt('Add an update (visible to resident):'); if(!note) return;
  const d=db.defects.find(x=>x.id===defId); if(!d) return;
  const entry = `${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} — ${note}`;
  d.updates.push(entry);
  renderRloDefects();
  if(db.currentResident?.flat===d.flat) renderResDefects();
  sb.from('issue_updates').insert({ issue_id: defId, note: entry })
    .then(({ error }) => { if (error) console.warn('Save issue update failed:', error.message); });
}

async function loadIssuesFromDB() {
  try {
    const { data, error } = await sb.from('issues').select('*').order('created_at');
    if (error) { console.warn('Load issues failed:', error.message); return; }
    db.defects = (data || []).map(r => ({
      id: r.id, issue_ref: r.issue_ref, flat: r.flat, resident: r.resident,
      desc: r.description, location: r.location, priority: r.priority,
      status: r.status, date: new Date(r.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
      updates: [], photo: r.photo_url, rating: r.rating,
    }));
    defectIdCounter = db.defects.length + 1;

    const ids = db.defects.map(d => d.id);
    if (ids.length) {
      const { data: upd, error: uErr } = await sb.from('issue_updates').select('*').in('issue_id', ids).order('created_at');
      if (!uErr && upd) {
        upd.forEach(u => {
          const d = db.defects.find(x => x.id === u.issue_id);
          if (d) d.updates.push(u.note);
        });
      }
    }
  } catch (err) {
    console.warn('Load issues error:', err.message);
  }
}

/* ============================================================
   MESSAGES
============================================================ */
function sendRMsg() {
  const t=document.getElementById('r-msg-toast'); if(!t) return;
  const msg=document.getElementById('r-msg')?.value.trim(); if(!msg) return;
  db.messages.push({from:`${db.currentResident.resident} — ${db.currentResident.flat}`,time:'Just now',body:msg,complaint:false,type:'message'});
  pushNotification('message',`${db.currentResident.flat} (${db.currentResident.resident}) sent a message: "${msg.slice(0,60)}${msg.length>60?'...':''}"`);
  t.className='ph-toast'; t.textContent='Message sent. Your RLO will respond within 2 working days.';
  t.style.display='block'; document.getElementById('r-msg').value='';
  setTimeout(()=>t.style.display='none',3500);

  sb.from('messages').insert({
    flat: db.currentResident.flat, resident: db.currentResident.resident,
    from_label: `${db.currentResident.resident} — ${db.currentResident.flat}`,
    body: msg, is_complaint: false, type: 'message',
  }).then(({ error }) => { if (error) console.warn('Save message failed:', error.message); });
}

async function loadMessagesFromDB() {
  try {
    const { data, error } = await sb.from('messages').select('*').order('created_at');
    if (error) { console.warn('Load messages failed:', error.message); return; }
    db.messages = (data || []).map(r => ({
      from: r.from_label,
      time: new Date(r.created_at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
      body: r.body, complaint: r.is_complaint, type: r.type,
    }));
  } catch (err) {
    console.warn('Load messages error:', err.message);
  }
}

async function loadFeedbackFromDB() {
  try {
    const { data, error } = await sb.from('feedback').select('*').order('created_at');
    if (!error && data) {
      db.feedback = data.map(r => ({ flat: r.flat, workType: r.work_type, rating: r.rating }));
    }
  } catch (err) {
    console.warn('Load feedback error:', err.message);
  }
}

function renderInbox() {
  const list=document.getElementById('bo-inbox-list'); if(!list) return;
  const base=[
    {from:'Sarah Ahmed — Flat 14',time:'Today 09:14',body:"Can you confirm if the visit will be before 10am?",complaint:false},
    {from:'James Obi — Flat 9',time:'Yesterday 17:42',body:"The noise from works yesterday started at 7:30am.",complaint:true},
    {from:'Aisha Patel — Flat 21',time:'Monday 11:05',body:"The kitchen team were absolutely brilliant.",complaint:false},
  ];
  const all=[...base,...db.messages];
  list.innerHTML=all.map((m,i)=>`
    <div class="ic-card${m.complaint?' complaint':''}" onclick="openMsg(${i})">
      <div class="ic-row"><span class="ic-name">${m.from}</span><span class="spill ${m.type==='issue'?'sp-r':m.complaint?'sp-r':'sp-b'}">${m.type==='issue'?'Issue':m.complaint?'Complaint':'NEW'}</span></div>
      <div class="ic-msg">${m.body.slice(0,80)}</div>
    </div>`).join('');
  window._allMessages = all;
}

function openMsg(i) {
  const all=window._allMessages||db.messages;
  const m=all[i]; if(!m) return;
  document.getElementById('bo-inbox-list').style.display='none';
  document.getElementById('bo-inbox-detail').style.display='block';
  document.getElementById('msg-from').textContent=m.from;
  document.getElementById('msg-time').textContent=m.time;
  document.getElementById('msg-body').textContent=m.body;
  document.getElementById('esc-btn').style.display=m.complaint?'flex':'none';
  document.getElementById('bo-reply').value='';
  document.getElementById('reply-toast').style.display='none';
}

function closeMsg() {
  document.getElementById('bo-inbox-list').style.display='block';
  document.getElementById('bo-inbox-detail').style.display='none';
}
function sendReply() {
  if(!document.getElementById('bo-reply').value.trim()) return;
  showToast('reply-toast','Reply sent and logged.','t-g');
  document.getElementById('bo-reply').value='';
}
function escalate() { showToast('reply-toast','Escalated to Sonia. She has been notified.','t-r'); }

/* ============================================================
   REPORTS
============================================================ */
function renderReports() {
  const conf=db.schedule.filter(e=>e.status==='confirmed').length;
  const pend=db.schedule.filter(e=>e.status==='pending').length;
  const openDef=db.defects.filter(d=>d.status!=='closed').length;
  const fbN=db.feedback.length;
  const avg=fbN?(db.feedback.reduce((s,f)=>s+f.rating,0)/fbN).toFixed(1):'—';
  document.getElementById('rep-conf').textContent=conf;
  document.getElementById('rep-pend').textContent=pend;
  document.getElementById('rep-def').textContent=openDef;
  document.getElementById('rep-avg').textContent=fbN?avg+'★':'—';
  const pC={confirmed:'sp-g','none-requested':'sp-r',pending:'sp-a'};
  const pL={confirmed:'Confirmed 🔒','none-requested':'New slots needed',pending:'Pending'};
  document.getElementById('rep-appt-rows').innerHTML=db.schedule.length
    ?db.schedule.map(e=>`<div class="srow"><span>${e.flat} — ${e.workType}</span><span class="spill ${pC[e.status]||'sp-a'}">${pL[e.status]||'Pending'}</span></div>`).join('')
    :'<div class="empty-msg">Upload a schedule first</div>';
  document.getElementById('rep-def-rows').innerHTML=db.defects.length
    ?db.defects.map(d=>`<div class="srow"><span>${d.id} · ${d.flat}</span><span class="spill ${d.status==='open'?'sp-r':d.status==='in-progress'?'sp-a':'sp-g'}">${d.status==='in-progress'?'In progress':d.status}</span></div>`).join('')
    :'<div class="empty-msg">No issues yet</div>';
  document.getElementById('rep-fb-rows').innerHTML=fbN
    ?db.feedback.map(f=>`<div class="srow"><span>${f.flat} · ${f.workType}</span><span style="color:var(--star);font-weight:700">${f.rating}★</span></div>`).join('')
    :'<div class="empty-msg">No feedback yet</div>';
}

/* ============================================================
   EXAMPLES OF FINISHED WORK — RLO uploads photos, residents browse
============================================================ */
function handleSwatchUpload(evt) {
  const files = Array.from(evt.target.files || []); if (!files.length) return;
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const item = { id: undefined, url: e.target.result };
      db.finishedWork.images.push(item);
      sb.from('finished_work_photos').insert({ photo_url: item.url }).select().then(({ data, error }) => {
        if (error) { console.warn('Save photo failed:', error.message); return; }
        if (data && data[0]) item.id = data[0].id;
      });
      loaded++;
      if (loaded === files.length) {
        db.finishedWork.uploadedDate = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
        showToast('swatch-toast', `✓ ${files.length} photo${files.length!==1?'s':''} uploaded.`, 't-g', 4000);
        renderColoursRlo();
        if (db.currentResident) renderColoursResident();
      }
    };
    reader.readAsDataURL(file);
  });
  evt.target.value = '';
}

function removeFinishedPhoto(i) {
  const item = db.finishedWork.images[i];
  db.finishedWork.images.splice(i, 1);
  if (item && item.id) {
    sb.from('finished_work_photos').delete().eq('id', item.id)
      .then(({ error }) => { if (error) console.warn('Delete photo failed:', error.message); });
  }
  renderColoursRlo();
  if (db.currentResident) renderColoursResident();
}

function saveSwatchCaveat() {
  const txt = document.getElementById('swatch-caveat').value.trim();
  if (!txt) return;
  db.finishedWork.caveat = txt;
  showToast('swatch-toast', '✓ Caveat text updated.', 't-g', 3000);
  sb.from('finished_work_settings').update({ caveat: txt }).eq('id', 1)
    .then(({ error }) => { if (error) console.warn('Save caveat failed:', error.message); });
  renderColoursRlo();
  if (db.currentResident) renderColoursResident();
}

function renderColoursRlo() {
  const caveatBox = document.getElementById('swatch-caveat');
  if (caveatBox && !caveatBox.value) caveatBox.value = db.finishedWork.caveat;
  const gal = document.getElementById('swatch-gallery-rlo');
  if (gal) {
    gal.innerHTML = db.finishedWork.images.length
      ? db.finishedWork.images.map((img, i) => `
        <div style="position:relative;display:inline-block;margin:0 8px 8px 0">
          <img src="${img.url}" style="width:140px;height:100px;object-fit:cover;border-radius:8px;border:1px solid var(--dg);display:block"/>
          <button onclick="removeFinishedPhoto(${i})" style="position:absolute;top:4px;right:4px;background:rgba(163,45,45,.9);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;line-height:1">×</button>
        </div>`).join('')
      : '<div class="empty-msg">No photos uploaded yet.</div>';
  }
  const cav = document.getElementById('swatch-preview-caveat');
  if (cav) cav.textContent = db.finishedWork.caveat;
}

function renderColoursResident() {
  const body = document.getElementById('r-colours-body'); if (!body) return;
  if (!db.finishedWork.images.length) {
    body.innerHTML = '<div class="empty-msg">No photos uploaded yet. Check back soon.</div>';
    return;
  }
  body.innerHTML = `
    ${db.finishedWork.images.map(img => `
      <div class="vc" style="padding:0;overflow:hidden;margin-bottom:9px">
        <img src="${img.url}" style="width:100%;display:block" onerror="this.style.display='none'"/>
      </div>`).join('')}
    <div class="vc" style="padding:11px">
      <div style="font-size:12px;font-weight:700;color:var(--db);margin-bottom:5px">About these photos</div>
      <div style="font-size:11px;color:var(--dgd);line-height:1.5">${db.finishedWork.caveat}</div>
    </div>`;
}

async function loadFinishedWorkFromDB() {
  try {
    const { data, error } = await sb.from('finished_work_photos').select('*').order('uploaded_at');
    if (!error && data) db.finishedWork.images = data.map(r => ({ id: r.id, url: r.photo_url }));
    const { data: settings, error: sErr } = await sb.from('finished_work_settings').select('caveat').eq('id', 1).single();
    if (!sErr && settings) db.finishedWork.caveat = settings.caveat;
  } catch (err) {
    console.warn('Load finished work failed:', err.message);
  }
}

/* ============================================================
   UPDATES — combined project updates + events
============================================================ */
let updateIdCounter = 1;
let stagedUpdatePhotos = [];

function handleUpdatePhotos(evt) {
  const files = Array.from(evt.target.files || []); if (!files.length) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      stagedUpdatePhotos.push(e.target.result);
      renderUpdatePhotoPreview();
    };
    reader.readAsDataURL(file);
  });
  evt.target.value = '';
}

function renderUpdatePhotoPreview() {
  const wrap = document.getElementById('update-photo-preview'); if (!wrap) return;
  wrap.innerHTML = stagedUpdatePhotos.map((src, i) => `
    <div style="position:relative;display:inline-block">
      <img src="${src}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--dg)"/>
      <button onclick="stagedUpdatePhotos.splice(${i},1);renderUpdatePhotoPreview()" style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1">×</button>
    </div>`).join('');
}

async function postUpdate() {
  const title = document.getElementById('update-title').value.trim();
  const body  = document.getElementById('update-body').value.trim();
  const type  = document.getElementById('update-type').value;
  const date  = document.getElementById('update-date').value.trim();
  if (!title || !body) { showToast('update-toast', 'Please add a title and details.', 't-r'); return; }

  const photos = [...stagedUpdatePhotos];
  const { data, error } = await sb.from('updates').insert({
    title, body, type, event_date: date || null, photos,
  }).select().single();

  if (error) {
    console.warn('Post update failed:', error.message);
    showToast('update-toast', 'Could not save to the database — check your connection.', 't-r', 5000);
    return;
  }

  db.updates.unshift(updateRowToLocal(data, true));
  stagedUpdatePhotos = [];
  renderUpdatePhotoPreview();

  document.getElementById('update-title').value = '';
  document.getElementById('update-body').value  = '';
  document.getElementById('update-date').value  = '';

  showToast('update-toast', '✓ Posted — this stays live alongside your other updates.', 't-g', 4000);
  renderUpdatesRlo();
  updateResidentUpdatesBadge();
  if (db.currentResident) { renderUpdatesResident(); }
}

function updateRowToLocal(row, isNew = false) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    date: row.event_date || '',
    photos: row.photos || [],
    posted: new Date(row.posted_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' }),
    isNew,
  };
}

async function loadUpdatesFromDB() {
  try {
    const { data, error } = await sb.from('updates').select('*').order('posted_at', { ascending: false });
    if (error) { console.warn('Load updates failed:', error.message); return; }
    db.updates = (data || []).map(r => updateRowToLocal(r, false));
  } catch (err) {
    console.warn('Load updates error:', err.message);
  }
}

async function loadReadUpdatesForResident() {
  if (!db.currentResident) return;
  try {
    const { data, error } = await sb.from('update_reads').select('update_id').eq('flat', db.currentResident.flat);
    if (error) { console.warn('Load read updates failed:', error.message); return; }
    const readIds = new Set((data || []).map(r => r.update_id));
    db.updates.forEach(u => { u.isNew = !readIds.has(u.id); });
  } catch (err) {
    console.warn('Load read updates error:', err.message);
  }
}

function updateResidentUpdatesBadge() {
  const badge = document.getElementById('r-updates-n');
  const sub   = document.getElementById('r-updates-sub');
  const newCount = db.updates.filter(u => u.isNew).length;
  if (badge) {
    if (newCount > 0) { badge.textContent = newCount + ' new'; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }
  if (sub && newCount > 0) sub.textContent = newCount + ' new update' + (newCount!==1?'s':'') + ' — tap to view';
}

function renderUpdatesRlo() {
  document.getElementById('updates-count-pill').textContent = db.updates.length;
  const list = document.getElementById('updates-list'); if (!list) return;
  if (!db.updates.length) { list.innerHTML = '<div class="empty-msg">No updates posted yet.</div>'; return; }
  list.innerHTML = db.updates.map(u => `
    <div class="panel" style="margin-bottom:8px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;gap:8px">
        <strong style="font-size:13px;color:var(--db)">${u.title}</strong>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span class="spill ${u.type==='Event'?'sp-j':u.type==='Job opportunity'?'sp-g':'sp-b'}">${u.type}</span>
          <button class="btn btn-r btn-sm" onclick="deleteUpdate('${u.id}')" title="Delete this post"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--dgd);margin-bottom:4px">${u.body}</div>
      ${u.photos&&u.photos.length?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin:6px 0">${u.photos.map(p=>`<img src="${p}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--dg)"/>`).join('')}</div>`:''}
      <div style="font-size:11px;color:var(--dg)">${u.date?u.date+' · ':''}Posted ${u.posted}</div>
    </div>`).join('');
}

async function deleteUpdate(id) {
  if (!confirm('Delete this post? It will be removed from the resident app too.')) return;
  db.updates = db.updates.filter(u => u.id !== id);
  renderUpdatesRlo();
  updateResidentUpdatesBadge();
  if (db.currentResident) renderUpdatesResident();
  showToast('update-toast', '✓ Post deleted.', 't-g', 3000);
  const { error } = await sb.from('updates').delete().eq('id', id);
  if (error) console.warn('Delete update failed:', error.message);
}

function renderUpdatesResident() {
  const body = document.getElementById('r-updates-body'); if (!body) return;
  if (!db.updates.length) { body.innerHTML = '<div class="empty-msg">No updates yet. Check back soon.</div>'; return; }
  body.innerHTML = db.updates.map(u => `
    <div class="vc" style="padding:12px;border-left:3px solid ${u.type==='Event'?'var(--dj)':u.type==='Job opportunity'?'var(--green)':'var(--db)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;gap:8px">
        <strong style="font-size:13px;color:var(--db)">${u.title}</strong>
        <span class="spill ${u.type==='Event'?'sp-j':u.type==='Job opportunity'?'sp-g':'sp-b'}" style="flex-shrink:0">${u.type}</span>
      </div>
      <div style="font-size:11px;color:var(--dgd);line-height:1.5;margin-bottom:4px">${u.body}</div>
      ${u.photos&&u.photos.length?`<div style="display:flex;flex-direction:column;gap:6px;margin:6px 0">${u.photos.map(p=>`<img src="${p}" style="width:100%;border-radius:8px;display:block"/>`).join('')}</div>`:''}
      <div style="font-size:10px;color:var(--dg)">${u.date?u.date+' · ':''}Posted ${u.posted}</div>
    </div>`).join('');
  const newOnes = db.updates.filter(u => u.isNew);
  db.updates.forEach(u => u.isNew = false);
  if (newOnes.length && db.currentResident) {
    const rows = newOnes.map(u => ({ update_id: u.id, flat: db.currentResident.flat }));
    sb.from('update_reads').upsert(rows, { onConflict: 'update_id,flat' })
      .then(({ error }) => { if (error) console.warn('Mark update read failed:', error.message); });
  }
  const badge = document.getElementById('r-updates-n');
  if (badge) badge.style.display = 'none';
  const sub = document.getElementById('r-updates-sub');
  if (sub) sub.textContent = 'Site news, events & job opportunities';
}

function flagUpdatesBadge() {
  updateResidentUpdatesBadge();
}

function showResidentUpdatePopup() {
  if (!db.currentResident) return;
  const newCount = db.updates.filter(u => u.isNew).length;
  if (!newCount) return;
  document.getElementById('res-update-popup')?.remove();
  const popup = document.createElement('div');
  popup.id = 'res-update-popup';
  popup.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--db);color:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 4px 20px rgba(0,40,86,.3);max-width:300px;display:flex;gap:10px;align-items:center;animation:slideIn .3s ease;cursor:pointer`;
  popup.onclick = () => { rNav(9); popup.remove(); };
  popup.innerHTML = `
    <div style="width:36px;height:36px;border-radius:9px;background:var(--dj);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ti-speakerphone" style="font-size:18px"></i></div>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;margin-bottom:1px">${newCount} new update${newCount!==1?'s':''}</div>
      <div style="font-size:11px;opacity:.8">Tap to see the latest project news</div>
    </div>
    <button onclick="event.stopPropagation();document.getElementById('res-update-popup').remove()" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:18px;cursor:pointer;padding:0;line-height:1">×</button>`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 10000);
}

/* ============================================================
   WORK ELEMENTS — a lightweight list of work items per flat
   (Kitchen, Bathroom, Asbestos Survey, etc.), each with its own
   mini status trail. Lighter alternative to a full per-element
   redesign — lives as a simple list inside each flat's record.
============================================================ */
function openWorkElements(i) {
  const e = db.schedule[i];
  if (!e.workElements) e.workElements = [];

  const existing = document.getElementById('work-el-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'work-el-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,40,86,.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:15px;font-weight:700;color:#002856">Work elements</div>
        <button onclick="document.getElementById('work-el-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b6b6b">×</button>
      </div>
      <div style="font-size:12px;color:#6b6b6b;margin-bottom:14px">${e.resident} · ${e.flat}</div>
      <div id="work-el-list-${i}"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <select id="work-el-new-name-${i}" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #D9D8D6;font-size:13px">
          ${WORK_ELEMENT_TYPES.map(t => `<option>${t}</option>`).join('')}
        </select>
        <button onclick="addWorkElement(${i})" style="background:#008C79;color:#fff;border:none;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer">+ Add</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  renderWorkElementsList(i);
}

function renderWorkElementsList(i) {
  const e = db.schedule[i];
  const list = document.getElementById(`work-el-list-${i}`);
  if (!list) return;
  const statusColour = { 'Not started':'#6b6b6b', 'Survey booked':'#854f0b', 'Survey completed':'#002856', 'Start date confirmed':'#008C79', 'Completed':'#3b6d11' };
  list.innerHTML = (e.workElements || []).length ? e.workElements.map((el, ei) => `
    <div style="background:#f2f3f5;border-radius:9px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:13px;color:#002856">${el.name}</strong>
        <div style="display:flex;align-items:center;gap:6px">
          <select onchange="updateWorkElementField(${i},${ei},'status',this.value)" style="font-size:11px;border:1px solid #D9D8D6;border-radius:6px;padding:3px 6px;color:${statusColour[el.status]||'#6b6b6b'};font-weight:600">
            ${['Not started','Survey booked','Survey completed','Start date confirmed','Completed'].map(s=>`<option${el.status===s?' selected':''}>${s}</option>`).join('')}
          </select>
          <button onclick="deleteWorkElement(${i},${ei})" style="background:none;border:none;color:#a32d2d;cursor:pointer;font-size:14px">✕</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
        <label style="color:#6b6b6b">Intro letter sent<input type="date" value="${el.introLetterSent}" onchange="updateWorkElementField(${i},${ei},'introLetterSent',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
        <label style="color:#6b6b6b">Survey booked<input type="date" value="${el.surveyBooked}" onchange="updateWorkElementField(${i},${ei},'surveyBooked',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
        <label style="color:#6b6b6b">Survey completed<input type="date" value="${el.surveyCompleted}" onchange="updateWorkElementField(${i},${ei},'surveyCompleted',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
        <label style="color:#6b6b6b">Start date<input type="date" value="${el.startDate}" onchange="updateWorkElementField(${i},${ei},'startDate',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
      </div>
      <div style="font-size:10px;font-weight:700;color:#6b6b6b;margin-top:8px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px">No access letters</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px">
        <label style="color:#6b6b6b">1st sent<input type="date" value="${el.access1Sent}" onchange="updateWorkElementField(${i},${ei},'access1Sent',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
        <label style="color:#6b6b6b">2nd sent<input type="date" value="${el.access2Sent}" onchange="updateWorkElementField(${i},${ei},'access2Sent',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
        <label style="color:#6b6b6b">3rd sent<input type="date" value="${el.access3Sent}" onchange="updateWorkElementField(${i},${ei},'access3Sent',this.value)" style="width:100%;margin-top:2px;padding:5px 7px;border-radius:6px;border:1px solid #D9D8D6;font-size:11px"/></label>
      </div>
    </div>`).join('')
    : '<div style="font-size:12px;color:#6b6b6b;text-align:center;padding:16px 0">No work elements added yet.</div>';
}

async function addWorkElement(i) {
  const e = db.schedule[i];
  if (!e.workElements) e.workElements = [];
  const name = document.getElementById(`work-el-new-name-${i}`).value;
  const el = { id: undefined, name, status: 'Not started', introLetterSent:'', surveyBooked:'', surveyCompleted:'', startDate:'', access1Sent:'', access2Sent:'', access3Sent:'' };
  e.workElements.push(el);
  renderWorkElementsList(i);
  renderDashboard();

  if (!e.id) { await saveScheduleToDB(); }
  if (e.id) {
    sb.from('work_elements').insert(workElementLocalToRow(e.id, el)).select().single()
      .then(({ data, error }) => { if (error) console.warn('Save work element failed:', error.message); else if (data) el.id = data.id; });
  }
}

function updateWorkElementField(i, ei, field, value) {
  const e = db.schedule[i];
  const el = e.workElements[ei]; if (!el) return;
  el[field] = value;
  renderDashboard();
  if (el.id) {
    sb.from('work_elements').update(workElementLocalToRow(e.id, el)).eq('id', el.id)
      .then(({ error }) => { if (error) console.warn('Update work element failed:', error.message); });
  }
}

function deleteWorkElement(i, ei) {
  const e = db.schedule[i];
  const el = e.workElements[ei]; if (!el) return;
  e.workElements.splice(ei, 1);
  renderWorkElementsList(i);
  renderDashboard();
  if (el.id) {
    sb.from('work_elements').delete().eq('id', el.id)
      .then(({ error }) => { if (error) console.warn('Delete work element failed:', error.message); });
  }
}

/* ============================================================
   MY LETTERS — resident-facing view of letters sent to them
============================================================ */
let openLetterAfterLoad = null;

async function renderMyLetters() {
  const body = document.getElementById('r-my-letters-body');
  if (!body || !db.currentResident) return;
  body.innerHTML = '<div class="empty-msg">Loading...</div>';
  try {
    // Fetch all and match flat names loosely (trimmed, case-insensitive) —
    // guards against small formatting differences between how a flat name
    // was typed at upload time vs how it's stored on login.
    const { data: allLetters, error } = await sb.from('letters_sent').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('Load my letters failed:', error.message); body.innerHTML = '<div class="empty-msg">Could not load letters — check your connection.</div>'; return; }
    const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
    const myFlat = norm(db.currentResident.flat);
    const data = (allLetters || []).filter(l => norm(l.flat) === myFlat);
    if (!data.length) { body.innerHTML = '<div class="empty-msg">No letters yet. Anything Durkan sends you will appear here.</div>'; return; }
    body.innerHTML = data.map(l => `
      <div class="faq-item" onclick="toggleFaq(this)">
        <div class="faq-q">${l.title}${l.stage?' — '+l.stage+' Request':''}</div>
        <div class="faq-a" style="max-height:none">
          <div style="font-size:10px;color:var(--dg);margin-bottom:8px">${new Date(l.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
          <div style="background:#fff;border-radius:8px;padding:10px;font-size:11px">${(l.body_html||'').replace(/contenteditable="true"/g,'')}</div>
        </div>
      </div>`).join('');

    if (openLetterAfterLoad) {
      const idx = data.findIndex(l => l.id === openLetterAfterLoad);
      openLetterAfterLoad = null;
      if (idx > -1) {
        const items = body.querySelectorAll('.faq-item');
        if (items[idx]) toggleFaq(items[idx]);
      }
    }
  } catch (err) {
    console.warn('Load my letters error:', err.message);
    body.innerHTML = '<div class="empty-msg">Could not load letters — check your connection.</div>';
  }
}

/* ============================================================
   CONTACT LOG — track attempts per resident, escalate after 3+
============================================================ */
const CONTACT_METHODS  = ['SMS', 'Phone call', 'Email', 'Letter', 'Knock on door'];
const CONTACT_OUTCOMES = ['No response', 'Voicemail left', 'Wrong number', 'Spoke to resident', 'Will call back', 'Refused access', 'Letter sent'];

function logContactAttempt(i) {
  const e = db.schedule[i];
  if (!e.contactLog) e.contactLog = [];

  const existing = document.getElementById('contact-log-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'contact-log-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,40,86,.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="font-size:15px;font-weight:700;color:#002856;margin-bottom:4px">Log contact attempt</div>
      <div style="font-size:12px;color:#6b6b6b;margin-bottom:16px">${e.resident} · ${e.flat}</div>

      <label style="font-size:11px;font-weight:600;color:#6b6b6b;display:block;margin-bottom:4px">Contact method</label>
      <select id="cl-method" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #D9D8D6;font-size:13px;margin-bottom:12px">
        ${CONTACT_METHODS.map(m=>`<option>${m}</option>`).join('')}
      </select>

      <label style="font-size:11px;font-weight:600;color:#6b6b6b;display:block;margin-bottom:4px">Outcome</label>
      <select id="cl-outcome" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #D9D8D6;font-size:13px;margin-bottom:12px">
        ${CONTACT_OUTCOMES.map(o=>`<option>${o}</option>`).join('')}
      </select>

      <label style="font-size:11px;font-weight:600;color:#6b6b6b;display:block;margin-bottom:4px">Note (optional)</label>
      <textarea id="cl-note" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #D9D8D6;font-size:13px;resize:none;margin-bottom:16px" rows="2" placeholder="e.g. Called twice, no answer. Will try letter."></textarea>

      <div style="display:flex;gap:8px">
        <button onclick="saveContactAttempt(${i})" style="flex:1;background:#008C79;color:#fff;border:none;border-radius:9px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">Save attempt</button>
        <button onclick="document.getElementById('contact-log-modal').remove()" style="padding:10px 16px;border-radius:9px;border:1px solid #D9D8D6;background:#fff;font-size:13px;cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function saveContactAttempt(i) {
  const e = db.schedule[i];
  if (!e.contactLog) e.contactLog = [];

  const method  = document.getElementById('cl-method').value;
  const outcome = document.getElementById('cl-outcome').value;
  const note    = document.getElementById('cl-note').value.trim();
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

  e.contactLog.push({ method, outcome, note, date:dateStr, time:timeStr });

  document.getElementById('contact-log-modal').remove();

  if (!e.id) { await saveScheduleToDB(); }
  if (e.id) {
    sb.from('contact_log').insert({ schedule_id: e.id, method, outcome, note: note || null })
      .then(({ error }) => { if (error) console.warn('Save contact attempt failed:', error.message); });
  } else {
    console.warn('Could not save contact attempt — schedule not yet published to the database.');
  }

  const attempts = e.contactLog.length;
  if (attempts === 3) {
    pushNotification('message', `⚠ ${e.flat} (${e.resident}) has had 3 contact attempts with no response. Consider escalating.`);
  }
  if (attempts === 5) {
    pushNotification('message', `🔴 ${e.flat} (${e.resident}) — 5 failed contact attempts. Escalation to L&Q recommended.`);
  }

  renderDashboard();
}

function viewContactLog(i) {
  const e = db.schedule[i];
  const log = e.contactLog || [];

  const existing = document.getElementById('contact-log-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'contact-log-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,40,86,.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:15px;font-weight:700;color:#002856">Contact log</div>
        <button onclick="document.getElementById('contact-log-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b6b6b">×</button>
      </div>
      <div style="font-size:12px;color:#6b6b6b;margin-bottom:14px">${e.resident} · ${e.flat} · ${log.length} attempt${log.length!==1?'s':''}</div>

      ${log.length === 0
        ? '<div style="font-size:12px;color:#6b6b6b;text-align:center;padding:20px 0">No contact attempts logged yet.</div>'
        : log.map((l,idx) => `
          <div style="background:#f2f3f5;border-radius:9px;padding:10px 12px;margin-bottom:8px;border-left:3px solid ${l.outcome==='No response'||l.outcome==='Voicemail left'?'#854f0b':l.outcome==='Spoke to resident'?'#3b6d11':'#002856'}">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <strong style="font-size:12px;color:#002856">Attempt ${idx+1} — ${l.method}</strong>
              <span style="font-size:10px;color:#6b6b6b">${l.date} ${l.time}</span>
            </div>
            <div style="font-size:11px;color:#6b6b6b;margin-bottom:${l.note?'3px':'0'}">${l.outcome}</div>
            ${l.note?`<div style="font-size:11px;color:#002856;font-style:italic">"${l.note}"</div>`:''}
          </div>`).join('')
      }

      <div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="document.getElementById('contact-log-modal').remove();logContactAttempt(${i})" style="flex:1;background:#008C79;color:#fff;border:none;border-radius:9px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">+ Log new attempt</button>
        <button onclick="exportContactLog(${i})" style="padding:10px 14px;border-radius:9px;border:1px solid #D9D8D6;background:#fff;font-size:12px;cursor:pointer">Export</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function escalateResident(i) {
  const e = db.schedule[i];
  const log = e.contactLog || [];
  const summary = log.map((l,idx) => `Attempt ${idx+1}: ${l.date} ${l.time} — ${l.method} — ${l.outcome}${l.note?' ('+l.note+')':''}`).join('\n');

  const subject = encodeURIComponent(`Resident non-response — ${e.flat}, Highbury Gardens`);
  const body = encodeURIComponent(
    `Dear L&Q,\n\nWe have been unable to contact the resident at ${e.flat}, Highbury Gardens (${e.resident}) after ${log.length} attempts.\n\nContact history:\n${summary}\n\nCould you please assist with making contact to arrange the required works appointment.\n\nKind regards,\nDurkan Regen RLO Team`
  );
  window.open(`mailto:?subject=${subject}&body=${body}`);
}

function exportContactLog(i) {
  const e = db.schedule[i];
  const log = e.contactLog || [];
  if (!log.length) return;

  const rows = [
    ['Flat','Resident','Attempt','Date','Time','Method','Outcome','Note'],
    ...log.map((l,idx) => [e.flat, e.resident, idx+1, l.date, l.time, l.method, l.outcome, l.note||''])
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `Contact_Log_${e.flat.replace(' ','_')}_${e.resident.split(' ').join('_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById('contact-log-modal').remove();
}

/* ============================================================
   TEST SMS — RLO sends a test text to verify Twilio works
============================================================ */
async function sendTestSMS() {
  const number = document.getElementById('test-sms-number').value.trim();
  if (!number) { showToast('test-sms-toast', 'Please enter a mobile number.', 't-r'); return; }
  showToast('test-sms-toast', 'Sending test SMS...', 't-j', 10000);
  const result = await sendSMS(number, 'This is a test message from the Durkan Regen resident app. SMS integration is working correctly! 🎉');
  if (result && result.success) {
    showToast('test-sms-toast', `✓ Test SMS sent successfully to ${number}. Check your phone!`, 't-g', 6000);
  } else if (result && result.skipped) {
    showToast('test-sms-toast', 'No number provided.', 't-r');
  } else {
    const err = result && result.error ? result.error : 'Unknown error';
    showToast('test-sms-toast', `SMS not sent: ${err}. Check Vercel environment variables are set and the function is deployed.`, 't-r', 8000);
  }
}

/* ============================================================
   APPOINTMENT REMINDERS — one click sends SMS to everyone
   with a confirmed appointment tomorrow
============================================================ */
async function sendTomorrowReminders() {
  if (!db.schedule.length) {
    showToast('reminder-toast', 'No schedule loaded — upload and publish first.', 't-r');
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
  const tomorrowLong = tomorrow.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });

  const matches = db.schedule.filter(e =>
    e.status === 'confirmed' &&
    e.confirmedDate &&
    (e.confirmedDate.includes(tomorrowStr) ||
     e.confirmedDate.toLowerCase().includes(tomorrow.toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toLowerCase()))
  );

  if (!matches.length) {
    showToast('reminder-toast', `No confirmed appointments found for tomorrow (${tomorrowStr}).`, 't-j', 5000);
    return;
  }

  showToast('reminder-toast', `Sending ${matches.length} reminder${matches.length!==1?'s':''}...`, 't-j', 10000);

  let sent = 0, skipped = 0, failed = 0;
  const results = [];

  for (const e of matches) {
    if (!e.mobile) {
      skipped++;
      results.push({ flat: e.flat, resident: e.resident, status: 'skipped', reason: 'No mobile number' });
      continue;
    }
    const msg = `Hi ${e.resident.split(' ')[0]}, a reminder that your ${e.workType} appointment at ${e.flat} Highbury Gardens is tomorrow (${tomorrowLong}). Please ensure access is available. If you need to rearrange, contact your RLO. Durkan Regen.`;
    const result = await sendSMS(e.mobile, msg);
    if (result && result.success) {
      sent++;
      results.push({ flat: e.flat, resident: e.resident, status: 'sent' });
    } else {
      failed++;
      results.push({ flat: e.flat, resident: e.resident, status: 'failed', reason: (result && result.error) || 'Unknown' });
    }
  }

  const summaryEl = document.getElementById('reminder-summary');
  if (summaryEl) {
    summaryEl.style.display = 'block';
    summaryEl.innerHTML = `
      <div style="background:var(--dbg);border-radius:9px;padding:12px">
        <div style="font-size:12px;font-weight:700;color:var(--db);margin-bottom:8px">
          Reminder summary — ${tomorrowStr}:
          <span style="color:var(--green)">${sent} sent</span>${skipped?` · <span style="color:var(--amber)">${skipped} skipped</span>`:''}${failed?` · <span style="color:var(--red)">${failed} failed</span>`:''}
        </div>
        ${results.map(r => `
          <div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--dg)">
            <span style="color:var(--db)">${r.flat} — ${r.resident}</span>
            <span style="color:${r.status==='sent'?'var(--green)':r.status==='skipped'?'var(--amber)':'var(--red)'};font-weight:600">
              ${r.status==='sent'?'✓ Sent':r.status==='skipped'?'— '+r.reason:'✗ '+r.reason}
            </span>
          </div>`).join('')}
      </div>`;
  }

  if (sent > 0) {
    showToast('reminder-toast', `✓ ${sent} reminder${sent!==1?'s':''} sent for tomorrow.`, 't-g', 6000);
    pushNotification('message', `${sent} appointment reminder${sent!==1?'s':''} sent for ${tomorrowStr}.`);
  } else if (skipped > 0 && failed === 0) {
    showToast('reminder-toast', `No reminders sent — ${skipped} resident${skipped!==1?'s have':' has'} no mobile number on file.`, 't-r', 6000);
  } else {
    showToast('reminder-toast', `Reminders failed — check the Twilio setup and Vercel environment variables.`, 't-r', 6000);
  }
}
/* ============================================================
   MANDATORY LETTERS — client-required standard letters
   (Access Request, Survey Confirmation, Start Date Confirmation,
   Window & Door, Front Entrance Door)
============================================================ */

function renderMandatoryLettersPage() {
  const wrap = document.getElementById('mandatory-letters-wrap');
  if (!wrap) return;

  const catOptions = Object.keys(MANDATORY_LETTERS).map(k =>
    `<option value="${k}">${MANDATORY_LETTERS[k].label}</option>`).join('');

  const residentChecks = db.schedule.map((e, i) => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;cursor:pointer" onmouseover="this.style.background='var(--dbg)'" onmouseout="this.style.background=''">
      <input type="checkbox" class="ml-flat-check" value="${i}" style="width:15px;height:15px"/>
      <span style="font-size:12px;color:var(--db)">${e.flat} — ${e.resident}</span>
    </label>`).join('');

  wrap.innerHTML = `
    <div class="panel">
      <div class="panel-t">Generate a mandatory letter</div>
      <p style="font-size:12px;color:var(--dgd);margin-bottom:14px">These are the standard letters required by L&amp;Q for the resident file. Choose a category, then the specific letter, select who it's going to, and generate a print-ready copy.</p>

      <label class="flbl">Letter category</label>
      <select class="field" id="ml-category" onchange="updateLetterVariants()">
        <option value="">Select a category...</option>
        ${catOptions}
      </select>

      <label class="flbl">Specific letter</label>
      <select class="field" id="ml-variant">
        <option value="">Select a category first...</option>
      </select>

      <div id="ml-stage-wrap" style="display:none">
        <label class="flbl">Request stage</label>
        <select class="field" id="ml-stage">
          <option value="1st">1st Request</option>
          <option value="2nd">2nd Request</option>
          <option value="3rd">3rd Request</option>
        </select>
      </div>

      <label class="flbl">Send to</label>
      ${db.schedule.length ? `
        <div style="display:flex;gap:12px;margin-bottom:6px">
          <a href="#" onclick="setAllLetterFlats(true);return false" style="font-size:11px;color:var(--dj)">Select all</a>
          <a href="#" onclick="setAllLetterFlats(false);return false" style="font-size:11px;color:var(--dj)">Clear</a>
        </div>
        <div style="max-height:220px;overflow-y:auto;border:1px solid var(--dg);border-radius:9px;padding:4px">${residentChecks}</div>
      ` : '<div style="font-size:12px;color:var(--dgd)">No flats loaded yet — upload a schedule first.</div>'}

      <label class="flbl" style="margin-top:12px">Commencement / appointment date</label>
      <input class="field" id="ml-date" placeholder="e.g. 14 August 2026"/>

      <label style="display:flex;align-items:center;gap:8px;margin:12px 0;cursor:pointer">
        <input type="checkbox" id="ml-send-sms" style="width:16px;height:16px"/>
        <span style="font-size:12px;color:var(--db)">Also text residents a link to view this letter (in addition to the printed copy)</span>
      </label>

      <button class="btn btn-j" onclick="generateMandatoryLetter()" style="margin-top:6px"><i class="ti ti-file-text"></i> Generate letter</button>
      <div class="toast" id="ml-toast" style="display:none"></div>
    </div>
    <div class="panel">
      <div class="panel-t">About these letters</div>
      <p style="font-size:12px;color:var(--dgd);line-height:1.6">Select one or more residents to send the same letter to several people at once — each gets their own page in a single print job, and each is logged individually against their own flat. The required Hi-Vis/photo ID safety notice and standard apology closing are included automatically, matching Durkan's approved wording.</p>
    </div>
    <div class="panel">
      <div class="panel-t">Recently sent <span class="spill sp-b" id="letters-sent-count">0</span></div>
      <div id="letters-sent-list"><div class="empty-msg">No letters generated yet.</div></div>
    </div>`;
  renderLettersSentList();
}

function setAllLetterFlats(checked) {
  document.querySelectorAll('.ml-flat-check').forEach(cb => { cb.checked = checked; });
}

function updateLetterVariants() {
  const catKey = document.getElementById('ml-category').value;
  const variantSelect = document.getElementById('ml-variant');
  if (!catKey) {
    variantSelect.innerHTML = '<option value="">Select a category first...</option>';
    document.getElementById('ml-stage-wrap').style.display = 'none';
    return;
  }
  const cat = MANDATORY_LETTERS[catKey];
  variantSelect.innerHTML = Object.keys(cat.variants).map(vk =>
    `<option value="${vk}">${cat.variants[vk].label}</option>`).join('');
  document.getElementById('ml-stage-wrap').style.display = cat.hasStage ? 'block' : 'none';
}

function updateLetterStageVisibility() {
  // placeholder hook — stage visibility is controlled by category, kept for future per-variant overrides
}

async function generateMandatoryLetter() {
  const catKey = document.getElementById('ml-category').value;
  const varKey = document.getElementById('ml-variant').value;
  const toast = 'ml-toast';
  if (!catKey || !varKey) { showToast(toast, 'Please select a category and letter.', 't-r'); return; }

  const cat = MANDATORY_LETTERS[catKey];
  const variant = cat.variants[varKey];
  const stage = cat.hasStage ? document.getElementById('ml-stage').value : null;
  const dateVal = document.getElementById('ml-date').value.trim() || '[date]';
  const sendSmsLink = document.getElementById('ml-send-sms').checked;

  const checked = Array.from(document.querySelectorAll('.ml-flat-check:checked')).map(cb => Number(cb.value));

  if (!checked.length) {
    // No flats selected — generate one blank letter to fill in by hand
    const resident = { name: 'Resident', flat: '[Flat]', address: 'Highbury Gardens' };
    const html = buildMandatoryLettersBatchHTML(catKey, cat, varKey, variant, stage, [resident], dateVal);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    showToast(toast, '✓ Letter opened in a new tab — review and print.', 't-g', 4000);
    return;
  }

  const residents = checked.map(i => {
    const e = db.schedule[i];
    return { name: e.resident, flat: e.flat, address: e.address || 'Highbury Gardens' };
  });

  const html = buildMandatoryLettersBatchHTML(catKey, cat, varKey, variant, stage, residents, dateVal);
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();

  const title = variant.title || variant.subject || '';
  let smsCount = 0, savedCount = 0;
  const saveErrors = [];

  for (const i of checked) {
    const e = db.schedule[i];
    logLetterToContactLog(i, cat, variant, stage);
    if (catKey === 'access' && stage) stampWorkElementAccessLetter(i, varKey, stage);

    const resident = { name: e.resident, flat: e.flat, address: e.address || 'Highbury Gardens' };
    const bodyHtml = buildMandatoryLetterPage(catKey, cat, varKey, variant, stage, resident, dateVal);
    const result = await saveLetterSent(e, catKey, varKey, stage, title, bodyHtml, sendSmsLink ? 'SMS' : 'Print');

    if (result.id) {
      savedCount++;
      if (sendSmsLink && e.mobile) {
        const link = `${LETTER_TEMPLATE.appUrl}?code=${e.accessCode}&letter=${result.id}`;
        sendSMS(e.mobile, `Hi ${e.resident.split(' ')[0]}, Durkan has sent you a new letter regarding your ${variant.label}. View it here: ${link}`);
        smsCount++;
      }
    } else {
      saveErrors.push(`${e.flat}: ${result.error || 'unknown error'}`);
    }
  }

  renderLettersSentList();

  if (saveErrors.length) {
    showToast(toast, `⚠ Letter opened, but ${saveErrors.length} of ${checked.length} could not be recorded — ${saveErrors[0]}`, 't-r', 9000);
  } else {
    showToast(toast, `✓ Letter opened — ${checked.length} page${checked.length!==1?'s':''}, ${savedCount} recorded.${sendSmsLink ? ` ${smsCount} resident${smsCount!==1?'s':''} texted a link.` : ''}`, 't-g', 6000);
  }
}

async function saveLetterSent(e, catKey, varKey, stage, title, bodyHtml, sentVia) {
  if (!e.id) { await saveScheduleToDB(); }
  if (!e.id) return { id: null, error: 'This flat has no database record yet — try publishing the schedule again first.' };
  try {
    const { data, error } = await sb.from('letters_sent').insert({
      schedule_id: e.id, flat: e.flat, resident: e.resident,
      category: catKey, variant: varKey, stage, title, body_html: bodyHtml, sent_via: sentVia,
    }).select().single();
    if (error) { console.warn('Save letter record failed:', error.message); return { id: null, error: error.message }; }
    return { id: data.id, error: null };
  } catch (err) {
    console.warn('Save letter record threw:', err.message);
    return { id: null, error: err.message };
  }
}

async function openFlatLetters(i) {
  const e = db.schedule[i];

  const existing = document.getElementById('flat-letters-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'flat-letters-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,40,86,.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:22px;width:100%;max-width:460px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:15px;font-weight:700;color:#002856">Letters sent</div>
        <button onclick="document.getElementById('flat-letters-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b6b6b">×</button>
      </div>
      <div style="font-size:12px;color:#6b6b6b;margin-bottom:14px">${e.resident} · ${e.flat}</div>
      <div id="flat-letters-list-${i}"><div style="font-size:12px;color:#6b6b6b;text-align:center;padding:16px 0">Loading...</div></div>
    </div>`;
  document.body.appendChild(modal);

  try {
    const { data, error } = await sb.from('letters_sent').select('*').eq('flat', e.flat).order('created_at', { ascending: false });
    const list = document.getElementById(`flat-letters-list-${i}`);
    if (!list) return;
    if (error) { list.innerHTML = '<div style="font-size:12px;color:#a32d2d">Could not load letters.</div>'; return; }
    if (!data.length) { list.innerHTML = '<div style="font-size:12px;color:#6b6b6b;text-align:center;padding:16px 0">No letters sent to this flat yet.</div>'; return; }
    list.innerHTML = data.map((l, li) => `
      <div style="background:#f2f3f5;border-radius:9px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="const c=document.getElementById('fl-body-${i}-${li}');c.style.display=c.style.display==='none'?'block':'none'">
          <div>
            <strong style="font-size:12px;color:#002856">${l.title}${l.stage?' — '+l.stage+' Request':''}</strong><br>
            <span style="font-size:10px;color:#6b6b6b">${new Date(l.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
          </div>
          <span class="spill ${l.sent_via==='SMS'?'sp-g':'sp-b'}" style="font-size:10px">${l.sent_via}</span>
        </div>
        <div id="fl-body-${i}-${li}" style="display:none;margin-top:8px;background:#fff;border-radius:7px;padding:10px;font-size:11px">${(l.body_html||'').replace(/contenteditable="true"/g,'')}</div>
      </div>`).join('');
  } catch (err) {
    console.warn('Load flat letters error:', err.message);
  }
}

async function renderLettersSentList() {
  const list = document.getElementById('letters-sent-list');
  const countEl = document.getElementById('letters-sent-count');
  if (!list) return;
  try {
    const { data, error } = await sb.from('letters_sent').select('*').order('created_at', { ascending: false }).limit(20);
    if (error) { console.warn('Load letters sent failed:', error.message); return; }
    if (countEl) countEl.textContent = data.length;
    list.innerHTML = data.length ? data.map(l => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--dg);font-size:12px">
        <div>
          <strong style="color:var(--db)">${l.flat}</strong> — ${l.resident}<br>
          <span style="color:var(--dgd);font-size:11px">${l.title}${l.stage?' ('+l.stage+' Request)':''}</span>
        </div>
        <div style="text-align:right">
          <span class="spill ${l.sent_via==='SMS'?'sp-g':'sp-b'}" style="font-size:10px">${l.sent_via}</span><br>
          <span style="color:var(--dg);font-size:10px">${new Date(l.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
        </div>
      </div>`).join('') : '<div class="empty-msg">No letters generated yet.</div>';
  } catch (err) {
    console.warn('Load letters sent error:', err.message);
  }
}

// If the flat has a matching work element (Kitchen/Bathroom), auto-stamp the
// right 1st/2nd/3rd no-access date field so it shows at a glance.
function stampWorkElementAccessLetter(i, varKey, stage) {
  const e = db.schedule[i];
  if (!e || !e.workElements || !e.workElements.length) return;
  const nameMatch = varKey === 'kitchen' ? 'Kitchen' : varKey === 'bathroom' ? 'Bathroom' : null;
  if (!nameMatch) return;
  const el = e.workElements.find(x => x.name === nameMatch);
  if (!el) return;
  const field = stage === '1st' ? 'access1Sent' : stage === '2nd' ? 'access2Sent' : 'access3Sent';
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd, matches the date picker fields
  el[field] = today;
  if (el.id) {
    sb.from('work_elements').update(workElementLocalToRow(e.id, el)).eq('id', el.id)
      .then(({ error }) => { if (error) console.warn('Auto-stamp access letter failed:', error.message); });
  }
}

async function logLetterToContactLog(i, cat, variant, stage) {
  const e = db.schedule[i]; if (!e) return;
  if (!e.contactLog) e.contactLog = [];

  const now = new Date();
  const note = `${cat.label} — ${variant.label}${stage ? ' (' + stage + ' Request)' : ''}`;
  const attempt = {
    method: 'Letter', outcome: 'Letter sent', note,
    date: now.toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
    time: now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),
  };
  e.contactLog.push(attempt);

  if (!e.id) { await saveScheduleToDB(); }
  if (e.id) {
    sb.from('contact_log').insert({ schedule_id: e.id, method: attempt.method, outcome: attempt.outcome, note: attempt.note })
      .then(({ error }) => { if (error) console.warn('Save letter to contact log failed:', error.message); });
  }

  const attempts = e.contactLog.length;
  if (attempts === 3) {
    pushNotification('message', `⚠ ${e.flat} (${e.resident}) has had 3 contact attempts with no response. Consider escalating.`);
  }
  if (attempts === 5) {
    pushNotification('message', `🔴 ${e.flat} (${e.resident}) — 5 failed contact attempts. Escalation to L&Q recommended.`);
  }

  renderDashboard();
}

function buildMandatoryLettersBatchHTML(catKey, cat, varKey, variant, stage, residents, dateVal) {
  const title = variant.title || variant.subject || '';
  const pages = residents.map((resident, idx) =>
    `<div class="${idx < residents.length - 1 ? 'page-break' : ''}">${buildMandatoryLetterPage(catKey, cat, varKey, variant, stage, resident, dateVal)}</div>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>${letterStyles()}</head><body>
    <div class="edit-hint">
      ✏️ Fields underlined with dashes are editable. Everything else is fixed wording.${residents.length > 1 ? ` (${residents.length} letters — one per page)` : ''}
      <button onclick="window.print()">🖨 Print ${residents.length > 1 ? 'all letters' : 'letter'}</button>
    </div>
    ${pages}
  </body></html>`;
}

function buildMandatoryLetterPage(catKey, cat, varKey, variant, stage, resident, dateVal) {
  const t = LETTER_TEMPLATE;
  const today = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const title = variant.title || variant.subject || '';
  const body = buildMandatoryLetterBody(catKey, cat, varKey, variant, stage, dateVal);
  const signOff = cat.signOff;

  return `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:40px;font-size:13px;color:#222;line-height:1.6">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #008C79;padding-bottom:16px;margin-bottom:20px">
        <div>
          <span style="font-size:26px;font-weight:700;color:#002856">DURKAN</span>
          <span style="font-size:18px;font-weight:700;color:#008C79"> regen</span>
          <div style="font-size:11px;color:#888;margin-top:4px">${t.siteOffice}<br>${t.siteAddr}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#888">
          <div>Our Ref: <span contenteditable="true" style="border-bottom:2px dashed #008C79">${t.ref}RD034</span></div>
          <div style="margin-top:4px" contenteditable="true">${today}</div>
        </div>
      </div>

      <div style="margin-bottom:20px;font-size:13px">
        <strong contenteditable="true" style="border-bottom:2px dashed #008C79">${resident.name}</strong><br>
        <span contenteditable="true" style="border-bottom:2px dashed #008C79">${resident.flat}</span><br>
        ${resident.address}
      </div>

      ${cat.hasStage ? `<div style="margin-bottom:10px;font-weight:700">${stage} Request to Contact for Survey</div>` : ''}

      <div style="margin-bottom:16px"><strong>Dear ${resident.name.split(' ')[0] === 'Resident' ? 'Resident' : resident.name},</strong></div>

      <div style="font-size:14px;font-weight:700;color:#002856;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">${title}</div>

      ${body}

      <p>All Durkan employees wear Hi-Vis vests and carry photo ID. If you are unsure of anyone claiming to represent Durkan Limited or its subcontractors, please contact our liaison officer${cat.contactName2 ? 's' : ''} <strong contenteditable="true" style="border-bottom:2px dashed #008C79">${cat.contactName} ${cat.contactPhone}</strong>${cat.contactName2 ? ` or <strong contenteditable="true" style="border-bottom:2px dashed #008C79">${cat.contactName2} ${cat.contactPhone2}</strong>` : ''} prior to allowing access to your home.</p>

      <p>We would like to apologise for any inconvenience this may cause you and would like to take this opportunity to thank you in advance for your co-operation and patience.</p>

      <div style="margin-top:28px">
        <div>Yours ${signOff.role ? 'sincerely' : 'faithfully'},</div>
        <div style="margin-top:28px">
          <div style="font-weight:700;color:#002856">${signOff.name}</div>
          ${signOff.role ? `<div>${signOff.role}</div>` : ''}
          ${signOff.email ? `<div><a href="mailto:${signOff.email}">${signOff.email}</a></div>` : ''}
          ${signOff.cc ? `<div style="margin-top:8px">Cc: L&amp;Q</div>` : ''}
        </div>
      </div>
    </div>`;
}

function letterDetailRow(label, value) {
  return `<div style="display:flex;padding:3px 0"><span style="min-width:190px;color:#555">${label}</span><strong contenteditable="true" style="border-bottom:2px dashed #008C79">${value}</strong></div>`;
}

function buildMandatoryLetterBody(catKey, cat, varKey, variant, stage, dateVal) {
  if (catKey === 'access') {
    if (varKey === 'kitchen') {
      return `
        <p>Durkan Limited has been appointed by L&amp;Q to carry out internal refurbishment works to your home.</p>
        <p>We have tried to contact you to rebook your kitchen survey. Can we please ask if you can call ${cat.contactName} our Resident Liaison Officer direct to book the appointment ${cat.contactPhone}.</p>
        <p>Before we can start installing your new kitchen, we need to carry out a kitchen design survey, which will take approximately ${variant.duration}.</p>
        <p>Our kitchen designer is on site Monday to Friday, 9am to 3pm, please call our liaison officer to arrange a convenient appointment on receipt of this letter.</p>
        <p>Our kitchen designer will ask you what appliances you have and if you intend to change any of them, he/she will design your new kitchen taking the appliances into consideration. Our Liaison Officer will also visit at the same time to discuss and show you the colour choices available to you (if you have not already chosen them).</p>
        <p>The designer will show you the kitchen plan and ask you to sign it to say that you have seen and understand the design and he will leave a copy with you.</p>`;
    }
    return `
      <p>Durkan Limited has been appointed by L&amp;Q to carry out internal refurbishment works to your home.</p>
      <p>Before we can start installing your new bathroom, we need to carry out a design survey, which will take approximately ${variant.duration}.</p>
      <p>We have appointments available Monday to Friday, 9am to 2pm, please contact our liaison officer to arrange a mutually convenient appointment on receipt of this letter.</p>`;
  }

  if (catKey === 'survey') {
    const kitchenBit = variant.kitchenExtras ? `
        <p>Our kitchen designer will ask you what appliances you have and if you intend to change any of them, he / she will design your new kitchen taking the appliances into consideration.</p>
        <p>Our Liaison Officer ${cat.contactName} or ${cat.contactName2} will also visit at the same time to discuss and show you the colour choices available to you, please ensure the decision maker is at home during the survey.</p>
        <p>The designer will show you the kitchen plan and will ask you to sign it to say that you have seen and understand the design and he / she will leave a copy with you.</p>`
      : `<p>${cat.contactName} or ${cat.contactName2} will visit to discuss colour choices with you.</p>`;
    return `
      <p>Durkan Limited has been appointed by L&amp;Q to carry out internal refurbishment works to your home.</p>
      <p>We are writing to you to confirm your ${variant.workType.toLowerCase()} appointment, which will take approximately ${variant.duration}.</p>
      <div style="margin:14px 0">
        ${letterDetailRow('Type of Works:', variant.workType)}
        ${letterDetailRow('Commencement Date:', dateVal)}
        ${letterDetailRow('Hours of work:', '9am to 2pm')}
      </div>
      ${kitchenBit}
      <p>We would like to remind you that an asbestos test will also be carried out. This test is essential, and without it the planned works cannot proceed. Global Environmental will visit during the day to carry out the test. Please note they may not attend at the same time as our kitchen team.</p>`;
  }

  if (catKey === 'startdate') {
    const kitchenBit = variant.kitchenExtras ? `
        <p>Prior to your appointment, we would ask you to remove all curtains, blinds, and personal fittings, ensure if you are having a bathroom renewal and wish to retain your own toilet seat, curtain rail/shower screen, toilet roll holder, towel rail etc. are removed, please ensure all kitchen cupboards are emptied ahead of time. We will not be responsible for any items disposed of accidentally. Failure to remove all items prior to your appointment could result in your works not starting.</p>
        <p>We will aim to keep your existing cooker in situ during these works. All appliances must be temporarily positioned in other rooms of your home until the works are completed, either moved by yourself or, if you require Durkan to move the appliances, a disclaimer will need to be signed stating any damage caused. Durkan cannot be responsible for this, although we do have duty of care. You will have use of a sink with hot and cold running water every evening; your washing machine will be reconnected on a Friday for use over the weekend.</p>`
      : `
        <p>Prior to your appointment, we would ask you to remove all curtains, blinds, and personal fittings, and ensure your own toilet seat, curtain rail/shower screen, toilet roll holder, towel rail etc. are removed. We will not be responsible for any items disposed of accidentally. Failure to remove all items prior to your appointment could result in your works not starting.</p>
        <p>You will have use of the sink with hot and cold running water, as well as constant access to your toilet; the shower head will be fitted at the end of the works.</p>`;
    return `
      <p>We write to advise you that the installation of your ${variant.workType} will commence as follows:</p>
      <div style="margin:14px 0">
        ${letterDetailRow('Type of Works:', variant.workType)}
        ${letterDetailRow('Commencement Date:', dateVal)}
        ${letterDetailRow('Anticipated Completion Date:', variant.completion)}
        ${letterDetailRow('Hours of Work:', '8.00am – 5.00pm')}
      </div>
      <p>As noted on the dates above we would anticipate the whole works will be complete in approximately ${variant.completion}, we will require continuous access into your home to enable this to be achieved. If we do not require access into your home on a certain day we will inform you in advance, where possible.</p>
      ${kitchenBit}`;
  }

  if (catKey === 'windowdoor') {
    return `
      <p>As discussed, we write to advise we will be carrying out your window installation as follows:</p>
      <div style="margin:14px 0">${letterDetailRow('Commencement Date:', dateVal)}</div>
      <p>We will require access into your home to fit your new windows, a set of keys will be handed to you on the day, and you will be shown how your new windows work.</p>
      <p>You are required to remove curtains, clear window cills and move furniture one meter away from each of the windows prior to the works starting. If you are not able to do so, please contact your RLO who will arrange assistance to carry this out for you.</p>`;
  }

  if (catKey === 'fed') {
    return `
      <p>We are writing to advise you that we will be fitting your new front entrance door as follows:</p>
      <div style="margin:14px 0">${letterDetailRow('Commencement Date:', dateVal)}</div>
      <p>We will require access into your home to fit your new door, a set of keys will be handed to you on the day, and you will be shown how your new door works.</p>`;
  }

  return '';
}

/* ---- Dashboard shortcut: suggest an Access Request letter for
   non-confirmed flats, with the right stage pre-selected ---- */
function openAccessLetterFor(i) {
  const e = db.schedule[i];
  bNav(10);
  setTimeout(() => {
    document.getElementById('ml-category').value = 'access';
    updateLetterVariants();
    const guessKitchen = /kitchen/i.test(e.workType) && !/bath/i.test(e.workType);
    document.getElementById('ml-variant').value = guessKitchen ? 'kitchen' : 'bathroom';
    const attempts = (e.contactLog || []).length;
    document.getElementById('ml-stage').value = attempts >= 3 ? '3rd' : attempts === 2 ? '2nd' : '1st';
    setAllLetterFlats(false);
    const idx = db.schedule.indexOf(e);
    const cb = document.querySelector(`.ml-flat-check[value="${idx}"]`);
    if (cb) cb.checked = true;
    showToast('ml-toast', 'Details pre-filled from the contact log — check and generate.', 't-j', 5000);
  }, 100);
}
