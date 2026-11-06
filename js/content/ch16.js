(function () {
  "use strict";

  window.CONTENT = window.CONTENT || {};

  window.CONTENT["ch16"] = {
    id: "ch16",
    num: 16,
    part: "分析与性质",
    title: "电子结构分析：从本征值到成键图像",
    subtitle: "DOS/PDOS、能带、布居分析与分子轨道",
    hours: 4,
    level: "进阶",
    intro:
      "算完一个体系拿到总能量只是开始。这一章讲怎么让 CP2K 把本征值、投影权重、布居数和轨道系数吐出来，以及怎么从这些数字回答「为什么这个键强」「电荷跑到哪里去了」。所有输出都依赖同一个前提：电子结构本身收敛得够好。",
    goals: [
      "写出产出 DOS/PDOS 的输入，并说清能量零点与展宽怎么影响读图",
      "用 &BANDSTRUCTURE 沿高对称路径取能带，知道 k 网格与路径的区别",
      "读懂 Mulliken 与 Löwdin 布居的差异和各自的局限",
      "导出分子轨道 cube 文件，并用 PDOS 与布居拼出成键/电荷转移的结论"
    ],
    sections: [
      {
        id: "16.1",
        title: "三张图回答三个不同的问题",
        blocks: [
          {
            type: "p",
            text: "电子结构分析最常见的误区，是把所有输出当成同一件事的不同画法。实际上它们回答的问题不一样：态密度回答「哪些能量上有多少态」，能带回答「这些态随 k 怎么走」，布居回答「电子算在谁头上」，轨道图回答「这个态在空间中长什么样」。"
          },
          {
            type: "table",
            caption: "想要什么，就用哪一段",
            head: ["问题", "输出", "CP2K 入口"],
            rows: [
              ["能量分布、带隙位置、金属性", "DOS / PDOS", "&DFT%&PRINT%&DOS（含 &PDOS）"],
              ["色散、直接/间接带隙、有效质量", "能带图", "&FORCE_EVAL%&PROPERTIES%&BANDSTRUCTURE"],
              ["原子电荷、键的离子性、自旋分布", "布居分析", "&DFT%&PRINT%&MULLIKEN 与 &LOWDIN"],
              ["轨道形状、成键/反键特征", "cube / Molden 文件", "&DFT%&PRINT%&MO_CUBES 与 &MO_MOLDEN"]
            ]
          },
          {
            type: "p",
            text: "四者共享同一份本征值与本征矢。所以**先保证 SCF 收敛**：`EPS_SCF` 太松时，轨道系数与布居数都会抖，DOS 峰位也会跟着飘。分析计算不要沿用「跑动力学时够用」的收敛标准。"
          },
          {
            type: "callout",
            kind: "info",
            title: "能量的参照系要先定",
            text: "CP2K 输出的本征值是绝对能量（相对赝势零点），数值动辄 −0.5 hartree 附近。所有图都要先平移：以 HOMO 或费米能为零点。没有统一零点的两张图放在一起比较，几乎一定会读错。"
          },
          { type: "keypoints", items: ["DOS、能带、布居、轨道图是四个不同问题", "它们共用一份本征值，收敛太松全都会抖", "任何比较之前先把能量零点统一"] }
        ]
      },
      {
        id: "16.2",
        title: "DOS 与 PDOS：一份可运行的输入",
        blocks: [
          {
            type: "p",
            text: "下面这个输入对水分子做单点计算并输出态密度。要点只有三处：`ADDED_MOS` 决定算多少个空轨道（不算就没有导带侧的峰），`&PDOS` 打开按元素分解，`DELTA_E` 是能量网格间距。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_dos.inp：单点能 + DOS/PDOS",
            note: "完整可运行。12 Å 的盒子足够大，镜像之间的相互作用可以忽略；周期性取默认的 XYZ。",
            text: `&GLOBAL
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    ADDED_MOS 20
    &SCF
      &DIAGONALIZATION
      &END DIAGONALIZATION
    &END SCF
    &PRINT
      &DOS
        DELTA_E 0.01
        &PDOS
          COMPONENTS T
        &END PDOS
      &END DOS
    &END PRINT
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 12.0
    &END CELL
    &COORD
      O  0.0000  0.0000  0.0000
      H  0.7570  0.5860  0.0000
      H -0.7570  0.5860  0.0000
    &END COORD
    &KIND H
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
    &KIND O
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`
          },
          {
            type: "p",
            text: "这里显式写了 `&SCF%&DIAGONALIZATION`，原因是要空的轨道：默认的 OT 只解占据态，`ADDED_MOS` 写了也没用，DOS 的导带侧会是空的。走对角化才能拿到空态。不写 `RUN_TYPE` 时默认就是单点能，不写 `&XC` 时默认泛函是 PBE，想换就自己补。"
          },
          {
            type: "list",
            items: [
              "`DELTA_E 0.01`：DOS 的自变量网格间距（eV）。0.01 够细，0.05 会明显削峰。",
              "`ADDED_MOS 20`：额外算 20 个空轨道。不写就只能看到占据态那一侧。",
              "`&PDOS%COMPONENTS T`：把每个元素的投影再拆成分量（s、py、pz、px 等），否则只有一条 total 曲线。",
              "想让 DOS 变成平滑曲线（CP2K 2026.2 起）就在 `&DOS` 里加 `&CURVE` 与 `&BROADEN`，16.3 节给了片段。"
            ]
          },
          {
            type: "p",
            text: "运行后目录里会出现总 DOS 文件与每个元素一套 PDOS 文件。PDOS 用的投影是 Löwdin 型（把系数按 S^{1/2} 变换后取模方），**不是** Mulliken 投影，所以 PDOS 的分解与 16.5 节的 Mulliken 电荷不会严丝合缝地对上，这是正常的。"
          },
          {
            type: "callout",
            kind: "warn",
            title: "单个 PDOS 文件的 total 不是全局 DOS",
            text: "每个元素文件里的 total 只是该元素所有轨道的贡献之和。把几个元素的 total 直接相加才是全局 DOS 的近似，而且因为投影不完整，加出来的和不会严格等于总 DOS。"
          },
          { type: "keypoints", items: ["ADDED_MOS 决定有没有空态，DELTA_E 决定分辨率", "PDOS 是 Löwdin 型投影，与 Mulliken 电荷不同源", "分析前把 EPS_SCF 收紧"] }
        ]
      },
      {
        id: "16.3",
        title: "读 DOS 的四个陷阱",
        blocks: [
          {
            type: "p",
            text: "DOS 图形看起来最直观，也最容易读出错误结论。四个坑按出现频率排列：能量零点没对齐、展宽掩盖了细节、k 点太稀、空态不够。"
          },
          {
            type: "p",
            text: "第一是零点。`ENERGY_ZERO` 可取 `FERMI`（有 smearing 时的费米能）、`HOCO`（最高占据晶格轨道）、`ABSOLUTE`（不平移）。设为 `AUTO` 时，有 smearing 用费米能，否则用 HOCO。与能带图对比时两边必须用同一个零点，否则带隙看起来会差出一个常数。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "开启展宽曲线（CP2K 2026.2 起）",
            note: "片段，作为 &DFT%&PRINT%&DOS 里的子节。老版本没有 &CURVE，只有未展宽的离散数据。",
            text: `&DOS
  DELTA_E 0.01
  &CURVE
    ENERGY_UNIT EV
    ENERGY_ZERO AUTO
    &BROADEN
      WIDTH [eV] 0.1
    &END BROADEN
  &END CURVE
&END DOS`
          },
          {
            type: "p",
            text: "第二是展宽。`&BROADEN%WIDTH` 是半高全宽（FWHM），默认 0.1 eV。展宽只是视觉平滑，**不会**真的补出缺失的态：展宽太大会把两个相邻峰糊成一个，让你误判简并；太小则曲线锯齿状，看起来像噪声。比较峰位时宁可用未展宽的数据点。"
          },
          {
            type: "list",
            items: [
              "k 点太稀：DOS 的形状主要由 k 采样决定，展宽替代不了密网格。金属体系尤其要加密。",
              "空态不够：`ADDED_MOS` 太少时导带侧被硬截断，别把截断当成带边。",
              "Gamma-only 的分子：展宽曲线只是若干离散能级的叠加，谈不上「态密度」。",
              "整数占据与展宽混用：开 smearing 后占据数不再是 0/1，比较电荷时要意识到这一点。"
            ]
          },
          { type: "keypoints", items: ["ENERGY_ZERO 决定零点，比较前必须统一", "BROADEN 只做视觉平滑，不改物理", "k 网格与 ADDED_MOS 是分辨率与范围的硬约束"] }
        ]
      },
      {
        id: "16.4",
        title: "能带结构：&BANDSTRUCTURE",
        blocks: [
          {
            type: "p",
            text: "能带就是沿一条高对称路径取一串 k 点、每个 k 点算一次本征值。注意 CP2K 里有两个入口：`&FORCE_EVAL%&PROPERTIES%&BANDSTRUCTURE` 是现在的写法，`&DFT%&PRINT%&BAND_STRUCTURE` 是旧写法（要求 `&KPOINT_SET`）。新输入请用前者。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "沿 Γ–X–M 取能带",
            note: "片段，放在 &FORCE_EVAL 内、与 &DFT 并列。坐标默认用倒格子基矢分数（B_VECTOR）。",
            text: `&PROPERTIES
  &BANDSTRUCTURE
    &BANDSTRUCTURE_PATH
      NPOINTS 20
      SPECIAL_POINT GAMMA 0.0 0.0 0.0
      SPECIAL_POINT X 0.5 0.0 0.0
      SPECIAL_POINT M 0.5 0.5 0.0
    &END BANDSTRUCTURE_PATH
  &END BANDSTRUCTURE
&END PROPERTIES`
          },
          {
            type: "p",
            text: "`NPOINTS` 是**每一段路径**上的点数，不是总点数；给 20 意味着 Γ→X 与 X→M 各取 20 个。点太少会出现折线，点太多只是更贵，形状不会变。`SPECIAL_POINT` 后面依次是标签与三个坐标，`UNITS` 默认 `B_VECTOR`（倒格子分数的分数坐标），也可以写 `CART_ANGSTROM`（单位 2π/Å）。"
          },
          {
            type: "p",
            text: "三个方向的周期性要一致：只有 `PERIODIC XYZ` 的体系才能画三维能带；二维材料在真空方向上周期性为 NONE 时，那条方向的色散没有物理意义。"
          },
          {
            type: "table",
            caption: "带隙的三种口径",
            head: ["概念", "取法", "注意"],
            rows: [
              ["直接带隙", "同一个 k 上导带底与价带顶之差", "光吸收的阈值"],
              ["间接带隙", "所有 k 上 VBM 与 CBM 之差（可能在不同 k）", "需要声子参与才能跃迁"],
              ["HOMO-LUMO 差", "分子或 Gamma 点两本征值之差", "不等于光学激发能，别混用"]
            ]
          },
          {
            type: "callout",
            kind: "warn",
            title: "用对泛函再看数值",
            text: "半局域泛函通常低估带隙，这是方法本身的系统性偏差，不是算错了。报数值时要写清泛函、基组与 k 网格；跨方法比较带隙没有意义。"
          },
          { type: "keypoints", items: ["用 &PROPERTIES%&BANDSTRUCTURE，不是旧的 &BAND_STRUCTURE", "NPOINTS 是每段路径的点数", "直接/间接带隙要分清，与光学激发能不能混"] }
        ]
      },
      {
        id: "16.5",
        title: "布居分析：Mulliken 与 Löwdin",
        blocks: [
          {
            type: "p",
            text: "布居分析把电子密度分摊到原子上，用来回答「这个原子带多少电」。问题在于分摊方式不唯一：Mulliken 按原子轨道系数的乘积直接分配交叠项，Löwdin 先把基组正交化（乘 S^{1/2}）再分配。两种都不唯一，都依赖基组，但能给出趋势。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "同时打开两种布居",
            note: "片段，放在 &DFT%&PRINT 里。&MULLIKEN 默认 MEDIUM，&LOWDIN 默认 HIGH。",
            text: `&PRINT
  &MULLIKEN ON
    &EACH
      JUST_ENERGY 1
    &END EACH
  &END MULLIKEN
  &LOWDIN ON
    &EACH
      JUST_ENERGY 1
    &END EACH
  &END LOWDIN
&END PRINT`
          },
          {
            type: "p",
            text: "`&EACH` 决定什么时候打印：`JUST_ENERGY` 是单点计算，`MD`、`GEO_OPT`、`CELL_OPT` 则按步数打印。动力学里每一步都打会拖慢速度、撑爆输出，只在你确实要跟踪电荷演化时才开。"
          },
          {
            type: "compare",
            left: {
              title: "Mulliken",
              items: ["实现简单、几乎所有程序都有", "对基组极敏感，加弥散函数后电荷可能离谱", "原子电荷之和严格等于总电子数，便于自检"]
            },
            right: {
              title: "Löwdin",
              items: ["先正交化，数值上更稳定", "仍然依赖基组，绝对值不可跨体系比较", "同一体系内看趋势比 Mulliken 稳"]
            }
          },
          {
            type: "p",
            text: "输出里每个原子有净电荷与自旋布居。判读时看的是**趋势**：比较同一体系的不同构型、或同族元素构成的相似结构。想把布居数直接说成「氧化态」，通常站不住脚——基组一换，数字就变，而氧化态是整数。"
          },
          {
            type: "callout",
            kind: "tip",
            title: "自检一行就够",
            text: "把所有原子的 Mulliken 电荷加起来，应等于体系总电荷（中性体系为 0）。若不等于，先怀疑基组/赝势不全，而不是物理。"
          },
          { type: "keypoints", items: ["Mulliken 按系数直接分，Löwdin 先正交化", "两者都依赖基组，只比趋势不比绝对值", "电荷求和是快速自检"] }
        ]
      },
      {
        id: "16.6",
        title: "分子轨道与 cube 文件",
        blocks: [
          {
            type: "p",
            text: "要把「哪个轨道在成键」画出来，就得把系数写到文件里。CP2K 提供几条路：`&MO` 打文本、`&MO_MOLDEN` 写可视化的 Molden 文件、`&MO_CUBES` 写实空间格点、`&MO_KP` 处理 k 点体系、`&TREXIO` 输出结构化 HDF5。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "导出 HOMO−2 到 LUMO+2 共六个轨道的 cube",
            note: "片段，放在 &DFT%&PRINT 里。STRIDE 决定格点抽稀，是控制文件体积的关键。",
            text: `&PRINT
  &MO_CUBES
    NHOMO 3
    NLUMO 3
    STRIDE 2 2 2
  &END MO_CUBES
  &MO_MOLDEN
    NLUMO 10
  &END MO_MOLDEN
&END PRINT`
          },
          {
            type: "p",
            text: "`NHOMO 3` / `NLUMO 3` 表示占据侧与空态侧各取 3 个，实际导出的是这 6 个轨道。`STRIDE` 默认 `2 2 2`，即每个方向隔一个格点取一个；设成 `1 1 1` 是全分辨率，文件体积会放大八倍。cube 文件是固定宽格式的文本，后处理时不要用会重排空白的解析器。"
          },
          {
            type: "list",
            items: [
              "`&MO_MOLDEN` 只支持 Gamma 点，分子体系的日常可视化首选。",
              "`&MO_KP` 输出 `.mokp`，供 k 点体系的轨道后处理，2026.2 起可用。",
              "`&TREXIO` 需要编译时带 TREXIO 与 HDF5，产出单个 `.h5` 文件。",
              "`NLUMO 0` 表示不导出空轨道，`-1` 表示全部——后者在稍大的体系里会产生巨量文件。"
            ]
          },
          {
            type: "callout",
            kind: "info",
            title: "轨道的整体相位是任意的",
            text: "本征矢乘以 −1 仍是同一个轨道。两张图颜色相反不代表物理不同；只有相对符号（成键/反键的节点结构）才有意义。"
          },
          { type: "keypoints", items: ["文本用 &MO，可视化用 &MO_MOLDEN，实空间用 &MO_CUBES", "STRIDE 与 NLUMO 决定文件体积", "轨道整体相位任意，只看节点结构"] }
        ]
      },
      {
        id: "16.7",
        title: "把结论拼起来",
        blocks: [
          {
            type: "p",
            text: "单个输出都不足以支撑结论。一个能站住的成键判断通常由三块证据组成：PDOS 显示某元素的分量落在哪个能量区间，布居显示电荷往哪个原子偏移，轨道图显示这些态在空间上是不是重叠的成键组合。三者一致，结论才稳。"
          },
          {
            type: "steps",
            items: [
              { t: "先定零点与收敛", d: "统一能量零点，确认 EPS_SCF 足够紧，再谈图。" },
              { t: "看 PDOS 的归属", d: "确认关键峰是哪个元素、哪个角量子数贡献的。" },
              { t: "看布居的转移方向", d: "用 Mulliken 与 Löwdin 的趋势互相印证，不迷信单个数字。" },
              { t: "看轨道空间形状", d: "导出相关轨道，检查是否满足成键/反键的对称性。" }
            ]
          },
          {
            type: "demo",
            id: "units",
            title: "单位与能量换算",
            desc: "分析输出里 hartree、eV、cm⁻¹ 混着出现，先把换算练熟再读谱。"
          },
          {
            type: "p",
            text: "最后提醒一句：所有分析输出都是**对同一个电子结构的不同侧面描述**。如果 PDOS 说某个态在氧上、布居说电子跑到了金属上、轨道图却在金属上找不到对应形状，先怀疑输入不一致（比如 PDOS 与轨道来自两次不同参数的计算），而不是急着解释物理。"
          },
          {
            type: "callout",
            kind: "key",
            title: "不一致就是线索",
            text: "三类输出互相矛盾时，最可能的原因是计算设置不同（泛函、基组、ADDED_MOS、k 网格）或收敛不足，而不是发现新物理。先把两次计算对齐，再谈结论。"
          },
          { type: "keypoints", items: ["结论要由 PDOS、布居、轨道三块证据共同支撑", "输出矛盾时先查设置与收敛", "报数值必须带泛函、基组、k 网格"] }
        ]
      }
    ],
    quiz: [
      {
        q: "`ADDED_MOS 20` 的作用是什么？",
        options: ["把 20 个占据轨道冻结", "额外计算 20 个空轨道，让 DOS 有导带侧", "把能量网格加密到 20 点", "设定 20 个 k 点"],
        answer: 1,
        explain: "ADDED_MOS 决定额外求解的未占据轨道数目；不设或太小，导带侧会被硬截断。"
      },
      {
        q: "`&BROADEN%WIDTH` 的物理含义是？",
        options: ["能量网格间距", "高斯展宽的半高全宽（FWHM）", "k 点间距", "占据数的上下限"],
        answer: 1,
        explain: "WIDTH 是展宽的半高全宽，默认 0.1 eV，只影响曲线的平滑外观，不改变本征值。"
      },
      {
        q: "关于 PDOS 的投影方式，下面哪句正确？",
        options: ["它是 Mulliken 投影，与 Mulliken 电荷同一套", "它是 Löwdin 型投影，与 Mulliken 电荷不同源", "它是实空间电荷密度的切片", "它由基组文件的默认设置决定"],
        answer: 1,
        explain: "PDOS 用 S^{1/2} 变换后的系数取模方，是 Löwdin 型投影，所以和 Mulliken 电荷不会严格对应。"
      },
      {
        q: "画能带时 `NPOINTS 20` 意味着什么？",
        options: ["整条路径共 20 个点", "每一段路径各 20 个点", "每个原子 20 个基函数", "k 网格是 20×20×20"],
        answer: 1,
        explain: "NPOINTS 是每段高对称路径上的采样点数，路径有几段就有几倍的 k 点。"
      },
      {
        q: "Mulliken 电荷出现异常大（比如氧上是 −3）时，最可能的原因是？",
        options: ["体系真的有 −3 价氧", "基组含弥散函数导致分配失真", "SCF 收敛得太好", "k 点太少"],
        answer: 1,
        explain: "Mulliken 对基组极敏感，弥散函数会把交叠项摊出离谱数值；此时应改用 Löwdin 或看趋势。"
      }
    ],
    terms: [
      { t: "态密度", en: "Density of States", d: "单位能量区间内的电子态数目，由本征值按能量统计（可加展宽）得到。" },
      { t: "投影态密度", en: "Projected DOS", d: "把总态密度按元素或角量子数分解，用 Löwdin 型投影权重累加得到。" },
      { t: "高对称路径", en: "Band Path", d: "倒空间中连接特殊 k 点（Γ、X、M 等）的折线，用于画能带。" },
      { t: "Mulliken 布居", en: "Mulliken Population", d: "按原子轨道系数乘积直接分配交叠项得到的原子电荷，对基组敏感。" },
      { t: "Löwdin 布居", en: "Löwdin Population", d: "先把基组正交化（乘 S^{1/2}）再分配电子的布居分析，数值更稳定。" },
      { t: "cube 文件", en: "Gaussian Cube", d: "记录实空间格点上标量场（如轨道振幅）的固定宽文本格式，用于可视化。" },
      { t: "展宽", en: "Broadening", d: "给离散本征值加上有限宽度函数，使 DOS 曲线连续，参数为 FWHM。" }
    ],
    sources: [
      { t: "CP2K 手册：DOS", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/dos.html" },
      { t: "CP2K 手册：Band Structure", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/band/index.html" },
      { t: "CP2K 手册：Population Analysis", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/population/index.html" },
      { t: "CP2K 手册：Molecular Orbitals", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/molecular_orbitals.html" }
    ]
  };
})();