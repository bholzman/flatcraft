// Keyboard + mouse state. Held state is polled by the game loop; presses are
// edge-triggered and consumed so a single tap can't fire twice.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, left: false, right: false };
    this.wheel = 0;

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.held.add(code);             // repeats too, so a cleared key that's still down comes back
      if (!e.repeat) this.pressed.add(code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'].includes(code)) {
        e.preventDefault();
      }
    });

    // On macOS no keyup arrives for keys released while Cmd is down, so a
    // Cmd shortcut mid-move would leave that key held forever. Releasing Cmd
    // drops everything; anything still physically down re-registers on repeat.
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Meta') this.held.clear();
      else this.held.delete(e.code);
    });
    const releaseAll = () => {
      this.held.clear();
      this.mouse.left = this.mouse.right = false;
      this.rightFromCtrl = false;
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });

    // On macOS ctrl+click is the standard secondary click, and a trackpad
    // without "secondary click" configured has no other way to produce one.
    // Chrome reports it as button 0 with ctrlKey set, so it has to be mapped
    // here -- and remembered, because ctrl may be released before the button.
    this.rightFromCtrl = false;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
        this.mouse.right = true;
        this.rightFromCtrl = e.button === 0;
      } else if (e.button === 0) {
        this.mouse.left = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.mouse.right = false;
      } else if (e.button === 0) {
        if (this.rightFromCtrl) {
          this.mouse.right = false;
          this.rightFromCtrl = false;
        } else {
          this.mouse.left = false;
        }
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  isDown(...codes) {
    return codes.some((c) => this.held.has(c));
  }

  /** True once per physical key press. */
  consumePress(...codes) {
    for (const c of codes) {
      if (this.pressed.has(c)) {
        this.pressed.delete(c);
        return true;
      }
    }
    return false;
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  endFrame() {
    this.pressed.clear();
  }
}
