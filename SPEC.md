# CP2K 中文教学站 · 内容与工程规范（SPEC）

本文件是**唯一契约**。所有章节作者（agent 或人）必须严格遵守；Lead 按此验收。

## 0. 项目定位

- 站点：`cp2k-learn/`，纯静态、离线可用（双击 `index.html` 即可，file:// 协议下工作）。
- 内容：中文教学站，基于 CP2K 官方手册（manual.cp2k.org/trunk，已抓取到 `_src/narrative/` + `_src/input/`）。
- 读者：有量子化学/DFT 基础、会 Linux 命令行、第一次用 CP2K 的研究生。
- 语气：第二人称、短句、先给可运行的输入再解释、每节都有「为什么」。
- **禁止**：编造手册没有的事实、编造 benchmark 数字、编造不存在的关键词、假装是官方文档。
- 标注：页脚统一声明「非官方教程，内容整理自 CP2K 官方手册（trunk）」。

## 1. 文件与加载方式

- 每章一个文件：`js/content/chNN.js`（NN 两位数字）。
- 必须包在 IIFE 里，禁止污染全局（只挂 `window.CONTENT`）：

```js
(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch03"] = { /* ... */ };
})();
```

- 文件用 UTF-8，**不加 BOM**。
- 不要在内容里写 `<script>`；不要用外部 URL 图片；不要引入 CDN。
- 代码块统一用模板字符串；CP2K 输入、bash 命令里不会出现反引号与 `${`，可安全使用。正文（非代码）用普通双引号字符串，避免反引号。

## 2. 章节 schema

```js
{
  id: "ch03",                 // 与文件名一致
  num: 3,
  part: "上手",               // 见下
  title: "第一个计算：水分子的单点能",
  subtitle: "一句话说清这章学会什么（≤ 30 字）",
  hours: 1.5,                 // 预计学习小时（0.5 的倍数）
  level: "入门",              // 入门 | 进阶 | 高级
  intro: "2-4 句导读：为什么学、学完能做什么。",
  goals: ["...", "..."],      // 3-5 条，动词开头
  sections: [ /* 6-9 节 */ ],
  quiz: [ /* 4-6 题 */ ],
  terms: [ /* 4-8 个术语 */ ],
  sources: [ /* 2-6 条手册来源 */ ]
}
```

- `part` 只能是：`准备`、`上手`、`DFT 核心`、`结构与振动`、`动力学`、`分析与性质`、`进阶与工程`、`课程实战`。
- `sections[].id`：`"3.1"` 这种；页面锚点 `#/ch03/3-1`。
- `sources`：`[{ t: "Run a First Calculation", url: "https://manual.cp2k.org/trunk/getting-started/first-calculation.html" }]`。

## 3. 小节与内容块

```js
{ id: "3.2", title: "把输入文件写出来", blocks: [ /* ... */ ] }
```

块类型（渲染器支持以下全部，**不要自创类型**）：

| type | 字段 | 用途 |
|---|---|---|
| `p` | `text` | 段落。支持行内语法（见 §4） |
| `h3` | `text` | 节内小标题 |
| `list` | `items: []`, `ordered?: bool` | 列表 |
| `code` | `lang`, `text`, `title?`, `note?` | 代码块。`lang`: `cp2k`/`bash`/`text`/`python`。`text` 用模板字符串 |
| `callout` | `kind`, `title?`, `text` | `kind`: `tip`（经验）/`warn`（注意）/`danger`（坑）/`info`（手册背景）/`key`（重点结论） |
| `table` | `head: []`, `rows: [[]]`, `caption?` | 表格，首列左对齐 |
| `key` | `items: [{ k, v, tag? }]` | 关键词卡片。`k` 为 CP2K 关键词名（等宽显示），`tag` 如 `必填`/`默认`/`常用` |
| `demo` | `id`, `title`, `desc?` | 交互演示，`id` 必须在白名单：`inputbuilder`/`grid`/`scf`/`md`/`units` |
| `keypoints` | `items: []` | 本节小结，3-5 条 |
| `steps` | `items: [{ t, d }]` | 有序步骤 |
| `compare` | `left: {title, items}`, `right: {title, items}` | 左右对比（如 OT vs 对角化） |
| `formula` | `tex`, `caption?` | 独立公式 |
| `quote` | `text`, `who?` | 引用手册原文（英文） |
| `figure` | `svg`, `caption?` | 内联 SVG（必须自己画，viewBox + 当前色 `currentColor`） |

