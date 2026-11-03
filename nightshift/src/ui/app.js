import { cars, modes } from "../data/catalog.js";
import { save } from "../data/save.js";
const money = (n) => Math.floor(n).toLocaleString("ru-RU");
export class UI {
  constructor(root, state) {
    this.root = root;
    this.save = state;
    this.tab = "race";
    this.selectedMode = "street";
    this.selectedCar = state.active;
    root.innerHTML = `<canvas id="game" aria-label="Трёхмерная сцена ночного города и автомобиля">Для отображения игры необходим WebGL.</canvas><div class="vignette"></div><div id="interface"></div><div id="toast" role="status"></div>`;
    this.el = root.querySelector("#interface");
    this.toastEl = root.querySelector("#toast");
  }
  attach(game) {
    this.game = game;
    this.draw();
  }
  toast(s) {
    this.toastEl.textContent = s;
    this.toastEl.classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.toastEl.classList.remove("show"), 2200);
  }
  persist() {
    if (!save(this.save))
      this.toast("Не удалось сохранить прогресс в браузере");
  }
  button(text, action, cls = "", extra = "") {
    return `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
  }
  draw() {
    const g = this.game;
    if (!g) return;
    if (g.state === "playing") {
      this.el.innerHTML = this.hud();
      return;
    }
    if (g.state === "paused") {
      this.el.innerHTML =
        this.hud() +
        `<div class="modal" role="dialog" aria-modal="true" aria-label="Пауза"><div class="pause-panel"><span class="eyebrow">ПАУЗА / NIGHTSHIFT</span><h2>Передышка<span>.</span></h2><p>Город подождёт. Вернитесь, когда будете готовы.</p>${this.button("Продолжить", "resume", "primary wide")}${g.mode === "free" ? this.button("Завершить поездку", "quit", "secondary wide") : this.button("В главное меню", "quit", "secondary wide")}<small>ESC — продолжить</small></div></div>`;
      this.events();
      return;
    }
    if (g.state === "result") {
      let r = this.result;
      this.el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Результат заезда"><div class="pause-panel result"><span class="eyebrow">${r.win ? "ЗАЕЗД ЗАВЕРШЁН" : "ЗАЕЗД ОКОНЧЕН"} / ${r.mode}</span><h2>${r.win ? "Отличная<br>работа" : "Ещё один<br>заезд"}<span>.</span></h2><p>${r.reason}</p><div class="result-stats"><div><small>ВРЕМЯ</small><strong>${r.time.toFixed(1)} c</strong></div><div><small>НАГРАДА</small><strong>+${money(r.reward)} CR</strong></div></div>${this.button("Ещё раз", "retry", "primary wide")}${this.button("В главное меню", "menu", "secondary wide")}</div></div>`;
      this.events();
      return;
    }
    const mode = modes.find((m) => m.id === this.selectedMode),
      car = cars.find((c) => c.id === this.selectedCar),
      owned = this.save.owned.includes(car.id),
      up = this.save.upgrades[car.id] || {};
    this.el.innerHTML = `<div class="menu"><header><div class="brand"><span class="mark">N<span>/</span></span><div><b>NIGHTSHIFT</b><small>STREET LEGENDS</small></div></div><div class="topright"><span class="live"><i></i> ГОРОД НЕ СПИТ</span><span class="wallet">${money(this.save.credits)} <em>CR</em></span>${this.button("НАСТРОЙКИ", "settings", "topbtn")}</div></header><main><div class="nav"><span>01 / ГЛАВНОЕ МЕНЮ</span><div class="tabs">${this.button("ЗАЕЗД", "race", this.tab === "race" ? "active" : "")}${this.button("ГАРАЖ", "garage", this.tab === "garage" ? "active" : "")}${this.button("УПРАВЛЕНИЕ", "controls", this.tab === "controls" ? "active" : "")}</div></div>${
      this.tab === "race"
        ? `<div class="layout"><section class="maincol"><div class="section-no">ВЫБЕРИТЕ СВОЮ ИСТОРИЮ <span>01 — 09</span></div><h1>НОЧЬ<br><span>ТВОЯ.</span></h1><p class="intro">Девять способов оставить след на улицах города. Выбери заезд и выходи на старт.</p><div class="mode-list">${modes.map((m, i) => `<button class="mode ${m.id === mode.id ? "chosen" : ""}" data-action="mode" data-id="${m.id}"><span class="mode-num">${String(i + 1).padStart(2, "0")}</span><span><b>${m.name}</b><small>${m.ru}</small></span><span class="mode-arrow">↗</span></button>`).join("")}</div></section><aside class="detail"><span class="eyebrow">${mode.tag}</span><h2>${mode.name}</h2><div class="rule"></div><p>${mode.desc}</p><div class="facts"><div><small>УСЛОВИЯ</small><b>${mode.goal}</b></div><div><small>АВТОМОБИЛЬ</small><b>${cars.find((c) => c.id === this.save.active).name}</b></div></div>${this.button("НА СТАРТ <span>↗</span>", "start", "primary wide")}<div class="keyboard">W A S D <span>УПРАВЛЕНИЕ</span> &nbsp; SHIFT <span>НИТРО</span></div></aside></div>`
        : this.tab === "garage"
          ? `<div class="garage-layout"><div><div class="section-no">КОЛЛЕКЦИЯ <span>${this.save.owned.length} / ${cars.length}</span></div><h1>ТВОЙ<br><span>ГАРАЖ.</span></h1><p class="intro">Выбери машину, настрой её и возвращайся на улицы.</p><div class="car-list">${cars.map((c) => `<button data-action="car" data-id="${c.id}" class="car-row ${car.id === c.id ? "selected" : ""}"><span><b>${c.name}</b><small>${c.type}</small></span><strong>${this.save.active === c.id ? "АКТИВЕН" : this.save.owned.includes(c.id) ? "В ГАРАЖЕ" : money(c.price) + " CR"}</strong></button>`).join("")}</div></div><aside class="garage-detail"><span class="eyebrow">${owned ? "В ВАШЕЙ КОЛЛЕКЦИИ" : "ДОСТУПЕН К ПОКУПКЕ"}</span><h2>${car.name}</h2><p>${car.type} / ${car.speed * 4} км/ч</p><div class="bar"><span>СКОРОСТЬ</span><i><b style="width:${(car.speed / 70) * 100}%"></b></i></div><div class="bar"><span>РАЗГОН</span><i><b style="width:${(car.accel / 30) * 100}%"></b></i></div><div class="bar"><span>СЦЕПЛЕНИЕ</span><i><b style="width:${(car.grip / 4) * 100}%"></b></i></div>${owned ? this.button(this.save.active === car.id ? "ВЫБРАН" : "ВЫБРАТЬ", "select", "primary wide") : this.button("КУПИТЬ ЗА " + money(car.price) + " CR", "buy", "primary wide", this.save.credits < car.price ? "disabled" : "")}<div class="custom"><div class="section-no">НАСТРОЙКА</div><label>ЦВЕТ <input type="color" id="paint" value="${this.save.colors[car.id] || car.color}" ${owned ? "" : "disabled"}></label><label>ДИСКИ <select id="rims" ${owned ? "" : "disabled"}><option value="0" ${!this.save.rims[car.id] ? "selected" : ""}>СТАНДАРТ</option><option value="1" ${this.save.rims[car.id] ? "selected" : ""}>CYAN 05</option></select></label><label>ПОДВЕСКА <select id="suspension" ${owned ? "" : "disabled"}>${[0, 1, 2].map((x) => `<option value="${x}" ${(this.save.suspension[car.id] ?? 1) === x ? "selected" : ""}>${["НИЗКАЯ", "СТАНДАРТ", "ВЫСОКАЯ"][x]}</option>`).join("")}</select></label>${["engine", "brakes", "grip"].map((k, i) => this.button(`${["ДВИГАТЕЛЬ", "ТОРМОЗА", "СЦЕПЛЕНИЕ"][i]} <span>УР. ${up[k] || 0} / 3 · ${600 * ((up[k] || 0) + 1)} CR</span>`, "upgrade", "upgrade", `data-id="${k}" ${!owned || (up[k] || 0) >= 3 ? "disabled" : ""}`)).join("")}</div></aside></div>`
          : `<section class="controls"><span class="eyebrow">ПАМЯТКА ВОДИТЕЛЯ</span><h1>ДЕРЖИ<br><span>КОНТРОЛЬ.</span></h1><div class="control-grid">${[
              ["W / S", "ГАЗ / ТОРМОЗ И ЗАДНИЙ ХОД"],
              ["A / D", "ПОВОРОТ"],
              ["SPACE", "РУЧНОЙ ТОРМОЗ"],
              ["SHIFT", "НИТРО"],
              ["C", "СМЕНИТЬ КАМЕРУ"],
              ["R", "ВОССТАНОВИТЬ АВТО"],
              ["ESC", "ПАУЗА"],
            ]
              .map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`)
              .join(
                "",
              )}</div><p>Для игры нужна клавиатура. При потере фокуса заезд ставится на паузу.</p></section>`
    }</main><footer><span>АЛЬФА / БРАУЗЕРНАЯ ИГРА</span><span>ЛОКАЛЬНЫЙ ПРОГРЕСС · ${g.fps || "—"} FPS</span></footer></div>`;
    this.events();
  }
  hud() {
    const g = this.game,
      p = g.player,
      m = modes.find((m) => m.id === g.mode);
    let target = {
      street: `КОНТРОЛЬНЫЕ ТОЧКИ ${p.passed} / 16`,
      time: `ТОЧКИ ${p.passed} / 8 · ${Math.ceil(Math.max(0, 75 - g.elapsed))} С`,
      drift: `${Math.floor(g.score)} / 2 000 ОЧКОВ · ${Math.ceil(Math.max(0, 90 - g.elapsed))} С`,
      highway: `${Math.floor(g.distance)} / 1 200 М · ${Math.ceil(Math.max(0, 100 - g.elapsed))} С`,
      drag: `${Math.floor(g.distance)} / 400 М · ${Math.ceil(Math.max(0, 40 - g.elapsed))} С`,
      free: `ПРОЙДЕНО ${Math.floor(g.distance)} / 250 М · ЦЕЛОСТНОСТЬ ${g.integrity}% · ESC`,
      police: `ДО УХОДА ${Math.ceil(Math.max(0, 60 - g.elapsed))} С · АРЕСТ ${Math.floor(g.arrest)}/5`,
      parking: `ОСТАНОВИТЕСЬ НА МЕСТЕ · ${Math.floor(g.parking)}/2 С · ${Math.ceil(Math.max(0, 90 - g.elapsed))} С`,
      elimination: `ПОЗИЦИЯ ${g.rank || 1} · ВЫБЫВАНИЕ ЧЕРЕЗ ${Math.ceil(Math.max(0, g.nextElim - g.elapsed))} С`,
    }[g.mode];
    return `<div class="hud ${p.speed > 30 ? "fast" : ""}"><div class="hud-top"><div><span class="eyebrow">NIGHTSHIFT / ${m.name.toUpperCase()}</span><strong>${target}</strong></div><div class="hud-time">${g.elapsed.toFixed(1)} <small>СЕК</small><br><small>${g.fps || "—"} FPS</small></div></div>${g.countdown > 0 ? `<div class="countdown">${Math.ceil(g.countdown)}</div>` : ""}<div class="hud-bottom"><div class="hint">WASD · УПРАВЛЕНИЕ<br>SPACE · РУЧНИК &nbsp; SHIFT · НИТРО<br>C · КАМЕРА &nbsp; R · ВОССТАНОВИТЬ &nbsp; ESC · ПАУЗА</div><div class="speed"><small>СКОРОСТЬ / KM/H</small><strong>${Math.round(p.speed * 4)}</strong><div class="nitro"><i style="width:${p.nitro}%"></i></div><small>NITRO ${Math.round(p.nitro)}%</small></div></div></div>`;
  }
  events(scope = this.el) {
    scope
      .querySelectorAll("[data-action]")
      .forEach((b) =>
        b.addEventListener("click", () =>
          this.action(b.dataset.action, b.dataset.id),
        ),
      );
    for (const [id, key] of [
      ["paint", "colors"],
      ["rims", "rims"],
      ["suspension", "suspension"],
    ])
      scope.querySelector("#" + id)?.addEventListener("change", (e) => {
        this.save[key][this.selectedCar] =
          id === "paint" ? e.target.value : Number(e.target.value);
        this.persist();
        this.previewCar();
      });
    scope.querySelector("#quality")?.addEventListener("change", (e) => {
      this.save.settings.quality = e.target.value;
      this.persist();
      this.toast("Настройка применится после перезагрузки");
    });
    scope.querySelector("#particles")?.addEventListener("change", (e) => {
      this.save.settings.particles = e.target.checked;
      this.persist();
    });
    scope.querySelector("#volume")?.addEventListener("input", (e) => {
      this.save.settings.volume = Number(e.target.value);
      this.persist();
    });
  }
  previewCar() {
    let old = this.save.active;
    this.save.active = this.selectedCar;
    this.game.setCar();
    this.save.active = old;
  }
  action(a, id) {
    const g = this.game,
      car = cars.find((c) => c.id === this.selectedCar);
    if (["race", "garage", "controls"].includes(a)) {
      this.tab = a;
      if (a === "garage") this.previewCar();
      else g.setCar();
      this.draw();
      return;
    }
    if (a === "mode") {
      this.selectedMode = id;
      this.draw();
    }
    if (a === "car") {
      this.selectedCar = id;
      this.previewCar();
      this.draw();
    }
    if (a === "start") {
      g.start(this.selectedMode);
      this.draw();
    }
    if (a === "resume") {
      g.pause();
    }
    if (a === "quit") {
      g.quit();
      this.draw();
    }
    if (a === "menu") {
      g.state = "menu";
      g.setCar();
      this.draw();
    }
    if (a === "retry") {
      g.start(g.mode);
      this.draw();
    }
    if (a === "buy") {
      if (this.save.credits >= car.price && !this.save.owned.includes(car.id)) {
        this.save.credits -= car.price;
        this.save.owned.push(car.id);
        this.persist();
        this.toast(car.name + " добавлен в гараж");
        this.draw();
      }
    }
    if (a === "select") {
      this.save.active = car.id;
      this.persist();
      g.setCar();
      this.toast(car.name + " выбран");
      this.draw();
    }
    if (a === "upgrade") {
      let u = (this.save.upgrades[car.id] ??= {});
      let price = 600 * ((u[id] || 0) + 1);
      if ((u[id] || 0) < 3 && this.save.credits >= price) {
        this.save.credits -= price;
        u[id] = (u[id] || 0) + 1;
        this.persist();
        this.toast("Улучшение установлено");
        this.draw();
      } else this.toast("Недостаточно кредитов");
    }
    if (a === "settings") {
      this.el.insertAdjacentHTML(
        "beforeend",
        `<div class="modal" id="settings-modal" role="dialog" aria-modal="true" aria-label="Настройки"><div class="pause-panel"><span class="eyebrow">ПАРАМЕТРЫ</span><h2>Настройки<span>.</span></h2><label>ГРАФИКА <select id="quality"><option value="low" ${this.save.settings.quality === "low" ? "selected" : ""}>LOW</option><option value="medium" ${this.save.settings.quality === "medium" ? "selected" : ""}>MEDIUM</option><option value="high" ${this.save.settings.quality === "high" ? "selected" : ""}>HIGH</option></select></label><label>ЧАСТИЦЫ <input id="particles" type="checkbox" ${this.save.settings.particles ? "checked" : ""}></label><label>ЗВУК <input id="volume" type="range" min="0" max="1" step=".05" value="${this.save.settings.volume}"></label>${this.button("ГОТОВО", "close-settings", "primary wide")}</div></div>`,
      );
      this.el.querySelector(".menu").inert = true;
      const modal = this.el.querySelector("#settings-modal");
      this.events(modal);
      modal.querySelector("[data-action=close-settings]").focus();
    }
    if (a === "close-settings") this.draw();
  }
  update(fpsOnly = false) {
    if (this.game.state === "playing") {
      this.el.innerHTML = this.hud();
    } else if (!fpsOnly) this.draw();
  }
  finish(r) {
    this.result = r;
    this.persist();
    this.draw();
  }
}
