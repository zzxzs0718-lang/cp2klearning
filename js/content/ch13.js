(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch13"] = {
    id: "ch13",
    num: 13,
    part: "结构与振动",
    title: "振动与热化学",
    subtitle: "从 Hessian 到频率、零点能、IR/Raman 强度",
    hours: 3,
    level: "高级",
    intro:
      "优化告诉你结构稳定，振动分析告诉你它为什么稳定、以及它会不会吸收红外光。这一章从 Hessian 的有限差分讲起，把频率、零点能、热化学和 IR/Raman 强度串成一条线，最后讲虚频怎么诊断、同位素替换怎么做——这两件事在判断「这是不是过渡态」时几乎是必用的。",
    goals: [
      "说清 CP2K 用有限差分构造 Hessian 的流程，以及为什么频率计算要 6N 次单点",
      "读懂频率表：实频、虚频、约化质量与 3N−6 个振动自由度的来历，并知道虚频意味着什么",
      "打开热化学，正确设置温度与压力，并从输出里取出零点能、熵与吉布斯自由能",
      "用 MOMENTS 与 LINRES 得到 IR/Raman 强度，并用 MASS 做同位素替换",
    ],
    sections: [
      {
        id: "13.1",
        title: "频率从哪来：Hessian 的特征值",
        blocks: [
          {
            type: "p",
            text: "在极小点附近把能量展开到二阶：$E(\\mathbf{R}) \\approx E_0 + \\frac{1}{2}\\Delta\\mathbf{R}^{\\mathsf T}\\mathbf{H}\\Delta\\mathbf{R}$，其中 $\\mathbf{H}$ 是 Hessian（能量对原子坐标的二阶导数）。把 $\\mathbf{H}$ 用原子质量加权、再对角化，得到 3N 个本征值，开根号就是 3N 个频率。",
          },
          {
            type: "p",
            text: "其中 6 个（线性分子是 5 个）对应整体平动和转动，频率接近 0；剩下的 3N−6 个才是真正的振动。CP2K 默认会把这几个刚体模式从 Hessian 里投影掉，所以你看到的频率表不会从 0 开始。对周期性固体，这个投影不该做，用 `FULLY_PERIODIC T` 关掉它。",
          },
          {
            type: "p",
            text: "CP2K 不做解析 Hessian，用的是**有限差分**：对每个原子沿 $\\pm x, \\pm y, \\pm z$ 各位移一次，算一次力，用力的差分近似二阶导数。所以一次频率计算的开销是 **6N 次单点计算**（位移取正负两侧、力可以复用的话是 6N 次能量+力）。这也是为什么频率计算比优化本身还贵。",
          },
          {
            type: "key",
            items: [
              { k: "DX 1.0E-2", v: "有限差分步长，单位 Bohr；太小被数值噪声淹没，太大引入非谐误差", tag: "默认值" },
              { k: "INTENSITIES", v: "是否算 IR/Raman 强度，默认关闭，需要额外的偶极/极化率设置", tag: "常用" },
              { k: "THERMOCHEMISTRY", v: "是否算热化学数据，默认关闭；只适用于气相分子", tag: "常用" },
              { k: "TC_TEMPERATURE", v: "热化学温度，默认 273.15 K", tag: "默认值" },
              { k: "FULLY_PERIODIC", v: "默认 F；设为 T 则不做平动/转动投影，用于固体", tag: "易错" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "先在极小点上算频率",
            text: "Hessian 是在某个几何构型上算的。如果这个构型还没优化到力收敛，你算出来的就不是「这个结构的频率」，而是「某个半路上点的频率」——虚频会莫名其妙地冒出来，而且随优化步数漂移。频率计算前务必确认 GEO_OPT 的四个判据全 YES。",
          },
        ],
      },
      {
        id: "13.2",
        title: "一份完整的频率输入",
        blocks: [
          {
            type: "p",
            text: "拿水分子做例子。和单点输入相比只多两处：`RUN_TYPE` 改成 `VIBRATIONAL_ANALYSIS`，以及末尾的 `&VIBRATIONAL_ANALYSIS` 块。盒子要留足真空，否则周期性镜像会把平动/转动模式污染成假的低频振动。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_vib.inp",
            text: `&GLOBAL
  PROJECT h2o_vib
  RUN_TYPE VIBRATIONAL_ANALYSIS
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 400
      REL_CUTOFF 50
    &END MGRID
    &QS
      EPS_DEFAULT 1.0E-12
    &END QS
    &SCF
      EPS_SCF 1.0E-8
      MAX_SCF 50
      &OT
        MINIMIZER DIIS
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 12.0
      PERIODIC NONE
    &END CELL
    &COORD
      O   0.000  0.000  0.117
      H   0.000  0.757 -0.468
      H   0.000 -0.757 -0.468
    &END COORD
    &KIND O
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
    &KIND H
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
  &END SUBSYS
&END FORCE_EVAL
&MOTION
  &VIBRATIONAL_ANALYSIS
    DX 1.0E-2
    &PRINT
      &MOLDEN_VIB
        FILENAME h2o_vib
      &END MOLDEN_VIB
      &HESSIAN
        FILENAME h2o_hessian
      &END HESSIAN
    &END PRINT
  &END VIBRATIONAL_ANALYSIS
&END MOTION`,
          },
          {
            type: "p",
            text: "`EPS_SCF` 这里给到 1.0E-8，比优化时更严一档：有限差分的力之差本身就在 10⁻⁴ 量级，SCF 残差要是同量级，频率就被噪声主导。同样，`CUTOFF`、`REL_CUTOFF`、基组也要用收敛过的值——频率对基组比对能量更敏感，因为它是二阶导数。",
          },
          {
            type: "table",
            head: ["输出/文件", "内容", "怎么用"],
            rows: [
              ["输出里的频率表", "每个模式的频率、约化质量、是否红外活性", "读振动频率、找虚频"],
              ["`MOLDEN_VIB`", "简正模的位移矢量（MOLDEN 格式）", "丢进可视化软件看每个原子怎么动"],
              ["`HESSIAN`", "Hessian 矩阵本身", "检查数值质量、或用别的程序后处理"],
              ["`&PRINT %CARTESIAN_EIGS`", "笛卡尔分量的本征值", "排查某个模式由哪些原子贡献"],
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "频率表怎么看第一眼",
            text: "先看有没有负数。全是正数 → 结构是极小点。恰好一个负的 → 可能是过渡态，去验证它。好几个负数 → 结构没收敛好，或者你把对称性约束错了。再看最低的几个实频：如果出现 10–50 cm⁻¹ 的「软模」，通常说明优化还没到位或盒子太小。",
          },
        ],
      },
      {
        id: "13.3",
        title: "读频率表：实频、虚频与零点能",
        blocks: [
          {
            type: "p",
            text: "一个非线性分子有 3N−6 个振动模式，水是 3 个。每个模式有一个频率（cm⁻¹）和一个约化质量。频率为负（CP2K 里直接打负数，有些程序写 $i\\omega$）意味着 Hessian 在这个方向上是负曲率——能量沿这个方向是极大，不是极小。",
          },
          {
            type: "p",
            text: "零点能（ZPE）是所有实频模式 $\\frac{1}{2}h\\nu$ 的和。它不是「可选的修正」，而是量子体系在 0 K 仍然拥有的振动能。比较不同物种、不同吸附位的能量时，ZPE 的差别常常和你要比较的能量差同量级。",
          },
          {
            type: "formula",
            tex: "E_{\\mathrm{ZPE}}\\,[\\mathrm{eV}] = \\frac{1}{2}\\times 1.23984\\times10^{-4}\\sum_i \\tilde{\\nu}_i\\,[\\mathrm{cm}^{-1}]",
            caption: "用波数直接算 ZPE：每个模式贡献 0.5 × ν̃ × 1.23984×10⁻⁴ eV",
          },
          {
            type: "p",
            text: "换算关系值得背下来：$1\\ \\mathrm{cm^{-1}} = 1.23984\\times10^{-4}\\ \\mathrm{eV}$，也就是 1000 cm⁻¹ ≈ 0.124 eV ≈ 12 kJ/mol。而 1 Hartree = 219474.6 cm⁻¹ = 27.211 eV = 2625.5 kJ/mol。报数时把单位写全，别让读者去猜。",
          },
          {
            type: "demo",
            id: "units",
            title: "动手：cm⁻¹、eV、kJ/mol 互相换算",
            desc: "把一个频率或一个能量在这几个单位之间来回换，顺便验证「1000 cm⁻¹ 大约多少 eV」这条心算规则。",
          },
          {
            type: "table",
            head: ["现象", "说明", "下一步"],
            rows: [
              ["几个 1–20 cm⁻¹ 的极低频", "平动/转动残余、盒子太小、优化没收敛", "加大真空、收紧优化判据"],
              ["恰好一个明显虚频", "候选过渡态", "可视化该模式，确认方向就是反应坐标"],
              ["多个虚频", "结构在高阶鞍点或没收敛", "重新优化，或检查约束/对称性"],
              ["所有频率偏高 5–10%", "常见于谐振近似 + 有限基组", "比较时统一用同一套方法，或乘经验因子"],
              ["吸附物出现虚假低频", "slab 未固定底层、真空不足", "检查约束与 cell 高度"],
            ],
          },
          {
            type: "callout",
            kind: "danger",
            title: "虚频不能靠「调大 DX」消掉",
            text: "看到虚频就去改 `DX`，是典型的掩耳盗铃。`DX` 只影响数值精度，不影响曲率的符号。真虚频只有两种解法：把结构优化得更好，或者承认它是鞍点。如果调 `DX` 后虚频从 −80 变成 −20 cm⁻¹，说明这个方向非常平坦，物理上本来就近于不稳定，值得认真检查。",
          },
        ],
      },
      {
        id: "13.4",
        title: "热化学：把频率变成自由能",
        blocks: [
          {
            type: "p",
            text: "有了频率，就能算配分函数，进而算内能、焓、熵、吉布斯自由能。CP2K 把这一整套放在 `&VIBRATIONAL_ANALYSIS` 里，用两个开关加两个参数控制：`THERMOCHEMISTRY T` 打开计算，`TC_TEMPERATURE` 与 `TC_PRESSURE` 给条件。**注意 CP2K 没有独立的 `&THERMOCHEMISTRY` 节**，网上抄到的这种写法是错的。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "300 K、1 atm 的热化学",
            text: `&MOTION
  &VIBRATIONAL_ANALYSIS
    DX 1.0E-2
    THERMOCHEMISTRY T
    TC_TEMPERATURE 298.15
    TC_PRESSURE 1.01325E+5
    &PRINT
      &MOLDEN_VIB
        FILENAME vib
      &END MOLDEN_VIB
    &END PRINT
  &END VIBRATIONAL_ANALYSIS
&END MOTION`,
          },
          {
            type: "p",
            text: "两个默认值要留意：`TC_TEMPERATURE` 默认 273.15 K（不是 298.15），`TC_PRESSURE` 默认 1.01325E+5 Pa（1 atm）。想报标准态数据就把温度改成 298.15。手册还写清了一条边界：热化学**只适用于气相分子**，不支持一般 k 点下的声子频率——固体、表面的晶格振动要走另一条路。",
          },
          {
            type: "table",
            head: ["量", "含什么", "典型用途"],
            rows: [
              ["零点能 ZPE", "0 K 下的振动零点能", "校正电子能量，比较异构体"],
              ["内能 / 焓", "电子能 + ZPE + 热振动贡献 + kT 项", "反应焓、吸附能（配合气相参考）"],
              ["熵 S", "平动 + 转动 + 振动 + 电子贡献", "自由能、平衡常数"],
              ["吉布斯自由能 G", "H − TS", "判断反应方向、比较不同温度下的稳定性"],
            ],
          },
          {
            type: "p",
            text: "做自由能对比时最常见的错误是「只给一边加校正」。反应 A → B，如果 A 有 ZPE 校正而 B 没有，那 0.1 eV 的差别足以颠倒结论。要么两边都校正，要么两边都不校正并明确说明是电子能差。另外低频模式的熵贡献很大且不可靠，很多流程会把 100 cm⁻¹ 以下的模式按谐振子处理并另作校正——这种选择必须写进方法里。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "热化学数字对低频模式极其敏感",
            text: "一个 20 cm⁻¹ 的假低频模式，在 300 K 下能贡献可观的熵，直接把 G 拉偏几十 meV。所以频率表里那些「接近 0 但不是 0」的模式要先处理掉：确认它们是真实的软模，还是真空不足/未收敛的数值产物。",
          },
        ],
      },
      {
        id: "13.5",
        title: "IR 强度：偶极矩对坐标的导数",
        blocks: [
          {
            type: "p",
            text: "红外吸收强度取决于振动过程中偶极矩变化多少：$\\partial \\boldsymbol{\\mu}/\\partial Q \\neq 0$ 的模式才是 IR 活性的。所以算 IR 强度需要两样东西——Hessian（已有）和**每一步位移上的偶极矩**。CP2K 里后者由 `&DFT %PRINT %MOMENTS` 提供，最后由 `INTENSITIES T` 把它们拼起来。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "IR 强度需要的最小设置",
            text: `&FORCE_EVAL
  &DFT
    &PRINT
      &MOMENTS
        PERIODIC F
        UNIT debye
      &END MOMENTS
    &END PRINT
  &END DFT
&END FORCE_EVAL
&MOTION
  &VIBRATIONAL_ANALYSIS
    DX 1.0E-2
    INTENSITIES T
  &END VIBRATIONAL_ANALYSIS
&END MOTION`,
          },
          {
            type: "p",
            text: "`INTENSITIES T` 的关键字文档说得很明确：偶极矩和/或极化率必须**在别处显式打开**，否则强度算不出来。对应关系是：IR 要 `&DFT %PRINT %MOMENTS`，Raman 要 `&PROPERTIES %LINRES %POLAR`，两者可以同时开。",
          },
          {
            type: "p",
            text: "周期性体系有个额外选择。`&MOMENTS PERIODIC T`（默认）用 Berry 相位公式算偶极，适用于绝缘体；`PERIODIC F` 用简单的偶极算符，此时**只有垂直于周期方向的分量是良定义的**。如果你算的是 slab 上吸附物的 IR，通常 slab 法向是真空，垂直分量正好是你要的；但要是算三维体相，就得认真考虑 Berry 相位这条路。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "PBC 下的高阶多极矩没实现",
            text: "`&MOMENTS` 的 `MAX_MOMENT` 默认 1，文档注明在周期性边界下大于 1 尚未实现；`MAGNETIC T` 也只在无 PBC 时才有实现。想要四极矩或磁性偶极的强度分析，只能在分子（`PERIODIC NONE`）体系里做。",
          },
        ],
      },
      {
        id: "13.6",
        title: "Raman 强度：极化率对坐标的导数",
        blocks: [
          {
            type: "p",
            text: "Raman 散射强度取决于极化率张量随振动怎么变。所以需要的是**每个位移上的极化率**，由线性响应模块算：`&FORCE_EVAL %PROPERTIES %LINRES %POLAR`。注意这个节本身有个逻辑开关，光写节名不算打开，必须给 `&POLAR ON`（或 `.TRUE.`）。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Raman 需要的设置",
            text: `&FORCE_EVAL
  &PROPERTIES
    &LINRES
      &POLAR ON
        DO_RAMAN T
        PERIODIC_DIPOLE_OPERATOR T
      &END POLAR
    &END LINRES
  &END PROPERTIES
&END FORCE_EVAL
&MOTION
  &VIBRATIONAL_ANALYSIS
    INTENSITIES T
  &END VIBRATIONAL_ANALYSIS
&END MOTION`,
          },
          {
            type: "p",
            text: "`PERIODIC_DIPOLE_OPERATOR T`（默认）用 Berry 相位偶极算符，Non-periodic 体系可以设 `F` 用局域算符。`DO_RAMAN` 默认就是 `T`，所以真正的开关是外层那个 `SECTION_PARAMETERS`——这是 CP2K 里很典型的一种「节名不是开关」的写法，第一次遇到一定会踩。",
          },
          {
            type: "p",
            text: "成本上，Raman 比 IR 贵一档：极化率要用线性响应（或有限场）对每个位移求一次，是「频率计算 × 响应计算」的乘积。做几十个原子的体系前，先用 `MODE_SELECTIVE` 只追你关心的几个模式试算，确认设置对了再全算。",
          },
          {
            type: "table",
            head: ["你要的", "必须打开", "额外注意"],
            rows: [
              ["IR 强度", "`INTENSITIES T` + `&DFT %PRINT %MOMENTS`", "周期体系注意 `PERIODIC` 与分量良定义问题"],
              ["Raman 强度", "`INTENSITIES T` + `&PROPERTIES %LINRES %POLAR ON`", "成本最高；`DO_RAMAN` 默认已开"],
              ["只是频率", "什么都不用额外开", "最便宜，先跑它确认结构"],
              ["简正模可视化", "`&PRINT %MOLDEN_VIB`", "看虚频方向必用"],
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "强度是相对量，比较要谨慎",
            text: "不同程序对 IR/Raman 强度的单位和标度约定不完全一样，实验谱还受温度、溶剂、仪器展宽影响。所以强度最适合用来判断「哪几个峰最强、相对次序对不对」，拿绝对数值和实验比高低通常意义不大。频率（峰位）比强度可靠得多。",
          },
        ],
      },
      {
        id: "13.7",
        title: "同位素替换与只追一个模式",
        blocks: [
          {
            type: "p",
            text: "同位素替换是识别振动归属的经典手段：把 H 换成 D，凡是含 H 振动的模式频率都会明显下降（近似按 $1/\\sqrt{m}$ 缩放），不含 H 的模式基本不动。CP2K 里不需要换基组或赝势，只要改质量：`&KIND` 下的 `MASS`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "把两个 H 换成 D",
            text: `&SUBSYS
  &KIND H
    BASIS_SET DZVP-MOLOPT-SR-GTH
    POTENTIAL GTH-PBE-q1
    MASS 2.014101778
  &END KIND
  &KIND O
    BASIS_SET DZVP-MOLOPT-SR-GTH
    POTENTIAL GTH-PBE-q6
  &END KIND
&END SUBSYS`,
          },
          {
            type: "p",
            text: "`MASS` 的文档说明是：如果没给（或给负值），质量由元素符号推断。所以只给 H 写 `MASS 2.014`，其余原子不受影响。整套输入其他部分一字不改，跑完对比两张频率表，就能把「这个峰来自 O–H 伸缩」这类判断坐实。注意电子结构完全没变（质量不进哈密顿量），变的只有动力学。",
          },
          {
            type: "p",
            text: "另一件常做的事是**只算一个模式**。验证过渡态时你只关心那个虚频，全算 3N−6 个纯属浪费。`&MODE_SELECTIVE` 用块 Davidson 直接从某个目标频率附近找解，比全对角化便宜一个量级。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "只追虚频附近的一个模式",
            text: `&MOTION
  &VIBRATIONAL_ANALYSIS
    DX 1.0E-2
    &MODE_SELECTIVE
      FREQUENCY -500.0
      LOWEST_FREQUENCY -2000.0
      INITIAL_GUESS ATOMIC
      EPS_NORM 2.0E-6
    &END MODE_SELECTIVE
  &END VIBRATIONAL_ANALYSIS
&END MOTION`,
          },
          {
            type: "p",
            text: "`FREQUENCY` 是你要找的目标值（给负值表示找虚频），`LOWEST_FREQUENCY` 控制打印下限，给负值才会把虚频打出来。`ATOMS` 可以把位移限制在部分原子上（做吸附物振动时省很多）；`RANGE` 按区间追多个模式，但文档提醒不保证覆盖完整；`NPROC_REP` 大于 1 时多个副本并行跑块 Davidson，一次追多个频率。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "MODE_SELECTIVE 可能漏模式",
            text: "只追一个模式意味着你放弃了「全局检查」。它能告诉你某个虚频存在、方向对不对，但不能证明没有别的虚频。最终确认「这是一阶鞍点」，还是得跑一次完整的频率计算——把 selective 当作前期快速迭代的工具，不要当作最终证据。",
          },
        ],
      },
      {
        id: "13.8",
        title: "精度来源与常见错误",
        blocks: [
          {
            type: "p",
            text: "频率是能量的二阶导数，对一切数值误差都更敏感。同样的 `CUTOFF` 和基组，能量可能已经收敛到 meV，频率却还差几十 cm⁻¹。所以频率计算不能沿用「单点够用」的设置，至少要验证一次。",
          },
          {
            type: "table",
            head: ["误差来源", "表现", "处理"],
            rows: [
              ["几何未收敛", "出现不该有的虚频，随步数漂移", "GEO_OPT 四判据全 YES 再算"],
              ["SCF 残差太大", "频率随机跳动、重复性差", "`EPS_SCF` 收到 1E-8"],
              ["`CUTOFF` / `REL_CUTOFF` 不足", "高频模式系统性偏差", "单独做一次截断能收敛测试"],
              ["基组太小", "键伸缩频率偏高，约化质量异常", "换 TZVP 级别复算关键模式"],
              ["盒子太小 / 真空不足", "虚假低频、平动模式被污染", "真空加到 10 Å 以上"],
              ["slab 底层未固定", "吸附物低频模式乱跳", "用 `&FIXED_ATOMS` 冻结体相部分"],
              ["`FULLY_PERIODIC` 设错", "固体里出现被投影掉的刚体模", "周期性固体设 T"],
            ],
          },
          {
            type: "steps",
            items: [
              { t: "先确认结构", d: "优化到四个判据全 YES，并且能量在最后几步稳定。" },
              { t: "只算频率", d: "不加 INTENSITIES / THERMOCHEMISTRY，先看虚频和低频，最便宜的一轮。" },
              { t: "做一次数值校验", d: "把 DX 改小或改大 2–5 倍复算同一模式，看频率漂移是否在你可接受的范围内。" },
              { t: "再加强度", d: "确认结构没问题后，才打开 MOMENTS / POLAR，避免白算昂贵的响应。" },
              { t: "记录全部设置", d: "DX、EPS_SCF、CUTOFF、基组、是否 FULLY_PERIODIC，写进方法段。" },
            ],
          },
          {
            type: "keypoints",
            items: [
              "频率来自质量加权 Hessian 的特征值；CP2K 用有限差分，成本是 6N 次单点",
              "3N−6 个振动模式（线性分子 3N−5）；`FULLY_PERIODIC T` 用于固体，不做平动转动投影",
              "热化学由 `THERMOCHEMISTRY T` + `TC_TEMPERATURE` / `TC_PRESSURE` 控制，没有独立的 `&THERMOCHEMISTRY` 节",
              "IR 要 `&DFT %PRINT %MOMENTS`，Raman 要 `&PROPERTIES %LINRES %POLAR ON`，两者都要配 `INTENSITIES T`",
              "同位素替换只改 `&KIND MASS`；`MODE_SELECTIVE` 可只追一个模式，但不能替代完整频率检查",
              "频率对几何、SCF、截断、基组都敏感，报数前至少做一次数值与参数校验",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "四章小结",
            text: "到这里，周期性（k 点、自旋、smearing）→ 结构优化（GEO_OPT/CELL_OPT）→ 反应路径（NEB/dimer）→ 振动（频率、热化学、光谱）这条主线就闭合了。每一步的输出都是下一步的输入，任何一环松了，后面的数字都会带着它的误差。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "CP2K 的频率计算为什么比几何优化贵得多？",
        options: [
          "因为要用更大的基组",
          "因为它用有限差分构造 Hessian，需要对每个原子的每个方向做位移并重算力，约 6N 次单点",
          "因为必须打开 smearing",
          "因为要额外算应力张量",
        ],
        answer: 1,
        explain: "CP2K 不做解析 Hessian，而是对 3N 个坐标方向做正负位移、用力的差分近似二阶导数，所以开销随原子数线性增长，大约是 6N 次单点。",
      },
      {
        q: "一个非线性分子的频率表里出现恰好一个明显虚频，最合理的解读是？",
        options: [
          "计算一定出错了，需要调大 DX",
          "该结构是候选过渡态，应可视化该模式并确认方向沿反应坐标",
          "说明开尔文温度设错了",
          "说明基组太小",
        ],
        answer: 1,
        explain: "一个负曲率方向正是一阶鞍点的特征。下一步是把该模式可视化，确认原子运动方向就是预期的反应坐标；多个虚频才说明结构没收敛好。",
      },
      {
        q: "关于 CP2K 的热化学设置，正确的是？",
        options: [
          "用独立的 `&THERMOCHEMISTRY` 节打开",
          "在 `&VIBRATIONAL_ANALYSIS` 里设 `THERMOCHEMISTRY T`，用 `TC_TEMPERATURE` 与 `TC_PRESSURE` 给条件",
          "只要设 `INTENSITIES T` 就会自动输出热化学",
          "热化学对固体和分子同样适用",
        ],
        answer: 1,
        explain: "CP2K 没有独立的 &THERMOCHEMISTRY 节；热化学是 &VIBRATIONAL_ANALYSIS 的 THERMOCHEMISTRY 逻辑关键字，配合 TC_TEMPERATURE（默认 273.15 K）与 TC_PRESSURE。手册明确它只适用于气相分子，不支持一般 k 点声子。",
      },
      {
        q: "要把 IR 强度算出来，除了 `INTENSITIES T` 还需要什么？",
        options: [
          "`&PROPERTIES %LINRES %POLAR ON`",
          "`&DFT %PRINT %MOMENTS`，让每一步位移都有偶极矩",
          "`STRESS_TENSOR ANALYTICAL`",
          "`&SMEAR ON`",
        ],
        answer: 1,
        explain: "IR 强度来自偶极矩对简正坐标的导数，因此需要每个位移上的偶极矩。Raman 才需要 LINRES/POLAR 的极化率。INTENSITIES 只是把它们拼起来的开关。",
      },
      {
        q: "做同位素替换（H → D）时，CP2K 输入里要改的是？",
        options: [
          "换一套专门的重氢基组与赝势",
          "在 `&KIND H` 里加 `MASS 2.014`，其余设置不变",
          "把 `DX` 加倍",
          "打开 `FULLY_PERIODIC T`",
        ],
        answer: 1,
        explain: "同位素只改原子质量。&KIND 的 MASS 覆盖元素默认质量，电子结构（基组、赝势）完全不变，所以频率按约 1/√m 缩放，峰位移动而相对强度格局大体保留。",
      },
    ],
    terms: [
      {
        t: "Hessian 矩阵",
        en: "Hessian matrix",
        d: "能量对原子坐标的二阶导数矩阵。质量加权后对角化给出简正模与频率，负本征值对应虚频。",
      },
      {
        t: "简正模",
        en: "normal mode",
        d: "分子整体协同振动的独立模式，每个模式有固定频率和固定的原子位移比例。3N−6 个（线性为 3N−5）。",
      },
      {
        t: "零点能",
        en: "zero-point energy (ZPE)",
        d: "0 K 下所有振动模式的 ½hν 之和。量子体系无法静止，所以这部分能量始终存在。",
      },
      {
        t: "约化质量",
        en: "reduced mass",
        d: "某个简正模的等效质量，反映参与振动的原子质量分布。同位素替换会改变它，从而移动频率。",
      },
      {
        t: "热化学",
        en: "thermochemistry",
        d: "由频率得到配分函数，进而给出内能、焓、熵与吉布斯自由能。CP2K 中仅适用于气相分子。",
      },
      {
        t: "IR 强度",
        en: "infrared intensity",
        d: "正比于偶极矩对简正坐标导数的平方。偶极矩不变的模式（对称伸缩等）不吸收红外光。",
      },
      {
        t: "Raman 活性",
        en: "Raman activity",
        d: "由极化率张量对简正坐标的导数决定。与 IR 的选择规则互补，常用来补齐 IR 看不到的模式。",
      },
      {
        t: "模式选择",
        en: "mode selective",
        d: "&MODE_SELECTIVE 用块 Davidson 只在目标频率附近求解，避免全对角化，适合只关心虚频或某几个模式时使用。",
      },
    ],
    sources: [
      {
        t: "Properties（振动、光谱等性质的总览）",
        url: "https://manual.cp2k.org/trunk/methods/properties/index.html",
      },
      {
        t: "Infrared Spectroscopy（手册此页尚未撰写）",
        url: "https://manual.cp2k.org/trunk/methods/properties/infrared.html",
      },
      {
        t: "Raman Spectroscopy（手册此页尚未撰写）",
        url: "https://manual.cp2k.org/trunk/methods/properties/raman.html",
      },
      {
        t: "CP2K_INPUT / VIBRATIONAL_ANALYSIS",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/VIBRATIONAL_ANALYSIS.html",
      },
    ],
  };
})();
