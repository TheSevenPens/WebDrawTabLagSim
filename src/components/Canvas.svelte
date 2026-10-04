<script>
  import { onMount, untrack } from 'svelte';
  import { COLORS, TICK_MS } from '$lib/constants.js';
  import { createSimulation } from '$lib/simulation.js';
  import { createClock } from '$lib/clock.js';
  import { createRateMeter, formatRates } from '$lib/rate-meter.js';
  import { computeReferenceTracks } from '$lib/reference.js';
  import {
    drawBrushStroke, drawTrack, drawPosition,
    drawPointer, drawCrosshair, drawPen,
  } from '$lib/drawing.js';
  import {
    createScreen, resizeScreen, advanceScreen, opaqueContext,
    renderScreenToMain,
  } from '$lib/screen.js';

  let {
    pointerLatency,
    pointerSmoothing,
    brushLatency,
    brushSmoothing,
    penSpeed,
    showPen,
    showLabels,
    showTracks,
    showCircles,
    showRates,
    showPointer,
    pointerStyle,
    pointerSize,
    showBrushStroke,
    pathType,
    brushSize,
    reportRate,
    brushSpacing,
    smoothStroke,
    brushTrailLength,
    screenMode,
    screenResolution,
    screenRefreshRate,
    screenResponseTime,
    showPixelGrid,
    screenAntiAlias,
    aspectRatio,
    penStopped,
    simPaused,
  } = $props();

  let areaEl;
  let containerEl;
  let canvasEl;
  let displayCtx;
  let offscreen;
  let ctx;
  // This canvas's own simulation instance and tick clock
  const sim = createSimulation();
  const clock = createClock();
  // Measured host frame rate and simulation tick rate, for the optional readout
  const frameMeter = createRateMeter();
  const tickMeter = createRateMeter();
  const RATE_READOUT_INTERVAL_MS = 250;
  let rateText = $state('');
  let lastRateUpdate = -Infinity;
  let trackA = [];
  let trackB = [];
  let trackC = [];
  let animFrame;
  let mounted = false;
  let lastFrameTime = null;
  // Most recent logical positions, kept so a frame can be drawn while the simulation is paused
  let current = null;
  // Set when the screen layer needs an immediate (non-blended) redraw
  let screenDirty = true;

  function getAspectHeight() {
    const parts = String(aspectRatio).split(':');
    const ratio = Number(parts[1]) / Number(parts[0]);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 9 / 16;
  }
  let isFullscreen = $state(false);
  let isPoppedOut = $state(false);
  let popupWindow = null;
  let popupCanvas = null;
  let popupDisplayCtx = null;

  // Text alternative for the canvas: what the three positions are, and the active settings
  const uid = $props.id();
  const descId = `${uid}-desc`;
  const description = $derived.by(() => {
    const ms = (ticks) => `${Math.round(ticks * TICK_MS)} ms`;
    const parts = [
      `An animation of a pen tip (a) moving along a ${pathType} path. `
        + `The operating system pointer (b) follows the pen tip, and the brush stroke (c) follows the pointer.`,
      `Pointer lag: the tablet reports ${reportRate} times per second, with ${pointerLatency} ticks (${ms(pointerLatency)}) `
        + `of latency and smoothing ${pointerSmoothing}.`,
      `Brush lag: ${brushLatency} ticks (${ms(brushLatency)}) of latency and smoothing ${brushSmoothing}.`,
    ];
    if (screenMode) {
      parts.push(
        `Screen simulation is on: ${screenResolution} pixels wide, refreshing ${screenRefreshRate} times per second `
          + `with a ${screenResponseTime} ms pixel response time. `
          + `The circles and labels mark the ideal positions; the blocky pointer and stroke show what the simulated screen displays, which can lag behind them.`,
      );
    }
    if (simPaused) parts.push('The simulation is paused.');
    else if (penStopped) parts.push('The pen is stopped.');
    return parts.join(' ');
  });

  // Logical (CSS) dimensions — drawing code uses these
  let logicalW = 0;
  let logicalH = 0;

  // Screen simulation state
  let screen = null;

  // Full-size canvas height. Narrower areas scale down, keeping the aspect ratio.
  const MAX_INLINE_HEIGHT = 600;
  const MIN_INLINE_WIDTH = 200;

  // Size of the inline canvas for the space the layout gives it
  function inlineSize() {
    const ratio = getAspectHeight();
    const available = Math.max(MIN_INLINE_WIDTH, areaEl ? areaEl.clientWidth : window.innerWidth - 40);
    const fullWidth = Math.round(MAX_INLINE_HEIGHT / ratio);
    if (available >= fullWidth) return { w: fullWidth, h: MAX_INLINE_HEIGHT };
    return { w: available, h: Math.round(available * ratio) };
  }

  function resize() {
    if (!canvasEl) return;
    const dpr = window.devicePixelRatio || 1;

    if (isPoppedOut && popupWindow && popupCanvas) {
      // Size to fit the popup window
      logicalW = popupWindow.innerWidth;
      logicalH = popupWindow.innerHeight;

      popupCanvas.style.width = logicalW + 'px';
      popupCanvas.style.height = logicalH + 'px';
      popupCanvas.width = Math.round(logicalW * dpr);
      popupCanvas.height = Math.round(logicalH * dpr);
    } else if (isFullscreen) {
      logicalW = window.innerWidth;
      logicalH = window.innerHeight;
    } else {
      ({ w: logicalW, h: logicalH } = inlineSize());
    }

    // Set CSS display size
    canvasEl.style.width = logicalW + 'px';
    canvasEl.style.height = logicalH + 'px';

    // Set backing store to native resolution
    canvasEl.width = Math.round(logicalW * dpr);
    canvasEl.height = Math.round(logicalH * dpr);
    offscreen.width = canvasEl.width;
    offscreen.height = canvasEl.height;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerEl.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  function popOut() {
    if (isPoppedOut) return;

    const w = logicalW || 960;
    const h = logicalH || 540;
    const popup = window.open('', 'lag-viz-popup',
      `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
    if (!popup) return; // blocked by popup blocker

    popup.document.title = 'Drawing Tablet Lag Visualizer';
    popup.document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;';

    // Create a canvas in the popup
    const pCanvas = popup.document.createElement('canvas');
    pCanvas.style.display = 'block';
    popup.document.body.appendChild(pCanvas);

    popupCanvas = pCanvas;
    popupDisplayCtx = pCanvas.getContext('2d');
    popupWindow = popup;
    isPoppedOut = true;

    // Hide the inline canvas
    containerEl.style.display = 'none';

    // Size to popup window
    resize();
    reinit();

    // Listen for popup resize
    popup.addEventListener('resize', () => {
      resize();
      reinit();
    });

    // When popup closes, pop back in
    popup.addEventListener('beforeunload', () => {
      popIn();
    });
  }

  function popIn() {
    if (!isPoppedOut) return;

    isPoppedOut = false;
    popupCanvas = null;
    popupDisplayCtx = null;

    // Don't close popup from here if it's already closing
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    popupWindow = null;

    // Show the inline canvas again
    containerEl.style.display = '';

    // Re-init for inline dimensions
    resize();
    reinit();
  }

  function saveSnapshot() {
    if (!canvasEl) return;
    const parts = [
      'lag',
      `pLat${pointerLatency}`,
      `pSm${pointerSmoothing}`,
      `bLat${brushLatency}`,
      `bSm${brushSmoothing}`,
      `spd${penSpeed}`,
      pathType,
    ];
    if (reportRate < 60) parts.push(`rr${reportRate}hz`);
    if (screenMode) parts.push(`scr${screenResolution}px`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${parts.join('_')}_${timestamp}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvasEl.toDataURL('image/png');
    link.click();
  }

  // Reference tracks come from an isolated run of the same engine as the live view
  function recomputeTracks() {
    if (!canvasEl) return;
    ({ trackA, trackB, trackC } = computeReferenceTracks(logicalW, logicalH, {
      penSpeed, pathType, pointerLatency, pointerSmoothing,
      brushLatency, brushSmoothing, reportRate,
    }));
  }

  // Reset the simulation to a freshly warmed-up state for the current size.
  // Reads many reactive props, so effects must call it inside untrack().
  function reinit() {
    current = sim.warmUp(logicalW, logicalH, {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
      penSpeed, pathType, reportRate, brushSpacing, brushTrailLength,
    });
    clock.reset();
    lastFrameTime = null;
    screenDirty = true;
    recomputeTracks();
  }

  // Create, resize or discard the screen layer to match current settings.
  function syncScreen() {
    if (screenMode) {
      const sw = screenResolution;
      const sh = Math.round(sw * getAspectHeight());
      if (!screen) {
        screen = createScreen(sw, sh);
      } else if (screen.width !== sw || screen.height !== sh) {
        resizeScreen(screen, sw, sh);
      }
      screenDirty = true;
    } else {
      screen = null;
    }
  }

  // Recompute tracks reactively when params change
  $effect(() => {
    const _pl = pointerLatency;
    const _ps = pointerSmoothing;
    const _bl = brushLatency;
    const _bs = brushSmoothing;
    const _sp = penSpeed;
    const _pt = pathType;
    const _rr = reportRate;
    if (mounted) {
      untrack(recomputeTracks);
    }
  });

  // Reinit when aspect ratio changes (and only then)
  $effect(() => {
    const _ar = aspectRatio;
    if (mounted) {
      untrack(() => {
        resize();
        reinit();
        syncScreen();
      });
    }
  });

  // While the simulation is paused the screen layer isn't redrawn, so explicit visual edits must invalidate it
  $effect(() => {
    const _visual = [
      showBrushStroke, showPointer, pointerStyle, pointerSize,
      brushSize, smoothStroke, screenAntiAlias,
    ];
    if (mounted && untrack(() => simPaused)) screenDirty = true;
  });

  // Manage screen lifecycle reactively
  $effect(() => {
    const _sm = screenMode;
    const _sr = screenResolution;
    if (!mounted) return;
    untrack(syncScreen);
  });

  onMount(() => {
    displayCtx = canvasEl.getContext('2d');
    offscreen = document.createElement('canvas');
    ctx = offscreen.getContext('2d');

    resize();
    reinit();
    // The screen effect skips its first run (mounted is false), so build it here
    syncScreen();

    mounted = true;

    function reinitAfterResize() {
      resize();
      reinit();
    }

    // Inline: follow the space the layout gives the canvas (sidebar, window width).
    // Only reset when the resulting size actually changes.
    const areaObserver = new ResizeObserver(() => {
      if (isFullscreen || isPoppedOut) return;
      const { w, h } = inlineSize();
      if (w !== logicalW || h !== logicalH) reinitAfterResize();
    });
    areaObserver.observe(areaEl);

    // Fullscreen follows the window itself
    const onResize = () => {
      if (isFullscreen) reinitAfterResize();
    };
    window.addEventListener('resize', onResize);

    // A pixel-ratio change (dragging to another monitor, browser zoom) can leave
    // the CSS size untouched, so neither of the above fires. The backing store
    // has to be rebuilt for the new ratio.
    let dprQuery = null;
    const onDprChange = () => {
      reinitAfterResize();
      watchDpr();
    };
    function watchDpr() {
      dprQuery?.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
    }
    watchDpr();

    const onFullscreenChange = () => {
      isFullscreen = !!document.fullscreenElement;
      reinitAfterResize();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Draw this tick's pointer and stroke into the screen layer (screen resolution)
    function drawScreenLayer(target, { coverage = false } = {}) {
      // The coverage pass draws the same geometry fully opaque (see aliasFrame in screen.js)
      const sctx = coverage ? opaqueContext(target) : target;
      sctx.save();
      sctx.scale(screen.width / logicalW, screen.height / logicalH);

      if (showBrushStroke) drawBrushStroke(sctx, sim.brushTrail, brushSize, smoothStroke);
      if (showPointer) {
        const { posB } = current;
        if (pointerStyle === 'crosshair') drawCrosshair(sctx, posB.x, posB.y, pointerSize);
        else drawPointer(sctx, posB.x, posB.y, pointerSize);
      }

      sctx.restore();
    }

    // Advance the screen layer by `simMs`; redraws only when refreshes are due or it is dirty
    function updateScreenLayer(simMs) {
      if (!screenMode || !screen) return;
      const dirty = screenDirty;
      screenDirty = false;
      advanceScreen(screen, {
        dirty, simPaused, simMs,
        refreshRateHz: screenRefreshRate,
        responseTimeMs: screenResponseTime,
        antiAlias: screenAntiAlias,
      }, drawScreenLayer);
    }

    function render(timestamp) {
      let ticks = 0;
      if (simPaused) {
        // Time is stopped, but keep drawing so the canvas never goes blank
        // after a restart or resize. Reset the clock so resuming doesn't see
        // one huge frame gap.
        lastFrameTime = null;
        clock.reset();
      } else {
        const hostDt = lastFrameTime === null ? TICK_MS : timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        // Run the whole ticks that are due; a fast display may run none this frame
        ticks = clock.advance(hostDt);
        const params = {
          pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
          penSpeed, pathType, reportRate, brushSpacing, brushTrailLength,
        };
        for (let i = 0; i < ticks; i++) {
          current = sim.step(logicalW, logicalH, params, { penMoving: !penStopped });
          // The screen sees every tick's state, so ghosting does not depend on how
          // ticks are grouped into host frames
          updateScreenLayer(TICK_MS);
        }
      }
      // New, resized or edited-while-paused layers redraw even when no tick ran
      updateScreenLayer(0);

      // Measure every frame (a few array operations), but only touch the DOM a few times a second
      frameMeter.record(timestamp, 1);
      tickMeter.record(timestamp, ticks);
      if (showRates && timestamp - lastRateUpdate >= RATE_READOUT_INTERVAL_MS) {
        lastRateUpdate = timestamp;
        rateText = formatRates(frameMeter.rate(), tickMeter.rate());
      }

      const dpr = window.devicePixelRatio || 1;
      const W = logicalW;
      const H = logicalH;
      const { posA, posB, posC } = current;

      // Scale to native resolution — all drawing uses logical coords
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, W, H);

      // Deterministic tracks (back to front, always full-res)
      if (showTracks && showPen) {
        drawTrack(ctx, trackA, COLORS.circleA + '80');
      }
      if (showTracks && showPointer && (pointerSmoothing > 0 || !showPen)) {
        drawTrack(ctx, trackB, COLORS.circleB + '80');
      }
      if (showTracks && showBrushStroke && (brushSmoothing > 0 || !showPointer)) {
        drawTrack(ctx, trackC, COLORS.circleC + '80');
      }

      if (screenMode && screen) {
        // === SCREEN MODE ===

        // Composite screen layer onto main canvas (every frame — LCD hold behavior)
        renderScreenToMain(ctx, screen, W, H, showPixelGrid);

        // Draw ideal overlays on top (ground truth elements)
        if (showBrushStroke) drawPosition(ctx, posC, 'c', showCircles, showLabels);
        if (showPointer) drawPosition(ctx, posB, 'b', showCircles, showLabels);
        if (showPen) drawPen(ctx, posA.x, posA.y);
        if (showPen) drawPosition(ctx, posA, 'a', showCircles, showLabels);

      } else {
        // === ORIGINAL PATH ===

        // Brush stroke trail
        if (showBrushStroke) drawBrushStroke(ctx, sim.brushTrail, brushSize, smoothStroke);

        // Draw elements back to front
        if (showBrushStroke) drawPosition(ctx, posC, 'c', showCircles, showLabels);
        if (showPointer) {
          if (pointerStyle === 'crosshair') drawCrosshair(ctx, posB.x, posB.y, pointerSize);
          else drawPointer(ctx, posB.x, posB.y, pointerSize);
        }
        if (showPointer) drawPosition(ctx, posB, 'b', showCircles, showLabels);
        if (showPen) drawPen(ctx, posA.x, posA.y);
        if (showPen) drawPosition(ctx, posA, 'a', showCircles, showLabels);
      }

      // Blit offscreen buffer to visible canvas (pixel-to-pixel, no transform)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (isPoppedOut && popupDisplayCtx) {
        popupDisplayCtx.drawImage(offscreen, 0, 0);
      } else {
        displayCtx.drawImage(offscreen, 0, 0);
      }

      animFrame = requestAnimationFrame(render);
    }

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      areaObserver.disconnect();
      dprQuery?.removeEventListener('change', onDprChange);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (popupWindow && !popupWindow.closed) popupWindow.close();
    };
  });
</script>

<div class="canvas-area" bind:this={areaEl}>
  <div class="canvas-container" bind:this={containerEl}>
    <!-- The fallback content inside <canvas> is its text alternative for assistive technology -->
    <canvas bind:this={canvasEl} aria-label="Pen lag simulation" aria-describedby={descId}>
      <p id={descId}>{description}</p>
    </canvas>
    {#if showRates}
      <!-- Plain text, deliberately not a live region: a screen reader user can read the current values on
           demand, and nothing is announced every time the numbers update -->
      <div class="rate-readout">{rateText || formatRates(null, null)}</div>
    {/if}
    <div class="overlay-left">
      <button class="overlay-btn" onclick={saveSnapshot} title="Save snapshot as PNG" aria-label="Save snapshot as PNG">📷</button>
    </div>
    <div class="overlay-right">
      <button
        class="overlay-btn"
        onclick={isPoppedOut ? popIn : popOut}
        title={isPoppedOut ? 'Pop back in' : 'Pop out to window'}
        aria-label={isPoppedOut ? 'Pop back in' : 'Pop out to window'}
      >
        {isPoppedOut ? '⤶' : '⤴'}
      </button>
      <button
        class="overlay-btn"
        onclick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        ⛶
      </button>
    </div>
  </div>
</div>

<style>
  /* The area is whatever width the layout gives the canvas; the canvas fits inside it */
  .canvas-area {
    flex: 1 1 0;
    min-width: 0;
  }
  .canvas-container {
    position: relative;
    display: inline-block;
  }
  .canvas-container:fullscreen {
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  canvas {
    border-radius: 8px;
    cursor: default;
    display: block;
  }
  .canvas-container:fullscreen canvas {
    border-radius: 0;
  }
  .rate-readout {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .overlay-left, .overlay-right {
    position: absolute;
    top: 8px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .overlay-left {
    left: 8px;
  }
  .overlay-right {
    right: 8px;
    display: flex;
    gap: 4px;
  }
  .canvas-container:hover .overlay-left,
  .canvas-container:hover .overlay-right,
  .canvas-container:focus-within .overlay-left,
  .canvas-container:focus-within .overlay-right,
  .canvas-container:fullscreen .overlay-left,
  .canvas-container:fullscreen .overlay-right {
    opacity: 1;
  }
  .overlay-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .overlay-btn:hover {
    background: rgba(0, 0, 0, 0.6);
  }
</style>
