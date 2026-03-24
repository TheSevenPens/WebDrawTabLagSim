<script>
  import Slider from './Slider.svelte';

  let {
    label,
    latency = $bindable(),
    smoothing = $bindable(),
    latencyMin = 0,
    latencyMax = 80,
    smoothingMin = 0,
    smoothingMax = 50,
  } = $props();
</script>

<div class="latency-smoothing">
  <span class="group-label">{label}</span>
  <Slider label="Latency" min={latencyMin} max={latencyMax} bind:value={latency} />
  <Slider label="Smoothing" min={smoothingMin} max={smoothingMax} bind:value={smoothing} />
</div>

<style>
  .latency-smoothing {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .group-label {
    font-size: 0.9rem;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
</style>
