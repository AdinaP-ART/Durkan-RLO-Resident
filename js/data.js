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
};

const DEMO_CODES = {
  'DRK-F14-2847': { flat: 'Flat 14', resident: 'Sarah Ahmed' },
  'DRK-F09-5531': { flat: 'Flat 9',  resident: 'James Obi' },
  'DRK-F21-7762': { flat: 'Flat 21', resident: 'Aisha Patel' },
};

const RLO_CODES = {
  'RLO-2025':   { name: 'Sarah Okafor',   role: 'RLO' },
  'SONIA-2025': { name: 'Sonia Williams', role: 'Senior RLO' },
};

const DEMO_SCHEDULE = [
  { flat:'Flat 14', resident:'Sarah Ahmed',  workType:'Pre Works', accessCode:'DRK-F14-2847', slots:['Tue 17 Jun','Wed 18 Jun','Thu 19 Jun'], status:'pending', confirmedDate:'', locked:false },
  { flat:'Flat 9',  resident:'James Obi',    workType:'Pre Works', accessCode:'DRK-F09-5531', slots:['Mon 16 Jun','Tue 17 Jun','Wed 18 Jun'], status:'pending', confirmedDate:'', locked:false },
  { flat:'Flat 21', resident:'Aisha Patel',  workType:'Pre Works', accessCode:'DRK-F21-7762', slots:['Thu 19 Jun','Fri 20 Jun','Mon 23 Jun'], status:'pending', confirmedDate:'', locked:false },
  { flat:'Flat 3',  resident:'Unconfirmed',  workType:'Pre Works', accessCode:'DRK-F03-4421', slots:['Wed 18 Jun','Thu 19 Jun'],             status:'pending', confirmedDate:'', locked:false },
  { flat:'Flat 7',  resident:'Maria Santos', workType:'Pre Works', accessCode:'DRK-F07-8813', slots:['Fri 20 Jun','Mon 23 Jun'],             status:'pending', confirmedDate:'', locked:false },
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
  client:    '[CLIENT]',
  workType:  'refurbishment and improvement',
  appUrl:    'https://durkan-rlo-resident.vercel.app',
};

const FB_QUESTIONS = [
  'Overall satisfaction','Professionalism of team',
  'Tidiness — area left clean?','Communication quality',
  'Would you recommend Durkan?',
];