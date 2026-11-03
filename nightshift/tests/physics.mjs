import assert from "node:assert/strict";
import { updateCar } from "../src/physics/drive.js";
const stats = { speed: 50, accel: 20, brake: 20, grip: 3 };
const car = () => ({ x: 0, z: 0, vx: 0, vz: 0, angle: 0, nitro: 100 });
let p = car();
for (let i = 0; i < 60; i++) updateCar(p, { w: true }, 1 / 60, stats, []);
assert(p.z < -5 && p.speed > 10, "vehicle must accelerate forwards");
let speed = p.speed;
for (let i = 0; i < 60; i++) updateCar(p, { s: true }, 1 / 60, stats, []);
assert(p.speed < speed, "braking must reduce speed");
p = car();
for (let i = 0; i < 30; i++)
  updateCar(p, { w: true, nitro: true }, 1 / 60, stats, []);
assert(p.nitro < 100, "nitro must consume charge");
p = car();
p.x = 120.9;
p.angle = -Math.PI / 2;
p.vx = 12;
updateCar(p, {}, 0.1, stats, []);
assert(p.hit && p.x <= 121, "boundary must stop car");
p = car();
p.z = -1;
p.vz = -12;
updateCar(p, {}, 0.1, stats, [{ x: 0, z: -5, w: 2, d: 2 }]);
assert(p.hit, "obstacle must stop car");
p = car();
p.x = 296;
p.z = 190;
updateCar(p, { w: true }, 0.1, stats, [], {
  minX: 290,
  maxX: 310,
  minZ: -218,
  maxZ: 205,
});
assert(!p.hit && p.z < 190, "drag strip must accept its own world bounds");
console.log("Physics checks passed");
