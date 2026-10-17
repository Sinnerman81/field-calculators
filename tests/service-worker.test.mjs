import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const version = read('version.js').match(/self\.FIELDKIT_VERSION = '([^']+)'/)?.[1];

function loadWorker(existingCaches = []) {
  const listeners = {};
  const cachesByName = new Map();
  const deleted = [];
  let waitingSkipped = false;
  let claimed = false;

  const context = {
    URL,
    console,
    caches: {
      async open(name) {
        if (!cachesByName.has(name)) cachesByName.set(name, { assets: null });
        return {
          async addAll(assets) {
            cachesByName.get(name).assets = [...assets];
          },
          async match() {
            return undefined;
          },
          async put() {},
        };
      },
      async keys() {
        return [...existingCaches, ...cachesByName.keys()];
      },
      async delete(name) {
        deleted.push(name);
        cachesByName.delete(name);
        return true;
      },
    },
    self: {
      location: new URL('https://fieldkit.test/sw.js'),
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
      async skipWaiting() {
        waitingSkipped = true;
      },
      clients: {
        async claim() {
          claimed = true;
        },
      },
    },
  };
  context.self.self = context.self;
  context.importScripts = (path) => {
    vm.runInContext(read(path.replace(/^\.\//, '')), context);
  };

  vm.createContext(context);
  vm.runInContext(read('sw.js'), context);

  const cacheName = vm.runInContext('CACHE_NAME', context);
  const assets = vm.runInContext('ASSETS', context);

  return {
    cacheName,
    assets,
    listeners,
    cachesByName,
    deleted,
    wasSkipped: () => waitingSkipped,
    wasClaimed: () => claimed,
  };
}

describe('service worker cache busting', () => {
  it('names the cache from the shared version and precaches the version file', () => {
    assert.ok(version, 'version.js must export a build version');
    const worker = loadWorker();

    assert.equal(worker.cacheName, `field-calc-${version}`);
    assert.ok(worker.assets.includes('./version.js'));
    assert.ok(worker.assets.includes('./app.js'));
    assert.ok(worker.assets.includes('./modules/drip-oscar.js'));
  });

  it('installs the current cache and removes older versioned and legacy caches', async () => {
    const worker = loadWorker(['field-calc-v1.0.0-old', 'fieldkit-shell-v2.0.0', 'unrelated']);

    const pending = [];
    worker.listeners.install({ waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);

    assert.deepEqual(
      Array.from(worker.cachesByName.get(worker.cacheName)?.assets ?? []),
      Array.from(worker.assets),
    );
    assert.equal(worker.wasSkipped(), false, 'install should wait for the update prompt');

    const activating = [];
    worker.listeners.activate({ waitUntil: (promise) => activating.push(promise) });
    await Promise.all(activating);

    assert.ok(worker.deleted.includes('field-calc-v1.0.0-old'));
    assert.ok(worker.deleted.includes('fieldkit-shell-v2.0.0'));
    assert.equal(worker.deleted.includes('unrelated'), false);
    assert.equal(worker.deleted.includes(worker.cacheName), false);
    assert.equal(worker.wasClaimed(), true);
  });
});
