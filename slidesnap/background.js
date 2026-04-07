// background.js — SlideSnap service worker (Offscreen Document manager)

console.log("[SlideSnap BG] Service worker loaded!");

async function ensureOffscreenDocument() {
  // Check if offscreen doc already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existingContexts.length > 0) return;

  // Create it
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("offscreen.html"),
    reasons: ["DOM_SCRAPING"],
    justification: "Run TensorFlow.js person detection without YouTube CSP restrictions",
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log("[SlideSnap BG] Message received:", message.action);

  if (message.action === "ping") {
    sendResponse({ status: "alive" });
    return;
  }

  if (message.action === "run-detection") {
    console.log("BG: run-detection message received, frame count: " + message.frames.length);
    (async () => {
      try {
        console.log(`[SlideSnap BG] Batch start: ${message.frames.length} frames`);
        await ensureOffscreenDocument();
        
        // Wait a small amount for offscreen.js to initialize if it just opened
        await new Promise(r => setTimeout(r, 250));

        console.log("[SlideSnap BG] Sending to offscreen...");
        const response = await chrome.runtime.sendMessage({
          action: "detect-frames",
          frames: message.frames,
          threshold: message.threshold,
        });

        if (!response) {
          console.error("[SlideSnap BG] No response from offscreen document!");
          sendResponse({ slideFrames: [], error: "No response from offscreen" });
          return;
        }

        console.log(`[SlideSnap BG] Batch result: found ${response.slideFrames?.length || 0} slides`);
        sendResponse(response);
      } catch (err) {
        console.error("[SlideSnap BG] Detection relay error:", err);
        sendResponse({ slideFrames: [], error: err.message });
      }
    })();

    return true; // async
  }

  // Fallback for PDF message (legacy from previous design)
  if (message.type === "DOWNLOAD_PDF") {
    sendResponse({ status: "ok" });
  }
});
