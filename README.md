# CP2K 学习手册

把 CP2K 从「装不上、写不对、跑不出」带到能独立完成一项发表级计算：15 章中文课程、119 个小节、107 段可运行代码，配 5 个交互工具、3402 条关键词速查和 3093 页官方手册索引。全部离线，双击即读。

课程主线来自《AIMD 与 CP2K》讲义 1–5 与配套练习；每个参数、默认值和语法边界都逐条对照 [CP2K 官方手册（trunk）](https://manual.cp2k.org/trunk/index.html)——手册的 3093 个页面已全量抓取进站，正文里每个论断都能回到原页。

## 你会得到什么

- **一条完整的路线，而不是一堆参数**：六段递进，从方法版图、AIMD 原理、安装运行，到输入结构、电子结构、振动、动力学与自由能，最后落到发表级工作流。每章开头给目标，结尾给自测与来源。
- **每章都有能跑的输入**：107 段 `cp2k`/`bash` 代码；CP2K 段一律 `&SECTION` 与 `&END` 成对，并由 `check.js` 自动校验，复制到装有 `cp2k.psmp` 的机器即可提交。
- **真实体系，不是玩具**：Au(111)/水 198 原子、Cu(100)/水（OT 与对角化对照）、Au/TiO₂ 的 DFT+U（U−J = 13.6 eV）、2936 原子 QM/MM 元动力学——来自课程练习的原始输入与输出。
- **判断「跑成了」有硬标准**：全站统一用真实输出里的 `PROGRAM ENDED AT`、`SCF run converged`、`ENERGY|` 作为成功判据，而不是「看起来没报错」。
- **查得到，也搜得到**：3402 条关键词（含类型、默认值、取值、所在节路径）、3093 页手册地图；搜索覆盖章节、小节正文、术语、手册页与关键词。
- **四个后处理脚本 + 四份真实输出**：`cp2k2gro.py`、`zdistr.py`、`masscenter-TiO2.py`、`gaussian.py`，以及 OT 输出、优化能量序列、Au–O 径向分布、元动力学 HILLS，全部可下载练手。

## 打开就用

- **双击 `index.html`**。不需要服务器、不需要联网，也不加载任何 CDN 字体或脚本；`file://` 下功能完整。
- 推荐 Chrome / Edge / Firefox。左侧目录、右侧本章目录；`Ctrl K`（macOS `Cmd K`）全站搜索；顶栏可切深浅色与打印。
- 阅读进度、主题偏好存在浏览器本地，换设备不会同步。

## 课程路线

| 段 | 章节 | 解决的问题 |
|---|---|---|
| 起步 | 01–03 | CP2K 能算什么、AIMD 的时间步与系综、装好并提交第一个作业 |
| 输入与体系 | 04–06 | 输入文件的四层结构、基组赝势与建模、GPW 网格与 CUTOFF 收敛 |
| 电子结构 | 07–08 | 泛函/色散/DFT+U/磁性/杂化、SCF 的 OT 与对角化两条路线 |
| 结构与振动 | 09–10 | 几何与晶胞优化、过渡态、频率与 TRAVIS 光谱 |
| 动力学与自由能 | 11–12 | AIMD 从平衡到生产、元动力学与自由能面 |
| 分析与实战 | 13–15 | 轨迹与电子结构分析、表面+水与 QM/MM 案例、发表级工作流 |

附录：关键词速查、手册地图、单位换算、术语表、工具箱（5 个交互工具）、脚本与样本。

## 目录结构

```
cp2k-learn/
├─ index.html              入口（加载顺序：data → content → demos → app）
├─ css/style.css           浅色/深色、响应式、打印
├─ js/
│  ├─ app.js               路由、渲染、目录、搜索、进度、测验、演示挂载
│  ├─ content/chNN.js      15 章内容，window.CONTENT["chNN"]
│  ├─ demos/*.js           5 个演示，window.DEMOS[id]
│  └─ data/
│     ├─ manual.js         手册 3093 页 {doc,title}
│     ├─ keywords.js       3402 个关键词（按名称去重）
│     └─ stats.js          页面/关键词/章节计数
├─ assets/
│  ├─ scripts/             课程配套的 4 个后处理脚本
│  └─ data/                4 份真实输出样本
├─ _src/                   抓取的手册原文（narrative JSON + input JSON）
├─ _build/                 抓取、构建、QA 脚本与截图
├─ SPEC.md                 内容契约（章节 schema、块类型、写作规范）
└─ README.md
```

## 重新生成数据 / 内容检查

需要 Python 3（`requests`、`beautifulsoup4`）与 Node.js。

```bash
# 重新抓官方手册（联网；2970 个输入页约 8 分钟）
python _build/crawl.py --only narrative
python _build/crawl.py --only input

# 由 _src 生成 js/data/*.js（manual / keywords / stats）
python _build/build_data.py

# 校验章节 schema、块类型、&END 配对、来源链接、禁用词
node _build/check.js
```

浏览器 QA 与截图（`_build/qa_all.js`、`qa_demos.js`、`probe_*.js`）用 puppeteer-core，需要本机 Chrome。

## 内容约定

写新章节前看 `SPEC.md`，要点：

- 章节对象：`{id,num,part,title,subtitle,hours,level,intro,goals,sections,quiz,terms,sources}`。
- 块类型：`p/h3/list/code/callout/table/key/demo/keypoints/steps/compare/formula/quote/figure`。
- 行内语法：`**粗体**`、`==高亮==`、`` `代码` ``、`[文字](链接)`、`$公式$`。
- 代码块：`{type:"code", lang:"cp2k"|"bash"|"text", title, text:"..."}`；CP2K 的 `&SECTION` 与 `&END SECTION` 必须配对。
- 演示：`{type:"demo", id:"inputbuilder"|"grid"|"scf"|"md"|"units"}`。
- 写法遵循「发布式叙事」：先给可运行的做法与结论，再解释机制；不写踩坑流水账，不用自我削弱措辞。

## 运行环境

示例按 Linux + `cp2k.psmp` 编写；Windows 原生运行走 WSL，第 3 章给了完整步骤。交互演示是教学模型（SCF 收敛曲线、二维 LJ 的 MD、网格分层示意），遵循手册的定性规律，页面内已明确标注；正文中的具体数值均注明来自手册示例或需自测。

## 来源与许可

- 手册文本与关键词说明：CP2K 官方手册，版权归 CP2K 项目，按其许可使用；本站做中文改写与重组，每章 `sources` 给出对应原页链接。
- 课程讲义与练习：庚子计算 CP2K 课程及其配套资料；脚本版权归原作者（许楠、Jin-Cheng Liu），站点保留文件头注释。
- 站点代码（HTML/CSS/JS、抓取与构建脚本）：可自由用于学习与教学。
- CP2K 本身是 GPLv2 开源软件，使用时遵守其许可。
- 本站与 CP2K 项目无隶属关系。
