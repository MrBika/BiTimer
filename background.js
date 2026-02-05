const ALARM_NAME = "bitimer-end";
const OFFSCREEN_URL = "offscreen.html";

// Crée un document offscreen pour jouer un son lorsque le timer finit.
const ensureOffscreenDocument = async () => {
  const hasDocument = await chrome.offscreen.hasDocument();
  if (hasDocument) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Jouer un son court lorsque le timer se termine.",
  });
};

const playSound = async () => {
  await ensureOffscreenDocument();
  chrome.runtime.sendMessage({ type: "play-sound" });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["defaultDurationSec", "soundEnabled", "remainingSec"], (data) => {
    const defaultDurationSec = data.defaultDurationSec ?? 15 * 60;
    const soundEnabled = data.soundEnabled ?? true;
    const remainingSec = data.remainingSec ?? defaultDurationSec;

    chrome.storage.local.set({
      defaultDurationSec,
      soundEnabled,
      remainingSec,
      running: false,
      endTime: null,
    });
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  const { soundEnabled } = await chrome.storage.local.get(["soundEnabled"]);

  await chrome.storage.local.set({
    running: false,
    remainingSec: 0,
    endTime: null,
    lastCompletedAt: Date.now(),
  });

  if (soundEnabled) {
    await playSound();
  }
});
