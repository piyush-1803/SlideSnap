console.log('OFFSCREEN: script loaded');
console.log('OFFSCREEN: initialized and ready');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'detect-frames') return;
  
  console.log('OFFSCREEN: received detect-frames, frames:', 
    message.frames.length);
  
  detectSlideFrames(message.frames, message.threshold)
    .then(slideFrames => {
      console.log('OFFSCREEN: done, slideFrames:', slideFrames.length);
      sendResponse({ slideFrames });
    })
    .catch(err => {
      console.error('OFFSCREEN ERROR:', err.message);
      sendResponse({ slideFrames: [], error: err.message });
    });
  
  return true;
});

async function detectSlideFrames(frames, threshold) {
  const slideFrames = [];
  const canvas = new OffscreenCanvas(160, 90);
  // ⚡ Bolt: Add willReadFrequently: true to drastically improve getImageData performance
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      const blob = await fetch(frame.dataURL).then(r => r.blob());
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, 0, 0, 160, 90);
      bitmap.close();

      const imageData = ctx.getImageData(0, 0, 160, 90);
      const data = imageData.data;

      let skinPixels = 0;
      let totalPixels = 0;
      
      for (let p = 0; p < data.length; p += 4) {
        const r = data[p], g = data[p+1], b = data[p+2];
        totalPixels++;
        // Relaxed detection for person-like warmth
        if (r > 60 && g > 40 && b > 20 && r > g && r > (b - 10)) {
          skinPixels++;
        }
      }

      const skinRatio = skinPixels / totalPixels;
      
      // If skin tone ratio is below threshold, treat as slide frame
      if (skinRatio < (threshold * 0.8)) {
        slideFrames.push(frame);
      }
    } catch (err) {
      console.warn('OFFSCREEN: frame error at', i, err.message);
    }
  }

  // FALLBACK: If filtering removed EVERYTHING, return all frames 
  // so the user gets their PDF (just with duplicates removed later).
  const result = slideFrames.length > 0 ? slideFrames : frames;
  console.log(`OFFSCREEN: Returning ${result.length} frames (Filtered: ${slideFrames.length}/${frames.length})`);
  return result;
}
