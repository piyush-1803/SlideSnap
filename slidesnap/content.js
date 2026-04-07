// content.js — SlideSnap frame sampler for YouTube player

(function () {
  "use strict";

  // ── Constants ────────────────────────────────────────────────────────

  const SAMPLE_INTERVAL_SEC = 2;
  const PERSON_AREA_THRESHOLD = 0.10; // 10 % of frame area — for future filtering

  // ── Shared state ─────────────────────────────────────────────────────

  let isActive = false;
  let capturedFrames = []; // { timestamp, dataURL }
  let isScrubbing = false;
  let originalTime = 0;
  let lastUrl = window.location.href;
  let detector = null;
  let frameWidth = 0;
  let frameHeight = 0;

  // ── Overlay helpers ──────────────────────────────────────────────────

  function ensureOverlay() {
    let overlay = document.getElementById("slidesnap-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "slidesnap-overlay";

    const text = document.createElement("div");
    text.className = "slidesnap-overlay-text";

    const track = document.createElement("div");
    track.className = "slidesnap-progress-bar-track";

    const fill = document.createElement("div");
    fill.className = "slidesnap-progress-bar-fill";

    track.appendChild(fill);
    overlay.appendChild(text);
    overlay.appendChild(track);
    document.body.appendChild(overlay);

    return overlay;
  }

  function showOverlay(message, progressPct) {
    const overlay = ensureOverlay();
    overlay.style.display = "block";
    overlay.querySelector(".slidesnap-overlay-text").textContent = message;
    overlay.querySelector(".slidesnap-progress-bar-fill").style.width =
      Math.min(100, Math.round(progressPct)) + "%";
  }

  function hideOverlay() {
    const overlay = document.getElementById("slidesnap-overlay");
    if (overlay) overlay.style.display = "none";
  }



  // ── Core capture logic ───────────────────────────────────────────────

  async function captureAllFrames(video) {
    const duration = video.duration;
    if (!duration || !isFinite(duration)) {
      showOverlay("⚠️ Cannot read video duration.", 0);
      isScrubbing = false;
      return;
    }

    const wasPaused = video.paused;
    if (!wasPaused) video.pause();

    if (!video.videoWidth || !video.videoHeight) {
      alert("Video dimensions unavailable.");
      isScrubbing = false;
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    // Store dimensions for person detection later
    frameWidth = video.videoWidth;
    frameHeight = video.videoHeight;

    const totalSamples = Math.ceil(duration / SAMPLE_INTERVAL_SEC);

    for (let t = 0; t < duration; t += SAMPLE_INTERVAL_SEC) {
      // Bail out if the user toggled off mid-scrub
      if (!isScrubbing) {
        console.log("SlideSnap: capture cancelled by user.");
        break;
      }

      // Seek and wait
      video.currentTime = t;
      await new Promise((resolve) => {
        const startTime = Date.now();
        const check = () => {
          if (video.readyState >= 2 || (Date.now() - startTime > 3000)) return resolve();
          setTimeout(check, 100);
        };
        check();
      });

      // Draw current frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL("image/jpeg", 0.92);

      capturedFrames.push({ timestamp: t, dataURL: dataURL });

      // Update progress overlay
      const frameIndex = Math.floor(t / SAMPLE_INTERVAL_SEC) + 1;
      const pct = (frameIndex / totalSamples) * 100;
      showOverlay(
        "📸 Capturing frames... " + frameIndex + " / " + totalSamples,
        pct
      );
    }

    // Restore playback position
    video.currentTime = originalTime;
    if (!wasPaused) video.play();

    if (capturedFrames.length > 0) {
      showOverlay(
        "✅ Captured " + capturedFrames.length + " frames. Processing…",
        100
      );
      console.log(
        "SlideSnap: captured " + capturedFrames.length + " frames."
      );
      // Proceed to person-detection filtering
      processFrames();
    } else {
      isScrubbing = false;
      hideOverlay();
    }
  }

  // ── Frame processing (via Offscreen Document) ───────────────────────

  async function processFrames() {
    showOverlay('🔍 Detecting slides...', 0);
    console.log('[SlideSnap] total frames to process:', capturedFrames.length);

    // Diagnostic Ping to check if BG is alive
    try {
      const pingStatus = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'ping' }, resolve);
      });
      console.log('[SlideSnap] background ping status:', pingStatus);
    } catch (e) {
      console.error('[SlideSnap] background ping failed:', e);
    }

    const BATCH_SIZE = 20;
    const allSlideFrames = [];

    for (let i = 0; i < capturedFrames.length; i += BATCH_SIZE) {
      // Allow user to stop mid-process
      if (!isScrubbing) break;

      const batch = capturedFrames.slice(i, i + BATCH_SIZE);
      const progress = Math.round((i / capturedFrames.length) * 100);
      showOverlay(`🔍 Detecting slides... ${allSlideFrames.length} found`, 
        progress);

      console.log(`[SlideSnap] sending batch: ${i}..${i + batch.length}`);
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'run-detection',
          frames: batch,
          threshold: PERSON_AREA_THRESHOLD
        }, resolve);
      });

      if (response?.slideFrames) {
        allSlideFrames.push(...response.slideFrames);
      } else {
        console.warn(`[SlideSnap] batch ${i} returned no slides or error:`, response?.error);
      }
    }

    if (!isScrubbing) {
       console.log('[SlideSnap] processing aborted by user.');
       return;
    }

    console.log('[SlideSnap] final slide frames count:', allSlideFrames.length);
    showOverlay('🗂️ Removing duplicates...', 100);
    deduplicateFrames(allSlideFrames);
  }

  // ── Perceptual hash deduplication ─────────────────────────────────────

  const HAMMING_THRESHOLD = 10; // hashes within this distance are "same slide" (increased from 5 for better merging)

  function getImageHash(dataURL, hashSize) {
    hashSize = hashSize || 8;
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = hashSize;
        canvas.height = hashSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, hashSize, hashSize);

        const pixels = ctx.getImageData(0, 0, hashSize, hashSize).data;
        const grays = [];
        for (let i = 0; i < pixels.length; i += 4) {
          grays.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
        }

        let sum = 0;
        for (let i = 0; i < grays.length; i++) sum += grays[i];
        const mean = sum / grays.length;

        let hash = "";
        for (let i = 0; i < grays.length; i++) {
          hash += grays[i] >= mean ? "1" : "0";
        }

        resolve(hash);
      };
      img.src = dataURL;
    });
  }

  function hammingDistance(hash1, hash2) {
    let dist = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) dist++;
    }
    return dist;
  }

  async function deduplicateFrames(slideFrames) {
    showOverlay("🗂️ Removing duplicates...", 100);

    if (slideFrames.length === 0) {
      showOverlay("✅ No slide frames found.", 100);
      setTimeout(hideOverlay, 2000);
      return;
    }

    // Compute perceptual hash for every frame
    const hashes = await Promise.all(
      slideFrames.map(function (frame) {
        return getImageHash(frame.dataURL);
      })
    );

    // Greedy dedup: keep a frame only if it differs enough from all kept frames
    const uniqueFrames = [];
    const uniqueHashes = [];

    for (let i = 0; i < slideFrames.length; i++) {
      let isDuplicate = false;
      for (let j = 0; j < uniqueHashes.length; j++) {
        if (hammingDistance(hashes[i], uniqueHashes[j]) <= HAMMING_THRESHOLD) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        uniqueFrames.push(slideFrames[i]);
        uniqueHashes.push(hashes[i]);
      }

      // Update overlay progress
      const pct = ((i + 1) / slideFrames.length) * 100;
      showOverlay(
        "🗂️ Deduplicating... " + uniqueFrames.length + " unique / " + (i + 1),
        pct
      );
    }

    console.log(
      "SlideSnap: dedup complete — " +
        uniqueFrames.length +
        " unique slides from " +
        slideFrames.length +
        " candidates"
    );

    showOverlay(
      "✅ " + uniqueFrames.length + " unique slides ready!",
      100
    );

    // Proceed to PDF generation
    buildPDF(uniqueFrames);
  }

  // ── jsPDF loader ─────────────────────────────────────────────────────

  async function loadJsPDF() {
    if (window.jspdf) return;
    try {
      await import(chrome.runtime.getURL('lib/jspdf.umd.min.js'));
    } catch(err) {
      console.error("SlideSnap: jsPDF dynamic import failed", err);
      throw err;
    }
  }

  // ── PDF builder ──────────────────────────────────────────────────────

  async function buildPDF(uniqueFrames) {
    // Guard: nothing to build
    if (uniqueFrames.length === 0) {
      showOverlay("⚠️ No slides detected. Try a different video.", 100);
      setTimeout(function () {
        hideOverlay();
        var cb = document.getElementById("slidesnap-checkbox");
        if (cb) cb.checked = false;
        isActive = false;
      }, 3000);
      return;
    }

    showOverlay("📄 Building PDF...", 0);

    try {
      await loadJsPDF();
    } catch (err) {
      console.error("SlideSnap: jsPDF load error", err);
    }

    if (!window.jspdf) {
      alert("Failed to load PDF library.");
      hideOverlay();
      return;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [1280, 720],
    });

    for (var i = 0; i < uniqueFrames.length; i++) {
      if (i > 0) doc.addPage();

      var frame = uniqueFrames[i];
      var mins = Math.floor(frame.timestamp / 60);
      var secs = Math.floor(frame.timestamp % 60);
      var label =
        "Slide " +
        (i + 1) +
        "  |  " +
        mins +
        ":" +
        secs.toString().padStart(2, "0");

      doc.addImage(frame.dataURL, "JPEG", 0, 0, 1280, 700);

      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(label, 10, 715);

      // Update overlay progress
      var pct = ((i + 1) / uniqueFrames.length) * 100;
      showOverlay(
        "📄 Building PDF... page " + (i + 1) + " / " + uniqueFrames.length,
        pct
      );
    }

    // Derive filename from video title
    var title = document.title.replace(/ - YouTube$/i, "").trim();
    var filename = title.replace(/[^a-z0-9]/gi, "_") + "_slides.pdf";

    try {
      doc.save(filename);

      showOverlay(
        "✅ PDF downloaded! (" + uniqueFrames.length + " slides)",
        100
      );
    } catch (saveErr) {
      console.error("SlideSnap: PDF save failed", saveErr);
      showOverlay("❌ PDF save failed. Try again.", 100);
    }

    // Reset toggle after 3 seconds
    setTimeout(function () {
      hideOverlay();
      var checkbox = document.getElementById("slidesnap-checkbox");
      if (checkbox) checkbox.checked = false;
      isActive = false;
    }, 3000);
  }

  // ── Start / Stop ─────────────────────────────────────────────────────

  function startSlideSnap() {
    try {
      const video = document.querySelector("video");
      if (!video) {
        alert("No video found on this page.");
        return;
      }

      if (!video.duration || isNaN(video.duration) || video.duration === 0) {
        alert("Video is not ready yet. Wait for it to fully load.");
        return;
      }

      originalTime = video.currentTime;
      capturedFrames = [];
      isScrubbing = true;

      showOverlay("📸 Capturing frames…", 0);
      captureAllFrames(video);
    } catch (err) {
      console.error("SlideSnap: startSlideSnap error", err);
      hideOverlay();
      var checkbox = document.getElementById("slidesnap-checkbox");
      if (checkbox) checkbox.checked = false;
      isActive = false;
    }
  }

  function stopSlideSnap() {
    isScrubbing = false;
    hideOverlay();
    capturedFrames = [];

    const video = document.querySelector("video");
    if (video) {
      video.currentTime = originalTime;
    }
  }

  // ── Button creation ──────────────────────────────────────────────────

  function createToggleButton() {
    const wrapper = document.createElement("div");
    wrapper.id = "slidesnap-toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "slidesnap-checkbox";
    checkbox.checked = false;

    const label = document.createElement("label");
    label.htmlFor = "slidesnap-checkbox";
    label.className = "slidesnap-switch";

    const text = document.createElement("span");
    text.className = "slidesnap-label";
    text.textContent = "SlideSnap";

    checkbox.addEventListener("change", function () {
      if (this.checked) {
        isActive = true;
        startSlideSnap();
      } else {
        isActive = false;
        stopSlideSnap();
      }
    });

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    wrapper.appendChild(text);

    return wrapper;
  }

  // ── Injection logic ──────────────────────────────────────────────────

  function injectButton() {
    if (document.getElementById("slidesnap-toggle")) return;

    const rightControls = document.querySelector(".ytp-right-controls");
    if (!rightControls) return;

    rightControls.prepend(createToggleButton());
    isActive = false;
  }

  function removeButton() {
    const existing = document.getElementById("slidesnap-toggle");
    if (existing) existing.remove();

    if (isActive) {
      isActive = false;
      stopSlideSnap();
    }
  }

  // ── Polling-based injection ────────────────────────────────────────────

  let injectIntervalId = null;

  function tryInject() {
    if (document.getElementById("slidesnap-toggle")) {
      // Already injected — stop polling
      if (injectIntervalId) {
        clearInterval(injectIntervalId);
        injectIntervalId = null;
      }
      return;
    }

    const rightControls = document.querySelector(".ytp-right-controls");
    if (rightControls) {
      injectButton();
      if (injectIntervalId) {
        clearInterval(injectIntervalId);
        injectIntervalId = null;
      }
    }
  }

  function startInjectionPolling() {
    // Clear any existing polling interval
    if (injectIntervalId) {
      clearInterval(injectIntervalId);
    }
    injectIntervalId = setInterval(tryInject, 800);
    // Also try immediately
    tryInject();
  }

  // ── URL change detection (SPA navigation) ────────────────────────────

  function watchUrlChanges() {
    setInterval(function () {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        removeButton();
        // Restart polling to find controls on the new page
        setTimeout(startInjectionPolling, 500);
      }
    }, 1500);
  }

  // ── Init ──────────────────────────────────────────────────────────────

  startInjectionPolling();
  watchUrlChanges();

  // ── Global error guard ────────────────────────────────────────────────

  window.addEventListener("unhandledrejection", function (event) {
    console.error("SlideSnap unhandled rejection:", event.reason);
  });
})();
