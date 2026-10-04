/**
 * rate-meter.js
 *
 * A rolling-window rate: events per second over roughly the last `windowMs`.
 *
 * Used for the on-canvas readout, with two meters:
 *  - host frames per second: record(timestamp, 1) once per animation frame
 *  - simulation ticks per second: record(timestamp, ticksRunThisFrame) once per
 *    animation frame (0 when the simulation is paused or the host is faster
 *    than the tick rate)
 *
 * Each sample is a (time, count) pair. The rate is the events that happened
 * after the oldest sample in the window, over the time between the oldest and
 * newest samples, so a steady 60 fps gives 60, not 61.
 */

export function createRateMeter({ windowMs = 1000 } = {}) {
  const samples = [];

  return {
    /**
     * @param {number} timestamp - milliseconds, on any monotonic clock
     * @param {number} [count] - events since the previous sample
     */
    record(timestamp, count = 1) {
      if (!Number.isFinite(timestamp)) return;
      const last = samples[samples.length - 1];
      // A long gap (a backgrounded tab) or a clock that went backwards would
      // read as a near-zero rate across the gap, so start over instead
      if (last && (timestamp < last.t || timestamp - last.t > windowMs)) samples.length = 0;

      samples.push({ t: timestamp, n: Number.isFinite(count) ? Math.max(0, count) : 0 });

      // Keep one sample at or before the window start as the reference point
      while (samples.length > 2 && samples[1].t <= timestamp - windowMs) samples.shift();
    },

    /** @returns {number|null} events per second, or null until there are two samples */
    rate() {
      if (samples.length < 2) return null;
      const span = samples[samples.length - 1].t - samples[0].t;
      if (span <= 0) return null;
      let events = 0;
      for (let i = 1; i < samples.length; i++) events += samples[i].n;
      return (events * 1000) / span;
    },

    /** Forget everything. */
    reset() {
      samples.length = 0;
    },
  };
}

const whole = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : String(Math.round(v)));

/**
 * The readout text, e.g. "144 fps · 60 ticks/s". A reading that is not available
 * yet shows as an en dash.
 */
export function formatRates(framesPerSecond, ticksPerSecond) {
  return `${whole(framesPerSecond)} fps · ${whole(ticksPerSecond)} ticks/s`;
}
