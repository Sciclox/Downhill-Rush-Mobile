import * as THREE from 'three';

/**
 * 3D Downhill Mountain Bike & Rider model.
 * Full dual-suspension downhill rig with steerable front fork, spinning wheels,
 * rotating cranks, and rider with helmet and goggles.
 */
export class Bike {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();

    // Node references for animation
    this.frontAssembly = new THREE.Group();
    this.frontWheel = null;
    this.rearWheel = null;
    this.cranksGroup = new THREE.Group();
    this.riderGroup = new THREE.Group();
    this.forkStanchions = null;

    this.wheelRadius = 0.52; // Downhill 29er
    this.wheelBase = 1.6;

    this._buildBike();
    this._buildRider();

    this.root.castShadow = true;
    this.scene.add(this.root);
  }

  _buildBike() {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xff3b00, // Downhill Racing Neon Orange
      roughness: 0.3,
      metalness: 0.6
    });

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.4,
      metalness: 0.8
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Kashima suspension coat
      roughness: 0.2,
      metalness: 0.85
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.95
    });

    // 1. Frame main triangle
    const topTube = this._createCylinder(0.06, 0.05, 1.1, metalMat);
    topTube.position.set(0, 0.92, -0.15);
    topTube.rotation.x = 0.35;
    this.root.add(topTube);

    const downTube = this._createCylinder(0.08, 0.07, 1.25, frameMat);
    downTube.position.set(0, 0.65, -0.05);
    downTube.rotation.x = -0.55;
    this.root.add(downTube);

    const seatTube = this._createCylinder(0.06, 0.06, 0.75, frameMat);
    seatTube.position.set(0, 0.78, -0.55);
    seatTube.rotation.x = -0.25;
    this.root.add(seatTube);

    // Saddle / Seat
    const saddleGeom = new THREE.BoxGeometry(0.24, 0.08, 0.5);
    const saddleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const saddle = new THREE.Mesh(saddleGeom, saddleMat);
    saddle.position.set(0, 1.15, -0.65);
    saddle.rotation.x = -0.1;
    this.root.add(saddle);

    // Rear Swingarm / Suspension Linkage
    const swingarm = this._createCylinder(0.05, 0.05, 0.85, frameMat);
    swingarm.position.set(0, 0.5, -0.5);
    swingarm.rotation.x = 0.55;
    this.root.add(swingarm);

    // Rear Shock (Piggyback reservoir)
    const shockBody = this._createCylinder(0.04, 0.04, 0.35, goldMat);
    shockBody.position.set(0, 0.7, -0.32);
    shockBody.rotation.x = 0.9;
    this.root.add(shockBody);

    // 2. Front Fork Assembly (Steerable)
    this.frontAssembly.position.set(0, 0.95, 0.45);
    this.root.add(this.frontAssembly);

    // Triple clamp crowns
    const crownGeom = new THREE.BoxGeometry(0.35, 0.05, 0.12);
    const topCrown = new THREE.Mesh(crownGeom, metalMat);
    topCrown.position.set(0, 0.18, 0);
    this.frontAssembly.add(topCrown);

    // Handlebars
    const barGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
    barGeom.rotateZ(Math.PI / 2);
    const barMesh = new THREE.Mesh(barGeom, metalMat);
    barMesh.position.set(0, 0.25, -0.02);
    this.frontAssembly.add(barMesh);

    // Grips
    [-0.5, 0.5].forEach(x => {
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.22, 8),
        new THREE.MeshStandardMaterial({ color: 0xff3b00, roughness: 0.7 })
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(x, 0.25, -0.02);
      this.frontAssembly.add(grip);
    });

    // Dual stanchions (Gold Kashima)
    [-0.14, 0.14].forEach(x => {
      const stan = this._createCylinder(0.038, 0.038, 0.65, goldMat);
      stan.position.set(x, -0.15, 0.08);
      stan.rotation.x = 0.42; // Rake angle
      this.frontAssembly.add(stan);

      // Lower legs (Black)
      const lower = this._createCylinder(0.048, 0.048, 0.6, metalMat);
      lower.position.set(x, -0.55, 0.28);
      lower.rotation.x = 0.42;
      this.frontAssembly.add(lower);
    });

    // 3. Wheels
    this.frontWheel = this._createWheel(tireMat, metalMat);
    this.frontWheel.position.set(0, -0.92, 0.45);
    this.frontAssembly.add(this.frontWheel);

    this.rearWheel = this._createWheel(tireMat, metalMat);
    this.rearWheel.position.set(0, 0.52, -0.9);
    this.root.add(this.rearWheel);

    // 4. Cranks & Pedals
    this.cranksGroup.position.set(0, 0.45, -0.15);
    const axle = this._createCylinder(0.03, 0.03, 0.35, metalMat);
    axle.rotation.z = Math.PI / 2;
    this.cranksGroup.add(axle);

    const crankGeom = new THREE.BoxGeometry(0.04, 0.25, 0.04);
    const leftArm = new THREE.Mesh(crankGeom, metalMat);
    leftArm.position.set(0.18, 0.1, 0);
    const rightArm = new THREE.Mesh(crankGeom, metalMat);
    rightArm.position.set(-0.18, -0.1, 0);
    this.cranksGroup.add(leftArm, rightArm);

    // Pedals
    const pedalGeom = new THREE.BoxGeometry(0.14, 0.03, 0.12);
    const leftPedal = new THREE.Mesh(pedalGeom, frameMat);
    leftPedal.position.set(0.24, 0.2, 0);
    const rightPedal = new THREE.Mesh(pedalGeom, frameMat);
    rightPedal.position.set(-0.24, -0.2, 0);
    this.cranksGroup.add(leftPedal, rightPedal);

    this.root.add(this.cranksGroup);
  }

  _createWheel(tireMat, hubMat) {
    const wheelGroup = new THREE.Group();
    // Knobby Tire (Torus)
    const tireGeom = new THREE.TorusGeometry(0.5, 0.075, 8, 24);
    tireGeom.rotateY(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeom, tireMat);
    wheelGroup.add(tire);

    // Rim
    const rimGeom = new THREE.TorusGeometry(0.42, 0.02, 6, 24);
    rimGeom.rotateY(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeom, hubMat);
    wheelGroup.add(rim);

    // Hub
    const hub = this._createCylinder(0.05, 0.05, 0.22, hubMat);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    // Spokes
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI;
      const spoke = this._createCylinder(0.012, 0.012, 0.84, hubMat);
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }
    return wheelGroup;
  }

  _buildRider() {
    const jerseyMat = new THREE.MeshStandardMaterial({
      color: 0x00d2d3, // Cyan Downhill Jersey
      roughness: 0.7
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937, // Dark slate downhill shorts
      roughness: 0.8
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xff3b00, // Racing Orange Full Face Helmet
      metalness: 0.5,
      roughness: 0.3
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.1
    });

    // Rider positioned aggressively over bike
    this.riderGroup.position.set(0, 0.85, -0.3);

    // Torso (leaning forward)
    const torsoGeom = new THREE.BoxGeometry(0.42, 0.65, 0.28);
    const torso = new THREE.Mesh(torsoGeom, jerseyMat);
    torso.position.set(0, 0.65, 0.15);
    torso.rotation.x = 0.55; // Aggressive downhill attack position
    this.riderGroup.add(torso);

    // Helmet (Full Face)
    const helmetGeom = new THREE.SphereGeometry(0.24, 12, 10);
    const helmet = new THREE.Mesh(helmetGeom, helmetMat);
    helmet.position.set(0, 1.15, 0.42);

    // Visor
    const visorGeom = new THREE.BoxGeometry(0.25, 0.08, 0.18);
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 1.2, 0.55);
    visor.rotation.x = 0.2;
    this.riderGroup.add(helmet, visor);

    // Arms reaching to handlebars
    [-0.26, 0.26].forEach(x => {
      const arm = this._createCylinder(0.07, 0.05, 0.75, jerseyMat);
      arm.position.set(x, 0.75, 0.45);
      arm.rotation.x = 1.05;
      arm.rotation.z = x > 0 ? -0.25 : 0.25;
      this.riderGroup.add(arm);
    });

    // Legs
    [-0.2, 0.2].forEach(x => {
      const thigh = this._createCylinder(0.09, 0.07, 0.55, pantsMat);
      thigh.position.set(x, 0.25, 0.05);
      thigh.rotation.x = 0.6;
      this.riderGroup.add(thigh);
    });

    this.root.add(this.riderGroup);
  }

  _createCylinder(rTop, rBottom, height, mat) {
    const geom = new THREE.CylinderGeometry(rTop, rBottom, height, 8);
    return new THREE.Mesh(geom, mat);
  }

  updateVisuals(speed, steerInput, isPedaling, leanAngle, delta) {
    // 1. Rotate wheels proportional to linear speed
    const wheelRot = (speed / this.wheelRadius) * delta;
    if (this.frontWheel) this.frontWheel.rotation.x += wheelRot;
    if (this.rearWheel) this.rearWheel.rotation.x += wheelRot;

    // 2. Rotate cranks when pedaling
    if (isPedaling && speed > 0.1) {
      this.cranksGroup.rotation.x += delta * Math.min(18, speed * 1.5);
    }

    // 3. Turn handlebars with steering input
    const targetSteerAngle = -steerInput * 0.45;
    this.frontAssembly.rotation.y = THREE.MathUtils.lerp(
      this.frontAssembly.rotation.y,
      targetSteerAngle,
      delta * 12
    );

    // 4. Lean bike body into corners
    const targetLean = steerInput * 0.35 * Math.min(1, speed / 8);
    this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, targetLean, delta * 10);
  }

  setWipeoutRagdoll(active) {
    if (active) {
      this.riderGroup.rotation.x = -Math.PI * 0.4;
      this.riderGroup.position.y = -0.2;
    } else {
      this.riderGroup.rotation.x = 0;
      this.riderGroup.position.set(0, 0.85, -0.3);
    }
  }
}
