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

const playSound = async (soundId, soundVolume) => {
  await ensureOffscreenDocument();
  chrome.runtime.sendMessage({ type: "play-sound", soundId, soundVolume });
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    ["defaultDurationSec", "soundEnabled", "soundVolume", "remainingSec", "soundId"],
    (data) => {
      const defaultDurationSec = data.defaultDurationSec ?? 15 * 60;
      const soundEnabled = data.soundEnabled ?? true;
      const remainingSec = data.remainingSec ?? defaultDurationSec;
      const soundId = data.soundId ?? "beep";
      const soundVolume = data.soundVolume ?? 0.7;

      chrome.storage.local.set({
        defaultDurationSec,
        soundEnabled,
        soundVolume,
        soundId,
        remainingSec,
        running: false,
        endTime: null,
      });
    }
  );
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  const { soundEnabled, soundId, soundVolume } = await chrome.storage.local.get([
    "soundEnabled",
    "soundId",
    "soundVolume",
  ]);

  await chrome.storage.local.set({
    running: false,
    remainingSec: 0,
    endTime: null,
    lastCompletedAt: Date.now(),
  });

  if (soundEnabled) {
    await playSound(soundId, soundVolume);
  }
});
