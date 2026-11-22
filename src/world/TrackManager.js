import * as THREE from 'three';

/**
 * TrackManager generates a procedural downhill mountain track with curves,
 * drops, kickers, trees, rocks, collectibles, and boost pads.
 */
export class TrackManager {
  constructor(scene) {
    this.scene = scene;
    this.trackSpline = null;
    this.trackLength = 0;
    this.trackWidth = 8.0;
    this.samples = [];
    this.collectibles = [];
    this.boostPads = [];
    this.ramps = [];
    this.checkpoints = [];
    this.finishZ = 0;

    this.trackMesh = null;
    this.mountainMesh = null;
    this.instancedTrees = null;
    this.instancedRocks = null;

    this._generateSpline();
    this._sampleSpline();
    this._buildTrackGeometry();
    this._buildScenery();
    this._buildItems();
  }

  _generateSpline() {
    // Waypoints down the mountain: descending Y, advancing Z, oscillating X
    const waypoints = [
      new THREE.Vector3(0, 320, 0),         // Start peak
      new THREE.Vector3(15, 305, 80),       // Slight curve right
      new THREE.Vector3(35, 280, 160),      // Drop right
      new THREE.Vector3(10, 255, 250),      // Sweep back left
      new THREE.Vector3(-30, 225, 350),     // Sharp drop left
      new THREE.Vector3(-15, 195, 450),     // Kicker ramp zone 1
      new THREE.Vector3(25, 165, 570),      // High speed S-bend
      new THREE.Vector3(45, 135, 690),      // Ridge turn
      new THREE.Vector3(10, 110, 800),      // Steep cliff edge
      new THREE.Vector3(-35, 85, 930),      // Fast descent
      new THREE.Vector3(-10, 60, 1070),     // Kicker ramp zone 2 (Big Air)
      new THREE.Vector3(20, 40, 1220),      // Canyon approach
      new THREE.Vector3(0, 20, 1380),       // Final high speed straight
      new THREE.Vector3(0, 5, 1550),        // Finish line approach
      new THREE.Vector3(0, 0, 1680)         // Runoff
    ];

    this.trackSpline = new THREE.CatmullRomCurve3(waypoints);
    this.trackLength = this.trackSpline.getLength();
    this.finishZ = 1550;
  }

  _sampleSpline() {
    const numSamples = 600;
    this.samples = [];

    for (let i = 0; i <= numSamples; i++) {
      const u = i / numSamples;
      const point = this.trackSpline.getPoint(u);
      const tangent = this.trackSpline.getTangent(u).normalize();
      // Up vector roughly vertical, adjusted for slope
      const up = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      this.samples.push({
        u,
        distance: u * this.trackLength,
        point,
        tangent,
        normal, // Lateral right vector
        binormal // Surface normal vector
      });
    }
  }

  _buildTrackGeometry() {
    const segments = this.samples.length - 1;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    const halfW = this.trackWidth * 0.5;

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      // Left edge, center, right edge
      const left = s.point.clone().addScaledVector(s.normal, -halfW);
      const right = s.point.clone().addScaledVector(s.normal, halfW);

      positions.push(left.x, left.y, left.z);
      positions.push(right.x, right.y, right.z);

      const v = s.distance / 10;
      uvs.push(0, v);
      uvs.push(1, v);

      if (i < segments) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        indices.push(row1, row2, row1 + 1);
        indices.push(row1 + 1, row2, row2 + 1);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    // Procedural Dirt / Trail Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6e5138';
    ctx.fillRect(0, 0, 256, 256);

    // Tire tracks & gravel grain
    ctx.fillStyle = '#4f3925';
    ctx.fillRect(40, 0, 30, 256);
    ctx.fillRect(186, 0, 30, 256);
    for (let n = 0; n < 300; n++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#806144' : '#3d2b1c';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }

    const trailTex = new THREE.CanvasTexture(canvas);
    trailTex.wrapS = THREE.RepeatWrapping;
    trailTex.wrapT = THREE.RepeatWrapping;
    trailTex.repeat.set(1, 40);

    const mat = new THREE.MeshStandardMaterial({
      map: trailTex,
      roughness: 0.9,
      metalness: 0.1
    });

    this.trackMesh = new THREE.Mesh(geom, mat);
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    // Track boundary lines
    this._buildGuardrails();
  }

  _buildGuardrails() {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xc87d32,
      roughness: 0.8
    });

