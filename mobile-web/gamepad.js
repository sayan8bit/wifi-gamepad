// Gamepad Controller JavaScript
class MobileGamepad {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.serverUrl = "";
    this.editMode = false;
    this.activeButtons = new Set();
    this.joystickActive = false;
    this.touchPadActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;

    // --- MULTITOUCH FIX: Track unique finger IDs ---
    this.joystickTouchId = null;
    this.touchPadTouchId = null;

    // Sensitivity Setting (Default 1.5)
    this.sensitivity = 1.5;

    // --- LAG FIX: Mouse Accumulator ---
    this.mouseAccumulator = { x: 0, y: 0 };
    this.mouseInterval = null;

    this.dragState = {
      isDragging: false,
      control: null,
      startX: 0,
      startY: 0,
      initialX: 0,
      initialY: 0,
    };

    // Control positions
    this.controls = {
      joystick: { x: 15, y: 65, size: 150 },
      touchPad: { x: 75, y: 35, size: 250 },

      // Other buttons
      aButton: { x: 90, y: 70, size: 80 },
      bButton: { x: 95, y: 55, size: 80 },
      xButton: { x: 80, y: 55, size: 80 },
      yButton: { x: 90, y: 40, size: 80 },

      keyRBtn: { x: 65, y: 75, size: 70 },
      keyCBtn: { x: 55, y: 75, size: 70 },
      keyXBtn: { x: 45, y: 75, size: 70 },

      mouseLBtn: { x: 85, y: 85, size: 160 },
      mouseRBtn: { x: 95, y: 85, size: 100 },

      lButton: { x: 10, y: 10, size: 110 },
      rButton: { x: 85, y: 10, size: 110 },
      startButton: { x: 50, y: 10, size: 50 },
      selectButton: { x: 40, y: 10, size: 50 },
    };

    this.buttonKeyMap = {
      aButton: "Space",
      bButton: "E",
      xButton: "Q",
      yButton: "F",
      lButton: "Shift",
      rButton: "Control",
      startButton: "Enter",
      selectButton: "Escape",
      keyRBtn: "R",
      keyCBtn: "C",
      keyXBtn: "X",
    };

