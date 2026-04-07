# SlideSnap 📸

**SlideSnap** is a Chrome extension that automatically generates lecture slide PDFs from YouTube videos. It captures video frames at regular intervals, uses a skin-tone detection heuristic to filter out the speaker, and deduplicates frames to provide a clean, high-quality PDF of the presentation.

## Features ✨

- **Auto-Capture:** Sequentially seeks through the video and captures frames.
- **Smart Filtering:** Uses an offscreen document to analyze frames and filter out the speaker (person detection).
- **Perceptual Deduplication:** Uses pHash (Hamming distance) to merge similar slides and prevent duplicates.
- **High-Quality PDF:** Generates a landscape PDF with timestamps and slide labels.
- **Modern UI:** Sleek toggle integrated directly into the YouTube player controls.

## Installation 🛠️

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `slidesnap` folder inside this repository.

## Usage 🚀

1. Open any lecture or presentation video on YouTube.
2. Click the **SlideSnap** toggle in the bottom right player controls.
3. Wait for the extension to capture and process the frames.
4. Your PDF will download automatically once processing is complete!

## Technical Stack 💻

- **Manifest V3**
- **Vanilla JavaScript & CSS**
- **Chrome Offscreen API** (for frame analysis)
- **jsPDF** (for PDF generation)

---
Developed with ❤️ for students and lifelong learners.
