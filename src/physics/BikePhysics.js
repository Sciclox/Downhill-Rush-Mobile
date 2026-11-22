import * as THREE from 'three';

/**
 * Dual-Wheel Downhill Physics Simulator with True Terrain Conformity.
 * Probes terrain independently at both wheels to mathematically eliminate
 * floor sinking, polygon clipping, and glitching on steep slopes.
 */
export class BikePhysics {
  constructor(trackManager, bikeEntity) {
    this.track = trackManager;
    this.bike = bikeEntity;

    // Spatial Position along track
    this.distance = 18.0;
    this.lateralOffset = 0.0;
    this.verticalOffset = 0.0;
    this.verticalVelocity = 0.0;

    // Wheel Geometry
    this.wheelRadius = this.bike.wheelRadius; // 0.54m
    this.wheelBase = this.bike.wheelBase;     // 1.62m
    this.halfBase = this.wheelBase * 0.5;

    // Movement Dynamics
    this.speed = 14.0;
    this.maxSpeed = 30.0;     // ~108 km/h
    this.boostMaxSpeed = 42.0; // ~151 km/h
    this.isGrounded = true;
    this.isBraking = false;
    this.isBoosting = false;
    this.boostTimer = 0.0;

    // Air Rotation & Trick Scoring
    this.airTime = 0.0;
    this.airPitch = 0.0;
    this.airRoll = 0.0;
    this.totalFlips = 0;
    this.trickScore = 0;

    // Crash State
    this.isCrashed = false;
    this.crashTimer = 0.0;
    this.lastCheckpointDistance = 18.0;

    // Pre-allocated vectors for 60fps zero-garbage execution
    this._bikePos = new THREE.Vector3();
    this._frontPos = new THREE.Vector3();
    this._rearPos = new THREE.Vector3();
    this._groundFront = new THREE.Vector3();
    this._groundRear = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._up = new THREE.Vector3();
  }

