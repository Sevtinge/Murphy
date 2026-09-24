import { TAB_PATHS, encodeSeed } from './routes.js';

const MAX_FILENAME_LENGTH = 240;

export function exportFilename(type, seed, extension, timestamp = Date.now()) {
  const tab = TAB_PATHS[type];
  if (!tab) throw new RangeError(`Unknown export tab: ${type}`);
  const prefix = `Murphy_${tab}_`;
  const suffix = `_${timestamp}.${extension}`;
  const available = MAX_FILENAME_LENGTH - prefix.length - suffix.length;
  let encoded = encodeSeed(seed);
  if (encoded.length > available) {
    // Manual seeds have no length limit. Keep random (1–64 character) seeds
    // intact, but distinguish very long seeds within filesystem limits.
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(seed)) hash = Math.imul(hash ^ byte, 16777619);
    const tag = `~${(hash >>> 0).toString(16).padStart(8, '0')}`;
    encoded = encoded.slice(0, available - tag.length).replace(/%(?:[0-9A-F])?$/, '') + tag;
  }
  return `${prefix}${encoded}${suffix}`;
}
