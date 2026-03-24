<script>
  let { label, min = 0, max = 100, value = $bindable() } = $props();
</script>

<div class="slider-group">
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label>{label}</label>
  <input type="range" {min} {max} bind:value={value}>
  <span class="value">{value}</span>
</div>

<style>
  .slider-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .slider-group label {
    font-size: 0.85rem;
    font-weight: 600;
  }
  .value {
    font-size: 0.75rem;
    color: #aaa;
  }
  input[type="range"] {
    width: 200px;
    accent-color: #e07040;
  }
</style>
