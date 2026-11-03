import { bindInput } from "../core/input.js";
import { evaluateModes } from "../modes/rules.js";
import * as THREE from "three";
import { createCity } from "../world/city.js";
import { createCar } from "../vehicles/car.js";
import { updateCar } from "../physics/drive.js";
import { cars, checkpoints, modes } from "../data/catalog.js";
import { Sound } from "../audio/sound.js";
import { Effects } from "./effects.js";
const fmt = (n) => Math.max(0, Math.ceil(n));
export class Game {
  constructor(canvas, save, onUpdate, onFinish) {
    this.canvas = canvas;
    this.save = save;
    this.onUpdate = onUpdate;
    this.onFinish = onFinish;
    this.input = {};
    this.state = "menu";
    this.mode = "street";
    this.cameraMode = 0;
    this.sound = new Sound();
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: save.settings.quality === "high",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, save.settings.quality === "high" ? 1.5 : 1),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 320);
    this.world = createCity(this.scene, save.settings.quality);
    this.effects = new Effects(this.scene);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.18, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0x00d9ff }),
    );
    this.ring.position.y = 5;
    this.scene.add(this.ring);
    this.arrow = new THREE.Mesh(
      new THREE.ConeGeometry(1, 2, 4),
      new THREE.MeshBasicMaterial({ color: 0x00d9ff }),
    );
    this.arrow.rotation.z = Math.PI;
    this.scene.add(this.arrow);
    this.cars = [];
    this.setCar();
    bindInput.call(this);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  makeState(index, x, z, angle = 0) {
    let d = cars[index],
      v = createCar(
        d,
        this.save.colors[d.id],
        this.save.rims[d.id],
        this.save.suspension[d.id] ?? 1,
      );
    this.scene.add(v.group);
    return {
      x,
      z,
      angle,
      vx: 0,
      vz: 0,
      speed: 0,
      slip: 0,
      nitro: 100,
      visual: v,
      data: d,
      passed: 0,
      next: 7,
      alive: true,
      stuck: 0,
    };
  }
  clear() {
    for (const c of this.cars) {
      this.scene.remove(c.visual.group);
      c.visual.body.dispose();
    }
    this.cars = [];
  }
  setCar() {
    this.clear();
    const index = Math.max(
      0,
      cars.findIndex((x) => x.id === this.save.active),
    );
    this.player = this.makeState(index, -70, -42);
    this.cars = [this.player];
    this.sync(this.player);
    this.camera.position.set(this.player.x + 8, 5, this.player.z + 8);
    this.camera.lookAt(this.player.x, 1, this.player.z);
  }
  stats(c) {
    const u = this.save.upgrades[c.data.id] || {};
    return {
      ...c.data,
      accel: c.data.accel + (u.engine || 0) * 2.3,
      brake: c.data.brake + (u.brakes || 0) * 2,
      grip:
        (c.data.grip + (u.grip || 0) * 0.25) *
        (1 + (1 - (this.save.suspension[c.data.id] ?? 1)) * 0.05),
    };
  }
  start(mode) {
    this.mode = mode;
    this.clear();
    let index = Math.max(
      0,
      cars.findIndex((x) => x.id === this.save.active),
    );
    this.player = this.makeState(
      index,
      mode === "drag" ? 296 : -70,
      mode === "drag" ? 190 : -42,
    );
    this.cars = [this.player];
    let count =
      mode === "street" || mode === "elimination"
        ? 3
        : mode === "drag" || mode === "police"
          ? 1
          : mode === "highway"
            ? 5
            : 0;
    for (let i = 0; i < count; i++) {
      let c = this.makeState(
        (i + 1) % cars.length,
        -70 + (i % 2 ? 3 : -3),
        -35 + Math.floor(i / 2) * 6,
      );
      if (mode === "drag") {
        c.x = 304;
        c.z = 190;
      }
      if (mode === "highway") {
        c.x = [0, 70, -70, 70, -70][i];
        c.z = [-20, 20, 20, 65, 60][i];
        c.next = [1, 2, 7, 3, 6][i];
      }
      this.cars.push(c);
    }
    this.elapsed = 0;
    this.countdown = 3;
    this.score = 0;
    this.distance = 0;
    this.arrest = 0;
    this.parking = 0;
    this.integrity = 100;
    this.damageCooldown = 0;
    this.nextElim = 25;
    this.status = "";
    this.state = "playing";
    this.input = {};
    this.camera.position.set(this.player.x, 4, this.player.z + 9);
    this.camera.lookAt(this.player.x, 1, this.player.z - 8);
    this.sound.start();
    this.world.park.visible = mode === "parking";
    this.world.drag.visible = mode === "drag";
    this.ring.visible = [
      "street",
      "time",
      "elimination",
      "drag",
      "parking",
    ].includes(mode);
    this.arrow.visible = this.ring.visible;
    if (mode === "drag") {
      this.ring.position.set(300, 5, -210);
      this.ring.rotation.y = 0;
      this.arrow.position.set(300, 13, -210);
    }
    if (mode === "parking") {
      this.ring.position.set(65, 5, 88);
      this.arrow.position.set(65, 13, 88);
    }
    this.onUpdate();
  }
  getCheckpoint(index) {
    return checkpoints[index];
  }
  resetCar() {
    const p = this.player;
    if (this.mode === "drag") {
      p.x = 296;
      p.z = 190;
      p.vx = p.vz = 0;
      p.angle = 0;
      return;
    }
    let checkpoint = checkpoints[(p.next + 7) % 8];
    p.x = checkpoint.x;
    p.z = checkpoint.z;
    p.vx = p.vz = 0;
    p.angle = 0;
  }
  pause() {
    this.state = this.state === "paused" ? "playing" : "paused";
    this.input = {};
    this.onUpdate();
  }
  quit() {
    if (this.mode === "free" && this.state === "paused") {
      this.finish(
        this.distance >= 250,
        this.distance >= 250
          ? "Поездка завершена"
          : "Нужно проехать 250 метров",
      );
      return;
    }
    this.state = "menu";
    this.world.drag.visible = false;
    this.setCar();
    this.onUpdate();
  }
  finish(win, reason) {
    if (this.state !== "playing" && this.state !== "paused") return;
    this.state = "result";
    let reward = win
      ? {
          street: 1800,
          drift: 1500,
          highway: 1400,
          drag: 1200,
          time: 1600,
          free: 300,
          police: 1800,
          parking: 1200,
          elimination: 2500,
        }[this.mode]
      : 200;
    this.save.credits += reward;
    this.onFinish({
      win,
      reason,
      reward,
      time: this.elapsed,
      score: Math.floor(this.score),
      mode: modes.find((x) => x.id === this.mode).name,
    });
  }
  sync(c) {
    c.visual.group.position.set(c.x, 0, c.z);
    c.visual.group.rotation.y = c.angle;
    for (const w of c.visual.wheels) w.rotation.x -= c.speed * 0.004;
  }
  ai(c, dt, i) {
    if (this.mode === "drag") {
      c.speed = 29;
      c.z -= c.speed * dt;
      this.sync(c);
      return;
    }
    let target = checkpoints[c.next];
    if (this.mode === "police") {
      target = this.player;
    }
    let dx = target.x - c.x,
      dz = target.z - c.z,
      dist = Math.hypot(dx, dz),
      desired = Math.atan2(-dx, -dz),
      diff = Math.atan2(
        Math.sin(desired - c.angle),
        Math.cos(desired - c.angle),
      );
    c.angle += Math.max(-1, Math.min(1, diff)) * dt * 1.6;
    let speed =
      this.mode === "drag"
        ? 29
        : this.mode === "police"
          ? 27
          : this.mode === "highway"
            ? 18
            : 20 + i * 0.7;
    c.speed = Math.min(speed, c.speed + 12 * dt);
    c.x += -Math.sin(c.angle) * c.speed * dt;
    c.z += -Math.cos(c.angle) * c.speed * dt;
    if (this.mode !== "police" && dist < 10) {
      c.next = (c.next + 1) % 8;
      c.passed++;
    }
    this.sync(c);
  }
  update(dt, realDt = dt) {
    if (this.state !== "playing") return;
    this.countdown = Math.max(0, this.countdown - realDt);
    if (this.countdown > 0) return;
    this.elapsed += realDt;
    const p = this.player;
    const speedBefore = p.speed;
    this.damageCooldown = Math.max(0, this.damageCooldown - realDt);
    updateCar(
      p,
      this.input,
      dt,
      this.stats(p),
      this.mode === "drag" ? [] : this.world.obstacles,
      this.mode === "drag"
        ? { minX: 290, maxX: 310, minZ: -218, maxZ: 205 }
        : undefined,
    );
    this.distance =
      this.mode === "drag"
        ? Math.max(0, 190 - p.z)
        : this.distance + p.speed * dt;
    this.sync(p);
    this.effects.update(p, dt, this.save.settings.particles);
    for (let i = 1; i < this.cars.length; i++) {
      let c = this.cars[i];
      if (!c.alive) continue;
      this.ai(c, dt, i);
      let dx = p.x - c.x,
        dz = p.z - c.z,
        d = Math.hypot(dx, dz);
      if (d < 3) {
        let n = d || 1;
        p.x += (dx / n) * 1.1;
        p.z += (dz / n) * 1.1;
        p.vx *= 0.68;
        p.vz *= 0.68;
        p.hit = true;
      }
      if (this.mode === "police" && d < 10) this.arrest += dt;
    }
    if (p.hit) this.sound.impact(this.save.settings.volume);
    if (
      this.mode === "free" &&
      p.hit &&
      speedBefore > 8 &&
      this.damageCooldown === 0
    ) {
      this.integrity = Math.max(0, this.integrity - 20);
      this.damageCooldown = 1;
    }
    if (
      this.mode === "police" &&
      Math.hypot(this.cars[1].x - p.x, this.cars[1].z - p.z) > 10
    )
      this.arrest = Math.max(0, this.arrest - dt * 0.6);
    if (["street", "time", "elimination"].includes(this.mode)) {
      let target = checkpoints[p.next];
      if (Math.hypot(target.x - p.x, target.z - p.z) < 10) {
        p.next = (p.next + 1) % 8;
        p.passed++;
      }
      target = checkpoints[p.next];
      this.ring.position.set(target.x, 5, target.z);
      this.ring.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
      this.arrow.position.set(
        target.x,
        13 + Math.sin(this.elapsed * 3),
        target.z,
      );
      this.ring.rotation.z += dt * 0.3;
    }
    if (this.mode === "drift" && p.speed > 9 && p.slip > 3)
      this.score += p.slip * p.speed * dt * 0.42;
    if (this.mode === "parking") {
      this.ring.rotation.y = Math.atan2(65 - p.x, 88 - p.z);
      this.arrow.position.y = 13 + Math.sin(this.elapsed * 3);
      let inside =
        Math.abs(p.x - 65) < 2.2 && Math.abs(p.z - 88) < 4 && p.speed < 1.8;
      this.parking = inside ? this.parking + dt : 0;
    }
    let competitors = this.cars.slice(1).filter((c) => c.alive),
      rank =
        1 +
        competitors.filter(
          (c) =>
            c.passed > p.passed ||
            (c.passed === p.passed &&
              Math.hypot(
                checkpoints[c.next].x - c.x,
                checkpoints[c.next].z - c.z,
              ) <
                Math.hypot(
                  checkpoints[p.next].x - p.x,
                  checkpoints[p.next].z - p.z,
                )),
        ).length;
    this.rank = rank;
    evaluateModes(this, p, competitors, rank);
    this.sound.update(p.speed, this.save.settings.volume, true);
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  frame() {
    requestAnimationFrame(this.frame);
    let rawDt = this.clock.getDelta(),
      dt = Math.min(rawDt, 0.1);
    this.update(dt, rawDt);
    const p = this.player;
    if (!p) return;
    let behind = new THREE.Vector3(Math.sin(p.angle), 0, Math.cos(p.angle));
    let cam;
    if (this.state === "menu" || this.state === "result") {
      let a = performance.now() * 0.00022;
      cam = new THREE.Vector3(
        p.x + Math.sin(a) * 11,
        5,
        p.z + Math.cos(a) * 11,
      );
      this.camera.position.lerp(cam, 0.035);
      this.camera.lookAt(p.x, 1, p.z);
    } else {
      let distance =
          this.cameraMode === 1 ? -1 : this.cameraMode === 2 ? 16 : 9,
        height = this.cameraMode === 1 ? 1.45 : this.cameraMode === 2 ? 8 : 4;
      cam = new THREE.Vector3(
        p.x + behind.x * distance,
        height,
        p.z + behind.z * distance,
      );
      this.camera.position.lerp(cam, 1 - Math.exp(-dt * 4));
      this.camera.lookAt(p.x - behind.x * 8, 1, p.z - behind.z * 8);
    }
    if (this.state !== "playing")
      this.sound.update(0, this.save.settings.volume, false);
    this.renderer.render(this.scene, this.camera);
    this.frames = (this.frames || 0) + 1;
    this.fpsTime = (this.fpsTime || 0) + rawDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.frames = 0;
      this.fpsTime = 0;
      this.onUpdate(true);
    }
  }
}
