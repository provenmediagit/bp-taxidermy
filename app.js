(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PHONE = "+14065440222";

  /* ---------- Drop-off tag app ---------- */
  const SPECIES = [
    { id: "deer", name: "Whitetail / mule deer", short: "Deer", reg: 150 },
    { id: "antelope", name: "Antelope", short: "Antelope", reg: 160 },
    { id: "elk", name: "Elk", short: "Elk", reg: 185 },
    { id: "bear", name: "Bear", short: "Bear", reg: 185 },
    { id: "moose", name: "Moose", short: "Moose", reg: 250 },
    { id: "bison", name: "Bison / buffalo", short: "Bison / buffalo", reg: 350 },
    { id: "small", name: "Small game / predator", short: "Small game / predator", reg: 100 },
  ];
  const $ = (s) => document.querySelector(s);
  const wrap = $("#species");
  let pick = SPECIES[0];
  const tagNo = String(Math.floor(1000 + Math.random() * 9000));
  $("#tagno").textContent = "#" + tagNo;
  const today = new Date();
  $("#t-date").textContent = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  SPECIES.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sp";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", i === 0 ? "true" : "false");
    b.tabIndex = i === 0 ? 0 : -1;
    b.dataset.id = s.id;
    b.innerHTML = `<span class="sp-name">${s.short}</span><span class="sp-price">$${s.reg}</span>`;
    b.addEventListener("click", () => select(s, b));
    b.addEventListener("keydown", (e) => {
      const k = e.key;
      if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(k)) return;
      e.preventDefault();
      const all = [...wrap.children];
      const n = (all.indexOf(b) + (k === "ArrowDown" || k === "ArrowRight" ? 1 : -1) + all.length) % all.length;
      all[n].focus();
      select(SPECIES[n], all[n]);
    });
    wrap.appendChild(b);
  });

  function select(s, btn) {
    pick = s;
    [...wrap.children].forEach((c) => {
      const on = c === btn;
      c.setAttribute("aria-checked", on ? "true" : "false");
      c.tabIndex = on ? 0 : -1;
    });
    render(true);
  }

  function render(bump) {
    const isNew = $("#newclient").checked;
    const now = isNew ? pick.reg - 25 : pick.reg;
    const name = $("#name").value.trim();
    const note = $("#note").value.trim();
    $("#t-species").textContent = pick.name;
    $("#t-name").textContent = name || "Your name";
    $("#t-was").textContent = isNew ? "$" + pick.reg : "";
    $("#t-now").textContent = "$" + now;
    [...wrap.children].forEach((c, i) => {
      c.querySelector(".sp-price").textContent = "$" + (isNew ? SPECIES[i].reg - 25 : SPECIES[i].reg);
    });
    const msg = [
      `Hi Bob, drop-off tag #${tagNo} from your website.`,
      `Animal: ${pick.name}, euro mount.`,
      `Price on the site: $${now}${isNew ? " (new client, $25 off)" : ""}.`,
      name ? `Name: ${name}.` : "",
      note ? `Note: ${note}.` : "",
      "When can I drop it off?",
    ].filter(Boolean).join("\n");
    $("#sendtag").href = `sms:${PHONE}?&body=${encodeURIComponent(msg)}`;
    $("#copytag").dataset.msg = msg;
    if (bump && !reduce) {
      const t = $("#tagcard");
      t.classList.remove("bump"); void t.offsetWidth; t.classList.add("bump");
    }
  }
  $("#newclient").addEventListener("change", () => render(true));
  $("#name").addEventListener("input", () => render(false));
  $("#note").addEventListener("input", () => render(false));
  $("#copytag").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(e.currentTarget.dataset.msg);
      $("#copied").textContent = "Copied. Paste it in a text to 406-544-0222.";
    } catch {
      $("#copied").textContent = "Couldn't copy here. Use the text button instead.";
    }
  });
  render(false);

  /* ---------- Hero skull tilt ---------- */
  const hero = $("#hero"), skull = $(".skull-wrap");
  if (!reduce && matchMedia("(pointer:fine)").matches) {
    let raf = 0, tx = 0, ty = 0;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(() => {
        skull.style.setProperty("--ry", (tx * 14).toFixed(2) + "deg");
        skull.style.setProperty("--rx", (-ty * 9).toFixed(2) + "deg");
        raf = 0;
      });
    });
    hero.addEventListener("pointerleave", () => {
      skull.style.setProperty("--ry", "0deg"); skull.style.setProperty("--rx", "0deg");
    });
  }

  /* ---------- Manifesto words ---------- */
  const man = $("#manifesto");
  man.innerHTML = man.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");

  /* ---------- Depth photos (WebGL 2.5D) ---------- */
  const panels = [...document.querySelectorAll(".depth")];
  const glPanels = [];
  const VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}";
  const FS = `precision mediump float;varying vec2 v;uniform sampler2D img,dep;uniform vec2 off,scl;
    void main(){vec2 uv=(v-.5)*scl+.5;float d=texture2D(dep,uv).r;
    vec2 o=off*(d-.45)*.045;gl_FragColor=texture2D(img,uv+o);}`;
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function initPanel(el) {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl", { premultipliedAlpha: false, antialias: false });
    if (!gl) return;
    try {
      const [im, dm] = await Promise.all([loadImg(el.dataset.img), loadImg(el.dataset.depth)]);
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = (unit, src) => {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((w) => gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      };
      tex(0, im); tex(1, dm);
      gl.uniform1i(gl.getUniformLocation(pr, "img"), 0); gl.uniform1i(gl.getUniformLocation(pr, "dep"), 1);
      const uOff = gl.getUniformLocation(pr, "off"), uScl = gl.getUniformLocation(pr, "scl");
      el.appendChild(cv);
      const P = { el, cv, gl, uOff, uScl, im, x: 0, y: 0, tx: 0, ty: 0 };
      P.size = () => {
        const r = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
        cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
        gl.viewport(0, 0, cv.width, cv.height);
        const ca = r.width / r.height, ia = im.width / im.height;
        const z = 0.92; // slight overscan so edges never show
        gl.uniform2f(uScl, ca > ia ? z : z * ca / ia, ca > ia ? z * ia / ca : z);
      };
      P.size();
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        P.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; P.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
      el.addEventListener("pointerleave", () => { P.tx = 0; P.ty = 0; });
      glPanels.push(P);
      el.classList.add("gl");
    } catch (_) { /* plain <img> stays as the fallback */ }
  }
  if (!reduce) panels.forEach(initPanel);
  addEventListener("resize", () => glPanels.forEach((p) => p.size()));
  let tilt = { x: 0, y: 0 };
  addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    tilt.x = Math.max(-1, Math.min(1, e.gamma / 25)); tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
  });
  const t0 = performance.now();
  (function loop(now) {
    const t = (now - t0) / 1000;
    glPanels.forEach((P, i) => {
      // idle drift so the depth reads even without a pointer (phones, first view)
      const ix = Math.sin(t * 0.55 + i) * 0.55 + tilt.x, iy = Math.cos(t * 0.42 + i * 1.7) * 0.35 + tilt.y;
      const gx = P.tx || ix, gy = P.ty || iy;
      P.x += (gx - P.x) * 0.06; P.y += (gy - P.y) * 0.06;
      P.gl.uniform2f(P.uOff, P.x, P.y);
      P.gl.drawArrays(P.gl.TRIANGLE_STRIP, 0, 4);
    });
    requestAnimationFrame(loop);
  })(t0);

  /* ---------- Scroll choreography ---------- */
  if (!window.gsap || reduce) return;
  gsap.registerPlugin(ScrollTrigger);

  // hero entrance: skull rises into the spotlight, words follow
  gsap.from(".skull", { y: 120, opacity: 0, scale: 0.92, duration: 1.4, ease: "expo.out", delay: 0.1 });
  gsap.from(".hero-copy > *", { y: 40, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.09, delay: 0.25 });
  // hero exit: skull turns away as you scroll into the work
  gsap.to(".skull", { rotateY: 28, y: 80, scale: 0.86, opacity: 0.3, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });

  const mm = gsap.matchMedia();
  mm.add("(min-width: 768px)", () => {
    const track = document.querySelector(".work-track");
    const dist = () => track.scrollWidth - innerWidth + 40;
    gsap.to(track, { x: () => -dist(), ease: "none",
      scrollTrigger: { trigger: ".work", start: "top top", end: () => "+=" + dist(), pin: ".work-pin", scrub: 1, invalidateOnRefresh: true } });
  });

  // 19 hours: count up as the lingcod assembles
  const cnt = document.querySelector(".count");
  const o = { v: 0 };
  gsap.to(o, { v: 19, ease: "power2.out", onUpdate: () => (cnt.textContent = Math.round(o.v)),
    scrollTrigger: { trigger: ".nineteen", start: "top 70%", end: "center center", scrub: 0.6 } });
  gsap.fromTo(".ling", { scale: 1.25, rotate: -6, opacity: 0 }, { scale: 1, rotate: 0, opacity: 0.42, ease: "none",
    scrollTrigger: { trigger: ".nineteen", start: "top bottom", end: "center center", scrub: true } });

  // process: the orange line draws as you read down the steps
  gsap.to(".process-line path", { strokeDashoffset: 0, ease: "none",
    scrollTrigger: { trigger: ".process-body", start: "top 70%", end: "bottom 60%", scrub: true } });
  gsap.utils.toArray(".steps li").forEach((li) =>
    gsap.from(li, { x: 40, opacity: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: li, start: "top 80%" } }));

  // Bob: words light up in reading order
  gsap.to(".manifesto .w", { opacity: 1, stagger: 0.05, ease: "none",
    scrollTrigger: { trigger: ".manifesto", start: "top 75%", end: "bottom 45%", scrub: true } });

  gsap.from(".tag", { y: 80, rotate: 6, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: ".tagapp-grid", start: "top 75%" } });
  gsap.from(".final .phone", { scale: 0.85, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".final", start: "top 70%" } });
})();