**每节最后建议**：`keypoints` 或 `callout kind="key"` 收束；**每章至少 2 个 `code`、1 个 `table`、1 个 `callout`**。

## 4. 行内语法（只用于 `p`/`callout.text`/`list.items` 等文本字段）

- `**粗体**`、`==高亮==`、`*斜体*`
- `` `code` `` 行内等宽
- `[文字](https://...)` 链接（站外）
- `$E_{cut}$` 行内公式（渲染器做轻量 TeX 转换，只支持 `_ ^ \frac \mathrm \sum \int \Delta \alpha \beta \epsilon \sigma \Gamma` 等常见符号，复杂公式用 `formula` 块 + SVG/HTML）
- 行内不要写裸 HTML（会被转义）。

## 5. 写作要求（验收标准）

1. **可运行**：每个 CP2K 输入示例必须语法正确、`&SECTION` / `&END SECTION` 配对、单位与关键字来自手册。命令示例在 Linux 下可直接执行。
2. **有出处**：每个技术断言都能在 `_src/narrative/` 对应页面找到依据；不确定就删掉，不要猜。
3. **讲人话**：每出现一个新关键词，先用一句话说「它控制什么、调大调小会怎样」，再给示例。
4. **有节奏**：段落 ≤ 5 行；代码块 ≤ 40 行，超长就分段并解释；每节 600-1200 字。
5. **有取舍**：手册 3000 页不可能全讲；只讲主线 + 常见坑，冷门功能一句话带过并给手册链接。
6. **无占位符**：不允许出现 `TODO`、`待补充`、`（略）` 作为正文；写不了就换主题。
7. **术语一致**：见 §7 词汇表；首次出现给英文。
8. **数字可信**：耗时/内存只用「量级」描述（如「几分钟」），不编造精确 benchmark。
9. **发布式叙事（anti-defensive-writing）**：站点是「教你怎么把 CP2K 跑成」的发布会，不是踩坑日志。
   - 只围绕可复用的结论组织内容：先给能跑通的输入与做法，再解释为什么；不按「我们先试了 A、失败、又试了 B」的过程写。
   - 优势与边界分开说：每节开头先讲「这一节能让你做成什么」，限制只在影响结论时用一句事实说明（「只适用于气相分子」），并**紧跟替代路径**（「固体走 XX」）。
   - 不替读者否定自己：禁用「遗憾的是」「仅」「效果有限」「存在严重不足」「本教程水平有限」「未能覆盖」这类自我削弱措辞；也不主动提出没人问的短板。
   - 不制造伪对比：不把 CP2K 不占优的指标设成主线；需要比较时选能反映定位的维度（开箱即用、GPW 成本、AIMD、QM/MM），并说明适用场景。
   - 结论段只强化记忆点：这章解决什么问题、关键参数是哪几个、下一步做什么；不在结尾突然扩大局限。

## 6. 章节清单与分工

本版以《庚子计算·AIMD 与 CP2K 讲义》1–5 为主干（`_src/course/lecture_1..5.txt`），官方手册负责参数与边界的准确性，旧站内容只作参考。全站 15 章 / 6 部分。

