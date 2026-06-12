/* ============================================================
   app.js — Durkan Regen v4
   Features: access code login · real Excel upload (SheetJS)
             slot locking · resident-scoped views · feedback
   ============================================================ */

/* ---- Runtime state ---- */
const pendingSlots = {}; // schedIdx → { idx, label }
const starRatings  = {}; // questionIndex → starValue

/* ---- Nav state ---- */
let mode   = 'res';
let curRes = 1;   // default to home after login
let curBo  = 0;

const resPages = ['rp-onboard', 'rp-home', 'rp-appts', 'rp-message', 'rp-faq', 'rp-feedback'];
const boPages  = ['bp-dashboard', 'bp-upload', 'bp-messages', 'bp-reports'];
const resNav   = ['Home', 'My Appointments', 'Message Durkan', 'FAQ & Guides', 'Rate Work'];
const boNav    = ['1. Dashboard', '2. Upload Schedule', '3. Messages', '4. Reports'];

/* ============================================================
   UTILITY
   ============================================================ */

function generateCode(flat) {
  const num  = flat.replace(/\D/g, '').padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DRK-F${num}-${rand}`;
}

function showToast(id, msg, cls = 't-j', dur = 3500) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `toast ${cls}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, dur);
}

function showPhoneToast(id, msg, isErr = false) {
  const t = document.getElementById(id);
  if (!t) return;
  t.className = isErr ? 'ph-toast err' : 'ph-toast';
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

/* ============================================================
   LOGIN / LOGOUT
   ============================================================ */

function tryLogin() {
  const raw = document.getElementById('access-code').value.trim().toUpperCase();
  const err = document.getElementById('ob-err');
  const inp = document.getElementById('access-code');

  // Check hardcoded demo codes
  if (DEMO_CODES[raw]) {
    loginSuccess(raw, DEMO_CODES[raw].flat, DEMO_CODES[raw].resident);
    return;
  }

  // Check any schedule-generated codes
  const match = db.schedule.find(e => e.accessCode === raw);
  if (match) {
    loginSuccess(raw, match.flat, match.resident);
    return;
  }

  // Invalid
  inp.classList.add('error');
  err.style.display = 'block';
  setTimeout(() => {
    inp.classList.remove('error');
    err.style.display = 'none';
  }, 3000);
}

function loginSuccess(code, flat, resident) {
  db.currentResident = { flat, resident, accessCode: code };

  // Update phone header
  document.getElementById('r-hello').textContent    = 'Hello, ' + resident.split(' ')[0];
  document.getElementById('r-address').textContent  = flat + ' · Highbury Gardens';
  document.getElementById('r-appts-title').textContent = flat + ' · Highbury Gardens';

  // Show logged-in chip in header
  const chip = document.getElementById('logged-in-chip');
  chip.textContent   = '🔒 ' + flat;
  chip.style.display = 'inline-block';

  renderResidentView();
  goRes(1); // go to home
}

function logout() {
  db.currentResident = null;
  document.getElementById('logged-in-chip').style.display = 'none';
  document.getElementById('access-code').value = '';
  showPage('rp-onboard');
  curRes = 1;
  buildNav();
}

function smsFallback() {
  alert('SMS fallback: A code will be sent to your registered mobile number. Please contact your RLO if you have not received one.');
}

/* ============================================================
   NAVIGATION
   ============================================================ */

function setMode(m) {
  mode = m;
  document.getElementById('btn-res').classList.toggle('on', m === 'res');
  document.getElementById('btn-bo').classList.toggle('on',  m === 'bo');

  if (m === 'res') {
    showPage(db.currentResident ? resPages[curRes] : 'rp-onboard');
  } else {
    showPage(boPages[curBo]);
    refreshBo(curBo);
  }
  buildNav();
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function buildNav() {
  const nav = mode === 'res' ? resNav : boNav;
  const cur = mode === 'res' ? curRes - 1 : curBo; // resNav offset: skip onboard

  document.getElementById('s-head').textContent = mode === 'res' ? 'RESIDENT' : 'BACK OFFICE';

  document.getElementById('s-nav').innerHTML = nav
    .map((l, i) => `<button class="si${i === cur ? ' on' : ''}" onclick="navClick(${i})">${l}</button>`)
    .join('');

  document.getElementById('s-story').innerHTML = mode === 'res'
    ? `<b style="font-size:10px;text-transform:uppercase">Resident view</b><br>${
        db.currentResident
          ? `Logged in as ${db.currentResident.resident} · ${db.currentResident.flat}.<br>Your code locks you to your flat only.`
          : 'Enter your access code from your welcome letter to get started.'
      }`
    : '<b style="font-size:10px;text-transform:uppercase">RLO back office</b><br>Upload schedule → access codes generated → residents log in to their flat only → dates lock on confirmation.';
}

function navClick(i) {
  if (mode === 'res') {
    const pageIdx = i + 1; // offset: resPages[0] = onboard
    if (!db.currentResident) { showPage('rp-onboard'); return; }
    curRes = pageIdx;
    showPage(resPages[pageIdx]);
    if (pageIdx === 2) renderResAppts();
    if (pageIdx === 5) renderFeedbackScreen();
  } else {
    curBo = i;
    showPage(boPages[i]);
    refreshBo(i);
  }
  buildNav();
}

function goRes(i) {
  if (i > 0 && !db.currentResident) { showPage('rp-onboard'); return; }
  curRes = i;
  showPage(resPages[i]);
  buildNav();
  if (i === 2) renderResAppts();
  if (i === 5) renderFeedbackScreen();
}

function goBo(i) {
  curBo = i;
  showPage(boPages[i]);
  buildNav();
  refreshBo(i);
}

function refreshBo(i) {
  if (i === 0) renderDashboard();
  if (i === 3) renderReports();
}

/* ============================================================
   EXCEL UPLOAD — real SheetJS parsing
   ============================================================ */

function handleFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  const prog = document.getElementById('upload-prog');
  const lbl  = document.getElementById('upload-prog-lbl');
  const fill = document.getElementById('prog-fill');

  prog.style.display = 'block';
  fill.style.width   = '0%';
  lbl.textContent    = `Reading ${file.name}...`;

  // Animate progress bar while reading
  let pct = 0;
  const iv = setInterval(() => { pct = Math.min(pct + 15, 90); fill.style.width = pct + '%'; }, 100);

  const reader = new FileReader();
  reader.onload = function (e) {
    clearInterval(iv);
    fill.style.width = '100%';
    setTimeout(() => {
      prog.style.display = 'none';
      fill.style.width   = '0%';
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        parseRows(rows, file.name);
      } catch (err) {
        showToast('parse-toast', 'Could not read file. Please check the column format.', 't-r');
      }
    }, 300);
  };
  reader.readAsArrayBuffer(file);
}

