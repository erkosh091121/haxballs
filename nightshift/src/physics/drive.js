export function updateCar(
  c,
  input,
  dt,
  stats,
  obstacles,
  limits = { minX: -121, maxX: 121, minZ: -121, maxZ: 121 },
) {
  const throttle = (input.w ? 1 : 0) - (input.s ? 1 : 0);
  let forward = -Math.sin(c.angle) * c.vx - Math.cos(c.angle) * c.vz;
  let side = Math.cos(c.angle) * c.vx - Math.sin(c.angle) * c.vz;
  const accel = stats.accel * (input.nitro && c.nitro > 0 ? 1.65 : 1);
  if (input.nitro && throttle > 0 && c.nitro > 0)
    c.nitro = Math.max(0, c.nitro - 22 * dt);
  else c.nitro = Math.min(100, c.nitro + 5 * dt);
  if (throttle < 0 && forward > 2) forward -= stats.brake * dt;
  else forward += throttle * accel * dt;
  forward *= Math.exp(-(throttle ? 0.08 : 0.42) * dt);
  forward = Math.max(
    -14,
    Math.min(stats.speed * (input.nitro ? 1.23 : 1), forward),
  );
  const steer = (input.a ? 1 : 0) - (input.d ? 1 : 0);
  c.angle +=
    steer *
    Math.min(Math.abs(forward) / 9, 1) *
    1.35 *
    dt *
    (forward < 0 ? -1 : 1);
  side *= Math.exp(-stats.grip * (input.handbrake ? 0.28 : 1) * dt);
  side += steer * forward * (input.handbrake ? 0.48 : 0.08) * dt;
  c.vx = -Math.sin(c.angle) * forward + Math.cos(c.angle) * side;
  c.vz = -Math.cos(c.angle) * forward - Math.sin(c.angle) * side;
  let nx = c.x + c.vx * dt,
    nz = c.z + c.vz * dt;
  c.hit = false;
  if (
    nx < limits.minX ||
    nx > limits.maxX ||
    nz < limits.minZ ||
    nz > limits.maxZ
  ) {
    nx = Math.max(limits.minX, Math.min(limits.maxX, nx));
    nz = Math.max(limits.minZ, Math.min(limits.maxZ, nz));
    c.vx *= -0.3;
    c.vz *= -0.3;
    c.hit = true;
  }
  for (const b of obstacles)
    if (Math.abs(nx - b.x) < b.w + 1 && Math.abs(nz - b.z) < b.d + 2) {
      nx = c.x;
      nz = c.z;
      c.vx *= -0.25;
      c.vz *= -0.25;
      c.hit = true;
      break;
    }
  c.x = nx;
  c.z = nz;
  c.speed = Math.hypot(c.vx, c.vz);
  c.slip = Math.abs(side);
  return c;
}
