export function evaluateModes(g, p, competitors, rank) {
  if (
    g.mode === "street" &&
    (p.passed >= 16 || competitors.some((c) => c.passed >= 16))
  )
    g.finish(
      p.passed >= 16 && rank === 1,
      p.passed >= 16 && rank === 1
        ? "Вы финишировали первым"
        : "Соперник пересёк финиш",
    );
  if (g.mode === "time" && (p.passed >= 8 || g.elapsed >= 75))
    g.finish(p.passed >= 8, p.passed >= 8 ? "Круг завершён" : "Время вышло");
  if (g.mode === "drift" && (g.score >= 2000 || g.elapsed >= 90))
    g.finish(
      g.score >= 2000,
      g.score >= 2000 ? "Цель достигнута" : "Время вышло",
    );
  if (g.mode === "highway" && (g.distance >= 1200 || g.elapsed >= 100))
    g.finish(
      g.distance >= 1200,
      g.distance >= 1200 ? "Дистанция пройдена" : "Время вышло",
    );
  if (
    g.mode === "drag" &&
    (g.distance >= 400 || g.cars[1].z <= -210 || g.elapsed >= 40)
  ) {
    let win = g.distance >= 400 && g.cars[1].z > -210;
    g.finish(win, win ? "Вы выиграли спринт" : "Соперник финишировал");
  }
  if (g.mode === "police" && (g.elapsed >= 60 || g.arrest >= 5))
    g.finish(
      g.elapsed >= 60,
      g.elapsed >= 60 ? "Вы ушли от погони" : "Вас задержали",
    );
  if (g.mode === "free" && g.integrity <= 0) g.finish(false, "Машина разбита");
  if (g.mode === "parking" && (g.parking >= 2 || g.elapsed >= 90))
    g.finish(
      g.parking >= 2,
      g.parking >= 2 ? "Автомобиль припаркован" : "Время вышло",
    );
  if (g.mode === "elimination" && g.elapsed >= g.nextElim) {
    g.nextElim += 25;
    if (rank > competitors.length) {
      g.finish(false, "Вы выбыли");
    } else {
      let last = competitors.reduce((a, b) => {
        if (a.passed !== b.passed) return a.passed < b.passed ? a : b;
        const ca = g.getCheckpoint(a.next),
          cb = g.getCheckpoint(b.next);
        return Math.hypot(ca.x - a.x, ca.z - a.z) >
          Math.hypot(cb.x - b.x, cb.z - b.z)
          ? a
          : b;
      });
      if (last) {
        last.alive = false;
        last.visual.group.visible = false;
      }
      if (competitors.length === 1) g.finish(true, "Вы остались последним");
    }
  }
}
