# Durkan Regen v4 — Resident App + Back Office

## What's new in v4
- **Access code login** — each resident gets a unique code (e.g. `DRK-F14-2847`) from their welcome letter. They can only see their own flat's appointments.
- **Real Excel upload** — drop an actual `.xlsx` file and it parses automatically using SheetJS. Access codes are generated per flat.
- **Slot locking** — once a resident confirms a date it is locked (🔒). Only the RLO can unlock it from the dashboard.
- **Feedback tab** — residents rate completed work on 5 questions. Scores appear live in the back office dashboard.
- **PWA** — installable on iPhone and Android as a home screen app.

## File structure
```
index.html
manifest.json       ← PWA config
sw.js               ← Service worker (offline support)
icons/
  icon-192.png      ← App icon
  icon-512.png      ← Splash screen icon
css/
  style.css
js/
  data.js           ← Shared state, demo codes, default schedule
  app.js            ← All interactivity
README.md
```

## Demo codes
| Code | Flat | Resident |
|------|------|----------|
| `DRK-F14-2847` | Flat 14 | Sarah Ahmed |
| `DRK-F09-5531` | Flat 9  | James Obi |
| `DRK-F21-7762` | Flat 21 | Aisha Patel |

## Excel upload format
Your `.xlsx` file needs these column headers (flexible casing/spacing accepted):

| Flat | Resident | Work Type | Date 1 | Date 2 | Date 3 |
|------|----------|-----------|--------|--------|--------|
| Flat 14 | Sarah Ahmed | Kitchen install | Tue 17 Jun 9-12 | Wed 18 Jun 9-12 | Thu 19 Jun 9-12 |

## Uploading to GitHub
Replace all files in your existing repo with these. Make sure `index.html` is at the root.
Also upload `manifest.json`, `sw.js`, and the `icons/` folder.

## Installing as an app (PWA)
**iPhone (Safari only)**
1. Open your Vercel URL in Safari
2. Tap Share → Add to Home Screen → Add

**Android (Chrome)**
1. Open your Vercel URL in Chrome
2. Tap the install banner or menu → Add to Home Screen

## Brand colours
| Colour | Hex |
|--------|-----|
| Dark Blue | `#002856` |
| Jade Green | `#008C79` |
| Cool Grey | `#D9D8D6` |

## Next steps
- [ ] Connect to Supabase for a real database
- [ ] Send real SMS via Twilio
- [ ] Add defect reporting screen
- [ ] Send access code letters via post/email
