/* ============================================================
   app.js — Durkan Regen v5
   Two separate logins: resident (access code) + RLO (passcode)
   Defect reporting · slot locking · Excel upload · feedback
   ============================================================ */

const pendingSlots={};
const starRatings={};
let defectIdCounter=1;
let selectedPhoto=null;

/* ============================================================
   LANDING — choose role
============================================================ */
function startAs(role){
  document.getElementById('landing').style.display='none';
  if(role==='res'){
    document.getElementById('res-shell').classList.add('active');
    buildResNav(0);
  } else {
    document.getElementById('rlo-shell').classList.add('active');
    buildRloNav(0);
  }
}

function logout(role){
  if(role==='res'){
    db.currentResident=null;
    document.getElementById('res-chip').style.display='none';
    document.getElementById('res-shell').classList.remove('active');
    resShowPage('rp-login');
    buildResNav(0);
  } else {
    db.currentRLO=null;
    document.getElementById('rlo-chip').style.display='none';
    document.getElementById('rlo-shell').classList.remove('active');
    rloShowPage('bp-login');
    buildRloNav(0);
  }
  document.getElementById('landing').style.display='flex';
}

/* ============================================================
   RESIDENT NAV
============================================================ */
const resPages=['rp-login','rp-home','rp-appts','rp-defects','rp-message','rp-faq','rp-feedback'];
const resNavDef=[
  {i:1,icon:'ti-home',          label:'Home'},
  {i:2,icon:'ti-calendar',      label:'My Appointments'},
  {i:3,icon:'ti-alert-triangle',label:'Report Defect'},
  {i:4,icon:'ti-mail',          label:'Message Durkan'},
  {i:5,icon:'ti-help',          label:'FAQ & Guides'},
  {i:6,icon:'ti-star',          label:'Rate Work'},
];
let curResPage=0;

function buildResNav(cur){
  document.getElementById('res-nav').innerHTML=resNavDef.map(n=>
    `<button class="si${n.i===cur?' on':''}" onclick="rNav(${n.i})"><i class="ti ${n.icon}"></i>${n.label}</button>`
  ).join('');
  const s=document.getElementById('res-story');
  if(s) s.textContent=db.currentResident
    ?`Logged in as ${db.currentResident.resident} · ${db.currentResident.flat}. Your code locks you to your flat only.`
    :'Enter your access code from your welcome letter to get started.';
}

