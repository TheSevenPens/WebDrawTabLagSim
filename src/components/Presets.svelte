<script>
  import {
    loadPresetList, savePreset, deletePreset,
    renamePreset, exportPresets, importPresets,
  } from '$lib/presets.js';

  let { getCurrentSettings, onLoadPreset } = $props();

  let presets = $state(loadPresetList());
  let saveName = $state('');
  let editingIdx = $state(-1);
  let editName = $state('');
  let fileInput;

  function refresh() {
    presets = loadPresetList();
  }

  function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    savePreset(name, getCurrentSettings());
    saveName = '';
    refresh();
  }

  function handleLoad(preset) {
    onLoadPreset(preset.data);
  }

  function handleDelete(name) {
    deletePreset(name);
    refresh();
  }

  function startRename(idx) {
    editingIdx = idx;
    editName = presets[idx].name;
  }

  function commitRename(oldName) {
    const newName = editName.trim();
    if (newName && newName !== oldName) {
      const ok = renamePreset(oldName, newName);
      if (!ok) {
        editingIdx = -1;
        return;
      }
    }
    editingIdx = -1;
    refresh();
  }

  function handleExport() {
    const json = exportPresets();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lag-viz-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    fileInput.click();
  }

  function onFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPresets(reader.result);
        refresh();
      } catch {
        // invalid JSON — silently ignore
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleKeydown(e, oldName) {
    if (e.key === 'Enter') commitRename(oldName);
    if (e.key === 'Escape') editingIdx = -1;
  }
</script>

<div class="presets">
  <div class="save-row">
    <input
      type="text"
      placeholder="Preset name"
      bind:value={saveName}
      onkeydown={(e) => e.key === 'Enter' && handleSave()}
    >
    <button onclick={handleSave} disabled={!saveName.trim()}>Save</button>
  </div>

  {#if presets.length > 0}
    <div class="preset-list">
      {#each presets as preset, i}
        <div class="preset-item">
          {#if editingIdx === i}
            <input
              type="text"
              class="rename-input"
              bind:value={editName}
              onkeydown={(e) => handleKeydown(e, preset.name)}
              onblur={() => commitRename(preset.name)}
            >
          {:else}
            <button class="preset-name" onclick={() => handleLoad(preset)} title="Load preset">
              {preset.name}
            </button>
            <button class="icon-btn" onclick={() => startRename(i)} title="Rename">&#9998;</button>
            <button class="icon-btn delete-btn" onclick={() => handleDelete(preset.name)} title="Delete">&times;</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="io-row">
    <button onclick={handleExport} disabled={presets.length === 0}>Export</button>
    <button onclick={handleImport}>Import</button>
    <input
      type="file"
      accept=".json"
      bind:this={fileInput}
      onchange={onFileSelected}
      style="display:none"
    >
  </div>
</div>

<style>
  .presets {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .save-row {
    display: flex;
    gap: 4px;
  }
  .save-row input {
    width: 100px;
    font-size: 0.75rem;
    font-family: inherit;
    padding: 3px 6px;
    border: 1px solid #555;
    border-radius: 3px;
    background: #333;
    color: #ddd;
  }
  .save-row button, .io-row button {
    font-size: 0.72rem;
    font-family: inherit;
    font-weight: 600;
    padding: 3px 8px;
    border: 1px solid #666;
    border-radius: 3px;
    background: #444;
    color: #ddd;
    cursor: pointer;
  }
  .save-row button:hover, .io-row button:hover {
    background: #555;
  }
  .save-row button:disabled, .io-row button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 120px;
    overflow-y: auto;
  }
  .preset-item {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .preset-name {
    flex: 1;
    text-align: left;
    font-size: 0.75rem;
    font-family: inherit;
    font-weight: 600;
    padding: 2px 6px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: #ccc;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .preset-name:hover {
    background: #444;
  }
  .icon-btn {
    font-size: 0.8rem;
    padding: 1px 4px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: #888;
    cursor: pointer;
  }
  .icon-btn:hover {
    background: #444;
    color: #ccc;
  }
  .delete-btn:hover {
    color: #e55;
  }
  .rename-input {
    flex: 1;
    font-size: 0.75rem;
    font-family: inherit;
    padding: 2px 6px;
    border: 1px solid #888;
    border-radius: 3px;
    background: #333;
    color: #ddd;
  }
  .io-row {
    display: flex;
    gap: 4px;
  }
</style>
