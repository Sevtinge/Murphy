// Supports both a JavaScript "\n" escape and literal backslash-n text.
// Text nodes stay text nodes: no HTML parsing or injection is involved.
export function displayLineBreaks(value) {
  return String(value).replace(/\\n/g, '\n');
}
