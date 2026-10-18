# FieldKit — Wastewater & Septic Calculators

Offline-first field calculators for septic and wastewater operations. Vanilla HTML, CSS and ES modules — no frameworks, no build step, no runtime dependencies.

## Run it

Service workers (and ES modules) need HTTP rather than `file://`:

```bash
npm start            # python3 -m http.server 3000 --bind 0.0.0.0
```

Open `http://localhost:3000`. `localhost` is a secure context, so the service worker and Install button work. For phone testing over the LAN, use HTTPS or a tunnel; plain HTTP on a LAN IP will not register the service worker.

```bash
npm test             # Node test runner: calculators, reports, static PWA audit
npm run icons        # regenerate PNG icons from tools/make-icons.mjs
```

## Calculators

### Hydraulic Load Test (`hydraulic-load`)

- Bucket size (default 5 gal, ±1) and fill seconds (default 50, ±1).
- Flow rate: `bucket gallons ÷ (fill seconds ÷ 60)`.
- Target total defaults to 450 gal with 150/250/300/450 presets.
- Run time is shown as decimal minutes **and** `mm:ss`.

### Tank Volume & GPI (`tank-volumes`)

Three modes with a top-level switcher:

- **Rectangular** (length and width in ft, depth in in): `GPI = L × W × (1/12) × 7.48`; `gallons = L × W × (depth ÷ 12) × 7.48`.
- **Cylindrical** (vertical, diameter in ft, depth in in): `GPI = (π × (D ÷ 2)² × 7.48) ÷ 12`; `gallons = π × (D ÷ 2)² × (depth ÷ 12) × 7.48`.
- **Sand Filter** (all dimensions in ft plus gallons per dose): `total = W × L × D × 7.48`; `void GPI = (total ÷ (D × 12)) × 0.3`; `inches per dose = dose ÷ void GPI`.

### Pressure Distribution (`pressure-distribution`)

- **Squirt Height:** orifice presets 1/8", 5/32", 3/16" (default) and 1/4"; squirt height default 2 ft (±0.5); 90 orifices (±1). `GPM per orifice = 11.78 × d² × √(squirt × 0.433)`; `total = per-orifice × count`.
- **Run Time & Daily Dose:** `gallons per dose = GPM × on-time`; `gallons per day = dose × doses per day`.

### Drip & OSCAR (`drip-oscar`)

- **Drip System:** Netafim (0.007) or Geo-Flow (0.01); linear feet default 721, on-time 8.6 min, 12 doses/day. `flow = feet × rate`; `dose = flow × on-time`; `daily = dose × doses`.
- **Oscar Unit:** OS-50 (0.35) or OS-100 (0.70); 5 coils and 0.37 min on-time defaults. `flow = rate × coils`; `dose = flow × on-time`; `daily = dose × 360`.

### Field Utilities (`field-utilities`)

- **Double Check:** field GPM vs design GPM, difference and accuracy percentage.
- **Time:** minutes + seconds to decimal minutes.
- **Tape:** feet to inches.
- **Fractions:** 1/8 through 7/8 as decimal inches.

All results are estimates for field planning. Verify designs against the applicable local code, pump curve, soil assessment and manufacturer instructions.

## Structure

```
index.html            app shell, build badge and dashboard mount
version.js            single-source build version (badge, reports, cache name)
styles.css            dark-first design system; light theme via [data-theme]
app.js                hash router, persisted state, form/result engine,
                      mode tabs, steppers, presets, Markdown reporting
modules/
  registry.js         five ordered field modules + categories
  format.js           pure number and duration helpers
  summary.js          pure Markdown summary builder (including alerts)
  hydraulic-load.js
  tank-volumes.js
  pressure-distribution.js
  drip-oscar.js
  field-utilities.js
manifest.json         PWA metadata, icons, shortcuts
sw.js                 cache-first service worker (precaches every asset, names
                      the cache field-calc-${APP_VERSION})
icons/                generated PNG + SVG app icons
tools/make-icons.mjs  dependency-free PNG generator
tests/                node:test suites
```

Each calculator module is DOM-free and exports:

```js
export const meta = { id, name, category, icon, description, keywords, hint };
export const modes = [{ id, label }];             // optional
export const fields = [{ id, label, type, mode, stepper, choices, ... }];
export function calculate(values) {
  return { ok: true, outputs: [{ label, value, unit, primary }], alerts, notes };
}
```

Supported field types are `number`, `select`, `text` and `segmented`. Number fields render as `type="number" step="any" inputmode="decimal"`, can include `stepper`, `choices` (quick-select buttons) and `mode` visibility.

### Add a calculator

1. Create `modules/your-tool.js` with the exports above.
2. Import it in `modules/registry.js` and add it to `modules`.
3. Add `./modules/your-tool.js` to `ASSETS` in `sw.js`.
4. Bump `self.FIELDKIT_VERSION` in `version.js` so the cache name changes.
5. Add tests in `tests/calculators.test.mjs` and run `npm test`.

### Reporting

`copySummaryAsMarkdown({ title, category, inputs, result })` builds a timestamped Markdown report with inputs, results, status, alerts and assumptions, copies it to the clipboard, and falls back to a manual-copy dialog if clipboard access is blocked. `window.FieldKit` exposes the helper and `buildSummaryMarkdown` for console use.

Every module sets `meta.inspectionLog`, which adds the **Copy Inspection Log as Markdown** action to its result panel. The active mode and only that mode’s inputs are included in the report, and every report carries an **App Version** line from `version.js`.

### Build version and cache invalidation

`version.js` is the single source of truth for the build string (currently `v1.1.0-wastewater`). It is loaded as a classic script in `index.html`, imported into `sw.js` with `importScripts()`, and read by `app.js`. The footer shows **Build: … | Offline Ready** and a **Check for updates** button that calls `registration.update()`, prompts before activating a waiting worker, and reloads once it takes control.

Because the cache name is `field-calc-${APP_VERSION}`, bumping `version.js` installs a fresh cache, precaches the new assets, and deletes caches for older versions on activation. The version also appears in every copied Markdown summary and inspection log.

## Offline behaviour

`sw.js` precaches the app shell, stylesheet, every module, manifest and icons during install. Navigation requests return the cached shell, so all hash routes keep working with no network. Only same-origin GET requests are handled; bump the cache version when shipped assets change.
