import * as THREE from 'three';
import { TrackManager } from '../world/TrackManager.js';
import { Bike } from '../entities/Bike.js';
import { BikePhysics } from '../physics/BikePhysics.js';
import { SkyAndLighting } from '../graphics/SkyAndLighting.js';
import { ParticleManager } from '../effects/ParticleManager.js';
import { SoundEffects } from '../audio/SoundEffects.js';
import { TouchController } from '../ui/TouchController.js';

export class Game {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    // Core Three.js systems
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });

    // Game state
    this.state = 'RACING'; // 'RACING', 'FINISHED'
    this.score = 0;
    this.coinsCount = 0;
    this.cameraShake = 0;

    this._initRenderer();
    this._initSubsystems();
    this._setupEvents();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  _initRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // High res on mobile, capped at 2 for performance
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
  }

  _initSubsystems() {
    // 1. Audio
    this.audio = new SoundEffects();

    // 2. Lighting & Environment
    this.environment = new SkyAndLighting(this.scene);

    // 3. Track
    this.track = new TrackManager(this.scene);

    // 4. Bike & Rider
    this.bike = new Bike(this.scene);

    // 5. Physics
    this.physics = new BikePhysics(this.track, this.bike);

    // 6. Particles
    this.particles = new ParticleManager(this.scene);

    // 7. Touch & Input
    this.controller = new TouchController(() => {
      this.audio.init();
      this.audio.resume();
    });

    // Subsystem Event Callbacks
    this.physics.onBoost = () => {
      this.audio.playBoost();
      this.cameraShake = 0.45;
    };

    this.physics.onCrash = () => {
      this.audio.playCrash();
      this.cameraShake = 0.8;
      this._showBanner('WIPEOUT!', 'rgb(255, 68, 68)');
    };

    this.physics.onCoinCollect = () => {
      this.coinsCount++;
      this.audio.playCoin();
      this._updateCoinsUI();
    };

    this.physics.onCheckpoint = (cpId) => {
      this._showBanner(`CHECKPOINT ${cpId}!`, '#00ffcc');
    };
  }

  _setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const restartBtn = document.getElementById('btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restartGame());
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.05, this.clock.getDelta()); // Cap delta to prevent glitching

    const inputs = this.controller.getInputs();

    // 1. Physics update
    this.physics.update(inputs, delta);

    // 2. Environment & Items update
    this.track.update(delta);
    this.environment.updateFollow(this.bike.root.position);

    // 3. Particles & Tire Dust
    const speedRatio = this.physics.speed / this.physics.boostMaxSpeed;
    if (this.physics.isGrounded && this.physics.speed > 5) {
      const rearWheelPos = this.bike.root.position.clone();
      rearWheelPos.y -= 0.4;
      this.particles.emitDust(rearWheelPos, this.bike.root.getWorldDirection(new THREE.Vector3()), inputs.brake ? 3 : 1);
    }
    this.particles.update(this.bike.root.position, speedRatio, delta);

    // 4. Audio Continuous Update
    this.audio.updateContinuous(speedRatio, this.physics.isGrounded, inputs.pedal);
    if (inputs.brake && this.physics.isGrounded && this.physics.speed > 10) {
      this.audio.playSkid();
    }

    // 5. Dynamic Camera Chase
    this._updateCamera(delta, speedRatio);

    // 6. Check Finish Line
    if (this.state === 'RACING' && this.physics.distance >= this.track.finishZ) {
      this._handleFinish();
    }

    // 7. Update HUD
    this._updateHUD(speedRatio);

    // 8. Render
    this.renderer.render(this.scene, this.camera);
  }

  _updateCamera(delta, speedRatio) {
    const bikePos = this.bike.root.position;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.bike.root.quaternion);

    // Offset behind and above bike
    const camDistance = 5.2 + speedRatio * 1.5;
    const camHeight = 2.4;
    const targetCamPos = bikePos.clone()
      .addScaledVector(forward, -camDistance)
      .add(new THREE.Vector3(0, camHeight, 0));

    // Smooth camera lag (damping)
    this.camera.position.lerp(targetCamPos, delta * 9);

    // Camera look ahead along bike trajectory
    const lookTarget = bikePos.clone().addScaledVector(forward, 4.0).add(new THREE.Vector3(0, 0.8, 0));

    // Camera Shake
    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - delta * 1.8);
    }

    this.camera.lookAt(lookTarget);

    // Speed FOV expansion (62deg normal -> 82deg at top speed)
    const targetFOV = 62 + speedRatio * 20;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, delta * 5);
    this.camera.updateProjectionMatrix();
  }

  _updateHUD(speedRatio) {
    // Speedometer (km/h)
    const speedKmh = Math.round(this.physics.speed * 3.6);
    const speedEl = document.getElementById('speed-value');
    if (speedEl) speedEl.textContent = speedKmh;

    // Progress bar
    const progress = Math.min(100, Math.round((this.physics.distance / this.track.finishZ) * 100));
    const progBar = document.getElementById('progress-fill');
    if (progBar) progBar.style.width = `${progress}%`;

    // Nitro gauge
    const nitroFill = document.getElementById('nitro-fill');
    if (nitroFill) {
      const nitroPercent = this.physics.isBoosting ? (this.physics.boostTimer / 2.5) * 100 : 0;
      nitroFill.style.width = `${nitroPercent}%`;
    }

    // Score UI
    const scoreEl = document.getElementById('score-value');
    if (scoreEl) scoreEl.textContent = this.physics.trickScore;
  }

  _updateCoinsUI() {
    const coinEl = document.getElementById('coins-value');
    if (coinEl) coinEl.textContent = this.coinsCount;
  }

  _showBanner(text, color) {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    banner.textContent = text;
    banner.style.color = color;
    banner.classList.add('visible');
    setTimeout(() => {
      banner.classList.remove('visible');
    }, 1400);
  }

  _handleFinish() {
    this.state = 'FINISHED';
    this.audio.playFinish();
    this.particles.triggerConfetti(this.bike.root.position);

    const finishOverlay = document.getElementById('finish-overlay');
    const finalScore = document.getElementById('final-score');
    if (finishOverlay) finishOverlay.classList.remove('hidden');
    if (finalScore) finalScore.textContent = this.physics.trickScore + (this.coinsCount * 250);
  }

  restartGame() {
    this.state = 'RACING';
    this.coinsCount = 0;
    this.physics.reset();

    // Reset collectibles
    this.track.collectibles.forEach(c => {
      c.collected = false;
      c.mesh.visible = true;
    });

    const finishOverlay = document.getElementById('finish-overlay');
    if (finishOverlay) finishOverlay.classList.add('hidden');
    this._updateCoinsUI();
  }
}
