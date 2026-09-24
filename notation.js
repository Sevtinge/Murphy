// Conversion to the control characters used by the local jpfont-nds font.
const DEGREES = [1, 0, 2, 0, 3, 4, 0, 5, 0, 6, 0, 7];
const LOWER_DOTS = [
  ['q', 'w', 'e', 'r'], // one dot below, with 0–3 underlines
  ['a', 's', 'd', 'f'], // two dots below
  ['z', 'x', 'c', 'v'], // three dots below
];

export function jianpuToken(event, keySemitones = 0) {
  const relative = event.midi === null ? null : event.midi - keySemitones;
  const degree = relative === null ? '0' : String(DEGREES[relative % 12]);
  const octave = relative === null ? 0 : Math.floor(relative / 12) - 5;
  const lineCount = ['eighth', 'dottedEighth'].includes(event.value) ? 1
    : event.value === 'sixteenth' ? 2 : event.value === 'thirtysecond' ? 3 : 0;
  const low = octave < 0 ? LOWER_DOTS[Math.min(-octave, 3) - 1][lineCount] : '';
  const high = octave === 1 ? "'" : octave === 2 ? '"' : octave >= 3 ? '`' : '';
  const underlines = octave >= 0 ? ['', '_', '=', '/'][lineCount] : '';
  const dotted = event.value.startsWith('dotted') && event.value !== 'dottedHalf' ? '.' : '';
  const extension = event.value === 'half' ? '-' : event.value === 'dottedHalf' ? '--'
    : event.value === 'whole' ? '---' : '';
  return `${degree}${low || high + underlines}${dotted}${extension}`;
}