    this.init();
  }

  init() {
    this.loadLayout();
    this.setupEventListeners();
    this.applyControlPositions();
    this.startMouseLoop(); // Start the lag fix loop

    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get("server");
    if (serverParam) {
      this.serverUrl = serverParam;
      this.connect(serverParam);
    }
  }

  startMouseLoop() {
    this.mouseInterval = setInterval(() => {
      if (this.mouseAccumulator.x !== 0 || this.mouseAccumulator.y !== 0) {
        this.sendInput("mouse_move", {
          x: this.mouseAccumulator.x,
          y: this.mouseAccumulator.y,
        });
        // Reset accumulator
        this.mouseAccumulator.x = 0;
        this.mouseAccumulator.y = 0;
      }
    }, 16); // ~60 FPS
  }

  setupEventListeners() {
    document.getElementById("reconnectBtn").addEventListener("click", () => {
      if (this.serverUrl) this.connect(this.serverUrl);
    });

    document.getElementById("editBtn").addEventListener("click", () => {
      this.toggleEditMode();
    });

    document.getElementById("saveBtn").addEventListener("click", () => {
      this.saveLayout();
      alert("Layout saved!");
    });

    // Sensitivity Slider Logic
    const slider = document.getElementById("sensSlider");
    const valDisplay = document.getElementById("sensValue");

    // Load saved sensitivity
    const savedSens = localStorage.getItem("gamepadSensitivity");
    if (savedSens) {
      this.sensitivity = parseFloat(savedSens);
      slider.value = this.sensitivity;
      valDisplay.innerText = this.sensitivity;
    }

    slider.addEventListener("input", (e) => {
      this.sensitivity = parseFloat(e.target.value);
      valDisplay.innerText = this.sensitivity;
      localStorage.setItem("gamepadSensitivity", this.sensitivity);
    });

    this.setupJoystick();
    this.setupTouchPad();
    this.setupButtons();
    this.setupMouseButtons();

    // Global drag listeners
    document.addEventListener("mousemove", (e) => this.handleDragMove(e));
    document.addEventListener("mouseup", () => this.handleDragEnd());
    document.addEventListener("touchmove", (e) => this.handleDragMove(e), {
      passive: false,
    });
    document.addEventListener("touchend", () => this.handleDragEnd());
  }

  setupJoystick() {
    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystickKnob");

    const handleStart = (e) => {
      if (this.editMode) {
        this.handleDragStart(e, "joystick");
        return;
      }
      e.preventDefault();

      // MULTITOUCH FIX: Store the ID of the finger that touched the joystick
      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;

      this.joystickActive = true;
      this.handleJoystickMove(touch);
    };

    const handleMove = (e) => {
      if (!this.joystickActive || this.editMode) return;
      e.preventDefault();

      // MULTITOUCH FIX: Only react to the finger tracked by ID
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          this.handleJoystickMove(e.changedTouches[i]);
          break;
        }
      }
    };

    const handleEnd = (e) => {
      if (this.editMode) return;
      e.preventDefault();

      // MULTITOUCH FIX: Check if the lifted finger is the joystick finger
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          this.joystickActive = false;
          this.joystickTouchId = null; // Reset ID
          knob.style.transform = "translate(0, 0)";
          this.sendInput("joystick", { x: 0, y: 0 });
          break;
        }
      }
    };

    joystick.addEventListener("touchstart", handleStart, { passive: false });
    joystick.addEventListener("touchmove", handleMove, { passive: false });
    joystick.addEventListener("touchend", handleEnd, { passive: false });
  }

  handleJoystickMove(touchInput) {
    // MULTITOUCH FIX: Modified to accept the specific touch object directly
    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystickKnob");
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Use the passed touchInput (which has clientX/Y) instead of searching touches again
    let deltaX = touchInput.clientX - centerX;
    let deltaY = touchInput.clientY - centerY;

    const maxDistance = rect.width / 2 - 20;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxDistance) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * maxDistance;
      deltaY = Math.sin(angle) * maxDistance;
    }

    const normalizedX = deltaX / maxDistance;
    const normalizedY = deltaY / maxDistance;

    knob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    this.sendInput("joystick", { x: normalizedX, y: normalizedY });
  }

  setupTouchPad() {
    const pad = document.getElementById("touchPad");

    const handleStart = (e) => {
      if (this.editMode) {
        this.handleDragStart(e, "touchPad");
        return;
      }
      e.preventDefault();

      // MULTITOUCH FIX: Store the ID of the finger that touched the pad
      const touch = e.changedTouches[0];
      this.touchPadTouchId = touch.identifier;

      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.touchPadActive = true;
    };

    const handleMove = (e) => {
      if (!this.touchPadActive || this.editMode) return;
      e.preventDefault();

      // MULTITOUCH FIX: Find the specific touch ID for the touchpad
      let touch = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchPadTouchId) {
          touch = e.changedTouches[i];
          break;
        }
      }

      // If we didn't find the correct finger moving, do nothing
      if (!touch) return;

      const deltaX = touch.clientX - this.lastTouchX;
      const deltaY = touch.clientY - this.lastTouchY;

      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;

      // LAG FIX: Accumulate with Sensitivity applied
      this.mouseAccumulator.x += deltaX * this.sensitivity;
      this.mouseAccumulator.y += deltaY * this.sensitivity * 0.5;
    };

    const handleEnd = (e) => {
      // MULTITOUCH FIX: Only stop if the touchpad finger was lifted
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchPadTouchId) {
          this.touchPadActive = false;
          this.touchPadTouchId = null;
        }
      }
    };

    pad.addEventListener("touchstart", handleStart, { passive: false });
    pad.addEventListener("touchmove", handleMove, { passive: false });
    pad.addEventListener("touchend", handleEnd, { passive: false });
  }

  setupButtons() {
    const buttons = Object.keys(this.buttonKeyMap);

    buttons.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const key = this.buttonKeyMap[btnId];

      const handlePress = (e) => {
        if (this.editMode) {
          this.handleDragStart(e, btnId);
          return;
        }
        e.preventDefault();
        btn.classList.add("pressed");
        this.sendInput("button", { button: key, pressed: true });
      };

      const handleRelease = (e) => {
        if (this.editMode) return;
        e.preventDefault();
        btn.classList.remove("pressed");
        this.sendInput("button", { button: key, pressed: false });
      };

      btn.addEventListener("touchstart", handlePress, { passive: false });
      btn.addEventListener("touchend", handleRelease, { passive: false });
    });
  }

  setupMouseButtons() {
    ["mouseLBtn", "mouseRBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      const mouseBtn = id === "mouseLBtn" ? "left" : "right";

      const handlePress = (e) => {
        if (this.editMode) {
          this.handleDragStart(e, id);
          return;
        }
        e.preventDefault();
        btn.classList.add("pressed");
        this.sendInput("mouse_click", { button: mouseBtn, pressed: true });
      };

      const handleRelease = (e) => {
        if (this.editMode) return;
        e.preventDefault();
        btn.classList.remove("pressed");
        this.sendInput("mouse_click", { button: mouseBtn, pressed: false });
      };

      btn.addEventListener("touchstart", handlePress, { passive: false });
      btn.addEventListener("touchend", handleRelease, { passive: false });
    });
  }

  handleDragStart(e, controlName) {
    if (!this.editMode) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const control = this.controls[controlName];

    this.dragState = {
      isDragging: true,
      control: controlName,
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: control.x,
      initialY: control.y,
    };
  }

  handleDragMove(e) {
    if (!this.editMode || !this.dragState.isDragging) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const deltaX =
      ((touch.clientX - this.dragState.startX) / window.innerWidth) * 100;
    const deltaY =
      ((touch.clientY - this.dragState.startY) / window.innerHeight) * 100;

    const newX = Math.max(0, Math.min(95, this.dragState.initialX + deltaX));
    const newY = Math.max(0, Math.min(95, this.dragState.initialY + deltaY));

    this.controls[this.dragState.control].x = newX;
    this.controls[this.dragState.control].y = newY;
    this.applyControlPosition(this.dragState.control);
  }

  handleDragEnd() {
    this.dragState.isDragging = false;
  }

  applyControlPositions() {
    Object.keys(this.controls).forEach((controlName) => {
      this.applyControlPosition(controlName);
    });
  }

  applyControlPosition(controlName) {
    const element = document.getElementById(controlName);
    if (!element) return;
    const control = this.controls[controlName];

    element.style.left = `${control.x}%`;
    element.style.top = `${control.y}%`;
    element.style.width = `${control.size}px`;

    if (controlName === "joystick") {
      element.style.height = `${control.size}px`;
    } else if (controlName === "touchPad") {
      element.style.height = `${control.size * 0.7}px`;
    } else if (controlName.includes("mouse")) {
      element.style.height = `${control.size * 0.8}px`;
    } else if (
      controlName.includes("Button") &&
      (controlName.includes("lB") || controlName.includes("rB"))
    ) {
      element.style.height = `${control.size * 0.5}px`;
    } else if (
      controlName.includes("Start") ||
      controlName.includes("Select")
    ) {
      element.style.height = `${control.size * 0.6}px`;
    } else {
      element.style.height = `${control.size}px`;
    }
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    const editBtn = document.getElementById("editBtn");
    const saveBtn = document.getElementById("saveBtn");
    const indicator = document.getElementById("editModeIndicator");
    const sensControls = document.getElementById("sensitivityControls");

    if (this.editMode) {
      editBtn.classList.add("active");
      saveBtn.style.display = "flex";
      indicator.classList.add("active");
      sensControls.classList.add("active"); // Show Sensitivity
      document.querySelectorAll(".control").forEach((el) => {
        el.classList.add("editing");
      });
    } else {
      editBtn.classList.remove("active");
      saveBtn.style.display = "none";
      indicator.classList.remove("active");
      sensControls.classList.remove("active"); // Hide Sensitivity
      document.querySelectorAll(".control").forEach((el) => {
        el.classList.remove("editing");
      });
    }
  }

  saveLayout() {
    localStorage.setItem("gamepadLayout", JSON.stringify(this.controls));
  }

  loadLayout() {
    const saved = localStorage.getItem("gamepadLayout");
    if (saved) {
      const parsed = JSON.parse(saved);
      this.controls = { ...this.controls, ...parsed };
    }
  }

  connect(url) {
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        document.getElementById("connectionScreen").style.display = "none";
        document.getElementById("gamepadScreen").style.display = "block";
        console.log("Connected to PC");
      };
      this.ws.onclose = () => {
        this.connected = false;
        document.getElementById("connectionScreen").style.display = "flex";
        document.getElementById("gamepadScreen").style.display = "none";
        document.getElementById("reconnectBtn").style.display = "block";
        console.log("Disconnected");
      };
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.connected = false;
      };
    } catch (error) {
      console.error("Connection error:", error);
    }
  }

  sendInput(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new MobileGamepad();
});
