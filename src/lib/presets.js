import { sanitizeSettings } from './settings.js';

const STORAGE_KEY = 'lag-viz-presets';

/** Version written to storage and exports. Older/bare-array data is still read. */
export const PRESET_FORMAT_VERSION = 1;

export const MAX_PRESETS = 100;
export const MAX_NAME_LENGTH = 60;
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** Error whose message is safe to show to the user. */
export class PresetError extends Error {}

// Storage adapter ({ getItem, setItem }); replaceable so tests need no DOM.
let storage = null;

export function setStorage(adapter) {
  storage = adapter;
}

function getStorage() {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // access can throw when site data is blocked
  }
}

function cleanName(name) {
  return typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
}

/**
 * Validate parsed preset data (bare array or { version, presets }).
 * Entries without a usable name or data object are dropped; settings are
 * sanitized; duplicate names keep the last occurrence.
 * @returns {{ presets: {name, data}[], skipped: number, adjusted: number }}
 */
function normalizePresets(raw) {
  const list = Array.isArray(raw) ? raw
    : (raw && typeof raw === 'object' && Array.isArray(raw.presets)) ? raw.presets
    : null;
  if (!list) throw new PresetError('File is not a preset list.');

  const byName = new Map();
  let skipped = 0;
  let adjusted = 0;

  for (const item of list) {
    const name = cleanName(item?.name);
    const data = item?.data;
    if (!name || data === null || typeof data !== 'object' || Array.isArray(data)) {
      skipped++;
      continue;
    }
    const result = sanitizeSettings(data);
    adjusted += result.adjusted.length + result.invalid.length;
    byName.set(name, result.settings);
  }

  return {
    presets: [...byName].map(([name, data]) => ({ name, data })),
    skipped,
    adjusted,
  };
}

/** Read stored presets. Never throws; corrupt or unavailable storage reads as empty. */
function readStore() {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizePresets(JSON.parse(raw)).presets;
  } catch {
    return [];
  }
}

function writeStore(presets) {
  try {
    const store = getStorage();
    if (!store) throw new Error('no storage');
    store.setItem(STORAGE_KEY, JSON.stringify({ version: PRESET_FORMAT_VERSION, presets }));
  } catch {
    throw new PresetError('Could not save presets: browser storage is full or unavailable.');
  }
}

/** Returns all saved presets as [{ name, data }]. */
export function loadPresetList() {
  return readStore();
}

/** Save (or overwrite) a preset by name. Throws PresetError on failure. */
export function savePreset(name, data) {
  const clean = cleanName(name);
  if (!clean) throw new PresetError('Enter a preset name.');
  const presets = readStore();
  const settings = sanitizeSettings(data).settings;
  const idx = presets.findIndex(p => p.name === clean);
  if (idx >= 0) {
    presets[idx].data = settings;
  } else {
    if (presets.length >= MAX_PRESETS) {
      throw new PresetError(`Preset limit reached (${MAX_PRESETS}). Delete one first.`);
    }
    presets.push({ name: clean, data: settings });
  }
  writeStore(presets);
}

/** Delete a preset by name. */
export function deletePreset(name) {
  writeStore(readStore().filter(p => p.name !== name));
}

/** Rename a preset. Returns false if the new name is empty or already exists. */
export function renamePreset(oldName, newName) {
  const clean = cleanName(newName);
  if (!clean) return false;
  const presets = readStore();
  if (presets.some(p => p.name === clean)) return false;
  const preset = presets.find(p => p.name === oldName);
  if (preset) {
    preset.name = clean;
    writeStore(presets);
  }
  return true;
}

/** Export all presets as a versioned JSON string. */
export function exportPresets() {
  return JSON.stringify({ version: PRESET_FORMAT_VERSION, presets: readStore() }, null, 2);
}

/**
 * Import presets from a JSON string. Merges by name (overwrites duplicates).
 * Throws PresetError for unreadable input; invalid entries are skipped.
 * @returns {{ imported: number, skipped: number, adjusted: number }}
 */
export function importPresets(jsonString) {
  if (typeof jsonString !== 'string' || jsonString.length > MAX_IMPORT_BYTES) {
    throw new PresetError('File is too large to import.');
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new PresetError('File is not valid JSON.');
  }

  const incoming = normalizePresets(parsed);
  const presets = readStore();
  let imported = 0;
  let skipped = incoming.skipped;

  for (const item of incoming.presets) {
    const idx = presets.findIndex(p => p.name === item.name);
    if (idx >= 0) {
      presets[idx].data = item.data;
    } else if (presets.length < MAX_PRESETS) {
      presets.push(item);
    } else {
      skipped++;
      continue;
    }
    imported++;
  }

  if (imported > 0) writeStore(presets);
  return { imported, skipped, adjusted: incoming.adjusted };
}
