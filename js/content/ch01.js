(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch01"] = {
    id: "ch01",
    num: 1,
    part: "准备",
    title: "认识 CP2K：它算什么，凭什么值得学",
    subtitle: "先弄清方法路线与能力边界，再决定拿它解哪个问题",
    hours: 1,
    level: "入门",
    intro:
      "CP2K 不是「另一个 VASP」。它用高斯基组加平面波辅助网格，把 DFT、后 Hartree–Fock、QM/MM 和分子动力学放进同一套输入框架，目标是把 ab initio 计算推到更大的体系和更长的时间尺度。这一章不要求你跑通计算，先把三件事说清楚：它是什么、能算什么、在你的工具箱里该放在哪一格。",
    goals: [
      "用一句话说清 CP2K 的方法路线（GPW/GAPW）与它适合的体系",
      "区分 Quickstep 的 DFT 与 CP2K 里的 post-HF、QM/MM、MD 等其它能力",
      "对照 VASP、Quantum ESPRESSO、Gaussian，判断一个课题该不该用 CP2K",
      "拿到手册后知道从哪一页查起，以及 21 章的学习顺序",
    ],
    sections: [
      {
        id: "1.1",
        title: "一句话：CP2K 是什么",
        blocks: [
          {
            type: "p",
            text: "CP2K 是一个开源软件包，做的是**原子尺度模拟中的 ab initio 电子结构计算**。代码用 Fortran 2008 写成，从设计之初就面向大规模高性能计算：多线程、MPI、CUDA、HIP 都在支持范围内，CPU 和 GPU 都能跑。它免费、无需注册，源代码和二进制包都可以直接拿到。",
          },
          {
            type: "p",
            text: "它最早是作为量子化学方法（具体说是 `QUICKSTEP` 模块）的分子动力学实现而出现的，之后二十多年里被大量合作者扩展成今天的样子。所以它的骨架是「电子结构 + 原子运动」，而不是「只算一个能量」。",
          },
          {
            type: "key",
            items: [
              { k: "QUICKSTEP", v: "核心电子结构模块，GPW 方法就在这里实现", tag: "核心" },
              { k: "BOMD", v: "CP2K 实际主用的从头算分子动力学表述", tag: "常见" },
              { k: "Fortran 2008", v: "代码语言；自己编译时需要现代 Fortran 编译器", tag: "背景" },
              { k: "开源免费", v: "无需注册；发表时按手册的要求引用综述", tag: "许可" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "名字里的 CP 是纪念，不是限制",
            text: "CP 来自 Car–Parrinello，2K 指 2000 年。历史上 ab initio MD 有 CPMD 与 BOMD 两种表述；CP2K 里真正主用的是 BOMD，原始的 CPMD 表述并没有实现。所以不要因为名字以为它只能做 Car–Parrinello 动力学——它做的是 Born–Oppenheimer 分子动力学。",
          },
        ],
      },
      {
        id: "1.2",
        title: "Quickstep 与 GPW：它到底怎么算",
        blocks: [
          {
            type: "p",
            text: "CP2K 的 DFT 主要由 **Quickstep** 模块提供。生产计算绝大多数用 **GPW**（Gaussian and Plane Waves，高斯与平面波）：波函数用原子中心的高斯基组展开，电子密度和势则映射到实空间的多重网格上，用平面波（FFT）方法处理。",
          },
          {
            type: "p",
            text: "这个组合的动机是各取所长。高斯基组让 Hamiltonian 与重叠矩阵稀疏，基函数数量随体系近似线性增长，才有线性标度与轨道变换（OT）的空间；平面波网格让 Poisson 求解、密度积分和泛函评估都能用 FFT，代价随盒子体积与截断能增长。纯平面波方法里，真空层和空轨道会白白吃掉大量基函数，GPW 在分子、表面、液体这些「有大块真空」的体系上通常更省。",
          },
          {
            type: "formula",
            tex: "E[\\rho] = T_s[\\rho] + \\int v_{\\mathrm{ext}}(\\mathbf{r})\\,\\rho(\\mathbf{r})\\,d\\mathbf{r} + E_H[\\rho] + E_{xc}[\\rho]",
            caption: "Kohn–Sham 总能量的几项。GPW 在实空间网格上逐项累加，而不是把波函数展开成平面波。",
          },
          {
            type: "table",
            head: ["路线", "波函数表示", "擅长", "主要代价"],
            rows: [
              ["GPW（CP2K）", "高斯基组 + 实空间网格", "分子、表面、液体；大体系 MD；线性标度", "基组与赝势要配对，CUTOFF 要收敛"],
              ["纯平面波（VASP/QE）", "平面波", "致密周期固体、能带、声子", "真空层与空态成本高"],
              ["纯高斯基组（Gaussian）", "原子中心高斯基组", "小分子高精度 post-HF、光谱", "周期性支持有限，大体系标度差"],
            ],
            caption: "三条路线没有高下，只有是否匹配你的体系与问题。",
          },
          {
            type: "p",
            text: "代价是两套表示必须一致：基组要和赝势配对，`CUTOFF` 与 `REL_CUTOFF` 要收敛，否则误差不会自己消失。**GAPW**（Gaussian Augmented Plane Waves）把同一框架扩展到全电子计算，适合核心电子参与的过程，比如 XAS 或某些 NMR 参数，但明显更贵。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "GPW 不是「免费的午餐」",
            text: "高斯基组不是唯一的，`DZVP-MOLOPT-GTH` 只是常用起点；换了赝势就必须换匹配的基组。截断能也不是越大越好，而是要和基组一起做收敛测试。这两件事在第 6、7 章会展开。",
          },
        ],
      },
      {
        id: "1.3",
        title: "能算什么：一张能力地图",
        blocks: [
          {
            type: "p",
            text: "CP2K 不是单一任务的程序。下面这些活它都能做，而且共用同一套输入框架——这也是它的学习成本所在：关键词多，但结构统一。",
          },
          {
            type: "table",
            head: ["任务", "在 CP2K 里靠什么", "典型问题"],
            rows: [
              ["基态能量与力", "Quickstep DFT", "结合能、反应能、吸附能"],
              ["几何与晶胞优化", "`RUN_TYPE GEO_OPT` / `CELL_OPT`", "吸附构型、相稳定性、表面重构"],
              ["从头算分子动力学", "`RUN_TYPE MD`（BOMD）", "扩散、热运动、反应轨迹"],
              ["振动与热化学", "`VIBRATIONAL_ANALYSIS`", "频率、零点能、自由能"],
              ["电子结构分析", "`&DFT` 下的 `&PRINT` 节", "DOS/PDOS、能带、分子轨道、cube"],
              ["激发态与光谱", "TDDFT、GW、RPA、XAS", "吸收谱、芯能级谱"],
              ["增强采样", "metadynamics、路径积分", "自由能面、质子量子效应"],
              ["多尺度与高精度", "QM/MM、隐式溶剂、MP2/CCSD(T)", "酶、溶液、小体系基准"],
            ],
            caption: "同一份输入树，换 `RUN_TYPE` 与对应子节，就能从单点走到 MD。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "一个最小骨架：换 RUN_TYPE 就换任务",
            text: `&GLOBAL
  PROJECT demo
  RUN_TYPE ENERGY
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "上面这份骨架只有十几行，缺了体系与数值设置，跑不起来，但它已经把 CP2K 的整体形状说清楚了：`GLOBAL` 定任务，`FORCE_EVAL` 定方法。把 `RUN_TYPE` 从 `ENERGY` 改成 `GEO_OPT`、`MD` 或 `VIBRATIONAL_ANALYSIS`，再补上 `MOTION` 或对应子节，就是另一类计算。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "它不替你做的事",
            text: "CP2K 没有内置的可视化建模器，结构要靠外部工具准备；力场参数化、轨迹后处理、作图也不在它的职责里。另外，k 点支持集中在 QUICKSTEP 的部分功能，做金属、能带、声子之前先查手册确认对应方法是否支持。",
          },
          {
            type: "p",
            text: "建模这一条值得单独强调。实验 CIF/PDB 里常有 disorder、部分占据、缺失的氢原子或反离子，**不能直接丢进计算**。优先用计算数据库或 benchmark 里的结构，再用可视化程序检查周期性、原子重叠和电荷。",
          },
        ],
      },
      {
        id: "1.4",
        title: "典型体系与规模：成本由什么决定",
        blocks: [
          {
            type: "p",
            text: "官方定位是 large-scale HPC。但规模不是一个固定数字，而是几个成本项乘起来的结果：原子数、基组大小、截断能、k 点、SCF 算法，以及你愿意等多久。同一个体系，GGA 单点与杂化泛函的成本能差一个量级以上。",
          },
          {
            type: "table",
            head: ["成本项", "怎么影响", "实践建议"],
            rows: [
              ["原子数 N", "常规 DFT 大致 N²–N³；线性标度方法可接近 N", "先用小体系做方法收敛"],
              ["基组", "函数越多，矩阵与网格乘积越大", "MOLOPT 系列是性价比起点"],
              ["`CUTOFF` / `REL_CUTOFF`", "网格越细，FFT 与积分越贵", "做收敛测试，不盲目加"],
              ["k 点", "点数乘以每点成本；只对周期体系", "金属才需要密网格"],
              ["SCF 方案", "对角化 vs OT", "大绝缘体优先 OT"],
            ],
          },
          {
            type: "p",
            text: "周期性边界条件覆盖 3D、2D、1D、0D：晶体、表面与二维材料、纳米管或链、孤立分子都能放。做 0D 时盒子要足够大，避免波函数与密度在镜像之间交叠；做 2D 时真空层同理。",
          },
          {
            type: "p",
            text: "常见体系包括水与溶液盒子、表面吸附与催化、非晶与界面、以及用 QM/MM 处理的酶活性中心。BOMD 能跑多长，取决于每一步的电子结构代价与机器规模：几十到几百原子、ps 量级是常见范围，线性标度方法与好的并行能把边界往外推。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "先定精度，再谈规模",
            text: "「能算多大」这个问题没有意义，除非先回答「要什么精度」。同一体系，DZVP 基组加 PBE 与 TZV2P 加杂化泛函，能做的原子数可能差一个量级。先写清楚目标精度，再选方法。",
          },
        ],
      },
      {
        id: "1.5",
        title: "和 VASP、Quantum ESPRESSO、Gaussian 的分工",
        blocks: [
          {
            type: "p",
            text: "这几个程序经常被放在一起比较，但它们的设计目标不同。下面的对比只看定位，不评价优劣。",
          },
          {
            type: "compare",
            left: {
              title: "这些活 CP2K 很顺手",
              items: [
                "大体系、长时间的 BOMD 与增强采样",
                "QM/MM、隐式溶剂、团簇与液体",
                "线性标度 DFT（LS-DFT）与 OT",
                "0D–3D 混合周期性的体系",
                "同一套输入里做 DFT、post-HF 与性质分析",
              ],
            },
            right: {
              title: "这些活换工具更省事",
              items: [
                "纯平面波 PAW 的固体缺陷与声子工作流（VASP）",
                "DFPT 声子、NEB、能带的成熟教程链（QE）",
                "小分子高精度 post-HF 与光谱（Gaussian）",
                "需要图形界面建模与可视化的日常（外部工具）",
                "金属与强关联体系的成熟 k 点/DFT+U 生态",
              ],
            },
          },
          {
            type: "table",
            head: ["维度", "CP2K", "VASP", "Quantum ESPRESSO", "Gaussian"],
            rows: [
              ["波函数/基组", "高斯基组 + 平面波网格", "平面波 + PAW", "平面波 + 赝势", "原子中心高斯基组"],
              ["周期性", "0D–3D", "3D（表面用 slab + 真空）", "3D", "分子为主，PBC 支持有限"],
              ["强项", "大体系 BOMD、QM/MM、线性标度", "固体/表面/缺陷，生态成熟", "声子/DFPT、能带、开源平面波", "小分子 post-HF、光谱、基组体系"],
              ["输入风格", "分层 `&SECTION` 树", "INCAR / POSCAR / POTCAR", "namelist + 赝势文件", "路由行 + 坐标"],
              ["上手门槛", "中（树深、关键词多）", "低–中", "中", "低（分子）"],
            ],
            caption: "同一课题常常两个程序一起用：CP2K 做 MD 与大体系，VASP/QE 做能带与声子。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "别把 k 点当成默认能力",
            text: "CP2K 的 k 点支持集中在 QUICKSTEP 的部分功能里，并且仍在活跃开发。做金属、能带、声子之前，先确认手册里对应方法支持到什么程度；这也是它和 VASP/QE 最实际的能力差异之一。",
          },
        ],
      },
      {
        id: "1.6",
        title: "手册怎么读：三个入口，一条路径",
        blocks: [
          {
            type: "p",
            text: "手册分六个区，各有各的用法。不要从第一页开始顺序读——它是参考书，不是教材。",
          },
          {
            type: "table",
            head: ["区", "里面有什么", "什么时候来"],
            rows: [
              ["Getting Started", "安装、第一个计算、排错", "第一次上手"],
              ["Methods", "DFT、post-HF、MD、QM/MM 等方法的原理与操作", "想懂「为什么这样设」"],
              ["Technologies", "本征求解器、加速器、库、Python 接口", "性能与集成"],
              ["References", "Input Reference、文献、缩写、单位", "查关键词、查单位"],
              ["Development", "代码结构、规范、调试", "二次开发"],
              ["Releases", "Changelog、旧版手册", "版本差异"],
            ],
          },
          {
            type: "p",
            text: "日常最常用的三个入口：**Getting Started** 解决「跑不起来」，**Methods** 解决「为什么」，**Input Reference** 解决「这个关键词的默认值是多少」。查一个陌生关键词，先去 Input Reference 的对应 section 页；读完类型与默认值，再回 Methods 看方法背景。",
          },
          {
            type: "code",
            lang: "text",
            title: "Input Reference 的 URL 规律",
            text: `https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/MGRID.html
# 页面内锚点定位到具体关键词
https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/MGRID.html#cp2k-input-force-eval-dft-mgrid-cutoff`,
          },
          {
            type: "p",
            text: "路径就是输入树的路径：`FORCE_EVAL` 下 `DFT` 下 `MGRID`。记住这一点，你就能在不搜索的情况下拼出大多数页面地址。",
          },
          {
            type: "callout",
            kind: "info",
            title: "trunk 是开发版",
            text: "`manual.cp2k.org/trunk/` 对应开发分支，Input Reference 首页注明基于 2026.2 开发版。生产环境请用与你二进制版本一致的旧版手册（Releases → Older Manuals），否则默认值可能对不上，尤其是 `PRINT_LEVEL`、`EPS_SCF` 这类会随版本调整的项。",
          },
        ],
      },
      {
        id: "1.7",
        title: "学习路线：21 章怎么走",
        blocks: [
          {
            type: "p",
            text: "这套教程按「能跑 → 跑对 → 跑快」组织。下面的顺序不要跳，尤其是第 6–10 章：它们决定你的数字可不可信。",
          },
          {
            type: "steps",
            items: [
              { t: "打地基（第 1–5 章）", d: "装好环境、跑通水的单点能、看懂输入树与输出。这一段的目的是消除「黑箱感」。" },
              { t: "DFT 核心（第 6–10 章）", d: "CUTOFF 与网格、基组与赝势、泛函与色散、SCF 与 OT、周期性/k 点/自旋。" },
              { t: "结构与振动（第 11–13 章）", d: "几何与晶胞优化、NEB 过渡态、频率与热化学。" },
              { t: "动力学（第 14–15 章）", d: "MD 输入与系综、恒温器、时间步，以及增强采样。" },
              { t: "分析与性质（第 16–17 章）", d: "DOS/能带、电荷分析、IR/Raman、TDDFT 与 XAS。" },
              { t: "进阶与工程（第 18–21 章）", d: "QM/MM、隐式溶剂、ML 接口、性能并行、排错与科研配方。" },
            ],
          },
          {
            type: "p",
            text: "如果你已经有明确的课题，可以倒着走：先看第 21 章的配方，找到最接近的工作流，再回到对应章节补原理。但第 3–5 章至少要过一遍，否则后面的报错你读不懂。",
          },
          {
            type: "p",
            text: "命令行本身短得不像一个科学软件：两个参数，其余全在输入里。装好之后先确认版本，再跑第一个例子，看它是否以 `CP2K ENDED` 收尾：",
          },
          {
            type: "code",
            lang: "bash",
            title: "开始之前的三条命令",
            text: `# 1) 确认你跑的是哪个二进制、带哪些编译选项
cp2k.psmp -v

# 2) 跑一个输入（-i 输入，-o 输出）
cp2k.psmp -i h2o.inp -o h2o.out

# 3) 确认它真的跑完了
grep -n "CP2K ENDED" h2o.out`,
          },
          {
            type: "p",
            text: "如果机器上有多个核，第二条换成 `mpirun -np 4 -x OMP_NUM_THREADS=1 cp2k.psmp -i h2o.inp -o h2o.out` 就能并行。并行布局、输出分段、restart 与批处理脚本，第 5 章会逐条讲清楚。",
          },
          {
            type: "keypoints",
            items: [
              "CP2K 的核心是 Quickstep + GPW：高斯基组配平面波辅助网格",
              "它主用 BOMD，强项是大体系 DFT、MD、QM/MM 与线性标度",
              "与 VASP/QE 的差别不只在输入格式，还在 k 点支持与平面波生态",
              "手册三个入口：Getting Started 上手、Methods 懂原理、Input Reference 查关键词",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "先跑，再回来读",
            text: "第 3 章会给一份 40 行的水分子输入。跑通之后再回来看 1.2 的 GPW，会比现在硬读十遍有用得多。这一章的任务只是建立地图，不是记住细节。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "CP2K 里提供 DFT 计算的核心模块是哪一个？",
        options: ["CPMD", "Quickstep", "DBCSR", "libint"],
        answer: 1,
        explain: "Quickstep 是 CP2K 的电子结构模块，GPW/GAPW 都在这里实现。CPMD 是另一条历史路线，DBCSR 是稀疏矩阵库，libint 是积分库。",
      },
      {
        q: "GPW 指的是什么？",
        options: [
          "只用平面波展开波函数",
          "高斯基组描述波函数，平面波辅助网格处理密度与势",
          "一种赝势的名字",
          "GPU 加速的并行方案",
        ],
        answer: 1,
        explain: "GPW = Gaussian and Plane Waves。高斯基组让矩阵稀疏、基函数数量可控；实空间网格用 FFT 处理密度、Poisson 求解与泛函评估。",
      },
      {
        q: "关于「CP2K」这个名字，下面哪种说法正确？",
        options: [
          "它只能做 Car–Parrinello 分子动力学",
          "CP 指 Car–Parrinello，2K 指 2000 年；但主用的表述是 BOMD",
          "CP 是 C++ 的缩写",
          "2K 表示支持 2000 个原子",
        ],
        answer: 1,
        explain: "名字纪念 Car–Parrinello 与 2000 年。历史上 CPMD 与 BOMD 是两条路线，CP2K 里原始 CPMD 表述并未实现，主用 BOMD。",
      },
      {
        q: "下面哪一项不是 CP2K 的强项？",
        options: [
          "大体系的从头算分子动力学",
          "QM/MM 与隐式溶剂",
          "线性标度 DFT",
          "内置图形界面建模与结构可视化",
        ],
        answer: 3,
        explain: "CP2K 没有内置可视化建模器，结构要靠外部工具准备。MD、QM/MM、线性标度都是它的设计目标。",
      },
      {
        q: "想知道 `CUTOFF` 的默认值和合法单位，最该查哪里？",
        options: [
          "Getting Started 的安装页",
          "Input Reference 里 MGRID 那一页",
          "Releases 的 Changelog",
          "随便一个教程博客",
        ],
        answer: 1,
        explain: "Input Reference 按输入树组织，`CUTOFF` 在 `FORCE_EVAL/DFT/MGRID` 页，写明类型、默认值（280 Ry）与说明；教程只能作参考。",
      },
    ],
    terms: [
      { t: "Quickstep", en: "Quickstep", d: "CP2K 的电子结构模块，GPW/GAPW、SCF、OT 都在这里实现。" },
      { t: "GPW", en: "Gaussian and Plane Waves", d: "高斯基组描述波函数、平面波辅助网格处理密度与势的混合方法。" },
      { t: "BOMD", en: "Born–Oppenheimer molecular dynamics", d: "每一步都重新求解电子基态再移动原子核的从头算分子动力学。" },
      { t: "赝势", en: "pseudopotential", d: "用有效势代替内层电子，只显式处理价电子；CP2K 常用 GTH 系列。" },
      { t: "基组", en: "basis set", d: "把分子轨道展开成原子中心函数的集合；越大越灵活也越贵。" },
      { t: "周期性边界条件", en: "PBC", d: "用镜像复制模拟无限体系；CP2K 支持 3D、2D、1D 与 0D。" },
      { t: "线性标度 DFT", en: "linear-scaling DFT", d: "让计算量随体系大小近似线性增长的方法族，适合大绝缘体。" },
    ],
    sources: [
      { t: "CP2K Manual", url: "https://manual.cp2k.org/trunk/index.html" },
      { t: "Foreword and FAQ", url: "https://manual.cp2k.org/trunk/getting-started/foreword-and-faq.html" },
      { t: "Density Functional Theory", url: "https://manual.cp2k.org/trunk/methods/dft/index.html" },
    ],
  };
})();