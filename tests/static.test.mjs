import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { categories, getModule, modules } from '../modules/registry.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const EXPECTED_IDS = [
  'hydraulic-load',
  'tank-volumes',
  'pressure-distribution',
  'drip-oscar',
  'field-utilities',
];
const OLD_MODULES = [
  'airflow',
  'battery-runtime',
  'conduit-bend',
  'fiber-loss',
  'ohms-law',
  'poe-budget',
  'rf-link',
  'subnet',
  'superheat-subcooling',
  'torque',
  'voltage-drop',
];

describe('wastewater calculator registry', () => {
  it('exposes exactly the five dedicated modules', () => {
    assert.deepEqual(
      modules.map((module) => module.meta.id),
      EXPECTED_IDS,
    );
    assert.equal(getModule('drip-oscar')?.meta.name, 'Drip & OSCAR');
    assert.equal(getModule('field-utilities')?.meta.name, 'Field Utilities');
    assert.equal(getModule('torque'), undefined);
    for (const id of OLD_MODULES) {
      assert.equal(getModule(id), undefined, `${id} must be unregistered`);
      assert.equal(existsSync(join(ROOT, `modules/${id}.js`)), false, `${id}.js must be deleted`);
    }
  });

  it('defines valid metadata, modes and fields', () => {
    for (const module of modules) {
      const { meta } = module;
      assert.match(meta.id, /^[a-z0-9-]+$/);
      assert.ok(meta.name.length > 2);
      assert.ok(categories.includes(meta.category));
      assert.ok(meta.description.length > 10);
      assert.equal(typeof module.calculate, 'function');

      const validModes = new Set(
        Array.isArray(module.modes) ? module.modes.map((mode) => mode.id) : [],
      );
      if (Array.isArray(module.modes)) {
        assert.ok(module.modes.length >= 2, `${meta.id} modes`);
        for (const mode of module.modes) {
          assert.ok(mode.id && mode.label);
        }
      }

      assert.ok(Array.isArray(module.fields) && module.fields.length > 0);
      const fieldIds = module.fields.map((field) => field.id);
      assert.equal(new Set(fieldIds).size, fieldIds.length, `${meta.id} field ids`);

      for (const field of module.fields) {
        assert.match(field.id, /^[a-z][a-zA-Z0-9]*$/);
        assert.ok(field.label.length > 1);
        assert.ok(['number', 'select', 'text', 'segmented'].includes(field.type));
        if (field.type === 'select' || field.type === 'segmented') {
          assert.ok(Array.isArray(field.options) && field.options.length > 0);
          for (const option of field.options) {
            assert.ok(String(option.value).length > 0);
            assert.ok(option.label.length > 0);
          }
        }
        if (field.mode) {
          assert.ok(validModes.has(field.mode), `${field.id} uses an unknown mode`);
        }
        if (Array.isArray(field.choices)) {
          assert.ok(field.choices.length > 0);
          for (const choice of field.choices) {
            assert.ok(choice.label.length > 0);
            assert.ok(choice.value != null);
          }
        }
        if (field.stepper != null) {
          assert.ok(Number.isFinite(field.stepper) && field.stepper > 0);
        }
      }
    }
  });

  it('returns an input prompt for empty values without throwing', () => {
    for (const module of modules) {
      const empty = Object.fromEntries(module.fields.map((field) => [field.id, null]));
      const result = module.calculate(empty);
      assert.equal(typeof result, 'object', `${module.meta.id} must return an object`);
      assert.equal(result.ok, false, `${module.meta.id} should prompt for input`);
      assert.equal(typeof result.message, 'string');
    }
  });

  it('orders the wastewater categories', () => {
    assert.deepEqual(categories, ['All', 'Hydraulics', 'Tanks', 'Distribution', 'Drip', 'Utilities']);
  });
});

describe('HTML shell', () => {
  const html = read('index.html');

  it('presents the wastewater app and wires local assets', () => {
    assert.match(html, /<html lang="en" data-theme="dark">/);
    assert.match(html, /Wastewater & Sep(?:t|amp;t)ic Calculators/);
    assert.match(html, /Wastewater &amp; septic calculators/);
    assert.match(html, /rel="manifest" href="\.\/manifest\.json"/);
    assert.match(html, /rel="stylesheet" href="\.\/styles\.css"/);
    assert.match(html, /<script src="\.\/version\.js"><\/script>/);
    assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
    assert.match(html, /name="viewport"[^>]*width=device-width/);
    assert.match(html, /id="view"/);
  });

  it('shows the build badge and update control in the footer', () => {
    assert.match(html, /id="build-badge"/);
    assert.match(html, /Build: <strong id="build-version">/);
    assert.match(html, /Offline Ready/);
    assert.match(html, /id="update-btn"/);
    assert.match(html, /Check for updates/);
  });

  it('references only local assets that exist', () => {
    const references = [...html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)].map((match) => match[1]);
    assert.ok(references.length >= 5);
    for (const reference of references) {
      assert.ok(existsSync(join(ROOT, reference)), `missing local asset ${reference}`);
    }
  });
});

