// Génère un bip discret via Web Audio API.
const playBeep = () => {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.4);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);

  oscillator.onended = () => {
    context.close();
  };
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "play-sound") {
    playBeep();
  }
});
