export type SoundEvent = 'join_call' | 'leave_call' | 'outgoing_call' | 'incoming_call' | 'message_sent' | 'message_received' | 'notification';
const tones: Record<SoundEvent, number[]> = { join_call:[660,880], leave_call:[660,440], outgoing_call:[520,660], incoming_call:[880,660], message_sent:[740], message_received:[587], notification:[988] };

class AudioManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private volume = .55;
  private muted = false;
  private lastPlayed = new Map<string, number>();
  private active: OscillatorNode[] = [];
  private loopTimer: number | null = null;
  private customAudio: HTMLAudioElement | null = null;

  constructor() {
    try { const prefs = JSON.parse(localStorage.getItem('koaline:audio-settings') || '{}'); this.volume = Math.max(0, Math.min(1, Number(prefs.volume ?? .55))); this.muted = Boolean(prefs.muted); } catch { /* Preferências padrão. */ }
    const unlock = () => { void this.unlock(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }
  private async unlock() {
    try {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      this.ctx ||= new AudioContextCtor();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
    } catch { this.unlocked = false; }
  }
  setPreferences(volume: number, muted: boolean) {
    this.volume = Math.max(0, Math.min(1, volume)); this.muted = muted;
    if (this.customAudio) this.customAudio.volume = this.volume;
    try { localStorage.setItem('koaline:audio-settings', JSON.stringify({ volume: this.volume, muted })); } catch { /* O som não depende de persistência. */ }
    if (muted) this.stop();
  }
  async play(event: SoundEvent, loop = false) {
    if (this.muted || !this.unlocked || !this.ctx) return;
    const now = Date.now(); if (now - (this.lastPlayed.get(event) || 0) < 1000) return;
    this.lastPlayed.set(event, now); this.stop();
    const playTone = () => tones[event].forEach((frequency, index) => {
      if (!this.ctx || this.muted) return;
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(); osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(this.volume * .12, this.ctx.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + .18);
      osc.connect(gain).connect(this.ctx.destination); osc.start(this.ctx.currentTime + index * .12); osc.stop(this.ctx.currentTime + index * .12 + .2); this.active.push(osc);
    });
    playTone(); if (loop) this.loopTimer = window.setInterval(playTone, 1200);
  }
  playCustom(url: string) { if (this.muted || !this.unlocked) return; this.stop(); const audio = new Audio(url); audio.volume = this.volume; this.customAudio = audio; void audio.play().catch(() => undefined); }
  stop() { if (this.loopTimer !== null) window.clearInterval(this.loopTimer); this.loopTimer = null; this.customAudio?.pause(); this.customAudio = null; this.active.forEach((osc) => { try { osc.stop(); } catch { /* Já encerrou. */ } }); this.active = []; }
}
export const audioManager = new AudioManager();
