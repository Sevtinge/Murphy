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
  // A rest remains silent throughout its long value; display each extension
  // beat as another 0 instead of a sustain dash until a sounding note starts.
  if (relative === null && extension) return '0'.repeat(extension.length + 1);
  return `${degree}${low || high + underlines}${dotted}${extension}`;
}

// jpfont-nds: A/S/D/F/G/H are the font's low slurs (1.5–6 note widths),
// Q/W/E/R/T/Y their higher variants for notes with upper octave dots.
export function jianpuSlurGlyph(noteWidths, high = false) {
  const widths = [1.5, 2, 3, 4, 5, 6];
  let closest = 0;
  for (let i = 1; i < widths.length; i++) {
    if (Math.abs(widths[i] - noteWidths) < Math.abs(widths[closest] - noteWidths)) closest = i;
  }
  return (high ? 'QWERTY' : 'ASDFGH')[closest];
}

export function scoreSlurPlan(piece, slur) {
  const sounding = piece.bars.slice(slur.startBar, slur.endBar + 1)
    .flatMap((bar, relative) => bar.slice(
      relative === 0 ? slur.start : 0,
      relative === slur.endBar - slur.startBar ? slur.end + 1 : bar.length,
    ));
  const high = sounding.some((note) => note.midi - piece.key.semitones >= 72);
  if (slur.startBar !== slur.endBar || sounding.some((note) => note.value.startsWith('dotted')))
    return { kind: 'flat', high };
  const bar = piece.bars[slur.startBar];
  let widths = 0;
  for (let i = slur.start; i < slur.end; i++) {
    widths++;
    if (bar[i].group !== bar[i + 1].group) widths += 0.5; // font l: quarter-width space
    else if (i === slur.start && slur.end === i + 1)
      widths += bar[i].value === 'quarter' || bar[i + 1].value === 'quarter' ? 1 : 0.5;
    else if (bar[i].value === 'quarter' || bar[i + 1].value === 'quarter') widths++;
  }
  // A/Q is the font's intentional 1.5-width arc for two neighboring
  // half-width notes separated by the font's quarter-space.
  if (slur.end === slur.start + 1 && Math.abs(widths - 1.5) < 0.01) {
    return { kind: 'arc', high, glyph: jianpuSlurGlyph(1.5, high) };
  }
  // S..H cover exact integer widths 2..6; other fractional or long spans
  // need the font's J/KL/: flat-line construction.
  const whole = Math.round(widths);
  if (whole >= 2 && whole <= 6 && Math.abs(widths - whole) < 0.01) {
    return { kind: 'arc', high, glyph: jianpuSlurGlyph(whole, high) };
  }
  return { kind: 'flat', high };
}
export function scoreSlurMarks(piece) {
  const marks = new Map();
  const add = (bar, index, glyph) => {
    const key = `${bar}:${index}`;
    marks.set(key, (marks.get(key) || '') + glyph);
  };
  for (const slur of piece.slurs || []) {
    const plan = scoreSlurPlan(piece, slur);
    if (plan.kind === 'arc') {
      add(slur.startBar, slur.start, plan.glyph);
    } else {
      add(slur.startBar, slur.start, plan.high ? 'U' : 'J');
      add(slur.endBar, slur.end, plan.high ? 'P' : ':');
    }
  }
  return marks;
}

// KL (IO at the higher position) is a two-cell native straight segment.
// Align a K/L join over the barline when present; clip only at the ends.
export function jianpuFlatLineSegments(width, unit, high = false, barlineOffset = null) {
  const step = 2 * unit;
  let origin = 0;
  if (barlineOffset !== null) {
    origin = ((barlineOffset - unit) % step + step) % step;
    if (origin > 0) origin -= step;
  }
  const glyph = high ? 'IO' : 'KL';
  const segments = [];
  for (let offset = origin; offset < width; offset += step) {
    if (offset + step > 0) segments.push({ offset, glyph });
  }
  return segments;
}
