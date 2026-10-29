"use client";

/** Suara sintetis Web Audio (offline-safe), tanpa berkas aset. */

function playTone(freq: number, duration: number, type: OscillatorType = "sine"): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    /* AudioContext dapat memerlukan gestur pengguna */
  }
}

export function playShutterSound(): void {
  playTone(1200, 0.08, "square"); // allow-dimension-literal (frekuensi Hz, bukan dimensi)
  setTimeout(() => playTone(600, 0.12, "sine"), 60);
}

export function playCountdownBeep(isFinal = false): void {
  playTone(isFinal ? 1200 : 750, isFinal ? 0.3 : 0.15, "triangle"); // allow-dimension-literal (frekuensi Hz)
}
