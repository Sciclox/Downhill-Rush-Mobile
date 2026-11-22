import * as THREE from 'three';

/**
 * Sets up atmospheric mountain lighting, sunlight with shadows, and sky gradient.
 */
export class SkyAndLighting {
  constructor(scene) {
    this.scene = scene;
    this.sunLight = null;
    this.ambientLight = null;

    this._setupEnvironment();
  }

  _setupEnvironment() {
    // High altitude alpine fog: soft blue / warm haze
    this.scene.background = new THREE.Color(0x8ecae6);
    this.scene.fog = new THREE.FogExp2(0x8ecae6, 0.0022);

    // Hemisphere Light (Sky vs Ground bounce)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444433, 0.65);
    hemiLight.position.set(0, 500, 0);
    this.scene.add(hemiLight);

    // Directional Sunlight
    this.sunLight = new THREE.DirectionalLight(0xfff7e6, 1.35);
    this.sunLight.position.set(120, 280, -80);
    this.sunLight.castShadow = true;

    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    const d = 35;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  updateFollow(targetPosition) {
    // Keep directional sunlight centered around player
    if (this.sunLight && targetPosition) {
      this.sunLight.position.set(
        targetPosition.x + 40,
        targetPosition.y + 70,
        targetPosition.z - 40
      );
      this.sunLight.target.position.copy(targetPosition);
      this.sunLight.target.updateMatrixWorld();
    }
  }
}
