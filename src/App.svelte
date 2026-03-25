<script>
  import TopPanel from './components/TopPanel.svelte';
  import Canvas from './components/Canvas.svelte';
  import SidePanel from './components/SidePanel.svelte';

  // Lag parameters
  let pointerLatency = $state(25);
  let pointerSmoothing = $state(0);
  let brushLatency = $state(35);
  let brushSmoothing = $state(0);
  let penSpeed = $state(3);
  let pathType = $state('lissajous');
  let brushSize = $state(4);
  let reportRate = $state(60);
  let brushSpacing = $state(0);
  let smoothStroke = $state(false);
  let brushTrailLength = $state(180);

  // Visibility toggles
  let showPen = $state(true);
  let showLabels = $state(true);
  let showTracks = $state(true);
  let showCircles = $state(true);
  let showPointer = $state(true);
  let pointerStyle = $state('mouse');
  let pointerSize = $state(1);
  let showBrushStroke = $state(true);

  // Screen simulation
  let screenMode = $state(false);
  let screenResolution = $state(160);
  let screenRefreshRate = $state(60);
  let screenResponseTime = $state(5);
  let showPixelGrid = $state(false);
  let screenAntiAlias = $state(true);
  let aspectRatio = $state('16:9');

  // Playback
  let paused = $state(false);
  let frozen = $state(false);

  // Restart key — incrementing forces Canvas to re-mount
  let restartKey = $state(0);
  let prevPathType = pathType;

  // Auto-restart when path type changes
  $effect(() => {
    if (pathType !== prevPathType) {
      prevPathType = pathType;
      restartKey++;
    }
  });

  function restartAnimation() {
    restartKey++;
  }

  function resetAll() {
    pointerLatency = 25;
    pointerSmoothing = 0;
    brushLatency = 35;
    brushSmoothing = 0;
    penSpeed = 3;
    pathType = 'lissajous';
    brushSize = 4;
    reportRate = 60;
    brushSpacing = 0;
    smoothStroke = false;
    brushTrailLength = 180;
    showPen = true;
    showLabels = true;
    showTracks = true;
    showCircles = true;
    showPointer = true;
    pointerStyle = 'mouse';
    pointerSize = 1;
    showBrushStroke = true;
    screenMode = false;
    screenResolution = 160;
    screenRefreshRate = 60;
    screenResponseTime = 5;
    showPixelGrid = false;
    screenAntiAlias = true;
    aspectRatio = '16:9';
    restartKey++;
  }

  function getCurrentSettings() {
    return {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
      penSpeed, pathType, brushSize, reportRate, brushSpacing,
      smoothStroke, brushTrailLength,
      showPen, showLabels, showTracks, showCircles,
      showPointer, pointerStyle, pointerSize, showBrushStroke,
      screenMode, screenResolution, screenRefreshRate, screenResponseTime,
      showPixelGrid, screenAntiAlias, aspectRatio,
    };
  }

  function loadPreset(d) {
    if (d.pointerLatency != null) pointerLatency = d.pointerLatency;
    if (d.pointerSmoothing != null) pointerSmoothing = d.pointerSmoothing;
    if (d.brushLatency != null) brushLatency = d.brushLatency;
    if (d.brushSmoothing != null) brushSmoothing = d.brushSmoothing;
    if (d.penSpeed != null) penSpeed = d.penSpeed;
    if (d.pathType != null) pathType = d.pathType;
    if (d.brushSize != null) brushSize = d.brushSize;
    if (d.reportRate != null) reportRate = d.reportRate;
    if (d.brushSpacing != null) brushSpacing = d.brushSpacing;
    if (d.smoothStroke != null) smoothStroke = d.smoothStroke;
    if (d.brushTrailLength != null) brushTrailLength = d.brushTrailLength;
    if (d.showPen != null) showPen = d.showPen;
    if (d.showLabels != null) showLabels = d.showLabels;
    if (d.showTracks != null) showTracks = d.showTracks;
    if (d.showCircles != null) showCircles = d.showCircles;
    if (d.showPointer != null) showPointer = d.showPointer;
    if (d.pointerStyle != null) pointerStyle = d.pointerStyle;
    if (d.pointerSize != null) pointerSize = d.pointerSize;
    if (d.showBrushStroke != null) showBrushStroke = d.showBrushStroke;
    if (d.screenMode != null) screenMode = d.screenMode;
    if (d.screenResolution != null) screenResolution = d.screenResolution;
    if (d.screenRefreshRate != null) screenRefreshRate = d.screenRefreshRate;
    if (d.screenResponseTime != null) screenResponseTime = d.screenResponseTime;
    if (d.showPixelGrid != null) showPixelGrid = d.showPixelGrid;
    if (d.screenAntiAlias != null) screenAntiAlias = d.screenAntiAlias;
    if (d.aspectRatio != null) aspectRatio = d.aspectRatio;
    restartKey++;
  }
</script>

<TopPanel onRestart={restartAnimation} onResetAll={resetAll} bind:paused bind:frozen />

<div class="main-row">
  <SidePanel
    bind:penSpeed bind:pathType bind:showPen
    bind:pointerLatency bind:pointerSmoothing bind:reportRate
    bind:showLabels bind:showTracks bind:showCircles
    bind:showPointer bind:pointerStyle bind:pointerSize
    bind:brushLatency bind:brushSmoothing
    bind:brushSize bind:brushSpacing bind:brushTrailLength
    bind:showBrushStroke bind:smoothStroke
    bind:screenMode bind:screenResolution bind:screenRefreshRate
    bind:screenResponseTime bind:showPixelGrid
    bind:screenAntiAlias
    bind:aspectRatio
    {getCurrentSettings}
    onLoadPreset={loadPreset}
  />
  {#key restartKey}
    <Canvas
      {pointerLatency} {pointerSmoothing}
      {brushLatency} {brushSmoothing}
      {penSpeed}
      {showPen} {showLabels} {showTracks} {showCircles}
      {showPointer} {pointerStyle} {pointerSize}
      {showBrushStroke}
      {pathType}
      {brushSize}
      {reportRate}
      {brushSpacing}
      {smoothStroke}
      {brushTrailLength}
      {screenMode}
      {screenResolution}
      {screenRefreshRate}
      {screenResponseTime}
      {showPixelGrid}
      {screenAntiAlias}
      {aspectRatio}
      {paused}
      {frozen}
    />
  {/key}
</div>

<style>
  .main-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
</style>
