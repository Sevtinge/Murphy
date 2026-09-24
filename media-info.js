// Browser Media Session presentation, independent of audio synthesis.
export function trackMetadata({ measures, instrument, seed, eggKind, baseUrl }) {
  const dark = eggKind === 'dark';
  const icon = dark ? 'murphy-dark-cover' : 'murphy-icon';
  return {
    title: eggKind === 'friendly' ? 'Hi there! You found me!' : `(${measures}, ${instrument}) ${seed}`,
    artist: dark ? 'Not Murphy' : 'Murphy',
    artwork: [192, 512].map((size) => ({
      src: new URL(`./${icon}-${size}.png${dark ? '?v=black' : ''}`, baseUrl).href,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
  };
}
