<script>
  let { onRestart, onResetAll, paused = $bindable(), frozen = $bindable() } = $props();
</script>

<div class="top-bar">
  <h1>Drawing Tablet Lag Simulator</h1>
  <div class="top-buttons">
    <button class="fixed-btn" onclick={() => frozen = !frozen}>{frozen ? '▶ Play' : '⏸ Pause'}</button>
    <button class="fixed-btn" onclick={() => paused = !paused}>{paused ? '▶ Resume Pen' : '✋ Stop Pen'}</button>
    <button onclick={onRestart}>Restart</button>
    <button onclick={onResetAll}>Reset All</button>
  </div>
</div>

<style>
  .top-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    width: 100%;
  }
  h1 {
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .top-buttons {
    display: flex;
    gap: 8px;
  }
  .top-buttons button {
    font-size: 0.78rem;
    font-family: inherit;
    font-weight: 600;
    padding: 4px 10px;
    border: 1px solid #666;
    border-radius: 4px;
    background: #4a4a4a;
    color: #ccc;
    cursor: pointer;
  }
  .top-buttons button:hover {
    background: #555;
  }
  .fixed-btn {
    min-width: 100px;
    text-align: center;
  }
</style>
