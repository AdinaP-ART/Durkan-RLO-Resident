/* ============================================================
   data.js — Shared state between Resident and Back Office
   In a real app this would be a backend database (e.g. Supabase).
   ============================================================ */

const db = {
  /* Logged-in resident — set on login, cleared on logout */
  currentResident: null, // { flat, resident, accessCode }

  /* Whether the RLO has published the schedule */
  published: false,

  /* Works schedule — populated by RLO upload
     {flat, resident, workType, accessCode, slots[], status, confirmedDate, locked}
     status: "pending" | "confirmed" | "none-requested"
     locked: true once resident confirms (only RLO can unlock)
  */
  schedule: [],

  /* Resident feedback submissions */
  feedback: [], // { flat, workType, rating, comment, date }

  /* Back office inbox messages */
  messages: [
    {
      from: 'Sarah Ahmed — Flat 14',
      time: 'Today 09:14',
      body: 'Can you confirm if the visit will be before 10am? I have a school run at 10:30.',
      complaint: false,
    },
    {
      from: 'James Obi — Flat 9',
      time: 'Yesterday 17:42',
      body: 'The noise from works yesterday started at 7:30am. The agreed hours are 8am onwards. This is completely unacceptable.',
      complaint: true,
    },
    {
      from: 'Aisha Patel — Flat 21',
      time: 'Monday 11:05',
      body: 'Just wanted to say the kitchen team were absolutely brilliant — professional, tidy, and finished ahead of schedule.',
      complaint: false,
    },
  ],
};

/* ============================================================
   Pre-defined demo codes — always work regardless of schedule
   ============================================================ */
const DEMO_CODES = {
  'DRK-F14-2847': { flat: 'Flat 14', resident: 'Sarah Ahmed' },
  'DRK-F09-5531': { flat: 'Flat 9',  resident: 'James Obi' },
  'DRK-F21-7762': { flat: 'Flat 21', resident: 'Aisha Patel' },
};

/* ============================================================
   Demo schedule — loaded via "load demo" link
   ============================================================ */
const DEMO_SCHEDULE = [
  {
    flat: 'Flat 14', resident: 'Sarah Ahmed', workType: 'Kitchen install',
    accessCode: 'DRK-F14-2847',
    slots: ['Tue 17 Jun · 9:00–12:00', 'Wed 18 Jun · 9:00–12:00', 'Thu 19 Jun · 9:00–12:00'],
    status: 'pending', confirmedDate: '', locked: false,
  },
  {
    flat: 'Flat 9', resident: 'James Obi', workType: 'Electrical check',
    accessCode: 'DRK-F09-5531',
    slots: ['Mon 16 Jun · 13:00–14:00', 'Tue 17 Jun · 13:00–14:00', 'Wed 18 Jun · 13:00–14:00'],
    status: 'pending', confirmedDate: '', locked: false,
  },
  {
    flat: 'Flat 21', resident: 'Aisha Patel', workType: 'Bathroom fit',
    accessCode: 'DRK-F21-7762',
    slots: ['Thu 19 Jun · 9:00–17:00', 'Fri 20 Jun · 9:00–17:00', 'Mon 23 Jun · 9:00–17:00'],
    status: 'pending', confirmedDate: '', locked: false,
  },
  {
    flat: 'Flat 3', resident: 'Unconfirmed', workType: 'Property survey',
    accessCode: '', // generated on load
    slots: ['Wed 18 Jun · 10:00–11:00', 'Thu 19 Jun · 10:00–11:00'],
    status: 'pending', confirmedDate: '', locked: false,
  },
  {
    flat: 'Flat 7', resident: 'Maria Santos', workType: 'Damp inspection',
    accessCode: '', // generated on load
    slots: ['Fri 20 Jun · 14:00–15:00', 'Mon 23 Jun · 14:00–15:00'],
    status: 'pending', confirmedDate: '', locked: false,
  },
];

/* ============================================================
   Feedback survey questions
   ============================================================ */
const FB_QUESTIONS = [
  'Overall satisfaction with the work carried out',
  'Professionalism and conduct of the team',
  'Tidiness — was the area left clean?',
  'Communication — were you kept informed?',
  'Would you recommend Durkan to others?',
];
