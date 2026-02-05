// Génère un bip discret via Web Audio API.
const playTone = (context, { frequency, duration, startAt }) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  const startTime = context.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

const playSound = (soundId) => {
  const context = new AudioContext();
  const sequence = {
    beep: [{ frequency: 880, duration: 0.4, startAt: 0 }],
    bell: [
      { frequency: 988, duration: 0.2, startAt: 0 },
      { frequency: 784, duration: 0.25, startAt: 0.22 },
    ],
    chime: [
      { frequency: 659, duration: 0.18, startAt: 0 },
      { frequency: 784, duration: 0.18, startAt: 0.18 },
      { frequency: 988, duration: 0.22, startAt: 0.36 },
    ],
  };

  const tones = sequence[soundId] ?? sequence.beep;
  tones.forEach((tone) => playTone(context, tone));

  const totalDuration = Math.max(...tones.map((tone) => tone.startAt + tone.duration));
  setTimeout(() => {
    context.close();
  }, (totalDuration + 0.1) * 1000);
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "play-sound") {
    playSound(message.soundId);
  }
});
