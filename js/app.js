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
  if (code) {
    // Pre-fill the resident login box and attempt login
    const inp = document.getElementById('res-code');
    if (inp) { inp.value = code.toUpperCase(); resLogin(true); }
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
const resPageMap = { 1:'rp-home', 2:'rp-appts', 3:'rp-defects', 4:'rp-message', 5:'rp-faq', 6:'rp-feedback', 7:'rp-during' };
const resNavDef  = [
  { i:1, icon:'ti-home',           label:'Home' },
  { i:2, icon:'ti-calendar',       label:'Pre Works Visits' },
  { i:7, icon:'ti-hard-hat',       label:'During Works' },
  { i:3, icon:'ti-alert-triangle', label:'Report an Issue' },
  { i:4, icon:'ti-mail',           label:'Message Durkan' },
  { i:5, icon:'ti-help',           label:'FAQ & Guides' },
  { i:6, icon:'ti-star',           label:'Satisfaction Survey' },
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
}

/* ============================================================
   RLO NAV
============================================================ */
const rloPageMap = { 1:'bp-dashboard', 2:'bp-upload', 3:'bp-during', 4:'bp-defects', 5:'bp-messages', 6:'bp-reports', 7:'bp-letters' };
const rloNavDef  = [
  { i:1, icon:'ti-layout-dashboard', label:'Dashboard' },
  { i:2, icon:'ti-upload',           label:'Pre Works Schedule' },
  { i:3, icon:'ti-hard-hat',         label:'During Works' },
  { i:4, icon:'ti-alert-triangle',   label:'Issues' },
  { i:5, icon:'ti-mail',             label:'Messages' },
  { i:7, icon:'ti-mail-forward',     label:'Resident Letters' },
  { i:6, icon:'ti-chart-bar',        label:'Reports' },
];
let curRloPage = 0;

function buildRloNav(cur) {
  document.getElementById('rlo-nav').innerHTML = rloNavDef.map(n =>
    `<button class="si${n.i===cur?' on':''}" onclick="bNav(${n.i})"><i class="ti ${n.icon}"></i>${n.label}</button>`
  ).join('');
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
  if (i === 3) { renderDuringWorksRlo(); document.getElementById('during-review-panel').style.display = duringWorksList.length ? 'block' : 'none'; }
  if (i === 4) renderRloDefects();
  if (i === 6) renderReports();
  if (i === 7) renderLettersPage();
}

/* ============================================================
   LOGIN
============================================================ */
function resLogin(auto = false) {
  const raw = (document.getElementById('res-code')?.value || '').trim().toUpperCase();
  const err = document.getElementById('res-err');
  const inp = document.getElementById('res-code');
  const demo  = DEMO_CODES[raw];
  const sched = db.schedule.find(e => e.accessCode === raw);
  const match = demo || sched;
  if (match) {
    db.currentResident = { flat: match.flat, resident: match.resident, accessCode: raw };
    document.getElementById('r-hello').textContent  = 'Hello, ' + match.resident.split(' ')[0];
    document.getElementById('r-addr').textContent   = match.flat + ' · Highbury Gardens';
    document.getElementById('r-appts-hdr').textContent = match.flat + ' · Highbury Gardens';
    const chip = document.getElementById('res-chip');
    chip.textContent = '🔒 ' + match.flat; chip.style.display = 'inline-block';
    renderResidentHome();
    rNav(1);
  } else if (!auto) {
    if (inp) inp.classList.add('error');
    if (err) err.style.display = 'block';
    setTimeout(() => { inp?.classList.remove('error'); if(err) err.style.display='none'; }, 3000);
  }
}

function rloLogin() {
  const raw   = (document.getElementById('rlo-code')?.value || '').trim().toUpperCase();
  const err   = document.getElementById('rlo-err');
  const match = RLO_CODES[raw];
  if (match) {
    db.currentRLO = match;
    const chip = document.getElementById('rlo-chip');
    chip.textContent = '👤 ' + match.name + ' · ' + match.role;
    chip.style.display = 'inline-block';
    bNav(1);
    // Show any queued notifications
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
  // If RLO is logged in, show immediately
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
  // Remove any existing popup
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
  setTimeout(() => popup.remove(), 6000);
}

function updateNotifBadge() {
  const unread = db.notifications.filter(n => !n.read).length;
  const badge  = document.getElementById('rlo-notif-badge');
  if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-flex' : 'none'; }
}

/* ============================================================
   UTILITY
============================================================ */
function genCode(flat) {
  const n = flat.replace(/\D/g,'').padStart(2,'0');
  return `DRK-F${n}-${Math.floor(1000+Math.random()*9000)}`;
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
  const parsed = rows.map(r => ({
    flat:      getCol(r,'Flat','FlatNo','Unit'),
    resident:  getCol(r,'Resident','ResidentName','Name','Tenant'),
    workType:  getCol(r,'WorkType','Work Type','Work','Type','Job'),
    slots:     [getCol(r,'Date1','Date 1'),getCol(r,'Date2','Date 2'),getCol(r,'Date3','Date 3')].filter(Boolean),
    status:'pending', confirmedDate:'', locked:false, accessCode:'',
  })).filter(r => r.flat);
  if (!parsed.length) { showToast('parse-toast','No valid rows found. Check column headers.','t-r'); return; }
  parsed.forEach(e => e.accessCode = genCode(e.flat));
  db.schedule = parsed;
  renderEntryTable();
  showToast('parse-toast',`✓ ${filename} — ${parsed.length} entries loaded.`,'t-g',5000);
}

function loadDemo() {
  db.schedule = DEMO_SCHEDULE.map(e => ({...e}));
  renderEntryTable();
  showToast('parse-toast','✓ Demo schedule loaded.','t-g');
}

function renderEntryTable() {
  const tbody = document.getElementById('entry-tbody'); if (!tbody) return;
  tbody.innerHTML = db.schedule.map((e,i) => `
    <tr>
      <td><input style="width:70px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.flat}" onchange="db.schedule[${i}].flat=this.value"/></td>
      <td><input style="width:100px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.resident}" onchange="db.schedule[${i}].resident=this.value"/></td>
      <td><input style="width:110px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.workType}" onchange="db.schedule[${i}].workType=this.value"/></td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td style="font-size:10px;color:var(--dgd);line-height:1.6">${e.slots.join('<br>')||'—'}</td>
      <td><button class="btn btn-r btn-sm" onclick="db.schedule.splice(${i},1);renderEntryTable()"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
}

function addEntry() {
  db.schedule.push({flat:'Flat',resident:'',workType:'Pre Works',accessCode:genCode('Flat'),slots:[],status:'pending',confirmedDate:'',locked:false});
  renderEntryTable();
}

function publishSchedule() {
  if (!db.schedule.length) { showToast('publish-toast','Add at least one entry first.','t-r'); return; }
  db.published = true;
  showToast('publish-toast','✓ Published — residents can now log in and select dates.','t-g',5000);
  renderDashboard();
  if (db.currentResident) renderResidentHome();
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
  // Generate QR data URLs for each flat then render table
  generateQrDataUrls(db.schedule).then(qrUrls => {
    const tbody = document.getElementById('letters-tbody');
    if (!tbody) return;
    tbody.innerHTML = db.schedule.map((e, i) => `
      <tr>
        <td><strong>${e.flat}</strong></td>
        <td>${e.resident}</td>
        <td><span class="code-chip">${e.accessCode}</span></td>
        <td><img src="${qrUrls[i]}" width="60" height="60" style="display:block"/></td>
        <td><button class="btn btn-o btn-sm" onclick="printSingleLetter(${i})"><i class="ti ti-printer"></i> Print</button></td>
      </tr>`).join('');
  });
}

async function generateQrDataUrls(schedule) {
  const urls = [];
  for (const e of schedule) {
    try {
      const url = await QRCode.toDataURL(buildQrUrl(e.accessCode), {
        width: 120, margin: 1, color: { dark: '#002856', light: '#ffffff' }
      });
      urls.push(url);
    } catch { urls.push(''); }
  }
  return urls;
}

function buildQrUrl(code) {
  return `${LETTER_TEMPLATE.appUrl}?code=${code}`;
}

async function generateAllLetters() {
  const qrUrls = await generateQrDataUrls(db.schedule);
  const win = window.open('', '_blank');
  win.document.write(buildAllLettersHTML(qrUrls));
  win.document.close();
  setTimeout(() => win.print(), 800);
  showToast('letters-toast', `✓ Print pack opened — ${db.schedule.length} letters ready.`, 't-g', 4000);
}

async function printSingleLetter(i) {
  const e = db.schedule[i];
  const qrUrl = await QRCode.toDataURL(buildQrUrl(e.accessCode), {
    width: 120, margin: 1, color: { dark: '#002856', light: '#ffffff' }
  });
  const win = window.open('', '_blank');
  win.document.write(buildLetterHTML(e, qrUrl));
  win.document.close();
  setTimeout(() => win.print(), 800);
}

function buildAllLettersHTML(qrUrls) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Resident Letters</title>
    <style>body{font-family:Arial,sans-serif;margin:0}@media print{.page-break{page-break-after:always}}</style>
    </head><body>
    ${db.schedule.map((e,i) => `<div class="${i<db.schedule.length-1?'page-break':''}">${buildLetterBody(e, qrUrls[i])}</div>`).join('')}
    </body></html>`;
}

function buildLetterHTML(e, qrUrl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Letter — ${e.flat}</title>
    </head><body>${buildLetterBody(e, qrUrl)}</body></html>`;
}

function buildLetterBody(e, qrUrl) {
  const t = LETTER_TEMPLATE;
  const today = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  return `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:40px;font-size:13px;color:#222;line-height:1.6">
    <!-- Letterhead -->
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

    <!-- Recipient -->
    <div style="margin-bottom:20px;font-size:13px">
      <strong>${e.resident}</strong><br>
      ${e.flat}<br>
      Highbury Gardens
    </div>

    <div style="margin-bottom:16px"><strong>Dear ${e.resident.split(' ')[0]},</strong></div>

    <div style="font-size:14px;font-weight:700;color:#002856;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">Introduction Letter</div>

    <p>Durkan Ltd has been appointed by ${t.client} to carry out ${t.workType} works to your home.</p>

    <p>We shall be setting up our site compound at ${t.siteAddr}. We will be contacting you soon to arrange a visit to your home, so we can introduce ourselves, go through our Resident Information Pack, and carry out a survey of your home.</p>

    <p>As part of our commitment to keeping you informed throughout the works, we have set up a <strong>Resident App</strong> — your personal digital link to the Durkan team. The app lets you confirm your appointment dates, see what work is happening at your home each day, report any issues, and message your Resident Liaison Officer directly from your phone.</p>

    <!-- QR + Access code box -->
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
          <div style="font-size:11px;color:#666;margin-top:6px">${e.flat} · Highbury Gardens</div>
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
  document.getElementById('dash-tbody').innerHTML = db.schedule.map((e,i) => `
    <tr>
      <td><strong>${e.flat}</strong></td><td>${e.resident}</td><td>${e.workType}</td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td>${sPill[e.status]||''}</td>
      <td>${e.confirmedDate?`<strong style="color:var(--dj)">${e.confirmedDate}</strong>`:`<span style="color:var(--dg)">—</span>`}</td>
      <td>${e.locked
        ? `<button class="btn btn-o btn-sm" onclick="unlockSlot(${i})">🔓 Unlock</button>`
        : e.status==='pending'
          ? `<button class="btn btn-o btn-sm" onclick="alert('SMS sent to ${e.resident}')">Remind</button>`
          : e.status==='none-requested'
            ? `<button class="btn btn-sm" style="background:var(--amberbg);color:var(--amber);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="sendNewSlots(${i})">New slots</button>`
            : `<span style="color:var(--dj);font-size:11px;font-weight:600">✓ Done</span>`
      }</td>
    </tr>`).join('');
  // Defects panel
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

function unlockSlot(i) {
  db.schedule[i].locked=false; db.schedule[i].status='pending'; db.schedule[i].confirmedDate='';
  renderDashboard();
  if (db.currentResident?.flat===db.schedule[i].flat) renderResAppts();
}
function sendNewSlots(i) {
  db.schedule[i].status='pending';
  db.schedule[i].slots=['Mon 23 Jun','Tue 24 Jun','Wed 25 Jun'];
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
    note:      getCol(r,'Note','Notes','Additional','Info')||'',
  })).filter(r=>r.flat&&r.trade);
  if (!parsed.length) { showToast('during-parse-toast','No valid rows found.','t-r'); return; }
  duringWorksList = parsed;
  renderDuringTable();
  showToast('during-parse-toast',`✓ ${filename} — ${parsed.length} entries loaded.`,'t-g',5000);
}

function loadDuringDemo() {
  duringWorksList = [
    {flat:'Flat 14',resident:'Sarah Ahmed', trade:'Tiler',       timeframe:'AM',note:'Kitchen floor — please clear the area'},
    {flat:'Flat 9', resident:'James Obi',   trade:'Electrician', timeframe:'PM',note:'Second fix electrics'},
    {flat:'Flat 21',resident:'Aisha Patel', trade:'Plumber',     timeframe:'AM',note:'Bathroom installation'},
    {flat:'Flat 3', resident:'Unconfirmed', trade:'Plasterer',   timeframe:'AM',note:'Bedroom walls'},
    {flat:'Flat 7', resident:'Maria Santos',trade:'Decorator',   timeframe:'PM',note:'Living room — first coat'},
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
      <td><input style="width:95px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.resident}" onchange="duringWorksList[${i}].resident=this.value"/></td>
      <td><input style="width:110px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.trade}" onchange="duringWorksList[${i}].trade=this.value"/></td>
      <td><select style="border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" onchange="duringWorksList[${i}].timeframe=this.value">
        <option${e.timeframe==='AM'?' selected':''}>AM</option>
        <option${e.timeframe==='PM'?' selected':''}>PM</option>
      </select></td>
      <td><input style="width:140px;border:1px solid var(--dg);border-radius:5px;padding:3px 5px;font-size:11px" value="${e.note}" onchange="duringWorksList[${i}].note=this.value"/></td>
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
  db.duringWorks = duringWorksList.map(e => ({...e, forDate:dateStr, publishedAt:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}));
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
      <div style="background:${e.timeframe==='AM'?'var(--dbl)':'var(--amberbg)'};color:${e.timeframe==='AM'?'var(--db)':'var(--amber)'};border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;flex-shrink:0">${e.timeframe}</div>
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
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
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
  if (my.length) { if(badge)badge.style.display='inline-block'; if(sub)sub.textContent=`Tomorrow ${my[0].timeframe} — ${my[0].trade}`; }
  else           { if(badge)badge.style.display='none'; if(sub)sub.textContent='Tomorrow\'s works schedule'; }
}

/* ============================================================
   RESIDENT HOME
============================================================ */
function renderResidentHome() {
  if (!db.currentResident) return;
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
      ${e.slots.map((s,idx)=>`
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
  if (p.idx==='none') {
    e.status='none-requested';
    phToast(`rtost-${si}`,'New options requested. Your RLO will contact you within 48 hours.','err');
    pushNotification('appointment',`${e.flat} (${e.resident}) requested new appointment slots.`);
  } else {
    e.confirmedDate=p.label; e.status='confirmed'; e.locked=true;
    pushNotification('appointment',`${e.flat} (${e.resident}) confirmed their appointment: ${p.label}.`);
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

function submitDefect() {
  const desc=document.getElementById('r-def-desc').value.trim();
  if(!desc){phToast('def-toast','Please describe the issue first.','err');return;}
  const def={
    id:'ISS-'+String(defectIdCounter++).padStart(3,'0'),
    flat:db.currentResident.flat, resident:db.currentResident.resident,
    desc, location:document.getElementById('r-def-location').value,
    priority:document.getElementById('r-def-priority').value,
    status:'open', date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
    updates:[], photo:selectedPhoto?selectedPhoto.name:null, rating:null,
  };
  db.defects.push(def);
  db.messages.push({from:`${def.resident} — ${def.flat}`,time:'Just now',body:`Issue reported: ${def.location} — ${def.desc}`,complaint:false,type:'issue'});
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
        <div><div class="def-title">${d.id} — ${d.location} (${d.flat})</div>
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
  d.updates.push(`${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} — Status: ${status==='in-progress'?'in progress':status}`);
  renderRloDefects(); renderDashboard(); renderReports();
  if(db.currentResident?.flat===d.flat) renderResDefects();
}

function addDefectUpdate(defId) {
  const note=prompt('Add an update (visible to resident):'); if(!note) return;
  const d=db.defects.find(x=>x.id===defId); if(!d) return;
  d.updates.push(`${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} — ${note}`);
  renderRloDefects();
  if(db.currentResident?.flat===d.flat) renderResDefects();
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
}

function openMsg(i) {
  const m=db.messages[i]; if(!m) return;
  document.getElementById('bo-inbox-list').style.display='none';
  document.getElementById('bo-inbox-detail').style.display='block';
  document.getElementById('msg-from').textContent=m.from;
  document.getElementById('msg-time').textContent=m.time;
  document.getElementById('msg-body').textContent=m.body;
  document.getElementById('esc-btn').style.display=m.complaint?'flex':'none';
  document.getElementById('bo-reply').value='';
  document.getElementById('reply-toast').style.display='none';
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
  // Patch openMsg to cover base messages too
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