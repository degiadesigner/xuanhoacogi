const names = [
  'csgo_ui_crate_open', 
  'csgo_ui_crate_item_scroll', 
  'item_reveal3_rare', 
  'item_reveal4_mythical', 
  'item_reveal5_legendary', 
  'item_reveal6_ancient'
] as const;
export type CaseSound = typeof names[number];

/** Dual-engine Audio Player: Web Audio API with seamless HTML5 Audio fallback */
export class CaseAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private buffers = new Map<CaseSound, AudioBuffer>();
  private audioPool = new Map<CaseSound, HTMLAudioElement[]>();
  private poolIndex = new Map<CaseSound, number>();
  private muted = false;
  private disposed = false;
  private activated = false;

  constructor(private base: string = '') {}

  private getSoundUrl(name: CaseSound): string {
    const prefix = this.base ? this.base.replace(/\/$/, '') : '';
    return `${prefix}/sounds/${name}.mp3`;
  }

  preload() {
    try {
      this.prepareContext();
    } catch {}

    // 1. Prepare HTML5 Audio fallback elements for immediate playback
    for (const name of names) {
      const url = this.getSoundUrl(name);
      // For rapid ticks, prepare a pool of 8 elements
      const count = name === 'csgo_ui_crate_item_scroll' ? 8 : 2;
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const a = new Audio(url);
          a.preload = 'auto';
          pool.push(a);
        } catch {}
      }
      this.audioPool.set(name, pool);
      this.poolIndex.set(name, 0);

      // 2. Decode into Web Audio Buffer
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(data => {
          if (this.context) {
            return this.context.decodeAudioData(data).then(buffer => {
              if (!this.disposed) this.buffers.set(name, buffer);
            });
          }
        })
        .catch(() => {});
    }
  }

  private prepareContext() {
    if (this.context) return;
    const Constructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Constructor) return;
    this.context = new Constructor();
    this.gain = this.context.createGain();
    this.gain.gain.value = this.muted ? 0 : 0.7;
    this.gain.connect(this.context.destination);
  }

  recover() {
    if (this.activated && !this.muted) {
      this.unlock();
    }
  }

  unlock() {
    if (this.disposed || this.muted) return;
    this.activated = true;
    try {
      this.prepareContext();
      if (this.context && this.context.state === 'suspended') {
        void this.context.resume().catch(() => {});
      }
      // Prime audio elements with user gesture
      const scrollPool = this.audioPool.get('csgo_ui_crate_item_scroll');
      if (scrollPool && scrollPool[0]) {
        scrollPool[0].load();
      }
    } catch {}
  }

  play(name: CaseSound) {
    if (this.disposed || this.muted || document.hidden) return;

    // A. Web Audio API playback if ready
    if (this.context && this.context.state === 'running' && this.buffers.has(name)) {
      try {
        const source = this.context.createBufferSource();
        source.buffer = this.buffers.get(name)!;
        source.connect(this.gain!);
        source.start();
        return;
      } catch {}
    }

    // If context was suspended, trigger resume
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume().catch(() => {});
    }

    // B. HTML5 Audio pool fallback (100% reliable on user click in all browsers)
    const pool = this.audioPool.get(name);
    if (pool && pool.length > 0) {
      const idx = this.poolIndex.get(name) || 0;
      const audio = pool[idx];
      this.poolIndex.set(name, (idx + 1) % pool.length);
      try {
        audio.volume = this.muted ? 0 : (name === 'csgo_ui_crate_item_scroll' ? 0.35 : 0.7);
        audio.currentTime = 0;
        void audio.play().catch(() => {});
        return;
      } catch {}
    }

    // C. Dynamic Audio fallback
    try {
      const audio = new Audio(this.getSoundUrl(name));
      audio.volume = this.muted ? 0 : 0.7;
      void audio.play().catch(() => {});
    } catch {}
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gain) {
      this.gain.gain.value = muted ? 0 : 0.7;
    }
    this.audioPool.forEach(pool => {
      pool.forEach(a => {
        a.volume = muted ? 0 : 0.7;
      });
    });
  }

  pause() {
    this.audioPool.forEach(pool => {
      pool.forEach(a => {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {}
      });
    });
  }

  dispose() {
    this.disposed = true;
    this.pause();
    try {
      void this.context?.close();
    } catch {}
  }
}
