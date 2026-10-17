import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { categories, getModule, modules } from '../modules/registry.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

describe('calculator registry', () => {
  it('exposes unique, valid modules', () => {
    const ids = modules.map((module) => module.meta.id);
    assert.equal(new Set(ids).size, ids.length, 'calculator ids must be unique');
    assert.equal(modules.length, 11);

    for (const module of modules) {
      assert.match(module.meta.id, /^[a-z0-9-]+$/);
      assert.ok(module.meta.name.length > 2);
      assert.ok(categories.includes(module.meta.category));
      assert.ok(module.meta.description.length > 10);
      assert.equal(typeof module.calculate, 'function');
      assert.ok(Array.isArray(module.fields) && module.fields.length > 0);
      assert.equal(getModule(module.meta.id), module);

      const fieldIds = module.fields.map((field) => field.id);
      assert.equal(new Set(fieldIds).size, fieldIds.length, `${module.meta.id} field ids`);

      for (const field of module.fields) {
        assert.match(field.id, /^[a-z][a-zA-Z0-9]*$/);
        assert.ok(field.label.length > 1);
        assert.ok(['number', 'select', 'text'].includes(field.type));
        if (field.type === 'select') {
          assert.ok(Array.isArray(field.options) && field.options.length > 0);
          for (const option of field.options) {
            assert.ok(String(option.value).length > 0);
            assert.ok(option.label.length > 0);
          }
        }
      }
    }
  });

  it('returns a result shell for empty input without throwing', () => {
    for (const module of modules) {
      const empty = Object.fromEntries(module.fields.map((field) => [field.id, null]));
      const result = module.calculate(empty);
      assert.equal(typeof result, 'object', `${module.meta.id} must return an object`);
      assert.equal(result.ok, false, `${module.meta.id} should prompt for input`);
      assert.equal(typeof result.message, 'string');
    }
  });

  it('has complete category ordering', () => {
    assert.equal(categories[0], 'All');
    assert.deepEqual(
      [...new Set(categories.slice(1))].sort(),
      ['Electrical', 'HVAC', 'Network', 'RF', 'Tools'],
    );
  });
});

describe('HTML shell', () => {
  const html = read('index.html');

  it('wires the manifest, stylesheet, theme and module entry point', () => {
    assert.match(html, /<html lang="en" data-theme="dark">/);
    assert.match(html, /rel="manifest" href="\.\/manifest\.json"/);
    assert.match(html, /rel="stylesheet" href="\.\/styles\.css"/);
    assert.match(html, /<script type="module" src="\.\/app\.js"><\/script>/);
    assert.match(html, /name="viewport"[^>]*width=device-width/);
    assert.match(html, /name="theme-color"/);
    assert.match(html, /id="view"/);
    assert.match(html, /id="theme-btn"/);
    assert.match(html, /id="toast"/);
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

  it('defines installable metadata and existing icons', () => {
    assert.equal(manifest.short_name, 'FieldKit');
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

  it('shortcut targets use in-app hash routes', () => {
    for (const shortcut of manifest.shortcuts) {
      const moduleId = shortcut.url.split('#/calc/')[1];
      assert.ok(moduleId, `shortcut ${shortcut.name} must target a calculator`);
      assert.ok(getModule(moduleId), `unknown shortcut target ${moduleId}`);
    }
  });
});

describe('Service worker', () => {
  const sw = read('sw.js');

  it('precaches every runtime asset', () => {
    const listed = new Set([...sw.matchAll(/'(\.\/[^']+)'/g)].map((match) => match[1]));
    const required = [
      './app.js',
      './styles.css',
      './manifest.json',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './modules/registry.js',
      ...modules.map((module) => `./modules/${module.meta.id}.js`),
      './modules/format.js',
      './modules/summary.js',
    ];

    for (const asset of required) {
      assert.ok(
        existsSync(join(ROOT, asset)),
        `asset ${asset} must exist for the service worker to cache it`,
      );
      assert.ok(listed.has(asset), `service worker does not precache ${asset}`);
    }
  });

  it('handles install, activate and navigation fallback', () => {
    assert.match(sw, /addEventListener\('install'/);
    assert.match(sw, /addEventListener\('activate'/);
    assert.match(sw, /request\.mode === 'navigate'/);
    assert.match(sw, /cache\.match\(SHELL/);
    assert.match(sw, /skipWaiting/);
    assert.match(sw, /clients\.claim/);
  });
});

describe('App wiring', () => {
  const app = read('app.js');

  it('contains the required routing, state and reporting utilities', () => {
    assert.match(app, /addEventListener\('hashchange'/);
    assert.match(app, /localStorage\.setItem\(STORAGE_KEY/);
    assert.match(app, /export async function copySummaryAsMarkdown/);
    assert.match(app, /buildSummaryMarkdown/);
    assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
    assert.match(app, /applyFilter/);
    assert.match(app, /step="any"/);
  });

  it('ships large touch targets for every interactive control', () => {
    const css = read('styles.css');
    assert.match(css, /min-height:\s*48px/g);
    assert.match(css, /\.input\s*{[^}]*min-height:\s*52px/s);
    assert.match(css, /\.btn\s*{[^}]*min-height:\s*48px/s);
    assert.match(css, /\.chip\s*{[^}]*min-height:\s*48px/s);
    assert.match(css, /\.icon-btn\s*{[^}]*height:\s*48px/s);
    assert.match(css, /\.pin-btn\s*{[^}]*width:\s*48px/s);
    assert.match(css, /data-theme="light"/);
  });
});
