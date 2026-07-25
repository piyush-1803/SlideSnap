## 2024-07-25 - GPU Canvas Readback Bottleneck
**Learning:** In Chrome extensions using `OffscreenCanvas` or standard DOM `canvas` to repeatedly read pixels (via `getImageData`), a major performance bottleneck is GPU-to-CPU memory transfer. If a canvas doesn't use `willReadFrequently: true`, the browser defaults to hardware acceleration (GPU).
**Action:** Always add `{ willReadFrequently: true }` to `getContext('2d')` when the primary use case of the canvas involves reading pixels heavily (like skin-tone detection or perceptual hashing), saving significant milliseconds per frame.
