let audioCtx: AudioContext | null = null;

function beep(ctx: AudioContext, at: number, freq: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.15);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/** Reproduce un timbre de notificación corto usando la Web Audio API (sin archivos). */
export function playNotificationSound(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    beep(audioCtx, now, 880);
    beep(audioCtx, now + 0.14, 660);
  } catch {
    // Audio no disponible; se ignora en silencio.
  }
}
