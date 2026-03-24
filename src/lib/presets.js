const STORAGE_KEY = 'lag-viz-presets';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/** Returns all saved presets as [{ name, data }]. */
export function loadPresetList() {
  return readStore();
}

/** Save (or overwrite) a preset by name. */
export function savePreset(name, data) {
  const presets = readStore();
  const idx = presets.findIndex(p => p.name === name);
  if (idx >= 0) {
    presets[idx].data = data;
  } else {
    presets.push({ name, data });
  }
  writeStore(presets);
}

/** Delete a preset by name. */
export function deletePreset(name) {
  const presets = readStore().filter(p => p.name !== name);
  writeStore(presets);
}

/** Rename a preset. Returns false if newName already exists. */
export function renamePreset(oldName, newName) {
  const presets = readStore();
  if (presets.some(p => p.name === newName)) return false;
  const preset = presets.find(p => p.name === oldName);
  if (preset) {
    preset.name = newName;
    writeStore(presets);
  }
  return true;
}

/** Export all presets as a JSON string. */
export function exportPresets() {
  return JSON.stringify(readStore(), null, 2);
}

/** Import presets from a JSON string. Merges by name (overwrites duplicates). Returns count imported. */
export function importPresets(jsonString) {
  const incoming = JSON.parse(jsonString);
  if (!Array.isArray(incoming)) throw new Error('Invalid preset format');
  const presets = readStore();
  let count = 0;
  for (const item of incoming) {
    if (!item.name || !item.data) continue;
    const idx = presets.findIndex(p => p.name === item.name);
    if (idx >= 0) {
      presets[idx].data = item.data;
    } else {
      presets.push({ name: item.name, data: item.data });
    }
    count++;
  }
  writeStore(presets);
  return count;
}
