<script>
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
  <Slider label="Pointer Latency (a → b)" min={0} max={80} bind:value={pointerLatency} />
  <Slider label="Pointer Smoothing" min={0} max={50} bind:value={pointerSmoothing} />
  <Slider label="Brush Latency (b → c)" min={0} max={80} bind:value={brushLatency} />
  <Slider label="Brush Smoothing" min={0} max={50} bind:value={brushSmoothing} />
  <Slider label="Pen Speed" min={1} max={100} bind:value={penSpeed} />
</div>

<style>
  .controls {
    display: flex;
    gap: 32px;
    align-items: center;
    margin-top: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
