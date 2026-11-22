import * as THREE from 'three';

/**
 * High-performance instanced particles for tire dust, speed streaks, nitro sparks, and finish confetti.
 */
export class ParticleManager {
  constructor(scene) {
    this.scene = scene;

    this.dustParticles = [];
    this.speedLines = [];
    this.confettiParticles = [];

    this._initDust();
    this._initSpeedLines();
  }

  _initDust() {
    const maxDust = 120;
    const geom = new THREE.DodecahedronGeometry(0.18, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9c8266,
      transparent: true,
      opacity: 0.6
    });

    for (let i = 0; i < maxDust; i++) {
      const mesh = new THREE.Mesh(geom, mat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.dustParticles.push({
        mesh,
        life: 0,
        maxLife: 0.6,
        velocity: new THREE.Vector3()
      });
    }
  }

  _initSpeedLines() {
    const lineCount = 40;
    const geom = new THREE.CylinderGeometry(0.015, 0.015, 6, 4);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35
    });

    this.speedLineGroup = new THREE.Group();
    for (let i = 0; i < lineCount; i++) {
      const line = new THREE.Mesh(geom, mat);
      line.position.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 20
      );
      this.speedLineGroup.add(line);
      this.speedLines.push(line);
    }
    this.speedLineGroup.visible = false;
    this.scene.add(this.speedLineGroup);
  }

  emitDust(origin, direction, count = 2) {
    let spawned = 0;
    for (const p of this.dustParticles) {
      if (!p.mesh.visible && spawned < count) {
        p.mesh.visible = true;
        p.mesh.position.copy(origin);
        p.life = p.maxLife;

        p.velocity.set(
          (Math.random() - 0.5) * 1.5 - direction.x * 2,
          Math.random() * 2.2 + 0.5,
          (Math.random() - 0.5) * 1.5 - direction.z * 2
        );
        p.mesh.scale.setScalar(0.4 + Math.random() * 0.8);
        spawned++;
      }
    }
  }

  triggerConfetti(pos) {
    const count = 100;
    const colors = [0xff0055, 0x00ffcc, 0xffcc00, 0x0099ff, 0xffffff];
    const geom = new THREE.PlaneGeometry(0.25, 0.4);

    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 16 + 5,
        (Math.random() - 0.5) * 14
      );

      this.confettiParticles.push({
        mesh,
        velocity: vel,
        life: 3.5,
        rotSpeed: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0)
      });
    }
  }

  update(bikePos, speedRatio, delta) {
    // 1. Update Dust Particles
    for (const p of this.dustParticles) {
      if (p.mesh.visible) {
        p.life -= delta;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.material.opacity = (p.life / p.maxLife) * 0.55;
          p.mesh.scale.multiplyScalar(1 + delta * 1.8);
        }
      }
    }

    // 2. Speed Lines when rushing
    if (speedRatio > 0.65) {
      this.speedLineGroup.visible = true;
      this.speedLineGroup.position.copy(bikePos);
      const intensity = Math.min(0.6, (speedRatio - 0.65) * 1.5);
      this.speedLines.forEach(l => {
        l.material.opacity = intensity;
        l.position.z += delta * 45;
        if (l.position.z > 10) {
          l.position.z = -25 - Math.random() * 15;
          l.position.x = (Math.random() - 0.5) * 14;
          l.position.y = (Math.random() - 0.5) * 7;
        }
      });
    } else {
      this.speedLineGroup.visible = false;
    }

    // 3. Update Confetti
    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const c = this.confettiParticles[i];
      c.life -= delta;
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.confettiParticles.splice(i, 1);
      } else {
        c.velocity.y -= 14 * delta; // Gravity
        c.mesh.position.addScaledVector(c.velocity, delta);
        c.mesh.rotation.x += c.rotSpeed.x * delta;
        c.mesh.rotation.y += c.rotSpeed.y * delta;
      }
    }
  }
}
