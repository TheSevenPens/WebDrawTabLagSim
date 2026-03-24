<script>
  let { label, min = 0, max = 100, step = 1, value = $bindable() } = $props();
</script>

<div class="slider-group">
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label>{label}</label>
  <div class="slider-row">
    <input type="range" {min} {max} {step} bind:value={value}>
    <span class="value">{value}</span>
  </div>
</div>

<style>
  .slider-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .slider-group label {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .value {
    font-size: 0.75rem;
    color: #aaa;
    min-width: 24px;
  }
  input[type="range"] {
    width: 160px;
    accent-color: #e07040;
  }
</style>
