<script>
  import CollapsibleSection from './CollapsibleSection.svelte';
  import Slider from './Slider.svelte';
  import Presets from './Presets.svelte';

  import { SETTINGS } from '$lib/settings.js';

  const uid = $props.id();

  let {
    settings = $bindable(),
    // Actions
    getCurrentSettings,
    onLoadPreset,
  } = $props();

  // min/max/step for a numeric setting
  const range = (key) => {
    const { min, max, step } = SETTINGS[key];
    return { min, max, step };
  };
</script>

<div class="side-panel">
  <CollapsibleSection title="PEN" open={false}>
    {#snippet headerExtra()}
      <input type="checkbox" bind:checked={settings.showPen} class="header-checkbox" aria-label="Show pen">
    {/snippet}
    <Slider label="Speed" {...range('penSpeed')} bind:value={settings.penSpeed} />
    <div class="select-row">
      <label for="{uid}-path">Path</label>
      <select id="{uid}-path" bind:value={settings.pathType}>
        {#each SETTINGS.pathType.options as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="TABLET" open={false}>
    <Slider label="Latency" {...range('pointerLatency')} bind:value={settings.pointerLatency} />
    <Slider label="Smoothing" {...range('pointerSmoothing')} bind:value={settings.pointerSmoothing} />
    <Slider label="Report Rate (Hz)" {...range('reportRate')} bind:value={settings.reportRate} />
  </CollapsibleSection>

  <CollapsibleSection title="OS POINTER" open={false}>
    {#snippet headerExtra()}
      <input type="checkbox" bind:checked={settings.showPointer} class="header-checkbox" aria-label="Show OS pointer">
    {/snippet}
    <div class="select-row">
      <label for="{uid}-pstyle">Style</label>
      <select id="{uid}-pstyle" bind:value={settings.pointerStyle}>
        {#each SETTINGS.pointerStyle.options as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
    <div class="select-row">
      <label for="{uid}-psize">Size</label>
      <select id="{uid}-psize" bind:value={settings.pointerSize}>
        {#each SETTINGS.pointerSize.options as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="BRUSH" open={false}>
    {#snippet headerExtra()}
      <input type="checkbox" bind:checked={settings.showBrushStroke} class="header-checkbox" aria-label="Show brush stroke">
    {/snippet}
    <Slider label="Latency" {...range('brushLatency')} bind:value={settings.brushLatency} />
    <Slider label="Smoothing" {...range('brushSmoothing')} bind:value={settings.brushSmoothing} />
    <Slider label="Size" {...range('brushSize')} bind:value={settings.brushSize} />
    <Slider label="Spacing" {...range('brushSpacing')} bind:value={settings.brushSpacing} />
    <Slider label="Trail Length" {...range('brushTrailLength')} bind:value={settings.brushTrailLength} />
    <label class="checkbox-single"><input type="checkbox" bind:checked={settings.smoothStroke}> Use splines</label>
  </CollapsibleSection>

  <CollapsibleSection title="DISPLAY" open={false}>
    <div class="select-row">
      <label for="{uid}-aspect">Aspect Ratio</label>
      <select id="{uid}-aspect" bind:value={settings.aspectRatio}>
        {#each SETTINGS.aspectRatio.options as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
    <label class="checkbox-single"><input type="checkbox" bind:checked={settings.screenMode}> Screen mode</label>
    {#if settings.screenMode}
      <Slider label="Resolution (px)" {...range('screenResolution')} bind:value={settings.screenResolution} />
      <Slider label="Refresh Rate (Hz)" {...range('screenRefreshRate')} bind:value={settings.screenRefreshRate} />
      <Slider label="Response Time (ms)" {...range('screenResponseTime')} bind:value={settings.screenResponseTime} />
      <div class="checkbox-row">
        <label><input type="checkbox" bind:checked={settings.showPixelGrid}> Grid</label>
        <label><input type="checkbox" bind:checked={settings.screenAntiAlias}> AA</label>
      </div>
    {/if}
  </CollapsibleSection>

  <CollapsibleSection title="PRESETS" open={false}>
    <Presets {getCurrentSettings} {onLoadPreset} />
  </CollapsibleSection>

  <CollapsibleSection title="VIEW" open={false}>
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={settings.showLabels}> Labels</label>
      <label><input type="checkbox" bind:checked={settings.showTracks}> Tracks</label>
      <label><input type="checkbox" bind:checked={settings.showCircles}> Circles</label>
      <label><input type="checkbox" bind:checked={settings.showRates}> Frame rate</label>
    </div>
  </CollapsibleSection>

</div>

<style>
  .side-panel {
    display: flex;
    flex-direction: column;
    padding: 4px 12px 4px 0;
    min-width: 280px;
    max-width: 320px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #555 transparent;
  }
  .side-panel::-webkit-scrollbar {
    width: 6px;
  }
  .side-panel::-webkit-scrollbar-track {
    background: transparent;
  }
  .side-panel::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 3px;
  }
  .checkbox-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .checkbox-row label, .checkbox-single {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .select-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .select-row label {
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .select-row select {
    font-size: 0.78rem;
    font-family: inherit;
    padding: 4px 6px;
    background: #4a4a4a;
    color: #ccc;
    border: 1px solid #5a5a5a;
    border-radius: 4px;
  }
  .select-row select option {
    background: #4a4a4a;
    color: #ccc;
  }
  :global(.header-checkbox) {
    cursor: pointer;
    margin-right: 4px;
  }
</style>
