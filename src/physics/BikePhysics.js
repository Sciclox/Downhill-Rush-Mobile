import * as THREE from 'three';

/**
 * BikePhysics: High performance arcade downhill physics simulator.
 * Calculates gravity along slope, pedal drive, braking, air rotation tricks,
 * kicker ramps, boost pads, and impact landing tolerance.
 */
export class BikePhysics {
  constructor(trackManager, bikeEntity) {
    this.track = trackManager;
    this.bike = bikeEntity;

    // Spatial State
    this.distance = 15.0; // Distance along track spline
    this.lateralOffset = 0.0; // Lateral position (-trackWidth/2 to +trackWidth/2)
    this.verticalOffset = 0.0; // Height above ground (for airtime/jumps)
    this.verticalVelocity = 0.0;

    // Movement Dynamics
    this.speed = 12.0; // Forward speed (m/s)
    this.maxSpeed = 28.0; // Normal top speed ~100 km/h
    this.boostMaxSpeed = 40.0; // Boosted top speed ~144 km/h
    this.isGrounded = true;
    this.isBraking = false;
    this.isBoosting = false;
    this.boostTimer = 0.0;

    // Air Rotation & Tricks
    this.airTime = 0.0;
    this.airPitch = 0.0; // Aerial flip
    this.airRoll = 0.0;  // Aerial whip
    this.totalFlips = 0;
    this.trickScore = 0;

    // Crash State
    this.isCrashed = false;
    this.crashTimer = 0.0;
    this.lastCheckpointDistance = 15.0;

    // Temp vectors for allocations
    this._pos = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._normal = new THREE.Vector3();
  }

  update(inputs, delta) {
    if (this.isCrashed) {
      this._updateCrashState(delta);
      return;
    }

    const currentSample = this.track.getSampleAtDistance(this.distance);
    if (!currentSample) return;

    // 1. Check Nitro Boost
    if (this.isBoosting) {
      this.boostTimer -= delta;
      if (this.boostTimer <= 0) {
        this.isBoosting = false;
      }
    }

    // 2. Slope & Gravitational Acceleration
    // Downhill slope = tangent.y (negative when descending)
    const slopeFactor = -currentSample.tangent.y; // Positive downhill
    const gravityAccel = Math.max(0, slopeFactor * 18.0);

    // 3. Pedal / Brake inputs
    let driveAccel = 0;
    if (inputs.pedal) {
      // Pedaling efficiency drops as speed nears max
      const cap = this.isBoosting ? this.boostMaxSpeed : this.maxSpeed;
      if (this.speed < cap) {
        driveAccel = 12.0 * (1 - this.speed / cap);
      }
    }

    // Braking
    this.isBraking = inputs.brake;
    let brakeDecel = 0;
    if (this.isBraking) {
      brakeDecel = 24.0;
    }

    // Rolling Resistance & Air Drag
    const drag = 0.0035 * this.speed * this.speed + 0.8;

    // Forward speed integration
    if (this.isGrounded) {
      this.speed += (gravityAccel + driveAccel - brakeDecel - drag) * delta;
      this.speed = Math.max(3.0, this.speed); // Keep rolling down
    }

    // 4. Lateral Steering
    const steerSens = 14.0 * Math.min(1.2, Math.max(0.4, this.speed / 15.0));
    this.lateralOffset += inputs.steer * steerSens * delta;
    // Clamp to track width
    const maxOffset = this.track.trackWidth * 0.48;
    this.lateralOffset = Math.max(-maxOffset, Math.min(maxOffset, this.lateralOffset));

    // 5. Ground vs Air Physics
    this._handleElevationAndAir(currentSample, inputs, delta);

    // 6. Check Item Collisions (Boost pads, Ramps, Coins, Checkpoints)
    this._checkTriggers(currentSample);

    // 7. Update 3D Transform of Bike Mesh
    this._updateTransform(currentSample, inputs, delta);
  }

  _handleElevationAndAir(sample, inputs, delta) {
    if (this.isGrounded) {
      // Check for terrain ramps / sudden drops
      const nextDist = this.distance + this.speed * delta;
      const nextSample = this.track.getSampleAtDistance(nextDist);

      if (nextSample) {
        const elevationDiff = nextSample.point.y - sample.point.y;
        const expectedDrop = sample.tangent.y * (this.speed * delta);

        // If road drops faster than gravity, bike launches into air
        if (elevationDiff < expectedDrop - 1.2 && this.speed > 16) {
          this.isGrounded = false;
          this.verticalVelocity = Math.max(4.0, this.speed * 0.25);
          this.airTime = 0;
          this.airPitch = 0;
        }
      }

      this.distance += this.speed * delta;
      this.verticalOffset = 0;
    } else {
      // Airborne!
      this.airTime += delta;
      this.distance += this.speed * delta;

      // Gravity pulls down
      this.verticalVelocity -= 28.0 * delta;
      this.verticalOffset += this.verticalVelocity * delta;

      // Aerial Tricks: Pitch (front/back flips) and Tilt
      if (inputs.pedal) {
        this.airPitch += 3.5 * delta; // Backflip
      } else if (inputs.brake) {
        this.airPitch -= 3.5 * delta; // Frontflip
      }
      this.airRoll += inputs.steer * 4.0 * delta;

      // Landing detection
      if (this.verticalOffset <= 0) {
        this._handleLanding(sample);
      }
    }
  }