| 章 | 标题 | 部分 | 核心内容 | 主素材 |
|---|---|---|---|---|
| ch01 | 认识 CP2K：方法版图与能力边界 | 起步 | 能做什么、GPW 一句话、速度从哪来、与 VASP 的分工、学习路线 | lecture_1/2、旧 ch01 |
| ch02 | AIMD 基础：势能面、系综与时间步 | 起步 | PES、BOMD/Ehrenfest、NVE/NVT/NPT、温控、时间步、相关函数、VASP 参数对照 | lecture_1、manual MD |
| ch03 | 安装与运行 | 起步 | ssmp/popt/psmp、源码编译、Spack/容器、Slurm 脚本、MPI×OMP、验证安装 | lecture_2、manual installation |
| ch04 | 输入文件与计算流程 | 输入与体系 | &SECTION 语法、四层结构、RUN_TYPE、提交脚本、输出文件、restart、五类输入错误 | lecture_2/3、旧 ch03–05 |
| ch05 | 基组、赝势、坐标与建模 | 输入与体系 | MOLOPT 基组、GTH 赝势与 q 值、&COORD/&CELL、slab/水盒/packmol、&KIND | lecture_2/3、manual basis_sets |
| ch06 | GPW、网格与 CUTOFF 收敛 | 电子结构 | 高斯基组+辅助网格、多网格映射、CUTOFF/REL_CUTOFF 收敛、NGRIDS、GAPW | lecture_3、howto_converging_cutoff |
| ch07 | 泛函、色散、DFT+U、磁性、杂化 | 电子结构 | PBE/BLYP/TPSS、D3/D4、&DFT_PLUS_U、UKS/磁性、PBE0/HSE+ADMM | lecture_3/4、Hybrid_Functionals |
| ch08 | SCF：OT、对角化、展宽与混合 | 电子结构 | OT 路线、DIAGONALIZATION、MIXING BROYDEN、SMEAR/ADDED_MOS、EPS_SCF、不收敛诊断 | lecture_3、manual convergence |
| ch09 | 几何/晶胞优化与过渡态 | 结构与振动 | GEO_OPT、CELL_OPT、约束、CI-NEB、DIMER、初末态与验证 | lecture_3、manual optimization |
| ch10 | 频率、振动光谱与 TRAVIS | 结构与振动 | VIBRATIONAL_ANALYSIS、虚频、IR/Raman、热化学、TRAVIS 工作流 | lecture_4、travis pdf |
| ch11 | AIMD 实战：系综、温控、约束与续算 | 动力学与自由能 | &MD、NOSE/CSVR/GLE、ASPC、重启、约束 MD、能量守恒、Au-H2O 案例 | lecture_4、练习 Au-H2O |
| ch12 | 增强采样与自由能面 | 动力学与自由能 | blue-moon/PMF、slow-growth、metadynamics、COLVAR/HILLS、收敛判断、meta-qmmm | lecture_4/5 |
| ch13 | 轨迹与电子结构分析 | 分析与实战 | RDF/MSD、cp2k2gro、DOS/PDOS、电荷/ELF/MO/静电势/功函数、能带 | lecture_4、练习 Au-TiO2 |
| ch14 | 表面+水与 QM/MM 案例 | 分析与实战 | slab 与真空、水盒界面、Au-H2O/cuh2o/Au-TiO2 案例、QM/MM、GENMIX | 练习全部输入 |
| ch15 | 发表级工作流 | 分析与实战 | 收敛证据链、误差预算、可复现、性能布局、方法段模板、错误速查 | lecture_2/3、旧 ch19–21 |

## 7. 术语统一（首次出现给英文）

- 赝势 pseudopotential；基组 basis set；平面波 plane wave；截断能 cutoff；辅助网格 multigrid；自洽场 SCF；轨道变换 orbital transformation (OT)；几何优化 geometry optimization；过渡态 transition state； nudged elastic band (NEB)；分子动力学 molecular dynamics (MD)；径向分布函数 RDF；态密度 DOS；投影态密度 PDOS；广义梯度近似 GGA；杂化泛函 hybrid functional；色散校正 dispersion correction；k 点 k-point；自旋极化 spin polarization；周期性边界条件 PBC。

## 8. 素材地图（写章节时先读这些）

课程讲义文本（PDF 已解密抽取，`cp2k-learn/_src/course/`）：

