# Mana Rasta Web Portal — Fix Progress Tracker
**Source of truth. Do not duplicate files. Do not revisit completed items.**

---

## Output File
`mana-rasta-web-portal-fix.html` → `C:\Users\ADMIN\Downloads\mana-rasta\`

## Architecture Decisions
- Single-file HTML (CSS + JS inline)
- Role system: `sysadmin | commissioner | zone_ee | circle_dee | ward_ae`
- All data is mock; filtered at render time by `APP.user.role`
- No frameworks — vanilla JS, CSS Grid/Flex
- State: `window.APP` global object

## Mock Users (login credentials for demo)
| Email | Password | Role | Scope |
|---|---|---|---|
| sysadmin@ghmc.gov.in | admin | System Admin | All + Fraud + Admin panel |
| commissioner@ghmc.gov.in | comm | Commissioner | All data, all zones |
| ee.kukatpally@ghmc.gov.in | ee | Zone EE | Kukatpally zone only |
| dee.kukatpally@ghmc.gov.in | dee | Circle DEE | Kukatpally circle only |
| ae.ward14@ghmc.gov.in | ae | Ward AE | Ward 14 only |

---

## Chunk Plan & Status

### CHUNK 1 — Foundation: Auth + Shell + Login ✅ COMPLETE
- [x] Role system (APP.user, role-based nav, data filters)
- [x] Login page: GHMC emblem, remember me, forgot password, error state, tricolour fix
- [x] Sidebar: role-based nav visibility (Fraud → sysadmin only, Admin → sysadmin + commissioner)
- [x] Topbar: Logout with user name, bell panel (3 items), settings dropdown (Profile/Docs/Sign Out)
- [x] Search: focusable, ⌘K shortcut, placeholder results dropdown
- [x] Tricolour stripe under topbar
- [x] Login layout refactor (no margin hack, proper full-page state)
- [x] Page fade transition animation
- [x] Admin panel page (role assignment, user list)

### CHUNK 2 — Dashboard ✅ COMPLETE
- [x] Bar chart: full zone names, rotated labels, value labels on bars
- [x] Date range picker: Today / This Week / This Month toggle (updates chart)
- [x] Donut SVG: mathematically correct stroke-dasharray
- [x] Stat card sparklines (7-day SVG mini charts)
- [x] Report detail slide-in drawer (photo, location, timeline, officer notes)
- [x] Quick Actions strip (unassigned / SLA / fraud counts)

### CHUNK 3 — Reports ✅ COMPLETE
- [x] Filters wired to JS (zone, status, severity, date)
- [x] CSV export (real download)
- [x] Remove "+ New Report" button
- [x] Photo thumbnails (styled grey box + severity left border)
- [x] Sortable columns (ID, Reported, Severity) with ↑↓ indicators
- [x] Report detail drawer (same component as Dashboard)
- [x] Inline search
- [x] Bulk select with role-gated actions
- [x] Working pagination (JS)
- [x] Map view button in toolbar

### CHUNK 4 — Live Map ✅ COMPLETE
- [x] Filter pill row (zone / severity / status)
- [x] Pin/cluster click → popup card
- [x] Stats top-right, legend bottom-left (no overlap)
- [x] Ward boundary toggle (CSS approximations)
- [x] Address/ward search (role-aware)
- [x] Heatmap / Pins toggle
- [x] Zoom animation on +/- buttons

### CHUNK 5 — Officers ✅ COMPLETE
- [x] All 6 zones with role-based zone tab selector
- [x] Contact info (phone, email)
- [x] Active report count alongside fixed count
- [x] On-time % performance badge
- [x] Message + Edit action buttons (Edit opens modal)
- [x] Remove "+ Add Officer" (moved to Admin panel)
- [x] Search + filter across officers

### CHUNK 6 — Fraud Detection (sysadmin only) ✅ COMPLETE
- [x] Confirm modals for Suspend / Reject
- [x] History tab (resolved cases)
- [x] Risk score tooltip
- [x] Review → user submission history modal
- [x] Auto-flag rules section
- [x] Amber styling for warning-level alerts

### CHUNK 7 — Analytics ✅ COMPLETE
- [x] Fix Thursday HTML bug
- [x] Period navigation ← → (month switching)
- [x] Monthly trend line chart (12-month, SVG polyline)
- [x] Zone comparison grouped bar chart
- [x] Export PDF (window.print + print stylesheet)
- [x] Peak hours heatmap (7×24 grid)

### CHUNK 8 — Leaderboard ✅ COMPLETE
- [x] Period toggle (Week / Month / All Time) swaps data
- [x] Ward / Zone / City scope toggle
- [x] Badge icons next to top users
- [x] "You" highlight both tables
- [x] View Profile modal (citizen stats + submission history)

---

## Known Limitations / Out of Scope
- KPI cards on Analytics: deeper metrics deferred (user said "Later")
- No trend indicators on Leaderboard (user said "Not required")
- "+ Add Officer" removed from Officers page; lives in Admin panel only
- All data is mock/static — no real API calls
- Map is CSS-based mock, not Leaflet (consistent with demo scope)

---

## Files
| File | Status | Notes |
|---|---|---|
| `mana-rasta-web-portal.html` | Original | Do not modify |
| `mana-rasta-web-portal-fix.html` | ✅ Written | All chunks complete |
| `PORTAL_PROGRESS.md` | This file | Source of truth |
