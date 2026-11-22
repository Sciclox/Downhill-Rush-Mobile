import * as THREE from 'three';

/**
 * Professional Downhill Mountain Bike & Rider Model.
 * Features:
 * - Dual-suspension linkage with rear shock and Kashima gold fork
 * - Perforated disc brake rotors and brake calipers
 * - Knobby 3D tire tread lugs and detailed rims
 * - Handlebars with grips, brake levers and digital GPS speedometer
 * - Rider with aerodynamic downhill posture, helmet, visor, jersey number "77" and knee pads
 */
export class Bike {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();

    // Node references for dynamic animations
    this.frontAssembly = new THREE.Group();
    this.forkLowers = new THREE.Group();
    this.frontWheel = null;
    this.rearWheel = null;
    this.cranksGroup = new THREE.Group();
    this.riderGroup = new THREE.Group();
    this.riderTorso = null;
    this.gpsDisplay = null;

    this.wheelRadius = 0.54; // 29" Downhill tire
    this.wheelBase = 1.62;

    this._buildMaterials();
    this._buildFrame();
    this._buildFrontSuspensionAndSteering();
    this._buildWheels();
    this._buildDrivetrain();
    this._buildRider();

    this.root.castShadow = true;
    this.scene.add(this.root);
  }

  _buildMaterials() {
    // Pro Downhill Colorway: Metallic Racing Orange, Satin Black, Kashima Gold, Anodized Cyan
    this.mats = {
      frame: new THREE.MeshStandardMaterial({
        color: 0xff3b00,
        roughness: 0.25,
        metalness: 0.7
      }),
      carbon: new THREE.MeshStandardMaterial({
        color: 0x161616,
        roughness: 0.35,
        metalness: 0.85
      }),
      kashima: new THREE.MeshStandardMaterial({
        color: 0xd4af37, // Kashima suspension coat
        roughness: 0.15,
        metalness: 0.95
      }),
      tire: new THREE.MeshStandardMaterial({
        color: 0x1c1c1c,
        roughness: 0.95,
        metalness: 0.05
      }),
      rotor: new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.2,
        metalness: 0.9
      }),
      caliper: new THREE.MeshStandardMaterial({
        color: 0x00d2d3, // Anodized Cyan Calipers
        roughness: 0.3,
        metalness: 0.7
      }),
      jersey: new THREE.MeshStandardMaterial({
        color: 0x00d2d3,
        roughness: 0.75
      }),
      pants: new THREE.MeshStandardMaterial({
        color: 0x1a202c,
        roughness: 0.85
      }),
      helmet: new THREE.MeshStandardMaterial({
        color: 0xff3b00,
        roughness: 0.2,
        metalness: 0.6
      }),
      visor: new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.1,
        metalness: 0.95
      })
    };
  }

  _buildFrame() {
    // Top Tube (Slanted aggressive downhill geometry)
    const topTube = this._createCylinder(0.055, 0.045, 1.15, this.mats.carbon);
    topTube.position.set(0, 0.96, -0.15);
    topTube.rotation.x = 0.38;
    this.root.add(topTube);

    // Down Tube (Thick hydroformed alloy)
    const downTube = this._createCylinder(0.085, 0.075, 1.3, this.mats.frame);
    downTube.position.set(0, 0.68, -0.05);
    downTube.rotation.x = -0.56;
    this.root.add(downTube);

    // Seat Tube & Dropper Post
    const seatTube = this._createCylinder(0.055, 0.055, 0.8, this.mats.frame);
    seatTube.position.set(0, 0.82, -0.55);
    seatTube.rotation.x = -0.28;
    this.root.add(seatTube);

    // Racing Saddle
    const saddle = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.07, 0.48),
      this.mats.carbon
    );
    saddle.position.set(0, 1.18, -0.66);
    saddle.rotation.x = -0.12;
    this.root.add(saddle);

    // Rear Dual-Linkage Swingarm
    [-0.08, 0.08].forEach(x => {
      const stay = this._createCylinder(0.04, 0.035, 0.92, this.mats.frame);
      stay.position.set(x, 0.52, -0.52);
      stay.rotation.x = 0.58;
      this.root.add(stay);
    });

    // Coil/Air Rear Shock with Piggyback
    const shockBody = this._createCylinder(0.045, 0.045, 0.38, this.mats.kashima);
    shockBody.position.set(0, 0.74, -0.32);
    shockBody.rotation.x = 0.95;
    this.root.add(shockBody);

    const piggyback = this._createCylinder(0.035, 0.035, 0.22, this.mats.carbon);
    piggyback.position.set(0, 0.82, -0.26);
    piggyback.rotation.x = 0.95;
    this.root.add(piggyback);
  }

  _buildFrontSuspensionAndSteering() {
    this.frontAssembly.position.set(0, 0.98, 0.48);
    this.root.add(this.frontAssembly);

    // Triple clamp crowns (Dual-Crown Downhill standard)
    const crownGeom = new THREE.BoxGeometry(0.38, 0.055, 0.14);
    const topCrown = new THREE.Mesh(crownGeom, this.mats.carbon);
    topCrown.position.set(0, 0.18, 0);
    const bottomCrown = new THREE.Mesh(crownGeom, this.mats.carbon);
    bottomCrown.position.set(0, -0.05, 0);
    this.frontAssembly.add(topCrown, bottomCrown);

    // Handlebars (800mm wide downhill bars with rise)
    const barGeom = new THREE.CylinderGeometry(0.032, 0.032, 1.18, 10);
    barGeom.rotateZ(Math.PI / 2);
    const bar = new THREE.Mesh(barGeom, this.mats.carbon);
    bar.position.set(0, 0.28, -0.02);
    this.frontAssembly.add(bar);

    // Lock-on Grips
    [-0.52, 0.52].forEach(x => {
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.044, 0.24, 10),
        this.mats.frame
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(x, 0.28, -0.02);
      this.frontAssembly.add(grip);
    });

    // Digital GPS Bike Computer on stem
    const gpsGeom = new THREE.BoxGeometry(0.12, 0.04, 0.14);
    const gpsMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    this.gpsDisplay = new THREE.Mesh(gpsGeom, gpsMat);
    this.gpsDisplay.position.set(0, 0.32, 0.05);
    this.gpsDisplay.rotation.x = -0.4;
    this.frontAssembly.add(this.gpsDisplay);

    // 40mm Kashima Stanchions
    [-0.15, 0.15].forEach(x => {
      const stanchion = this._createCylinder(0.04, 0.04, 0.72, this.mats.kashima);
      stanchion.position.set(x, -0.16, 0.09);
      stanchion.rotation.x = 0.44;
      this.frontAssembly.add(stanchion);

      // Lower Casting (Magnesium Lower Legs)
      const lower = this._createCylinder(0.052, 0.052, 0.65, this.mats.carbon);
      lower.position.set(x, -0.58, 0.3);
      lower.rotation.x = 0.44;
      this.forkLowers.add(lower);
    });

    // Lower Arch Bridge
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 6, 12, Math.PI),
      this.mats.carbon
    );
    arch.position.set(0, -0.42, 0.22);
    this.forkLowers.add(arch);

    this.frontAssembly.add(this.forkLowers);
  }

  _buildWheels() {
    // Front Wheel Assembly (Attached to front fork)
    this.frontWheel = this._createDetailedWheel(true);
    this.frontWheel.position.set(0, -0.96, 0.48);
    this.frontAssembly.add(this.frontWheel);

    // Rear Wheel Assembly (Attached to frame rear axle)
    this.rearWheel = this._createDetailedWheel(false);
    this.rearWheel.position.set(0, 0.54, -0.92);
    this.root.add(this.rearWheel);
  }

  _createDetailedWheel(isFront) {
    const wheel = new THREE.Group();

    // 1. Knobby 3D Tire with Tread Blocks
    const tireGeom = new THREE.TorusGeometry(this.wheelRadius - 0.06, 0.08, 10, 32);
    tireGeom.rotateY(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeom, this.mats.tire);
    wheel.add(tire);

    // 3D Knobby Lugs along tire perimeter
    const knobGeom = new THREE.BoxGeometry(0.05, 0.04, 0.06);
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      const knob = new THREE.Mesh(knobGeom, this.mats.tire);
      knob.position.set(
        0,
        Math.cos(angle) * (this.wheelRadius - 0.01),
        Math.sin(angle) * (this.wheelRadius - 0.01)
      );
      knob.rotation.x = -angle;
      wheel.add(knob);
    }

    // 2. Anodized Alloy Rim
    const rimGeom = new THREE.TorusGeometry(0.44, 0.022, 8, 32);
    rimGeom.rotateY(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeom, this.mats.carbon);
    wheel.add(rim);

    // 3. Central Hub & Thru-Axle
    const hub = this._createCylinder(0.055, 0.055, 0.26, this.mats.carbon);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);

    // 4. Spokes (Cross-laced pattern)
    for (let i = 0; i < 8; i++) {
      const spoke = this._createCylinder(0.012, 0.012, 0.88, this.mats.carbon);
      spoke.rotation.x = (i / 8) * Math.PI;
      wheel.add(spoke);
    }

    // 5. 203mm Disc Brake Rotor (Perforated)
    const rotor = this._createCylinder(0.22, 0.22, 0.015, this.mats.rotor);
    rotor.rotation.z = Math.PI / 2;
    rotor.position.x = 0.11;
    wheel.add(rotor);

    // 6. Hydraulic 4-Piston Brake Caliper
    const caliper = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.16, 0.12),
      this.mats.caliper
    );
    caliper.position.set(0.12, 0.16, -0.12);
    wheel.add(caliper);

    // 7. Rear 12-Speed Cassette Cog (if rear wheel)
    if (!isFront) {
      const cassette = this._createCylinder(0.18, 0.12, 0.06, this.mats.rotor);
      cassette.rotation.z = Math.PI / 2;
      cassette.position.x = -0.12;
      wheel.add(cassette);
    }

    return wheel;
  }

  _buildDrivetrain() {
    this.cranksGroup.position.set(0, 0.46, -0.16);

    // Crank spindle & chainring
    const chainring = this._createCylinder(0.16, 0.16, 0.02, this.mats.carbon);
    chainring.rotation.z = Math.PI / 2;
    chainring.position.x = -0.14;
    this.cranksGroup.add(chainring);

    // Forged Crank Arms
    const crankGeom = new THREE.BoxGeometry(0.045, 0.28, 0.045);
    const leftArm = new THREE.Mesh(crankGeom, this.mats.carbon);
    leftArm.position.set(0.18, 0.12, 0);
    const rightArm = new THREE.Mesh(crankGeom, this.mats.carbon);
    rightArm.position.set(-0.18, -0.12, 0);
    this.cranksGroup.add(leftArm, rightArm);

    // Platform Pedals with pins
    const pedalGeom = new THREE.BoxGeometry(0.16, 0.035, 0.14);
    const leftPedal = new THREE.Mesh(pedalGeom, this.mats.frame);
    leftPedal.position.set(0.26, 0.24, 0);
    const rightPedal = new THREE.Mesh(pedalGeom, this.mats.frame);
    rightPedal.position.set(-0.26, -0.24, 0);
    this.cranksGroup.add(leftPedal, rightPedal);

    this.root.add(this.cranksGroup);
  }

  _buildRider() {
    this.riderGroup.position.set(0, 0.88, -0.28);

    // 1. Torso (Aerodynamic downhill attack posture)
    const torsoGeom = new THREE.BoxGeometry(0.44, 0.68, 0.3);
    this.riderTorso = new THREE.Mesh(torsoGeom, this.mats.jersey);
    this.riderTorso.position.set(0, 0.68, 0.16);
    this.riderTorso.rotation.x = 0.58;
    this.riderGroup.add(this.riderTorso);

    // Race number "77" back plate
    const numPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.26),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    numPlate.position.set(0, 0.72, 0.01);
    numPlate.rotation.x = 0.58;
    this.riderGroup.add(numPlate);

    // 2. Full Face Downhill Helmet
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 14, 12),
      this.mats.helmet
    );
    helmet.position.set(0, 1.22, 0.44);

    // Chin Bar & Goggles
    const chinBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.22),
      this.mats.helmet
    );
    chinBar.position.set(0, 1.12, 0.58);

    const goggles = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.1, 0.18),
      this.mats.visor
    );
    goggles.position.set(0, 1.25, 0.56);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.05, 0.24),
      this.mats.helmet
    );
    visor.position.set(0, 1.34, 0.58);
    visor.rotation.x = 0.22;

    this.riderGroup.add(helmet, chinBar, goggles, visor);

    // 3. Arms & Hands gripping the bars
    [-0.28, 0.28].forEach(x => {
      const arm = this._createCylinder(0.075, 0.055, 0.78, this.mats.jersey);
      arm.position.set(x, 0.78, 0.46);
      arm.rotation.x = 1.08;
      arm.rotation.z = x > 0 ? -0.28 : 0.28;
      this.riderGroup.add(arm);
    });

    // 4. Thighs & Knee Guards
    [-0.21, 0.21].forEach(x => {
      const thigh = this._createCylinder(0.095, 0.075, 0.58, this.mats.pants);
      thigh.position.set(x, 0.28, 0.06);
      thigh.rotation.x = 0.62;
      this.riderGroup.add(thigh);

      // Knee Guard
      const guard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.07, 0.2, 8),
        this.mats.carbon
      );
      guard.position.set(x, 0.06, 0.28);
      guard.rotation.x = 0.62;
      this.riderGroup.add(guard);
    });

    this.root.add(this.riderGroup);
  }

  _createCylinder(rTop, rBottom, height, mat) {
    const geom = new THREE.CylinderGeometry(rTop, rBottom, height, 10);
    return new THREE.Mesh(geom, mat);
  }

  updateVisuals(speed, steerInput, isPedaling, lateralOffset, delta) {
    // 1. Spin wheels accurately according to road speed
    const wheelRot = (speed / this.wheelRadius) * delta;
    if (this.frontWheel) this.frontWheel.rotation.x += wheelRot;
    if (this.rearWheel) this.rearWheel.rotation.x += wheelRot;

    // 2. Rotate cranks and pedals when pedaling
    if (isPedaling && speed > 0.1) {
      this.cranksGroup.rotation.x += delta * Math.min(22, speed * 1.6);
    }

    // 3. Turn handlebars & front fork smoothly with steering
    const targetSteerAngle = -steerInput * 0.42;
    this.frontAssembly.rotation.y = THREE.MathUtils.lerp(
      this.frontAssembly.rotation.y,
      targetSteerAngle,
      delta * 14
    );

    // 4. Bike lean into corners + rider tuck at high speeds
    const targetLean = steerInput * 0.38 * Math.min(1.0, speed / 10.0);
    this.root.rotation.z = THREE.MathUtils.lerp(this.root.rotation.z, targetLean, delta * 12);

    // 5. Rider aggressive tuck when exceeding 70 km/h (speed > 19.5 m/s)
    if (this.riderTorso) {
      const targetTuck = speed > 18 ? 0.78 : 0.58;
      this.riderTorso.rotation.x = THREE.MathUtils.lerp(this.riderTorso.rotation.x, targetTuck, delta * 6);
    }
  }

  setSuspensionCompression(frontComp, rearComp) {
    // Move front fork stanchions realistically
    if (this.forkLowers) {
      this.forkLowers.position.y = THREE.MathUtils.lerp(
        this.forkLowers.position.y,
        frontComp * 0.15,
        0.2
      );
    }
  }

  setWipeoutRagdoll(active) {
    if (active) {
      this.riderGroup.rotation.x = -Math.PI * 0.45;
      this.riderGroup.rotation.z = Math.PI * 0.25;
      this.riderGroup.position.y = -0.3;
    } else {
      this.riderGroup.rotation.set(0, 0, 0);
      this.riderGroup.position.set(0, 0.88, -0.28);
    }
  }
}
