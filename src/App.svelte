<script>
  import TopPanel from './components/TopPanel.svelte';
  import Canvas from './components/Canvas.svelte';
  import SidePanel from './components/SidePanel.svelte';
  import { DEFAULT_SETTINGS, sanitizeSettings } from '$lib/settings.js';

  // All user settings live in one object; SETTINGS in settings.js defines each one
  let settings = $state({ ...DEFAULT_SETTINGS });

  // Playback
  let penStopped = $state(false);
  let simPaused = $state(false);

  // Restart key — incrementing forces Canvas to re-mount
  let restartKey = $state(0);
  let prevPathType = DEFAULT_SETTINGS.pathType;

  // Auto-restart when path type changes
  $effect(() => {
    if (settings.pathType !== prevPathType) {
      prevPathType = settings.pathType;
      restartKey++;
    }
  });

  function restartAnimation() {
    restartKey++;
  }

  function resetAll() {
    Object.assign(settings, DEFAULT_SETTINGS);
    restartKey++;
  }

  function getCurrentSettings() {
    return $state.snapshot(settings);
  }

  // Preset data is validated on read; sanitizing again keeps this safe for any caller
  function loadPreset(data) {
    Object.assign(settings, sanitizeSettings(data).settings);
    restartKey++;
  }
</script>

<TopPanel onRestart={restartAnimation} onResetAll={resetAll} bind:penStopped bind:simPaused />

<main class="main-row">
  <SidePanel bind:settings {getCurrentSettings} onLoadPreset={loadPreset} />
  {#key restartKey}
    <Canvas {...settings} {penStopped} {simPaused} />
  {/key}
</main>

<style>
  .main-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    width: 100%;
  }

  /* Narrow windows: controls above the canvas instead of beside it */
  @media (max-width: 860px) {
    .main-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
