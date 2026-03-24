<script>
  import { onMount } from 'svelte';
  import { COLORS, TIME_STEP_SCALE } from '$lib/constants.js';
  import { autoPosition, computeTrackA, computeSmoothedTrack } from '$lib/animation.js';
  import {
    brushTrail, pushHistory, pushBrushTrail,
    computeCurrentPositions, preWarm,
  } from '$lib/simulation.js';
  import {
    drawBrushStroke, drawTrack, drawPosition,
    drawPointer, drawCrosshair, drawPen,
  } from '$lib/drawing.js';

  let {
    pointerLatency,
    pointerSmoothing,
    brushLatency,
    brushSmoothing,
    penSpeed,
    showA,
    showB,
    showC,
    showPointer,
    pointerStyle,
    showCircleA,
    showCircleB,
    showCircleC,
    showTrackA,
    showTrackB,
    showTrackC,
  } = $props();

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

  function resize() {
    if (!canvasEl) return;
    const w = Math.min(window.innerWidth - 40, 1100);
    canvasEl.width = w;
    canvasEl.height = Math.round(w * 0.5);
    offscreen.width = canvasEl.width;
    offscreen.height = canvasEl.height;
  }

  function recomputeTracks() {
    if (!canvasEl) return;
    const W = canvasEl.width;
    const H = canvasEl.height;
    trackA = computeTrackA(W, H, penSpeed);
    trackB = computeSmoothedTrack(trackA, pointerLatency, pointerSmoothing);
    trackC = computeSmoothedTrack(trackB, brushLatency, brushSmoothing);
  }

  // Recompute tracks reactively when params change
  $effect(() => {
    // Read reactive props to create dependencies
    const _pl = pointerLatency;
    const _ps = pointerSmoothing;
    const _bl = brushLatency;
    const _bs = brushSmoothing;
    const _sp = penSpeed;
    if (mounted) {
      recomputeTracks();
    }
  });

  onMount(() => {
    displayCtx = canvasEl.getContext('2d');
    offscreen = document.createElement('canvas');
    ctx = offscreen.getContext('2d');

    resize();

    time = preWarm(canvasEl.width, canvasEl.height, {
      pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed,
    });
    recomputeTracks();

    mounted = true;

    const onResize = () => {
      resize();
      recomputeTracks();
    };
    window.addEventListener('resize', onResize);

    function render() {
      time += penSpeed * TIME_STEP_SCALE;
      const W = canvasEl.width;
      const H = canvasEl.height;

      const posA = autoPosition(time, W, H);
      pushHistory(posA);

      const { posB, posC } = computeCurrentPositions(W, H, {
        pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
      });
      pushBrushTrail(posC);

      // Background
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, W, H);

      // Deterministic tracks (back to front)
      if (showTrackA) {
        drawTrack(ctx, trackA, COLORS.circleA + '80');
      }
      if (showTrackB && pointerSmoothing > 0) {
        drawTrack(ctx, trackB, COLORS.circleB + '80');
      }
      if (showTrackC && brushSmoothing > 0) {
        drawTrack(ctx, trackC, COLORS.circleC + '80');
      }

      // Brush stroke trail
      drawBrushStroke(ctx, brushTrail);

      // Draw elements back to front
      drawPosition(ctx, posC, 'c', showCircleC, showC);
      if (showPointer) {
        if (pointerStyle === 'crosshair') drawCrosshair(ctx, posB.x, posB.y);
        else drawPointer(ctx, posB.x, posB.y);
      }
      drawPosition(ctx, posB, 'b', showCircleB, showB);
      drawPen(ctx, posA.x, posA.y);
      drawPosition(ctx, posA, 'a', showCircleA, showA);

      // Blit offscreen buffer to visible canvas
      displayCtx.drawImage(offscreen, 0, 0);

      animFrame = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<canvas bind:this={canvasEl}></canvas>

<style>
  canvas {
    border-radius: 8px;
    cursor: default;
    display: block;
  }
</style>
