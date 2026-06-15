Durkan Regen — Resident App + Back Office v5

## What's in this app

**Resident side**
- Access code login — unique per flat, locks resident to their own data only
- Home screen with next visit summary
- Appointment selection — pick from RLO-provided slots, locked on confirmation
- Defect reporting — description, location, photo, priority level
- Message Durkan — contact RLO or raise a complaint
- FAQ & resident guide
- Rate completed work — 5-question satisfaction survey

**RLO Portal**
- Separate passcode login for RLO staff
- Dashboard — live metrics, appointment tracker, open defects
- Upload works schedule — real Excel (.xlsx) upload with SheetJS
- Slot locking — confirmed dates locked, only RLO can unlock
- Defect management — track open, in-progress and closed defects
- Messages inbox — reply to residents, escalate complaints to Sonia
- Reports — appointments, defects and satisfaction in one view

## Demo credentials

| Role | Code | Name |
|------|------|------|
| Resident | `DRK-F14-2847` | Sarah Ahmed, Flat 14 |
| Resident | `DRK-F09-5531` | James Obi, Flat 9 |
| Resident | `DRK-F21-7762` | Aisha Patel, Flat 21 |
| RLO | `RLO-2025` | Sarah Okafor |
| Senior RLO | `SONIA-2025` | Sonia Williams |

## Excel upload format

| Flat | Resident | Work Type | Date 1 | Date 2 | Date 3 |
|------|----------|-----------|--------|--------|--------|
| Flat 14 | Sarah Ahmed | Kitchen install | Tue 17 Jun 9-12 | Wed 18 Jun 9-12 | Thu 19 Jun 9-12 |

## File structure
index.html
manifest.json
sw.js
logo.svg
css/style.css
js/data.js
js/app.js
icons/icon-192.png
icons/icon-512.png

## Installing as an app (PWA)

**iPhone** — open in Safari → Share → Add to Home Screen

**Android** — open in Chrome → install banner appears automatically

## Brand colours

| Colour | Hex |
|--------|-----|
| Dark Blue | `#002856` |
| Jade Green | `#008C79` |
| Cool Grey | `#D9D8D6` |
