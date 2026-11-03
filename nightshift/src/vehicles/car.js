import * as THREE from "three";
const box = new THREE.BoxGeometry(1, 1, 1),
  wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.28, 10);
wheelGeo.rotateZ(Math.PI / 2);
const rimGeos = [
  new THREE.CylinderGeometry(0.24, 0.24, 0.29, 10),
  new THREE.CylinderGeometry(0.24, 0.24, 0.29, 5),
];
rimGeos.forEach((g) => g.rotateZ(Math.PI / 2));
const rimMats = [
  new THREE.MeshStandardMaterial({
    color: 0xa8b9c4,
    metalness: 0.8,
    roughness: 0.3,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x00d9ff,
    metalness: 0.8,
    roughness: 0.3,
  }),
];
const glass = new THREE.MeshStandardMaterial({
  color: 0x102338,
  metalness: 0.5,
  roughness: 0.25,
});
const black = new THREE.MeshStandardMaterial({
  color: 0x080c12,
  roughness: 0.8,
});
const head = new THREE.MeshBasicMaterial({ color: 0xc5f7ff }),
  tail = new THREE.MeshBasicMaterial({ color: 0xff3155 });
function piece(g, mat, x, y, z, w, h, d) {
  let m = new THREE.Mesh(box, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  g.add(m);
  return m;
}
export function createCar(data, paint, rims = 0, suspension = 1) {
  const group = new THREE.Group(),
    body = new THREE.MeshStandardMaterial({
      color: paint || data.color,
      metalness: 0.68,
      roughness: 0.34,
    });
  const len = [4.6, 4.5, 4.4, 5, 5.2, 4.55][data.shape],
    height = [0.75, 0.7, 1, 0.73, 0.8, 0.55][data.shape];
  const shell = new THREE.Group();
  shell.position.y = (suspension - 1) * 0.12;
  group.add(shell);
  piece(shell, body, 0, 0.65, 0, 2, height, len);
  piece(shell, black, 0, 0.4, 0, 2.05, 0.2, len * 0.92);
  piece(shell, glass, 0, 1.18, -0.2, 1.65, 0.65, len * 0.48);
  piece(shell, body, 0, 1.5, -0.3, 1.72, 0.12, len * 0.43);
  piece(shell, head, -0.65, 0.68, -len / 2 - 0.02, 0.48, 0.16, 0.06);
  piece(shell, head, 0.65, 0.68, -len / 2 - 0.02, 0.48, 0.16, 0.06);
  piece(shell, tail, -0.65, 0.64, len / 2 + 0.02, 0.55, 0.15, 0.06);
  piece(shell, tail, 0.65, 0.64, len / 2 + 0.02, 0.55, 0.15, 0.06);
  if (data.shape === 1 || data.shape === 4)
    piece(shell, body, 0, 1.25, len * 0.42, 1.8, 0.13, 0.32);
  if (data.shape === 2)
    piece(shell, black, 0, 1.65, -0.3, 1.5, 0.08, len * 0.4);
  if (data.shape === 5)
    piece(shell, black, 0, 0.86, -len * 0.35, 1.8, 0.09, 0.3);
  const wheels = [];
  for (const x of [-1, 1])
    for (const z of [-len * 0.3, len * 0.3]) {
      const w = new THREE.Mesh(wheelGeo, black);
      w.position.set(x, 0.43, z);
      group.add(w);
      const rim = new THREE.Mesh(rimGeos[rims ? 1 : 0], rimMats[rims ? 1 : 0]);
      w.add(rim);
      wheels.push(w);
    }
  return { group, wheels, body, len };
}