function parseRows(rows, filename) {
  // Flexible column matching — accepts common variations
  const get = (row, ...keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk =>
        rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, '')
      );
      if (found && row[found]) return String(row[found]).trim();
    }
    return '';
  };

  const parsed = rows
    .map(r => ({
      flat:     get(r, 'Flat', 'FlatNo', 'FlatNumber', 'Unit'),
      resident: get(r, 'Resident', 'ResidentName', 'Resident Name', 'Name', 'Tenant'),
      workType: get(r, 'WorkType', 'Work Type', 'Work', 'Type', 'Job', 'JobType'),
      slots: [
        get(r, 'Date1', 'Date 1', 'Option1', 'Option 1', 'Slot1', 'Slot 1'),
        get(r, 'Date2', 'Date 2', 'Option2', 'Option 2', 'Slot2', 'Slot 2'),
        get(r, 'Date3', 'Date 3', 'Option3', 'Option 3', 'Slot3', 'Slot 3'),
      ].filter(Boolean),
      status: 'pending', confirmedDate: '', locked: false,
      accessCode: '',
    }))
    .filter(r => r.flat);

  if (!parsed.length) {
    showToast('parse-toast', 'No valid rows found. Check your column headers match the template.', 't-r');
    return;
  }

  // Assign unique access codes
  parsed.forEach(e => { e.accessCode = generateCode(e.flat); });
  db.schedule = parsed;
  renderEntryTable();
  showToast('parse-toast', `✓ ${filename} — ${parsed.length} entries loaded with access codes. Review below then publish.`, 't-g', 6000);
}

