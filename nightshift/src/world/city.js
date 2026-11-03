import * as THREE from "three";
const box = new THREE.BoxGeometry(1, 1, 1);
function mesh(scene, mat, x, y, z, w, h, d) {
  const m = new THREE.Mesh(box, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  scene.add(m);
  return m;
}
export function createCity(scene, quality = "medium") {
  scene.background = new THREE.Color(0x080f1b);
  scene.fog = new THREE.Fog(
    0x080f1b,
    quality === "low" ? 90 : 130,
    quality === "low" ? 210 : 300,
  );
  scene.add(new THREE.HemisphereLight(0x9fc0dd, 0x10101d, 1.5));
  const moon = new THREE.DirectionalLight(0xa2c8ff, 1.3);
  moon.position.set(-30, 80, 25);
  scene.add(moon);
  const asphalt = new THREE.MeshStandardMaterial({
      color: 0x172535,
      roughness: 0.87,
    }),
    ground = new THREE.MeshStandardMaterial({ color: 0x0b1521 }),
    line = new THREE.MeshBasicMaterial({ color: 0x718e9e }),
    cyan = new THREE.MeshBasicMaterial({ color: 0x00b8da }),
    pink = new THREE.MeshBasicMaterial({ color: 0xa74cee }),
    building = new THREE.MeshStandardMaterial({
      color: 0x1b3042,
      roughness: 0.85,
    }),
    window = new THREE.MeshBasicMaterial({ color: 0x7b9fae });
  const batches = new Map();
  function batch(parent, material, x, y, z, w, h, d) {
    const key = parent.uuid + material.uuid;
    if (!batches.has(key)) batches.set(key, { parent, material, items: [] });
    batches.get(key).items.push([x, y, z, w, h, d]);
  }
  mesh(scene, ground, 0, -0.22, 0, 260, 0.4, 260);
  for (const x of [-70, 0, 70]) mesh(scene, asphalt, x, 0.01, 0, 18, 0.08, 250);
  for (const z of [-70, 0, 70]) mesh(scene, asphalt, 0, 0.02, z, 250, 0.08, 18);
  for (let i = -110; i <= 110; i += 9)
    for (const p of [-70, 0, 70]) {
      batch(scene, line, p, 0.07, i, 0.14, 0.03, 4);
      batch(scene, line, i, 0.075, p, 4, 0.03, 0.14);
    }
  const obstacles = [];
  const rng = (a, b) => {
    let x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const data = [];
  for (let xi = -2; xi <= 2; xi++)
    for (let zi = -2; zi <= 2; zi++) {
      const x = xi * 70 + 35,
        z = zi * 70 + 35;
      if (Math.abs(x) > 112 || Math.abs(z) > 112) continue;
      if (x > 15 && z > 15) continue;
      let h = 12 + rng(x, z) * 55;
      data.push({
        x,
        z,
        w: 19 + rng(z, x) * 11,
        d: 19 + rng(x + 1, z) * 11,
        h,
      });
      obstacles.push({
        x,
        z,
        w: data.at(-1).w / 2 + 1,
        d: data.at(-1).d / 2 + 1,
      });
    }
  let inst = new THREE.InstancedMesh(box, building, data.length);
  let dummy = new THREE.Object3D();
  data.forEach((b, i) => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
  const windows = [];
  for (const b of data) {
    for (let y = 5; y < b.h - 2; y += 7)
      for (let dx = -b.w / 2 + 3; dx < b.w / 2 - 1; dx += 5) {
        windows.push([b.x + dx, y, b.z + b.d / 2 + 0.03]);
      }
  }
  const wi = new THREE.InstancedMesh(box, window, windows.length);
  windows.forEach((p, i) => {
    dummy.position.set(...p);
    dummy.scale.set(1.5, 2, 0.08);
    dummy.updateMatrix();
    wi.setMatrixAt(i, dummy.matrix);
  });
  wi.instanceMatrix.needsUpdate = true;
  scene.add(wi);
  for (let i = -105; i < 115; i += 25)
    for (const a of [-80, -10, 10, 80]) {
      batch(scene, building, a, 4, i, 0.3, 8, 0.3);
      batch(scene, cyan, a, 8, i, 1.1, 0.22, 0.4);
      batch(scene, building, i, 4, a, 0.3, 8, 0.3);
      batch(scene, pink, i, 8, a, 0.4, 0.22, 1.1);
    }
  // Decorative signs are generated once and reused as scene textures.
  function sign(text, x, y, z, angle, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#08111b";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = color;
    ctx.font = "bold 54px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    face.position.set(x, y, z);
    face.rotation.y = angle;
    scene.add(face);
  }
  sign("NIGHTSHIFT", -59, 9, -48, Math.PI / 2, "#00d9ff");
  sign("GARAGE", 9, 9, 68, 0, "#a75cff");
  sign("MOTEL", 60, 10, 10, Math.PI / 2, "#00d9ff");
  sign("AFTER HOURS", -10, 9, -68, 0, "#a75cff");
  // Tunnel, bridge, industrial blocks, and a marked parking lot.
  for (const x of [-80, -60]) mesh(scene, building, x, 5, -70, 1, 10, 35);
  mesh(scene, building, -70, 10, -70, 20, 1, 35);
  for (const z of [-80, -60]) mesh(scene, building, 70, 1, z, 50, 1, 0.6);
  for (const [x, z] of [
    [35, 35],
    [55, 35],
    [35, 55],
  ]) {
    mesh(scene, building, x, 4, z, 13, 8, 13);
    obstacles.push({ x, z, w: 7, d: 7 });
  }
  for (let i = 0; i < 5; i++)
    batch(scene, line, 45 + i * 4, 0.09, 88, 0.12, 0.03, 12);
  const drag = new THREE.Group();
  scene.add(drag);
  drag.visible = false;
  mesh(drag, asphalt, 300, 0.03, -5, 22, 0.08, 430);
  for (let z = -210; z < 210; z += 12) {
    batch(drag, line, 300, 0.09, z, 0.18, 0.03, 6);
    for (const x of [288.5, 311.5]) {
      batch(drag, building, x, 3, z, 0.25, 6, 0.25);
      batch(drag, cyan, x, 6, z, 0.7, 0.2, 0.5);
    }
  }
  batch(drag, cyan, 300, 0.12, -210, 22, 0.04, 0.7);
  for (const { parent, material, items } of batches.values()) {
    const group = new THREE.InstancedMesh(box, material, items.length);
    items.forEach(([x, y, z, w, h, d], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      group.setMatrixAt(i, dummy.matrix);
    });
    group.instanceMatrix.needsUpdate = true;
    group.computeBoundingSphere();
    parent.add(group);
  }
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 9),
    new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(65, 0.11, 88);
  scene.add(park);
  return { obstacles, park, drag };
}
