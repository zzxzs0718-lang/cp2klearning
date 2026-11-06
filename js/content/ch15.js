(function () {
  "use strict";

  window.CONTENT = window.CONTENT || {};

  window.CONTENT["ch15"] = {
    id: "ch15",
    num: 15,
    part: "动力学",
    title: "增强采样：跨过自由能垒的三条路",
    subtitle: "metadynamics、约束动力学与 Monte Carlo",
    hours: 4,
    level: "进阶",
    intro:
      "普通 MD 只会在一个盆地裡抖，几十皮秒也翻不过一道自由能垒。增强采样的思路是人为改变采样分布：加偏置、加约束，或者干脆不做动力学而做随机移动。这一章讲清这三种做法的输入长什么样、输出怎么读、以及凭什么判断结果收敛了。",
    goals: [
      "用 &COLVAR 定义反应坐标，并先做无偏监控确认它有意义",
      "写出可运行的 metadynamics 输入，读懂 HILLS 与 COLVAR 文件",
      "用 &CONSTRAINT 做约束动力学，并知道乘子要经过 blue-moon 校正",
      "判断偏置参数是否合适，以及什么时候该换方法"
    ],
    sections: [
      {
        id: "15.1",
        title: "为什么需要增强采样",
        blocks: [
          {
            type: "p",
            text: "自由能不是某个构型的能量，而是**沿某个坐标的概率分布**。两者之间的关系很干净：某个 ξ 上的自由能越低，体系待在那里的概率越大。"
          },
          {
            type: "formula",
            tex: "A(\\xi) = -k_B T \\ln p(\\xi) + C",
            caption: "p(ξ) 是沿反应坐标的概率密度；常数 C 不影响形状，所以自由能只有相对值"
          },
          {
            type: "p",
            text: "问题在于直接采样很难拿到 p(ξ)。常温下一道十几 kcal/mol 的能垒，跨越概率极低，AIMD 跑到能接受的时长也翻不过去几次，高自由能区间的统计量几乎为零。增强采样要做的就是让人为的偏置把体系推出去，事后再把偏置的影响扣掉。"
          },
          {
            type: "table",
            caption: "三条路线对照",
            head: ["做法", "对势能做什么", "CP2K 入口", "适合"],
            rows: [
              ["metadynamics", "沿 CV 不断堆高斯，把走过的路填平", "&MOTION%&FREE_ENERGY%&METADYN", "一到两个 CV 的慢过程、成键/配位变化"],
              ["约束动力学", "把 CV 钉在指定值，看需要多大力", "&MOTION%&CONSTRAINT%&COLLECTIVE", "需要平均力、做热力学积分"],
              ["Monte Carlo", "不做动力学，按 Metropolis 准则随机移动", "&MOTION%&MC", "经典力场、相平衡、巨正则"]
            ]
          },
          {
            type: "p",
            text: "三者不是替代关系。metadynamics 给你整条自由能曲线但依赖偏置参数；约束动力学给的是**局部斜率**，多个窗口拼起来才是曲线，但每一点都可控；Monte Carlo 换的是采样方式，不做时间演化，因此拿不到动力学信息。"
          },
          { type: "keypoints", items: ["自由能 = 沿反应坐标的概率分布", "增强采样都是「先人为改变分布，再事后扣掉」", "metadynamics 给曲线，约束给斜率，MC 换采样方式"] }
        ]
      },
      {
        id: "15.2",
        title: "先把 CV 定义好：&COLVAR",
        blocks: [
          {
            type: "p",
            text: "反应坐标（collective variable，CV）定义在 `&FORCE_EVAL%&SUBSYS%&COLVAR` 里，**编号按输入里出现的顺序**，后面所有 `COLVAR n` 都指这个序号。选错 CV 是增强采样失败最常见的原因，而且失败时程序不报错，只是给你一条看着像自由能曲线的废物。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "在 &SUBSYS 里定义两个 CV",
            note: "片段，放在 &SUBSYS 内部；序号由出现顺序决定：DISTANCE 是 1，COORDINATION 是 2。",
            text: `&COLVAR
  &DISTANCE
    ATOMS 1 2
  &END DISTANCE
  &COORDINATION
    ATOMS_FROM 1
    ATOMS_TO 2 3
    R0 [angstrom] 2.9
    ND 12
    NN 8
  &END COORDINATION
&END COLVAR`
          },
          {
            type: "p",
            text: "`&DISTANCE` 就是两个原子的距离，最简单也最常用。`&COORDINATION` 是一个平滑的配位数：每个配位原子对贡献一个在 `r = R0` 附近从 1 平滑衰减到 0 的权重，`ND`/`NN` 越大衰减越陡。配位数适合描述「某离子周围的水换了几次」这类没有单一距离能刻画的过程。"
          },
          {
            type: "list",
            items: [
              "CV 要能区分你关心的初态与末态：两个态的 CV 值必须明显不同。",
              "CV 要覆盖整个转变：路径中间不能有 CV 不变的平台，否则采样会在那里堵住。",
              "CV 数量尽量少：二维以上所需采样量增长很快，先试一维。",
              "先跑一段**无偏** MD，把 CV 打出来看它是否真的在动。"
            ]
          },
          {
            type: "callout",
            kind: "tip",
            title: "无偏监控几乎不花钱",
            text: "把 `&METADYN%DO_HILLS` 设成 `.FALSE.`，其它不变，CP2K 只计算 CV 并写 COLVAR 文件、不施加任何偏置。用它确认 CV 的数值范围与涨落幅度，再决定高斯宽度。"
          },
          { type: "keypoints", items: ["COLVAR 的编号是输入顺序，不是原子编号", "COORDINATION 适合配位/溶剂化这类多体过程", "先无偏监控，再决定偏置参数"] }
        ]
      },
      {
        id: "15.3",
        title: "metadynamics 生产输入：&FREE_ENERGY%&METADYN",
        blocks: [
          {
            type: "p",
            text: "metadynamics 每次经过 CV 空间时在那里堆一个高斯，堆得多了，走过的区域被填平，体系自然往没走过的方向走。三个参数决定一切：多久堆一个（`NT_HILLS`，单位 MD 步）、堆多高（`WW`，单位 hartree）、堆多宽（`&METAVAR%SCALE`，与 CV 同量纲）。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "metadynamics 段",
            note: "片段，放在 &MOTION 里；MD 段与第 14 章的 NVT 设置相同。",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 20000
    TIMESTEP 0.5
    TEMPERATURE 330
  &END MD
  &FREE_ENERGY
    METHOD METADYN
    &METADYN
      DO_HILLS .TRUE.
      NT_HILLS 60
      WW 5.0E-04
      &METAVAR
        COLVAR 1
        SCALE 0.05
      &END METAVAR
      &PRINT
        &COLVAR
          COMMON_ITERATION_LEVELS 3
          &EACH
            MD 1
          &END EACH
        &END COLVAR
        &HILLS
          &EACH
            MD 1
          &END EACH
        &END HILLS
      &END PRINT
    &END METADYN
  &END FREE_ENERGY
&END MOTION`
          },
          {
            type: "p",
            text: "`COLVAR 1` 指 15.2 里定义的第一个 CV。`SCALE 0.05` 是这个维度上的高斯宽度，取值应与你观察到的 CV 涨落同量级：太窄则每个高斯只影响一小块、需要堆极多次；太宽则把相邻的谷也一起填了，分辨率被抹平。`WW` 越小分辨率越高但需要越长的时间，`NT_HILLS` 越小堆得越密。"
          },
          {
            type: "callout",
            kind: "warn",
            title: "hill 太大不只是浪费",
            text: "高斯过高会一次跨过一道小能垒、把中间态直接填平，甚至把体系推到物理上不存在的位置。这些错误在 HILLS 文件里看不出来，只会让最终的自由能曲线平滑得可疑。"
          },
          {
            type: "p",
            text: "两个 CV 就写两个 `&METAVAR`，各自给自己那一维的宽度。二维以上建议先跑一维看行为，再决定要不要加第二维——加维的代价是采样量指数增长。"
          },
          { type: "keypoints", items: ["NT_HILLS 管频率，WW 管高度，SCALE 管宽度", "SCALE 应与 CV 的实际涨落同量级", "多个 CV 就多个 &METAVAR，但尽量别超过两维"] }
        ]
      },
      {
        id: "15.4",
        title: "读 HILLS 与 COLVAR，判断收敛",
        blocks: [
          {
            type: "p",
            text: "metadynamics 跑完会得到两个纯文本文件。`HILLS` 记录每一个高斯的参数，`COLVAR` 记录每一步的 CV 值、偏置带来的梯度和偏置势本身。自由能曲线就是从这些高斯重建出来的。"
          },
          {
            type: "table",
            caption: "两个文件各有什么列",
            head: ["文件", "列内容"],
            rows: [
              ["HILLS", "步数、CV1 中心、CV2 中心、CV1 宽度、CV2 宽度、高斯高度"],
              ["COLVAR", "时间（fs）、CV1、CV2、∂V_bias/∂CV1、∂V_bias/∂CV2、wall 对 CV 的梯度、偏置值、wall 值"]
            ]
          },
          {
            type: "code",
            lang: "bash",
            title: "用 CP2K 自带工具重建自由能面",
            text: `# graph.psmp 随 CP2K 的 tools 一起安装
graph.psmp -i HILLS -stride 10 -ndim 2 -ndw 1 2 -cp2k -integrated_fes`
          },
          {
            type: "p",
            text: "`-stride 10` 表示只用每 10 个高斯，用来避免相邻高斯高度相关、把曲线平滑成假象。`-ndim 2 -ndw 1 2` 指定从二维 CV 投影到一维。重建出的曲线要**分段比较**：取前一半和后一半的数据分别重建，两条曲线在已采样区间内重合，才算这次 metadynamics 收敛了。"
          },
          {
            type: "list",
            ordered: true,
            items: [
              "看 COLVAR 里 CV 是否来回穿越目标区间多次，而不是单向漂走。",
              "看偏置值是否还在系统性增长：一直线性涨说明还在「爬坡」，没填满。",
              "分段重建自由能，比较前后两段在重叠区是否一致。",
              "检查高自由能区有没有被反复访问，只有一次访问的点不可信。"
            ]
          },
          {
            type: "callout",
            kind: "key",
            title: "收敛不是曲线变平滑",
            text: "曲线平滑只能说明高斯够宽或者 stride 够大。真正的证据是「独立的两段数据给出同一条曲线」，以及每一段 CV 区间都有足够的回访次数。"
          },
          { type: "keypoints", items: ["HILLS 存高斯参数，COLVAR 存每步 CV 与偏置", "用 graph.psmp 的 -integrated_fes 重建自由能", "判据是分段一致，不是曲线好看"] }
        ]
      },
      {
        id: "15.5",
        title: "约束动力学：&CONSTRAINT 与平均力",
        blocks: [
          {
            type: "p",
            text: "另一条路是把 CV 钉在一个值上，问「需要多大力才能钉住」。这个力就是平均力，沿 CV 积分就得到自由能差。约束定义在 `&MOTION%&CONSTRAINT%&COLLECTIVE`，引用的仍是 `&SUBSYS%&COLVAR` 里的序号。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "约束一个原子间距离并把乘子写出来",
            note: "片段，放在 &MOTION 里。TARGET 的单位与 CV 一致，这里用 angstrom。",
            text: `&MOTION
  &CONSTRAINT
    &COLLECTIVE
      COLVAR 1
      INTERMOLECULAR TRUE
      TARGET [angstrom] 2.0
    &END COLLECTIVE
    &LAGRANGE_MULTIPLIERS ON
      FILENAME constraint_force
      COMMON_ITERATION_LEVELS 1
    &END LAGRANGE_MULTIPLIERS
  &END CONSTRAINT
&END MOTION`
          },
          {
            type: "p",
            text: "跨分子的约束必须写 `INTERMOLECULAR TRUE`，否则 CP2K 会把它当成分子内的量而找不到。`&LAGRANGE_MULTIPLIERS` 把乘子写到 `constraint_force` 开头的文件里：位置约束给 `ShakeLagrangianMultipliers`，速度约束给 `RattleLagrangianMultipliers`，后者不是第二个独立的构型力样本。"
          },
          {
            type: "p",
            text: "乘子的单位是 CP2K 内部单位（距离约束给的是 hartree/bohr），换 `TARGET` 的单位不会改变乘子的单位。更要紧的是：**受约束的系综分布本身是偏的**，直接对乘子求平均会得到错的斜率，需要 blue-moon 校正。"
          },
          {
            type: "formula",
            tex: "\\frac{dA}{d\\xi} = \\frac{\\langle Z^{-1/2}\\,(-\\lambda + k_B T\\, G)\\rangle}{\\langle Z^{-1/2}\\rangle}",
            caption: "Z = Σ (1/m_i)|∇_i ξ|²。两个原子间的距离约束下 Z 是常数、G = 0，斜率退化成 −⟨λ⟩"
          },
          {
            type: "callout",
            kind: "warn",
            title: "慢生长不是免费的",
            text: "用 `TARGET_GROWTH` 让约束值随时间线性移动看起来省事，但拉得越快，滞后与耗散越大，正向和反向的功不相等，曲线会张开成环。要么拉得足够慢并检查正反向是否重合，要么回到多个固定窗口分别平衡。"
          },
          { type: "keypoints", items: ["约束引用的是 COLVAR 序号，跨分子要 INTERMOLECULAR", "乘子是内部单位，且必须做 blue-moon 校正", "慢生长要检查正反向滞后"] }
        ]
      },
      {
        id: "15.6",
        title: "Monte Carlo：&MC",
        blocks: [
          {
            type: "p",
            text: "Monte Carlo 不做时间积分，它按 Metropolis 准则接受或拒绝随机移动，直接采样玻尔兹曼分布。好处是不需要小时间步，坏处是没有动力学信息。CP2K 里把 `RUN_TYPE` 设成 `MC`，参数放进 `&MOTION%&MC`。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "mc_h2o.inp：两个水分子的正则系综 MC",
            note: "完整可运行。样本极小只为演示语法；每一次移动都是一次能量计算，盒子稍大就会非常慢。",
            text: `&GLOBAL
  PROJECT mc_h2o
  RUN_TYPE MC
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
  &END DFT
  &SUBSYS
    &CELL
      ABC 10.0 10.0 10.0
      PERIODIC XYZ
    &END CELL
    &COORD
      O  0.0000  0.0000  0.0000
      H  0.7570  0.5860  0.0000
      H -0.7570  0.5860  0.0000
      O  3.0000  0.0000  0.0000
      H  3.7570  0.5860  0.0000
      H  2.2430  0.5860  0.0000
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
&END FORCE_EVAL
&MOTION
  &MC
    ENSEMBLE TRADITIONAL
    TEMPERATURE 300.0
    NSTEP 20
  &END MC
&END MOTION`
          },
          {
            type: "p",
            text: "`NSTEP` 是 MC 循环（cycle）数，`IPRINT` 控制每隔多少步打印一次构型信息。注意这里 `METHOD` 是 `Quickstep`：每一次移动都要重新做一遍电子结构计算，两个水分子只是勉强能跑，生产用的体系必须换成经典势（`METHOD FIST`），把非键作用写在 `&MM%&FORCEFIELD%&NONBONDED` 下的 Lennard-Jones 等子节里，极性分子还要补电荷项。"
          },
          {
            type: "table",
            caption: "&MC%ENSEMBLE 的取值",
            head: ["取值", "含义", "用途"],
            rows: [
              ["TRADITIONAL", "传统正则系综 MC", "单盒子 NVT 采样"],
              ["GEMC_NVT", "吉布斯系综，定容两盒子", "气液共存、蒸气压"],
              ["GEMC_NPT", "吉布斯系综，定压两盒子", "两相共存时同时定压"],
              ["VIRIAL", "维里系综", "与压力相关的性质"]
            ]
          },
          {
            type: "p",
            text: "输出末尾会给出两个盒子的平均能量、平均分子数、平均体积，以及每一类移动的尝试数、接受数与接受率。平移移动的接受率通常落在三到五成比较合适，太低说明最大位移给得太大，太高说明给得太小——都可以通过 `&MAX_DISPLACEMENTS` 调整。"
          },
          { type: "keypoints", items: ["MC 换的是采样方式，拿不到时间信息", "NSTEP 是循环数，NMOVES 是每个循环里的移动数", "GEMC 系列用两个盒子同时描述两相"] }
        ]
      },
      {
        id: "15.7",
        title: "伞形采样与 WHAM 在 CP2K 里的位置",
        blocks: [
          {
            type: "p",
            text: "伞形采样是约束动力学的「软版本」：不再把 CV 钉死，而是加一根谐振弹簧把 CV 拉在窗口中心附近，然后从每个窗口的分布反推自由能。CP2K 提供的是 Umbrella Integration（UI），入口是 `&FREE_ENERGY%METHOD UI` 与 `&UMBRELLA_INTEGRATION`。"
          },
          {
            type: "p",
            text: "窗口本身用 `&CONSTRAINT%&COLLECTIVE` 下的 `&RESTRAINT` 实现：`K` 是弹簧常数，`TARGET` 是窗口中心。每个窗口跑一段独立的 MD，各自平衡后再累积。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "一个伞形窗口的写法",
            note: "片段，放在 &MOTION 里；K 与 TARGET 每个窗口一组，TARGET 就是窗口中心。",
            text: `&MOTION
  &CONSTRAINT
    &COLLECTIVE
      COLVAR 1
      TARGET [angstrom] 2.4
      &RESTRAINT
        K [kcalmol] 20.0
      &END RESTRAINT
    &END COLLECTIVE
  &END CONSTRAINT
  &FREE_ENERGY
    METHOD UI
    &UMBRELLA_INTEGRATION
      &UVAR
        COLVAR 1
      &END UVAR
      &CONVERGENCE_CONTROL
        COARSE_GRAINED_WIDTH 50
        EPS_CONV 1.0E-02
      &END CONVERGENCE_CONTROL
    &END UMBRELLA_INTEGRATION
  &END FREE_ENERGY
&END MOTION`
          },
          {
            type: "p",
            text: "UI 的关键词都在 `&CONVERGENCE_CONTROL` 里：`COARSE_GRAINED_WIDTH` 把轨迹切成若干段、每段当作一个独立样本（避免相邻步高度相关），`EPS_CONV` 是对 CV 平均值收敛的相对容差，另外还有几个基于趋势检验与正态性检验的置信水平。它做的是**涨落耗散意义上的统计收敛判断**，而不是替你决定窗口够不够。"
          },
          {
            type: "callout",
            kind: "info",
            title: "WHAM 不在 CP2K 里",
            text: "CP2K 主程序没有 WHAM 的输入段。要用 WHAM，需要把每个窗口的 COLVAR 输出攒起来，自己写实现或用第三方的 WHAM 代码做后处理。如果不想写后处理，CP2K 侧更省事的路线是前两节的 metadynamics 加 `graph.psmp` 重建。"
          },
          {
            type: "list",
            items: [
              "相邻窗口的中心间距要让分布有重叠：没有重叠，反推的曲线在窗口之间会断开。",
              "每个窗口都要丢弃前一段平衡数据，只统计平衡后的部分。",
              "窗口数量由曲率决定：曲率大的地方窗口密一些。",
              "最终曲线要做误差估计，单条曲线没有误差棒就没有说服力。"
            ]
          },
          { type: "keypoints", items: ["UI 用谐振约束窗口，K 是弹簧常数", "COARSE_GRAINED_WIDTH 处理相关采样，不是可有可无", "WHAM 属于后处理，CP2K 不提供输入段"] }
        ]
      },
      {
        id: "15.8",
        title: "偏置势怎么选，什么时候换方法",
        blocks: [
          {
            type: "p",
            text: "偏置参数没有普适值，只能按 CV 的实际行为定。可操作的做法是：先用无偏 MD 得到 CV 的均值与标准差，把高斯宽度定在标准差的量级，把高度定在「几十个高斯能填平一道小能垒」的量级，然后先跑一小段，看 CV 是否开始往未访问区域走。"
          },
          {
            type: "p",
            text: "判断参数是否合适的信号有三类：CV 在目标区间来回穿越（好）、CV 单向漂走再也不回来（偏置太强或 CV 没覆盖产物态）、CV 卡在一个平台不动（高斯太窄或该区间自由能太高，需要更多时间或换 CV）。"
          },
          {
            type: "demo",
            id: "md",
            title: "分子动力学小实验",
            desc: "先用无偏 MD 观察温度与能量怎么响应参数变化，再回到本章的偏置设置。"
          },
          {
            type: "compare",
            left: {
              title: "继续用 metadynamics",
              items: ["一两维 CV，慢过程", "需要整条曲线而不是单点斜率", "能接受较长的有效采样时间"]
            },
            right: {
              title: "换约束/伞形",
              items: ["想要逐点可控的斜率", "体系在偏置下发散、难以稳定", "需要和实验的力（如 AFM 拉伸）口径一致"]
            }
          },
          {
            type: "callout",
            kind: "danger",
            title: "CV 选错时一切参数都救不了",
            text: "如果 CV 没有包含真正的慢自由度（比如只用了距离而忽略了配位数变化），偏置会把体系推到不该去的地方，重建出的曲线仍然光滑好看。遇到「曲线很漂亮但物理上说不通」的情况，先回头检查 CV，而不是继续调 WW 和 SCALE。"
          },
          {
            type: "steps",
            items: [
              { t: "无偏 MD 看 CV", d: "确认 CV 能区分初末态，且数值范围明确。" },
              { t: "定 SCALE", d: "与 CV 涨落同量级，宁窄勿宽地先试一小段。" },
              { t: "定 WW 与 NT_HILLS", d: "先取保守的小高度、密间隔，跑够时长再谈效率。" },
              { t: "分段重建并检查回访", d: "前后两段曲线重合、每个区间多次访问，才算收敛。" }
            ]
          },
          { type: "keypoints", items: ["偏置参数按 CV 的实际涨落定，不按体系大小定", "CV 漂走不回来通常是偏置太强或 CV 不全", "曲线好看不等于结果对"] }
        ]
      }
    ],
    quiz: [
      {
        q: "COLVAR 的编号是怎么来的？",
        options: ["按原子编号从小到大", "按 &COLVAR 里各子节出现的顺序", "按 CV 的数值大小", "在 &METAVAR 里显式指定"],
        answer: 1,
        explain: "所有 `COLVAR n` 都指 &SUBSYS%&COLVAR 中的第 n 个定义，按输入顺序编号，与原子编号无关。"
      },
      {
        q: "metadynamics 里 `&METAVAR%SCALE` 控制什么？",
        options: ["高斯的高度", "高斯的宽度（该维）", "每隔多少步堆一个高斯", "CV 的参考零点"],
        answer: 1,
        explain: "SCALE 是该维度上的高斯宽度；高度由 WW 控制，频率由 NT_HILLS 控制。"
      },
      {
        q: "约束动力学的乘子为什么不能直接积分成自由能？",
        options: [
          "因为乘子单位不对，要乘一个常数",
          "因为受约束系综的分布有偏，需要 blue-moon 校正",
          "因为乘子只对速度约束有意义",
          "因为 CP2K 输出的乘子已经被平均过"
        ],
        answer: 1,
        explain: "固定 CV 改变了构型分布，⟨−λ⟩ 与 dA/dξ 之间差一个与质量度规相关的 blue-moon 因子。"
      },
      {
        q: "关于 Monte Carlo，下面哪句是错的？",
        options: [
          "NSTEP 是 MC 循环数",
          "MC 能直接给出体系的动力学时间",
          "GEMC 系综用两个盒子描述两相共存",
          "接受率过高通常说明最大位移给得太小"
        ],
        answer: 1,
        explain: "MC 的步数是循环计数，没有物理时间含义，因此不能直接给出扩散系数这类动力学量。"
      },
      {
        q: "判断一次 metadynamics 是否收敛，最可靠的依据是？",
        options: [
          "自由能曲线足够平滑",
          "高斯个数超过某个固定值",
          "把数据分段重建，重叠区曲线一致且各区间有多次回访",
          "CV 没有超出设定的上下界"
        ],
        answer: 2,
        explain: "平滑可能来自过宽的高斯或过大的 stride；分段一致性与回访次数才是采样充分的证据。"
      }
    ],
    terms: [
      { t: "反应坐标", en: "Collective Variable", d: "用来描述体系在初末态之间的一个（或几个）连续量，在 CP2K 里由 &SUBSYS%&COLVAR 定义。" },
      { t: "自由能面", en: "Free Energy Surface", d: "自由能随反应坐标变化的曲面，由概率分布反推得到。" },
      { t: "高斯偏置", en: "Gaussian Bias", d: "metadynamics 每次访问在 CV 空间堆的高斯函数，高度 WW、宽度 SCALE。" },
      { t: "平均力", en: "Mean Force", d: "把 CV 钉住所需的力，沿 CV 积分即得自由能差。" },
      { t: "blue-moon 校正", en: "Blue-moon Correction", d: "把受约束系综下的乘子平均换算成真实自由能斜率的修正。" },
      { t: "伞形采样", en: "Umbrella Sampling", d: "用谐振弹簧把 CV 限制在窗口中心附近，多个窗口拼出整条自由能曲线。" },
      { t: "WHAM", en: "Weighted Histogram Analysis Method", d: "把多个伞形窗口的直方图加权合并成一条自由能曲线的后处理方法。" },
      { t: "吉布斯系综", en: "Gibbs Ensemble", d: "用两个盒子分别代表两相、允许粒子交换来模拟相平衡的 MC 方法。" }
    ],
    sources: [
      { t: "CP2K 手册：Metadynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/metadynamics.html" },
      { t: "CP2K 手册：Constrained Dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/constrained_dynamics.html" },
      { t: "CP2K 手册：Monte Carlo", url: "https://manual.cp2k.org/trunk/methods/sampling/monte_carlo.html" },
      { t: "输入参考：MOTION/FREE_ENERGY", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/FREE_ENERGY.html" }
    ]
  };
})();