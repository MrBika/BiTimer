const DEFAULT_DURATION_SEC = 15 * 60;
const ALARM_NAME = "bitimer-end";

const elements = {
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
  startPause: document.getElementById("startPause"),
  reset: document.getElementById("reset"),
  addMinute: document.getElementById("addMinute"),
  defaultDuration: document.getElementById("defaultDuration"),
  soundEnabled: document.getElementById("soundEnabled"),
};

// État local synchronisé avec chrome.storage.
let state = {
  running: false,
  remainingSec: DEFAULT_DURATION_SEC,
  endTime: null,
  defaultDurationSec: DEFAULT_DURATION_SEC,
  soundEnabled: true,
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
    elements.startPause.textContent = "⏸ Pause";
    elements.startPause.classList.add("is-paused");
  } else {
    elements.startPause.textContent = "▶️ Start";
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
  ]);

  state.defaultDurationSec = stored.defaultDurationSec ?? DEFAULT_DURATION_SEC;
  state.soundEnabled = stored.soundEnabled ?? true;
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

  elements.defaultDuration.value = Math.round(state.defaultDurationSec / 60);
  elements.soundEnabled.checked = state.soundEnabled;

  updateDisplay(state.remainingSec);
  updateStartButton();

  await syncStorage({
    defaultDurationSec: state.defaultDurationSec,
    soundEnabled: state.soundEnabled,
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
  const minutes = Math.max(1, Number(event.target.value || 1));
  state.defaultDurationSec = minutes * 60;
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
  elements.defaultDuration.addEventListener("change", handleDefaultDurationChange);
  elements.soundEnabled.addEventListener("change", handleSoundToggle);

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
  });
};

const init = async () => {
  await ensureDefaults();
  bindEvents();
  setInterval(tick, 250);
};

init();