- `lecture_1.txt`：量子化学/第一性原理/MD 基础、AIMD 基础、VASP AIMD 参数、后处理 → ch01/ch02
- `lecture_2.txt`：CP2K 简介与编译、复杂模型建模、计算流程与参数详解 → ch01/ch03/ch04/ch05/ch15
- `lecture_3.txt`：基组赝势坐标读入、输出文件、几何/晶胞优化、过渡态 → ch04/ch05/ch06/ch07/ch09
- `lecture_4.txt`：频率、AIMD 详解、DFT+U/磁性/杂化、电子结构分析、限制性 AIMD、PMF/Metadynamics、TRAVIS → ch07/ch10/ch11/ch12/ch13
- `lecture_5.txt`：自由能面（blue-moon/PMF、slow-growth、metadynamics）→ ch12
- 辅助：`CP2K_Input_Basics.txt`、`howto_static_calculation.txt`、`howto_geometry_optimisation.txt`、`howto_converging_cutoff.txt`、`events_2018_summer_school_scf_setup.txt`、`hutter-bomd.txt`、`iannuzzi.txt`、`Hybrid_Functionals.txt`、`travis-quickstart.txt`、`travis_ir_raman.txt`、`_强烈推荐-庚子计算整理_CP2K使用入门.txt`

官方手册正文（`_src/narrative/`，文件名 = doc 路径 `/`→`__` + `.json`，正文在 `markdown`；关键词在 `js/data/keywords.js`）：

- ch01：`index`、`getting-started__foreword-and-faq`、`methods__dft__index`
- ch02：`methods__sampling__molecular_dynamics`、`langevin_dynamics`
- ch03：`getting-started__installation`、`build-from-source`、`build-with-spack`、`distributions`、`troubleshooting`
- ch04：`getting-started__first-calculation`、`CP2K_INPUT`、`methods__restarting`
- ch05：`methods__dft__basis_sets`、`methods__dft__pseudopotentials`
- ch06：`methods__dft__gpw`、`methods__dft__cutoff`、`methods__dft__gapw`
- ch07：`methods__dft__hartree-fock__index`、`methods__dft__local_ri`、`CP2K_INPUT/FORCE_EVAL/DFT/XC`
- ch08：`methods__dft__convergence`、`methods__dft__orbital_transformation`、`methods__dft__linear_scaling`
- ch09：`methods__optimization__geometry_and_cell_opt`、`methods__optimization__nudged_elastic_band`
- ch10：`methods__properties__infrared`、`raman`、`CP2K_INPUT/MOTION/VIBRATIONAL_ANALYSIS`
- ch11：`methods__sampling__molecular_dynamics`、`CP2K_INPUT/MOTION/MD`
- ch12：`methods__sampling__metadynamics`、`methods__sampling__constrained_dynamics`
- ch13：`methods__electronic_structure__dos`、`band__index`、`population__index`、`molecular_orbitals`
- ch14：`methods__qm_mm__index`、`builtin`、`CP2K_INPUT/FORCE_EVAL/QMMM`
- ch15：`getting-started__troubleshooting`、`technologies__eigensolvers__index`、`elpa`

课程练习（真实输入/输出，`D:\夸克\AJ41-CP2K课程\练习\`）：`Au-H2O`（AIMD + RDF）、`cuh2o`（OT vs 对角化）、`Au-TiO2`（DFT+U + rdf/rmsd）、`h2o`（cp2k/vasp 对照）、`meta-qmmm`（2936 原子 QM/MM 元动力学）、`packmol`（混合体系）、`metadynamics`。

## 9. 交互 demo 约定

- 实现文件 `js/demos/<id>.js`，挂 `window.DEMOS[id] = { mount(el, opts) { ... } }`。
- 必须纯前端、无依赖、离线可用；不写 `alert`；所有数字即时更新；提供「重置」。
- 章节里用 `{ type:"demo", id:"grid" }` 引用，渲染器负责挂载与卸载。

## 10. 质量自查（提交前）

- [ ] `node _build/check.js` 通过（schema、括号、`&END` 配对、禁用词、sources URL）
- [ ] 章节在浏览器里能打开、目录正确、无 JS 报错
- [ ] 所有代码块可复制且缩进正确
- [ ] 至少 1 个 `demo`（ch01/ch02 可豁免）
- [ ] 没有 TODO/占位符；没有英文长段落（引用手册原文除外）