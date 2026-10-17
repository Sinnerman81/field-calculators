import { categories, getModule, modules } from './modules/registry.js';
import { formatNumber, outputValue } from './modules/format.js';
import { buildSummaryMarkdown } from './modules/summary.js';

const APP_NAME = 'FieldKit';
const APP_VERSION = '1.0.0';
const STORAGE_KEY = 'fieldkit.state.v1';

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

const defaultState = () => ({ theme: 'dark', favorites: [], values: {} });

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((id) => typeof id === 'string')
        : [],
      values:
        parsed.values && typeof parsed.values === 'object' && !Array.isArray(parsed.values)
          ? parsed.values
          : {},
    };
  } catch (error) {
    return defaultState();
  }
}

const state = loadState();
const ui = { query: '', category: 'All' };
const activeCalc = { module: null, values: null, raw: null, result: null };
let currentRouteKey = null;
let persistTimer = 0;

function persistNow() {
  clearTimeout(persistTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    /* Storage may be blocked; the app still works for this session. */
  }
}

function persistSoon() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(persistNow, 250);
}

/* -------------------------------------------------------------------------- */
/* DOM references                                                              */
/* -------------------------------------------------------------------------- */

const view = document.getElementById('view');
const themeButton = document.getElementById('theme-btn');
const installButton = document.getElementById('install-btn');
const toast = document.getElementById('toast');
let toastTimer = 0;
let deferredInstallPrompt = null;

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

const ICONS = {
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13V2Z"/>',
  drop: '<path d="M12 3s6.2 6.5 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 9.5 12 3 12 3Z"/><path d="M9.2 13.7a2.9 2.9 0 0 0 2.3 3"/>',
  bend: '<path d="M3 18 9.5 6l4.2 8.2L20 5"/><circle cx="3" cy="18" r="1.4"/><circle cx="20" cy="5" r="1.4"/>',
  battery: '<rect x="2.5" y="7" width="16" height="10" rx="2.4"/><path d="M21.5 10.4v3.2"/><path d="M7.5 9.8v4.4M11 9.8v4.4M14.5 9.8v4.4"/>',
  network: '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M12 7.4v4.1M10.3 13.2 6.3 15.9M13.7 13.2l4 2.7M7.4 18h9.2"/>',
  fiber: '<path d="M2.5 17.5c4.6 0 4.6-11 9.5-11s4.9 7 9.5 7"/><circle cx="2.5" cy="17.5" r="1.5"/><circle cx="21.5" cy="13.5" r="1.5"/>',
  plug: '<path d="M8.5 3v4.2M15.5 3v4.2"/><path d="M6 7.2h12V11a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7.2Z"/><path d="M12 17v4"/>',
  fan: '<path d="M3.5 8.5h10.8a3.2 3.2 0 1 0-3.2-3.2"/><path d="M20.5 12H6.8a3.2 3.2 0 1 1 3.2-3.2"/><path d="M3.5 15.5h10.8a3.2 3.2 0 1 1-3.2 3.2"/>',
  thermometer: '<path d="M10 4.5a2.5 2.5 0 0 1 5 0v9.1a4.5 4.5 0 1 1-5 0V4.5Z"/><path d="M12.5 9v6.5"/><path d="M18.5 6h2M18.5 10h2M18.5 14h2"/>',
  antenna: '<path d="m8 21 4-18 4 18"/><path d="M9.2 15.2h5.6"/><path d="M5.5 6.5a9 9 0 0 0 0 11M18.5 6.5a9 9 0 0 1 0 11"/>',
  wrench: '<path d="M14.7 6.3a4.4 4.4 0 0 0 5.5 5.5l-8.9 8.9a2.6 2.6 0 0 1-3.7-3.7l8.9-8.9a4.4 4.4 0 0 0-1.8-1.8Z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.5 4.5"/>',
  copy: '<rect x="9" y="9" width="11" height="12" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  star: '<path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
  alert: '<path d="M12 8v5"/><path d="M12 16.5v.1"/><circle cx="12" cy="12" r="9"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

function svgIcon(name, className = 'icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.bolt}</svg>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[character];
  });
}

