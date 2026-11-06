(function () {
  window.DEMOS = window.DEMOS || {};

  const NX = 8, NY = 8, N = NX * NY;
  const RC = 2.5, RC2 = RC * RC;
  const DT = 0.004;

  function rnd() { return Math.random() - 0.5; }
  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function init(box) {
    const x = [], y = [], vx = [], vy = [];
    const a = box / NX;
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NY; j++) {
        x.push((i + 0.5) * a + rnd() * a * 0.15);
        y.push((j + 0.5) * a + rnd() * a * 0.15);
        vx.push(gauss() * 0.3);
        vy.push(gauss() * 0.3);
      }
    }
    return { x, y, vx, vy, box, pe: 0, ke: 0, t: 0, xi: 0, hist: [] };
  }

  function forces(st) {
    const { x, y, box } = st;
    const fx = new Array(N).fill(0), fy = new Array(N).fill(0);
    let pe = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = x[j] - x[i], dy = y[j] - y[i];
        dx -= box * Math.round(dx / box);
        dy -= box * Math.round(dy / box);
        const r2 = dx * dx + dy * dy;
        if (r2 > RC2 || r2 < 1e-9) continue;
        const ir2 = 1 / r2, ir6 = ir2 * ir2 * ir2;
        const f = 24 * ir6 * (2 * ir6 - 1) * ir2;
        pe += 4 * ir6 * (ir6 - 1);
        fx[i] -= f * dx; fy[i] -= f * dy;
        fx[j] += f * dx; fy[j] += f * dy;
      }
    }
    st.pe = pe;
    return [fx, fy];
  }

  window.DEMOS.md = {
    title: "恒温器对比（LJ 流体）",
    mount(el) {
      el.innerHTML =
        '<div class="demo-grid">' +
        '<label class="demo-field">系综 / 恒温器<select data-k="ens"><option value="nve">NVE（无恒温器）</option><option value="langevin" selected>Langevin</option><option value="nose">Nosé–Hoover</option><option value="csvr">CSVR</option></select></label>' +
        '<label class="demo-field">目标温度 T*<input type="range" data-k="temp" min="0.3" max="1.6" step="0.05" value="0.9"><span class="demo-val" data-tval>0.90</span></label>' +
        "</div>" +
        '<div class="demo-actions"><button class="demo-btn" type="button" data-reset>重置系统</button><span class="demo-note" style="margin:0">拖动温度滑块立刻改变恒温器目标值。</span></div>' +
        '<div class="md-wrap">' +
        '<canvas width="300" height="300" data-sim></canvas>' +
        '<canvas width="330" height="300" data-chart></canvas>' +
        "</div>" +
        '<div class="demo-note" data-msg></div>' +
        '<div class="demo-note">64 个粒子、二维 Lennard–Jones、约化单位（ε=σ=1，k<sub>B</sub>=1）。NVE 下总能量守恒、温度只做小幅涨落；恒温器把温度拉向目标值，代价是引入非物理的摩擦/随机力。</div>';

      const get = (k) => el.querySelector('[data-k="' + k + '"]');
      const sim = el.querySelector("[data-sim]");
      const chart = el.querySelector("[data-chart]");
      const msg = el.querySelector("[data-msg]");
      const tval = el.querySelector("[data-tval]");
      const sctx = sim.getContext("2d");
      const cctx = chart.getContext("2d");
      const box = 10;
      let st = init(box);
      let [fx, fy] = forces(st);
      let frames = 0;
      let running = true;

      function vscale(ctx, cw, ch) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return cw;
      }

      function step(ens, target) {
        const half = DT / 2;
        for (let i = 0; i < N; i++) {
          st.vx[i] += half * fx[i];
          st.vy[i] += half * fy[i];
          st.x[i] += DT * st.vx[i];
          st.y[i] += DT * st.vy[i];
          st.x[i] = ((st.x[i] % st.box) + st.box) % st.box;
          st.y[i] = ((st.y[i] % st.box) + st.box) % st.box;
        }
        [fx, fy] = forces(st);
        for (let i = 0; i < N; i++) {
          st.vx[i] += half * fx[i];
          st.vy[i] += half * fy[i];
        }
        let ke = 0;
        for (let i = 0; i < N; i++) ke += 0.5 * (st.vx[i] ** 2 + st.vy[i] ** 2);
        ke /= N;
        const tinst = ke; // 2D: <KE> = N kT -> per particle kT

        if (ens === "langevin") {
          const gamma = 1.0;
          const c1 = Math.exp(-gamma * DT);
          const c2 = Math.sqrt(target * (1 - c1 * c1));
          for (let i = 0; i < N; i++) {
            st.vx[i] = st.vx[i] * c1 + c2 * gauss();
            st.vy[i] = st.vy[i] * c1 + c2 * gauss();
          }
        } else if (ens === "nose") {
          const tau = 0.5;
          st.xi += DT * ((tinst / target) - 1) / (tau * tau);
          const damp = 1 - st.xi * DT;
          for (let i = 0; i < N; i++) { st.vx[i] *= damp; st.vy[i] *= damp; }
        } else if (ens === "csvr") {
          // CSVR：把动能显式拉向目标，同时加一项随机涨落，保证正则采样
          const tau = 0.3, nf = 2 * N;
          let k = 0;
          for (let i = 0; i < N; i++) k += 0.5 * (st.vx[i] ** 2 + st.vy[i] ** 2);
          const kbar = 0.5 * nf * target;
          const dk = (kbar - k) * DT / tau + 2 * Math.sqrt(Math.max(1e-12, k * kbar * DT / (tau * nf))) * gauss();
          const lam = Math.sqrt(Math.max(0, 1 + dk / Math.max(1e-9, k)));
          for (let i = 0; i < N; i++) { st.vx[i] *= lam; st.vy[i] *= lam; }
        }
        st.ke = ke;
        st.t = tinst;
        st.hist.push({ t: tinst, e: ke + st.pe / N });
        if (st.hist.length > 1200) st.hist.shift();
      }

      function drawSim() {
        const dpr = window.devicePixelRatio || 1;
        const w = 300, h = 300;
        sim.width = w * dpr; sim.height = h * dpr;
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.clearRect(0, 0, w, h);
        sctx.fillStyle = "rgba(127,127,127,.08)";
        sctx.fillRect(0, 0, w, h);
        sctx.strokeStyle = "rgba(127,127,127,.4)";
        sctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        const s = w / box;
        for (let i = 0; i < N; i++) {
          const sp = Math.hypot(st.vx[i], st.vy[i]);
          const t = Math.min(1, sp / 1.6);
          const r = Math.round(70 + 165 * t), g = Math.round(150 - 60 * t), b = Math.round(200 - 90 * t);
          sctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
          sctx.beginPath();
          sctx.arc(st.x[i] * s, st.y[i] * s, 4.6, 0, Math.PI * 2);
          sctx.fill();
        }
      }

      function drawChart(ens) {
        const dpr = window.devicePixelRatio || 1;
        const w = 330, h = 300;
        chart.width = w * dpr; chart.height = h * dpr;
        cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cctx.clearRect(0, 0, w, h);
        const padL = 34, padB = 22, padT = 12, padR = 8;
        const iw = w - padL - padR, ih = h - padT - padB;
        cctx.strokeStyle = "rgba(127,127,127,.35)";
        cctx.strokeRect(padL, padT, iw, ih);
        cctx.fillStyle = "rgba(127,127,127,.75)";
        cctx.font = "10px system-ui, sans-serif";
        const tmax = 2;
        for (let t = 0; t <= tmax; t += 0.5) {
          const y = padT + ih - (t / tmax) * ih;
          cctx.fillText(t.toFixed(1), 6, y + 3);
          cctx.strokeStyle = "rgba(127,127,127,.12)";
          cctx.beginPath(); cctx.moveTo(padL, y); cctx.lineTo(padL + iw, y); cctx.stroke();
        }
        cctx.fillStyle = "rgba(127,127,127,.75)";
        cctx.fillText("T* / E*", padL + 4, padT + 12);
        const target = +get("temp").value;
        if (ens !== "nve") {
          const yT = padT + ih - (target / tmax) * ih;
          cctx.strokeStyle = "rgba(244,162,97,.9)";
          cctx.setLineDash([5, 4]);
          cctx.beginPath(); cctx.moveTo(padL, yT); cctx.lineTo(padL + iw, yT); cctx.stroke();
          cctx.setLineDash([]);
        }
        const n = st.hist.length;
        if (n > 1) {
          const plot = (key, color) => {
            cctx.strokeStyle = color;
            cctx.lineWidth = 1.8;
            cctx.beginPath();
            st.hist.forEach((p, i) => {
              const x = padL + (i / 1199) * iw;
              const y = padT + ih - (Math.min(tmax, Math.max(0, p[key])) / tmax) * ih;
              i ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
            });
            cctx.stroke();
          };
          plot("t", "#2f9e8f");
          let ebar = st.hist.reduce((a, p) => a + p.e, 0) / n;
          const shift = 0.5; // 把总能量平移进可视区
          cctx.strokeStyle = "rgba(120,120,220,.65)";
          cctx.lineWidth = 1.4;
          cctx.beginPath();
          st.hist.forEach((p, i) => {
            const x = padL + (i / 1199) * iw;
            const y = padT + ih - (Math.min(tmax, Math.max(0, (p.e - ebar) * 3 + shift)) / tmax) * ih;
            i ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
          });
          cctx.stroke();
        }
        cctx.fillStyle = "#2f9e8f"; cctx.fillRect(padL, h - 12, 10, 3); cctx.fillStyle = "rgba(127,127,127,.8)"; cctx.fillText("瞬时温度", padL + 14, h - 8);
        cctx.fillStyle = "rgba(120,120,220,.8)"; cctx.fillRect(padL + 76, h - 12, 10, 3); cctx.fillStyle = "rgba(127,127,127,.8)"; cctx.fillText("总能量（去均值 ×3）", padL + 90, h - 8);
      }

      const tvalUpd = () => { tval.textContent = (+get("temp").value).toFixed(2); };
      get("temp").addEventListener("input", tvalUpd);
      get("ens").addEventListener("change", () => { msg.textContent = describe(get("ens").value); });
      el.querySelector("[data-reset]").addEventListener("click", () => { st = init(box); [fx, fy] = forces(st); st.hist = []; });

      function describe(ens) {
        return {
          nve: "NVE：能量守恒，温度由初始速度和势能交换决定，可能慢慢漂移——这正好演示为什么做恒温 MD 必须加恒温器。",
          langevin: "Langevin：每步加摩擦 + 随机力，温度稳定、实现简单，但会改变动力学（扩散系数等）。",
          nose: "Nosé–Hoover：一个额外自由度调节摩擦，能正确采样正则系综，温度会周期性振荡。",
          csvr: "CSVR：把动能拉向目标并叠加随机涨落，能正确采样正则系综，是 CP2K 的常用选项。",
        }[ens] || "";
      }
      msg.textContent = describe("langevin");
      tvalUpd();

      let last = performance.now();
      function loop(now) {
        if (!el.isConnected) return;
        if (running) {
          const ens = get("ens").value;
          const target = +get("temp").value;
          for (let s = 0; s < 3; s++) step(ens, target);
          frames++;
          if (frames % 2 === 0) { drawSim(); drawChart(ens); }
        }
        requestAnimationFrame(loop);
      }
      drawSim();
      drawChart("langevin");
      requestAnimationFrame(loop);
    },
  };
})();