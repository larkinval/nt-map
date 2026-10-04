/**
 * НовТехГрупп — поведение Liquid Glass (к tokens.css v0.3).
 *
 * Стили стекла живут в токенах; здесь то, что CSS не умеет:
 * - lens(els)        — преломление у кромки (lensing). Карта смещений по форме
 *                      элемента + backdrop-filter: url(). Только Chromium, в
 *                      Safari и Firefox остаётся обычное матовое стекло.
 * - live             — свет: блик идёт за курсором, при нажатии стекло вспыхивает
 *                      изнутри от точки касания. Включается классом .nt-glass-live.
 * - adapt(els, sel)  — маленькое стекло темнеет над тёмным контентом (sel) в
 *                      светлой теме: класс .on-dark.
 * - grow(el, from)   — элемент вырастает из источника: меню из кнопки, лист из
 *                      кнопки. Форма перетекает, а не просто появляется.
 * - shrink(el, to)   — обратное движение, быстрее появления.
 *
 * Всё уважает «Уменьшить движение»: без анимаций, без вспышек.
 * Подключение: <script src="../novtech/glass.js"></script> до скрипта страницы.
 */
(() => {
  "use strict";
  const CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CHROMIUM = !!(navigator.userAgentData && navigator.userAgentData.brands.some((b) => /Chromium/.test(b.brand)));
  const NS = "http://www.w3.org/2000/svg";

  // ---------- преломление ----------
  let defs = null, seq = 0;
  function lensMap(w, h, r, band) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d"), img = ctx.createImageData(w, h), hw = w / 2, hh = h / 2;
    // знаковое расстояние до скруглённого прямоугольника: внутри — отрицательное
    const sd = (x, y) => { const qx = Math.abs(x - hw) - (hw - r), qy = Math.abs(y - hh) - (hh - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5, d = -sd(px, py);
      let R = 128, G = 128;
      if (d > 0 && d < band) {
        const gx = sd(px + 1, py) - sd(px - 1, py), gy = sd(px, py + 1) - sd(px, py - 1), len = Math.hypot(gx, gy) || 1;
        const m = (1 - d / band) ** 2; // сильнее у самого края
        R = 128 - 127 * (gx / len) * m; G = 128 - 127 * (gy / len) * m; // свет берём изнутри — кромка «увеличивает»
      }
      const i = (y * w + x) * 4;
      img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  function applyLens(el) {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    if (!defs) {
      defs = document.createElementNS(NS, "svg");
      defs.setAttribute("width", "0"); defs.setAttribute("height", "0"); defs.setAttribute("aria-hidden", "true");
      defs.style.position = "absolute";
      document.body.append(defs);
    }
    const id = el.dataset.lens || (el.dataset.lens = "nt-lens-" + seq++);
    let f = defs.querySelector("#" + id);
    if (!f) { f = document.createElementNS(NS, "filter"); f.id = id; defs.append(f); }
    if (f.dataset.size !== w + "x" + h) {
      f.dataset.size = w + "x" + h;
      f.setAttribute("x", "0"); f.setAttribute("y", "0"); f.setAttribute("width", w); f.setAttribute("height", h);
      f.setAttribute("filterUnits", "userSpaceOnUse"); f.setAttribute("color-interpolation-filters", "sRGB");
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 22, h / 2);
      f.innerHTML = `<feImage href="${lensMap(w, h, r, 20)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="64" xChannelSelector="R" yChannelSelector="G"/>`;
    }
    const v = `url(#${id}) blur(10px) saturate(170%)`;
    el.style.backdropFilter = v; el.style.webkitBackdropFilter = v;
  }
  function clearLens(el) { el.style.backdropFilter = ""; el.style.webkitBackdropFilter = ""; }
  const timers = new WeakMap();
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    // пока элемент меняет размер (сжатие, раскрытие) — обычное стекло, линза вернётся, когда размер успокоится
    entries.forEach(({ target }) => {
      clearLens(target);
      clearTimeout(timers.get(target));
      timers.set(target, setTimeout(() => applyLens(target), 220));
    });
  }) : null;
  function lens(els) {
    if (!CHROMIUM) return;
    els.forEach((el) => { applyLens(el); if (ro) ro.observe(el); });
  }

  // ---------- свет ----------
  function at(el, e) {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--gx", e.clientX - r.left + "px");
    el.style.setProperty("--gy", e.clientY - r.top + "px");
  }
  document.addEventListener("pointermove", (e) => {
    const g = e.target.closest && e.target.closest(".nt-glass-live");
    if (g) at(g, e);
  }, { passive: true });
  document.addEventListener("pointerdown", (e) => {
    if (CALM) return;
    const g = e.target.closest && e.target.closest(".nt-glass-live");
    if (!g) return;
    at(g, e);
    g.classList.remove("nt-press"); void g.offsetWidth; g.classList.add("nt-press");
    setTimeout(() => g.classList.remove("nt-press"), 700);
  });

  // ---------- адаптивность ----------
  function adapt(els, darkSelector) {
    if (document.documentElement.dataset.theme === "dark") { els.forEach((el) => el.classList.remove("on-dark")); return; }
    const darks = [...document.querySelectorAll(darkSelector)].map((d) => d.getBoundingClientRect()).filter((d) => d.height);
    els.forEach((el) => {
      const r = el.getBoundingClientRect(), cy = r.top + r.height / 2;
      el.classList.toggle("on-dark", darks.some((d) => d.top <= cy && d.bottom >= cy && d.left < r.right && d.right > r.left));
    });
  }

  // ---------- рост из источника ----------
  function frames(el, from, radiusFrom, radiusTo) {
    const m = el.getBoundingClientRect();
    const dy = Math.min(0, from.top - m.top); // если источник выше — сначала поднимаем, потом растим вниз
    // видимая область = прямоугольник источника, в координатах элемента до сдвига
    const top = from.top - m.top - dy, bottom = m.height - (from.bottom - m.top - dy);
    const a = {
      transform: `translateY(${dy}px)`,
      clipPath: `inset(${Math.max(0, top)}px ${Math.max(0, m.right - from.right)}px ${Math.max(0, bottom)}px ${Math.max(0, from.left - m.left)}px round ${radiusFrom}px)`,
      opacity: 0.7,
    };
    const b = { transform: "translateY(0)", clipPath: `inset(0px 0px 0px 0px round ${radiusTo}px)`, opacity: 1 };
    return [a, b];
  }
  function grow(el, from, opts = {}) {
    el.getAnimations().forEach((x) => x.cancel());
    if (CALM || !from || !from.width) return null;
    const [a, b] = frames(el, from, opts.radiusFrom ?? from.height / 2, opts.radiusTo ?? 20);
    return el.animate([a, b], { duration: opts.duration || 440, easing: "cubic-bezier(0.34, 1.12, 0.64, 1)" });
  }
  function shrink(el, to, opts = {}) {
    el.getAnimations().forEach((x) => x.cancel());
    if (CALM || !to || !to.width) return null;
    const [a, b] = frames(el, to, opts.radiusFrom ?? to.height / 2, opts.radiusTo ?? 20);
    return el.animate([b, { ...a, opacity: 0 }], { duration: opts.duration || 200, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
  }

  window.NTGlass = { lens, adapt, grow, shrink, calm: CALM };
})();
