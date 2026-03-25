<script>
  import CollapsibleSection from './CollapsibleSection.svelte';
  import Slider from './Slider.svelte';
  import Presets from './Presets.svelte';

  let {
    // Pen input
    penSpeed = $bindable(),
    pathType = $bindable(),
    showPen = $bindable(),
    // Pointer
    pointerLatency = $bindable(),
    pointerSmoothing = $bindable(),
    reportRate = $bindable(),
    showLabels = $bindable(),
    showTracks = $bindable(),
    showCircles = $bindable(),
    showPointer = $bindable(),
    pointerStyle = $bindable(),
    pointerSize = $bindable(),
    // Brush
    brushLatency = $bindable(),
    brushSmoothing = $bindable(),
    // Brush engine
    brushSize = $bindable(),
    brushSpacing = $bindable(),
    brushTrailLength = $bindable(),
    showBrushStroke = $bindable(),
    smoothStroke = $bindable(),
    // Screen
    screenMode = $bindable(),
    screenResolution = $bindable(),
    screenRefreshRate = $bindable(),
    screenResponseTime = $bindable(),
    showPixelGrid = $bindable(),
    screenAntiAlias = $bindable(),
    aspectRatio = $bindable(),
    // Actions
    getCurrentSettings,
    onLoadPreset,
  } = $props();
</script>

<div class="side-panel">
  <CollapsibleSection title="PEN" open={false}>
    {#snippet headerExtra()}
      <input type="checkbox" bind:checked={showPen} class="header-checkbox">
    {/snippet}
    <Slider label="Speed" min={0.5} max={10} step={0.5} bind:value={penSpeed} />
    <div class="select-row">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Path</label>
      <select bind:value={pathType}>
        <option value="lissajous">Lissajous</option>
        <option value="circle">Circle</option>
        <option value="star">Star</option>
      </select>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="TABLET" open={false}>
    <Slider label="Latency" min={0} max={80} bind:value={pointerLatency} />
    <Slider label="Smoothing" min={0} max={50} bind:value={pointerSmoothing} />
    <Slider label="Report Rate (Hz)" min={1} max={60} bind:value={reportRate} />
  </CollapsibleSection>

  <CollapsibleSection title="OS POINTER" open={false}>
    {#snippet headerExtra()}
      <input type="checkbox" bind:checked={showPointer} class="header-checkbox">
    {/snippet}
    <div class="select-row">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Style</label>
      <select bind:value={pointerStyle}>
        <option value="mouse">Mouse</option>
        <option value="crosshair">Crosshair</option>
      </select>
    </div>
    <div class="select-row">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Size</label>
      <select bind:value={pointerSize}>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
        <option value={8}>8x</option>
      </select>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="BRUSH" open={false}>
    {#snippet headerExtra()}
      <input type="checkbox" bind:checked={showBrushStroke} class="header-checkbox">
    {/snippet}
    <Slider label="Latency" min={0} max={80} bind:value={brushLatency} />
    <Slider label="Smoothing" min={0} max={50} bind:value={brushSmoothing} />
    <Slider label="Size" min={1} max={30} step={1} bind:value={brushSize} />
    <Slider label="Spacing" min={0} max={50} bind:value={brushSpacing} />
    <Slider label="Trail Length" min={5} max={300} step={5} bind:value={brushTrailLength} />
    <label class="checkbox-single"><input type="checkbox" bind:checked={smoothStroke}> Use splines</label>
  </CollapsibleSection>

  <CollapsibleSection title="DISPLAY" open={false}>
    <div class="select-row">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Aspect Ratio</label>
      <select bind:value={aspectRatio}>
        <option value="16:9">16:9</option>
        <option value="16:10">16:10</option>
        <option value="4:3">4:3</option>
        <option value="1:1">1:1</option>
      </select>
    </div>
    <label class="checkbox-single"><input type="checkbox" bind:checked={screenMode}> Screen mode</label>
    {#if screenMode}
      <Slider label="Resolution (px)" min={80} max={320} step={10} bind:value={screenResolution} />
      <Slider label="Refresh Rate (Hz)" min={10} max={144} bind:value={screenRefreshRate} />
      <Slider label="Response Time (ms)" min={1} max={200} bind:value={screenResponseTime} />
      <div class="checkbox-row">
        <label><input type="checkbox" bind:checked={showPixelGrid}> Grid</label>
        <label><input type="checkbox" bind:checked={screenAntiAlias}> AA</label>
      </div>
    {/if}
  </CollapsibleSection>

  <CollapsibleSection title="PRESETS" open={false}>
    <Presets {getCurrentSettings} {onLoadPreset} />
  </CollapsibleSection>

  <CollapsibleSection title="VIEW" open={false}>
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={showLabels}> Labels</label>
      <label><input type="checkbox" bind:checked={showTracks}> Tracks</label>
      <label><input type="checkbox" bind:checked={showCircles}> Circles</label>
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
