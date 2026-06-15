/* data.js — Durkan Regen v5 shared state */
const db={
  currentResident:null,
  currentRLO:null,
  published:false,
  schedule:[],
  defects:[],
  feedback:[],
  messages:[
    {from:'Sarah Ahmed — Flat 14',time:'Today 09:14',body:"Can you confirm if the visit will be before 10am? I have a school run at 10:30.",complaint:false},
    {from:'James Obi — Flat 9',time:'Yesterday 17:42',body:"The noise from works yesterday started at 7:30am. This is completely unacceptable.",complaint:true},
    {from:'Aisha Patel — Flat 21',time:'Monday 11:05',body:"The kitchen team were absolutely brilliant — professional, tidy, and finished on time.",complaint:false},
  ],
};
const DEMO_CODES={
  'DRK-F14-2847':{flat:'Flat 14',resident:'Sarah Ahmed'},
  'DRK-F09-5531':{flat:'Flat 9', resident:'James Obi'},
  'DRK-F21-7762':{flat:'Flat 21',resident:'Aisha Patel'},
};
const RLO_CODES={
  'RLO-2025':{name:'Sarah Okafor',role:'RLO'},
  'SONIA-2025':{name:'Sonia Williams',role:'Senior RLO'},
};
const DEMO_SCHEDULE=[
  {flat:'Flat 14',resident:'Sarah Ahmed', workType:'Kitchen install',  accessCode:'DRK-F14-2847',slots:['Tue 17 Jun · 9:00–12:00','Wed 18 Jun · 9:00–12:00','Thu 19 Jun · 9:00–12:00'],status:'pending',confirmedDate:'',locked:false},
  {flat:'Flat 9', resident:'James Obi',   workType:'Electrical check', accessCode:'DRK-F09-5531',slots:['Mon 16 Jun · 13:00–14:00','Tue 17 Jun · 13:00–14:00'],status:'pending',confirmedDate:'',locked:false},
  {flat:'Flat 21',resident:'Aisha Patel', workType:'Bathroom fit',     accessCode:'DRK-F21-7762',slots:['Thu 19 Jun · 9:00–17:00','Fri 20 Jun · 9:00–17:00'],status:'pending',confirmedDate:'',locked:false},
  {flat:'Flat 3', resident:'Unconfirmed', workType:'Property survey',  accessCode:'DRK-F03-4421',slots:['Wed 18 Jun · 10:00–11:00','Thu 19 Jun · 10:00–11:00'],status:'pending',confirmedDate:'',locked:false},
  {flat:'Flat 7', resident:'Maria Santos',workType:'Damp inspection',  accessCode:'DRK-F07-8813',slots:['Fri 20 Jun · 14:00–15:00','Mon 23 Jun · 14:00–15:00'],status:'pending',confirmedDate:'',locked:false},
];
const FB_QUESTIONS=['Overall satisfaction','Professionalism of team','Tidiness — area left clean?','Communication quality','Would you recommend Durkan?'];