function loadDemo() {
  // Deep copy and generate codes for any blanks
  db.schedule = DEMO_SCHEDULE.map(e => ({
    ...e,
    accessCode: e.accessCode || generateCode(e.flat),
  }));
  renderEntryTable();
  showToast('parse-toast', '✓ Demo schedule loaded — 5 entries with access codes.', 't-g');
}

function renderEntryTable() {
  const tbody = document.getElementById('entry-tbody');
  if (!tbody) return;
  tbody.innerHTML = db.schedule.map((e, i) => `
    <tr>
      <td><input style="width:75px;border:1px solid var(--dg);border-radius:6px;padding:4px 6px;font-size:11px" value="${e.flat}" onchange="db.schedule[${i}].flat=this.value"/></td>
      <td><input style="width:110px;border:1px solid var(--dg);border-radius:6px;padding:4px 6px;font-size:11px" value="${e.resident}" onchange="db.schedule[${i}].resident=this.value"/></td>
      <td><input style="width:120px;border:1px solid var(--dg);border-radius:6px;padding:4px 6px;font-size:11px" value="${e.workType}" onchange="db.schedule[${i}].workType=this.value"/></td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td style="font-size:11px;color:var(--dgd);max-width:180px;line-height:1.7">${e.slots.join('<br>') || '<span style="color:var(--dg)">No slots</span>'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="removeEntry(${i})"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
}

function addManualEntry() {
  db.schedule.push({
    flat: 'Flat', resident: '', workType: '',
    accessCode: generateCode('Flat'),
    slots: [], status: 'pending', confirmedDate: '', locked: false,
  });
  renderEntryTable();
}

function removeEntry(i) {
  db.schedule.splice(i, 1);
  renderEntryTable();
}

function publishSchedule() {
  if (!db.schedule.length) {
    showToast('publish-toast', 'Add at least one entry before publishing.', 't-r');
    return;
  }
  db.published = true;
  showToast('publish-toast', '✓ Schedule published. Residents can log in with their access codes and select dates.', 't-g', 6000);
  renderDashboard();
  if (db.currentResident) renderResidentView();
}

/* ============================================================
   BACK OFFICE — DASHBOARD
   ============================================================ */

function renderDashboard() {
  const total = db.schedule.length;
  const sent  = db.published ? total : 0;
  const conf  = db.schedule.filter(e => e.status === 'confirmed').length;
  const await_ = db.published
    ? db.schedule.filter(e => e.status === 'pending' || e.status === 'none-requested').length
    : 0;
  const fbN  = db.feedback.length;
  const avg  = fbN ? (db.feedback.reduce((s, f) => s + f.rating, 0) / fbN).toFixed(1) : '—';

  document.getElementById('m-total').textContent = total;
  document.getElementById('m-sent').textContent  = sent;
  document.getElementById('m-conf').textContent  = conf;
  document.getElementById('m-await').textContent = await_;
  document.getElementById('m-avg').textContent   = fbN ? avg + '★' : '—';

  const empty = document.getElementById('bo-empty');
  const wrap  = document.getElementById('bo-table-wrap');

  if (!db.published || !total) {
    empty.style.display = 'block';
    wrap.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display  = 'block';

  document.getElementById('dash-ts').textContent = 'Updated just now';

  const sPill = {
    pending:          `<span class="spill sp-a">Awaiting</span>`,
    confirmed:        `<span class="spill sp-g">Confirmed 🔒</span>`,
    'none-requested': `<span class="spill sp-r">New slots needed</span>`,
  };

  document.getElementById('dash-tbody').innerHTML = db.schedule.map((e, i) => `
    <tr>
      <td><strong>${e.flat}</strong></td>
      <td>${e.resident}</td>
      <td>${e.workType}</td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td style="font-size:11px;color:var(--dgd);line-height:1.7">${e.slots.join('<br>') || '—'}</td>
      <td>${sPill[e.status] || ''}</td>
      <td>${e.confirmedDate
        ? `<strong style="color:var(--dj)">${e.confirmedDate}</strong>`
        : `<span style="color:var(--dg)">—</span>`}
      </td>
      <td>${e.locked
        ? `<button class="btn btn-sm btn-o" onclick="unlockSlot(${i})">🔓 Unlock</button>`
        : e.status === 'pending'
          ? `<button class="btn btn-sm btn-o" onclick="boRemind(${i})">Remind</button>`
          : e.status === 'none-requested'
            ? `<button class="btn btn-sm" style="background:var(--amberbg);color:var(--amber);border:none;border-radius:9px;font-weight:600;cursor:pointer" onclick="sendNewSlots(${i})">New slots</button>`
            : `<span style="color:var(--dj);font-size:12px;font-weight:600">✓ Done</span>`
      }</td>
    </tr>`).join('');

  // Feedback panel
  const fbPanel = document.getElementById('bo-fb-panel');
  if (!fbN) { fbPanel.style.display = 'none'; return; }
  fbPanel.style.display = 'block';

  document.getElementById('bo-fb-pill').textContent = fbN + ' rating' + (fbN !== 1 ? 's' : '');
  document.getElementById('bo-avg-big').textContent = avg + '★';

  const dist = [5, 4, 3, 2, 1].map(s => ({
    s, n: db.feedback.filter(f => Math.round(f.rating) === s).length,
  }));
  document.getElementById('bo-bars').innerHTML = dist.map(d => `
    <div class="bar-row">
      <span style="width:16px;text-align:right;color:var(--dgd)">${d.s}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${fbN ? Math.round(d.n / fbN * 100) : 0}%"></div></div>
      <span style="width:16px;color:var(--dgd)">${d.n}</span>
    </div>`).join('');

  document.getElementById('bo-fb-cards').innerHTML = db.feedback.map(f => `
    <div style="background:var(--dw);border:1px solid var(--dg);border-radius:11px;padding:12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px">
        <strong style="font-size:13px;color:var(--db)">${f.flat}</strong>
        <span style="font-size:11px;color:var(--dgd)">${f.date}</span>
      </div>
      <div style="font-size:11px;color:var(--dgd);margin-bottom:4px">${f.workType}</div>
      <div style="color:var(--star);font-size:15px">
        ${'★'.repeat(Math.round(f.rating))}${'☆'.repeat(5 - Math.round(f.rating))}
      </div>
      ${f.comment ? `<div style="font-size:12px;color:var(--dgd);margin-top:4px;font-style:italic">"${f.comment}"</div>` : ''}
    </div>`).join('');
}

function unlockSlot(i) {
  const e = db.schedule[i];
  e.locked        = false;
  e.status        = 'pending';
  e.confirmedDate = '';
  renderDashboard();
  if (db.currentResident?.flat === e.flat) renderResAppts();
  alert(`${e.flat} has been unlocked. The resident can now select a new date.`);
}

function boRemind(i) {
  const e = db.schedule[i];
  alert(`SMS reminder sent to ${e.resident} (${e.flat}): "Please select your preferred date for ${e.workType}."`);
}

function sendNewSlots(i) {
  db.schedule[i].status = 'pending';
  db.schedule[i].slots  = [
    'Mon 23 Jun · 9:00–12:00',
    'Tue 24 Jun · 9:00–12:00',
    'Wed 25 Jun · 9:00–12:00',
  ];
  renderDashboard();
  if (db.currentResident?.flat === db.schedule[i].flat) renderResAppts();
}

/* ============================================================
   BACK OFFICE — REPORTS
   ============================================================ */

function renderReports() {
  const conf  = db.schedule.filter(e => e.status === 'confirmed').length;
  const await_ = db.schedule.filter(e => e.status === 'pending').length;
  const fbN   = db.feedback.length;
  const avg   = fbN ? (db.feedback.reduce((s, f) => s + f.rating, 0) / fbN).toFixed(1) : '—';

  document.getElementById('rep-conf').textContent  = conf;
  document.getElementById('rep-await').textContent = await_;
  document.getElementById('rep-fb').textContent    = fbN;
  document.getElementById('rep-avg').textContent   = fbN ? avg + '★' : '—';

  const pClass = { confirmed: 'sp-g', 'none-requested': 'sp-r', pending: 'sp-a' };
  const pLabel = { confirmed: 'Confirmed 🔒', 'none-requested': 'New slots needed', pending: 'Pending' };

  document.getElementById('rep-rows').innerHTML = db.schedule.length
    ? db.schedule.map(e => `
        <div class="srow">
          <span>${e.flat} — ${e.workType}</span>
          <span class="spill ${pClass[e.status] || 'sp-a'}">${pLabel[e.status] || 'Pending'}</span>
        </div>`).join('')
    : '<div class="empty-msg">Upload a schedule to see data</div>';

  document.getElementById('rep-fb-rows').innerHTML = fbN
    ? db.feedback.map(f => `
        <div class="srow">
          <span>${f.flat} · ${f.workType}</span>
          <span style="color:var(--star);font-weight:700">${f.rating}★</span>
        </div>`).join('')
    : '<div class="empty-msg">No feedback yet</div>';
}

/* ============================================================
   RESIDENT — HOME CARD
   ============================================================ */

function renderResidentView() {
  if (!db.currentResident) return;

  const myEntries = db.schedule.filter(e => e.flat === db.currentResident.flat);
  const first     = myEntries[0];

  const badge   = document.getElementById('r-home-badge');
  const dateEl  = document.getElementById('r-home-date');
  const typeEl  = document.getElementById('r-home-type');
  const detEl   = document.getElementById('r-home-detail');
  const apptBdg = document.getElementById('r-appt-badge');
  const apptSub = document.getElementById('r-appt-sub');

  if (!db.published || !first) {
    if (badge)   { badge.textContent = 'No schedule yet'; badge.style.background = ''; badge.style.color = ''; }
    if (dateEl)  dateEl.textContent  = 'Awaiting schedule';
    if (typeEl)  typeEl.textContent  = '—';
    if (detEl)   detEl.textContent   = 'Your RLO will upload the works schedule soon.';
    if (apptBdg) apptBdg.textContent = '0';
    if (apptSub) apptSub.textContent = 'No appointments yet';
    return;
  }

  const count = myEntries.length;
  if (apptBdg) apptBdg.textContent = count;
  if (apptSub) apptSub.textContent = `${count} appointment${count !== 1 ? 's' : ''} scheduled`;

  if (first.confirmedDate) {
    if (badge) { badge.textContent = '🔒 Confirmed'; badge.style.background = 'var(--greenbg)'; badge.style.color = 'var(--green)'; }
    if (dateEl) dateEl.textContent = first.confirmedDate;
    if (typeEl) typeEl.textContent = first.workType;
    if (detEl)  detEl.textContent  = 'Date locked. Contact your RLO to make changes.';
  } else {
    if (badge) { badge.textContent = 'Choose date'; badge.style.background = 'var(--amberbg)'; badge.style.color = 'var(--amber)'; }
    if (dateEl) dateEl.textContent = 'Date not yet selected';
    if (typeEl) typeEl.textContent = first.workType;
    if (detEl)  detEl.textContent  = `${first.slots.length} options available — please select one.`;
  }

  // Feedback prompt
  const hasDone     = myEntries.some(e => e.status === 'confirmed');
  const alreadyRated = db.feedback.some(f => f.flat === db.currentResident.flat);
  const fbBadge = document.getElementById('r-fb-badge');
  const fbSub   = document.getElementById('r-fb-sub');
  if (fbBadge && fbSub) {
    if (hasDone && !alreadyRated)  { fbBadge.style.display = 'inline-block'; fbSub.textContent = 'Your rating is needed'; }
    else if (alreadyRated)          { fbBadge.style.display = 'none'; fbSub.textContent = 'Thank you for your feedback!'; }
    else                            { fbBadge.style.display = 'none'; fbSub.textContent = 'Share your feedback'; }
  }

  if (curRes === 2) renderResAppts();
}

/* ============================================================
   RESIDENT — APPOINTMENTS (locked to flat)
   ============================================================ */

function renderResAppts() {
  const body = document.getElementById('r-appts-body');
  if (!body || !db.currentResident) return;

  if (!db.published) {
    body.innerHTML = '<div class="empty-msg">Waiting for schedule from your RLO...</div>';
    return;
  }

  // Enforced: only this resident's flat
  const myEntries = db.schedule.filter(e => e.flat === db.currentResident.flat);

  if (!myEntries.length) {
    body.innerHTML = `<div class="empty-msg">No appointments scheduled for ${db.currentResident.flat} yet.</div>`;
    return;
  }

  body.innerHTML = myEntries.map(e => {
    const si = db.schedule.indexOf(e);

    /* LOCKED — read-only confirmation */
    if (e.locked && e.confirmedDate) {
      return `
        <div class="ph-sect">${e.workType}</div>
        <div class="lock-banner"><i class="ti ti-lock"></i> Date confirmed and locked</div>
        <div class="conf-screen">
          <div class="conf-icon" style="background:var(--greenbg);color:var(--green)"><i class="ti ti-circle-check"></i></div>
          <div class="conf-title">Date confirmed</div>
          <div class="conf-sub">${e.confirmedDate}</div>
          <div class="mc" style="width:100%"><div class="mi mi-j"><i class="ti ti-bell"></i></div><div class="mi-body"><div class="mi-t">SMS reminder set</div><div class="mi-s">24 hours before visit</div></div></div>
          <div class="mc" style="width:100%"><div class="mi mi-b"><i class="ti ti-user"></i></div><div class="mi-body"><div class="mi-t">RLO notified</div><div class="mi-s">Sarah Okafor · Highbury Gardens</div></div></div>
          <div class="vc" style="width:100%;margin-top:8px;padding:10px;text-align:left">
            <div class="vc-d" style="display:flex;align-items:center;gap:6px"><i class="ti ti-info-circle" style="color:var(--dj)"></i>To change this date please message your RLO.</div>
          </div>
        </div>`;
    }

    /* PENDING — slot selection */
    const slotHTML = e.slots.map((s, idx) => `
      <div class="slot" id="rslot-${si}-${idx}" onclick="resPickSlot(${si},${idx},'${s.replace(/'/g, "\\'")}')">
        <div class="srad" id="rsrad-${si}-${idx}"></div>
        <div><div class="slot-t">${s}</div><div class="slot-d">Available slot</div></div>
      </div>`).join('');

    return `
      <div class="ph-sect">${e.workType}</div>
      <div class="vc" style="padding:10px;margin-bottom:8px">
        <div class="vc-d"><strong>Once confirmed this date cannot be changed</strong> without contacting your RLO.</div>
      </div>
      ${slotHTML}
      <div class="slot none" id="rslot-${si}-none" onclick="resPickSlot(${si},'none','none')">
        <div class="srad" id="rsrad-${si}-none"></div>
        <div><div class="slot-t">None of the above</div><div class="slot-d">Request new options from your RLO</div></div>
      </div>
      <button class="vbtn" id="rconfirm-${si}" style="display:none" onclick="resConfirmSlot(${si})">
        Confirm this date — this cannot be undone
      </button>
      <div class="ph-toast" id="rtoast-${si}"></div>`;
  }).join('');
}

function resPickSlot(si, idx, label) {
  const e = db.schedule[si];

  // Clear all selections for this entry
  e.slots.forEach((_, i) => {
    const slotEl = document.getElementById(`rslot-${si}-${i}`);
    const radEl  = document.getElementById(`rsrad-${si}-${i}`);
    if (slotEl) slotEl.classList.remove('sel');
    if (radEl)  radEl.innerHTML = '';
  });
  const noneSlot = document.getElementById(`rslot-${si}-none`);
  const noneRad  = document.getElementById(`rsrad-${si}-none`);
  if (noneSlot) noneSlot.classList.remove('sel');
  if (noneRad)  noneRad.innerHTML = '';

  // Select chosen
  const selSlot = document.getElementById(`rslot-${si}-${idx}`);
  const selRad  = document.getElementById(`rsrad-${si}-${idx}`);
  if (selSlot) selSlot.classList.add('sel');
  if (selRad)  selRad.innerHTML = '<i class="ti ti-check" style="font-size:10px;color:#fff"></i>';

  pendingSlots[si] = { idx, label };
  const btn = document.getElementById(`rconfirm-${si}`);
  if (btn) btn.style.display = 'block';
}

function resConfirmSlot(si) {
  const pending = pendingSlots[si];
  if (!pending) return;

  const e = db.schedule[si];

  if (pending.idx === 'none') {
    e.status = 'none-requested';
    showPhoneToast(`rtoast-${si}`, 'New options requested. Your RLO will contact you within 48 hours.', true);
  } else {
    e.confirmedDate = pending.label;
    e.status        = 'confirmed';
    e.locked        = true; // 🔒 LOCKED — only RLO can reopen
  }

  renderResidentView();
  renderDashboard();
  renderReports();
  renderResAppts();
}

/* ============================================================
   RESIDENT — FEEDBACK
   ============================================================ */

function renderFeedbackScreen() {
  const body = document.getElementById('r-fb-body');
  if (!body || !db.currentResident) return;

  const completed    = db.schedule.filter(e => e.flat === db.currentResident.flat && e.status === 'confirmed');
  const alreadyRated = db.feedback.some(f => f.flat === db.currentResident.flat);

  if (!completed.length) {
    body.innerHTML = '<div class="empty-msg">No completed work to rate yet.<br>Confirm an appointment first.</div>';
    return;
  }

  if (alreadyRated) {
    const f = db.feedback.find(fb => fb.flat === db.currentResident.flat);
    body.innerHTML = `
      <div class="conf-screen">
        <div class="conf-icon" style="background:var(--amberbg);color:var(--star)"><i class="ti ti-star-filled"></i></div>
        <div class="conf-title">Thank you!</div>
        <div class="conf-sub">Your feedback has been submitted.</div>
        <div class="vc" style="width:100%;padding:11px;text-align:left">
          <div style="font-size:12px;color:var(--dgd);margin-bottom:4px">${f.workType} · ${f.date}</div>
          <div style="font-size:18px;color:var(--star);margin-bottom:4px">${'★'.repeat(Math.round(f.rating))}${'☆'.repeat(5 - Math.round(f.rating))}</div>
          ${f.comment ? `<div style="font-size:12px;color:var(--dgd);font-style:italic">"${f.comment}"</div>` : ''}
        </div>
      </div>`;
    return;
  }

  const work = completed[0];
  body.innerHTML = `
    <div class="vc" style="padding:11px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--db)">${work.workType}</div>
      <div style="font-size:11px;color:var(--dgd)">${work.confirmedDate} · ${db.currentResident.flat}</div>
    </div>
    ${FB_QUESTIONS.map((q, qi) => `
      <div class="q-row">
        <div class="q-label">${q}</div>
        <div class="star-group" id="sg-${qi}">
          ${[1, 2, 3, 4, 5].map(s =>
            `<button class="star-btn" id="sb-${qi}-${s}" onclick="rateStar(${qi},${s})" aria-label="${s} stars">★</button>`
          ).join('')}
        </div>
      </div>`).join('')}
    <div class="ph-sect" style="margin-top:10px">Any additional comments?</div>
    <textarea class="field" id="fb-comment" placeholder="Optional — share anything else..." rows="3"></textarea>
    <button class="vbtn" onclick="submitFeedback()">Submit feedback</button>
    <div class="ph-toast" id="fb-toast"></div>`;
}

function rateStar(qi, val) {
  starRatings[qi] = val;
  for (let s = 1; s <= 5; s++) {
    const btn = document.getElementById(`sb-${qi}-${s}`);
    if (btn) btn.classList.toggle('lit', s <= val);
  }
}

function submitFeedback() {
  if (Object.keys(starRatings).length < FB_QUESTIONS.length) {
    showPhoneToast('fb-toast', 'Please rate all questions before submitting.', true);
    return;
  }

  const vals = Object.values(starRatings);
  const avg  = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  const comment = document.getElementById('fb-comment')?.value.trim() || '';
  const work = db.schedule.find(e => e.flat === db.currentResident.flat && e.status === 'confirmed');

  db.feedback.push({
    flat:     db.currentResident.flat,
    workType: work ? work.workType : 'Work',
    rating:   avg,
    comment,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  });

  // Clear ratings for next time
  Object.keys(starRatings).forEach(k => delete starRatings[k]);

  renderFeedbackScreen();
  renderResidentView();
  renderDashboard();
  renderReports();
}

/* ============================================================
   RESIDENT — MESSAGES
   ============================================================ */

function sendRMsg(type) {
  const fieldId = type === 'rlo' ? 'r-msg' : 'r-cmp';
  const toast   = document.getElementById('r-msg-toast');
  if (!toast) return;

  toast.className   = 'ph-toast';
  toast.textContent = type === 'rlo'
    ? 'Message sent. Your RLO will respond within 2 working days.'
    : 'Complaint submitted to your RLO and escalated to Sonia.';
  toast.style.display = 'block';
  document.getElementById(fieldId).value = '';
  setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

/* ============================================================
   BACK OFFICE — INBOX
   ============================================================ */

function openMsg(i) {
  const m = db.messages[i];
  document.getElementById('bo-inbox-list').style.display   = 'none';
  document.getElementById('bo-inbox-detail').style.display = 'block';
  document.getElementById('msg-from').textContent  = m.from;
  document.getElementById('msg-time').textContent  = m.time;
  document.getElementById('msg-body').textContent  = m.body;
  document.getElementById('esc-btn').style.display = m.complaint ? 'flex' : 'none';
  document.getElementById('bo-reply').value        = '';
  document.getElementById('reply-toast').style.display = 'none';
}

function closeMsg() {
  document.getElementById('bo-inbox-list').style.display   = 'block';
  document.getElementById('bo-inbox-detail').style.display = 'none';
}

function sendReply() {
  if (!document.getElementById('bo-reply').value.trim()) return;
  showToast('reply-toast', 'Reply sent and logged against this conversation.', 't-g');
  document.getElementById('bo-reply').value = '';
}

function escalate() {
  showToast('reply-toast', 'Complaint escalated to Sonia. She has been notified by email.', 't-r');
}

/* ============================================================
   FAQ
   ============================================================ */

function toggleFaq(el) {
  const answer = el.querySelector('.faq-a');
  if (answer) answer.style.display = answer.style.display === 'block' ? 'none' : 'block';
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  buildNav();
  setMode('res');
}

document.addEventListener('DOMContentLoaded', init);