/* -------------------------------------------------------------------------- */
/* Theme, toasts and install prompt                                            */
/* -------------------------------------------------------------------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === 'dark';
  themeButton.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  themeButton.setAttribute('aria-pressed', String(!isDark));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? '#080c12' : '#f2efe8');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

themeButton.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  state.theme = next;
  persistNow();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  try {
    await deferredInstallPrompt.userChoice;
  } finally {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  }
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  deferredInstallPrompt = null;
  showToast('FieldKit installed — ready offline');
});

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

function calcCard(module) {
  const { id, name, category, icon, description } = module.meta;
  const pinned = state.favorites.includes(id);
  const haystack = [name, category, description, ...(module.meta.keywords ?? [])]
    .join(' ')
    .toLowerCase();

  return `
    <article
      class="calc-card"
      data-category="${esc(category)}"
      data-search="${esc(haystack)}"
    >
      <a class="card-link" href="#/calc/${esc(id)}" aria-label="Open ${esc(name)} calculator"></a>
      <div class="card-top">
        <span class="card-icon" data-cat="${esc(category)}">${svgIcon(icon)}</span>
        <button
          class="pin-btn${pinned ? ' is-pinned' : ''}"
          type="button"
          data-pin="${esc(id)}"
          aria-pressed="${pinned}"
          aria-label="${pinned ? 'Unpin' : 'Pin'} ${esc(name)}"
        >
          ${svgIcon('star')}
        </button>
      </div>
      <p class="card-cat">${esc(category)}</p>
      <h2 class="card-title">${esc(name)}</h2>
      <p class="card-desc">${esc(description)}</p>
    </article>
  `;
}

function renderHome() {
  activeCalc.module = null;
  activeCalc.result = null;

  const sorted = [...modules].sort(
    (a, b) =>
      Number(state.favorites.includes(b.meta.id)) - Number(state.favorites.includes(a.meta.id)),
  );

  view.innerHTML = `
    <section class="home" aria-labelledby="home-title">
      <div class="home-intro">
        <p class="eyebrow">Field-ready toolkit</p>
        <h1 class="home-title" id="home-title" tabindex="-1">
          Calculators that work
          <span class="accent">without a signal.</span>
        </h1>
        <p class="home-lede">
          Eleven practical tools for electrical, network, HVAC and RF work.
          Install once — everything stays on your device and available offline.
        </p>
      </div>

      <div class="search-block">
        <label class="sr-only" for="calc-search">Search calculators</label>
        <div class="search-field">
          ${svgIcon('search', 'search-icon')}
          <input
            class="search-input"
            id="calc-search"
            type="search"
            placeholder="Search tools, units or tasks"
            autocomplete="off"
            enterkeyhint="search"
            value="${esc(ui.query)}"
          />
          <button
            class="search-clear"
            id="search-clear"
            type="button"
            aria-label="Clear search"
            ${ui.query ? '' : 'hidden'}
          >
            ${svgIcon('close')}
          </button>
        </div>
      </div>

      <div class="chips" role="group" aria-label="Filter by category">
        ${categories
          .map(
            (category) => `
              <button
                class="chip"
                type="button"
                data-category="${esc(category)}"
                aria-pressed="${category === ui.category}"
              >${esc(category)}</button>
            `,
          )
          .join('')}
      </div>

      <div class="list-meta">
        <p class="result-count" id="result-count" aria-live="polite"></p>
        <span class="offline-badge"><span class="status-dot" aria-hidden="true"></span>Offline ready</span>
      </div>

      <div class="calc-grid" id="calc-grid">
        ${sorted.map(calcCard).join('')}
      </div>

      <div class="empty-state" id="empty-state" hidden>
        ${svgIcon('search', 'empty-icon')}
        <h2>No matches</h2>
        <p>Try another term, or clear the filters to see every tool.</p>
        <button class="btn" type="button" data-action="clear-filters">Clear filters</button>
      </div>

      <p class="home-foot">
        Every calculation runs locally. No accounts, no tracking, no network calls.
      </p>
    </section>
  `;

  attachHomeEvents();
  applyFilter();
}

function attachHomeEvents() {
  const searchInput = view.querySelector('#calc-search');
  const clearButton = view.querySelector('#search-clear');
  const chips = view.querySelectorAll('.chip');

  searchInput.addEventListener('input', () => {
    ui.query = searchInput.value;
    clearButton.hidden = ui.query.length === 0;
    applyFilter();
  });

  clearButton.addEventListener('click', () => {
    ui.query = '';
    searchInput.value = '';
    clearButton.hidden = true;
    applyFilter();
    searchInput.focus();
  });

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      ui.category = chip.dataset.category ?? 'All';
      for (const other of chips) {
        other.setAttribute('aria-pressed', String(other === chip));
      }
      applyFilter();
      chip.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }
}

function applyFilter() {
  const tokens = ui.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const cards = view.querySelectorAll('.calc-card');
  const count = view.querySelector('#result-count');
  const empty = view.querySelector('#empty-state');
  let shown = 0;

  for (const card of cards) {
    const categoryMatch = ui.category === 'All' || card.dataset.category === ui.category;
    const textMatch = tokens.every((token) => card.dataset.search.includes(token));
    const visible = categoryMatch && textMatch;
    card.hidden = !visible;
    if (visible) shown += 1;
  }

  if (count) {
    count.textContent = `${shown} calculator${shown === 1 ? '' : 's'}`;
  }
  if (empty) empty.hidden = shown !== 0;
}

/* -------------------------------------------------------------------------- */
/* Calculator view                                                             */
/* -------------------------------------------------------------------------- */