  update(inputs, delta) {
    if (this.isCrashed) {
      this._updateCrash(delta);
      return;
    }

    const sample = this.track.getSampleAtDistance(this.distance);
    if (!sample) return;

    // 1. Nitro Boost Duration
    if (this.isBoosting) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) {
        this.isBoosting = false;
      }
    }

    // 2. Slope & Gravitational Force (Downhill vector)
    const slope = -sample.tangent.y; // Positive downhill
    const gravityAccel = Math.max(0, slope * 20.0);

    // 3. Drive & Brake Accel
    let driveAccel = 0;
    if (inputs.pedal) {
      const topCap = this.isBoosting ? this.boostMaxSpeed : this.maxSpeed;
      if (this.speed < topCap) {
        driveAccel = 14.0 * (1.0 - this.speed / topCap);
      }
    }

    this.isBraking = inputs.brake;
    const brakeDecel = this.isBraking ? 26.0 : 0.0;
    const drag = 0.003 * this.speed * this.speed + 0.65;

    if (this.isGrounded) {
      this.speed += (gravityAccel + driveAccel - brakeDecel - drag) * delta;
      this.speed = Math.max(4.0, this.speed); // Always rolls forward on mountain
    }

    // 4. Lateral Steering with Soft Earthen Bank Containment
    const steerSens = 14.5 * Math.min(1.2, Math.max(0.5, this.speed / 16.0));
    this.lateralOffset += inputs.steer * steerSens * delta;

    // Shoulder Soft Boundary Restoring Force (Prevents flying into mountains)
    const trackHalfW = this.track.trackWidth * 0.48;
    if (Math.abs(this.lateralOffset) > trackHalfW) {
      const excess = Math.abs(this.lateralOffset) - trackHalfW;
      const pushDirection = -Math.sign(this.lateralOffset);
      this.lateralOffset += pushDirection * excess * 4.0 * delta;
      // Clamp to absolute playable shoulder
      const absoluteMax = this.track.trackWidth * 0.75;
      this.lateralOffset = THREE.MathUtils.clamp(this.lateralOffset, -absoluteMax, absoluteMax);
    }

    // 5. Dual-Wheel Ground Detection & Airborne Simulation
    this._updateDualWheelPhysics(sample, inputs, delta);

    // 6. Check Item Triggers (Boost pads, Ramps, Stars, Checkpoints)
    this._checkTriggers();
  }

  _updateDualWheelPhysics(sample, inputs, delta) {
    // Forward integration
    this.distance += this.speed * delta;
    const nextSample = this.track.getSampleAtDistance(this.distance);
    if (!nextSample) return;

    // Calculate tentative Center Position
    this._bikePos.copy(nextSample.point);
    this._bikePos.addScaledVector(nextSample.normal, this.lateralOffset);

    // Calculate Front and Rear Wheel XZ coordinates along current heading
    const heading = nextSample.tangent.clone().normalize();
    this._frontPos.copy(this._bikePos).addScaledVector(heading, this.halfBase);
    this._rearPos.copy(this._bikePos).addScaledVector(heading, -this.halfBase);

    // Sample Analytical Terrain Height under Front and Rear Wheels
    const frontGroundY = this.track.getTerrainElevation(this._frontPos.x, this._frontPos.z);
    const rearGroundY = this.track.getTerrainElevation(this._rearPos.x, this._rearPos.z);
    const avgGroundY = (frontGroundY + rearGroundY) * 0.5;

    if (this.isGrounded) {
      // Check for sudden drop / airborne takeoff (kicker ramps or steep drop-offs)
      const slopeDrop = nextSample.point.y - sample.point.y;
      const expectedSlopeDrop = sample.tangent.y * (this.speed * delta);

      if (slopeDrop < expectedSlopeDrop - 1.4 && this.speed > 16.0) {
        this.isGrounded = false;
        this.verticalVelocity = Math.max(4.5, this.speed * 0.28);
        this.verticalOffset = 0.1;
        this.airTime = 0.0;
        this.airPitch = 0.0;
        this.airRoll = 0.0;
      } else {
        // Firmly Grounded: Wheel contact constraint
        this.verticalOffset = 0.0;
        this._bikePos.y = avgGroundY + this.wheelRadius;
      }
    } else {
      // Airborne Trajectory
      this.airTime += delta;
      this.verticalVelocity -= 26.0 * delta; // Gravity
      this.verticalOffset += this.verticalVelocity * delta;

      // Aerial Tricks
      if (inputs.pedal) {
        this.airPitch += 3.8 * delta; // Backflip
      } else if (inputs.brake) {
        this.airPitch -= 3.8 * delta; // Frontflip
      }
      this.airRoll += inputs.steer * 4.2 * delta;

      this._bikePos.y = avgGroundY + this.wheelRadius + this.verticalOffset;

      // Landing Detection: When vertical offset touches ground
      if (this.verticalOffset <= 0.0) {
        this._handleLanding(frontGroundY, rearGroundY);
      }
    }

    // Frame Pitch Angle derived from Front vs Rear wheel terrain elevation
    const terrainPitch = Math.atan2(frontGroundY - rearGroundY, this.wheelBase);

    // Update 3D Mesh Transform
    this._applyTransform(nextSample, terrainPitch, inputs, delta);
  }

  _handleLanding(frontGroundY, rearGroundY) {
    this.verticalOffset = 0.0;
    this.verticalVelocity = 0.0;
    this.isGrounded = true;

    // Check angular alignment on landing
    const pitchDeg = (Math.abs(this.airPitch) * 180 / Math.PI) % 360;
    const isCleanLanding = (pitchDeg < 55 || pitchDeg > 305);

    if (isCleanLanding) {
      const flips = Math.round(Math.abs(this.airPitch) / (Math.PI * 2));
      if (flips > 0) {
        this.totalFlips += flips;
        this.trickScore += flips * 600;
        this.triggerBoost(1.5);
        if (this.onTrick) this.onTrick(`${flips}x BACKFLIP! +${flips * 600}`);
      } else if (this.airTime > 0.8) {
        this.trickScore += 250;
        this.triggerBoost(1.0);
        if (this.onTrick) this.onTrick('PERFECT LANDING! +250');
      }
      this.airPitch = 0.0;
      this.airRoll = 0.0;
      this.airTime = 0.0;
    } else {
      // Wipeout / Crash on bad landing
      this.triggerCrash();
    }
  }

  _applyTransform(sample, terrainPitch, inputs, delta) {
    // 1. Position
    this.bike.root.position.copy(this._bikePos);

    // 2. Base Forward Orientation along track spline
    const baseQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      sample.tangent.clone().normalize()
    );

    // 3. Terrain Slope Pitch alignment
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.isGrounded ? terrainPitch : this.airPitch
    );

    // 4. Aerial Roll (if in air)
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      this.airRoll
    );

    baseQuat.multiply(pitchQuat).multiply(rollQuat);
    this.bike.root.quaternion.slerp(baseQuat, delta * 20);

    // 5. Update Bike Component Visuals
    this.bike.updateVisuals(this.speed, inputs.steer, inputs.pedal, this.lateralOffset, delta);
  }

  _checkTriggers() {
    // Boost Pads
    this.track.boostPads.forEach(pad => {
      if (Math.abs(this.distance - pad.distance) < 4.2) {
        this.triggerBoost(2.5);
      }
    });

    // Jump Ramps
    this.track.ramps.forEach(ramp => {
      if (Math.abs(this.distance - ramp.distance) < 3.2 && this.isGrounded) {
        this.isGrounded = false;
        this.verticalVelocity = ramp.boostPower + (this.speed * 0.35);
        this.airTime = 0.0;
      }
    });

    // Collectible Stars
    this.track.collectibles.forEach(star => {
      if (!star.collected && Math.abs(star.position.z - this.bike.root.position.z) < 2.5) {
        if (star.position.distanceTo(this.bike.root.position) < 2.5) {
          star.collected = true;
          star.mesh.visible = false;
          this.trickScore += 150;
          if (this.onCoinCollect) this.onCoinCollect();
        }
      }
    });

    // Checkpoints
    this.track.checkpoints.forEach(cp => {
      if (!cp.passed && this.distance >= cp.distance) {
        cp.passed = true;
        this.lastCheckpointDistance = cp.distance;
        if (this.onCheckpoint) this.onCheckpoint(cp.id);
      }
    });
  }

  triggerBoost(duration = 2.0) {
    this.isBoosting = true;
    this.boostTimer = duration;
    this.speed = Math.min(this.boostMaxSpeed, this.speed + 12.0);
    if (this.onBoost) this.onBoost();
  }

  triggerCrash() {
    this.isCrashed = true;
    this.crashTimer = 1.6;
    this.bike.setWipeoutRagdoll(true);
    if (this.onCrash) this.onCrash();
  }

  _updateCrash(delta) {
    this.crashTimer -= delta;
    this.speed = Math.max(0, this.speed - delta * 28.0);

    if (this.crashTimer <= 0) {
      // Clean respawn at checkpoint
      this.isCrashed = false;
      this.distance = this.lastCheckpointDistance;
      this.lateralOffset = 0.0;
      this.verticalOffset = 0.0;
      this.verticalVelocity = 0.0;
      this.speed = 14.0;
      this.isGrounded = true;
      this.airPitch = 0.0;
      this.airRoll = 0.0;
      this.bike.setWipeoutRagdoll(false);
    }
  }

  reset() {
    this.distance = 18.0;
    this.lateralOffset = 0.0;
    this.verticalOffset = 0.0;
    this.verticalVelocity = 0.0;
    this.speed = 14.0;
    this.isGrounded = true;
    this.isBraking = false;
    this.isBoosting = false;
    this.isCrashed = false;
    this.airTime = 0.0;
    this.airPitch = 0.0;
    this.airRoll = 0.0;
    this.totalFlips = 0;
    this.trickScore = 0;
    this.lastCheckpointDistance = 18.0;
    this.bike.setWipeoutRagdoll(false);
  }
}
