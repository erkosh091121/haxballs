const key = "nightshift-save-v1";
export function load() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(key));
  } catch {}
  return {
    credits: 2500,
    active: "pulse",
    owned: ["pulse"],
    upgrades: {},
    colors: {},
    rims: {},
    suspension: {},
    settings: { quality: "medium", particles: true, volume: 0.35 },
    ...s,
    settings: {
      quality: "medium",
      particles: true,
      volume: 0.35,
      ...s?.settings,
    },
  };
}
export function save(s) {
  try {
    localStorage.setItem(key, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
