import * as THREE from "three";
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.timer = 0;
    this.marks = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.24, 1.3),
      new THREE.MeshBasicMaterial({
        color: 0x03070b,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      180,
    );
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.marks.count = 0;
    scene.add(this.marks);
    this.positions = new Float32Array(80 * 3);
    this.life = new Float32Array(80);
    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.smoke = new THREE.Points(
      this.geom,
      new THREE.PointsMaterial({
        color: 0xa1bac5,
        size: 2.4,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    this.smoke.frustumCulled = false;
    scene.add(this.smoke);
    this.tmp = new THREE.Object3D();
    this.si = 0;
  }
  update(car, dt, enabled) {
    this.timer -= dt;
    if (enabled && car.speed > 8 && car.slip > 2.5 && this.timer <= 0) {
      this.timer = 0.07;
      for (let s of [-1, 1]) {
        let x =
            car.x + Math.cos(car.angle) * s * 0.8 + Math.sin(car.angle) * 1.2,
          z = car.z - Math.sin(car.angle) * s * 0.8 + Math.cos(car.angle) * 1.2;
        this.tmp.position.set(x, 0.12, z);
        this.tmp.rotation.set(-Math.PI / 2, 0, -car.angle);
        this.tmp.scale.set(1, 1, 1);
        this.tmp.updateMatrix();
        this.marks.setMatrixAt(this.index % 180, this.tmp.matrix);
        this.index++;
        this.marks.count = Math.min(this.index, 180);
        this.marks.instanceMatrix.needsUpdate = true;
        let i = this.si++ % 80;
        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = 0.5;
        this.positions[i * 3 + 2] = z;
        this.life[i] = 1.2;
      }
    }
    for (let i = 0; i < 80; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        this.positions[i * 3 + 1] += dt * 0.9;
      } else this.positions[i * 3 + 1] = -100;
    }
    this.geom.attributes.position.needsUpdate = true;
    this.smoke.visible = enabled;
  }
}
