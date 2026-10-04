<script>
  import { onMount, untrack } from 'svelte';
  import { COLORS, TICK_MS } from '$lib/constants.js';
  import { createSimulation } from '$lib/simulation.js';
  import { createClock } from '$lib/clock.js';
  import { computeReferenceTracks } from '$lib/reference.js';
  import {
    drawBrushStroke, drawTrack, drawPosition,
    drawPointer, drawCrosshair, drawPen,
  } from '$lib/drawing.js';
  import {
    createScreen, resizeScreen, planScreenUpdate,
    commitFrame, renderScreenToMain,
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
    paused,
    frozen,
  } = $props();

  let containerEl;
  let canvasEl;
  let displayCtx;
  let offscreen;
  let ctx;
  // This canvas's own simulation instance and tick clock
  const sim = createSimulation();
  const clock = createClock();
  let trackA = [];
  let trackB = [];
  let trackC = [];
  let animFrame;
  let mounted = false;
  let lastFrameTime = null;
  // Most recent logical positions, kept so a frame can be drawn while frozen
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

  // Logical (CSS) dimensions — drawing code uses these
  let logicalW = 0;
  let logicalH = 0;

  // Screen simulation state
  let screen = null;

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
      const maxH = 600;
      logicalH = maxH;
      logicalW = Math.min(Math.round(logicalH / getAspectHeight()), window.innerWidth - 40);
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

  // While frozen the screen layer isn't redrawn, so explicit visual edits must invalidate it
  $effect(() => {
    const _visual = [
      showBrushStroke, showPointer, pointerStyle, pointerSize,
      brushSize, smoothStroke, screenAntiAlias,
    ];
    if (mounted && untrack(() => frozen)) screenDirty = true;
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

    const onResize = () => {
      reinitAfterResize();
    };
    window.addEventListener('resize', onResize);

    const onFullscreenChange = () => {
      isFullscreen = !!document.fullscreenElement;
      reinitAfterResize();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    function render(timestamp) {
      // Screen-layer time advances with simulated time, not host frames
      let simMs = 0;
      if (frozen) {
        // Time is stopped, but keep drawing so the canvas never goes blank
        // after a restart or resize. Reset the clock so resuming doesn't see
        // one huge frame gap.
        lastFrameTime = null;
        clock.reset();
      } else {
        const hostDt = lastFrameTime === null ? TICK_MS : timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        // Run the whole ticks that are due; a fast display may run none this frame
        const ticks = clock.advance(hostDt);
        const params = {
          pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
          penSpeed, pathType, reportRate, brushSpacing, brushTrailLength,
        };
        for (let i = 0; i < ticks; i++) {
          current = sim.step(logicalW, logicalH, params, { penMoving: !paused });
        }
        simMs = ticks * TICK_MS;
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

        // Redraw when simulated refreshes are due, or when the layer is dirty
        // (new/resized, or edited while frozen). A plain freeze leaves it as is.
        const plan = planScreenUpdate(screen, {
          dirty: screenDirty, frozen, dtMs: simMs, refreshRateHz: screenRefreshRate,
        });
        screenDirty = false;

        if (plan.redraw) {
          // Clear screen canvas to transparent (so tracks show through)
          screen.ctx.clearRect(0, 0, screen.width, screen.height);

          // Draw screen-layer elements at screen resolution
          // Scale transform maps logical coords -> screen pixel coords
          screen.ctx.save();
          screen.ctx.imageSmoothingEnabled = screenAntiAlias;
          screen.ctx.scale(screen.width / W, screen.height / H);

          if (showBrushStroke) drawBrushStroke(screen.ctx, sim.brushTrail, brushSize, smoothStroke);
          if (showPointer) {
            if (pointerStyle === 'crosshair') drawCrosshair(screen.ctx, posB.x, posB.y, pointerSize);
            else drawPointer(screen.ctx, posB.x, posB.y, pointerSize);
          }

          screen.ctx.restore();

          // Apply response time blending (ghosting); an infinite interval snaps to the target
          commitFrame(screen, screenResponseTime, plan.blendMs);
        }

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
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (popupWindow && !popupWindow.closed) popupWindow.close();
    };
  });
</script>

<div class="canvas-container" bind:this={containerEl}>
  <canvas bind:this={canvasEl}></canvas>
  <div class="overlay-left">
    <button class="overlay-btn" onclick={saveSnapshot} title="Save snapshot as PNG">📷</button>
  </div>
  <div class="overlay-right">
    <button class="overlay-btn" onclick={isPoppedOut ? popIn : popOut} title={isPoppedOut ? 'Pop back in' : 'Pop out to window'}>
      {isPoppedOut ? '⤶' : '⤴'}
    </button>
    <button class="overlay-btn" onclick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
      {isFullscreen ? '⛶' : '⛶'}
    </button>
  </div>
</div>

<style>
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
