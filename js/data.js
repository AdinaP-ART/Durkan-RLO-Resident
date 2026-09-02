/* ============================================================
   data.js — Durkan Regen v6
   Shared state, demo data, credentials
============================================================ */
const db = {
  currentResident: null,
  currentRLO: null,
  published: false,
  schedule: [],
  duringWorks: [],
  defects: [],
  feedback: [],
  messages: [],
  // RLO notification queue
  notifications: [],
  // Examples of finished work — RLO uploads photos, residents browse
  finishedWork: {
    images: ['icons/colour-swatch.png'],
    caveat: 'These photos show examples of completed kitchens and bathrooms from similar Durkan projects. Finishes and colours may vary — your final choices will be confirmed with you at your survey appointment.',
    uploadedDate: '',
  },
  // Updates — combined project updates + events
  updates: [],
};
const DEMO_CODES = {
  'DRK-F14-2847': { flat: 'Flat 14', resident: 'Sarah Ahmed' },
  'DRK-F09-5531': { flat: 'Flat 9',  resident: 'James Obi' },
  'DRK-F21-7762': { flat: 'Flat 21', resident: 'Aisha Patel' },
};
const RLO_CODES = {
  'RLO-2025':    { name: 'Adina Poncis',          role: 'RLO' },
  'SONIA-2025':  { name: 'Sonia Carmichael',      role: 'Senior RLO' },
  'DEE-2025':    { name: 'Dee Blake',             role: 'RLO' },
  'ALANNAH-2025':{ name: 'Alannah Kelly-Forbes',  role: 'RLO' },
};
const DEMO_SCHEDULE = [
  { urpn:'HOS014001', flat:'Flat 14', address:'14 Grove Road, London, N5 2AB', resident:'Sarah Ahmed',  workType:'Pre Works', accessCode:'DRK-F14-2847', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'], status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { urpn:'LXF003009', flat:'Flat 9',  address:'9 Elm Street, London, N5 2AC',  resident:'James Obi',    workType:'Pre Works', accessCode:'DRK-F09-5531', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'], status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { urpn:'LXF003021', flat:'Flat 21', address:'21 Elm Street, London, N5 2AC', resident:'Aisha Patel',  workType:'Pre Works', accessCode:'DRK-F21-7762', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'], status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { urpn:'HOS014003', flat:'Flat 3',  address:'3 Grove Road, London, N5 2AB',  resident:'Unconfirmed',  workType:'Pre Works', accessCode:'DRK-F03-4421', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'],             status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { urpn:'ASH007007', flat:'Flat 7',  address:'7 Ash Close, London, N5 2AD',   resident:'Maria Santos', workType:'Pre Works', accessCode:'DRK-F07-8813', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'],             status:'pending', confirmedDate:'', locked:false, contactLog:[] },
];
// Letter template (from Durkan's standard R00_001 template)
const LETTER_TEMPLATE = {
  ref:       'DL/',
  siteOffice:'Durkan Site Office',
  siteAddr:  'Highbury Gardens, London',
  rloName:   'Sarah Okafor',
  rloPhone:  '0800 123 4567',
  rloEmail:  'sarah.okafor@durkan.co.uk',
  siteManager:'[Site Manager Name]',
  smPhone:   '[Site Manager Number]',
  smEmail:   '[sitemanager]@durkan.co.uk',
  client:    'L&Q',
  workType:  'refurbishment and improvement',
  appUrl:    'https://durkan-rlo-resident.vercel.app',
};
const WORK_ELEMENT_TYPES = ['Kitchen', 'Bathroom', 'Wet Room', 'Asbestos Survey', 'Fire Door', 'Window & Door', 'Front Entrance Door', 'Other'];

const FB_QUESTIONS = [
  'Overall satisfaction','Professionalism of team',
  'Tidiness — area left clean?','Communication quality',
  'Would you recommend Durkan?',
];

/* ============================================================
   MANDATORY LETTERS — client-required standard letters
   Built from Durkan's own letter templates (Access Requests,
   Survey Confirmations, Start Date Confirmations, Window/Door
   and FED installation letters).
============================================================ */
const MANDATORY_LETTERS = {
  access: {
    label: 'Request to Access Letters (hard-to-reach residents)',
    hasStage: true,
    variants: {
      kitchen: {
        label: 'Kitchen Survey',
        subject: 'REQUEST TO CONTACT - KITCHEN SURVEY APPOINTMENT',
        duration: '30 - 45 minutes',
      },
      bathroom: {
        label: 'Bathroom Survey',
        subject: 'REQUEST TO CONTACT - BATHROOM SURVEY APPOINTMENT',
        duration: '20 minutes',
      },
    },
    contactName: 'Victoria', contactPhone: '02030 539 830',
    signOff: { name: 'For DURKAN', role: '', email: '', cc: true },
  },
  survey: {
    label: 'Design Survey Confirmation',
    hasStage: false,
    variants: {
      bathroom: { label:'Bathroom Survey Confirmation inc. Asb', title:'BATHROOM SURVEY CONFIRMATION LETTER', workType:'BATHROOM SURVEY', duration:'30 minutes', kitchenExtras:false },
      kitchen:  { label:'Kitchen Survey Confirmation inc. Asb', title:'KITCHEN SURVEY CONFIRMATION LETTER', workType:'KITCHEN SURVEY', duration:'30-40 minutes', kitchenExtras:true },
      kitbath:  { label:'Kit & Bathroom Survey Confirmation inc. Asb', title:'KITCHEN AND BATHROOM SURVEY CONFIRMATION LETTER', workType:'KITCHEN & BATHROOM SURVEY', duration:'30-40 minutes', kitchenExtras:true },
      wetroom:  { label:'Wetroom Survey Confirmation inc. Asb', title:'WETROOM SURVEY CONFIRMATION LETTER', workType:'WETROOM SURVEY', duration:'30 minutes', kitchenExtras:false },
    },
    contactName: 'Alannah', contactPhone: '07762 890735',
    contactName2: 'Victoria', contactPhone2: '07833 696672',
    signOff: { name: 'Kiera Mahoney', role: 'Administration Officer', email: 'kiera.Mahoney@durkan.co.uk', cc: false },
  },
  startdate: {
    label: 'Start Date of Works Confirmation',
    hasStage: false,
    variants: {
      kitbath:  { label:'Kitchen and Bathroom Renewal', title:'KITCHEN AND/OR BATHROOM RENEWAL', workType:'Kitchen and Bathroom', completion:'15-20 Working Days', kitchenExtras:true },
      bathonly: { label:'Bathroom Renewal Only', title:'BATHROOM RENEWAL', workType:'Wet Room / Bathroom', completion:'10-15 Working Days', kitchenExtras:false },
    },
    contactName: 'Victoria', contactPhone: '07833 696 672',
    contactName2: 'Alannah', contactPhone2: '07762 890 735',
    signOff: { name: 'Victoria Brinkley', role: 'Liaison Officer', email: 'Victoria.Brinkley@durkan.co.uk', cc: true },
  },
  windowdoor: {
    label: 'Window & Door Installation Confirmation',
    hasStage: false,
    variants: { standard: { label: 'Window & Door Installation Letter', title: 'WINDOWS & DOORS INSTALLATION' } },
    contactName: 'Justine', contactPhone: '07834 737 820',
    signOff: { name: 'Justine Guerrier', role: 'Liaison Officer', email: 'Justine.guerrier@durkan.co.uk', cc: false },
  },
  fed: {
    label: 'Front Entrance Door Installation Confirmation',
    hasStage: false,
    variants: { standard: { label: 'FED Install - Confirmation', title: 'FRONT ENTRANCE DOOR RENEWAL' } },
    contactName: 'Leanne', contactPhone: '07842 318 242',
    signOff: { name: 'Leanne Quatromini', role: 'Liaison Officer', email: 'Leanne.Quatromini@durkan.co.uk', cc: false },
  },
};