function resShowPage(id){
  document.querySelectorAll('#res-shell .page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById(id);
  if(el) el.classList.add('active');
}

function rNav(i){
  if(i>0&&!db.currentResident){resShowPage('rp-login');buildResNav(0);return;}
  curResPage=i;
  resShowPage(resPages[i]);
  buildResNav(i);
  if(i===2) renderResAppts();
  if(i===3) renderResDefects();
  if(i===6) renderFeedbackScreen();
}

/* ============================================================
   RLO NAV
============================================================ */
const rloPages=['bp-login','bp-dashboard','bp-upload','bp-defects','bp-messages','bp-reports'];
const rloNavDef=[
  {i:1,icon:'ti-layout-dashboard',label:'Dashboard'},
  {i:2,icon:'ti-upload',          label:'Upload Schedule'},
  {i:3,icon:'ti-alert-triangle',  label:'Defects'},
  {i:4,icon:'ti-mail',            label:'Messages'},
  {i:5,icon:'ti-chart-bar',       label:'Reports'},
];
let curRloPage=0;

function buildRloNav(cur){
  document.getElementById('rlo-nav').innerHTML=rloNavDef.map(n=>
    `<button class="si${n.i===cur?' on':''}" onclick="bNav(${n.i})"><i class="ti ${n.icon}"></i>${n.label}</button>`
  ).join('');
}

function rloShowPage(id){
  document.querySelectorAll('#rlo-shell .page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById(id);
  if(el) el.classList.add('active');
}

function bNav(i){
  if(i>0&&!db.currentRLO){rloShowPage('bp-login');buildRloNav(0);return;}
  curRloPage=i;
  rloShowPage(rloPages[i]);
  buildRloNav(i);
  if(i===1) renderDashboard();
  if(i===3) renderRloDefects();
  if(i===5) renderReports();
}

/* ============================================================
   LOGIN
============================================================ */
function resLogin(){
  const raw=document.getElementById('res-code').value.trim().toUpperCase();
  const err=document.getElementById('res-err');
  const inp=document.getElementById('res-code');
  const demo=DEMO_CODES[raw];
  const sched=db.schedule.find(e=>e.accessCode===raw);
  const match=demo||sched;
  if(match){
    const flat=match.flat; const resident=match.resident;
    db.currentResident={flat,resident,accessCode:raw};
    document.getElementById('r-hello').textContent='Hello, '+resident.split(' ')[0];
    document.getElementById('r-addr').textContent=flat+' · Highbury Gardens';
    document.getElementById('r-appts-hdr').textContent=flat+' · Highbury Gardens';
    const chip=document.getElementById('res-chip');
    chip.textContent='🔒 '+flat; chip.style.display='inline-block';
    renderResidentHome();
    rNav(1);
  } else {
    inp.classList.add('error'); err.style.display='block';
    setTimeout(()=>{inp.classList.remove('error');err.style.display='none';},3000);
  }
}

function rloLogin(){
  const raw=document.getElementById('rlo-code').value.trim().toUpperCase();
  const err=document.getElementById('rlo-err');
  const match=RLO_CODES[raw];
  if(match){
    db.currentRLO=match;
    const chip=document.getElementById('rlo-chip');
    chip.textContent='👤 '+match.name+' · '+match.role; chip.style.display='inline-block';
    bNav(1);
  } else {
    err.style.display='block';
    setTimeout(()=>err.style.display='none',3000);
  }
}

/* ============================================================
   UTILITY
============================================================ */
function genCode(flat){
  const n=flat.replace(/\D/g,'').padStart(2,'0');
  return `DRK-F${n}-${Math.floor(1000+Math.random()*9000)}`;
}
function showToast(id,msg,cls='t-j',dur=3500){
  const el=document.getElementById(id);if(!el)return;
  el.className=`toast ${cls}`;el.textContent=msg;el.style.display='block';
  setTimeout(()=>el.style.display='none',dur);
}
function phToast(id,msg,type=''){
  const t=document.getElementById(id);if(!t)return;
  t.className='ph-toast'+(type?' '+type:'');t.textContent=msg;t.style.display='block';
  setTimeout(()=>t.style.display='none',3500);
}
function toggleFaq(el){
  const a=el.querySelector('.faq-a');
  if(a) a.style.display=a.style.display==='block'?'none':'block';
}

/* ============================================================
   EXCEL UPLOAD
============================================================ */
function handleFile(evt){
  const file=evt.target.files[0];if(!file)return;
  const prog=document.getElementById('upload-prog');
  const fill=document.getElementById('prog-fill');
  const lbl=document.getElementById('prog-lbl');
  prog.style.display='block';fill.style.width='0%';
  lbl.textContent=`Reading ${file.name}...`;
  let pct=0;
  const iv=setInterval(()=>{pct=Math.min(pct+15,90);fill.style.width=pct+'%';},100);
  const reader=new FileReader();
  reader.onload=function(e){
    clearInterval(iv);fill.style.width='100%';
    setTimeout(()=>{
      prog.style.display='none';fill.style.width='0%';
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
        parseRows(rows,file.name);
      }catch(err){showToast('parse-toast','Could not read file. Check column format.','t-r');}
    },300);
  };
  reader.readAsArrayBuffer(file);
}

function getCol(row,...keys){
  for(const k of keys){
    const f=Object.keys(row).find(rk=>rk.toLowerCase().replace(/[\s_-]/g,'')===k.toLowerCase().replace(/[\s_-]/g,''));
    if(f&&row[f])return String(row[f]).trim();
  }
  return '';
}

function parseRows(rows,filename){
  const parsed=rows.map(r=>({
    flat:getCol(r,'Flat','FlatNo','Unit'),
    resident:getCol(r,'Resident','ResidentName','Name','Tenant'),
    workType:getCol(r,'WorkType','Work Type','Work','Type','Job'),
    slots:[
      getCol(r,'Date1','Date 1','Option1','Slot1'),
      getCol(r,'Date2','Date 2','Option2','Slot2'),
      getCol(r,'Date3','Date 3','Option3','Slot3'),
    ].filter(Boolean),
    status:'pending',confirmedDate:'',locked:false,accessCode:'',
  })).filter(r=>r.flat);
  if(!parsed.length){showToast('parse-toast','No valid rows found. Check column headers.','t-r');return;}
  parsed.forEach(e=>e.accessCode=genCode(e.flat));
  db.schedule=parsed;
  renderEntryTable();
  showToast('parse-toast',`✓ ${filename} — ${parsed.length} entries loaded. Review then publish.`,'t-g',5000);
}

function loadDemo(){
  db.schedule=DEMO_SCHEDULE.map(e=>({...e,accessCode:e.accessCode||genCode(e.flat)}));
  renderEntryTable();
  showToast('parse-toast','✓ Demo schedule loaded — 5 entries with access codes.','t-g');
}

function renderEntryTable(){
  const tbody=document.getElementById('entry-tbody');if(!tbody)return;
  tbody.innerHTML=db.schedule.map((e,i)=>`
    <tr>
      <td><input style="width:70px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.flat}" onchange="db.schedule[${i}].flat=this.value"/></td>
      <td><input style="width:100px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.resident}" onchange="db.schedule[${i}].resident=this.value"/></td>
      <td><input style="width:110px;border:1px solid var(--dg);border-radius:5px;padding:3px 6px;font-size:11px" value="${e.workType}" onchange="db.schedule[${i}].workType=this.value"/></td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td style="font-size:10px;color:var(--dgd);line-height:1.6">${e.slots.join('<br>')||'<span style="color:var(--dg)">—</span>'}</td>
      <td><button class="btn btn-r btn-sm" onclick="db.schedule.splice(${i},1);renderEntryTable()"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
}

function addEntry(){
  db.schedule.push({flat:'Flat',resident:'',workType:'',accessCode:genCode('Flat'),slots:[],status:'pending',confirmedDate:'',locked:false});
  renderEntryTable();
}

function publishSchedule(){
  if(!db.schedule.length){showToast('publish-toast','Add at least one entry first.','t-r');return;}
  db.published=true;
  showToast('publish-toast','✓ Published — residents can now log in and select dates.','t-g',5000);
  renderDashboard();
  if(db.currentResident) renderResidentHome();
}

/* ============================================================
   DASHBOARD
============================================================ */
function renderDashboard(){
  const total=db.schedule.length;
  const conf=db.schedule.filter(e=>e.status==='confirmed').length;
  const awt=db.published?db.schedule.filter(e=>e.status==='pending'||e.status==='none-requested').length:0;
  const openDef=db.defects.filter(d=>d.status!=='closed').length;
  const fbN=db.feedback.length;
  const avg=fbN?(db.feedback.reduce((s,f)=>s+f.rating,0)/fbN).toFixed(1):'—';
  document.getElementById('m-total').textContent=total;
  document.getElementById('m-conf').textContent=conf;
  document.getElementById('m-await').textContent=awt;
  document.getElementById('m-def').textContent=openDef;
  document.getElementById('m-avg').textContent=fbN?avg+'★':'—';
  const empty=document.getElementById('bo-empty');
  const wrap=document.getElementById('bo-dash-wrap');
  if(!db.published||!total){empty.style.display='block';wrap.style.display='none';return;}
  empty.style.display='none';wrap.style.display='block';
  document.getElementById('dash-ts').textContent='Updated just now';
  const sPill={
    pending:`<span class="spill sp-a">Awaiting</span>`,
    confirmed:`<span class="spill sp-g">Confirmed 🔒</span>`,
    'none-requested':`<span class="spill sp-r">New slots needed</span>`,
  };
  document.getElementById('dash-tbody').innerHTML=db.schedule.map((e,i)=>`
    <tr>
      <td><strong>${e.flat}</strong></td>
      <td>${e.resident}</td>
      <td>${e.workType}</td>
      <td><span class="code-chip">${e.accessCode}</span></td>
      <td>${sPill[e.status]||''}</td>
      <td>${e.confirmedDate?`<strong style="color:var(--dj)">${e.confirmedDate}</strong>`:`<span style="color:var(--dg)">—</span>`}</td>
      <td>${e.locked
        ?`<button class="btn btn-o btn-sm" onclick="unlockSlot(${i})">🔓 Unlock</button>`
        :e.status==='pending'
          ?`<button class="btn btn-o btn-sm" onclick="alert('SMS sent to ${e.resident}')">Remind</button>`
          :e.status==='none-requested'
            ?`<button class="btn btn-sm" style="background:var(--amberbg);color:var(--amber);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="sendNewSlots(${i})">New slots</button>`
            :`<span style="color:var(--dj);font-size:11px;font-weight:600">✓ Done</span>`
      }</td>
    </tr>`).join('');
  const defPanel=document.getElementById('def-dash-panel');
  if(!openDef){defPanel.style.display='none';return;}
  defPanel.style.display='block';
  document.getElementById('def-count-pill').textContent=openDef;
  document.getElementById('def-dash-list').innerHTML=db.defects.filter(d=>d.status!=='closed').map(d=>`
    <div class="defect-card ${d.status}" style="margin-bottom:8px">
      <div class="def-row"><span class="def-title">${d.location} — ${d.desc.slice(0,40)}${d.desc.length>40?'...':''}</span><span class="spill ${d.status==='open'?'sp-r':'sp-a'}">${d.status==='in-progress'?'In progress':d.status}</span></div>
      <div class="def-meta">${d.flat} · ${d.date} · Priority: ${d.priority.split(' ')[0]}</div>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
        <button class="btn btn-o btn-sm" onclick="updateDefectStatus('${d.id}','in-progress')">In progress</button>
        <button class="btn btn-sm" style="background:var(--greenbg);color:var(--green);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="updateDefectStatus('${d.id}','closed')">Mark closed</button>
      </div>
    </div>`).join('');
}

function unlockSlot(i){
  db.schedule[i].locked=false;db.schedule[i].status='pending';db.schedule[i].confirmedDate='';
  renderDashboard();
  if(db.currentResident?.flat===db.schedule[i].flat) renderResAppts();
  alert(`${db.schedule[i].flat} unlocked. The resident can now select a new date.`);
}

function sendNewSlots(i){
  db.schedule[i].status='pending';
  db.schedule[i].slots=['Mon 23 Jun · 9:00–12:00','Tue 24 Jun · 9:00–12:00','Wed 25 Jun · 9:00–12:00'];
  renderDashboard();
  if(db.currentResident?.flat===db.schedule[i].flat) renderResAppts();
}

/* ============================================================
   DEFECTS — RESIDENT
============================================================ */
function photoSelected(inp){
  if(inp.files[0]){selectedPhoto=inp.files[0];document.getElementById('photo-lbl').textContent='📷 '+inp.files[0].name+' attached';}
}

function renderResDefects(){
  const list=document.getElementById('r-def-list');if(!list)return;
  const myDefs=db.defects.filter(d=>d.flat===db.currentResident?.flat);
  list.innerHTML=`
    <button class="vbtn" onclick="document.getElementById('r-def-list').style.display='none';document.getElementById('r-def-form').style.display='block'" style="margin-bottom:10px">+ Report new defect</button>
    ${myDefs.length?myDefs.map(d=>`
      <div class="vc" style="padding:10px;margin-bottom:8px;border-left:3px solid ${d.status==='closed'?'var(--green)':d.status==='in-progress'?'var(--amber)':'var(--red)'}">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <div style="font-size:12px;font-weight:700;color:var(--db)">${d.location} issue</div>
          <span class="spill ${d.status==='open'?'sp-r':d.status==='in-progress'?'sp-a':'sp-g'}" style="font-size:10px">${d.status==='in-progress'?'In progress':d.status}</span>
        </div>
        <div style="font-size:10px;color:var(--dgd);margin-bottom:3px">${d.desc.slice(0,60)}${d.desc.length>60?'...':''}</div>
        <div style="font-size:10px;color:var(--dgd)">Reported ${d.date} · ${d.priority.split(' ')[0]}</div>
        ${d.updates.length?`<div class="def-updates">Latest: ${d.updates[d.updates.length-1]}</div>`:''}
        ${d.status==='closed'&&!d.rating?`<div style="margin-top:6px"><div style="font-size:10px;color:var(--dgd);margin-bottom:3px">Rate this repair:</div><div style="display:flex;gap:3px">${[1,2,3,4,5].map(s=>`<button onclick="rateDefect('${d.id}',${s})" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--dg)">★</button>`).join('')}</div></div>`:''}
        ${d.rating?`<div style="margin-top:4px;color:var(--star);font-size:14px">${'★'.repeat(d.rating)}${'☆'.repeat(5-d.rating)}</div>`:''}
      </div>`).join('')
    :'<div class="empty-msg">No defects reported yet</div>'}`;
  document.getElementById('r-def-form').style.display='none';
  const open=myDefs.filter(d=>d.status!=='closed').length;
  const badge=document.getElementById('r-def-n');
  if(badge){badge.textContent=open;badge.style.display=open>0?'inline-block':'none';}
  const sub=document.getElementById('r-def-sub');
  if(sub) sub.textContent=myDefs.length?`${open} open · ${myDefs.length} total`:'Report an issue in your home';
}

function rateDefect(defId,stars){
  const d=db.defects.find(x=>x.id===defId);if(d)d.rating=stars;
  renderResDefects();renderRloDefects();renderDashboard();
}

function submitDefect(){
  const desc=document.getElementById('r-def-desc').value.trim();
  if(!desc){phToast('def-toast','Please describe the issue first.','err');return;}
  db.defects.push({
    id:'DEF-'+String(defectIdCounter++).padStart(3,'0'),
    flat:db.currentResident.flat,
    resident:db.currentResident.resident,
    desc,
    location:document.getElementById('r-def-location').value,
    priority:document.getElementById('r-def-priority').value,
    status:'open',
    date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'}),
    updates:[],
    photo:selectedPhoto?selectedPhoto.name:null,
    rating:null,
  });
  selectedPhoto=null;
  document.getElementById('r-def-desc').value='';
  document.getElementById('photo-lbl').textContent='Tap to attach a photo';
  phToast('def-toast','Defect reported. Your RLO has been notified.');
  setTimeout(()=>{
    document.getElementById('r-def-form').style.display='none';
    document.getElementById('r-def-list').style.display='block';
    renderResDefects();renderDashboard();renderRloDefects();
  },2000);
}

/* ============================================================
   DEFECTS — RLO
============================================================ */
function renderRloDefects(){
  document.getElementById('d-open').textContent=db.defects.filter(d=>d.status==='open').length;
  document.getElementById('d-prog').textContent=db.defects.filter(d=>d.status==='in-progress').length;
  document.getElementById('d-closed').textContent=db.defects.filter(d=>d.status==='closed').length;
  const list=document.getElementById('bo-def-list');if(!list)return;
  if(!db.defects.length){list.innerHTML='<div class="panel" style="text-align:center;padding:28px;color:var(--dgd)"><i class="ti ti-circle-check" style="font-size:28px;display:block;margin:0 auto 8px;color:var(--dg)"></i>No defects reported yet</div>';return;}
  list.innerHTML=db.defects.map(d=>`
    <div class="defect-card ${d.status}" style="margin-bottom:10px">
      <div class="def-row">
        <div><div class="def-title">${d.id} — ${d.location} (${d.flat})</div>
        <div class="def-meta">Resident: ${d.resident} · ${d.date} · Priority: <strong>${d.priority.split(' ')[0]}</strong></div></div>
        <span class="spill ${d.status==='open'?'sp-r':d.status==='in-progress'?'sp-a':'sp-g'}">${d.status==='in-progress'?'In progress':d.status.charAt(0).toUpperCase()+d.status.slice(1)}</span>
      </div>
      <div style="font-size:12px;color:var(--db);margin-bottom:7px">${d.desc}</div>
      ${d.photo?`<div style="font-size:11px;color:var(--dj);margin-bottom:5px">📷 ${d.photo}</div>`:''}
      ${d.updates.length?`<div class="def-updates">${d.updates.map(u=>'• '+u).join('<br>')}</div>`:''}
      ${d.rating?`<div style="margin-top:5px;font-size:12px;color:var(--dgd)">Resident rated: <span style="color:var(--star)">${'★'.repeat(d.rating)}${'☆'.repeat(5-d.rating)}</span></div>`:''}
      <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
        ${d.status!=='in-progress'&&d.status!=='closed'?`<button class="btn btn-sm" style="background:var(--amberbg);color:var(--amber);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="updateDefectStatus('${d.id}','in-progress')"><i class="ti ti-tool"></i> In progress</button>`:''}
        ${d.status!=='closed'?`<button class="btn btn-sm" style="background:var(--greenbg);color:var(--green);border:none;border-radius:7px;font-weight:600;cursor:pointer" onclick="updateDefectStatus('${d.id}','closed')"><i class="ti ti-circle-check"></i> Mark closed</button>`:''}
        <button class="btn btn-o btn-sm" onclick="addDefectUpdate('${d.id}')"><i class="ti ti-message"></i> Add update</button>
      </div>
    </div>`).join('');
}

function updateDefectStatus(defId,status){
  const d=db.defects.find(x=>x.id===defId);if(!d)return;
  d.status=status;
  d.updates.push(`${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} — Status: ${status==='in-progress'?'in progress':status}`);
  renderRloDefects();renderDashboard();renderReports();
  if(db.currentResident?.flat===d.flat) renderResDefects();
}

function addDefectUpdate(defId){
  const note=prompt('Add an update (visible to resident):');if(!note)return;
  const d=db.defects.find(x=>x.id===defId);if(!d)return;
  d.updates.push(`${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} — ${note}`);
  renderRloDefects();
  if(db.currentResident?.flat===d.flat) renderResDefects();
}

/* ============================================================
   RESIDENT HOME
============================================================ */
function renderResidentHome(){
  if(!db.currentResident)return;
  const my=db.schedule.filter(e=>e.flat===db.currentResident.flat);
  const first=my[0];
  const badge=document.getElementById('r-home-badge');
  if(!db.published||!first){
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
  if(first.confirmedDate){
    if(badge){badge.textContent='🔒 Confirmed';badge.style.background='var(--greenbg)';badge.style.color='var(--green)';}
    document.getElementById('r-home-date').textContent=first.confirmedDate;
    document.getElementById('r-home-type').textContent=first.workType;
    document.getElementById('r-home-det').textContent='Date locked. Contact your RLO to make changes.';
  } else {
    if(badge){badge.textContent='Choose date';badge.style.background='var(--amberbg)';badge.style.color='var(--amber)';}
    document.getElementById('r-home-date').textContent='Date not yet selected';
    document.getElementById('r-home-type').textContent=first.workType;
    document.getElementById('r-home-det').textContent=`${first.slots.length} options available — please select one.`;
  }
  const hasDone=my.some(e=>e.status==='confirmed');
  const rated=db.feedback.some(f=>f.flat===db.currentResident.flat);
  const fbBadge=document.getElementById('r-fb-n');
  const fbSub=document.getElementById('r-fb-sub');
  if(fbBadge&&fbSub){
    if(hasDone&&!rated){fbBadge.style.display='inline-block';fbSub.textContent='Your rating is needed';}
    else if(rated){fbBadge.style.display='none';fbSub.textContent='Thank you for your feedback!';}
    else{fbBadge.style.display='none';fbSub.textContent='Share your feedback';}
  }
  if(curResPage===2) renderResAppts();
}

/* ============================================================
   APPOINTMENTS
============================================================ */
function renderResAppts(){
  const body=document.getElementById('r-appts-body');if(!body||!db.currentResident)return;
  if(!db.published){body.innerHTML='<div class="empty-msg">Waiting for schedule from your RLO...</div>';return;}
  const my=db.schedule.filter(e=>e.flat===db.currentResident.flat);
  if(!my.length){body.innerHTML=`<div class="empty-msg">No appointments for ${db.currentResident.flat} yet.</div>`;return;}
  body.innerHTML=my.map(e=>{
    const si=db.schedule.indexOf(e);
    if(e.locked&&e.confirmedDate)return`
      <div class="ph-sect">${e.workType}</div>
      <div class="lock-banner"><i class="ti ti-lock"></i> Date confirmed and locked</div>
      <div class="conf-screen">
        <div class="conf-icon" style="background:var(--greenbg);color:var(--green)"><i class="ti ti-circle-check"></i></div>
        <div class="conf-title">Date confirmed</div>
        <div class="conf-sub">${e.confirmedDate}</div>
        <div class="mc" style="width:100%"><div class="mi mi-j"><i class="ti ti-bell"></i></div><div style="flex:1"><div class="mi-t">SMS reminder set</div><div class="mi-s">24 hours before visit</div></div></div>
        <div class="mc" style="width:100%"><div class="mi mi-b"><i class="ti ti-user"></i></div><div style="flex:1"><div class="mi-t">RLO notified</div><div class="mi-s">Highbury Gardens</div></div></div>
        <div class="vc" style="width:100%;margin-top:7px;padding:9px"><div class="vc-d"><i class="ti ti-info-circle" style="color:var(--dj)"></i> To change this date, message your RLO.</div></div>
      </div>`;
    const slots=e.slots.map((s,idx)=>`
      <div class="slot" id="rslot-${si}-${idx}" onclick="resPick(${si},${idx},'${s.replace(/'/g,"\\'")}')">
        <div class="srad" id="rsrad-${si}-${idx}"></div>
        <div><div class="slot-t">${s}</div><div class="slot-d">Available</div></div>
      </div>`).join('');
    return`
      <div class="ph-sect">${e.workType}</div>
      <div class="vc" style="padding:9px;margin-bottom:7px"><div class="vc-d"><strong>Once confirmed this date is locked</strong> and cannot be changed without contacting your RLO.</div></div>
      ${slots}
      <div class="slot none" id="rslot-${si}-none" onclick="resPick(${si},'none','none')">
        <div class="srad" id="rsrad-${si}-none"></div>
        <div><div class="slot-t">None of the above</div><div class="slot-d">Request new options</div></div>
      </div>
      <button class="vbtn" id="rconf-${si}" style="display:none" onclick="resConfirm(${si})">Confirm — this cannot be undone</button>
      <div class="ph-toast" id="rtost-${si}"></div>`;
  }).join('');
}

function resPick(si,idx,label){
  const e=db.schedule[si];
  e.slots.forEach((_,i)=>{
    const s=document.getElementById(`rslot-${si}-${i}`);const r=document.getElementById(`rsrad-${si}-${i}`);
    if(s)s.classList.remove('sel');if(r)r.innerHTML='';
  });
  const ns=document.getElementById(`rslot-${si}-none`);const nr=document.getElementById(`rsrad-${si}-none`);
  if(ns)ns.classList.remove('sel');if(nr)nr.innerHTML='';
  const sel=document.getElementById(`rslot-${si}-${idx}`);const rad=document.getElementById(`rsrad-${si}-${idx}`);
  if(sel)sel.classList.add('sel');if(rad)rad.innerHTML='<i class="ti ti-check" style="font-size:9px;color:#fff"></i>';
  pendingSlots[si]={idx,label};
  const btn=document.getElementById(`rconf-${si}`);if(btn)btn.style.display='block';
}

function resConfirm(si){
  const p=pendingSlots[si];if(!p)return;
  const e=db.schedule[si];
  if(p.idx==='none'){e.status='none-requested';phToast(`rtost-${si}`,'New options requested. Your RLO will contact you within 48 hours.','err');}
  else{e.confirmedDate=p.label;e.status='confirmed';e.locked=true;}
  renderResidentHome();renderDashboard();renderReports();renderResAppts();
}

/* ============================================================
   FEEDBACK
============================================================ */
function renderFeedbackScreen(){
  const body=document.getElementById('r-fb-body');if(!body||!db.currentResident)return;
  const done=db.schedule.filter(e=>e.flat===db.currentResident.flat&&e.status==='confirmed');
  const rated=db.feedback.some(f=>f.flat===db.currentResident.flat);
  if(!done.length){body.innerHTML='<div class="empty-msg">No completed work to rate yet.<br>Confirm an appointment first.</div>';return;}
  if(rated){
    const f=db.feedback.find(fb=>fb.flat===db.currentResident.flat);
    body.innerHTML=`<div class="conf-screen">
      <div class="conf-icon" style="background:var(--amberbg);color:var(--star)"><i class="ti ti-star-filled"></i></div>
      <div class="conf-title">Thank you!</div><div class="conf-sub">Feedback submitted.</div>
      <div class="vc" style="width:100%;padding:10px;text-align:left">
        <div style="font-size:11px;color:var(--dgd);margin-bottom:3px">${f.workType} · ${f.date}</div>
        <div style="font-size:16px;color:var(--star)">${'★'.repeat(Math.round(f.rating))}${'☆'.repeat(5-Math.round(f.rating))}</div>
        ${f.comment?`<div style="font-size:11px;color:var(--dgd);margin-top:4px;font-style:italic">"${f.comment}"</div>`:''}
      </div></div>`;return;
  }
  const work=done[0];
  body.innerHTML=`
    <div class="vc" style="padding:10px;margin-bottom:9px"><div style="font-size:12px;font-weight:600;color:var(--db)">${work.workType}</div><div style="font-size:10px;color:var(--dgd)">${work.confirmedDate}</div></div>
    ${FB_QUESTIONS.map((q,qi)=>`<div class="q-row"><div class="q-label">${q}</div><div class="star-group">${[1,2,3,4,5].map(s=>`<button class="star-btn" id="sb-${qi}-${s}" onclick="rateStar(${qi},${s})">★</button>`).join('')}</div></div>`).join('')}
    <label class="flbl" style="margin-top:8px">Any comments?</label>
    <textarea class="field" id="fb-comment" placeholder="Optional..." rows="2"></textarea>
    <button class="vbtn" onclick="submitFeedback()">Submit feedback</button>
    <div class="ph-toast" id="fb-toast"></div>`;
}

function rateStar(qi,val){
  starRatings[qi]=val;
  for(let s=1;s<=5;s++){const b=document.getElementById(`sb-${qi}-${s}`);if(b)b.classList.toggle('lit',s<=val);}
}

function submitFeedback(){
  if(Object.keys(starRatings).length<FB_QUESTIONS.length){phToast('fb-toast','Please rate all questions.','err');return;}
  const avg=parseFloat((Object.values(starRatings).reduce((a,b)=>a+b,0)/FB_QUESTIONS.length).toFixed(1));
  const comment=document.getElementById('fb-comment')?.value.trim()||'';
  const work=db.schedule.find(e=>e.flat===db.currentResident.flat&&e.status==='confirmed');
  db.feedback.push({flat:db.currentResident.flat,workType:work?work.workType:'Work',rating:avg,comment,date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})});
  Object.keys(starRatings).forEach(k=>delete starRatings[k]);
  renderFeedbackScreen();renderResidentHome();renderDashboard();renderReports();
}

/* ============================================================
   MESSAGES
============================================================ */
function sendRMsg(type){
  const id=type==='rlo'?'r-msg':'r-cmp';
  const t=document.getElementById('r-msg-toast');if(!t)return;
  t.className='ph-toast';
  t.textContent=type==='rlo'?'Message sent. Your RLO will respond within 2 working days.':'Complaint submitted to your RLO and escalated to Sonia.';
  t.style.display='block';document.getElementById(id).value='';
  setTimeout(()=>t.style.display='none',3500);
}

function openMsg(i){
  const m=db.messages[i];
  document.getElementById('bo-inbox-list').style.display='none';
  document.getElementById('bo-inbox-detail').style.display='block';
  document.getElementById('msg-from').textContent=m.from;
  document.getElementById('msg-time').textContent=m.time;
  document.getElementById('msg-body').textContent=m.body;
  document.getElementById('esc-btn').style.display=m.complaint?'flex':'none';
  document.getElementById('bo-reply').value='';
  document.getElementById('reply-toast').style.display='none';
}

function closeMsg(){
  document.getElementById('bo-inbox-list').style.display='block';
  document.getElementById('bo-inbox-detail').style.display='none';
}

function sendReply(){
  if(!document.getElementById('bo-reply').value.trim())return;
  showToast('reply-toast','Reply sent and logged.','t-g');
  document.getElementById('bo-reply').value='';
}

function escalate(){
  showToast('reply-toast','Escalated to Sonia. She has been notified by email.','t-r');
}

/* ============================================================
   REPORTS
============================================================ */
function renderReports(){
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
    :'<div class="empty-msg">No defects reported yet</div>';
  document.getElementById('rep-fb-rows').innerHTML=fbN
    ?db.feedback.map(f=>`<div class="srow"><span>${f.flat} · ${f.workType}</span><span style="color:var(--star);font-weight:700">${f.rating}★</span></div>`).join('')
    :'<div class="empty-msg">No feedback yet</div>';
}
