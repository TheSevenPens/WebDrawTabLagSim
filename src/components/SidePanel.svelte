<script>
  let {
    showA = $bindable(),
    showB = $bindable(),
    showC = $bindable(),
    showPointer = $bindable(),
    pointerStyle = $bindable(),
    showTrackA = $bindable(),
    showTrackB = $bindable(),
    showTrackC = $bindable(),
    showCircleA = $bindable(),
    showCircleB = $bindable(),
    showCircleC = $bindable(),
    showBrushStroke = $bindable(),
    smoothStroke = $bindable(),
    screenMode = $bindable(),
    showPixelGrid = $bindable(),
    showIpsGlow = $bindable(),
  } = $props();
</script>

<div class="side-panel">
  <div class="legend">
    <div>a: pen tip</div>
    <div>b: OS pointer</div>
    <div>c: brush stroke</div>
    <div class="legend-spacer"></div>
    <div>a → b = pointer latency + smoothing</div>
    <div>b → c = brush latency + smoothing</div>
  </div>
  <div class="checkboxes">
    <label><input type="checkbox" bind:checked={showA}> Label a</label>
    <label><input type="checkbox" bind:checked={showB}> Label b</label>
    <label><input type="checkbox" bind:checked={showC}> Label c</label>
    <label><input type="checkbox" bind:checked={showPointer}> OS pointer</label>
    <label class="pointer-style-label">
      <select bind:value={pointerStyle}>
        <option value="mouse">Mouse</option>
        <option value="crosshair">Crosshair</option>
      </select>
    </label>
    <label><input type="checkbox" bind:checked={showTrackA}> Track a</label>
    <label><input type="checkbox" bind:checked={showTrackB}> Track b</label>
    <label><input type="checkbox" bind:checked={showTrackC}> Track c</label>
    <label><input type="checkbox" bind:checked={showCircleA}> Circle a</label>
    <label><input type="checkbox" bind:checked={showCircleB}> Circle b</label>
    <label><input type="checkbox" bind:checked={showCircleC}> Circle c</label>
    <label><input type="checkbox" bind:checked={showBrushStroke}> Brush stroke</label>
    <label><input type="checkbox" bind:checked={smoothStroke}> Smooth stroke</label>
    <div class="legend-spacer"></div>
    <label><input type="checkbox" bind:checked={screenMode}> Screen mode</label>
    {#if screenMode}
      <label><input type="checkbox" bind:checked={showPixelGrid}> Pixel grid</label>
      <label><input type="checkbox" bind:checked={showIpsGlow}> IPS glow</label>
    {/if}
  </div>
</div>

<style>
  .side-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 10px 0;
  }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #aaa;
    white-space: nowrap;
  }
  .legend-spacer {
    height: 6px;
  }
  .checkboxes {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .checkboxes label {
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .pointer-style-label {
    padding-left: 16px;
  }
  select {
    font-size: 0.8rem;
    font-family: inherit;
  }
</style>
