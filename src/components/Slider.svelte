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
    gap: 2px;
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
    accent-color: #e07040;
  }
</style>
