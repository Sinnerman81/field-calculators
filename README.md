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

- Flow rate: `(test container gallons ÷ fill seconds) × 60`.
- Total run time: `target volume ÷ flow rate`, shown as `mm:ss`.
- Dosing rate: `flow rate × 1440`.
- Container and fill-time steppers, target-volume presets (150/250/300/450 gal) and a custom target.

### Tank Volume & GPI (`tank-volumes`)

- **Rectangular:** `gallons = (L × W × depth) ÷ 231`; `GPI = (L × W) ÷ 231`.
- **Cylindrical:** `gallons = (π × r² × depth) ÷ 231`; `GPI = (π × r²) ÷ 231`.
- Both modes use inside dimensions in inches and report total liquid gallons and gallons per inch.

### Pressure Distribution (`pressure-distribution`)

- Orifice discharge: `Q = 11.79 × d² × √h`, where `d` is orifice diameter in inches and `h` is residual head in feet.
- Total system flow: `orifice discharge × number of orifices`.
- Lateral volume: pipe factor (gal/ft) × lateral length, with factors for 1", 1.25", 1.5" and 2" pipe.
- Recommended minimum dose: `5 × lateral volume`.
- Pump run time: `target dose ÷ total system flow`, shown as `mm:ss`.

### Drip & OSCAR (`drip-oscar`)

Two modes with a top-level switcher:

**Subsurface Septic Drip**

- Emitter grid area, emitter count, zone flow, dose volume, areal loading and pump run time.
- Warns above `0.60 gal/sq ft/day` and when zone flow is below `2.0 GPM`.
- Emitter spacing 12/24 in, row spacing 12/18/24 in, emitter ratings 0.4/0.6/1.0 GPH.

**OSCAR Sand-Lined Package**

- OS-50: 0.35 GPM per coil, 3.5 gal minimum dose per coil, 50 GPD per coil capacity.
- OS-100: 0.70 GPM per coil, 7.0 gal minimum dose per coil, 100 GPD per coil capacity.
- Scheduled dose, manufacturer minimum system dose, active dose and pump run time.
- Alerts when the manufacturer minimum raises the dose or the design exceeds the per-coil capacity.
- Includes **Copy Inspection Log as Markdown** for field reporting.

All results are estimates for field planning. Verify designs against the applicable local code, pump curve, soil assessment and manufacturer instructions.

## Structure

```
index.html            app shell and dashboard mount
styles.css            dark-first design system; light theme via [data-theme]
app.js                hash router, persisted state, form/result engine,
                      mode tabs, steppers, presets, Markdown reporting
modules/
  registry.js         four ordered wastewater modules + categories
  format.js           pure number and duration helpers
  summary.js          pure Markdown summary builder (including alerts)
  hydraulic-load.js
  tank-volumes.js
  pressure-distribution.js
  drip-oscar.js
manifest.json         PWA metadata, icons, shortcuts
sw.js                 cache-first service worker (precaches every asset)
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
3. Add `./modules/your-tool.js` to `ASSETS` in `sw.js` and bump `CACHE_NAME`.
4. Add tests in `tests/calculators.test.mjs` and run `npm test`.

### Reporting

`copySummaryAsMarkdown({ title, category, inputs, result })` builds a timestamped Markdown report with inputs, results, status, alerts and assumptions, copies it to the clipboard, and falls back to a manual-copy dialog if clipboard access is blocked. `window.FieldKit` exposes the helper and `buildSummaryMarkdown` for console use.

The drip/OSCAR module sets `meta.inspectionLog`, which adds the **Copy Inspection Log as Markdown** action to its result panel. The active mode and only that mode’s inputs are included in the report.

## Offline behaviour

`sw.js` precaches the app shell, stylesheet, every module, manifest and icons during install. Navigation requests return the cached shell, so all hash routes keep working with no network. Only same-origin GET requests are handled; bump the cache version when shipped assets change.
