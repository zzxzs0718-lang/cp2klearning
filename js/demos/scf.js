(function () {
  window.DEMOS = window.DEMOS || {};

  const W = 600, H = 280, L = 52, R = 14, T = 14, B = 34;
  const EXP0 = 1, EXP1 = -11; // 10^0 .. 10^-11

  function yOf(exp) {
    return T + (EXP0 - exp) / (EXP0 - EXP1) * (H - T - B);
  }
  function xOf(n, nmax) {
    return L + (n / nmax) * (W - L - R);
  }

  function simulate(kind, alpha, epsExp, hard) {
    const pts = [{ n: 0, e: 0 }];
    let e = 0;
    const nmax = 50;
    for (let n = 1; n <= nmax; n++) {
      let f;
      if (kind === "ot") f = Math.exp(-0.62);
      else if (kind === "diis") f = n <= 2 ? Math.abs(1 - alpha) : 0.42;
      else f = hard ? Math.abs(1 - alpha) * 1.08 : Math.abs(1 - alpha);
      e = e + Math.log10(f);
      pts.push({ n, e: Math.max(e, -12) });
      if (e <= epsExp) break;
    }
    return pts;
  }

  window.DEMOS.scf = {
    title: "SCF 收敛模拟器",
    mount(el) {
      el.innerHTML =
        '<div class="demo-grid">' +
        '<label class="demo-field">方法<select data-k="kind"><option value="mixing">线性混合 (MIXING)</option><option value="diis">DIIS / Broyden</option><option value="ot">OT（轨道变换）</option></select></label>' +
        '<label class="demo-field">混合系数 α<input type="range" data-k="alpha" min="0.1" max="0.9" step="0.05" value="0.4"><span class="demo-val" data-aval>0.40</span></label>' +
        '<label class="demo-field">EPS_SCF<select data-k="eps"><option value="-6">1E-6</option><option value="-7">1E-7</option><option value="-8">1E-8</option></select></label>' +
        '<label class="demo-field">体系<select data-k="hard"><option value="0">普通分子/固体</option><option value="1">近简并、金属性（难收敛）</option></select></label>' +
        "</div>" +
        '<div class="scf-chart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="SCF 残差收敛曲线" data-svg></svg></div>' +
        '<div class="demo-note" data-msg></div>' +
        '<div class="demo-note">这是一个<b>教学示意模型</b>：残差按每步固定倍率衰减，用来对比三种策略的收敛速度，不是真实的 CP2K 求解。真实计算中 DIIS 可能震荡、OT 也可能在坏初始猜测下发散。</div>';

      const svg = el.querySelector("[data-svg]");
      const msg = el.querySelector("[data-msg]");
      const aval = el.querySelector("[data-aval]");
      const kindEl = el.querySelector('[data-k="kind"]');
      const alphaEl = el.querySelector('[data-k="alpha"]');
      const epsEl = el.querySelector('[data-k="eps"]');
      const hardEl = el.querySelector('[data-k="hard"]');

      const paint = () => {
        const kind = kindEl.value;
        const alpha = +alphaEl.value;
        const epsExp = +epsEl.value;
        const hard = hardEl.value === "1";
        aval.textContent = alpha.toFixed(2);
        alphaEl.disabled = kind === "ot";
        const pts = simulate(kind, alpha, epsExp, hard);
        const last = pts[pts.length - 1];
        const conv = last.e <= epsExp;
        const nmax = Math.max(12, last.n);

        let s = "";
        for (let k = 0; k >= -11; k -= 2) {
          const y = yOf(k);
          s += '<line x1="' + L + '" y1="' + y + '" x2="' + (W - R) + '" y2="' + y + '" stroke="currentColor" stroke-opacity=".12"/>';
          s += '<text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="currentColor" fill-opacity=".65">1e' + k + "</text>";
        }
        for (let n = 0; n <= nmax; n += Math.ceil(nmax / 10)) {
          const x = xOf(n, nmax);
          s += '<line x1="' + x + '" y1="' + (H - B) + '" x2="' + x + '" y2="' + (H - B + 4) + '" stroke="currentColor" stroke-opacity=".35"/>';
          s += '<text x="' + x + '" y="' + (H - B + 18) + '" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity=".65">' + n + "</text>";
        }
        const yEps = yOf(epsExp);
        s += '<line x1="' + L + '" y1="' + yEps + '" x2="' + (W - R) + '" y2="' + yEps + '" stroke="var(--accent)" stroke-dasharray="5 4" stroke-opacity=".8"/>';
        s += '<text x="' + (W - R) + '" y="' + (yEps - 6) + '" text-anchor="end" font-size="10" fill="var(--accent)">EPS_SCF</text>';
        let d = "";
        pts.forEach((p, i) => { d += (i ? "L" : "M") + xOf(p.n, nmax).toFixed(1) + " " + yOf(p.e).toFixed(1) + " "; });
        s += '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>';
        pts.forEach((p) => { s += '<circle cx="' + xOf(p.n, nmax).toFixed(1) + '" cy="' + yOf(p.e).toFixed(1) + '" r="2.6" fill="currentColor"/>'; });
        svg.innerHTML = s;

        if (conv) {
          msg.innerHTML = "在 <b>" + last.n + " 步</b>内达到 EPS_SCF=" + "1e" + epsExp + "。";
        } else {
          msg.innerHTML = "50 步内没有收敛（残差停在 1e" + last.e.toFixed(1) + "）。" + (kind === "mixing" ? " 线性混合对难收敛体系最不稳：把 α 降到 0.2 左右再试。" : "");
        }
        if (kind === "ot") msg.innerHTML += " OT 把电子步变成直接最小化，通常 10–30 步收敛，但需要 CUTOFF 足够高，且不适合金属/小带隙体系。";
        if (kind === "diis") msg.innerHTML += " DIIS 用历史密度外推，前两步慢、之后很快，是分子体系默认的稳妥选择。";
      };
      el.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", paint));
      paint();
    },
  };
})();