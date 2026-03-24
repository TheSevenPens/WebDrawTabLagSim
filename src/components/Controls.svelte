<script>
  import LatencySmoothing from './LatencySmoothing.svelte';
  import Slider from './Slider.svelte';

  let {
    pointerLatency = $bindable(),
    pointerSmoothing = $bindable(),
    brushLatency = $bindable(),
    brushSmoothing = $bindable(),
    penSpeed = $bindable(),
  } = $props();
</script>

<div class="controls">
  <LatencySmoothing
    label="Pointer (a → b)"
    bind:latency={pointerLatency}
    bind:smoothing={pointerSmoothing}
  />
  <LatencySmoothing
    label="Brush (b → c)"
    bind:latency={brushLatency}
    bind:smoothing={brushSmoothing}
  />
  <Slider label="Pen Speed" min={0.5} max={10} step={0.5} bind:value={penSpeed} />
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
</style>
