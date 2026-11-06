(function () {
  window.DEMOS = window.DEMOS || {};

  // 换算因子：统一先化到基准单位
  // 能量基准: eV
  const ENERGY = [
    { u: "eV", f: 1, d: "电子伏特" },
    { u: "Hartree (a.u.)", f: 27.211386245988, d: "原子单位能量" },
    { u: "Ry", f: 13.605693122994, d: "里德伯，CUTOFF 的单位" },
    { u: "kJ/mol", f: 1 / 96.48533212, d: "摩尔能量" },
    { u: "kcal/mol", f: 1 / 23.06054887, d: "化学常用" },
    { u: "cm⁻¹", f: 1 / 8065.543937, d: "振动波数" },
    { u: "K (k_BT)", f: 8.617333262e-5, d: "热能" },
  ];
  // 长度基准: Å
  const LENGTH = [
    { u: "Å", f: 1, d: "埃" },
    { u: "Bohr (a.u.)", f: 0.529177210903, d: "原子单位长度" },
    { u: "nm", f: 10, d: "纳米" },
    { u: "pm", f: 0.01, d: "皮米" },
  ];
  // 时间基准: fs
  const TIME2 = [
    { u: "fs", f: 1, d: "飞秒，TIMESTEP 的默认单位" },
    { u: "ps", f: 1000, d: "皮秒" },
    { u: "s", f: 1e15, d: "秒" },
  ];
  // 压力基准: GPa
  const PRESSURE = [
    { u: "GPa", f: 1, d: "吉帕，CELL 压力常用" },
    { u: "bar", f: 1e-4, d: "1 GPa = 10000 bar" },
    { u: "atm", f: 1.01325e-4, d: "标准大气压" },
    { u: "Ry/Bohr³", f: 1.47105e4, d: "原子单位压力" },
  ];

  const SETS = { energy: ENERGY, length: LENGTH, time: TIME2, pressure: PRESSURE };
  const PRESETS = [
    { label: "CUTOFF 400 Ry", cat: "energy", v: 400, u: "Ry" },
    { label: "1 Hartree", cat: "energy", v: 1, u: "Hartree (a.u.)" },
    { label: "室温 300 K", cat: "energy", v: 300, u: "K (k_BT)" },
    { label: "键长 1 Å", cat: "length", v: 1, u: "Å" },
    { label: "TIMESTEP 0.5 fs", cat: "time", v: 0.5, u: "fs" },
  ];

  window.DEMOS.units = {
    title: "单位换算器",
    mount(el) {
      el.innerHTML =
        '<div class="demo-grid">' +
        '<label class="demo-field">类别<select data-k="cat"><option value="energy">能量</option><option value="length">长度</option><option value="time">时间</option><option value="pressure">压力</option></select></label>' +
        '<label class="demo-field">数值<input type="number" data-k="val" value="1" step="any"></label>' +
        '<label class="demo-field">单位<select data-k="unit"></select></label>' +
        "</div>" +
        '<div class="unit-out" data-out></div>' +
        '<div class="demo-presets" data-presets></div>' +
        '<div class="demo-note">换算基于 CODATA 常数：1 Hartree = 27.211386 eV = 2 Ry；1 Bohr = 0.529177 Å。CUTOFF / REL_CUTOFF 的默认单位是 Ry，&MD 的 TIMESTEP 默认单位是 fs。</div>';

      const get = (k) => el.querySelector('[data-k="' + k + '"]');
      const out = el.querySelector("[data-out]");
      const presets = el.querySelector("[data-presets]");

      const fillUnits = () => {
        const cat = get("cat").value;
        const sel = get("unit");
        sel.innerHTML = SETS[cat].map((x) => '<option value="' + x.u + '">' + x.u + "</option>").join("");
        paint();
      };

      const paint = () => {
        const cat = get("cat").value;
        const set = SETS[cat];
        const v = parseFloat(get("val").value);
        const unit = get("unit").value || set[0].u;
        const src = set.find((x) => x.u === unit) || set[0];
        const base = (isFinite(v) ? v : 0) * src.f;
        out.innerHTML = set
          .map((x) => {
            const val = base / x.f;
            const shown = Math.abs(val) >= 1e-3 && Math.abs(val) < 1e7 ? val.toPrecision(6) : val.toExponential(4);
            return '<div class="unit-row' + (x.u === unit ? " hit" : "") + '"><span class="u">' + x.u + '</span><span class="n">' + shown + '</span><span class="d">' + (x.d || "") + "</span></div>";
          })
          .join("");
      };

      presets.innerHTML = PRESETS.map((p, i) => '<button type="button" class="demo-chip" data-i="' + i + '">' + p.label + "</button>").join("");
      presets.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", () => {
          const p = PRESETS[+b.dataset.i];
          get("cat").value = p.cat;
          get("val").value = p.v;
          fillUnits();
          get("unit").value = p.u;
          paint();
        });
      });
      get("cat").addEventListener("change", fillUnits);
      get("unit").addEventListener("change", paint);
      get("val").addEventListener("input", paint);
      fillUnits();
    },
  };
})();