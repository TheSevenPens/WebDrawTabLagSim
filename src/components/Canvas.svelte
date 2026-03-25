<script>
  import { onMount } from 'svelte';
  import { COLORS, TIME_STEP_SCALE } from '$lib/constants.js';
  import { autoPosition, computeTrackA, computeSmoothedTrack } from '$lib/animation.js';
  import {
    brushTrail, pushHistory, pushBrushTrail,
    computeCurrentPositions, preWarm, resetSimulation,
  } from '$lib/simulation.js';
  import {
    drawBrushStroke, drawTrack, drawPosition,
    drawPointer, drawCrosshair, drawPen,
  } from '$lib/drawing.js';
  import {
    createScreen, resizeScreen, shouldRefresh,
    commitFrame, renderScreenToMain,
  } from '$lib/screen.js';

  let {
    pointerLatency,
    pointerSmoothing,
    brushLatency,
    brushSmoothing,
    penSpeed,
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
  let time = 0;
  let trackA = [];
  let trackB = [];
  let trackC = [];
  let animFrame;
  let mounted = false;
  let lastFrameTime = null;

  function getAspectHeight() {
    const parts = aspectRatio.split(':');
    return Number(parts[1]) / Number(parts[0]);
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
    resetSimulation();
    time = preWarm(logicalW, logicalH, {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed, pathType, reportRate,
    });
    recomputeTracks();

    // Listen for popup resize
    popup.addEventListener('resize', () => {
      resize();
      resetSimulation();
      time = preWarm(logicalW, logicalH, {
        pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed, pathType, reportRate,
      });
      recomputeTracks();
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
    resetSimulation();
    time = preWarm(logicalW, logicalH, {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed, pathType, reportRate,
    });
    recomputeTracks();
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

  function recomputeTracks() {
    if (!canvasEl) return;
    trackA = computeTrackA(logicalW, logicalH, penSpeed, pathType);
    trackB = computeSmoothedTrack(trackA, pointerLatency, pointerSmoothing);
    trackC = computeSmoothedTrack(trackB, brushLatency, brushSmoothing);
  }

  // Recompute tracks reactively when params change
  $effect(() => {
    const _pl = pointerLatency;
    const _ps = pointerSmoothing;
    const _bl = brushLatency;
    const _bs = brushSmoothing;
    const _sp = penSpeed;
    const _pt = pathType;
    if (mounted) {
      recomputeTracks();
    }
  });

  // Reinit when aspect ratio changes
  $effect(() => {
    const _ar = aspectRatio;
    if (mounted) {
      resize();
      resetSimulation();
      time = preWarm(logicalW, logicalH, {
        pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed, pathType, reportRate,
      });
      recomputeTracks();
    }
  });

  // Manage screen lifecycle reactively
  $effect(() => {
    const _sm = screenMode;
    const _sr = screenResolution;
    if (!mounted) return;

    if (screenMode) {
      const sw = screenResolution;
      const sh = Math.round(sw * getAspectHeight());
      if (!screen) {
        screen = createScreen(sw, sh);
      } else if (screen.width !== sw || screen.height !== sh) {
        resizeScreen(screen, sw, sh);
      }
    } else {
      screen = null;
    }
  });

  onMount(() => {
    resetSimulation();

    displayCtx = canvasEl.getContext('2d');
    offscreen = document.createElement('canvas');
    ctx = offscreen.getContext('2d');

    resize();

    time = preWarm(logicalW, logicalH, {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed, pathType, reportRate,
    });
    recomputeTracks();

    mounted = true;

    function reinitAfterResize() {
      resize();
      resetSimulation();
      time = preWarm(logicalW, logicalH, {
        pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed, pathType, reportRate,
      });
      recomputeTracks();
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
      if (frozen) {
        animFrame = requestAnimationFrame(render);
        return;
      }

      // Compute real dt for screen refresh timing
      const dt = lastFrameTime ? (timestamp - lastFrameTime) : 16.67;
      lastFrameTime = timestamp;

      if (!paused) time += penSpeed * TIME_STEP_SCALE;
      const dpr = window.devicePixelRatio || 1;
      const W = logicalW;
      const H = logicalH;

      const posA = autoPosition(time, W, H, pathType);
      pushHistory(posA);

      const { posB, posC } = computeCurrentPositions(W, H, {
        pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, reportRate,
      });
      pushBrushTrail(posC, brushSpacing, brushTrailLength);

      // Scale to native resolution — all drawing uses logical coords
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, W, H);

      // Deterministic tracks (back to front, always full-res)
      if (showTracks) {
        drawTrack(ctx, trackA, COLORS.circleA + '80');
      }
      if (showTracks && pointerSmoothing > 0) {
        drawTrack(ctx, trackB, COLORS.circleB + '80');
      }
      if (showTracks && brushSmoothing > 0) {
        drawTrack(ctx, trackC, COLORS.circleC + '80');
      }

      if (screenMode && screen) {
        // === SCREEN MODE ===

        // Check if the simulated screen should refresh
        const doRefresh = shouldRefresh(screen, dt, screenRefreshRate);

        if (doRefresh) {
          // Clear screen canvas to transparent (so tracks show through)
          screen.ctx.clearRect(0, 0, screen.width, screen.height);

          // Draw screen-layer elements at screen resolution
          // Scale transform maps logical coords -> screen pixel coords
          screen.ctx.save();
          screen.ctx.imageSmoothingEnabled = screenAntiAlias;
          screen.ctx.scale(screen.width / W, screen.height / H);

          if (showBrushStroke) drawBrushStroke(screen.ctx, brushTrail, brushSize, smoothStroke);
          if (showPointer) {
            if (pointerStyle === 'crosshair') drawCrosshair(screen.ctx, posB.x, posB.y, pointerSize);
            else drawPointer(screen.ctx, posB.x, posB.y, pointerSize);
          }

          screen.ctx.restore();

          // Apply response time blending (ghosting)
          commitFrame(screen, screenResponseTime, 1000 / screenRefreshRate);
        }

        // Composite screen layer onto main canvas (every frame — LCD hold behavior)
        renderScreenToMain(ctx, screen, W, H, showPixelGrid);

        // Draw ideal overlays on top (ground truth elements)
        drawPosition(ctx, posC, 'c', showCircles, showLabels);
        drawPosition(ctx, posB, 'b', showCircles, showLabels);
        drawPen(ctx, posA.x, posA.y);
        drawPosition(ctx, posA, 'a', showCircles, showLabels);

      } else {
        // === ORIGINAL PATH ===

        // Brush stroke trail
        if (showBrushStroke) drawBrushStroke(ctx, brushTrail, brushSize, smoothStroke);

        // Draw elements back to front
        drawPosition(ctx, posC, 'c', showCircles, showLabels);
        if (showPointer) {
          if (pointerStyle === 'crosshair') drawCrosshair(ctx, posB.x, posB.y, pointerSize);
          else drawPointer(ctx, posB.x, posB.y, pointerSize);
        }
        drawPosition(ctx, posB, 'b', showCircles, showLabels);
        drawPen(ctx, posA.x, posA.y);
        drawPosition(ctx, posA, 'a', showCircles, showLabels);
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
