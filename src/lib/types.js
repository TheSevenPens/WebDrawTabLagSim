/**
 * types.js
 *
 * Shared type definitions (JSDoc only; this module exports nothing at runtime).
 * They are checked by `bun run check` (svelte-check) and describe the contracts
 * between modules: what a position is, what the simulation is given and returns,
 * and what the simulated screen's state and options look like.
 *
 * The settings type is defined next to the schema it derives from, in
 * settings.js, so adding a setting is still one entry.
 *
 * Use from other files with:  @param {import('./types.js').Position} pos
 */

/**
 * A point in logical (CSS pixel) canvas coordinates.
 * @typedef {Object} Position
 * @property {number} x
 * @property {number} y
 */

/**
 * The positions the simulation produces each tick: A (pen tip), B (OS pointer),
 * C (brush position).
 * @typedef {Object} SimSnapshot
 * @property {Position} posA
 * @property {Position} posB
 * @property {Position} posC
 */

/**
 * What the simulation needs on each tick. A subset of the settings, read live,
 * so changing a slider takes effect on the next tick.
 * @typedef {Object} SimParams
 * @property {number} pointerLatency - ticks of delay from A to B
 * @property {number} pointerSmoothing - EMA strength for B (0 = none)
 * @property {number} brushLatency - ticks of delay from B to C
 * @property {number} brushSmoothing - EMA strength for C (0 = none)
 * @property {number} penSpeed - path time advanced per tick, in thousandths
 * @property {string} pathType - 'lissajous' | 'circle' | 'star'
 * @property {number} reportRate - tablet reports per second (1-60)
 * @property {number} [brushSpacing] - minimum pixels between trail points (0 = continuous)
 * @property {number} [brushTrailLength] - trail capacity in points
 */

/**
 * An independent simulation instance (see createSimulation in simulation.js).
 * `brushTrail` and `current` are live views of its state: treat them as read-only.
 * @typedef {Object} Simulation
 * @property {Position[]} brushTrail
 * @property {SimSnapshot | null} current - null until the first step
 * @property {number} time - pen path time
 * @property {number} reportCount - tablet reports so far
 * @property {() => void} reset
 * @property {(W: number, H: number, params: SimParams, opts?: { penMoving?: boolean }) => SimSnapshot} step
 * @property {(pos: Position, brushSpacing?: number, maxTrailLength?: number) => void} pushBrushTrail
 * @property {(W: number, H: number, params: SimParams) => SimSnapshot} warmUp
 */

/**
 * What reference tracks are computed from. SimParams, without the brush trail
 * settings (the trail is not used for tracks).
 * @typedef {Omit<SimParams, 'brushSpacing' | 'brushTrailLength'>} ReferenceParams
 */

/**
 * One period of each reference track.
 * @typedef {Object} ReferenceTracks
 * @property {Position[]} trackA
 * @property {Position[]} trackB
 * @property {Position[]} trackC
 */

/**
 * The simulated screen layer (see createScreen in screen.js).
 * @typedef {Object} ScreenState
 * @property {HTMLCanvasElement | { width: number, height: number }} canvas
 * @property {CanvasRenderingContext2D} ctx
 * @property {Float32Array} colorBuffer - premultiplied R, G, B and A per pixel
 * @property {number} width - in simulated pixels
 * @property {number} height - in simulated pixels
 * @property {number} refreshAccum - simulated ms accumulated toward the next refresh
 */

/**
 * Passed to the screen draw callback. With anti-aliasing off the callback is
 * called a second time with `coverage` true to get geometry alone.
 * @typedef {Object} ScreenDrawMode
 * @property {boolean} coverage
 */

/**
 * How the screen layer is advanced (see advanceScreen in screen.js).
 * @typedef {Object} AdvanceScreenOptions
 * @property {boolean} dirty - the layer is new, reset, resized or edited while paused
 * @property {boolean} simPaused - time is stopped
 * @property {number} simMs - simulated milliseconds to advance by
 * @property {number} refreshRateHz - simulated screen refresh rate
 * @property {number} responseTimeMs - pixel response time constant
 * @property {boolean} [antiAlias] - default true
 */

export {};
