<script>
  import Canvas from './components/Canvas.svelte';
  import SidePanel from './components/SidePanel.svelte';
  import Controls from './components/Controls.svelte';
  import Presets from './components/Presets.svelte';

  // Lag parameters
  let pointerLatency = $state(25);
  let pointerSmoothing = $state(0);
  let brushLatency = $state(35);
  let brushSmoothing = $state(0);
  let penSpeed = $state(3);
  let pathType = $state('lissajous');
  let brushSize = $state(1);
  let reportRate = $state(60);
  let brushSpacing = $state(0);
  let smoothStroke = $state(false);
  let brushTrailLength = $state(180);

  // Visibility toggles
  let showA = $state(true);
  let showB = $state(true);
  let showC = $state(true);
  let showPointer = $state(true);
  let pointerStyle = $state('mouse');
  let showCircleA = $state(true);
  let showCircleB = $state(true);
  let showCircleC = $state(true);
  let showTrackA = $state(true);
  let showTrackB = $state(true);
  let showTrackC = $state(true);
  let showBrushStroke = $state(true);

  // Screen simulation
  let screenMode = $state(false);
  let screenResolution = $state(160);
  let screenRefreshRate = $state(60);
  let screenResponseTime = $state(5);
  let showPixelGrid = $state(false);
  let showIpsGlow = $state(false);
  let screenAntiAlias = $state(true);

  // Restart key — incrementing forces Canvas to re-mount
  let restartKey = $state(0);

  function restartAnimation() {
    restartKey++;
  }

  function resetAll() {
    // Lag parameters
    pointerLatency = 25;
    pointerSmoothing = 0;
    brushLatency = 35;
    brushSmoothing = 0;
    penSpeed = 3;
    pathType = 'lissajous';
    brushSize = 1;
    reportRate = 60;
    brushSpacing = 0;
    smoothStroke = false;
    brushTrailLength = 180;

    // Visibility toggles
    showA = true;
    showB = true;
    showC = true;
    showPointer = true;
    pointerStyle = 'mouse';
    showCircleA = true;
    showCircleB = true;
    showCircleC = true;
    showTrackA = true;
    showTrackB = true;
    showTrackC = true;
    showBrushStroke = true;

    // Screen simulation
    screenMode = false;
    screenResolution = 160;
    screenRefreshRate = 60;
    screenResponseTime = 5;
    showPixelGrid = false;
    showIpsGlow = false;
    screenAntiAlias = true;

    // Restart animation
    restartKey++;
  }

  function getCurrentSettings() {
    return {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
      penSpeed, pathType, brushSize, reportRate, brushSpacing,
      smoothStroke, brushTrailLength,
      showA, showB, showC, showPointer, pointerStyle,
      showCircleA, showCircleB, showCircleC,
      showTrackA, showTrackB, showTrackC, showBrushStroke,
      screenMode, screenResolution, screenRefreshRate, screenResponseTime,
      showPixelGrid, showIpsGlow, screenAntiAlias,
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
    if (d.showA != null) showA = d.showA;
    if (d.showB != null) showB = d.showB;
    if (d.showC != null) showC = d.showC;
    if (d.showPointer != null) showPointer = d.showPointer;
    if (d.pointerStyle != null) pointerStyle = d.pointerStyle;
    if (d.showCircleA != null) showCircleA = d.showCircleA;
    if (d.showCircleB != null) showCircleB = d.showCircleB;
    if (d.showCircleC != null) showCircleC = d.showCircleC;
    if (d.showTrackA != null) showTrackA = d.showTrackA;
    if (d.showTrackB != null) showTrackB = d.showTrackB;
    if (d.showTrackC != null) showTrackC = d.showTrackC;
    if (d.showBrushStroke != null) showBrushStroke = d.showBrushStroke;
    if (d.screenMode != null) screenMode = d.screenMode;
    if (d.screenResolution != null) screenResolution = d.screenResolution;
    if (d.screenRefreshRate != null) screenRefreshRate = d.screenRefreshRate;
    if (d.screenResponseTime != null) screenResponseTime = d.screenResponseTime;
    if (d.showPixelGrid != null) showPixelGrid = d.showPixelGrid;
    if (d.showIpsGlow != null) showIpsGlow = d.showIpsGlow;
    if (d.screenAntiAlias != null) screenAntiAlias = d.screenAntiAlias;
    restartKey++;
  }
</script>

<h1>Drawing Tablet Lag Visualizer</h1>

<div class="main-row">
  <SidePanel
    bind:showA bind:showB bind:showC
    bind:showPointer bind:pointerStyle
    bind:showTrackA bind:showTrackB bind:showTrackC
    bind:showCircleA bind:showCircleB bind:showCircleC
    bind:showBrushStroke
    bind:smoothStroke
    bind:screenMode
    bind:showPixelGrid
    bind:showIpsGlow
    bind:screenAntiAlias
    onRestart={restartAnimation}
    onResetAll={resetAll}
  >
    <Presets {getCurrentSettings} onLoadPreset={loadPreset} />
  </SidePanel>
  {#key restartKey}
    <Canvas
      {pointerLatency} {pointerSmoothing}
      {brushLatency} {brushSmoothing}
      {penSpeed}
      {showA} {showB} {showC}
      {showPointer} {pointerStyle}
      {showCircleA} {showCircleB} {showCircleC}
      {showTrackA} {showTrackB} {showTrackC}
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
      {showIpsGlow}
      {screenAntiAlias}
    />
  {/key}
</div>

<Controls
  bind:pointerLatency bind:pointerSmoothing
  bind:brushLatency bind:brushSmoothing
  bind:penSpeed
  bind:pathType
  bind:brushSize
  bind:reportRate
  bind:brushSpacing
  bind:brushTrailLength
  {screenMode}
  bind:screenResolution
  bind:screenRefreshRate
  bind:screenResponseTime
/>

<style>
  h1 {
    font-size: 1.4rem;
    margin-bottom: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .main-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
</style>
