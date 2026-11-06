#!/usr/bin/env node
/**
 * 章节内容检查：node _build/check.js
 * 校验 js/content/ch*.js 是否符合 SPEC.md 的内容契约。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "js", "content");
const PARTS = ["准备", "上手", "DFT 核心", "结构与振动", "动力学", "分析与性质", "进阶与工程"];
const BLOCKS = ["p", "h3", "list", "code", "callout", "table", "key", "demo", "keypoints", "steps", "compare", "formula", "quote", "figure"];
const DEMOS = ["inputbuilder", "grid", "scf", "md", "units"];

const errors = [];
const warn = [];
const err = (f, m) => errors.push(f + ": " + m);

if (!fs.existsSync(dir)) {
  console.error("找不到 " + dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => /^ch\d+\.js$/.test(f)).sort();
const seenIds = new Set();
const stats = { chapters: 0, sections: 0, blocks: 0, code: 0, demos: 0, quiz: 0, terms: 0 };

for (const f of files) {
  const id = f.replace(/\.js$/, "");
  const code = fs.readFileSync(path.join(dir, f), "utf8");
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(code, sandbox, { filename: f, timeout: 5000 });
  } catch (e) {
    err(f, "JS 执行失败: " + e.message);
    continue;
  }
  const C = sandbox.window.CONTENT || {};
  const c = C[id];
  if (!c) {
    err(f, "没有注册 window.CONTENT[\"" + id + "\"]");
    continue;
  }
  if (c.id !== id) err(f, "id 字段 " + c.id + " 与文件名不一致");
  if (seenIds.has(c.id)) err(f, "重复的章节 id " + c.id);
  seenIds.add(c.id);
  if (!Number.isInteger(c.num)) err(f, "num 必须是整数");
  if (!PARTS.includes(c.part)) err(f, "part 不在枚举内: " + c.part);
  for (const k of ["title", "subtitle", "intro"]) if (!c[k] || typeof c[k] !== "string") err(f, "缺少字符串字段 " + k);
  if (!Array.isArray(c.goals) || c.goals.length < 3) err(f, "goals 至少 3 条");
  if (!Array.isArray(c.sections) || c.sections.length < 5) err(f, "sections 至少 5 节");
  if (!Array.isArray(c.quiz) || c.quiz.length < 3) err(f, "quiz 至少 3 题");
  if (!Array.isArray(c.terms) || c.terms.length < 3) err(f, "terms 至少 3 条");
  if (!Array.isArray(c.sources) || c.sources.length < 2) err(f, "sources 至少 2 条");

  const plain = JSON.stringify(c);
  for (const bad of ["TODO", "FIXME", "待补", "占位符", "lorem ipsum", "遗憾的是", "效果有限", "严重不足", "水平有限"]) {
    if (plain.includes(bad)) err(f, "出现禁用词 " + bad);
  }

  let demos = 0;
  (c.sections || []).forEach((s, si) => {
    if (!s.id || !s.title) err(f, "第 " + (si + 1) + " 节缺 id/title");
    if (s.id && seenIds.has("sec:" + s.id)) err(f, "重复的小节 id " + s.id);
    if (s.id) seenIds.add("sec:" + s.id);
    if (!Array.isArray(s.blocks) || !s.blocks.length) {
      err(f, "小节 " + (s.id || si) + " 没有 blocks");
      return;
    }
    stats.sections++;
    s.blocks.forEach((b, bi) => {
      const at = "小节 " + (s.id || si) + " 第 " + (bi + 1) + " 块";
      if (!b || !BLOCKS.includes(b.type)) return err(f, at + " 类型非法: " + (b && b.type));
      stats.blocks++;
      if (b.type === "p" || b.type === "h3" || b.type === "quote") {
        if (!b.text) err(f, at + " 缺 text");
      } else if (b.type === "list") {
        if (!Array.isArray(b.items) || !b.items.length) err(f, at + " 缺 items");
      } else if (b.type === "code") {
        const t = Array.isArray(b.text) ? b.text.join("\n") : b.text;
        if (!t) err(f, at + " 缺 text");
        stats.code++;
        if ((b.lang || "") === "cp2k" && t) checkCp2k(f, at, t);
      } else if (b.type === "callout") {
        if (!b.text) err(f, at + " 缺 text");
      } else if (b.type === "table") {
        if (!Array.isArray(b.head) || !Array.isArray(b.rows)) err(f, at + " 缺 head/rows");
      } else if (b.type === "key") {
        if (!Array.isArray(b.items) || b.items.some((i) => !i.k || !i.v)) err(f, at + " 缺 k/v");
      } else if (b.type === "demo") {
        if (!DEMOS.includes(b.id)) err(f, at + " 未知 demo: " + b.id);
        demos++;
        stats.demos++;
      } else if (b.type === "keypoints") {
        if (!Array.isArray(b.items) || b.items.length < 2) err(f, at + " keypoints 至少 2 条");
      } else if (b.type === "steps") {
        if (!Array.isArray(b.items) || b.items.length < 2) err(f, at + " steps 至少 2 步");
      } else if (b.type === "compare") {
        if (!b.left || !b.right) err(f, at + " compare 缺 left/right");
      } else if (b.type === "formula") {
        if (!b.tex) err(f, at + " formula 缺 tex");
      } else if (b.type === "figure") {
        if (!b.svg) warn.push(f + ": " + at + " figure 无 svg（用 img 或 table 代替）");
      }
    });
  });
  if (!demos && !["ch01", "ch02"].includes(id)) err(f, "至少引用 1 个 demo（ch01/ch02 可豁免）");

  (c.quiz || []).forEach((q, qi) => {
    stats.quiz++;
    if (!q.q || !Array.isArray(q.options) || q.options.length < 3) err(f, "第 " + (qi + 1) + " 题缺题干或选项不足");
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options || []).length) err(f, "第 " + (qi + 1) + " 题 answer 下标非法");
    if (!q.explain) err(f, "第 " + (qi + 1) + " 题缺 explain");
  });
  (c.terms || []).forEach((t, ti) => {
    stats.terms++;
    if (!t.t || !t.d) err(f, "第 " + (ti + 1) + " 个术语缺 t/d");
  });
  (c.sources || []).forEach((s) => {
    if (!/^https:\/\/manual\.cp2k\.org\/trunk\//.test(s.url || "")) err(f, "来源不是手册链接: " + (s.url || "(空)"));
    if (!s.t) err(f, "来源缺标题: " + s.url);
  });

  stats.chapters++;
}

function checkCp2k(file, at, text) {
  const stack = [];
  text.split("\n").forEach((raw, i) => {
    const mm = raw.trim().match(/^&([A-Za-z_][\w-]*)/);
    if (!mm) return;
    const tok = mm[1].toUpperCase();
    if (tok === "END") {
      const close = (raw.trim().split(/\s+/)[1] || "").toUpperCase();
      const top = stack.pop();
      if (!top) err(file, at + " 第 " + (i + 1) + " 行多余的 &END " + close);
      else if (close && close !== top) err(file, at + " 第 " + (i + 1) + " 行 &END " + close + " 与 &" + top + " 不匹配");
    } else {
      stack.push(tok);
    }
  });
  if (stack.length) err(file, at + " 有未闭合的节: &" + stack.join(", &"));
}

console.log("\nCP2K 学习手册 · 内容检查\n");
console.log("章节 " + stats.chapters + " | 小节 " + stats.sections + " | 块 " + stats.blocks + " | 代码 " + stats.code + " | demo 引用 " + stats.demos + " | 测验 " + stats.quiz + " | 术语 " + stats.terms);
if (warn.length) {
  console.log("\n提示 " + warn.length + " 条：");
  warn.slice(0, 20).forEach((w) => console.log("  · " + w));
}
if (errors.length) {
  console.log("\n发现 " + errors.length + " 个问题：");
  errors.forEach((e) => console.log("  ✗ " + e));
  process.exit(1);
}
console.log("\n✓ 全部通过");