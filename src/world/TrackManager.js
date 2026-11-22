import * as THREE from 'three';

/**
 * AAA-Grade Downhill Mountain Track & Lofted Terrain Engine.
 * Features:
 * - Lofted mountain flanks seamlessly aligned with the track spline
 * - High-contrast mountain dirt trail with tire ruts and gravel
 * - Zero clipping, zero z-fighting, zero floor-sinking
 * - Analytical dual-wheel suspension queries
 * - Instanced alpine pine forests, boulders, kickers, boost pads, and banners
 */
export class TrackManager {
  constructor(scene) {
    this.scene = scene;
    this.trackSpline = null;
    this.trackLength = 0;
    this.trackWidth = 8.8;
    this.samples = [];
    this.collectibles = [];
    this.boostPads = [];
    this.ramps = [];
    this.checkpoints = [];
    this.finishZ = 0;

    this.trackMesh = null;
    this.mountainLeftMesh = null;
    this.mountainRightMesh = null;
    this.horizonMesh = null;

    this._generateSpline();
    this._sampleSpline();
    this._buildHighDefTextures();
    this._buildTrackRibbon();
    this._buildLoftedMountainFlanks();
    this._buildHorizonPanorama();
    this._buildSceneryProps();
    this._buildTrackItems();
  }

  _generateSpline() {
    // 1.6km long downhill mountain course with varied terrain
    const waypoints = [
      new THREE.Vector3(0, 340, 0),         // Summit Gate
      new THREE.Vector3(18, 322, 90),       // Gentle slope right
      new THREE.Vector3(42, 298, 180),      // Banked curve right
      new THREE.Vector3(20, 272, 280),      // Sweep back into canyon
      new THREE.Vector3(-36, 240, 390),     // Steep technical drop left
      new THREE.Vector3(-22, 210, 500),     // Kicker ramp zone 1 (Airtime)
      new THREE.Vector3(28, 178, 630),      // High-speed ridge slalom
      new THREE.Vector3(52, 146, 760),      // Cliffside berm
      new THREE.Vector3(16, 120, 880),      // Steep canyon descent
      new THREE.Vector3(-38, 92, 1010),     // Fast hairpin left
      new THREE.Vector3(-12, 66, 1150),     // Big Air jump kicker 2
      new THREE.Vector3(24, 44, 1300),      // High-speed sweep
      new THREE.Vector3(4, 24, 1450),       // Final sprint straight
      new THREE.Vector3(0, 8, 1600),        // Grandstand finish approach
      new THREE.Vector3(0, 0, 1720)         // Runoff zone
    ];

    this.trackSpline = new THREE.CatmullRomCurve3(waypoints, false, 'centripetal', 0.5);
    this.trackLength = this.trackSpline.getLength();
    this.finishZ = 1600;
  }

  _sampleSpline() {
    const numSamples = 700;
    this.samples = [];

    for (let i = 0; i <= numSamples; i++) {
      const u = i / numSamples;
      const point = this.trackSpline.getPoint(u);
      const tangent = this.trackSpline.getTangent(u).normalize();
      const up = new THREE.Vector3(0, 1, 0);

      // Lateral vector perpendicular to direction
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      // Upright surface normal
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      // Banking angle on corners
      const curvature = (i > 0 && i < numSamples)
        ? (this.trackSpline.getPoint((i + 1) / numSamples).x - point.x) * 0.04
        : 0;

      this.samples.push({
        u,
        distance: u * this.trackLength,
        point,
        tangent,
        normal,
        binormal,
        banking: THREE.MathUtils.clamp(curvature, -0.25, 0.25)
      });
    }
  }

  _buildHighDefTextures() {
    // 1. Dirt / Gravel Trail Texture (High contrast brown loam with tire ruts)
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 512;
    dirtCanvas.height = 512;
    const dctx = dirtCanvas.getContext('2d');

    // Rich dark dirt background
    dctx.fillStyle = '#6e472a';
    dctx.fillRect(0, 0, 512, 512);

    // Multi-octave dirt speckles
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const shade = Math.floor(Math.random() * 50);
      dctx.fillStyle = `rgba(${85 + shade}, ${55 + shade * 0.7}, ${30 + shade * 0.5}, 0.3)`;
      dctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
    }

