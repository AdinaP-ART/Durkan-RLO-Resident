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
  { flat:'Flat 14', resident:'Sarah Ahmed',  workType:'Pre Works', accessCode:'DRK-F14-2847', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'], status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { flat:'Flat 9',  resident:'James Obi',    workType:'Pre Works', accessCode:'DRK-F09-5531', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'], status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { flat:'Flat 21', resident:'Aisha Patel',  workType:'Pre Works', accessCode:'DRK-F21-7762', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'], status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { flat:'Flat 3',  resident:'Unconfirmed',  workType:'Pre Works', accessCode:'DRK-F03-4421', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'],             status:'pending', confirmedDate:'', locked:false, contactLog:[] },
  { flat:'Flat 7',  resident:'Maria Santos', workType:'Pre Works', accessCode:'DRK-F07-8813', mobile:'', slots:['Mon 13 Jul','Tue 14 Jul','Wed 15 Jul','Thu 16 Jul'],             status:'pending', confirmedDate:'', locked:false, contactLog:[] },
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

const FB_QUESTIONS = [
  'Overall satisfaction','Professionalism of team',
  'Tidiness — area left clean?','Communication quality',
  'Would you recommend Durkan?',
];

