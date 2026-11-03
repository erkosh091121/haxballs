export function bindInput() {
  window.addEventListener("keydown", (e) => {
    if (
      this.state === "playing" &&
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "ShiftLeft",
        "ShiftRight",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    const map = {
      KeyW: "w",
      KeyS: "s",
      KeyA: "a",
      KeyD: "d",
      ArrowUp: "w",
      ArrowDown: "s",
      ArrowLeft: "a",
      ArrowRight: "d",
      Space: "handbrake",
      ShiftLeft: "nitro",
      ShiftRight: "nitro",
    };
    if (map[e.code]) this.input[map[e.code]] = true;
    if (e.code === "KeyC" && this.state === "playing")
      this.cameraMode = (this.cameraMode + 1) % 3;
    if (e.code === "KeyR" && this.state === "playing") this.resetCar();
    if (
      e.code === "Escape" &&
      (this.state === "playing" || this.state === "paused")
    )
      this.pause();
  });
  window.addEventListener("keyup", (e) => {
    const map = {
      KeyW: "w",
      KeyS: "s",
      KeyA: "a",
      KeyD: "d",
      ArrowUp: "w",
      ArrowDown: "s",
      ArrowLeft: "a",
      ArrowRight: "d",
      Space: "handbrake",
      ShiftLeft: "nitro",
      ShiftRight: "nitro",
    };
    if (map[e.code]) this.input[map[e.code]] = false;
  });
  window.addEventListener("blur", () => {
    this.input = {};
    if (this.state === "playing") this.pause();
  });
}
