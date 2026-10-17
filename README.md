# FieldKit

Offline-first technical calculators for field work. Vanilla HTML, CSS and ES modules — no frameworks, no build step, no runtime dependencies.

## Run it

Service workers (and ES modules) need HTTP rather than `file://`:

```bash
npm start            # python3 -m http.server 3000 --bind 0.0.0.0
```

Open `http://localhost:3000`. `localhost` is treated as a secure context, so the service worker and Install button work. For phone testing on the same network, serve over HTTPS (or use a tunnel) — plain HTTP on a LAN IP will not register the service worker.

```bash
npm test             # Node test runner: calculators, summary, static PWA audit
npm run icons        # regenerate PNG icons from tools/make-icons.mjs
```

## Calculators

| Tool | Category | Core model |
| --- | --- | --- |
| Ohm's Law & Power | Electrical | Solve any two of V, I, R, P |
| Voltage Drop | Electrical | 2·L·I·R (single/DC), √3·L·I·R (three-phase) |
| Offset Bend | Electrical | Mark spacing, shrink and advance from bend angle |
| Battery Runtime | Electrical | Usable Wh × inverter efficiency ÷ load |
| IPv4 Subnet | Network | Mask, network, broadcast, host range |
| Fiber Loss Budget | Network | Fiber + connectors + splices vs TX/RX budget |
| PoE Budget | Network | Switch budget, reserve, devices supported |
| Airflow & CFM | HVAC | Sensible kW ÷ (1.206 × ΔT) |
| Superheat & Subcooling | HVAC | Line minus saturation temperature |
| RF Link Budget | RF | FSPL + gains/losses, link margin |
| Torque Converter | Tools | N·m, ft·lb, in·lb, kgf·m, kgf·cm |

All results are **estimates for field planning**. Verify against the applicable electrical code, manufacturer data and site conditions before making changes.

## Structure

```
index.html            app shell (dashboard mount point, header, toast)
styles.css            dark-first design system; light theme via [data-theme]
app.js                hash router, persisted state, dashboard filter,
                      calculator form/result engine, Markdown copy utility
modules/
  registry.js         ordered calculator list + categories
  format.js           pure number/duration display helpers
  summary.js          pure Markdown summary builder
  <tool>.js           meta + fields + pure calculate(values)
manifest.json         PWA metadata, icons, shortcuts
sw.js                 cache-first service worker (precaches every asset)
icons/                generated PNG + SVG app icons
tools/make-icons.mjs  dependency-free PNG generator
tests/                node:test suites
```

Every calculator module is DOM-free and exports:

```js
export const meta = { id, name, category, icon, description, keywords, hint };
export const fields = [{ id, label, type: 'number' | 'select' | 'text', unit, ... }];
export function calculate(values) {
  return { ok: true, outputs: [{ label, value, unit, primary }], status, notes };
}
```

`app.js` renders the form, converts raw input to numbers, and calls `calculate` on every change. Number fields are always rendered as `type="number" step="any" inputmode="decimal"` so phones open the numeric keypad.

### Add a calculator

1. Create `modules/your-tool.js` with the exports above.
2. Import it in `modules/registry.js` and add it to `modules`.
3. Add `./modules/your-tool.js` to the `ASSETS` list in `sw.js`.
4. Bump `CACHE_NAME` in `sw.js`.
5. Add a test in `tests/calculators.test.mjs` and run `npm test`.

### Reporting

```js
import { copySummaryAsMarkdown } from './app.js';
```

`copySummaryAsMarkdown({ title, category, inputs, result })` builds a Markdown report with timestamp, inputs, results, status and assumptions, copies it to the clipboard, and falls back to a manual-copy dialog when clipboard access is blocked. `window.FieldKit` exposes the same helper plus `buildSummaryMarkdown` for console use.

## Offline behaviour

`sw.js` precaches the app shell, stylesheet, every module, manifest and icons during install. Navigation requests return the cached shell, so all hash routes keep working with no network. Only same-origin GET requests are handled; edits to shipped assets require a cache version bump so clients pick up the new service worker.
