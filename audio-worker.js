import { renderToneChunk, totalToneFrames, TONE_SAMPLE_RATE } from './audio-tone.js';

let activeId = 0;
self.onmessage = ({ data }) => {
  if (data.type !== 'render') return;
  const { id, frequencies, duration, smooth } = data;
  activeId = id;
  const total = totalToneFrames(frequencies, duration);
  const chunkFrames = TONE_SAMPLE_RATE * 4;
  let frame = 0, phase = 0;
  function step() {
    if (id !== activeId) return;
    try {
      const count = Math.min(chunkFrames, total - frame);
      const rendered = renderToneChunk(frequencies, duration, smooth, frame, count, phase);
      phase = rendered.phase;
      frame += count;
      self.postMessage({ id, type: 'chunk', blob: new Blob([rendered.pcm.buffer]), progress: frame / total });
      if (frame < total) setTimeout(step, 0);
      else self.postMessage({ id, type: 'done', totalFrames: total });
    } catch (error) {
      self.postMessage({ id, type: 'error', message: error.message });
    }
  }
  step();
};