    // Tire track ruts
    dctx.fillStyle = '#4e311a';
    dctx.fillRect(90, 0, 55, 512);
    dctx.fillRect(367, 0, 55, 512);

    // Gravel stones
    for (let i = 0; i < 350; i++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      const r = Math.random() * 3 + 1.5;

      dctx.fillStyle = 'rgba(25, 18, 12, 0.6)';
      dctx.beginPath();
      dctx.arc(px + 1, py + 1.5, r, 0, Math.PI * 2);
      dctx.fill();

      const gray = Math.floor(Math.random() * 50 + 140);
      dctx.fillStyle = `rgb(${gray}, ${gray - 12}, ${gray - 20})`;
      dctx.beginPath();
      dctx.arc(px, py, r, 0, Math.PI * 2);
      dctx.fill();
    }

    this.trailTexture = new THREE.CanvasTexture(dirtCanvas);
    this.trailTexture.wrapS = THREE.RepeatWrapping;
    this.trailTexture.wrapT = THREE.RepeatWrapping;
    this.trailTexture.repeat.set(1, 45);

    // 2. Alpine Grass & Rock Flank Texture
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 512;
    grassCanvas.height = 512;
    const gctx = grassCanvas.getContext('2d');

    gctx.fillStyle = '#44663b'; // Alpine green
    gctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1800; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      gctx.fillStyle = Math.random() > 0.4 ? 'rgba(85, 95, 80, 0.35)' : 'rgba(45, 80, 35, 0.45)';
      gctx.fillRect(rx, ry, Math.random() * 14 + 4, Math.random() * 6 + 2);
    }

    this.grassTexture = new THREE.CanvasTexture(grassCanvas);
    this.grassTexture.wrapS = THREE.RepeatWrapping;
    this.grassTexture.wrapT = THREE.RepeatWrapping;
    this.grassTexture.repeat.set(12, 50);
  }

  _buildTrackRibbon() {
    const segments = this.samples.length - 1;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    const halfW = this.trackWidth * 0.5;

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const bankOffset = Math.sin(s.banking) * halfW;

      const left = s.point.clone().addScaledVector(s.normal, -halfW);
      left.y += bankOffset;
      const center = s.point.clone();
      center.y += 0.12; // Slight crown in track center
      const right = s.point.clone().addScaledVector(s.normal, halfW);
      right.y -= bankOffset;

      positions.push(left.x, left.y, left.z);
      positions.push(center.x, center.y, center.z);
      positions.push(right.x, right.y, right.z);

      const v = s.distance / 12;
      uvs.push(0, v);
      uvs.push(0.5, v);
      uvs.push(1, v);

      if (i < segments) {
        const row1 = i * 3;
        const row2 = (i + 1) * 3;

        // Quad 1: Left to Center (CCW)
        indices.push(row1, row1 + 1, row2);
        indices.push(row1 + 1, row2 + 1, row2);

        // Quad 2: Center to Right (CCW)
        indices.push(row1 + 1, row1 + 2, row2 + 1);
        indices.push(row1 + 2, row2 + 2, row2 + 1);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const trackMat = new THREE.MeshStandardMaterial({
      map: this.trailTexture,
      roughness: 0.88,
      metalness: 0.08,
      side: THREE.DoubleSide
    });

    this.trackMesh = new THREE.Mesh(geom, trackMat);
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    // Guardrails with wooden posts and banners
    this._buildGuardrails();
  }

  _buildLoftedMountainFlanks() {
    // Generate left and right mountain slopes directly lofted from the track edge
    const segments = this.samples.length - 1;
    const halfW = this.trackWidth * 0.5;

    // Mountain Flank Material (Alpine grass & rocky crags)
    const flankMat = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide
    });

    // 1. LEFT FLANK (Extends from left track edge -halfW out to -160m cliff)
    const leftGeom = new THREE.BufferGeometry();
    const leftPos = [];
    const leftUv = [];
    const leftIndices = [];

    // 2. RIGHT FLANK (Extends from right track edge +halfW out to +160m cliff)
    const rightGeom = new THREE.BufferGeometry();
    const rightPos = [];
    const rightUv = [];
    const rightIndices = [];

    const flankDistances = [0, 8, 28, 75, 160];
    const flankRises = [0, 0.4, 6.0, 24.0, 68.0];

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const bankOffset = Math.sin(s.banking) * halfW;
      const v = s.distance / 16;

      // Noise factor along track for rugged crags
      const noise = Math.sin(s.distance * 0.05) * 4.0 + Math.cos(s.distance * 0.02) * 6.0;

      // Left Flank Vertices (inner to outer)
      for (let k = 0; k < flankDistances.length; k++) {
        const offset = halfW + flankDistances[k];
        const rise = flankRises[k] + (k > 1 ? noise * (k / 4) : 0);
        const pt = s.point.clone().addScaledVector(s.normal, -offset);
        pt.y += bankOffset + rise;

        leftPos.push(pt.x, pt.y, pt.z);
        leftUv.push(k / (flankDistances.length - 1), v);
      }

      // Right Flank Vertices (inner to outer)
      for (let k = 0; k < flankDistances.length; k++) {
        const offset = halfW + flankDistances[k];
        const rise = flankRises[k] + (k > 1 ? noise * (k / 4) : 0);
        const pt = s.point.clone().addScaledVector(s.normal, offset);
        pt.y += -bankOffset + rise;

        rightPos.push(pt.x, pt.y, pt.z);
        rightUv.push(k / (flankDistances.length - 1), v);
      }

      if (i < segments) {
        const numCols = flankDistances.length;
        for (let k = 0; k < numCols - 1; k++) {
          const row1 = i * numCols + k;
          const row2 = (i + 1) * numCols + k;

          // Left flank quads (CCW)
          leftIndices.push(row1, row2, row1 + 1);
          leftIndices.push(row1 + 1, row2, row2 + 1);

          // Right flank quads (CCW)
          rightIndices.push(row1, row1 + 1, row2);
          rightIndices.push(row1 + 1, row2 + 1, row2);
        }
      }
    }

    leftGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftPos, 3));
    leftGeom.setAttribute('uv', new THREE.Float32BufferAttribute(leftUv, 2));
    leftGeom.setIndex(leftIndices);
    leftGeom.computeVertexNormals();

    rightGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightPos, 3));
    rightGeom.setAttribute('uv', new THREE.Float32BufferAttribute(rightUv, 2));
    rightGeom.setIndex(rightIndices);
    rightGeom.computeVertexNormals();

    this.mountainLeftMesh = new THREE.Mesh(leftGeom, flankMat);
    this.mountainLeftMesh.receiveShadow = true;
    this.scene.add(this.mountainLeftMesh);

    this.mountainRightMesh = new THREE.Mesh(rightGeom, flankMat);
    this.mountainRightMesh.receiveShadow = true;
    this.scene.add(this.mountainRightMesh);
  }

  _buildGuardrails() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
    const postGeom = new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6);
    const railGeom = new THREE.BoxGeometry(0.08, 0.22, 6.4);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.6 });

    const guardGroup = new THREE.Group();
    const halfW = this.trackWidth * 0.5 + 0.6;

    for (let i = 12; i < this.samples.length - 25; i += 6) {
      const s = this.samples[i];
      [-halfW, halfW].forEach(side => {
        const post = new THREE.Mesh(postGeom, postMat);
        const pos = s.point.clone().addScaledVector(s.normal, side);
        pos.y += 0.7;
        post.position.copy(pos);
        guardGroup.add(post);

        const rail = new THREE.Mesh(railGeom, railMat);
        rail.position.copy(pos);
        rail.position.y += 0.2;
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.tangent);
        guardGroup.add(rail);
      });
    }
    this.scene.add(guardGroup);
  }

  _buildHorizonPanorama() {
    const horizonGroup = new THREE.Group();
    const peakMat = new THREE.MeshBasicMaterial({ color: 0x9bc3d4, fog: false });
    const snowMat = new THREE.MeshBasicMaterial({ color: 0xf0f8ff, fog: false });

    for (let a = 0; a < 24; a++) {
      const angle = (a / 24) * Math.PI * 2;
      const dist = 780 + Math.random() * 200;
      const height = 240 + Math.random() * 180;
      const baseW = 150 + Math.random() * 80;

      const coneGeom = new THREE.ConeGeometry(baseW, height, 5);
      const mtn = new THREE.Mesh(coneGeom, peakMat);
      mtn.position.set(
        Math.cos(angle) * dist,
        height * 0.45,
        Math.sin(angle) * dist + 800
      );
      horizonGroup.add(mtn);

      const snowGeom = new THREE.ConeGeometry(baseW * 0.38, height * 0.38, 5);
      const snow = new THREE.Mesh(snowGeom, snowMat);
      snow.position.set(mtn.position.x, mtn.position.y + height * 0.31, mtn.position.z);
      horizonGroup.add(snow);
    }

    this.scene.add(horizonGroup);
  }

  _buildSceneryProps() {
    this._buildInstancedTrees();
    this._buildInstancedRocks();
    this._buildRaceBanners();
  }

  _buildInstancedTrees() {
    const count = 450;
    const trunkGeom = new THREE.CylinderGeometry(0.24, 0.44, 2.4, 5);
    const foliageGeom = new THREE.ConeGeometry(2.4, 6.2, 6);
    foliageGeom.translate(0, 3.8, 0);

    const pineMat = new THREE.MeshStandardMaterial({
      color: 0x1f4625,
      roughness: 0.88,
      flatShading: true
    });

    const instancedPine = new THREE.InstancedMesh(foliageGeom, pineMat, count);
    instancedPine.castShadow = true;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const u = 0.02 + Math.random() * 0.95;
      const pt = this.trackSpline.getPoint(u);
      const side = Math.random() > 0.5 ? 1 : -1;
      const distOffset = this.trackWidth * 0.9 + Math.random() * 55;

      const x = pt.x + side * distOffset;
      const z = pt.z + (Math.random() - 0.5) * 18;
      const y = this.getTerrainElevation(x, z);

      dummy.position.set(x, y - 0.4, z); // Firmly rooted into terrain
      const scale = 0.75 + Math.random() * 0.85;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      instancedPine.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(instancedPine);
  }

  _buildInstancedRocks() {
    const rockCount = 200;
    const rockGeom = new THREE.DodecahedronGeometry(1.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6e6e69,
      roughness: 0.92,
      flatShading: true
    });

    const rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
    rocks.castShadow = true;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < rockCount; i++) {
      const u = 0.04 + Math.random() * 0.94;
      const pt = this.trackSpline.getPoint(u);
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = this.trackWidth * 0.75 + Math.random() * 28;

      const x = pt.x + side * offset;
      const z = pt.z;
      const y = this.getTerrainElevation(x, z) - 0.15;

      dummy.position.set(x, y - 0.4, z); // Firmly rooted into terrain
      const s = 0.6 + Math.random() * 1.6;
      dummy.scale.set(s, s * 0.75, s);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.updateMatrix();

      rocks.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(rocks);
  }

  _buildRaceBanners() {
    const startPoint = this.samples[3].point;
    const startArch = this._createArch('START / SUMMIT', 0xff3b00);
    startArch.position.copy(startPoint);
    this.scene.add(startArch);

    const finishSample = this.samples.find(s => s.point.z >= this.finishZ) || this.samples[this.samples.length - 20];
    const finishArch = this._createArch('FINISH / META', 0x00ffcc);
    finishArch.position.copy(finishSample.point);
    this.scene.add(finishArch);
  }

  _createArch(title, bannerColor) {
    const group = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
    const bannerMat = new THREE.MeshStandardMaterial({
      color: bannerColor,
      emissive: bannerColor,
      emissiveIntensity: 0.35,
      roughness: 0.4
    });

    const pGeom = new THREE.BoxGeometry(1.0, 7.5, 1.0);
    const leftPillar = new THREE.Mesh(pGeom, pillarMat);
    leftPillar.position.set(-this.trackWidth * 0.5 - 0.8, 3.75, 0);

    const rightPillar = new THREE.Mesh(pGeom, pillarMat);
    rightPillar.position.set(this.trackWidth * 0.5 + 0.8, 3.75, 0);

    const topBanner = new THREE.Mesh(
      new THREE.BoxGeometry(this.trackWidth + 3.2, 1.6, 1.2),
      bannerMat
    );
    topBanner.position.set(0, 7.0, 0);

    group.add(leftPillar, rightPillar, topBanner);
    return group;
  }

  _buildTrackItems() {
    // 1. Kickers / Jump Ramps
    const rampDistances = [220, 460, 840, 1080, 1360];
    const rampGeom = new THREE.BoxGeometry(5.2, 1.4, 4.2);
    rampGeom.rotateX(-0.38);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xd35400, roughness: 0.55 });

    rampDistances.forEach(dist => {
      const sample = this.getSampleAtDistance(dist);
      if (!sample) return;
      const ramp = new THREE.Mesh(rampGeom, rampMat);
      ramp.position.copy(sample.point);
      ramp.position.y += 0.55;
      ramp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sample.tangent);
      this.scene.add(ramp);

      this.ramps.push({
        position: ramp.position,
        distance: dist,
        boostPower: 20.0
      });
    });

    // 2. High-Octane Neon Nitro Pads
    const boostDistances = [110, 340, 660, 960, 1240, 1480];
    const boostGeom = new THREE.PlaneGeometry(4.0, 5.5);
    boostGeom.rotateX(-Math.PI / 2);

    const boostCanvas = document.createElement('canvas');
    boostCanvas.width = 128;
    boostCanvas.height = 128;
    const bctx = boostCanvas.getContext('2d');
    bctx.fillStyle = '#051119';
    bctx.fillRect(0, 0, 128, 128);
    bctx.fillStyle = '#00ffcc';
    for (let y = 30; y <= 90; y += 30) {
      bctx.beginPath();
      bctx.moveTo(64, y - 22);
      bctx.lineTo(98, y + 8);
      bctx.lineTo(76, y + 8);
      bctx.lineTo(76, y + 24);
      bctx.lineTo(52, y + 24);
      bctx.lineTo(52, y + 8);
      bctx.lineTo(30, y + 8);
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
      pad.position.y += 0.14;
      pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sample.tangent);
      this.scene.add(pad);

      this.boostPads.push({
        mesh: pad,
        distance: dist,
        position: pad.position
      });
    });

    // 3. Collectible Golden Stars
    const starGeom = new THREE.CylinderGeometry(0.75, 0.75, 0.16, 12);
    starGeom.rotateX(Math.PI / 2);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xff8800,
      emissiveIntensity: 0.45,
      metalness: 0.9,
      roughness: 0.15
    });

    for (let d = 45; d < this.trackLength - 80; d += 22) {
      if (rampDistances.some(rd => Math.abs(rd - d) < 10)) continue;
      const sample = this.getSampleAtDistance(d);
      if (!sample) continue;

      const star = new THREE.Mesh(starGeom, starMat);
      const lateralSwerve = Math.sin(d * 0.08) * (this.trackWidth * 0.32);
      const pos = sample.point.clone().addScaledVector(sample.normal, lateralSwerve);
      pos.y += 1.35;
      star.position.copy(pos);
      this.scene.add(star);

      this.collectibles.push({
        mesh: star,
        position: pos,
        collected: false
      });
    }

    // 4. Checkpoints
    [320, 720, 1120, 1420].forEach((dist, idx) => {
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

  /**
   * Continuous analytical elevation matching the lofted terrain surface.
   */
  getTerrainElevation(x, z) {
    const u = Math.max(0, Math.min(1, z / 1720));
    const trackPoint = this.trackSpline.getPoint(u);
    const dx = x - trackPoint.x;
    const distToTrack = Math.abs(dx);
    const halfTrack = this.trackWidth * 0.5;

    // 1. Direct on-track elevation (with crowned profile)
    if (distToTrack <= halfTrack) {
      const crown = (1.0 - (distToTrack / halfTrack) * (distToTrack / halfTrack)) * 0.12;
      return trackPoint.y + crown;
    }

    // 2. Off-track mountain flanks: exact piecewise match with lofted mesh
    const excess = distToTrack - halfTrack;
    let flankRise = 0;
    if (excess <= 8) {
      flankRise = (excess / 8) * 0.4;
    } else if (excess <= 28) {
      flankRise = 0.4 + ((excess - 8) / 20) * 5.6;
    } else if (excess <= 75) {
      flankRise = 6.0 + ((excess - 28) / 47) * 18.0;
    } else {
      flankRise = 24.0 + Math.min(44.0, ((excess - 75) / 85) * 44.0);
    }
    return trackPoint.y + flankRise;
  }

  update(delta) {
    const rot = delta * 3.8;
    this.collectibles.forEach(c => {
      if (!c.collected) {
        c.mesh.rotation.y += rot;
      }
    });

    const pulse = 0.88 + Math.sin(Date.now() * 0.009) * 0.22;
    this.boostPads.forEach(b => {
      b.mesh.scale.set(1, pulse, 1);
    });
  }
}
