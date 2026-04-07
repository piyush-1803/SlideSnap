# SlideSnap — QA Testing Checklist

Use this checklist to verify the extension works end-to-end before distributing or publishing.

---

## 1. Loading the Extension

- [ ] Open Chrome and navigate to `chrome://extensions`
- [ ] Enable **Developer Mode** (top-right toggle)
- [ ] Click **"Load unpacked"** → select the `slidesnap/` folder
- [ ] **Verify:** SlideSnap appears in the extensions list with the red "S" icon
- [ ] **Verify:** No errors or warnings are shown in the extension card
- [ ] **Verify:** The SlideSnap icon appears in the Chrome toolbar (may need to pin it)

---

## 2. UI Injection Test

- [ ] Open any YouTube video (e.g. a lecture recording)
- [ ] **Verify:** A "SlideSnap" toggle appears in the bottom-right player controls bar (to the left of the settings gear icon)
- [ ] **Verify:** The toggle is a pill-shaped switch and is **OFF** by default
- [ ] **Verify:** The label text "SlideSnap" is visible next to the toggle in white
- [ ] Navigate to a second, different video using YouTube's in-page navigation
- [ ] **Verify:** The old toggle is removed and a fresh toggle appears on the new video
- [ ] **Verify:** The toggle resets to **OFF** on the new video
- [ ] Refresh the page on a watch page
- [ ] **Verify:** The toggle re-injects correctly after page reload

---

## 3. Short Video Smoke Test

> Use a **2–5 minute lecture video** with visible slides for this test.

- [ ] Toggle the switch **ON**
- [ ] **Verify:** The overlay appears in the top-right corner with: `📸 Capturing frames...`
- [ ] **Verify:** The progress bar fills as the video scrubs through automatically
- [ ] **Verify:** The video seeks through timestamps (visible in the player progress bar)
- [ ] **Verify:** After capturing, the overlay transitions to: `🔍 Loading detector...`
- [ ] **Verify:** The overlay then shows: `🔍 Detecting slides... X found` with an updating count
- [ ] **Verify:** After detection, the overlay shows: `🗂️ Deduplicating... X unique / Y`
- [ ] **Verify:** After dedup, the overlay shows: `📄 Building PDF... page X / Y`
- [ ] **Verify:** A PDF file downloads automatically with filename format: `Video_Title_slides.pdf`
- [ ] **Verify:** The overlay shows: `✅ PDF downloaded! (X slides)` then disappears after 3 seconds
- [ ] **Verify:** The toggle resets to **OFF** automatically after completion
- [ ] Open the downloaded PDF:
  - [ ] **Verify:** Slides are present as full-page landscape images
  - [ ] **Verify:** Each page has a timestamp label at the bottom (e.g. `Slide 1  |  0:00`)
  - [ ] **Verify:** No blank pages are present
  - [ ] **Verify:** Duplicate slides have been removed (no consecutive identical pages)

---

## 4. Edge Case Tests

### 4a. Cancel Mid-Capture
- [ ] Toggle **ON** on a video, wait for `📸 Capturing frames...` to appear
- [ ] Toggle **OFF** immediately while capture is in progress
- [ ] **Verify:** Scrubbing stops promptly
- [ ] **Verify:** The overlay disappears cleanly (no lingering UI)
- [ ] **Verify:** The video returns to its original playback position
- [ ] **Verify:** No console errors related to SlideSnap

### 4b. Non-Lecture Video (Person-Heavy)
- [ ] Open a non-lecture video (e.g. a music video where a person is always prominently visible)
- [ ] Toggle **ON** and let the full pipeline complete
- [ ] **Verify:** The PDF has 0 or very few slides (most frames filtered out by person detection)
- [ ] **Verify:** If 0 slides detected, the overlay shows: `⚠️ No slides detected. Try a different video.`
- [ ] **Verify:** The toggle resets to **OFF** after the message

### 4c. Non-Watch Page
- [ ] Navigate to YouTube homepage (`https://www.youtube.com`)
- [ ] **Verify:** The SlideSnap toggle does **NOT** appear anywhere on the page
- [ ] Navigate to a YouTube search results page
- [ ] **Verify:** The toggle does **NOT** appear
- [ ] Navigate to a YouTube channel page
- [ ] **Verify:** The toggle does **NOT** appear

### 4d. Video Not Ready
- [ ] Open a YouTube video and toggle **ON** before the video has fully loaded
- [ ] **Verify:** If the video isn't ready, an alert appears: `"Video is not ready yet. Wait for it to fully load."`

---

## 5. Known Limitations

> These are expected behaviors, not bugs.

| Limitation | Details |
|---|---|
| **First-run CDN delay** | The first run on any video loads TensorFlow.js + COCO-SSD (~8MB) from CDN. Expect a **10–20 second delay** before detection starts. Subsequent videos reuse the cached model in memory. |
| **Long videos are slow** | Very long videos (1hr+) will take **several minutes** to scrub through all frames at the 2-second sampling interval. This is expected. |
| **Ad/DRM interference** | Some ad-heavy or DRM-protected videos may cause `seeked` events to behave unexpectedly. If the extension hangs, reload the page and retry. |
| **Internet required** | The extension requires an internet connection on first use to load TensorFlow.js, COCO-SSD, and jsPDF from their respective CDNs. |
| **Person detection threshold** | The person-area threshold is set to 10% of frame area. Videos with small picture-in-picture webcam overlays will still be treated as slide frames (by design). |
| **Perceptual hash sensitivity** | The deduplication hamming threshold is set to 5/64 bits. Very similar but slightly different slides (e.g. with minor text additions) may be incorrectly merged. |

---

## Test Environment

- **Browser:** Google Chrome (latest stable)
- **Extension manifest:** Manifest V3
- **OS:** Windows / macOS / Linux (Chrome required)
- **Network:** Internet connection required for first run

---

*Last updated: April 2026*