describe('PWA manifest', () => {
  const manifest = JSON.parse(read('manifest.json'));

  it('defines installable wastewater metadata and icons', () => {
    assert.equal(manifest.short_name, 'FieldKit');
    assert.match(manifest.name, /Wastewater/);
    assert.equal(manifest.start_url, './index.html');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);

    const sizes = new Set();
    for (const icon of manifest.icons) {
      assert.ok(existsSync(join(ROOT, icon.src)), `missing icon ${icon.src}`);
      sizes.add(icon.sizes);
    }
    assert.ok(sizes.has('192x192'));
    assert.ok(sizes.has('512x512'));
    assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  });

  it('shortcuts target the new calculators', () => {
    assert.ok(manifest.shortcuts.length >= 3);
    for (const shortcut of manifest.shortcuts) {
      const moduleId = shortcut.url.split('#/calc/')[1];
      assert.ok(moduleId, `shortcut ${shortcut.name} must target a calculator`);
      assert.ok(EXPECTED_IDS.includes(moduleId), `unknown shortcut target ${moduleId}`);
    }
  });
});

describe('Service worker', () => {
  const sw = read('sw.js');

  it('precaches every wastewater runtime asset', () => {
    const listed = new Set([...sw.matchAll(/'(\.\/[^']+)'/g)].map((match) => match[1]));
    const required = [
      './app.js',
      './styles.css',
      './manifest.json',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './modules/registry.js',
      './modules/format.js',
      './modules/summary.js',
      ...modules.map((module) => `./modules/${module.meta.id}.js`),
    ];

    for (const asset of required) {
      assert.ok(existsSync(join(ROOT, asset)), `asset ${asset} must exist`);
      assert.ok(listed.has(asset), `service worker does not precache ${asset}`);
    }

    for (const id of OLD_MODULES) {
      assert.equal(listed.has(`./modules/${id}.js`), false, `${id} must not be cached`);
    }
    assert.ok(listed.has('./version.js'), 'service worker must precache version.js');
  });

  it('derives the cache name from the shared build version', () => {
    const versionSource = read('version.js');
    const match = versionSource.match(/self\.FIELDKIT_VERSION = '([^']+)'/);
    assert.ok(match, 'version.js must define self.FIELDKIT_VERSION');
    assert.match(match[1], /^v\d+\.\d+\.\d+[\w.-]*$/);

    assert.match(sw, /importScripts\('\.\/version\.js'\)/);
    assert.match(sw, /const APP_VERSION = self\.FIELDKIT_VERSION/);
    assert.match(sw, /const CACHE_NAME = `field-calc-\$\{APP_VERSION\}`/);
    assert.match(sw, /key\.startsWith\('field-calc-'\)/);
    assert.match(sw, /key\.startsWith\('fieldkit-'\)/);
    assert.doesNotMatch(sw, /fieldkit-shell-v2\.0\.0/);
  });

  it('handles install, activate and offline navigation', () => {
    assert.match(sw, /addEventListener\('install'/);
    assert.match(sw, /addEventListener\('activate'/);
    assert.match(sw, /request\.mode === 'navigate'/);
    assert.match(sw, /cache\.match\(SHELL/);
    assert.match(sw, /clients\.claim/);
  });
});

describe('App wiring', () => {
  const app = read('app.js');

  it('contains routing, state, custom controls and report actions', () => {
    assert.match(app, /addEventListener\('hashchange'/);
    assert.match(app, /localStorage\.setItem\(STORAGE_KEY/);
    assert.match(app, /state\.modes/);
    assert.match(app, /data-mode-value/);
    assert.match(app, /data-field-mode/);
    assert.match(app, /data-step/);
    assert.match(app, /data-set-value/);
    assert.match(app, /data-action="copy-inspection"/);
    assert.match(app, /Inspection Log/);
    assert.match(app, /export async function copySummaryAsMarkdown/);
    assert.match(app, /field\.step \?\? 'any'/);
    assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js',\s*\{\s*updateViaCache: 'none',?\s*\}\)/);
  });

  it('wires the build version, cache refresh and report stamp', () => {
    assert.match(app, /const APP_VERSION = self\.FIELDKIT_VERSION \?\? 'dev'/);
    assert.match(app, /buildVersionEl\.textContent = APP_VERSION/);
    assert.match(app, /registration\.update\(\)/);
    assert.match(app, /registration\.waiting\.postMessage\('SKIP_WAITING'\)/);
    assert.match(app, /controllerchange/);
    assert.match(app, /appVersion: APP_VERSION/);

    const summary = read('modules/summary.js');
    assert.match(summary, /appVersion = ''/);
    assert.match(summary, /\*\*App Version:\*\*/);
  });

  it('ships large touch targets for every interactive control', () => {
    const css = read('styles.css');
    assert.match(css, /\.input\s*{[^}]*min-height:\s*52px/s);
    assert.match(css, /\.btn\s*{[^}]*min-height:\s*48px/s);
    assert.match(css, /\.mode-tab\s*{[^}]*min-height:\s*48px/s);
    assert.match(css, /\.step-btn\s*{[^}]*min-height:\s*52px/s);
    assert.match(css, /\.quick-chip\s*{[^}]*min-height:\s*48px/s);
    assert.match(css, /\.segment-btn\s*{[^}]*min-height:\s*48px/s);
    assert.match(css, /data-theme="light"/);
  });
});
