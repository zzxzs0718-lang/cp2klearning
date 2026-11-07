/* ==========================================================================
   CP2K 学习手册 — 应用逻辑
   纯前端、离线、hash 路由。依赖 window.CONTENT / window.DEMOS
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- 基础工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const CHAPTERS = Object.values(window.CONTENT || {}).sort((a, b) => a.num - b.num);
  const PARTS = ["起步", "输入与体系", "电子结构", "结构与振动", "动力学与自由能", "分析与实战"];
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const state = {
    theme: store.get("cp2k.theme", null) || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    visited: store.get("cp2k.visited", {}),
    quiz: store.get("cp2k.quiz", {}),
    route: { path: "", anchor: "" },
    manual: null,
    keywords: null,
    kwLoading: false,
  };
  const CHAPTER_IDS = new Set(CHAPTERS.map((c) => c.id));
  const CHAPTER_INDEX = new Map(CHAPTERS.map((c, i) => [c.id, i]));
  function countDone() {
    let n = 0;
    Object.keys(state.visited).forEach((k) => { if (CHAPTER_IDS.has(k)) n++; });
    return n;
  }

  /* ---------------- 行内格式 ---------------- */
  const GREEK = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
    theta: "θ", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
    tau: "τ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Sigma: "Σ", Omega: "Ω",
    hbar: "ℏ", partial: "∂", nabla: "∇", infty: "∞", pm: "±", times: "×", cdot: "·", approx: "≈",
    sim: "∼", leq: "≤", geq: "≥", neq: "≠", rightarrow: "→", to: "→", leftarrow: "←", sum: "∑", int: "∫",
  };
  const CALLOUT_ICONS = { tip: "💡", warn: "⚠️", danger: "⛔", info: "ℹ️", key: "🔑" };

  function texify(src) {
    let s = String(src);
    // \frac{a}{b}（允许简单嵌套）
    for (let i = 0; i < 6; i++) {
      const next = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '<span class="fr"><span class="nu">$1</span><span class="de">$2</span></span>');
      if (next === s) break;
      s = next;
    }
    s = s.replace(/\\mathrm\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\mathbf\s*\{([^{}]*)\}/g, "<b>$1</b>")
      .replace(/\\([A-Za-z]+)/g, (m, g) => GREEK[g] || g)
      .replace(/\^\{([^{}]*)\}/g, "<sup>$1</sup>")
      .replace(/_\{([^{}]*)\}/g, "<sub>$1</sub>")
      .replace(/\^([A-Za-z0-9+\-])/g, "<sup>$1</sup>")
      .replace(/_([A-Za-z0-9+\-])/g, "<sub>$1</sub>")
      .replace(/\\[,;! ]/g, " ")
      .replace(/[{}]/g, "");
    return s;
  }

  function fmt(text) {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/==([^=]+)==/g, '<mark class="hl">$1</mark>');
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    s = s.replace(/\$([^$]+)\$/g, (m, g) => "<span class=\"math\">" + texify(g) + "</span>");
    return s;
  }

  /* ---------------- 代码高亮 ---------------- */
  function hlValues(rest) {
    const parts = rest.split(/(#.*$)/);
    let code = esc(parts[0]);
    code = code.replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="tok-num">$1</span>');
    code = code.replace(/(&quot;[^&]*?&quot;)/g, '<span class="tok-str">$1</span>');
    if (parts[1]) code += '<span class="tok-com">' + esc(parts[1]) + "</span>";
    return code;
  }

  function hlCp2k(src) {
    return String(src).split("\n").map((line) => {
      let m = line.match(/^(\s*)(&[A-Za-z_][A-Za-z0-9_]*)(.*)$/);
      if (m) return esc(m[1]) + '<span class="tok-sec">' + esc(m[2]) + "</span>" + hlValues(m[3]);
      if (/^\s*#/.test(line)) return '<span class="tok-com">' + esc(line) + "</span>";
      m = line.match(/^(\s*)([A-Z][A-Z0-9_\-]*)(.*)$/);
      if (m) return esc(m[1]) + '<span class="tok-key">' + esc(m[2]) + "</span>" + hlValues(m[3]);
      return hlValues(line);
    }).join("\n");
  }

  function hlBash(src) {
    return String(src).split("\n").map((line) => {
      if (/^\s*#/.test(line)) return '<span class="tok-com">' + esc(line) + "</span>";
      const m = line.match(/^(\s*)([\w.\/\[\]~$-]+)(.*)$/);
      if (!m) return esc(line);
      let out = esc(m[1]);
      if (/^(mpirun|mpiexec|cp2k|srun|sbatch|export|cd|python3?|tar|wget|curl|module|source|make|cmake|\.\/)/.test(m[2])) {
        out += '<span class="tok-cmd">' + esc(m[2]) + "</span>";
      } else out += esc(m[2]);
      return out + hlValues(m[3]);
    }).join("\n");
  }

  function highlight(code, lang) {
    if (lang === "cp2k" || lang === "inp") return hlCp2k(code);
    if (lang === "bash" || lang === "sh" || lang === "shell") return hlBash(code);
    if (lang === "python" || lang === "py") return hlBash(code);
    return esc(code);
  }

  /* ---------------- 块渲染 ---------------- */
  function renderBlocks(blocks) {
    return (blocks || []).map(renderBlock).join("");
  }

  function renderBlock(b) {
    if (!b || !b.type) return "";
    switch (b.type) {
      case "p": return '<p>' + fmt(b.text) + "</p>";
      case "h3": return "<h3>" + fmt(b.text) + "</h3>";
      case "list": {
        const tag = b.ordered ? "ol" : "ul";
        return "<" + tag + ">" + (b.items || []).map((i) => "<li>" + fmt(i) + "</li>").join("") + "</" + tag + ">";
      }
      case "code": {
        const code = Array.isArray(b.text) ? b.text.join("\n") : String(b.text || "");
        return '<div class="code">' +
          '<div class="code-head"><span class="lang">' + esc(b.lang || "text") + "</span>" +
          (b.title ? '<span class="file">' + esc(b.title) + "</span>" : "") +
          '<span class="spacer"></span><button class="copy-btn" type="button">复制</button></div>' +
          "<pre><code>" + highlight(code, b.lang) + "</code></pre>" +
          (b.note ? '<div class="code-note">' + fmt(b.note) + "</div>" : "") +
          "</div>";
      }
      case "callout": {
        return '<div class="callout ' + esc(b.kind || "info") + '"><span class="ci">' + (CALLOUT_ICONS[b.kind] || "ℹ️") + "</span>" +
          (b.title ? '<b class="t">' + fmt(b.title) + "</b>" : "") + "<p>" + fmt(b.text) + "</p></div>";
      }
      case "table": {
        const head = (b.head || []).map((h) => "<th>" + fmt(h) + "</th>").join("");
        const rows = (b.rows || []).map((r) => "<tr>" + r.map((c) => "<td>" + fmt(c) + "</td>").join("") + "</tr>").join("");
        return '<div class="table-wrap"><table class="tbl">' +
          (b.caption ? "<caption>" + fmt(b.caption) + "</caption>" : "") +
          "<thead><tr>" + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
      }
      case "key":
        return '<div class="keys">' + (b.items || []).map((i) =>
          '<div class="keycard"><span class="k">' + esc(i.k) + '</span><span class="v">' + fmt(i.v) + "</span>" +
          (i.tag ? '<span class="tag">' + esc(i.tag) + "</span>" : "") + "</div>").join("") + "</div>";
      case "keypoints":
        return '<div class="keypoints"><h4>本节小结</h4><ul>' + (b.items || []).map((i) => "<li>" + fmt(i) + "</li>").join("") + "</ul></div>";
      case "steps":
        return '<ol class="steps">' + (b.items || []).map((i) =>
          "<li><b>" + fmt(i.t) + "</b><span>" + fmt(i.d || "") + "</span></li>").join("") + "</ol>";
      case "compare":
        return '<div class="compare">' +
          '<div class="good"><h4>' + fmt((b.left || {}).title || "") + "</h4><ul>" + ((b.left || {}).items || []).map((i) => "<li>" + fmt(i) + "</li>").join("") + "</ul></div>" +
          '<div class="bad"><h4>' + fmt((b.right || {}).title || "") + "</h4><ul>" + ((b.right || {}).items || []).map((i) => "<li>" + fmt(i) + "</li>").join("") + "</ul></div></div>";
      case "quote":
        return '<blockquote class="quote">' + fmt(b.text) + (b.who ? '<span class="who">— ' + fmt(b.who) + "</span>" : "") + "</blockquote>";
      case "formula":
        return '<div class="formula">' + texify(esc(b.tex || "")) + (b.caption ? '<div class="cap">' + fmt(b.caption) + "</div>" : "") + "</div>";
      case "figure":
        return '<figure class="fig">' + (b.svg || "") + (b.caption ? "<figcaption>" + fmt(b.caption) + "</figcaption>" : "") + "</figure>";
      case "demo":
        return '<div class="demo" data-demo="' + esc(b.id) + '">' +
          '<div class="demo-head"><span class="badge">交互演示</span><div><h4>' + fmt(b.title || (window.DEMOS && window.DEMOS[b.id] && window.DEMOS[b.id].title) || "演示") + "</h4>" +
          (b.desc ? "<p>" + fmt(b.desc) + "</p>" : "") + '</div></div><div class="demo-body"></div></div>';
      default:
        return "";
    }
  }

  /* ---------------- 侧栏 ---------------- */
  function renderSidebar() {
    const groups = PARTS.map((p) => ({ p, list: CHAPTERS.filter((c) => c.part === p) })).filter((g) => g.list.length);
    let html = '<div class="side-group"><div class="side-label">开始</div>' +
      '<a class="side-link" href="#/"><span class="n">◈</span><span>首页 · 学习路线</span></a></div>';
    groups.forEach((g) => {
      html += '<div class="side-group"><div class="side-label">' + esc(g.p) + "</div>";
      g.list.forEach((c) => {
        html += '<a class="side-link" data-ch="' + esc(c.id) + '" href="#/' + esc(c.id) + '">' +
          '<span class="n">' + String(c.num).padStart(2, "0") + "</span><span>" + esc(c.title) + "</span>" +
          '<span class="tick">●</span></a>';
      });
      html += "</div>";
    });
    html += '<div class="side-group"><div class="side-label">附录</div>' +
      '<a class="side-link" data-page="reference" href="#/reference"><span class="n">A</span><span>关键词速查</span></a>' +
      '<a class="side-link" data-page="map" href="#/map"><span class="n">B</span><span>手册地图</span></a>' +
      '<a class="side-link" data-page="units" href="#/units"><span class="n">C</span><span>单位与常数</span></a>' +
      '<a class="side-link" data-page="glossary" href="#/glossary"><span class="n">D</span><span>术语表</span></a>' +
      '<a class="side-link" data-page="tools" href="#/tools"><span class="n">E</span><span>工具箱</span></a>' +
      '<a class="side-link" data-page="scripts" href="#/scripts"><span class="n">F</span><span>脚本与样本</span></a></div>';
    const total = CHAPTERS.length || 21;
    const done = countDone();
    html += '<div class="side-progress"><div class="sp-top"><span>学习进度</span><span>' + done + " / " + total + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round((done / total) * 100) + '%"></i></div></div>';
    $("#sidebar").innerHTML = html;
  }

  function markSidebar() {
    $$("#sidebar .side-link").forEach((a) => {
      a.classList.toggle("on", state.route.path === (a.dataset.ch || a.dataset.page || "home") || (state.route.path === "" && a.getAttribute("href") === "#/"));
      const ch = a.dataset.ch;
      if (ch) a.classList.toggle("done", !!state.visited[ch]);
    });
  }

  /* ---------------- 章节视图 ---------------- */
  function chapterHTML(c) {
    const main = CHAPTER_INDEX.get(c.id);
    const prev = CHAPTERS[main - 1], next = CHAPTERS[main + 1];
    const sections = c.sections || [];
    let h = '<article class="chapter">';
    h += '<header class="chapter-head"><div class="part">' + esc(c.part) + " · 第 " + c.num + " 章</div>" +
      '<div class="chapter-num-bg">' + String(c.num).padStart(2, "0") + "</div>" +
      "<h1>" + esc(c.title) + "</h1><p class=\"sub\">" + fmt(c.subtitle || "") + "</p>" +
      '<div class="chapter-meta"><span>⏱ 约 ' + (c.hours || 1) + " 小时</span><span>📚 " + sections.length + " 节</span>" +
      "<span>🎯 " + esc(c.level || "入门") + "</span></div></header>";
    if (c.goals && c.goals.length) {
      h += '<div class="goals"><h2>学完这一章，你会</h2><ul>' + c.goals.map((g) => "<li>" + fmt(g) + "</li>").join("") + "</ul></div>";
    }
    h += '<div class="chapter-layout"><div class="chapter-body">';
    sections.forEach((s, i) => {
      h += '<section class="sec" id="' + esc(s.id.replace(/\./g, "-")) + '" data-sec="' + esc(s.id) + '">' +
        '<h2><span class="sn">' + esc(s.id) + "</span>" + fmt(s.title) + "</h2>" + renderBlocks(s.blocks) + "</section>";
    });
    if (c.quiz && c.quiz.length) {
      h += '<div class="quiz" id="quiz"><h2>自测：' + esc(c.title) + '</h2><p class="qsub">点击选项立即判分，不记录分数。</p>';
      c.quiz.forEach((q, i) => {
        h += '<div class="q" data-q="' + i + '"><div class="qt"><span class="qn">Q' + (i + 1) + "</span>" + fmt(q.q) + '</div><div class="opts">';
        (q.options || []).forEach((o, j) => {
          h += '<button class="opt" type="button" data-opt="' + j + '">' + String.fromCharCode(65 + j) + ". " + fmt(o) + "</button>";
        });
        h += '</div><div class="explain">' + fmt(q.explain || "") + "</div></div>";
      });
      h += '<div class="quiz-score"></div></div>';
    }
    if (c.terms && c.terms.length) {
      h += '<div class="terms"><h2>本章术语</h2><div class="term-grid">' + c.terms.map((t) =>
        '<div class="term-item"><b>' + esc(t.t) + '</b><span class="en">' + esc(t.en || "") + "</span><p>" + fmt(t.d) + "</p></div>").join("") + "</div></div>";
    }
    if (c.sources && c.sources.length) {
      h += '<div class="sources"><h2>手册来源</h2><ul>' + c.sources.map((s) =>
        '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a><span class="ext">manual.cp2k.org ↗</span></li>').join("") + "</ul></div>";
    }
    h += '<nav class="pager">';
    h += prev ? '<a href="#/' + prev.id + '"><div class="dir">← 上一章</div><div class="ttl">' + esc(prev.title) + "</div></a>" : "<span></span>";
    h += next ? '<a class="next" href="#/' + next.id + '"><div class="dir">下一章 →</div><div class="ttl">' + esc(next.title) + "</div></a>" : "<span></span>";
    h += "</nav></div>";
    h += '<aside class="toc"><h2>本章目录</h2>' + sections.map((s) =>
      '<a href="#/' + c.id + "/" + s.id.replace(/\./g, "-") + '" data-toc="' + esc(s.id) + '">' + esc(s.id) + " " + esc(s.title) + "</a>").join("") + "</aside>";
    h += "</div></article>";
    return h;
  }

  function initChapter(c) {
    state.visited[c.id] = Date.now();
    store.set("cp2k.visited", state.visited);
    renderSidebar();
    // TOC 高亮
    const links = $$(".toc a");
    const secs = $$(".sec");
    if ("IntersectionObserver" in window && secs.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.toggle("on", l.dataset.toc === e.target.dataset.sec));
          }
        });
      }, { rootMargin: "-90px 0px -70% 0px", threshold: 0 });
      secs.forEach((s) => io.observe(s));
    }
    // 测验
    const qEls = $$(".q");
    qEls.forEach((q) => {
      const idx = +q.dataset.q;
      const data = c.quiz[idx];
      q.addEventListener("click", (e) => {
        const btn = e.target.closest(".opt");
        if (!btn || q.classList.contains("answered")) return;
        const pick = +btn.dataset.opt;
        q.classList.add("answered");
        $$(".opt", q).forEach((b) => {
          const j = +b.dataset.opt;
          if (j === data.answer) b.classList.add("right");
          else if (j === pick) b.classList.add("wrong");
        });
        const total = c.quiz.length;
        let answered = 0, right = 0;
        qEls.forEach((el) => {
          if (!el.classList.contains("answered")) return;
          answered++;
          if (el.querySelector(".opt.right") && !el.querySelector(".opt.wrong")) right++;
        });
        const quizScore = $(".quiz-score");
        if (quizScore) quizScore.textContent = "已答 " + answered + "/" + total + " 题 · 答对 " + right + " 题" + (answered === total ? (right === total ? " · 全对，可以进入下一章了。" : " · 回看错题所在小节。") : "");
      });
    });
    // 演示挂载
    $$("[data-demo]").forEach((el) => {
      const id = el.dataset.demo;
      const d = window.DEMOS && window.DEMOS[id];
      const body = $(".demo-body", el);
      if (d && d.mount && body) {
        try { d.mount(body); } catch (err) {
          body.innerHTML = '<div class="empty">演示加载失败：' + esc(err.message) + "</div>";
          console.error(err);
        }
      } else if (body) {
        body.innerHTML = '<div class="empty">演示「' + esc(id) + '」尚未加载。</div>';
      }
    });
  }

  /* ---------------- 首页 ---------------- */
  function heroCode() {
    return [
      "&GLOBAL",
      "  PROJECT h2o",
      "  RUN_TYPE ENERGY_FORCE",
      "&END GLOBAL",
      "",
      "&FORCE_EVAL",
      "  METHOD Quickstep",
      "  &DFT",
      "    BASIS_SET_FILE_NAME BASIS_MOLOPT",
      "    POTENTIAL_FILE_NAME GTH_POTENTIALS",
      "    &MGRID",
      "      CUTOFF 400",
      "      REL_CUTOFF 50",
      "    &END MGRID",
      "    &SCF",
      "      EPS_SCF 1.0E-6",
      "      MAX_SCF 50",
      "    &END SCF",
      "    &XC",
      "      &XC_FUNCTIONAL PBE",
      "      &END XC_FUNCTIONAL",
      "    &END XC",
      "  &END DFT",
      "  &SUBSYS",
      "    &CELL",
      "      ABC 10.0 10.0 10.0",
      "      PERIODIC NONE",
      "    &END CELL",
      "    &COORD",
      "      O  5.0000  5.0000  5.0000",
      "      H  5.7586  5.0000  5.5043",
      "      H  4.2414  5.0000  5.5043",
      "    &END COORD",
      "  &END SUBSYS",
      "&END FORCE_EVAL",
    ].join("\n");
  }

  function homeHTML() {
    const done = countDone();
    const secCount = CHAPTERS.reduce((n, c) => n + (c.sections || []).length, 0);
    const pages = (window.STATS && window.STATS.pages) || 3093;
    const kws = (window.STATS && window.STATS.keywords) || "4000+";
    const heroSource = hlCp2k(heroCode());
    const parts = PARTS.map((p) => {
      const list = CHAPTERS.filter((c) => c.part === p);
      return list.length ? { p, list } : null;
    }).filter(Boolean);

    let h = '<div class="hero"><div class="hero-inner"><div class="hero-copy">';
    h += '<span class="eyebrow">CP2K 中文实战教程 · 非官方</span>';
    h += "<h1>从第一行输入文件，<br>到<em>跑得动</em>的科研计算</h1>";
    h += '<p class="lead">以《AIMD 与 CP2K》课程讲义为主线、官方手册（trunk，' + pages + ' 页）为参数依据：' + CHAPTERS.length + ' 章课程、交互式输入生成器、' + kws + ' 关键词速查。全部离线可用，双击即读。</p>';
    h += '<div class="hero-cta"><a class="btn btn-primary" href="#/ch01">从第 1 章开始 →</a>' +
      '<a class="btn btn-ghost" href="#/reference">关键词速查</a></div>';
    h += '<div class="hero-meta"><span><b>' + CHAPTERS.length + "</b>章</span><span><b>" + secCount + "</b>节</span><span><b>5</b>个交互工具</span><span><b>" + pages + "</b>页手册索引</span></div>";
    h += '</div><div class="hero-visual"><div class="term-card"><div class="term-bar"><i></i><i></i><i></i><span>h2o.inp — 第一个 CP2K 计算</span></div>';
    h += '<div class="term-body">' + heroSource + "</div></div>";
    h += '<div class="term-note"><b>cp2k.psmp</b><span>−o h2o.out</span><span style="color:var(--ok)">✓ 完成</span></div>';
    h += '</div></div></div>';

    h += '<div class="section-wrap"><section class="home-block"><div class="stat-grid">';
    h += '<div class="stat"><b>' + CHAPTERS.length + '</b><span>主线章节</span><small>从原理到发表级工作流</small></div>';
    h += '<div class="stat"><b>' + secCount + '</b><span>教学小节</span><small>每节配可运行示例</small></div>';
    h += '<div class="stat"><b>' + pages + '</b><span>手册页面索引</span><small>官方手册全量映射</small></div>';
    h += '<div class="stat"><b>' + kws + '</b><span>CP2K 关键词</span><small>含类型、默认值、说明</small></div>';
    h += "</div></section>";

    h += '<section class="home-block"><div class="block-head"><div><h2>学习路线</h2><p>六段式：从原理与方法版图，到输入、电子结构、振动、动力学，最后做分析与发布。</p></div></div><div class="path">';
    const stages = [
      { s: "STAGE 01", t: "原理与装好", d: "CP2K 能做什么、AIMD 在算什么、怎么装起来跑通。", c: ["ch01", "ch02", "ch03"] },
      { s: "STAGE 02", t: "输入与体系", d: "输入文件四层结构、基组赝势坐标、建模与网格精度。", c: ["ch04", "ch05", "ch06"] },
      { s: "STAGE 03", t: "电子结构", d: "泛函、色散、DFT+U、磁性、杂化，以及 OT 与对角化。", c: ["ch07", "ch08"] },
      { s: "STAGE 04", t: "结构与振动", d: "几何/晶胞优化、过渡态、频率与 TRAVIS 光谱。", c: ["ch09", "ch10"] },
      { s: "STAGE 05", t: "动力学与自由能", d: "AIMD 实战、恒温器与续算，增强采样与自由能面。", c: ["ch11", "ch12"] },
      { s: "STAGE 06", t: "分析与发布", d: "轨迹/电子结构分析、表面+水与 QM/MM 案例、发表级工作流。", c: ["ch13", "ch14", "ch15"] },
    ];
    stages.forEach((st) => {
      h += '<div class="path-card"><div class="stage">' + st.s + "</div><h3>" + st.t + "</h3><p>" + st.d + '</p><div class="chips">' +
        st.c.map((id) => { const c = CHAPTERS.find((x) => x.id === id); return c ? '<a class="chip" href="#/' + id + '">' + esc(c.title) + "</a>" : ""; }).join("") + "</div></div>";
    });
    h += "</div></section>";

    h += '<section class="home-block"><div class="block-head"><div><h2>不只是文字教程</h2><p>能动手的地方，都做成了演示。</p></div><a class="more" href="#/tools">全部工具 →</a></div><div class="feature-grid">';
    const feats = [
      { i: "⌨", t: "输入文件生成器", d: "选体系、方法、任务，实时生成合法 CP2K 输入，附带逐行解释。", u: "#/tools" },
      { i: "▦", t: "CUTOFF 网格演示", d: "拖动截断能与相对截断能，看多网格如何分配、哪些函数被投到哪层。", u: "#/tools" },
      { i: "∿", t: "SCF 收敛模拟", d: "切换 DIIS、混合参数和 OT，观察密度残差怎样收敛或发散。", u: "#/tools" },
      { i: "≈", t: "MD 恒温器演示", d: "NVE/NVT、Langevin、Nosé–Hoover，看温度与能量曲线怎么变。", u: "#/tools" },
      { i: "⇄", t: "单位换算器", d: "Hartree、eV、kcal/mol、Å、Bohr、fs 之间即时换算。", u: "#/units" },
      { i: "🔎", t: "全量关键词速查", d: "官方手册里的每一个输入关键词，带类型、默认值和一句话说明。", u: "#/reference" },
    ];
    feats.forEach((f) => {
      h += '<a class="feature" href="' + f.u + '"><div class="ic">' + f.i + "</div><h3>" + f.t + "</h3><p>" + f.d + '</p><span class="go">打开 →</span></a>';
    });
    h += "</div></section>";

    h += '<section class="home-block"><div class="quickstart"><div><h3>5 分钟跑通第一个计算</h3><p>假设你已经有可用的 cp2k.psmp。没有？先看第 3 章。</p><ol class="qs-steps">' +
      "<li>新建目录，把右侧输入存为 <code>h2o.inp</code>。</li>" +
      "<li>运行 <code>cp2k.psmp -i h2o.inp -o h2o.out</code>。</li>" +
      "<li>在 <code>h2o.out</code> 里搜 <code>ENERGY|</code>。</li>" +
      "<li>读第 4 章，弄懂每一行在做什么。</li></ol></div>";
    h += '<div class="code"><div class="code-head"><span class="lang">cp2k</span><span class="file">h2o.inp</span><span class="spacer"></span><button class="copy-btn" type="button">复制</button></div><pre><code>' + heroSource + "</code></pre></div>";
    h += "</div></section>";

    h += '<section class="home-block"><div class="home-cta"><h2>准备好把 CP2K 用起来了吗？</h2><p>已有进度：' + done + "/" + (CHAPTERS.length || 21) + ' 章。建议从「认识 CP2K」开始，按顺序推进。</p><div class="hero-cta" style="justify-content:center"><a class="btn btn-primary" href="#/ch01">从第 1 章开始</a><a class="btn btn-ghost" href="#/map">先看手册地图</a></div></div></section>';
    h += "</div>";
    return h;
  }

  /* ---------------- 附录页 ---------------- */
  function pageHead(title, desc) {
    return '<div class="page-head"><h1>' + esc(title) + "</h1><p>" + desc + "</p></div>";
  }

  function referenceHTML() {
    return pageHead("CP2K 关键词速查", "官方手册 Input Reference 的全量关键词，带类型、默认值与说明。共 " + ((window.STATS && window.STATS.keywords) || "数千") + " 条，输入即筛选。") +
      '<div class="toolbar"><input type="search" id="refq" placeholder="输入关键词，如 CUTOFF、EPS_SCF、MD、BASIS_SET…" autocomplete="off">' +
      '<select id="refpage"><option value="">全部章节</option></select>' +
      '<span class="count" id="refcount"></span></div><div class="ref-results" id="refres"></div>';
  }

  function initReference() {
    const q = $("#refq"), sel = $("#refpage"), box = $("#refres"), cnt = $("#refcount");
    if (!q) return;
    const ensure = () => {
      if (state.keywords) { fill(); return; }
      box.innerHTML = '<div class="empty">正在载入关键词数据（首次约 1–2 秒）…</div>';
      loadKeywords(() => { fill(); });
    };
    let shown = 120;
    let items = [];
    function fill() {
      const all = state.keywords || [];
      items = all.map((k) => ({
        k,
        page: k.page,
        name: k.name.toLowerCase(),
        hay: (k.name + " " + k.path + " " + (k.desc || "")).toLowerCase(),
      }));
      const pages = Array.from(new Set(all.map((k) => k.page))).sort();
      sel.innerHTML = '<option value="">全部章节（' + pages.length + "）</option>" + pages.map((p) => '<option value="' + esc(p) + '">' + esc(p) + "</option>").join("");
      render();
      q.addEventListener("input", () => { shown = 120; render(); });
      sel.addEventListener("change", () => { shown = 120; render(); });
    }
    function render() {
      const term = (q.value || "").trim().toLowerCase();
      const page = sel.value;
      let list = items;
      if (page) list = list.filter((x) => x.page === page);
      if (term) {
        list = list.filter((x) => x.hay.includes(term));
        list.sort((a, b) => (a.name.startsWith(term) ? 0 : 1) - (b.name.startsWith(term) ? 0 : 1));
      }
      cnt.textContent = list.length + " 条";
      if (!list.length) { box.innerHTML = '<div class="empty">没有匹配的关键词。</div>'; return; }
      const slice = list.slice(0, shown);
      box.innerHTML = slice.map(({ k }) =>
        '<div class="ref-row"><div class="rh"><span class="rk">' + esc(k.name) + "</span>" +
        '<span class="rp">' + esc(k.path) + "</span>" + (k.type ? '<span class="rt">' + esc(k.type) + "</span>" : "") + "</div>" +
        (k.desc ? '<div class="rd">' + fmt(k.desc).slice(0, 600) + "</div>" : "") +
        (k.def ? '<div class="rv">默认：' + esc(k.def) + (k.values && k.values.length ? " · 取值：" + esc(k.values.slice(0, 8).join(" | ")) : "") + "</div>" : "") +
        "</div>").join("") +
        (list.length > shown ? '<div class="ref-more"><button class="btn btn-ghost" id="refmore">再显示 120 条（还有 ' + (list.length - shown) + " 条）</button></div>" : "");
      const more = $("#refmore");
      if (more) more.addEventListener("click", () => { shown += 120; render(); });
    }
    ensure();
  }

  function mapHTML() {
    return pageHead("手册地图", "CP2K 官方手册（trunk）全部 " + ((window.STATS && window.STATS.pages) || 3093) + " 个页面，按章节归类。点标题直达官网原文——本站内容也都能在这里找到出处。") +
      '<div class="toolbar"><input type="search" id="mapq" placeholder="筛选页面标题或路径…" autocomplete="off"><span class="count" id="mapcount"></span></div><div id="mapbox"></div>';
  }

  function initMap() {
    const box = $("#mapbox"), q = $("#mapq"), cnt = $("#mapcount");
    if (!box) return;
    let items = [];
    const indexManual = () => {
      items = (state.manual || []).map((m) => {
        const parts = m.doc.split("/");
        return { m, g0: parts[0], g1: parts[1] || "", hay: (m.title + " " + m.doc).toLowerCase() };
      });
    };
    const paint = () => {
      const term = (q.value || "").trim().toLowerCase();
      const list = term ? items.filter((x) => x.hay.includes(term)) : items;
      cnt.textContent = list.length + " 页";
      const groups = new Map();
      list.forEach(({ m, g0, g1 }) => {
        let g = g0;
        if (g === "CP2K_INPUT") g = "CP2K_INPUT / " + g1;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(m);
      });
      const order = ["getting-started", "methods", "technologies", "development", "CP2K_INPUT", "releases"];
      const keys = Array.from(groups.keys()).sort((a, b) => {
        const ia = order.findIndex((o) => a.startsWith(o)), ib = order.findIndex((o) => b.startsWith(o));
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      });
      box.innerHTML = keys.map((g) => {
        const items = groups.get(g);
        return '<details class="map-group"' + (keys.length <= 4 ? " open" : "") + '><summary><span>' + esc(g) + '</span><span class="cnt">' + items.length + ' 页</span></summary><div class="map-links">' +
          items.map((m) => '<a href="https://manual.cp2k.org/trunk/' + esc(m.doc) + '.html" target="_blank" rel="noopener" title="' + esc(m.doc) + '">' + esc(m.title) + '</a>').join("") + "</div></details>";
      }).join("") || '<div class="empty">没有匹配的页面。</div>';
    };
    const ensure = () => {
      if (state.manual) { indexManual(); paint(); return; }
      box.innerHTML = '<div class="empty">正在载入手册索引…</div>';
      loadScript("js/data/manual.js", () => { state.manual = window.MANUAL || []; indexManual(); paint(); });
    };
    ensure();
    if (q) q.addEventListener("input", paint);
  }

  /* ---------------- 单位 ---------------- */
  const UNITS = [
    { name: "能量", base: "Hartree", units: [
      ["Hartree (Eh)", 1], ["eV", 27.211386245988], ["kcal/mol", 627.5094740631], ["kJ/mol", 2625.4996394799],
      ["cm⁻¹", 219474.6313705], ["Ry", 2], ["K (kB·T)", 315775.02480407],
    ] },
    { name: "长度", base: "Bohr", units: [
      ["Bohr (a₀)", 1], ["Ångström (Å)", 0.529177210903], ["nm", 0.0529177210903], ["pm", 52.9177210903],
    ] },
    { name: "时间", base: "fs", units: [
      ["fs", 1], ["ps", 1e-3], ["ns", 1e-6], ["原子时间 (a.u.)", 0.02418884326505],
    ] },
    { name: "质量", base: "amu", units: [
      ["amu (u)", 1], ["电子质量 (mₑ)", 1822.888486209], ["kg", 1.66053906660e-27],
    ] },
    { name: "压力", base: "GPa", units: [
      ["GPa", 1], ["bar", 0.01], ["atm", 0.000101325], ["MPa", 0.001],
    ] },
  ];
  const CONSTS = [
    ["Hartree", "27.211386 eV", "原子单位能量"],
    ["Bohr", "0.529177 Å", "原子单位长度"],
    ["原子时间", "0.0241888 fs", "ℏ/Eh"],
    ["kB", "3.1668116×10⁻⁶ Eh/K", "玻尔兹曼常数"],
    ["300 K", "0.025852 eV", "室温热能 kBT"],
    ["1 eV", "23.0605 kcal/mol", "能量换算"],
  ];

  function unitsHTML() {
    let h = pageHead("单位与常数", "CP2K 默认使用原子单位（a.u.）：长度 Bohr、能量 Hartree、时间原子时间。输入里写 <code>400</code> 就是 400 Ry 的截断能，不要写成 eV。");
    h += '<div class="unit-card"><div class="unit-grid">' +
      '<div class="unit-form"><label for="u-from">数值</label><input id="u-from" type="number" value="1" step="any">' +
      '<select id="u-cat">' + UNITS.map((u, i) => '<option value="' + i + '">' + u.name + "</option>").join("") + "</select></div>" +
      '<div class="eq">=</div>' +
      '<div class="unit-form"><label for="u-to">结果</label><input id="u-to" type="text" readonly><select id="u-unit"></select></div>' +
      "</div></div>";
    h += '<div class="unit-card"><div class="unit-grid">' +
      '<div class="unit-form"><label>常用常数</label></div><div></div><div></div></div>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>量</th><th>值</th><th>说明</th></tr></thead><tbody>' +
      CONSTS.map((c) => "<tr><td>" + esc(c[0]) + "</td><td><code>" + esc(c[1]) + "</code></td><td>" + esc(c[2]) + "</td></tr>").join("") +
      "</tbody></table></div></div>";
    return h;
  }

  function initUnits() {
    const cat = $("#u-cat"), from = $("#u-from"), to = $("#u-to"), unit = $("#u-unit");
    if (!cat) return;
    const paint = () => {
      const u = UNITS[+cat.value];
      unit.innerHTML = u.units.map((x, i) => '<option value="' + i + '">' + x[0] + "</option>").join("");
      calc();
    };
    const calc = () => {
      const u = UNITS[+cat.value];
      const val = parseFloat(from.value || "0");
      const target = u.units[+unit.value];
      const v = (val * u.units[0][1]) / target[1];
      to.value = Number(v.toPrecision(8)).toString();
    };
    from.addEventListener("input", calc);
    cat.addEventListener("change", paint);
    unit.addEventListener("change", calc);
    paint();
  }

  /* ---------------- 术语 ---------------- */
  function glossaryHTML() {
    return pageHead("术语表", "全书出现的 CP2K / DFT 术语，按中文拼音排序，附英文原文。") +
      '<div class="toolbar"><input type="search" id="gq" placeholder="搜索术语…" autocomplete="off"><span class="count" id="gcount"></span></div><div id="gbox"></div>';
  }
  function initGlossary() {
    const q = $("#gq"), box = $("#gbox"), cnt = $("#gcount");
    if (!box) return;
    const map = new Map();
    CHAPTERS.forEach((c) => (c.terms || []).forEach((t) => {
      if (!map.has(t.t)) map.set(t.t, { t: t.t, en: t.en || "", d: t.d, ch: [], hay: (t.t + (t.en || "") + t.d).toLowerCase() });
      map.get(t.t).ch.push(c.num);
    }));
    const all = Array.from(map.values()).sort((a, b) => a.t.localeCompare(b.t, "zh"));
    const paint = () => {
      const term = (q.value || "").trim().toLowerCase();
      const list = term ? all.filter((x) => x.hay.includes(term)) : all;
      cnt.textContent = list.length + " 条";
      box.innerHTML = '<div class="term-grid">' + list.map((x) =>
        '<div class="term-item"><b>' + esc(x.t) + '</b><span class="en">' + esc(x.en) + "</span><p>" + fmt(x.d) + '</p><p style="font-size:11px;color:var(--ink-3)">第 ' + x.ch.join("、") + " 章</p></div>").join("") + "</div>";
      if (!list.length) box.innerHTML = '<div class="empty">没有匹配的术语。</div>';
    };
    paint();
    q.addEventListener("input", paint);
  }

  /* ---------------- 工具箱 ---------------- */
  const TOOLS = [
    { id: "inputbuilder", t: "CP2K 输入文件生成器", d: "选任务、泛函、基组和截断能，生成一份能直接跑的输入，并逐行解释关键段落。" },
    { id: "grid", t: "CUTOFF / REL_CUTOFF 网格演示", d: "直观看到多层网格、高斯函数被分配到哪一层，以及相对截断能如何改变成本。" },
    { id: "scf", t: "SCF 收敛模拟", d: "改变混合参数、DIIS 历史和 OT，观察密度残差的收敛轨迹。" },
    { id: "md", t: "MD 与恒温器演示", d: "NVE / NVT / Langevin / Nosé–Hoover：温度、势能与总能量的实时曲线。" },
    { id: "units", t: "单位换算器", d: "Hartree、eV、kcal/mol、cm⁻¹、Bohr、Å、fs 一键互换。" },
  ];
  function toolsHTML() {
    let h = pageHead("工具箱", "五个纯前端小工具，帮你在写输入、调参数、对单位时少踩坑。全部离线运行。");
    h += '<div class="tool-grid">';
    TOOLS.forEach((t) => {
      h += '<div class="tool-card"><h3>' + esc(t.t) + "</h3><p>" + esc(t.d) + "</p>";
      h += t.id === "units" ? '<a class="btn btn-ghost" href="#/units">打开 →</a>'
        : '<a class="btn btn-ghost" href="#/tools/' + esc(t.id) + '">打开 →</a>';
      h += "</div>";
    });
    h += "</div>";
    return h;
  }

  const SCRIPTS = [
    {
      f: "cp2k2gro.py",
      t: "轨迹转 GROMACS：cp2k2gro.py",
      d: "把 cp2k-pos-1.xyz（可选速度 cp2k-vel-1.xyz、晶胞 cp2k-1.cell）转成 .gro，并顺手生成最小可用的 .mdp/.top。转换本身只做格式与单位换算（Å → nm），不做任何物理修正。",
      c: "python cp2k2gro.py -x cp2k-pos-1.xyz -c cp2k-1.cell -f traj.gro -a",
      n: "NVT 轨迹没有 cell 文件时，自己写一个三行的 CELL（A B C / α β γ），否则脚本会提示缺少晶格信息。-a 生成的 mdp/top 只够让 grompp 认出原子和质量，不能拿来直接跑 MD。",
      a: "许楠 / CP2K_scripts",
    },
    {
      f: "zdistr.py",
      t: "界面距离随时间：zdistr.py",
      d: "从扩展 XYZ 轨迹里，把某一元素所有原子的 z 坐标（或到参考原子的距离）按帧抽出来，写成 distance-<元素>.xyz，用来画水层/吸附层沿法向的分布随时间的变化。",
      c: "python zdistr.py cp2k-pos-1.xyz O",
      n: "脚本按「原子数 + 2」推断帧长，只认标准扩展 XYZ；注释行里不要塞多余空行，否则帧会错位。",
      a: "Jin-Cheng Liu",
    },
    {
      f: "masscenter-TiO2.py",
      t: "团簇漂移检查：masscenter-TiO2.py",
      d: "逐帧计算 Au 原子相对 TiO2 质心的位移，输出时间序列。判断金属团簇在 AIMD 里有没有整体跑掉，比肉眼看轨迹可靠。",
      c: "python masscenter-TiO2.py cp2k-pos-1.xyz Au",
      n: "脚本里元素名与原子数按 Au/TiO2 写死，换体系要改第 2、3 个参数与 `if tmpl[0] == 'Au'` 这一行。",
      a: "Jin-Cheng Liu",
    },
    {
      f: "gaussian.py",
      t: "HILLS 累加成自由能面：gaussian.py",
      d: "读取 cp2k-HILLS.metadynLog（或 VASP 的 HILLSPOT），把每一帧加进去的高斯按网格累加，得到 1D 或 2D 自由能面。CP2K 只支持 1D；2D 用于 VASP 的 COLVAR。",
      c: "python gaussian.py 1 1.0 3.0\n# 2D（VASP）：python gaussian.py 2 1.0 3.0 0.5 2.5",
      n: "横轴范围要覆盖整个采样区间，否则边缘的高斯被截断、自由能面出现假势垒。图只反映已采样区域，未采样的谷不是「不存在」。",
      a: "Jin-Cheng Liu",
    },
  ];
  const SAMPLES = [
    {
      f: "cuh2o-ot.out", t: "真实 OT 输出：cuh2o-ot.out（56 KB）",
      d: "Cu(100)/水 用 OT 跑的单点输出。适合练三件事：在长输出里定位 `SCF run converged`、读 `ENERGY|` 与 `Total energy`、确认 `PROGRAM ENDED AT`。也保留了完整的 timing 段，可以对照 19 章的并行分析。",
    },
    {
      f: "opt-energy.txt", t: "几何优化能量序列：opt-energy.txt（6 KB）",
      d: "GEO_OPT 每一步的能量，两列。用来画收敛曲线、判断 BFGS 是否在最后几步还在明显下降；比在 out 文件里数 `GEOMETRY OPTIMIZATION COMPLETED` 省事。",
    },
    {
      f: "rdf-auo.dat", t: "Au–O 径向分布：rdf-auo.dat（12 KB）",
      d: "从 Au(111)/水 AIMD 算出的 g(Au–O)，两列（r/Å、g）。第一峰位置对应金表面第一水层，峰高与积分给配位数。可以和 13.3 的 TRAVIS 路线对照。",
    },
    {
      f: "hills-sample.log", t: "元动力学 HILLS：hills-sample.log（105 KB）",
      d: "cp2k-HILLS.metadynLog 原文件。每行一个高斯：时间、位置、宽度、高度。gaussian.py 直接读它；也可以自己用 numpy 累加，验证对方法的理解。",
    },
  ];
  function scriptsHTML() {
    let h = pageHead("脚本与样本",
      "课程包里真正用得上的四个脚本、四份真实输出，原样打包进站点——下载即用，离线可跑。");
    h += '<div class="callout note"><div class="callout-t">出处与许可</div><div class="callout-b"><p>脚本来自「庚子计算 CP2K 课程」及其配套仓库（cp2k2gro.py 作者许楠，其余为 Jin-Cheng Liu），输出样本来自课程练习目录。这里只做整理与说明，版权归原作者；用于教学时请保留文件头注释。脚本按原样提供，运行前先读一遍参数与硬编码路径。</p></div></div>';
    h += '<h2 class="sec-h">四个脚本</h2><div class="script-list">';
    SCRIPTS.forEach((s) => {
      h += '<div class="script-card"><h3>' + esc(s.t) + "</h3><p>" + esc(s.d) + "</p>" +
        '<div class="code"><div class="code-head"><span class="lang">bash</span><span class="spacer"></span></div><pre><code>' + esc(s.c) + "</code></pre></div>" +
        '<p class="script-note">' + esc(s.n) + "</p>" +
        '<p class="script-foot"><span>' + esc(s.a) + '</span><a class="dl-link" href="assets/scripts/' + esc(s.f) + '" download>下载 ' + esc(s.f) + " ↓</a></p></div>";
    });
    h += '</div><h2 class="sec-h">四份真实输出</h2><div class="script-list">';
    SAMPLES.forEach((s) => {
      h += '<div class="script-card"><h3>' + esc(s.t) + "</h3><p>" + esc(s.d) + "</p>" +
        '<p class="script-foot"><span>课程练习原始输出</span><a class="dl-link" href="assets/data/' + esc(s.f) + '" download>下载 ' + esc(s.f) + " ↓</a></p></div>";
    });
    h += "</div>";
    h += '<div class="callout tip"><div class="callout-t">怎么用这些文件练手</div><div class="callout-b"><p>不要只看：把 <code>cuh2o-ot.out</code> 丢进 <code>grep -n "SCF run converged\|ENERGY|\|PROGRAM ENDED"</code>，看自己几秒能定位；用 <code>opt-energy.txt</code> 画收敛曲线，判断该不该继续；用 <code>gaussian.py</code> 重建自由能面，再改横轴范围看边缘效应。能复现，才算学会。</p></div></div>';
    return h;
  }

  function demoPage(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) return pageHead("找不到这个工具", "地址里的工具名不对。") + '<p><a href="#/tools">回到工具箱</a></p>';
    return pageHead(t.t, t.d) +
      '<p><a class="back-link" href="#/tools">← 工具箱</a></p>' +
      '<div class="demo demo-page" data-demo="' + esc(t.id) + '"><div class="demo-body"></div></div>';
  }

  /* ---------------- 搜索 ---------------- */
  let searchIndex = null;
  function blockText(blocks) {
    const out = [];
    const skip = { type: 1, kind: 1, lang: 1, id: 1 };
    (function walk(v, key) {
      if (typeof v === "string") { if (!skip[key]) out.push(v); return; }
      if (Array.isArray(v)) { v.forEach((x) => walk(x)); return; }
      if (v && typeof v === "object") Object.keys(v).forEach((k) => walk(v[k], k));
    })(blocks);
    return out.join(" ");
  }
  function buildSearchIndex() {
    const idx = [];
    CHAPTERS.forEach((c) => {
      idx.push({ g: "章节", t: c.title, d: c.subtitle || "", u: "#/" + c.id });
      (c.sections || []).forEach((s) => idx.push({ g: "小节", t: s.id + " " + s.title, d: c.title, u: "#/" + c.id + "/" + s.id.replace(/\./g, "-"), body: blockText(s.blocks) }));
      (c.terms || []).forEach((t) => idx.push({ g: "术语", t: t.t, d: t.d, u: "#/glossary" }));
    });
    (state.manual || []).forEach((m) => idx.push({ g: "手册", t: m.title, d: m.doc, u: "https://manual.cp2k.org/trunk/" + m.doc + ".html", ext: true }));
    if (state.keywords) (state.keywords).forEach((k) => idx.push({ g: "关键词", t: k.name, d: k.path + " · " + (k.desc || ""), u: "#/reference?q=" + encodeURIComponent(k.name) }));
    idx.forEach((x) => { x.hay = (x.t + " " + (x.d || "") + " " + (x.body || "")).toLowerCase(); x.tl = x.t.toLowerCase(); });
    searchIndex = idx;
    return idx;
  }

  function openSearch() {
    const ov = $("#search-overlay");
    if (!ov) return;
    ov.classList.add("open");
    const inp = $("#search-input");
    inp.value = "";
    inp.focus();
    renderSearch("");
    if (!state.keywords) loadKeywords(() => { searchIndex = null; if (inp) renderSearch(inp.value); });
    if (!state.manual) loadScript("js/data/manual.js", () => { state.manual = window.MANUAL || []; searchIndex = null; });
  }
  function closeSearch() { const ov = $("#search-overlay"); if (ov) ov.classList.remove("open"); }

  let searchSel = 0, searchHits = [];
  function renderSearch(q) {
    const box = $("#search-results");
    if (!box) return;
    const idx = searchIndex || buildSearchIndex();
    const term = (q || "").trim().toLowerCase();
    if (!term) {
      box.innerHTML = '<div class="sr-group">快捷入口</div>' + [
        ["ch03", "第一个计算：水的单点能"], ["reference", "关键词速查"], ["map", "手册地图"], ["units", "单位换算"], ["tools", "工具箱"],
      ].map((x) => '<a class="sr" href="#/' + x[0] + '"><span class="sr-t">' + x[1] + '</span><span class="sr-k">↵</span></a>').join("");
      searchHits = [];
      return;
    }
    const hits = idx.filter((x) => x.hay.includes(term));
    hits.sort((a, b) => (a.tl.startsWith(term) ? 0 : 1) - (b.tl.startsWith(term) ? 0 : 1));
    searchHits = hits.slice(0, 40);
    searchSel = 0;
    if (!hits.length) { box.innerHTML = '<div class="sr-empty">没有找到「' + esc(q) + "」</div>"; return; }
    let html = "", lastG = "";
    hits.slice(0, 40).forEach((x, i) => {
      if (x.g !== lastG) { html += '<div class="sr-group">' + esc(x.g) + "</div>"; lastG = x.g; }
      html += '<a class="sr' + (i === 0 ? " sel" : "") + '" href="' + esc(x.u) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : "") + ' data-i="' + i + '">' +
        '<span class="sr-t">' + esc(x.t) + '</span><span class="sr-d">' + esc((x.d || "").slice(0, 80)) + "</span></a>";
    });
    box.innerHTML = html;
  }

  function moveSearch(d) {
    const els = $$("#search-results .sr");
    if (!els.length) return;
    searchSel = clamp(searchSel + d, 0, els.length - 1);
    els.forEach((e, i) => e.classList.toggle("sel", i === searchSel));
    els[searchSel].scrollIntoView({ block: "nearest" });
  }

  /* ---------------- 数据懒加载 ---------------- */
  function loadScript(src, cb) {
    if (document.querySelector('script[data-src="' + src + '"]')) return cb && cb();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => cb && cb();
    s.onerror = () => cb && cb();
    document.head.appendChild(s);
  }
  function loadKeywords(cb) {
    if (state.keywords) return cb && cb();
    if (state.kwLoading) return;
    state.kwLoading = true;
    loadScript("js/data/keywords.js", () => {
      state.keywords = window.KEYWORDS || [];
      state.kwLoading = false;
      searchIndex = null;
      cb && cb();
    });
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    const parts = h.split("/");
    return { path: parts[0] || "", anchor: parts[1] || "", query: h.split("?")[1] || "" };
  }

  function render() {
    const r = parseHash();
    state.route = r;
    const view = $("#view");
    view.innerHTML = "";
    let c = null;
    if (!r.path) {
      view.innerHTML = homeHTML();
      document.title = "CP2K 学习手册 · 从第一行输入到科研计算";
    } else if (r.path === "reference") {
      view.innerHTML = referenceHTML();
      document.title = "关键词速查 · CP2K 学习手册";
      initReference();
    } else if (r.path === "map") {
      view.innerHTML = mapHTML();
      document.title = "手册地图 · CP2K 学习手册";
      initMap();
    } else if (r.path === "units") {
      view.innerHTML = unitsHTML();
      document.title = "单位与常数 · CP2K 学习手册";
      initUnits();
    } else if (r.path === "glossary") {
      view.innerHTML = glossaryHTML();
      document.title = "术语表 · CP2K 学习手册";
      initGlossary();
    } else if (r.path === "scripts") {
      view.innerHTML = scriptsHTML();
      document.title = "脚本与样本 · CP2K 学习手册";
    } else if (r.path === "tools") {
      view.innerHTML = r.anchor ? demoPage(r.anchor) : toolsHTML();
      document.title = (r.anchor ? (TOOLS.find((t) => t.id === r.anchor) || {}).t || "工具箱" : "工具箱") + " · CP2K 学习手册";
      mountAllDemos();
    } else if (r.path === "about") {
      view.innerHTML = pageHead("关于本站", "非官方 CP2K 中文教程，离线可读。") +
        "<h3>内容从哪来</h3><p>课程主线来自《庚子计算 · AIMD 与 CP2K》讲义 1–5（PDF 转文本后重新组织），并整合了课程资料包里的 howto、专题讲义与真实练习输入（Au-H2O、Cu(100)+水、Au/TiO₂、QM/MM 元动力学、packmol 建模）。参数、默认值与语法边界以 <a href=\"https://manual.cp2k.org/trunk/\" target=\"_blank\" rel=\"noopener\">CP2K 官方手册（trunk 版）</a>为准：抓取了其中 3093 个页面（123 个方法/安装/教程页 + 2970 个输入参考页）。全站重编为 15 章中文课程，每章末尾的「来源」列出对应的讲义与手册页；关键词速查与手册地图直接由抓取数据生成。</p>" +
        "<h3>哪些是「示意」</h3><p>交互演示里的 SCF 收敛曲线、MD 恒温器、CUTOFF 网格分配都是教学模型：它们遵循手册里的定性规律（多层网格、DIIS/OT 的收敛速度、恒温器对温度的控制），但不是真实求解器，不能用来预测具体数值。正文中凡引用具体数值，都标明来自手册示例或需要自测。</p>" +
        "<h3>使用与许可</h3><p>站点代码（HTML/CSS/JS 与构建脚本）可自由用于学习与教学；手册文本与关键词说明版权归 CP2K 项目，按其许可使用；CP2K 本身是 GPLv2。示例在 Linux + cp2k.psmp 下验证语法，但不同版本、不同基组/赝势文件可能导致结果差异——正式计算前请以官方手册为准。</p>" +
        "<h3>怎么离线用</h3><p>把整个目录拷到任何机器，双击 <code>index.html</code> 即可。不需要联网，也不依赖任何 CDN。搜索用 <code>Ctrl K</code>，打印用顶栏的打印按钮（会去掉侧栏和按钮，只留正文）。</p>" +
        "<h3>反馈</h3><p>发现错误时，先对照本章「来源」里的手册页；若确认是本站写错，请记录章节号与小节号，方便修订。</p>";
    } else {
      c = CHAPTERS.find((x) => x.id === r.path);
      if (c) {
        view.innerHTML = chapterHTML(c);
        document.title = c.title + " · CP2K 学习手册";
        initChapter(c);
      } else {
        view.innerHTML = pageHead("页面不存在", "这个地址没有对应的内容。") + '<p><a href="#/">回到首页</a></p>';
        document.title = "页面不存在 · CP2K 学习手册";
      }
    }
    markSidebar();
    syncTopnav();
    // 滚动
    if (r.anchor) {
      requestAnimationFrame(() => {
        const el = document.getElementById(r.anchor);
        if (el) el.scrollIntoView({ block: "start" });
        else window.scrollTo(0, 0);
      });
    } else {
      window.scrollTo(0, 0);
    }
    closeSearch();
    $("#sidebar").classList.remove("open");
    if (window.hljs) { /* noop */ }
  }

  function syncTopnav() {
    const p = state.route.path;
    $$(".topnav a").forEach((a) => {
      const href = a.getAttribute("href").replace("#/", "");
      a.classList.toggle("on", href === p || (href === "" && !p));
    });
  }

  function mountAllDemos() {
    $$("[data-demo]").forEach((el) => {
      const id = el.dataset.demo;
      const d = window.DEMOS && window.DEMOS[id];
      const body = $(".demo-body", el);
      if (d && body) { try { d.mount(body); } catch (e) { body.innerHTML = '<div class="empty">演示加载失败。</div>'; } }
    });
  }

  /* ---------------- 全局事件 ---------------- */
  function initEvents() {
    window.addEventListener("hashchange", render);

    // 主题
    const applyTheme = (t) => {
      state.theme = t;
      document.documentElement.setAttribute("data-theme", t);
      const btn = $("#theme-btn");
      if (btn) btn.textContent = t === "dark" ? "☀︎" : "☾";
      store.set("cp2k.theme", t);
    };
    applyTheme(state.theme);
    document.addEventListener("click", (e) => {
      const copyBtn = e.target.closest(".copy-btn");
      if (e.target.closest("#theme-btn")) applyTheme(state.theme === "dark" ? "light" : "dark");
      if (e.target.closest("#print-btn")) window.print();
      if (e.target.closest("#menu-btn")) $("#sidebar").classList.toggle("open");
      if (copyBtn) {
        const btn = copyBtn;
        const pre = btn.closest(".code").querySelector("pre");
        const text = pre.textContent;
        const done = () => { btn.textContent = "已复制"; btn.classList.add("ok"); setTimeout(() => { btn.textContent = "复制"; btn.classList.remove("ok"); }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
        else fallbackCopy(text, done);
      }
      if (e.target.closest("#search-btn")) { e.preventDefault(); openSearch(); }
      if (e.target.closest("#search-close")) closeSearch();
    });
    function fallbackCopy(text, cb) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); cb(); } catch (e) {}
      document.body.removeChild(ta);
    }

    // 键盘
    const searchOverlay = $("#search-overlay");
    document.addEventListener("keydown", (e) => {
      const open = searchOverlay && searchOverlay.classList.contains("open");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open ? closeSearch() : openSearch(); return; }
      if (e.key === "/" && !open && !/input|textarea|select/i.test((e.target.tagName || ""))) { e.preventDefault(); openSearch(); return; }
      if (!open) return;
      if (e.key === "Escape") { closeSearch(); }
      if (e.key === "ArrowDown") { e.preventDefault(); moveSearch(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); moveSearch(-1); }
      if (e.key === "Enter") {
        const sel = $("#search-results .sr.sel") || $("#search-results .sr");
        if (sel) { const href = sel.getAttribute("href"); closeSearch(); if (sel.target === "_blank") { window.open(href, "_blank"); } else { location.hash = href; } }
      }
    });

    const si = $("#search-input");
    if (si) {
      si.addEventListener("input", (e) => renderSearch(e.target.value));
    }
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    renderSidebar();
    initEvents();
    if (!location.hash) history.replaceState(null, "", "#/");
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();