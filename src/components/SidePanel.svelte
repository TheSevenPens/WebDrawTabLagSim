<script>
  import CollapsibleSection from './CollapsibleSection.svelte';
  import Slider from './Slider.svelte';
  import Presets from './Presets.svelte';

  let {
    // Pen input
    penSpeed = $bindable(),
    pathType = $bindable(),
    // Pointer
    pointerLatency = $bindable(),
    pointerSmoothing = $bindable(),
    reportRate = $bindable(),
    showA = $bindable(),
    showTrackA = $bindable(),
    showCircleA = $bindable(),
    showPointer = $bindable(),
    pointerStyle = $bindable(),
    showB = $bindable(),
    showTrackB = $bindable(),
    showCircleB = $bindable(),
    // Brush
    brushLatency = $bindable(),
    brushSmoothing = $bindable(),
    showC = $bindable(),
    showTrackC = $bindable(),
    showCircleC = $bindable(),
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
    showIpsGlow = $bindable(),
    screenAntiAlias = $bindable(),
    // Actions
    onRestart,
    onResetAll,
    getCurrentSettings,
    onLoadPreset,
  } = $props();
</script>

<div class="side-panel">
  <CollapsibleSection title="USER INPUT" open={false}>
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
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={showA}> Label</label>
      <label><input type="checkbox" bind:checked={showTrackA}> Track</label>
      <label><input type="checkbox" bind:checked={showCircleA}> Circle</label>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="POINTER (a → b)" open={false}>
    <Slider label="Latency" min={0} max={80} bind:value={pointerLatency} />
    <Slider label="Smoothing" min={0} max={50} bind:value={pointerSmoothing} />
    <Slider label="Report Rate (Hz)" min={1} max={60} bind:value={reportRate} />
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={showPointer}> Pointer</label>
      <label><input type="checkbox" bind:checked={showB}> Label</label>
    </div>
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={showTrackB}> Track</label>
      <label><input type="checkbox" bind:checked={showCircleB}> Circle</label>
    </div>
    {#if showPointer}
      <div class="select-row">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>Style</label>
        <select bind:value={pointerStyle}>
          <option value="mouse">Mouse</option>
          <option value="crosshair">Crosshair</option>
        </select>
      </div>
    {/if}
  </CollapsibleSection>

  <CollapsibleSection title="BRUSH (b → c)" open={false}>
    <Slider label="Latency" min={0} max={80} bind:value={brushLatency} />
    <Slider label="Smoothing" min={0} max={50} bind:value={brushSmoothing} />
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={showC}> Label</label>
      <label><input type="checkbox" bind:checked={showTrackC}> Track</label>
      <label><input type="checkbox" bind:checked={showCircleC}> Circle</label>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="BRUSH ENGINE" open={false}>
    <Slider label="Size" min={0.1} max={3} step={0.1} bind:value={brushSize} />
    <Slider label="Spacing" min={0} max={50} bind:value={brushSpacing} />
    <Slider label="Trail Length" min={5} max={300} step={5} bind:value={brushTrailLength} />
    <div class="checkbox-row">
      <label><input type="checkbox" bind:checked={showBrushStroke}> Stroke</label>
      <label><input type="checkbox" bind:checked={smoothStroke}> Smooth</label>
    </div>
  </CollapsibleSection>

  <CollapsibleSection title="DISPLAY" open={false}>
    <label class="checkbox-single"><input type="checkbox" bind:checked={screenMode}> Screen mode</label>
    {#if screenMode}
      <Slider label="Resolution (px)" min={80} max={320} step={10} bind:value={screenResolution} />
      <Slider label="Refresh Rate (Hz)" min={10} max={144} bind:value={screenRefreshRate} />
      <Slider label="Response Time (ms)" min={1} max={200} bind:value={screenResponseTime} />
      <div class="checkbox-row">
        <label><input type="checkbox" bind:checked={showPixelGrid}> Grid</label>
        <label><input type="checkbox" bind:checked={showIpsGlow}> Glow</label>
        <label><input type="checkbox" bind:checked={screenAntiAlias}> AA</label>
      </div>
    {/if}
  </CollapsibleSection>

  <CollapsibleSection title="PRESETS" open={false}>
    <Presets {getCurrentSettings} {onLoadPreset} />
  </CollapsibleSection>

  <div class="buttons">
    <button onclick={onRestart}>Restart</button>
    <button onclick={onResetAll}>Reset All</button>
  </div>
</div>

<style>
  .side-panel {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    min-width: 230px;
    max-width: 260px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
  }
  .checkbox-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .checkbox-row label, .checkbox-single {
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
    padding: 2px 4px;
  }
  .buttons {
    display: flex;
    gap: 8px;
    padding: 10px 0;
  }
  .buttons button {
    font-size: 0.78rem;
    font-family: inherit;
    font-weight: 600;
    padding: 4px 10px;
    border: 1px solid #666;
    border-radius: 4px;
    background: #444;
    color: #ddd;
    cursor: pointer;
  }
  .buttons button:hover {
    background: #555;
  }
</style>
