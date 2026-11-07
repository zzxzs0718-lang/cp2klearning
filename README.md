# CP2K 学习手册（中文 · 离线）

一个可以双击打开、断网也能用的 CP2K 中文教学站。课程主线来自《庚子计算 · AIMD 与 CP2K》讲义 1–5 与配套练习，参数与语法边界以 [CP2K 官方手册（trunk）](https://manual.cp2k.org/trunk/index.html) 为准确依据：15 章课程、5 个交互演示，以及全量手册索引（3093 页）和输入关键词速查（3402 条）。

> 本站是非官方教程。参数、默认值与语法以官方手册为准；示例在自己的机器上跑通前，不要直接用于发表。

## 怎么用

- **直接双击 `index.html`** 即可。所有资源都是本地文件，不需要服务器、不需要联网，也不加载任何 CDN 字体或脚本。
- 推荐用 Chrome / Edge / Firefox 打开。地址栏是 `file://.../index.html` 也完全可用。
- 左侧是目录，右侧是「本章目录」；`Ctrl K`（macOS 上 `Cmd K`）打开全站搜索。
- 首页的学习路线按「原理与装好 → 输入与体系 → 电子结构 → 结构与振动 → 动力学与自由能 → 分析与发布」六段组织。
- 附录里有关键词速查、手册地图（3093 页全量索引）、单位换算、术语表、工具箱。

## 目录结构

```
cp2k-learn/
├─ index.html            入口（顶层脚本顺序：data → content → demos → app）
├─ css/style.css          全部样式（浅色/深色、响应式、打印）
├─ js/
│  ├─ app.js             路由、渲染、目录、搜索、进度、测验、演示挂载
│  ├─ content/chNN.js    15 章内容，window.CONTENT["chNN"]
│  ├─ demos/*.js         5 个演示，window.DEMOS[id]
│  └─ data/
│     ├─ manual.js       手册 3093 页 {doc,title}
│     ├─ keywords.js     3402 个关键词（按名称去重）
│     └─ stats.js        页面/关键词/章节计数
├─ _src/                 抓取下来的手册原文（narrative JSON + input JSON）
├─ _build/               抓取与构建脚本、QA 脚本、截图
├─ SPEC.md               内容契约（章节 schema、块类型、写作规范）
└─ README.md
```

## 重新生成数据 / 内容检查

需要 Python 3（`requests`、`beautifulsoup4`）与 Node.js。

```bash
# 重新抓官方手册（可选，联网；全量约 8 分钟，2970 个输入页（本轮已全部抓取））
python _build/crawl.py --only narrative
python _build/crawl.py --only input

# 由 _src 重新生成 js/data/*.js（manual/keywords/stats）
python _build/build_data.py

# 校验章节 schema、括号、&END 配对、来源链接等
node _build/check.js
```

`_build/qa.js`、`_build/shots.js` 用 puppeteer-core 做浏览器 QA 与截图，需要本机 Chrome。

## 内容约定（写新章节时看 SPEC.md）

- 章节对象：`{id,num,part,title,subtitle,hours,level,intro,goals,sections,quiz,terms,sources}`。
- 块类型：`p/h3/list/code/callout/table/key/demo/keypoints/steps/compare/formula/quote/figure`。
- 行内语法：`**粗体**`、`==高亮==`、`` `代码` ``、`[文字](链接)`、`$公式$`。
- 代码块：`{type:"code", lang:"cp2k"|"bash"|"text", title, text:"..."}`；CP2K 的 `&SECTION` 必须与 `&END SECTION` 配对。
- 演示：`{type:"demo", id:"inputbuilder"|"grid"|"scf"|"md"|"units"}`。

## 来源与许可

- 手册文本与关键词说明：CP2K 官方手册，按其自身许可使用；本站做了中文改写与重组，并尽量在每章 `sources` 中给出原页链接。
- 站点代码（HTML/CSS/JS、抓取与构建脚本）：可自由用于学习与教学。
- CP2K 本身是 GPLv2 开源软件，请遵守其许可。

## 已知边界

- 示例以 Linux + `cp2k.psmp` 为前提；Windows 原生运行需要 WSL，第 3 章有说明。
- 交互演示是**教学示意**（例如 SCF 曲线、MD 是二维 LJ 模型），不是真实求解器；正文里已逐一标注。
- 官方手册 3093 个页面已全部抓取（`_src/input` 2970 页、narrative 123 页）；索引里的条目均可在本地检索。