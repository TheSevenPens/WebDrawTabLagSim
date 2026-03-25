<script>
  let { title, open = true, children } = $props();
  let isOpen = $state(open);
</script>

<div class="section" class:collapsed={!isOpen}>
  <button class="section-header" onclick={() => isOpen = !isOpen}>
    <span class="arrow">{isOpen ? '▼' : '▶'}</span>
    <span class="title">{title}</span>
  </button>
  {#if isOpen}
    <div class="section-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 0;
    background: none;
    border: none;
    color: inherit;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
  }
  .section-header:hover {
    color: #f0a050;
  }
  .arrow {
    font-size: 0.65rem;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }
  .section-body {
    padding: 0 0 10px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>
