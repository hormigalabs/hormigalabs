/* Hormiga Labs — ambient ant crawlers.
   Canvas-based top-down ants wandering the page. Subtle, behind content.
   - Ants fade out as you scroll past the hero, fade back near the top.
   - Nav toggle (ant button) turns them off entirely; choice saved in localStorage.
   - Respects prefers-reduced-motion. */
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.id = "ant-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.transition = "opacity 0.6s ease";
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  let W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const COLOR = "rgba(233, 231, 219, 0.5)";
  const N = Math.max(5, Math.min(9, Math.floor(W / 180)));

  function rand(a, b) { return a + Math.random() * (b - a); }

  class Ant {
    constructor() { this.spawn(true); }
    spawn(anywhere) {
      if (anywhere) {
        this.x = rand(0, W); this.y = rand(0, H);
      } else {
        const edge = Math.floor(rand(0, 4));
        if (edge === 0) { this.x = -20; this.y = rand(0, H); }
        if (edge === 1) { this.x = W + 20; this.y = rand(0, H); }
        if (edge === 2) { this.x = rand(0, W); this.y = -20; }
        if (edge === 3) { this.x = rand(0, W); this.y = H + 20; }
      }
      this.a = rand(0, Math.PI * 2);
      this.speed = rand(0.5, 1.15);
      this.scale = rand(0.8, 1.25);
      this.phase = rand(0, Math.PI * 2);
      this.pause = 0;
      this.retarget();
    }
    retarget() {
      this.tx = rand(W * 0.05, W * 0.95);
      this.ty = rand(H * 0.05, H * 0.95);
    }
    step(dt) {
      if (this.pause > 0) { this.pause -= dt; return; }
      if (Math.random() < 0.0015) { this.pause = rand(300, 1200); return; }

      const dx = this.tx - this.x, dy = this.ty - this.y;
      if (Math.hypot(dx, dy) < 24) this.retarget();

      const want = Math.atan2(dy, dx);
      let diff = want - this.a;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.a += diff * 0.03 + rand(-0.06, 0.06);

      const v = this.speed * dt * 0.06;
      this.x += Math.cos(this.a) * v;
      this.y += Math.sin(this.a) * v;
      this.phase += dt * 0.035 * this.speed;

      if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) this.spawn(false);
    }
    draw() {
      const s = this.scale;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.a + Math.PI / 2);
      ctx.strokeStyle = COLOR;
      ctx.fillStyle = COLOR;
      ctx.lineWidth = 1 * s;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const ly = (i - 1) * 3.2 * s;
        const swingL = Math.sin(this.phase + i * 2.1) * 2.2 * s;
        const swingR = Math.sin(this.phase + i * 2.1 + Math.PI) * 2.2 * s;
        ctx.beginPath();
        ctx.moveTo(0, ly); ctx.lineTo(-5.5 * s, ly + swingL - 1.5 * s);
        ctx.moveTo(0, ly); ctx.lineTo(5.5 * s, ly + swingR - 1.5 * s);
        ctx.stroke();
      }
      const twitch = Math.sin(this.phase * 0.7) * 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(0, -5.5 * s); ctx.lineTo(-2.6 * s, -9 * s + twitch);
      ctx.moveTo(0, -5.5 * s); ctx.lineTo(2.6 * s, -9 * s - twitch);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -4.6 * s, 1.7 * s, 2.1 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -0.5 * s, 1.5 * s, 2.4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 4.4 * s, 2.3 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  const ants = Array.from({ length: N }, () => new Ant());

  /* ---- state: user toggle + scroll fade ---- */
  let enabled = !reduced && localStorage.getItem("hl-ants") !== "off";
  let scrollVisible = true;
  let rafId = null;
  let last = performance.now();

  function updateVisibility() {
    // Fade out once you've scrolled past ~70% of the first screen
    scrollVisible = window.scrollY < window.innerHeight * 0.7;
    const show = enabled && scrollVisible && !document.hidden;
    canvas.style.opacity = enabled && scrollVisible ? "1" : "0";
    if (show && rafId === null) { last = performance.now(); rafId = requestAnimationFrame(tick); }
  }
  window.addEventListener("scroll", updateVisibility, { passive: true });
  document.addEventListener("visibilitychange", updateVisibility);

  function tick(now) {
    if (!enabled || !scrollVisible || document.hidden) {
      rafId = null;
      return; // canvas is faded out; stop animating until visible again
    }
    const dt = Math.min(now - last, 50);
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (const ant of ants) { ant.step(dt); ant.draw(); }
    rafId = requestAnimationFrame(tick);
  }

  /* ---- nav toggle button ---- */
  const navLinks = document.querySelector(".nav-links");
  if (navLinks && !reduced) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "ant-switch";
    btn.type = "button";
    btn.innerHTML =
      '<svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">' +
      '<circle cx="16" cy="7" r="4" fill="currentColor"/>' +
      '<circle cx="16" cy="15" r="3.2" fill="currentColor"/>' +
      '<circle cx="16" cy="24.5" r="5" fill="currentColor"/>' +
      '<path d="M8 12 L13 14 M8 20 L13 17 M24 12 L19 14 M24 20 L19 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      "</svg>";
    function syncBtn() {
      btn.setAttribute("aria-pressed", String(enabled));
      btn.setAttribute("aria-label", enabled ? "Turn off crawling ants" : "Turn on crawling ants");
      btn.title = enabled ? "Ants: on" : "Ants: off";
      btn.classList.toggle("off", !enabled);
    }
    btn.addEventListener("click", () => {
      enabled = !enabled;
      localStorage.setItem("hl-ants", enabled ? "on" : "off");
      syncBtn();
      updateVisibility();
    });
    syncBtn();
    li.appendChild(btn);
    navLinks.insertBefore(li, navLinks.lastElementChild); // before the CTA button
  }

  updateVisibility();
  if (enabled && !reduced) { rafId = requestAnimationFrame(tick); }
  if (reduced) canvas.style.opacity = "0";
})();

/* Scroll reveal + mobile nav */
(function () {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
})();
