(function () {
  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < String(value).length; i += 1) {
      hash = (hash * 31 + String(value).charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function midiToHz(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function hasGenre(track, names) {
    const genres = new Set((track?.genres || []).map((genre) => genre.toLowerCase()));
    return names.some((name) => genres.has(name));
  }

  class SimAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.mix = null;
      this.timers = [];
      this.nodes = [];
      this.step = 0;
      this.volume = 0.76;
      this.active = false;
      this.trackKey = "";
    }

    async unlock() {
      await this.ensureContext();
      if (this.ctx.state !== "running") await this.ctx.resume();
    }

    async ensureContext() {
      if (this.ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Web Audio is not available");
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.28;

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
    }

    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value) / 100 || 0));
      if (!this.master || !this.ctx) return;
      const target = this.volume * 0.28;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.035);
    }

    async start(track, volume) {
      this.setVolume(volume);
      await this.unlock();
      this.stop(false);
      this.trackKey = track?.id || track?.query || "radiox";
      this.active = true;

      this.mix = this.ctx.createGain();
      this.mix.gain.value = 0.0001;
      this.mix.connect(this.master);
      this.mix.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.18);

      const style = this.styleFor(track);
      this.createPad(track, style);
      this.createAtmosphere(track, style);
      this.startSequencer(track, style);
    }

    stop(fade = true) {
      this.timers.forEach((timer) => clearInterval(timer));
      this.timers = [];
      this.step = 0;
      this.active = false;

      if (this.mix && this.ctx) {
        const mix = this.mix;
        const now = this.ctx.currentTime;
        mix.gain.cancelScheduledValues(now);
        mix.gain.setTargetAtTime(0.0001, now, fade ? 0.08 : 0.01);
        window.setTimeout(() => {
          try {
            mix.disconnect();
          } catch {
            /* no-op */
          }
        }, fade ? 420 : 40);
      }

      this.nodes.forEach((node) => {
        try {
          node.stop?.(this.ctx.currentTime + (fade ? 0.12 : 0.01));
        } catch {
          /* no-op */
        }
        window.setTimeout(() => {
          try {
            node.disconnect?.();
          } catch {
            /* no-op */
          }
        }, fade ? 360 : 40);
      });
      this.nodes = [];
      this.mix = null;
    }

    styleFor(track) {
      const energy = Math.max(12, Math.min(96, Number(track?.energy || 50)));
      const seed = hashString(track?.id || track?.query || track?.title || "radiox");
      const classical = hasGenre(track, ["classical", "neo-classical"]);
      const jazz = hasGenre(track, ["jazz"]);
      const blues = hasGenre(track, ["blues"]);
      const rock = hasGenre(track, ["hard-rock", "classic-rock", "metal", "alternative-rock", "grunge", "j-rock", "mandarin-rock"]);
      const folk = hasGenre(track, ["folk-rock", "pop-vocal"]);

      let bpm = 62 + energy * 0.58;
      if (classical) bpm -= 18;
      if (jazz || blues) bpm -= 7;
      if (rock) bpm += 9;
      if (folk) bpm -= 4;

      return {
        seed,
        energy,
        bpm: Math.round(Math.max(48, Math.min(142, bpm))),
        rootMidi: [41, 43, 45, 48, 50][seed % 5],
        minor: seed % 3 !== 0 || blues,
        drumLevel: classical ? 0.018 : rock ? 0.16 + energy / 900 : jazz || blues ? 0.08 : 0.055,
        bassLevel: classical ? 0.035 : rock ? 0.115 : jazz || blues ? 0.1 : 0.075,
        padLevel: rock && energy > 70 ? 0.03 : 0.06,
        pluckLevel: classical ? 0.095 : jazz || blues ? 0.07 : 0.045,
        oscillator: rock ? "sawtooth" : classical ? "sine" : "triangle",
        swing: jazz || blues ? 0.13 : 0
      };
    }

    scale(style) {
      return style.minor ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14];
    }

    createPad(track, style) {
      const notes = style.minor ? [0, 7, 12, 15] : [0, 7, 12, 16];
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = hasGenre(track, ["metal", "hard-rock"]) ? 780 : 1200;
      filter.Q.value = 0.7;
      filter.connect(this.mix);

      notes.forEach((interval, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = style.oscillator;
        osc.frequency.value = midiToHz(style.rootMidi + 24 + interval) * (index === 1 ? 1.002 : 1);
        gain.gain.value = style.padLevel / notes.length;
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        this.nodes.push(osc);
      });
    }

    createAtmosphere(track, style) {
      const buffer = this.noiseBuffer(2);
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = hasGenre(track, ["jazz", "blues"]) ? "bandpass" : "lowpass";
      filter.frequency.value = hasGenre(track, ["metal", "hard-rock"]) ? 4200 : 1800;
      filter.Q.value = hasGenre(track, ["jazz", "blues"]) ? 0.6 : 0.25;
      gain.gain.value = Math.min(0.032, 0.012 + style.energy / 4200);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.mix);
      source.start();
      this.nodes.push(source);
    }

    startSequencer(track, style) {
      const beatMs = 60000 / style.bpm;
      const playBeat = () => {
        if (!this.active || !this.ctx) return;
        const now = this.ctx.currentTime + 0.018 + (this.step % 2 ? style.swing : 0);
        const step = this.step % 16;
        const degrees = this.scale(style);
        const degree = degrees[(step + style.seed) % degrees.length];
        const bassMidi = style.rootMidi + degree + (step % 8 === 6 ? -5 : 0);

        if (step % 4 === 0 || (style.energy > 74 && step % 8 === 6)) {
          this.kick(now, style);
        }
        if (style.drumLevel > 0.04 && (step === 4 || step === 12)) {
          this.snare(now + 0.01, style);
        }
        if (style.drumLevel > 0.05 && step % 2 === 1) {
          this.hat(now, style);
        }
        if (step % 2 === 0) {
          this.bass(now, bassMidi, style);
        }
        if (step % (style.energy > 70 ? 3 : 4) === 0) {
          const melodyMidi = style.rootMidi + 36 + degrees[(step * 2 + style.seed) % degrees.length];
          this.pluck(now + 0.03, melodyMidi, style);
        }
        this.step += 1;
      };

      playBeat();
      this.timers.push(window.setInterval(playBeat, beatMs));
    }

    kick(when, style) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(98, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.18);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(style.drumLevel * 1.2, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
      osc.connect(gain);
      gain.connect(this.mix);
      osc.start(when);
      osc.stop(when + 0.26);
    }

    snare(when, style) {
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.noiseBuffer(0.25);
      filter.type = "highpass";
      filter.frequency.value = 1300;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(style.drumLevel * 0.62, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.mix);
      source.start(when);
      source.stop(when + 0.18);
    }

    hat(when, style) {
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = this.noiseBuffer(0.08);
      filter.type = "highpass";
      filter.frequency.value = 6200;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(style.drumLevel * 0.24, when + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.mix);
      source.start(when);
      source.stop(when + 0.07);
    }

    bass(when, midi, style) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = style.energy > 70 ? "sawtooth" : "triangle";
      osc.frequency.value = midiToHz(midi);
      filter.type = "lowpass";
      filter.frequency.value = 260;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(style.bassLevel, when + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.mix);
      osc.start(when);
      osc.stop(when + 0.38);
    }

    pluck(when, midi, style) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = style.oscillator === "sine" ? "triangle" : "square";
      osc.frequency.value = midiToHz(midi);
      filter.type = "lowpass";
      filter.frequency.value = style.energy > 70 ? 2400 : 1500;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(style.pluckLevel, when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.mix);
      osc.start(when);
      osc.stop(when + 0.46);
    }

    noiseBuffer(duration) {
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }
  }

  window.SimAudio = SimAudio;
})();
