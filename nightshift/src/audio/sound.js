export class Sound {
  constructor() {
    this.ctx = null;
  }
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.osc = this.ctx.createOscillator();
    this.filter = this.ctx.createBiquadFilter();
    this.gain = this.ctx.createGain();
    this.osc.type = "sawtooth";
    this.filter.type = "lowpass";
    this.filter.frequency.value = 450;
    this.osc
      .connect(this.filter)
      .connect(this.gain)
      .connect(this.ctx.destination);
    this.gain.gain.value = 0;
    this.osc.start();
  }
  impact(volume) {
    if (!this.ctx || this.ctx.currentTime - (this.lastImpact || -1) < 0.35)
      return;
    let t = this.ctx.currentTime;
    this.lastImpact = t;
    let o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.13);
    g.gain.setValueAtTime(Math.max(0.0001, volume * 0.18), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.16);
  }
  update(speed, volume, playing) {
    if (!this.ctx) return;
    let t = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(48 + speed * 2.5, t, 0.12);
    this.filter.frequency.setTargetAtTime(300 + speed * 13, t, 0.15);
    this.gain.gain.setTargetAtTime(playing ? volume * 0.09 : 0, t, 0.1);
  }
}
