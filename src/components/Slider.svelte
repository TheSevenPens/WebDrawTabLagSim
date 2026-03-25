<script>
  let { label, min = 0, max = 100, step = 1, value = $bindable() } = $props();
</script>

<div class="slider-group">
  <div class="label-row">
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label>{label}</label>
    <span class="value">{value}</span>
  </div>
  <input type="range" {min} {max} {step} bind:value={value}>
</div>

<style>
  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }
  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .label-row label {
    font-size: 0.78rem;
    font-weight: 600;
  }
  .value {
    font-size: 0.72rem;
    color: #aaa;
  }
  input[type="range"] {
    width: 100%;
    accent-color: #7089a8;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    background: #4a4a4a;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #7089a8;
    cursor: pointer;
  }
  input[type="range"]::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: #4a4a4a;
  }
  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #7089a8;
    border: none;
    cursor: pointer;
  }
</style>
