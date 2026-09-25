// Browser Media Session presentation, independent of synthesis.
function coverArtwork(dark, baseUrl) {
  const icon = dark ? 'murphy-dark-cover' : 'murphy-icon';
  return [192, 512].map((size) => ({
    src: new URL(`./${icon}-${size}.png${dark ? '?v=black' : ''}`, baseUrl).href,
    sizes: `${size}x${size}`,
    type: 'image/png',
  }));
}

export function trackMetadata({ measures, instrument, seed, eggKind, baseUrl }) {
  const dark = eggKind === 'dark';
  return {
    title: eggKind === 'friendly' ? 'Hi there! You found me!' : `(${measures}, ${instrument}) ${seed}`,
    artist: dark ? 'Not Murphy' : 'Murphy',
    artwork: coverArtwork(dark, baseUrl),
  };
}


export function beepMetadata({ seed, eggKind, baseUrl }) {
  const dark = eggKind === 'dark';
  return {
    title: eggKind === 'friendly' ? 'Tritone' : `(BEEP) ${seed}`,
    artist: dark ? 'Not Murphy' : 'Murphy',
    artwork: coverArtwork(dark, baseUrl),
  };
}
