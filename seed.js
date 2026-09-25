// Stable, browser-independent seeded PRNG shared by all four generators.
export const SEED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_-=+/';
export const VALID_SEED = /^[A-Za-z0-9!@#$%^&*_=+\/-]+$/;
export const EASTER_SEED = 'sevtinge';
export const isDarkSeed = (seed, language) => language === 'zh' ? /^4{3,}$/.test(seed) : /^6{3,}$/.test(seed);

export function randomSeed() {
  // Generate 1–64 characters from the allowed seed alphabet.
  const bytes = new Uint8Array(65);
  let seed;
  do {
    crypto.getRandomValues(bytes);
    const length = 1 + bytes[0] % 64;
    seed = '';
    for (let i = 0; i < length; i++) seed += SEED_ALPHABET[bytes[i + 1] % SEED_ALPHABET.length];
  } while (seed === EASTER_SEED || /^4{3,}$/.test(seed) || /^6{3,}$/.test(seed));
  return seed;
}

export function seededRandom(seed, type) {
  // Preserve existing music seed results after the generator's namespace rename.
  const music = type === 'music';
  const bytes = new TextEncoder().encode(music ? seed : `${type}:${seed}`);
  let state = music ? 3691887513 : 2166136261;
  for (const byte of bytes) {
    state = Math.imul(state ^ byte, 16777619);
  }
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
