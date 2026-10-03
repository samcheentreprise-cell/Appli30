// Audio notification utility using Web Audio API for mobile & desktop
export function playAlertSound(type: 'rejection' | 'success' | 'warning' = 'rejection') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Resume if suspended (mobile autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (type === 'rejection') {
      // 2-tone descending buzzer alert for rejection
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(440, now); // A4
      osc1.frequency.exponentialRampToValueAtTime(220, now + 0.25); // A3
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(330, now + 0.3); // E4
      osc2.frequency.exponentialRampToValueAtTime(165, now + 0.6); // E3
      gain2.gain.setValueAtTime(0.35, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.3);
      osc2.stop(now + 0.6);

      // Mobile phone vibration
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 300]);
      }
    } else if (type === 'success') {
      // 2-tone ascending chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}
