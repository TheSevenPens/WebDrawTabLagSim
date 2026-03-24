<script>
  import Canvas from './components/Canvas.svelte';
  import SidePanel from './components/SidePanel.svelte';
  import Controls from './components/Controls.svelte';

  // Lag parameters
  let pointerLatency = $state(25);
  let pointerSmoothing = $state(0);
  let brushLatency = $state(35);
  let brushSmoothing = $state(0);
  let penSpeed = $state(3);
  let pathType = $state('lissajous');
  let brushSize = $state(1);

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
</script>

<h1>Drawing Tablet Lag Visualizer</h1>

<div class="main-row">
  <SidePanel
    bind:showA bind:showB bind:showC
    bind:showPointer bind:pointerStyle
    bind:showTrackA bind:showTrackB bind:showTrackC
    bind:showCircleA bind:showCircleB bind:showCircleC
    bind:showBrushStroke
  />
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
  />
</div>

<Controls
  bind:pointerLatency bind:pointerSmoothing
  bind:brushLatency bind:brushSmoothing
  bind:penSpeed
  bind:pathType
  bind:brushSize
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
