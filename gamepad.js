// Gamepad Controller JavaScript
class MobileGamepad {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.serverUrl = "";
    this.editMode = false;
    this.activeButtons = new Set();
    this.joystickActive = false;
    this.dragState = {
      isDragging: false,
      control: null,
      startX: 0,
      startY: 0,
      initialX: 0,
      initialY: 0,
    };

    // Default control positions (percentage based)
    this.controls = {
      joystick: { x: 10, y: 60, size: 150 },
      aButton: { x: 75, y: 65, size: 60 },
      bButton: { x: 85, y: 55, size: 60 },
      xButton: { x: 65, y: 55, size: 60 },
      yButton: { x: 75, y: 45, size: 60 },
      lButton: { x: 10, y: 10, size: 80 },
      rButton: { x: 80, y: 10, size: 80 },
      startButton: { x: 60, y: 85, size: 50 },
      selectButton: { x: 40, y: 85, size: 50 },
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
    };

    this.init();
  }

  init() {
    this.loadLayout();
    this.setupEventListeners();
    this.applyControlPositions();

    // Check for server URL in query params
    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get("server");
    if (serverParam) {
      this.serverUrl = serverParam;
      this.connect(serverParam);
    }
  }

  setupEventListeners() {
    // Reconnect button
    document.getElementById("reconnectBtn").addEventListener("click", () => {
      if (this.serverUrl) {
        this.connect(this.serverUrl);
      }
    });

    // Edit mode button
    document.getElementById("editBtn").addEventListener("click", () => {
      this.toggleEditMode();
    });

    // Save button
    document.getElementById("saveBtn").addEventListener("click", () => {
      this.saveLayout();
      alert("Layout saved!");
    });

    // Setup joystick
    this.setupJoystick();

    // Setup action buttons
    this.setupButtons();

    // Setup resize buttons
    document.querySelectorAll(".resize-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const control = btn.dataset.control;
        const delta = parseInt(btn.dataset.delta);
        this.resizeControl(control, delta);
      });
    });

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
      this.joystickActive = true;
      this.handleJoystickMove(e);
    };

    const handleMove = (e) => {
      if (!this.joystickActive || this.editMode) return;
      e.preventDefault();
      this.handleJoystickMove(e);
    };

    const handleEnd = (e) => {
      if (this.editMode) return;
      e.preventDefault();
      this.joystickActive = false;
      knob.style.transform = "translate(0, 0)";
      this.sendInput("joystick", { x: 0, y: 0 });
    };

    joystick.addEventListener("mousedown", handleStart);
    joystick.addEventListener("touchstart", handleStart, { passive: false });
    joystick.addEventListener("mousemove", handleMove);
    joystick.addEventListener("touchmove", handleMove, { passive: false });
    joystick.addEventListener("mouseup", handleEnd);
    joystick.addEventListener("mouseleave", handleEnd);
    joystick.addEventListener("touchend", handleEnd, { passive: false });
  }

  handleJoystickMove(e) {
    const joystick = document.getElementById("joystick");
    const knob = document.getElementById("joystickKnob");
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const touch = e.touches ? e.touches[0] : e;
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

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

  setupButtons() {
    const buttons = [
      "aButton",
      "bButton",
      "xButton",
      "yButton",
      "lButton",
      "rButton",
      "startButton",
      "selectButton",
    ];

    buttons.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      const key = this.buttonKeyMap[btnId];

      const handlePress = (e) => {
        if (this.editMode) {
          this.handleDragStart(e, btnId);
          return;
        }
        e.preventDefault();
        btn.classList.add("pressed");
        this.activeButtons.add(key);
        this.sendInput("button", { button: key, pressed: true });
      };

      const handleRelease = (e) => {
        if (this.editMode) return;
        e.preventDefault();
        btn.classList.remove("pressed");
        this.activeButtons.delete(key);
        this.sendInput("button", { button: key, pressed: false });
      };

      btn.addEventListener("mousedown", handlePress);
      btn.addEventListener("touchstart", handlePress, { passive: false });
      btn.addEventListener("mouseup", handleRelease);
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

  resizeControl(controlName, delta) {
    const control = this.controls[controlName];
    control.size = Math.max(40, Math.min(200, control.size + delta));
    this.applyControlPosition(controlName);
  }

  applyControlPositions() {
    Object.keys(this.controls).forEach((controlName) => {
      this.applyControlPosition(controlName);
    });
  }

  applyControlPosition(controlName) {
    const element = document.getElementById(controlName);
    const control = this.controls[controlName];

    element.style.left = `${control.x}%`;
    element.style.top = `${control.y}%`;
    element.style.width = `${control.size}px`;

    if (controlName === "joystick") {
      element.style.height = `${control.size}px`;
    } else if (
      controlName.includes("Button") &&
      (controlName === "lButton" || controlName === "rButton")
    ) {
      element.style.height = `${control.size * 0.5}px`;
    } else if (
      controlName.includes("Button") &&
      (controlName === "startButton" || controlName === "selectButton")
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

    if (this.editMode) {
      editBtn.classList.add("active");
      saveBtn.style.display = "flex";
      indicator.classList.add("active");
      document.querySelectorAll(".control").forEach((el) => {
        el.classList.add("editing");
      });
    } else {
      editBtn.classList.remove("active");
      saveBtn.style.display = "none";
      indicator.classList.remove("active");
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
      this.controls = JSON.parse(saved);
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

// Initialize gamepad when page loads
window.addEventListener("DOMContentLoaded", () => {
  new MobileGamepad();
});