function fieldMarkup(field, savedValue) {
  const id = `field-${field.id}`;
  const initial = savedValue !== undefined ? savedValue : field.default ?? '';
  const hintId = field.hint ? `${id}-hint` : '';
  const describedBy = hintId ? `aria-describedby="${hintId}"` : '';
  const label = `<label class="field-label" for="${id}">${esc(field.label)}</label>`;
  const hint = field.hint ? `<p class="field-hint" id="${hintId}">${esc(field.hint)}</p>` : '';
  const wide = field.span === 2 ? ' field--wide' : '';

  if (field.type === 'select') {
    const options = field.options
      .map((option) => {
        const selected = String(initial) === String(option.value) ? ' selected' : '';
        return `<option value="${esc(option.value)}"${selected}>${esc(option.label)}</option>`;
      })
      .join('');
    const placeholder = field.placeholder
      ? `<option value=""${initial === '' ? ' selected' : ''}>${esc(field.placeholder)}</option>`
      : '';

    return `
      <div class="field${wide}">
        ${label}
        <div class="select-wrap">
          <select
            class="input select"
            id="${id}"
            name="${esc(field.id)}"
            ${describedBy}
          >${placeholder}${options}</select>
          <svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
        ${hint}
      </div>
    `;
  }

  const type = field.type === 'number' ? 'number' : 'text';
  const attrs = [
    `type="${type}"`,
    `id="${id}"`,
    `name="${esc(field.id)}"`,
    `value="${esc(initial)}"`,
    field.placeholder ? `placeholder="${esc(field.placeholder)}"` : '',
    type === 'number' ? 'step="any" inputmode="decimal"' : '',
    field.min != null ? `min="${esc(field.min)}"` : '',
    field.max != null ? `max="${esc(field.max)}"` : '',
    'autocomplete="off"',
    'enterkeyhint="next"',
    describedBy,
  ]
    .filter(Boolean)
    .join(' ');

  return `
    <div class="field${wide}">
      ${label}
      <div class="input-wrap${field.unit ? ' has-unit' : ''}">
        <input class="input" ${attrs} />
        ${field.unit ? `<span class="input-unit" aria-hidden="true">${esc(field.unit)}</span>` : ''}
      </div>
      ${hint}
    </div>
  `;
}