  _handleLanding(sample) {
    this.verticalOffset = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;

    // Check angle alignment
    const flipDeg = Math.abs(this.airPitch * (180 / Math.PI)) % 360;
    const isUpright = (flipDeg < 55 || flipDeg > 305);

    if (isUpright) {
      // Clean landing! Check for completed flips
      const completedFlips = Math.round(Math.abs(this.airPitch) / (Math.PI * 2));
      if (completedFlips > 0) {
        this.totalFlips += completedFlips;
        this.trickScore += completedFlips * 500;
        // Reward with mini nitro boost!
        this.triggerBoost(1.2);
      }
      this.airPitch = 0;
      this.airRoll = 0;
      this.airTime = 0;
    } else {
      // Crash / Wipeout!
      this.triggerCrash();
    }
  }

  _checkTriggers(sample) {
    // 1. Boost pads
    this.track.boostPads.forEach(pad => {
      if (Math.abs(this.distance - pad.distance) < 4.0) {
        this.triggerBoost(2.5);
      }
    });

    // 2. Jump Ramps
    this.track.ramps.forEach(ramp => {
      if (Math.abs(this.distance - ramp.distance) < 3.0 && this.isGrounded) {
        this.isGrounded = false;
        this.verticalVelocity = ramp.boostPower + (this.speed * 0.35);
        this.airTime = 0;
      }
    });

    // 3. Collectibles
    this.track.collectibles.forEach(coin => {
      if (!coin.collected && Math.abs(coin.position.z - this.bike.root.position.z) < 2.5) {
        const dist = coin.position.distanceTo(this.bike.root.position);
        if (dist < 2.2) {
          coin.collected = true;
          coin.mesh.visible = false;
          this.trickScore += 100;
          if (this.onCoinCollect) this.onCoinCollect();
        }
      }
    });

    // 4. Checkpoints
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

  _updateCrashState(delta) {
    this.crashTimer -= delta;
    this.speed = Math.max(0, this.speed - delta * 25.0);

    if (this.crashTimer <= 0) {
      // Respawn at last checkpoint
      this.isCrashed = false;
      this.distance = this.lastCheckpointDistance;
      this.lateralOffset = 0;
      this.verticalOffset = 0;
      this.verticalVelocity = 0;
      this.speed = 14.0;
      this.isGrounded = true;
      this.airPitch = 0;
      this.airRoll = 0;
      this.bike.setWipeoutRagdoll(false);
    }
  }

  _updateTransform(sample, inputs, delta) {
    // 1. Calculate World Position: spline sample point + lateral offset + vertical jump offset
    this._pos.copy(sample.point);
    this._pos.addScaledVector(sample.normal, this.lateralOffset);
    this._pos.y += 0.52 + this.verticalOffset; // 0.52 = wheel center height
    this.bike.root.position.copy(this._pos);

    // 2. Calculate Orientation
    const heading = sample.tangent.clone().normalize();
    const up = sample.binormal.clone().normalize();

    // Base matrix looking forward along track
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      heading
    );

    // Aerial rotations or ground pitch
    if (!this.isGrounded) {
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        this.airPitch
      );
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        this.airRoll
      );
      targetQuat.multiply(pitchQuat).multiply(rollQuat);
    }

    this.bike.root.quaternion.slerp(targetQuat, delta * 18);

    // 3. Update Bike Component Visuals (Wheels, pedals, handlebars, lean)
    this.bike.updateVisuals(this.speed, inputs.steer, inputs.pedal, this.lateralOffset, delta);
  }

  reset() {
    this.distance = 15.0;
    this.lateralOffset = 0.0;
    this.verticalOffset = 0.0;
    this.verticalVelocity = 0.0;
    this.speed = 12.0;
    this.isGrounded = true;
    this.isBraking = false;
    this.isBoosting = false;
    this.isCrashed = false;
    this.airTime = 0.0;
    this.airPitch = 0.0;
    this.airRoll = 0.0;
    this.totalFlips = 0;
    this.trickScore = 0;
    this.lastCheckpointDistance = 15.0;
    this.bike.setWipeoutRagdoll(false);
  }
}
