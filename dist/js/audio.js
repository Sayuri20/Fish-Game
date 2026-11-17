/* AI assistance was used to simplify optional browser-generated feedback tones. */
let audioContext = null;

export function playTone(kind, enabled) {
  if (enabled === false) {
    return;
  }
  try {
    if (audioContext === null) {
      audioContext = new window.AudioContext();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    let oscillator = audioContext.createOscillator();
    let volume = audioContext.createGain();
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    let frequency = 440;
    if (kind === "correct") {
      frequency = 660;
    } else if (kind === "wrong") {
      frequency = 220;
    }
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.055, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.18,
    );
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    // I let the game continue even if the browser blocks the sound.
  }
}
