<script>
  /**
   * @type {{
   *   title: string,
   *   open?: boolean,
   *   children: import('svelte').Snippet,
   *   headerExtra?: import('svelte').Snippet,
   * }}
   */
  let { title, open = true, children, headerExtra } = $props();
  // `open` only seeds the initial state; later changes to the prop are not tracked
  // svelte-ignore state_referenced_locally
  let isOpen = $state(open);
  const uid = $props.id();
  const bodyId = `${uid}-body`;
</script>

<div class="section" class:collapsed={!isOpen}>
  <div class="section-header-row">
    <button class="section-header" onclick={() => isOpen = !isOpen} aria-expanded={isOpen} aria-controls={bodyId}>
      <span class="arrow" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
      <span class="title">{title}</span>
    </button>
    {#if headerExtra}
      <span class="header-extra">
        {@render headerExtra()}
      </span>
    {/if}
  </div>
  <div class="section-body" id={bodyId} hidden={!isOpen}>
    {@render children()}
  </div>
</div>

<style>
  .section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-extra {
    display: flex;
    align-items: center;
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
  .section-body[hidden] {
    display: none;
  }
  .section-body {
    padding: 0 0 10px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
