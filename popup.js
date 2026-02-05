const DEFAULT_DURATION_SEC = 15 * 60;
const ALARM_NAME = "bitimer-end";

const elements = {
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  startPause: document.getElementById("startPause"),
  reset: document.getElementById("reset"),
  addMinute: document.getElementById("addMinute"),
  defaultMinutes: document.getElementById("defaultMinutes"),
  defaultSeconds: document.getElementById("defaultSeconds"),
  soundEnabled: document.getElementById("soundEnabled"),
  soundSelect: document.getElementById("soundSelect"),
};

// État local synchronisé avec chrome.storage.
let state = {
  running: false,
  remainingSec: DEFAULT_DURATION_SEC,
  endTime: null,
  defaultDurationSec: DEFAULT_DURATION_SEC,
  soundEnabled: true,
  soundId: "beep",
};

const formatNumber = (value) => String(value).padStart(2, "0");

const updateDisplay = (remainingSec) => {
  const minutes = Math.floor(remainingSec / 60);
  const seconds = Math.max(0, remainingSec % 60);
  elements.minutes.textContent = formatNumber(minutes);
  elements.seconds.textContent = formatNumber(seconds);
};

const updateStartButton = () => {
  if (state.running) {
    elements.startPause.textContent = "⏸";
    elements.startPause.classList.add("is-paused");
  } else {
    elements.startPause.textContent = "▶️";
    elements.startPause.classList.remove("is-paused");
  }
};

const syncStorage = async (updates) => {
  await chrome.storage.local.set(updates);
};

// Calcule le temps restant via endTime pour rester précis.
const calculateRemaining = () => {
  if (!state.endTime) {
    return state.remainingSec;
  }
  const diff = Math.ceil((state.endTime - Date.now()) / 1000);
  return Math.max(0, diff);
};

const persistTimerState = async () => {
  await syncStorage({
    running: state.running,
    remainingSec: state.remainingSec,
    endTime: state.endTime,
  });
};

const ensureDefaults = async () => {
  const stored = await chrome.storage.local.get([
    "running",
    "remainingSec",
    "endTime",
    "defaultDurationSec",
    "soundEnabled",
    "soundId",
  ]);

  state.defaultDurationSec = stored.defaultDurationSec ?? DEFAULT_DURATION_SEC;
  state.soundEnabled = stored.soundEnabled ?? true;
  state.soundId = stored.soundId ?? "beep";
  state.running = stored.running ?? false;
  state.remainingSec = stored.remainingSec ?? state.defaultDurationSec;
  state.endTime = stored.endTime ?? null;

  if (state.running && state.endTime) {
    state.remainingSec = calculateRemaining();
    if (state.remainingSec === 0) {
      state.running = false;
      state.endTime = null;
    }
  }

  const defaultMinutes = Math.floor(state.defaultDurationSec / 60);
  const defaultSeconds = state.defaultDurationSec % 60;
  elements.defaultMinutes.value = defaultMinutes;
  elements.defaultSeconds.value = defaultSeconds;
  elements.soundEnabled.checked = state.soundEnabled;
  elements.soundSelect.value = state.soundId;

  updateDisplay(state.remainingSec);
  updateStartButton();

  await syncStorage({
    defaultDurationSec: state.defaultDurationSec,
    soundEnabled: state.soundEnabled,
    soundId: state.soundId,
    running: state.running,
    remainingSec: state.remainingSec,
    endTime: state.endTime,
  });
};

// Démarre le timer en créant une alarme pour la fin.
const startTimer = async () => {
  const remaining = state.remainingSec > 0 ? state.remainingSec : state.defaultDurationSec;
  state.running = true;
  state.endTime = Date.now() + remaining * 1000;
  state.remainingSec = remaining;
  updateStartButton();
  await persistTimerState();
  chrome.alarms.create(ALARM_NAME, { when: state.endTime });
};

// Met en pause le timer et stocke le temps restant.
const pauseTimer = async () => {
  state.remainingSec = calculateRemaining();
  state.running = false;
  state.endTime = null;
  updateStartButton();
  await persistTimerState();
  chrome.alarms.clear(ALARM_NAME);
};

// Réinitialise à la durée par défaut.
const resetTimer = async () => {
  state.running = false;
  state.remainingSec = state.defaultDurationSec;
  state.endTime = null;
  updateDisplay(state.remainingSec);
  updateStartButton();
  await persistTimerState();
  chrome.alarms.clear(ALARM_NAME);
};

// Ajoute 60 secondes au timer courant.
const addMinute = async () => {
  if (state.running && state.endTime) {
    state.endTime += 60 * 1000;
  }
  state.remainingSec += 60;
  updateDisplay(state.remainingSec);
  await persistTimerState();
  if (state.running) {
    chrome.alarms.create(ALARM_NAME, { when: state.endTime });
  }
};

const handleDefaultDurationChange = async (event) => {
  const minutes = Math.max(0, Number(elements.defaultMinutes.value || 0));
  const seconds = Math.min(59, Math.max(0, Number(elements.defaultSeconds.value || 0)));
  const total = minutes * 60 + seconds;
  state.defaultDurationSec = total > 0 ? total : 60;
  elements.defaultMinutes.value = Math.floor(state.defaultDurationSec / 60);
  elements.defaultSeconds.value = state.defaultDurationSec % 60;
  await syncStorage({ defaultDurationSec: state.defaultDurationSec });
  if (!state.running) {
    state.remainingSec = state.defaultDurationSec;
    updateDisplay(state.remainingSec);
    await persistTimerState();
  }
};

const handleSoundToggle = async (event) => {
  state.soundEnabled = event.target.checked;
  await syncStorage({ soundEnabled: state.soundEnabled });
};

const handleSoundSelect = async (event) => {
  state.soundId = event.target.value;
  await syncStorage({ soundId: state.soundId });
};

// Rafraîchit l'affichage sans dépendre de l'interval Chrome.
const tick = () => {
  if (!state.running) {
    return;
  }
  state.remainingSec = calculateRemaining();
  updateDisplay(state.remainingSec);
  if (state.remainingSec === 0) {
    state.running = false;
    state.endTime = null;
    persistTimerState();
    updateStartButton();
  }
};

const bindEvents = () => {
  elements.startPause.addEventListener("click", () => {
    if (state.running) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  elements.reset.addEventListener("click", resetTimer);
  elements.addMinute.addEventListener("click", addMinute);
  elements.defaultMinutes.addEventListener("change", handleDefaultDurationChange);
  elements.defaultSeconds.addEventListener("change", handleDefaultDurationChange);
  elements.soundEnabled.addEventListener("change", handleSoundToggle);
  elements.soundSelect.addEventListener("change", handleSoundSelect);

  // Synchronise l'UI si un autre contexte (service worker) modifie l'état.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.running) {
      state.running = changes.running.newValue;
      updateStartButton();
    }
    if (changes.remainingSec) {
      state.remainingSec = changes.remainingSec.newValue;
      updateDisplay(state.remainingSec);
    }
    if (changes.endTime) {
      state.endTime = changes.endTime.newValue;
    }
    if (changes.soundId) {
      state.soundId = changes.soundId.newValue;
      elements.soundSelect.value = state.soundId;
    }
  });
};

const init = async () => {
  await ensureDefaults();
  bindEvents();
  setInterval(tick, 250);
};

init();
