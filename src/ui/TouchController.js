/**
 * TouchController: High responsiveness touch interface for mobile screens
 * with smooth analogue interpolation and keyboard fallback.
 */
export class TouchController {
  constructor(onFirstInteraction) {
    this.onFirstInteraction = onFirstInteraction;
    this.hasInteracted = false;

    this.inputs = {
      steer: 0.0,   // -1.0 (left) to +1.0 (right)
      pedal: false, // Accelerate
      brake: false  // Brake / Skid
    };

    // Keyboard state
    this.keys = {};

    this._setupTouchDOM();
    this._setupKeyboard();
  }

  _setupTouchDOM() {
    // Touch controls DOM elements are queried from index.html
    const btnLeft = document.getElementById('touch-left');
    const btnRight = document.getElementById('touch-right');
    const btnPedal = document.getElementById('touch-pedal');
    const btnBrake = document.getElementById('touch-brake');

    const bindTouch = (el, onStart, onEnd) => {
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        this._notifyInteraction();
        onStart();
        el.classList.add('active');
      };
      const end = (e) => {
        e.preventDefault();
        onEnd();
        el.classList.remove('active');
      };

      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    };

    // Steering buttons
    bindTouch(btnLeft, () => { this.inputs.steer = -1.0; }, () => {
      if (this.inputs.steer < 0) this.inputs.steer = 0.0;
    });

    bindTouch(btnRight, () => { this.inputs.steer = 1.0; }, () => {
      if (this.inputs.steer > 0) this.inputs.steer = 0.0;
    });

    // Drive buttons
    bindTouch(btnPedal, () => { this.inputs.pedal = true; }, () => {
      this.inputs.pedal = false;
    });

    bindTouch(btnBrake, () => { this.inputs.brake = true; }, () => {
      this.inputs.brake = false;
    });

    // Also support global touch to unmute
    window.addEventListener('touchstart', () => this._notifyInteraction(), { once: true });
    window.addEventListener('click', () => this._notifyInteraction(), { once: true });
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._notifyInteraction();
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  _notifyInteraction() {
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      if (this.onFirstInteraction) this.onFirstInteraction();
    }
  }

  getInputs() {
    // Combine touch inputs with keyboard
    let steer = this.inputs.steer;
    let pedal = this.inputs.pedal;
    let brake = this.inputs.brake;

    if (this.keys['ArrowLeft'] || this.keys['KeyA']) steer = -1.0;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) steer = 1.0;
    if (this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['Space']) pedal = true;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) brake = true;

    return { steer, pedal, brake };
  }
}
