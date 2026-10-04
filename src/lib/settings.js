/**
 * settings.js
 *
 * The single definition of every user setting: its default, allowed range or
 * values, and (for enums) display labels. Sliders, reset, presets and import
 * validation all derive from SETTINGS, so adding a setting means adding one
 * entry here.
 *
 * Specs:
 *   number  — { type: 'number', default, min, max, step }  (integer-stepped values are rounded)
 *   boolean — { type: 'boolean', default }
 *   enum    — { type: 'enum', default, options: [{ value, label }] }
 */

export const SETTINGS = {
  // Pen
  penSpeed: { type: 'number', default: 3, min: 0.5, max: 10, step: 0.5 },
  pathType: {
    type: 'enum', default: 'lissajous',
    options: [
      { value: 'lissajous', label: 'Lissajous' },
      { value: 'circle', label: 'Circle' },
      { value: 'star', label: 'Star' },
    ],
  },
  showPen: { type: 'boolean', default: true },

  // Tablet
  pointerLatency: { type: 'number', default: 25, min: 0, max: 80, step: 1 },
  pointerSmoothing: { type: 'number', default: 0, min: 0, max: 50, step: 1 },
  reportRate: { type: 'number', default: 60, min: 1, max: 60, step: 1 },

  // OS pointer
  showPointer: { type: 'boolean', default: true },
  pointerStyle: {
    type: 'enum', default: 'mouse',
    options: [
      { value: 'mouse', label: 'Mouse' },
      { value: 'crosshair', label: 'Crosshair' },
    ],
  },
  pointerSize: {
    type: 'enum', default: 1,
    options: [
      { value: 1, label: '1x' },
      { value: 2, label: '2x' },
      { value: 4, label: '4x' },
      { value: 8, label: '8x' },
    ],
  },

  // Brush
  showBrushStroke: { type: 'boolean', default: true },
  brushLatency: { type: 'number', default: 35, min: 0, max: 80, step: 1 },
  brushSmoothing: { type: 'number', default: 0, min: 0, max: 50, step: 1 },
  brushSize: { type: 'number', default: 4, min: 1, max: 30, step: 1 },
  brushSpacing: { type: 'number', default: 0, min: 0, max: 50, step: 1 },
  brushTrailLength: { type: 'number', default: 180, min: 5, max: 300, step: 5 },
  smoothStroke: { type: 'boolean', default: false },

  // Display
  aspectRatio: {
    type: 'enum', default: '16:9',
    options: [
      { value: '16:9', label: '16:9' },
      { value: '16:10', label: '16:10' },
      { value: '4:3', label: '4:3' },
      { value: '1:1', label: '1:1' },
    ],
  },
  screenMode: { type: 'boolean', default: false },
  screenResolution: { type: 'number', default: 160, min: 80, max: 320, step: 10 },
  screenRefreshRate: { type: 'number', default: 60, min: 10, max: 144, step: 1 },
  screenResponseTime: { type: 'number', default: 5, min: 1, max: 200, step: 1 },
  showPixelGrid: { type: 'boolean', default: false },
  screenAntiAlias: { type: 'boolean', default: true },

  // View
  showLabels: { type: 'boolean', default: true },
  showTracks: { type: 'boolean', default: true },
  showCircles: { type: 'boolean', default: true },
};

export const SETTING_KEYS = Object.keys(SETTINGS);

export const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(SETTING_KEYS.map(k => [k, SETTINGS[k].default]))
);

/**
 * Validate one value against its spec.
 * @returns {{ value: *, status: 'ok' | 'adjusted' | 'invalid' }}
 *   'adjusted' = a number was clamped/rounded into range; 'invalid' = wrong
 *   type or not an allowed value, so the default was substituted.
 */
function checkValue(spec, raw) {
  switch (spec.type) {
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return { value: spec.default, status: 'invalid' };
      }
      let v = Math.min(spec.max, Math.max(spec.min, raw));
      if (Number.isInteger(spec.step)) v = Math.round(v);
      return { value: v, status: v === raw ? 'ok' : 'adjusted' };
    }
    case 'boolean':
      return typeof raw === 'boolean'
        ? { value: raw, status: 'ok' }
        : { value: spec.default, status: 'invalid' };
    case 'enum':
      return spec.options.some(o => o.value === raw)
        ? { value: raw, status: 'ok' }
        : { value: spec.default, status: 'invalid' };
    default:
      return { value: spec.default, status: 'invalid' };
  }
}

/**
 * Turn arbitrary data into a complete, valid settings object.
 * Omitted keys take their defaults; unknown keys are dropped; out-of-range or
 * wrongly-typed values are clamped or replaced with defaults.
 *
 * @param {*} raw - untrusted data (parsed JSON, localStorage contents, ...)
 * @returns {{ settings: object, adjusted: string[], invalid: string[] }}
 *   adjusted/invalid list the keys that needed correction.
 */
export function sanitizeSettings(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const settings = {};
  const adjusted = [];
  const invalid = [];

  for (const key of SETTING_KEYS) {
    const spec = SETTINGS[key];
    if (!Object.prototype.hasOwnProperty.call(source, key) || source[key] === undefined) {
      settings[key] = spec.default;
      continue;
    }
    const { value, status } = checkValue(spec, source[key]);
    settings[key] = value;
    if (status === 'adjusted') adjusted.push(key);
    else if (status === 'invalid') invalid.push(key);
  }

  return { settings, adjusted, invalid };
}