    // Place wooden fence posts along steep turns
    const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6);
    const postGroup = new THREE.Group();

    for (let i = 10; i < this.samples.length - 20; i += 4) {
      const s = this.samples[i];
      // If curve curvature is notable, put fences on outer edge
      const halfW = this.trackWidth * 0.5 + 0.6;
      [-halfW, halfW].forEach(sideOffset => {
        const post = new THREE.Mesh(postGeom, railMat);
        const pos = s.point.clone().addScaledVector(s.normal, sideOffset);
        pos.y += 0.6;
        post.position.copy(pos);
        postGroup.add(post);
      });
    }
    this.scene.add(postGroup);
  }

  _buildScenery() {
    // Surrounding Mountain terrain
    const mtnGeom = new THREE.PlaneGeometry(350, 1800, 70, 150);
    mtnGeom.rotateX(-Math.PI / 2);

    const pos = mtnGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) + 850; // Align with track
      pos.setZ(i, z);

      // Height derived from distance along track + rugged hills
      const u = Math.max(0, Math.min(1, z / 1680));
      const trackPoint = this.trackSpline.getPoint(u);
      const distToTrack = Math.abs(x - trackPoint.x);

      const bufferZone = this.trackWidth * 1.8;
      let y = trackPoint.y - 1.2;
      if (distToTrack > bufferZone) {
        const factor = distToTrack - bufferZone;
        const noise = Math.sin(x * 0.04) * 5 + Math.cos(z * 0.02) * 6;
        y += Math.min(80, factor * 0.4 + noise);
      }
      pos.setY(i, y);
    }
    mtnGeom.computeVertexNormals();

    const mtnMat = new THREE.MeshStandardMaterial({
      color: 0x47633c, // Alpine grass / rock green
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    });

    this.mountainMesh = new THREE.Mesh(mtnGeom, mtnMat);
    this.mountainMesh.receiveShadow = true;
    this.scene.add(this.mountainMesh);

    // Instanced Pine Trees
    this._buildInstancedTrees();
    // Instanced Mountain Rocks
    this._buildInstancedRocks();
    // Start and Finish Arches
    this._buildArches();
  }

  _buildInstancedTrees() {
    const count = 350;
    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.4, 2, 5);
    const foliageGeom = new THREE.ConeGeometry(2.2, 5.5, 6);
    foliageGeom.translate(0, 3.5, 0);

    // Merge tree geometry
    const treeGroup = new THREE.Group();
    const treeMesh = new THREE.Mesh(
      foliageGeom,
      new THREE.MeshStandardMaterial({ color: 0x244f2b, roughness: 0.85, flatShading: true })
    );
    const trunkMesh = new THREE.Mesh(
      trunkGeom,
      new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 })
    );
    treeGroup.add(treeMesh);
    treeGroup.add(trunkMesh);

    const instancedMesh = new THREE.InstancedMesh(foliageGeom, treeMesh.material, count);
    instancedMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let i = 0; i < count; i++) {
      const u = 0.02 + Math.random() * 0.94;
      const pt = this.trackSpline.getPoint(u);
      const side = Math.random() > 0.5 ? 1 : -1;
      const offsetDist = this.trackWidth * 0.8 + Math.random() * 45;

      const x = pt.x + side * offsetDist;
      const z = pt.z + (Math.random() - 0.5) * 15;
      const y = this.getGroundHeight(x, z);

      dummy.position.set(x, y, z);
      const scale = 0.7 + Math.random() * 0.8;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      instancedMesh.setMatrixAt(idx++, dummy.matrix);
    }
    this.scene.add(instancedMesh);
  }

  _buildInstancedRocks() {
    const rockCount = 180;
    const rockGeom = new THREE.DodecahedronGeometry(1.4, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x75736f,
      roughness: 0.9,
      flatShading: true
    });

    const instancedRocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < rockCount; i++) {
      const u = 0.05 + Math.random() * 0.92;
      const pt = this.trackSpline.getPoint(u);
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = this.trackWidth * 0.7 + Math.random() * 25;

      const x = pt.x + side * offset;
      const z = pt.z;
      const y = this.getGroundHeight(x, z);

      dummy.position.set(x, y, z);
      const s = 0.6 + Math.random() * 1.6;
      dummy.scale.set(s, s * 0.8, s);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.updateMatrix();

      instancedRocks.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(instancedRocks);
  }

  _buildArches() {
    // Start Arch
    const startPoint = this.samples[2].point;
    const startArch = this._createArch('START', 0xe67e22);
    startArch.position.copy(startPoint);
    this.scene.add(startArch);

    // Finish Arch
    const finishSample = this.samples.find(s => s.point.z >= this.finishZ) || this.samples[this.samples.length - 20];
    const finishArch = this._createArch('FINISH', 0x2ecc71);
    finishArch.position.copy(finishSample.point);
    this.scene.add(finishArch);
  }

  _createArch(text, color) {
    const group = new THREE.Group();
    const pillarGeom = new THREE.BoxGeometry(0.8, 6, 0.8);
    const crossGeom = new THREE.BoxGeometry(this.trackWidth + 2, 1.2, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
    const bannerMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });

    const pLeft = new THREE.Mesh(pillarGeom, mat);
    pLeft.position.set(-this.trackWidth * 0.5 - 0.5, 3, 0);

    const pRight = new THREE.Mesh(pillarGeom, mat);
    pRight.position.set(this.trackWidth * 0.5 + 0.5, 3, 0);

    const cross = new THREE.Mesh(crossGeom, bannerMat);
    cross.position.set(0, 5.5, 0);

    group.add(pLeft, pRight, cross);
    return group;
  }

  _buildItems() {
    // 1. Kickers / Jump Ramps
    const rampDistances = [240, 480, 850, 1100, 1340];
    const rampGeom = new THREE.BoxGeometry(4.5, 1.2, 4);
    // Slope ramp
    rampGeom.rotateX(-0.35);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.6 });

    rampDistances.forEach(dist => {
      const sample = this.getSampleAtDistance(dist);
      if (!sample) return;
      const ramp = new THREE.Mesh(rampGeom, rampMat);
      ramp.position.copy(sample.point);
      ramp.position.y += 0.5;
      ramp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sample.tangent);
      this.scene.add(ramp);

      this.ramps.push({
        position: ramp.position,
        distance: dist,
        boostPower: 18.0
      });
    });

    // 2. Nitro Boost Pads (Glowing neon arrows)
    const boostDistances = [120, 360, 680, 980, 1260, 1460];
    const boostGeom = new THREE.PlaneGeometry(3.5, 5);
    boostGeom.rotateX(-Math.PI / 2);

    const boostCanvas = document.createElement('canvas');
    boostCanvas.width = 128;
    boostCanvas.height = 128;
    const bctx = boostCanvas.getContext('2d');
    bctx.fillStyle = '#000000';
    bctx.fillRect(0, 0, 128, 128);
    bctx.fillStyle = '#00ffcc';
    // Draw arrows
    for (let y = 30; y <= 90; y += 30) {
      bctx.beginPath();
      bctx.moveTo(64, y - 20);
      bctx.lineTo(95, y + 10);
      bctx.lineTo(75, y + 10);
      bctx.lineTo(75, y + 25);
      bctx.lineTo(53, y + 25);
      bctx.lineTo(53, y + 10);
      bctx.lineTo(33, y + 10);
      bctx.closePath();
      bctx.fill();
    }
    const boostTex = new THREE.CanvasTexture(boostCanvas);
    const boostMat = new THREE.MeshBasicMaterial({
      map: boostTex,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    boostDistances.forEach(dist => {
      const sample = this.getSampleAtDistance(dist);
      if (!sample) return;
      const pad = new THREE.Mesh(boostGeom, boostMat);
      pad.position.copy(sample.point);
      pad.position.y += 0.08;
      pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sample.tangent);
      this.scene.add(pad);

      this.boostPads.push({
        mesh: pad,
        distance: dist,
        position: pad.position,
        active: true
      });
    });

    // 3. Golden Star / Coins Collectibles
    const coinGeom = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 12);
    coinGeom.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.2
    });

    for (let d = 50; d < this.trackLength - 80; d += 25) {
      // Don't collide directly on ramps
      if (rampDistances.some(rd => Math.abs(rd - d) < 10)) continue;
      const sample = this.getSampleAtDistance(d);
      if (!sample) return;

      const coin = new THREE.Mesh(coinGeom, coinMat);
      // Alternate left, center, right racing line
      const offset = Math.sin(d * 0.1) * (this.trackWidth * 0.35);
      const pos = sample.point.clone().addScaledVector(sample.normal, offset);
      pos.y += 1.2;
      coin.position.copy(pos);
      this.scene.add(coin);

      this.collectibles.push({
        mesh: coin,
        position: pos,
        collected: false
      });
    }

    // 4. Checkpoints
    const cpDistances = [350, 750, 1150];
    cpDistances.forEach((dist, idx) => {
      const sample = this.getSampleAtDistance(dist);
      if (!sample) return;
      this.checkpoints.push({
        id: idx + 1,
        distance: dist,
        point: sample.point.clone(),
        tangent: sample.tangent.clone(),
        passed: false
      });
    });
  }

  getSampleAtDistance(dist) {
    const clampedDist = Math.max(0, Math.min(this.trackLength, dist));
    const targetIdx = Math.floor((clampedDist / this.trackLength) * (this.samples.length - 1));
    return this.samples[targetIdx];
  }

  getGroundHeight(x, z) {
    const u = Math.max(0, Math.min(1, z / 1680));
    const trackPoint = this.trackSpline.getPoint(u);
    const dx = x - trackPoint.x;
    const distToTrack = Math.abs(dx);

    const bufferZone = this.trackWidth * 1.8;
    let y = trackPoint.y - 1.2;
    if (distToTrack > bufferZone) {
      const factor = distToTrack - bufferZone;
      const noise = Math.sin(x * 0.04) * 5 + Math.cos(z * 0.02) * 6;
      y += Math.min(80, factor * 0.4 + noise);
    }
    return y;
  }

  update(delta) {
    // Animate spinning coins
    const rot = delta * 3.5;
    this.collectibles.forEach(c => {
      if (!c.collected) {
        c.mesh.rotation.y += rot;
      }
    });

    // Pulse boost pads
    const pulse = 0.85 + Math.sin(Date.now() * 0.008) * 0.25;
    this.boostPads.forEach(b => {
      b.mesh.scale.set(1, pulse, 1);
    });
  }
}
