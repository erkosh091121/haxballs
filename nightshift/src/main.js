import "./styles/main.css";
import { load } from "./data/save.js";
import { UI } from "./ui/app.js";
import { Game } from "./game/game.js";
const state = load(),
  ui = new UI(document.querySelector("#app"), state);
try {
  const game = new Game(
    document.querySelector("#game"),
    state,
    (fps) => ui.update(fps),
    (r) => ui.finish(r),
  );
  ui.attach(game);
  window.__nightshift = { game, ui, state };
} catch (e) {
  document.querySelector("#app").innerHTML =
    `<div class="fatal"><h1>Не удалось запустить 3D</h1><p>Проверьте поддержку WebGL в браузере и обновите страницу.</p><pre></pre></div>`;
  document.querySelector("pre").textContent = e.message;
  console.error(e);
}
