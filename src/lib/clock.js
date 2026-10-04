/**
 * clock.js
 *
 * Converts host frame times into whole simulation ticks.
 *
 * The simulation advances in fixed ticks (TICK_MS of simulated time each), so
 * a 30, 60, 120 or 144 Hz display all produce the same simulated trajectory:
 * a fast display just runs zero or one tick per frame, a slow one runs several.
 *
 * Details:
 *  - Frame gaps are capped at `maxFrameMs`, so a backgrounded tab resumes
 *    instead of replaying minutes of simulated time. Time beyond the cap is
 *    dropped, not queued.
 *  - A tick is run when the accumulator is within `snapMs` of a full tick.
 *    Without this, a 60 Hz display whose frames arrive at 16.6 ms would
 *    occasionally run zero ticks and then two, a visible hitch. The
 *    accumulator may go slightly negative and recovers over later frames, so
 *    the long-run tick count is still exact.
 */

import { TICK_MS } from './constants.js';

export const MAX_FRAME_MS = 250;
export const SNAP_MS = 1;

export function createClock({ tickMs = TICK_MS, maxFrameMs = MAX_FRAME_MS, snapMs = SNAP_MS } = {}) {
  let accum = 0;

  return {
    /**
     * Add elapsed host time and return how many simulation ticks are due.
     * @param {number} dtMs - time since the previous frame
     * @returns {number} whole ticks to run (>= 0)
     */
    advance(dtMs) {
      const dt = Number.isFinite(dtMs) ? Math.min(Math.max(dtMs, 0), maxFrameMs) : 0;
      accum += dt;
      let ticks = 0;
      while (accum >= tickMs - snapMs) {
        accum -= tickMs;
        ticks++;
      }
      return ticks;
    },

    /** Forget accumulated time (restart, resize, resume from freeze). */
    reset() {
      accum = 0;
    },
  };
}
