(function () {
  window.DEMOS = window.DEMOS || {};

  const MOLS = {
    H2O: { name: "水 H₂O", natoms: 3, coords: [["O", 5.0, 5.0, 5.0], ["H", 5.7586, 5.0, 5.5043], ["H", 4.2414, 5.0, 5.5043]] },
    NH3: { name: "氨 NH₃", natoms: 4, coords: [["N", 5.0, 5.0, 5.0], ["H", 5.0, 5.0, 6.012], ["H", 5.812, 5.0, 4.75], ["H", 4.188, 5.0, 4.75]] },
    CH4: { name: "甲烷 CH₄", natoms: 5, coords: [["C", 5.0, 5.0, 5.0], ["H", 5.629, 5.629, 5.629], ["H", 4.371, 4.371, 5.629], ["H", 4.371, 5.629, 4.371], ["H", 5.629, 4.371, 4.371]] },
  };
  const BASES = {
    "DZVP-MOLOPT-SR-GTH": { label: "DZVP-MOLOPT-SR-GTH（常规首选）", note: "短程 MOLOPT，固体/分子都稳，性价比最高" },
    "DZVP-MOLOPT-GTH": { label: "DZVP-MOLOPT-GTH（分子常用）", note: "标准 MOLOPT，适合孤立分子" },
    "TZV2P-MOLOPT-GTH": { label: "TZV2P-MOLOPT-GTH（更贵的三ζ）", note: "三ζ双极化，做基准或高精度时用" },
  };

  function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  function build(cfg) {
    const mol = MOLS[cfg.mol];
    const lines = [];
    lines.push("&GLOBAL");
    lines.push("  PROJECT " + cfg.mol.toLowerCase());
    lines.push("  RUN_TYPE " + cfg.task);
    lines.push("&END GLOBAL");
    lines.push("");
    lines.push("&FORCE_EVAL");
    lines.push("  METHOD Quickstep");
    lines.push("  &DFT");
    lines.push("    BASIS_SET_FILE_NAME BASIS_MOLOPT");
    lines.push("    POTENTIAL_FILE_NAME GTH_POTENTIALS");
    lines.push("    &MGRID");
    lines.push("      CUTOFF " + cfg.cutoff);
    lines.push("      REL_CUTOFF " + cfg.rel);
    lines.push("    &END MGRID");
    lines.push("    &POISSON");
    lines.push("      PERIODIC NONE");
    lines.push("      PSOLVER MT");
    lines.push("    &END POISSON");
    lines.push("    &SCF");
    lines.push("      EPS_SCF 1.0E-6");
    lines.push("      MAX_SCF 50");
    lines.push("      SCF_GUESS ATOMIC");
    lines.push("    &END SCF");
    lines.push("    &XC");
    lines.push("      &XC_FUNCTIONAL " + cfg.func);
    lines.push("      &END XC_FUNCTIONAL");
    lines.push("    &END XC");
    lines.push("  &END DFT");
    lines.push("  &SUBSYS");
    lines.push("    &CELL");
    lines.push("      ABC 10.0 10.0 10.0");
    lines.push("      PERIODIC NONE");
    lines.push("    &END CELL");
    lines.push("    &COORD");
    mol.coords.forEach((c) => lines.push("      " + c[0] + "  " + c[1].toFixed(4) + "  " + c[2].toFixed(4) + "  " + c[3].toFixed(4)));
    lines.push("    &END COORD");
    const kinds = Array.from(new Set(mol.coords.map((c) => c[0])));
    kinds.forEach((el) => {
      lines.push("    &KIND " + el);
      lines.push("      BASIS_SET " + cfg.basis);
      lines.push("      POTENTIAL GTH-PBE-q" + (el === "H" ? "1" : el === "C" ? "4" : el === "N" ? "5" : "6"));
      lines.push("    &END KIND");
    });
    lines.push("  &END SUBSYS");
    if (cfg.task === "GEO_OPT" || cfg.task === "MD") {
      lines.push("  &MOTION");
      if (cfg.task === "GEO_OPT") {
        lines.push("    &GEO_OPT");
        lines.push("      OPTIMIZER BFGS");
        lines.push("      MAX_ITER 200");
        lines.push("    &END GEO_OPT");
      } else {
        lines.push("    &MD");
        lines.push("      ENSEMBLE NVT");
        lines.push("      STEPS 500");
        lines.push("      TIMESTEP 0.5");
        lines.push("      TEMPERATURE 300");
        lines.push("      &THERMOSTAT");
        lines.push("        TYPE NOSE");
        lines.push("      &END THERMOSTAT");
        lines.push("    &END MD");
      }
      lines.push("  &END MOTION");
    }
    lines.push("&END FORCE_EVAL");
    return lines.join("\n");
  }

  window.DEMOS.inputbuilder = {
    title: "输入文件生成器",
    mount(el) {
      const cfg = { task: "ENERGY", mol: "H2O", func: "PBE", basis: "DZVP-MOLOPT-SR-GTH", cutoff: 400, rel: 50 };
      el.innerHTML =
        '<div class="demo-grid">' +
        '<label class="demo-field">任务类型<select data-k="task"><option>ENERGY</option><option>GEO_OPT</option><option>MD</option></select></label>' +
        '<label class="demo-field">分子<select data-k="mol">' + Object.keys(MOLS).map((k) => '<option value="' + k + '">' + MOLS[k].name + "</option>").join("") + "</select></label>" +
        '<label class="demo-field">交换关联泛函<select data-k="func"><option>PBE</option><option>BLYP</option><option>TPSS</option></select></label>' +
        '<label class="demo-field">基组<select data-k="basis">' + Object.keys(BASES).map((k) => '<option value="' + k + '">' + BASES[k].label + "</option>").join("") + "</select></label>" +
        '<label class="demo-field">CUTOFF (Ry)<input type="number" data-k="cutoff" value="400" min="100" max="1200" step="50"></label>' +
        '<label class="demo-field">REL_CUTOFF (Ry)<input type="number" data-k="rel" value="50" min="20" max="200" step="10"></label>' +
        "</div>" +
        '<div class="demo-note" data-note></div>' +
        '<div class="code" style="margin-top:12px"><div class="code-head"><span class="lang">cp2k</span><span class="file">生成结果</span><span class="spacer"></span><button class="copy-btn" type="button" data-copy>复制</button></div><pre><code data-out></code></pre></div>' +
        '<div class="demo-note">生成的是<b>可直接运行</b>的骨架：把基组/赝势文件放到工作目录或设置 <code>CP2K_DATA_DIR</code>。混合泛函需要额外的 &HF 设置，这里没有列出。</div>';

      const out = el.querySelector("[data-out]");
      const note = el.querySelector("[data-note]");
      const paint = () => {
        out.textContent = build(cfg);
        const desc = [];
        desc.push("基组：" + BASES[cfg.basis].note + "。");
        desc.push(cfg.task === "ENERGY" ? "只算单点能，几秒到几分钟。" : cfg.task === "GEO_OPT" ? "会优化原子位置，输出里看每一步的 max force。" : "NVT 分子动力学，500 步 × 0.5 fs = 250 fs。");
        if (cfg.func === "TPSS") desc.push("TPSS 是 meta-GGA，成本高于 PBE，但通常更准。");
        note.textContent = desc.join(" ");
      };
      el.querySelectorAll("[data-k]").forEach((inp) => {
        inp.addEventListener("input", () => {
          const key = inp.dataset.k;
          cfg[key] = key === "cutoff" || key === "rel" ? +inp.value : inp.value;
          paint();
        });
      });
      const btn = el.querySelector("[data-copy]");
      btn.addEventListener("click", () => {
        const text = out.textContent;
        const done = () => { btn.textContent = "已复制"; btn.classList.add("ok"); setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("ok"); }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(done);
        else done();
      });
      paint();
    },
  };
})();