function renderCalculator(module) {
  const { meta } = module;
  const saved = state.values[meta.id] ?? {};

  view.innerHTML = `
    <section class="calc" aria-labelledby="calc-title">
      <a class="back-link" href="#/">
        ${svgIcon('arrowLeft')}
        <span>All calculators</span>
      </a>

      <header class="calc-header">
        <span class="calc-icon-lg" data-cat="${esc(meta.category)}">${svgIcon(meta.icon)}</span>
        <div class="calc-heading">
          <p class="eyebrow">${esc(meta.category)}</p>
          <h1 id="calc-title" tabindex="-1">${esc(meta.name)}</h1>
          <p class="calc-desc">${esc(meta.description)}</p>
        </div>
      </header>

      ${meta.hint ? `<p class="calc-hint">${svgIcon('alert')}${esc(meta.hint)}</p>` : ''}

      <form class="calc-form" id="calc-form" novalidate>
        <div class="field-grid">
          ${module.fields.map((field) => fieldMarkup(field, saved[field.id])).join('')}
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="reset-inputs">
            Reset inputs
          </button>
        </div>
      </form>

      <section class="results" id="results" aria-live="polite" aria-atomic="false"></section>
    </section>
  `;

  const form = view.querySelector('#calc-form');
  const resetButton = view.querySelector('[data-action="reset-inputs"]');

  function inputFor(field) {
    return form.elements.namedItem(field.id);
  }

  function readRawValues() {
    const raw = {};
    for (const field of module.fields) {
      const input = inputFor(field);
      raw[field.id] = input ? input.value : '';
    }
    return raw;
  }

  function readValues() {
    const raw = readRawValues();
    const values = {};
    for (const field of module.fields) {
      const value = raw[field.id];
      if (value === '') {
        values[field.id] = null;
      } else if (field.type === 'number') {
        const number = Number(value);
        values[field.id] = Number.isFinite(number) ? number : null;
      } else {
        values[field.id] = value;
      }
    }
    return { values, raw };
  }

  function update() {
    const { values, raw } = readValues();
    activeCalc.module = module;
    activeCalc.values = values;
    activeCalc.raw = raw;

    state.values[meta.id] = raw;
    persistSoon();

    activeCalc.result = safeCalculate(module, values);
    renderResult(activeCalc.result, module);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', (event) => event.preventDefault());

  resetButton.addEventListener('click', () => {
    for (const field of module.fields) {
      const input = inputFor(field);
      if (input) input.value = field.default ?? '';
    }
    update();
    showToast('Inputs reset');
  });

  update();
}

function safeCalculate(module, values) {
  try {
    return module.calculate(values);
  } catch (error) {
    console.error(`[FieldKit] ${module.meta.id} calculation failed`, error);
    return {
      ok: false,
      tone: 'error',
      message: 'The calculation could not be completed. Check the values and try again.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

const STATUS_ICONS = { ok: 'check', warn: 'alert', bad: 'close' };

function statusMarkup(status) {
  const level = ['ok', 'warn', 'bad'].includes(status.level) ? status.level : 'warn';
  return `
    <div class="status status--${level}">
      <span class="status-icon">${svgIcon(STATUS_ICONS[level])}</span>
      <p>${esc(status.label)}</p>
    </div>
  `;
}

function heroMetric(output) {
  const tone = output.tone ? ` metric--${esc(output.tone)}` : '';
  const unit = output.unit
    ? `<span class="metric-unit">${esc(output.unit)}</span>`
    : '';

  return `
    <div class="metric metric--hero${tone}">
      <p class="metric-label">${esc(output.label)}</p>
      <p class="metric-value">${esc(outputValue(output))}${unit}</p>
    </div>
  `;
}

function metricRow(output) {
  const unit = output.unit ? ` <span class="metric-unit">${esc(output.unit)}</span>` : '';
  return `
    <div class="metric-row">
      <dt>${esc(output.label)}</dt>
      <dd>${esc(outputValue(output))}${unit}</dd>
    </div>
  `;
}

function renderResult(result, module) {
  const container = view.querySelector('#results');
  if (!container) return;

  if (!result || result.ok !== true) {
    const isError = result?.tone === 'error';
    container.innerHTML = `
      <div class="result-panel result-panel--idle">
        <div class="result-head"><h2>Results</h2></div>
        <p class="result-message${isError ? ' is-error' : ''}">
          ${esc(result?.message ?? 'Enter values to begin.')}
        </p>
        <p class="result-footnote">
          Results update as you type. Copy a Markdown summary into your report when ready.
        </p>
      </div>
    `;
    return;
  }

  const outputs = Array.isArray(result.outputs) ? result.outputs : [];
  const primaries = outputs.filter((output) => output.primary);
  const secondaries = outputs.filter((output) => !output.primary);
  const notes = Array.isArray(result.notes) ? result.notes : [];

  container.innerHTML = `
    <div class="result-panel">
      <div class="result-head">
        <h2>Results</h2>
        <button class="btn btn-small" type="button" data-action="copy-summary">
          ${svgIcon('copy')}
          <span>Copy summary</span>
        </button>
      </div>

      ${result.status ? statusMarkup(result.status) : ''}

      ${primaries.length ? `<div class="hero-grid">${primaries.map(heroMetric).join('')}</div>` : ''}

      ${secondaries.length ? `<dl class="metric-list">${secondaries.map(metricRow).join('')}</dl>` : ''}

      ${
        notes.length
          ? `
            <details class="assumptions">
              <summary>Assumptions & notes</summary>
              <ul>${notes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul>
            </details>
          `
          : ''
      }

      <p class="result-footnote">Calculated on-device · ${esc(module.meta.name)}</p>
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/* Summary export                                                              */
/* -------------------------------------------------------------------------- */

function summaryInputs(module, raw) {
  const inputs = [];
  if (!raw) return inputs;

  for (const field of module.fields) {
    const value = raw[field.id];
    if (value == null || value === '') continue;

    if (field.type === 'select') {
      const option = field.options.find((item) => String(item.value) === String(value));
      inputs.push({ label: field.label, value: option?.label ?? value });
    } else if (field.type === 'number') {
      const number = Number(value);
      inputs.push({
        label: field.label,
        value: Number.isFinite(number) ? formatNumber(number) : value,
        unit: field.unit ?? '',
      });
    } else {
      inputs.push({ label: field.label, value });
    }
  }

  return inputs;
}

async function copyPlainText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      /* Fall through to the legacy path. */
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch (error) {
    return false;
  }
}

function showCopyFallback(markdown) {
  let dialog = document.getElementById('copy-dialog');

  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'copy-dialog';
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <form method="dialog" class="dialog-inner">
        <h2>Copy summary</h2>
        <p>Clipboard access was blocked. Select the text below and copy it manually.</p>
        <textarea class="copy-text" readonly aria-label="Markdown summary"></textarea>
        <div class="dialog-actions">
          <button class="btn btn-primary" value="close">Done</button>
        </div>
      </form>
    `;
    document.body.append(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  const textarea = dialog.querySelector('textarea');
  textarea.value = markdown;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.select();
  });
}

/**
 * Reusable "Copy Summary as Markdown" utility.
 * Builds a report-ready block from any calculator result, then writes it to the
 * clipboard (with a manual-copy dialog as a last-resort fallback).
 */
export async function copySummaryAsMarkdown({ title, category, inputs = [], result }) {
  let markdown;
  try {
    markdown = buildSummaryMarkdown({
      title,
      category,
      inputs,
      result,
      generatedAt: new Date(),
      appName: APP_NAME,
    });
  } catch (error) {
    console.error('[FieldKit] Could not build summary', error);
    showToast('Could not build the summary');
    return false;
  }

  const copied = await copyPlainText(markdown);
  if (copied) {
    showToast('Summary copied as Markdown');
  } else {
    showCopyFallback(markdown);
  }
  return copied;
}

/* -------------------------------------------------------------------------- */
/* Routing                                                                     */
/* -------------------------------------------------------------------------- */

function parseRoute() {
  const rawHash = window.location.hash.replace(/^#/, '');
  let hash = rawHash;
  try {
    hash = decodeURIComponent(rawHash);
  } catch (error) {
    /* Keep the raw value if the fragment is not valid percent-encoding. */
  }
  if (!hash || hash === '/') return { name: 'home', key: 'home' };

  const withSlash = hash.startsWith('/') ? hash : `/${hash}`;
  const path = withSlash.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  const match = path.match(/^\/calc\/([a-z0-9-]+)$/);

  if (match) return { name: 'calc', id: match[1], key: path };
  return { name: 'not-found', id: hash.replace(/^\/+/, ''), key: path };
}

function renderNotFound(id) {
  activeCalc.module = null;
  activeCalc.result = null;
  view.innerHTML = `
    <section class="not-found">
      <p class="eyebrow">Not found</p>
      <h1 tabindex="-1">Calculator unavailable</h1>
      <p>
        “${esc(id || 'unknown')}” is not part of this build. It may have been renamed or
        removed.
      </p>
      <a class="btn btn-primary" href="#/">Back to all calculators</a>
    </section>
  `;
}

function renderRoute() {
  const route = parseRoute();
  const changed = currentRouteKey !== route.key;
  currentRouteKey = route.key;

  if (route.name === 'home') {
    renderHome();
    document.title = `${APP_NAME} — Field Technical Calculators`;
  } else if (route.name === 'calc') {
    const module = getModule(route.id);
    if (module) {
      renderCalculator(module);
      document.title = `${module.meta.name} — ${APP_NAME}`;
    } else {
      renderNotFound(route.id);
      document.title = `Not found — ${APP_NAME}`;
    }
  } else {
    renderNotFound(route.id);
    document.title = `Not found — ${APP_NAME}`;
  }

  if (changed) {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const heading = view.querySelector('h1');
      heading?.focus({ preventScroll: true });
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Shared event delegation                                                     */
/* -------------------------------------------------------------------------- */

// The skip link must move focus without changing the hash — the hash is the router.
document.querySelector('.skip-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  view.focus();
  view.scrollIntoView({ block: 'start' });
});

view.addEventListener('click', async (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const pinButton = target.closest('[data-pin]');
  if (pinButton) {
    const id = pinButton.dataset.pin;
    const index = state.favorites.indexOf(id);
    const pinned = index === -1;

    if (pinned) state.favorites.push(id);
    else state.favorites.splice(index, 1);
    persistNow();

    pinButton.classList.toggle('is-pinned', pinned);
    pinButton.setAttribute('aria-pressed', String(pinned));
    const name = getModule(id)?.meta.name ?? 'calculator';
    pinButton.setAttribute('aria-label', `${pinned ? 'Unpin' : 'Pin'} ${name}`);
    return;
  }

  if (target.closest('[data-action="clear-filters"]')) {
    ui.query = '';
    ui.category = 'All';
    renderHome();
    view.querySelector('#calc-search')?.focus();
    return;
  }

  if (target.closest('[data-action="copy-summary"]')) {
    if (!activeCalc.module || activeCalc.result?.ok !== true) return;
    const button = target.closest('[data-action="copy-summary"]');
    button.disabled = true;
    try {
      await copySummaryAsMarkdown({
        title: activeCalc.module.meta.name,
        category: activeCalc.module.meta.category,
        inputs: summaryInputs(activeCalc.module, activeCalc.raw),
        result: activeCalc.result,
      });
    } catch (error) {
      console.error('[FieldKit] Copy failed', error);
      showToast('Could not copy the summary');
    } finally {
      button.disabled = false;
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Boot                                                                        */
/* -------------------------------------------------------------------------- */

applyTheme(state.theme);

if (
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: window-controls-overlay)').matches ||
  window.navigator.standalone === true
) {
  installButton.hidden = true;
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('pagehide', persistNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistNow();
});

renderRoute();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.info('[FieldKit] Offline cache unavailable:', error?.message ?? error);
    });
  });
}

// Expose the reporting helper for console use and future modules.
window.FieldKit = {
  version: APP_VERSION,
  modules,
  buildSummaryMarkdown,
  copySummaryAsMarkdown,
};
