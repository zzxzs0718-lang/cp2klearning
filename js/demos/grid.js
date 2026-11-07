(function () {
  window.DEMOS = window.DEMOS || {};

  const BOHR = 0.529177210903; // Å
  const LEVEL_NAMES = ["最粗", "中粗", "较细", "最细"];

  function levelTable(cutoff, rel, ngrids, progression) {
    const rows = [];
    for (let i = 0; i < ngrids; i++) {
      const e = cutoff / Math.pow(progression, i);
      const hBohr = Math.sqrt(30 / e); // CP2K 网格间距的经验公式
      rows.push({ i, e, hBohr, hAng: hBohr * BOHR });
    }
    return rows;
  }

  // 手册: REL_CUTOFF 是“单位标准差高斯”参考网格的截断能。
  // 高斯 e^{-a r^2} 的 sigma = 1/sqrt(2a)；映射到能覆盖足够格点的最粗层。
  function mappedLevel(rows, rel, a) {
    const hRef = Math.sqrt(30 / rel);
    const sigmaRef = Math.SQRT1_2;
    const sigma = 1 / Math.sqrt(2 * a);
    const hNeed = hRef * (sigma / sigmaRef);
    // 从最粗层（h 最大）往细找：第一个“覆盖格点数不少于参考”的层
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].hBohr <= hNeed) return i;
    }
    return 0;
  }

  function svgGrid(rows, boxAng) {
    const W = 520, H = 150;
    const n = rows.length;
    const cw = W / n;
    let s = '<svg viewBox="0 0 ' + W + " " + H + '" class="gridviz" role="img" aria-label="多层网格示意">';
    rows.forEach((r, i) => {
      const x0 = i * cw + 12;
      const w = cw - 24;
      const pad = 22;
      const size = Math.min(w, H - pad * 2);
      const y0 = (H - size) / 2;
      s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-opacity=".45"/>';
      const npts = Math.max(2, Math.min(34, Math.round(boxAng / r.hAng)));
      for (let a = 0; a <= npts; a++) {
        const px = x0 + (a / npts) * size;
        const py = y0 + (a / npts) * size;
        s += '<line x1="' + px + '" y1="' + y0 + '" x2="' + px + '" y2="' + (y0 + size) + '" stroke="currentColor" stroke-opacity=".13"/>';
        s += '<line x1="' + x0 + '" y1="' + py + '" x2="' + (x0 + size) + '" y2="' + py + '" stroke="currentColor" stroke-opacity=".13"/>';
      }
      s += '<text x="' + (x0 + size / 2) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity=".7">' + r.e.toFixed(0) + " Ry · " + r.hAng.toFixed(2) + " Å</text>";
    });
    s += "</svg>";
    return s;
  }

  window.DEMOS.grid = {
    title: "多级网格与 REL_CUTOFF",
    mount(el) {
      el.innerHTML =
        '<div class="demo-grid">' +
        '<label class="demo-field">CUTOFF (Ry)<input type="number" data-k="cutoff" value="400" min="100" max="1200" step="50"></label>' +
        '<label class="demo-field">REL_CUTOFF (Ry)<input type="number" data-k="rel" value="50" min="10" max="400" step="10"></label>' +
        '<label class="demo-field">NGRIDS<input type="number" data-k="ngrids" value="4" min="1" max="4" step="1"></label>' +
        '<label class="demo-field">高斯指数 a (Bohr⁻²)<input type="range" data-k="a" value="1" min="0.05" max="6" step="0.05"><span class="demo-val" data-aval>1.00</span></label>' +
        "</div>" +
        '<div class="demo-note">手册规定：第 i 层截断能 = CUTOFF / 3<sup>i−1</sup>（PROGRESSION_FACTOR 默认 3），NGRIDS 默认 4；REL_CUTOFF 决定高斯被放到哪一层。下面的格点示意图按网格间距等比绘制。</div>' +
        '<div class="gridviz-wrap" data-viz></div>' +
        '<div class="grid-table-wrap"><table class="demo-table" data-table></table></div>' +
        '<div class="demo-note" data-msg></div>';

      const viz = el.querySelector("[data-viz]");
      const table = el.querySelector("[data-table]");
      const msg = el.querySelector("[data-msg]");
      const aval = el.querySelector("[data-aval]");
      const cutoffEl = el.querySelector('[data-k="cutoff"]');
      const relEl = el.querySelector('[data-k="rel"]');
      const ngridsEl = el.querySelector('[data-k="ngrids"]');
      const aEl = el.querySelector('[data-k="a"]');

      const paint = () => {
        const cutoff = Math.max(50, +cutoffEl.value || 400);
        const rel = Math.max(5, +relEl.value || 50);
        const ngrids = Math.min(4, Math.max(1, +ngridsEl.value || 4));
        const a = +aEl.value;
        aval.textContent = a.toFixed(2);
        const rows = levelTable(cutoff, rel, ngrids, 3);
        const hit = mappedLevel(rows, rel, a);
        viz.innerHTML = svgGrid(rows, 10);
        let html = "<thead><tr><th>层</th><th>截断能 (Ry)</th><th>间距 (Å)</th><th>10 Å 盒中的格点数</th></tr></thead><tbody>";
        rows.forEach((r, i) => {
          const npts = Math.pow(10 / r.hAng, 3);
          html += "<tr" + (i === hit ? ' class="hit"' : "") + "><td>" + (i + 1) + " · " + (LEVEL_NAMES[i] || "层" + (i + 1)) + (i === hit ? " ← 当前高斯" : "") + "</td><td>" + r.e.toFixed(1) + "</td><td>" + r.hAng.toFixed(3) + "</td><td>" + Math.round(npts).toLocaleString() + "</td></tr>";
        });
        html += "</tbody>";
        table.innerHTML = html;

        const ratio = cutoff / rel;
        const words = [];
        if (ratio < 8) words.push("CUTOFF/REL_CUTOFF 只有 " + ratio.toFixed(1) + "，所有高斯几乎落在同一层——REL_CUTOFF 偏低时，再高的 CUTOFF 也换不来更细的有效网格。");
        else if (ratio > 200) words.push("比值为 " + ratio.toFixed(0) + "，REL_CUTOFF 相对 CUTOFF 很小，宽高斯会堆在最粗层，通常把 REL_CUTOFF 提到 50–100 Ry 更划算。");
        else words.push("比值 " + ratio.toFixed(1) + "，属于常见区间：细网格积分，粗网格承载宽函数。");
        words.push("指数 a=" + a.toFixed(2) + " 的高斯 σ=" + (1 / Math.sqrt(2 * a)).toFixed(2) + " Bohr，被放到第 " + (hit + 1) + " 层（" + (LEVEL_NAMES[hit] || "") + "）。");
        if (a > 3) words.push("a 很大 = 函数很窄，只有最细网格能分辨它；这也是为什么芯电子/紧基组需要高 CUTOFF。");
        msg.textContent = words.join(" ");
      };
      el.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", paint));
      paint();
    },
  };
})();