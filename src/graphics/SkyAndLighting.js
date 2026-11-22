import * as THREE from 'three';

/**
 * SkyAndLighting: Alpine mountain lighting with dynamic sun shadows,
 * sky dome gradient, and atmospheric depth haze.
 */
export class SkyAndLighting {
  constructor(scene) {
    this.scene = scene;
    this.sunLight = null;
    this.hemiLight = null;
    this.skyDome = null;

    this._setupSky();
    this._setupLighting();
  }

  _setupSky() {
    // Clear alpine blue haze
    const skyColor = new THREE.Color(0x7ec0ee);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0x8bc7ea, 0.0016);

    // Procedural Sky Dome (Horizon gradient)
    const domeGeom = new THREE.SphereGeometry(850, 24, 16);
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#3a7bd5'); // Deep sky blue at zenith
    grad.addColorStop(0.65, '#87ceeb'); // Soft sky
    grad.addColorStop(1.0, '#d6efff'); // Warm sunlit haze at horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);

    const skyTex = new THREE.CanvasTexture(canvas);
    const domeMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false
    });

    this.skyDome = new THREE.Mesh(domeGeom, domeMat);
    this.scene.add(this.skyDome);
  }

  _setupLighting() {
    // Ambient bounce light (warm sunlight from above, forest loam tint from below)
    this.hemiLight = new THREE.HemisphereLight(0xfff5e6, 0x3d4a36, 0.75);
    this.hemiLight.position.set(0, 400, 0);
    this.scene.add(this.hemiLight);

    // Main Directional Sunlight (Casting crisp shadows)
    this.sunLight = new THREE.DirectionalLight(0xfff7e6, 1.4);
    this.sunLight.position.set(100, 260, -80);
    this.sunLight.castShadow = true;

    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 380;
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  updateFollow(targetPos) {
    if (this.sunLight && targetPos) {
      this.sunLight.position.set(
        targetPos.x + 35,
        targetPos.y + 65,
        targetPos.z - 35
      );
      this.sunLight.target.position.copy(targetPos);
      this.sunLight.target.updateMatrixWorld();
    }

    if (this.skyDome && targetPos) {
      this.skyDome.position.copy(targetPos);
    }
  }
}
