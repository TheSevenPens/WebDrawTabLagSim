<script>
  import LatencySmoothing from './LatencySmoothing.svelte';
  import Slider from './Slider.svelte';

  let {
    pointerLatency = $bindable(),
    pointerSmoothing = $bindable(),
    brushLatency = $bindable(),
    brushSmoothing = $bindable(),
    penSpeed = $bindable(),
    pathType = $bindable(),
    brushSize = $bindable(),
    reportRate = $bindable(),
    brushSpacing = $bindable(),
    brushTrailLength = $bindable(),
    screenMode,
    screenResolution = $bindable(),
    screenRefreshRate = $bindable(),
    screenResponseTime = $bindable(),
  } = $props();
</script>

<div class="controls">
  <div class="control-group">
    <div class="group-title">User Input</div>
    <Slider label="Pen Speed" min={0.5} max={10} step={0.5} bind:value={penSpeed} />
    <div class="path-select">
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <label>Path</label>
      <select bind:value={pathType}>
        <option value="lissajous">Lissajous</option>
        <option value="circle">Circle</option>
        <option value="star">Star</option>
      </select>
    </div>
  </div>
  <div class="control-group">
    <LatencySmoothing
      label="Pointer (a → b)"
      bind:latency={pointerLatency}
      bind:smoothing={pointerSmoothing}
    />
    <Slider label="Report Rate (Hz)" min={1} max={60} step={1} bind:value={reportRate} />
  </div>
  <LatencySmoothing
    label="Brush (b → c)"
    bind:latency={brushLatency}
    bind:smoothing={brushSmoothing}
  />
  <div class="control-group">
    <div class="group-title">Brush Engine</div>
    <Slider label="Brush Size" min={0.1} max={3} step={0.1} bind:value={brushSize} />
    <Slider label="Brush Spacing" min={0} max={50} step={1} bind:value={brushSpacing} />
    <Slider label="Brush Trail" min={5} max={300} step={5} bind:value={brushTrailLength} />
  </div>
  {#if screenMode}
    <div class="control-group">
      <div class="group-title">Display</div>
      <Slider label="Resolution (px)" min={80} max={320} step={10} bind:value={screenResolution} />
      <Slider label="Refresh Rate (Hz)" min={10} max={144} step={1} bind:value={screenRefreshRate} />
      <Slider label="Response Time (ms)" min={1} max={50} step={1} bind:value={screenResponseTime} />
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    gap: 32px;
    align-items: flex-start;
    margin-top: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .group-title {
    font-size: 0.9rem;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .path-select {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .path-select label {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .path-select select {
    font-size: 0.8rem;
    font-family: inherit;
    padding: 2px 4px;
  }
</style>
