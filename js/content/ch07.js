(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch07"] = {
    id: "ch07",
    num: 7,
    part: "电子结构",
    title: "泛函、色散与强关联修正",
    subtitle: "从 PBE 到 HSE：选泛函、加色散、开 +U、处理磁性",
    hours: 2.5,
    level: "中级",
    intro:
      "前面几章你用的是 PBE，但它不是唯一答案。同一套几何，换泛函可能让吸附能差出零点几电子伏，让带隙从「接近实验」变成「差一半」，也可能让一个强关联体系收敛到错误的自旋态。这一章按「先选对的、再加修正」的顺序，把泛函阶梯、色散校正、DFT+U、磁性和杂化泛函一次讲清。",
    goals: [
      "按体系类型在 LDA、GGA、meta-GGA、杂化之间做出有理由的选择",
      "给 PBE 加上 DFT-D3/D4 色散校正，并判断什么时候该用非局域泛函",
      "用 DFT+U 处理过渡金属 d 电子，知道 U 值为什么不能照搬",
      "给开壳层体系设对 UKS、MULTIPLICITY 与初始磁矩",
      "判断杂化泛函值不值得算，并用 ADMM 把成本压下来",
    ],
    sections: [
      {
        id: "7.1",
        title: "泛函不是越贵越好",
        blocks: [
          {
            type: "p",
            text: "交换关联泛函决定了 Kohn–Sham 方程里那个「未知的一小块」。CP2K 里换泛函只改 `&XC` 几行，但结果可能差很多。课程里给的实用口径是：**PBE 起步，需要时再往上走**。先把 PBE 跑通、把结构和收敛做对，再讨论换泛函，顺序反了会分不清误差来自哪里。",
          },
          {
            type: "table",
            head: ["层级", "代表", "擅长", "常踩的坑"],
            rows: [
              ["LDA", "PADE、PZ", "简单金属、致密固体", "键长偏短，分子结合能偏大"],
              ["GGA", "PBE、BLYP", "通用几何与能量", "弱相互作用几乎为零，带隙偏小"],
              ["meta-GGA", "TPSS、SCAN", "弱作用、氢键、过渡金属", "更贵，对网格更敏感"],
              ["杂化", "PBE0、HSE06", "带隙、缺陷、反应能", "HFX 内存与机时陡增"],
            ],
            caption: "先问「我要的性质是什么」，再问「哪一层泛函能给出它」。",
          },
          {
            type: "p",
            text: "**PBE** 是默认工作马：固体晶格、表面吸附、一般反应路径都用它起步。**BLYP** 更「软」，对某些分子体系几何更好，但同样缺色散。**TPSS** 这类 meta-GGA 引入动能密度，对弱作用和过渡金属更稳，课程里也把它作为升级选项。**SCAN + rVV10** 是课程演示的 meta-GGA + 非局域组合，适合弱作用主导的体系，但网格与收敛要更小心。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "换泛函前先固定三件事",
            text: "① 同一套基组与赝势；② 同一套 CUTOFF/REL_CUTOFF，且都做过收敛；③ 同一套 SCF 阈值。否则你测到的是多个变量混在一起的差异，不是泛函的差异。",
          },
          {
            type: "keypoints",
            items: [
              "PBE 起步，是课程反复强调的工作流顺序，不是「PBE 最好」",
              "LDA 只适合当基准或快速筛查，别拿它做发表级能量",
              "meta-GGA 更贵，但弱作用体系常常值得",
              "杂化泛函是最后一层，不是第一层",
            ],
          },
        ],
      },
      {
        id: "7.2",
        title: "从 PBE 起步：一份可以直接改的输入",
        blocks: [
          {
            type: "p",
            text: "下面这份水分子单点能输入就是后面所有修正的**底板**。它只比第 3 章多了 `REL_CUTOFF` 和更规整的几何，方便你逐段替换 `&XC`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_pbe.inp",
            text: `&GLOBAL
  PROJECT h2o_pbe
  RUN_TYPE ENERGY
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 400
      REL_CUTOFF 60
    &END MGRID
    &POISSON
      PERIODIC NONE
      PSOLVER MT
    &END POISSON
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 50
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
      O  0.0000  0.0000  0.0000
      H  0.7570  0.5860  0.0000
      H -0.7570  0.5860  0.0000
    &END COORD
    &KIND O
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
    &KIND H
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "换泛函只动 `&XC_FUNCTIONAL` 里面的内容：`&PBE` 改成 `&BLYP`、`&TPSS` 即可。但注意 **赝势要和泛函匹配**：`GTH-PBE-q6` 是为 PBE 优化的，换成 BLYP 时应改用对应的 `GTH-BLYP-q6` 一类，否则基组/赝势误差会混进泛函比较里。",
          },
          {
            type: "p",
            text: "运行后先确认 `SCF run converged` 和总能量，再改泛函重跑。两次能量不能直接相减做「泛函误差」——总能量绝对值依赖赝势，只有**同一体系、同一性质的能量差**才有物理意义。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "别在同一份输入里叠两种色散",
            text: "PBE 本身不含长程色散。如果你既加了 `&VDW_POTENTIAL` 的 D3，又用了自带非局域的 rVV10，就是**重复计入**。选一种，并在方法部分写清楚。",
          },
        ],
      },
      {
        id: "7.3",
        title: "色散校正：D3 与 D4",
        blocks: [
          {
            type: "p",
            text: "GGA 对「瞬时偶极—诱导偶极」这类长程关联几乎没有描述，结果是分子晶体结合能偏小、层间距偏大、吸附能偏弱。最便宜的修法是加**经验色散校正**：在 SCF 能量之外加一项原子对势，不改电子结构。CP2K 把它放在 `&XC` 下的 `&VDW_POTENTIAL`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "PBE + DFT-D3(BJ)",
            text: `&XC
  &XC_FUNCTIONAL PBE
  &END XC_FUNCTIONAL
  &VDW_POTENTIAL
    &PAIR_POTENTIAL
      TYPE DFTD3(BJ)
      PARAMETER_FILE_NAME dftd3.dat
      REFERENCE_FUNCTIONAL PBE
    &END PAIR_POTENTIAL
  &END VDW_POTENTIAL
&END XC`,
          },
          {
            type: "p",
            text: "`TYPE` 决定用哪一代校正：`DFTD3(BJ)` 是 Becke–Johnson 阻尼的 D3，也是默认值；`DFTD3` 是零阻尼版本；`DFTD4` 是更新的 D4，参数更系统。`PARAMETER_FILE_NAME` 指向 `dftd3.dat`（D4 不需要这个文件）。`REFERENCE_FUNCTIONAL` 告诉程序按哪个泛函取参数——**写错泛函，色散项就是错的**，而且不会报错。",
          },
          {
            type: "table",
            head: ["TYPE", "参数文件", "适用场合"],
            rows: [
              ["DFTD3(BJ)", "dftd3.dat", "默认首选，分子晶体、吸附"],
              ["DFTD3", "dftd3.dat", "需要与旧结果对齐时"],
              ["DFTD4", "不需要", "新项目、元素覆盖广"],
              ["NON_LOCAL + RVV10", "rvV10 核表", "弱作用主导，且愿意付网格成本"],
            ],
            caption: "D3/D4 是「加一项能量」；rVV10 是「改泛函本身」，二者选一。",
          },
          {
            type: "p",
            text: "非局域泛函（如 rVV10）把色散写进交换关联泛函，通过 `&VDW_POTENTIAL` 的 `DISPERSION_FUNCTIONAL NON_LOCAL` 与 `&NON_LOCAL` 子节配置，需要额外的核表文件和更高的 CUTOFF。课程里的 SCAN + rVV10 组合就属于这一类：它比 D3 贵，但对层状材料、分子晶体的平衡间距通常更自洽。",
          },
          {
            type: "callout",
            kind: "info",
            title: "怎么验证色散加对了",
            text: "拿一个已知结合能的二聚体（水二聚体、苯二聚体）跑两次：加与不加色散。差别应主要体现在结合能与层间距上，电子结构（如分子内键长）几乎不动。若连分子内几何都大幅变化，多半是参数或泛函引用写错了。",
          },
        ],
      },
      {
        id: "7.4",
        title: "DFT+U：把局域电子管住",
        blocks: [
          {
            type: "p",
            text: "PBE 处理过渡金属 d 电子时常把电子「摊平」：NiO 算成金属、Fe2O3 的磁矩和带隙都不对。DFT+U 在局域轨道上加一个 Hubbard 惩罚项，让同一轨道上的电子更「互相排斥」，从而打开带隙、稳住局域磁矩。CP2K 里它由两部分组成：`&DFT` 里选投影方式，`&KIND` 里给具体元素设 U。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "TiO2 中 Ti 3d 的 +U 设置（片段）",
            text: `&DFT
  PLUS_U_METHOD MULLIKEN
  &MGRID
    CUTOFF 350
    REL_CUTOFF 60
  &END MGRID
  &SCF
    EPS_SCF 3.0E-6
    MAX_SCF 150
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
  &KIND Ti
    BASIS_SET DZVP-MOLOPT-SR-GTH
    POTENTIAL GTH-PBE-q12
    &DFT_PLUS_U
      L 2
      U_MINUS_J [eV] 13.6
      EPS_U_RAMPING 1.0E-3
    &END DFT_PLUS_U
  &END KIND
&END SUBSYS`,
          },
          {
            type: "p",
            text: "三个关键词必须理解：`L 2` 表示作用在 d 轨道（f 电子用 3）；`U_MINUS_J` 是有效 U（已经扣掉交换 J），单位 eV，课程练习里 Ti 3d 取 13.6；`EPS_U_RAMPING` 是「SCF 收敛到这个阈值后才真正打开 +U」的开关，`U_RAMPING` 则控制 U 从 0 逐步升到目标值的步长。难收敛体系可以先把 U 设小、再逐步加到目标值。",
          },
          {
            type: "p",
            text: "`PLUS_U_METHOD` 目前常用 `MULLIKEN`（按 Mulliken 布居投影）。它决定「电子在哪个轨道上」的判定方式，换方法等于换了一套 U 的物理含义，所以**换方法后 U 值不能沿用**。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "U 值不能从别的程序照搬",
            text: "课程明确提醒：不同程序对 U 的定义、投影和基组都不同，VASP 里的 4.0 eV 拿到 CP2K 里不是同一个数。U 应针对本体系、本泛函、本基组，用线性响应（改变占据数看总能量曲率）或与实验/高阶方法对照来确定，并且要做 U 值敏感性测试。",
          },
          {
            type: "p",
            text: "还有两个工程细节：**DFT+U 与 OT 更配**（课程版本的对比里，对角化路线不支持 +U），以及 +U 会放大磁矩，最好同时给 `MAGNETIZATION` 初猜，否则容易收敛到非磁解。",
          },
        ],
      },
      {
        id: "7.5",
        title: "磁性：自旋极化的正确打开方式",
        blocks: [
          {
            type: "p",
            text: "含未成对电子的体系必须用**自旋极化**（UKS，等价写法 LSD），否则程序被迫把自旋相反的电子配对，能量和磁矩都错。O₂ 的三重态基态就是最经典的例子：两个简并 π* 电子自旋平行。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "O2 三重态：UKS + MULTIPLICITY（片段）",
            text: `&DFT
  UKS T
  MULTIPLICITY 3
  &PRINT
    &MOMENTS
    &END MOMENTS
  &END PRINT
  &XC
    &XC_FUNCTIONAL PBE
    &END XC_FUNCTIONAL
    &VDW_POTENTIAL
      &PAIR_POTENTIAL
        TYPE DFTD3(BJ)
        REFERENCE_FUNCTIONAL PBE
      &END PAIR_POTENTIAL
    &END VDW_POTENTIAL
  &END XC
&END DFT`,
          },
          {
            type: "p",
            text: "`MULTIPLICITY 3` 表示 2S+1=3，即两个未成对电子。它必须和总电子数奇偶性一致：中性 O₂ 有 16 个电子，三重态合法；如果你把 `CHARGE` 写错，CP2K 会报 `LSD: try to use a different multiplicity` 一类错误。`&PRINT/&MOMENTS` 会在输出里打印每个原子的净电荷与自旋矩，是检查磁性是否算对的第一个证据。",
          },
          {
            type: "p",
            text: "对 Fe、Mn 这类多自旋态体系，只给总 `MULTIPLICITY` 往往不够——程序不知道哪个原子该向上、哪个向下。这时在 `&KIND` 里加 `MAGNETIZATION` 给初猜，例如 Fe²⁺ 高自旋给 4.0、低自旋给 0.0，反铁磁体系给正负交替的值。初猜**只是初猜**：最终以 `&MOMENTS` 的自旋布局和自旋密度为准。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "收敛到「非磁解」是常见失败",
            text: "如果初猜磁矩全为 0，SCF 很可能停在非磁解上，即使真实基态有磁矩。做法是：给合理的初始磁矩、必要时降低混合参数、先做一次固定磁矩的单点，再用它做 RESTART。",
          },
          {
            type: "p",
            text: "老输入里还会看到 `&BS`（broken symmetry）写法：在 `&DFT` 下用 `&ALPHA`/`&BETA` 分别指定自旋向上/向下通道的占据。它比 `MAGNETIZATION` 更底层，适合需要精确控制 t2g/eg 填充的强关联体系；新手优先用 `MAGNETIZATION` + `MULTIPLICITY`。",
          },
        ],
      },
      {
        id: "7.6",
        title: "杂化泛函：PBE0 与 HSE",
        blocks: [
          {
            type: "p",
            text: "杂化泛函把一部分精确交换（HFX）混进 GGA。PBE0 混 25%，写成 `&PBE SCALE_X 0.75` + `&HF FRACTION 0.25`；HSE06 只混**短程**精确交换，长程仍用 PBE，因此对固体更友好、也更便宜。代价是：HFX 要算四中心积分，内存和机时都上一个台阶。",
          },
          {
            type: "formula",
            tex: "E_{xc}^{HSE} = aE_x^{HF,SR}(\\omega) + (1-a)E_x^{PBE,SR}(\\omega) + E_x^{PBE,LR}(\\omega) + E_c^{PBE}",
            caption: "a=0.25，ω=0.11 bohr⁻¹ 是 HSE06 的标准参数；屏蔽参数 ω 决定「短程」有多短。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "HSE06 的 &XC 写法",
            text: `&XC
  &XC_FUNCTIONAL
    &XWPBE
      SCALE_X -0.25
      SCALE_X0 1.0
      OMEGA 0.11
    &END XWPBE
    &PBE
      SCALE_X 0.0
      SCALE_C 1.0
    &END PBE
  &END XC_FUNCTIONAL
  &HF
    FRACTION 0.25
    &SCREENING
      EPS_SCHWARZ 1.0E-6
    &END SCREENING
    &INTERACTION_POTENTIAL
      POTENTIAL_TYPE SHORTRANGE
      OMEGA 0.11
    &END INTERACTION_POTENTIAL
    &MEMORY
      MAX_MEMORY 2400
    &END MEMORY
  &END HF
&END XC`,
          },
          {
            type: "p",
            text: "`XWPBE` 的 `SCALE_X -0.25` 是「从 PBE 交换里减去 25% 短程部分」，再由 `&HF` 加回 25% 短程精确交换——两处符号与数值必须配套，抄一半会得到错误的泛函。`OMEGA` 在两处都要写，且要一致。`MAX_MEMORY` 的单位是 MB/core，课程示例给 2400；内存不够时 CP2K 会把部分积分落盘，速度明显下降。",
          },
          {
            type: "p",
            text: "什么时候值得上杂化？带隙、缺陷能级、电荷转移激发、以及 PBE 明显低估的反应势垒。什么时候不值得？大金属体系、只需要几何或振动频率、或者你还没做收敛测试——杂化的额外成本会掩盖更基础的错误。课程的建议很实在：先用 PBE 把结构和收敛做对，再拿杂化算单点。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "杂化的三个运行习惯",
            text: "① 用 `cp2k.psmp`（MPI+OpenMP）而不是纯 MPI，内存效率更好；② 用 PBE 预收敛的波函数做 `SCF_GUESS RESTART`，能省不少步；③ 先在小体系上确认 HFX 设置正确，再放大。",
          },
        ],
      },
      {
        id: "7.7",
        title: "ADMM：让杂化算得起",
        blocks: [
          {
            type: "p",
            text: "HFX 的成本主要来自四中心电子排斥积分。ADMM（auxiliary density matrix method）把密度矩阵投影到一个**更小的辅助基**上算精确交换，再加一项校正。它不改变泛函的定义，只改变「怎么算」，因此是纯加速手段。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "PBE0 + ADMM 的最小配置（片段）",
            text: `&DFT
  BASIS_SET_FILE_NAME BASIS_MOLOPT_UZH
  BASIS_SET_FILE_NAME BASIS_ADMM_UZH
  POTENTIAL_FILE_NAME POTENTIAL_UZH
  &AUXILIARY_DENSITY_MATRIX_METHOD
    ADMM_TYPE ADMMS
    EXCH_CORRECTION_FUNC PBEX
  &END AUXILIARY_DENSITY_MATRIX_METHOD
  &XC
    &XC_FUNCTIONAL PBE
    &END XC_FUNCTIONAL
    &HF
      FRACTION 0.25
    &END HF
  &END XC
&END DFT

&SUBSYS
  &KIND O
    BASIS_SET ccGRB-D-q6
    BASIS_SET AUX_FIT admm-dz-q6
    POTENTIAL GTH-HYB-q6
  &END KIND
&END SUBSYS`,
          },
          {
            type: "p",
            text: "三件事缺一不可：杂化泛函（`&HF FRACTION`）、每个 KIND 的 `BASIS_SET AUX_FIT`、以及 `&AUXILIARY_DENSITY_MATRIX_METHOD`。辅助基要跟主基**同族**：MOLOPT 主基配 `BASIS_ADMM_MOLOPT`，UZH 主基配 `BASIS_ADMM_UZH`。辅助基太小，校正项变大、精度下降；太大，加速就没了。`ADMM_TYPE` 里 `ADMMS/ADMMP/ADMMQ` 是较新的模型，`ADMM2` 在后处理流程里支持最广。",
          },
          {
            type: "p",
            text: "验证方法很直接：拿一个小体系，同一套主基与网格，比较「开 ADMM」与「不开 ADMM」的总能量、力和目标性质。差值应在你能接受的误差内；如果差得离谱，先查辅助基是否配错族、`EXCH_CORRECTION_FUNC` 是否与主泛函的交换部分一致。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "ADMM 不是「免费加速」",
            text: "它只加速 HFX，不改善主基组、网格和 SCF 阈值的收敛。用了 ADMM 仍然要做 CUTOFF 收敛、仍然要检查 `The Kohn Sham matrix is not 100% occupied` 一类警告（出现时降低 `EPS_PGF_ORB` 或 `EPS_FILTER_MATRIX`）。",
          },
        ],
      },
      {
        id: "7.8",
        title: "选型清单与四个常见坑",
        blocks: [
          {
            type: "steps",
            items: [
              { t: "先定性质", d: "几何/振动用 PBE 起步；带隙/缺陷/电荷转移再考虑 HSE；弱作用主导先加 D3。" },
              { t: "再定自旋", d: "有未成对电子就 UKS + MULTIPLICITY；多自旋态再加 MAGNETIZATION 初猜。" },
              { t: "然后加强关联", d: "过渡金属 d/f 电子局域化明显时加 +U，并做 U 值敏感性测试。" },
              { t: "最后才上杂化", d: "用 PBE 预收敛波函数起步；内存吃紧就上 ADMM，但仍要复核精度。" },
            ],
          },
          {
            type: "table",
            head: ["现象", "可能原因", "怎么查/怎么修"],
            rows: [
              ["结合能偏弱、层间距偏大", "没加色散", "加 DFTD3(BJ)；比较加/不加的结合能"],
              ["加了色散后能量异常低", "D3 与 rVV10 重复计入", "只保留一种；检查 &NON_LOCAL 是否同时存在"],
              ["NiO/Fe2O3 算成金属", "PBE 自交互误差", "加 +U，检查 L、U 与磁矩初猜"],
              ["磁矩为零或乱序", "初猜缺失/收敛到非磁解", "加 MAGNETIZATION，降低混合参数，RESTART"],
              ["杂化算不动/内存爆", "HFX 积分与存储", "psmp + MAX_MEMORY，或 ADMM；先小体系试"],
              ["杂化 + k 点特别慢", "HFX 在 k 点下成本高", "确认 k 网格必要性；能 Gamma-only 就先 Gamma-only"],
            ],
          },
          {
            type: "keypoints",
            items: [
              "泛函选择是「性质驱动」的：先问要算什么，再问哪层泛函够用",
              "色散、+U、杂化都是可叠加的修正，但每一种都要单独验证",
              "U 值、色散参数、杂化参数都不是跨程序通用的常数",
              "任何修正上线前，先在同一体系上做「开/关」对照",
            ],
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "动手：搭一份带修正的输入",
            desc: "在生成器里换泛函、加 VDW_POTENTIAL、开 UKS，观察这些节在输入树里的位置。",
          },
          {
            type: "callout",
            kind: "key",
            title: "下一章",
            text: "泛函定了，接下来是「怎么把 Kohn–Sham 方程解出来」。同样一套 PBE，用 OT 还是对角化、要不要展宽，会直接决定你能不能收敛、要花多少机时——这就是第 8 章。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "课程建议的计算顺序是？",
        options: [
          "直接用 HSE06，一步到位",
          "先用 PBE 把结构与收敛做对，再按需升级泛函",
          "先用 LDA 发表，再补 PBE",
          "泛函越贵越可信，直接上杂化",
        ],
        answer: 1,
        explain: "PBE 是工作马：便宜、稳定、参数少。先用它把结构、基组、截断能、SCF 都做对，再讨论泛函误差，才能分离变量。",
      },
      {
        q: "PBE + DFT-D3(BJ) 应该写在哪里？",
        options: [
          "&GLOBAL 下",
          "&FORCE_EVAL/&DFT/&XC/&VDW_POTENTIAL 下",
          "&SUBSYS/&CELL 下",
          "&MOTION 下",
        ],
        answer: 1,
        explain: "色散校正是交换关联能的一部分，放在 &XC 的 &VDW_POTENTIAL 里；&PAIR_POTENTIAL 的 TYPE 选 DFTD3(BJ)，并用 REFERENCE_FUNCTIONAL 指明泛函。",
      },
      {
        q: "关于 DFT+U 的 U 值，哪句话是对的？",
        options: [
          "VASP 的 U 值可以直接复制到 CP2K",
          "U 值与投影方法、基组、泛函绑定，必须针对本体系重新确定",
          "U 越大越准，直接取 10 eV",
          "U 只影响总能量，不影响磁矩",
        ],
        answer: 1,
        explain: "不同程序对 U 的定义与投影不同，数值不可直接搬。U 要用线性响应或与实验/高阶方法对照确定，并做敏感性测试；它同时影响带隙与磁矩。",
      },
      {
        q: "中性 O₂ 的三重态基态，`&DFT` 里至少要有？",
        options: [
          "CHARGE 2",
          "UKS T 与 MULTIPLICITY 3",
          "LSD F 与 MULTIPLICITY 1",
          "只写 MAGNETIZATION 即可",
        ],
        answer: 1,
        explain: "三重态需要自旋极化（UKS/LSD）与 2S+1=3。只给 MAGNETIZATION 而不开 UKS 不会产生自旋极化；CHARGE 2 则把电子数写错了。",
      },
      {
        q: "ADMM 的作用是？",
        options: [
          "把 GGA 变成杂化泛函",
          "用辅助基加速精确交换的计算，不改变泛函定义",
          "替代 CUTOFF 收敛测试",
          "自动选择 U 值",
        ],
        answer: 1,
        explain: "ADMM 把密度矩阵投影到较小的辅助基上算 HFX，再加校正项，属于纯加速。它不改变泛函，也不能替代基组、网格与 SCF 的收敛检查。",
      },
    ],
    terms: [
      { t: "交换关联泛函", en: "exchange-correlation functional", d: "把多电子相互作用压缩成一个依赖密度（及梯度等）的能量项，决定 DFT 的精度。" },
      { t: "色散校正", en: "dispersion correction", d: "在 GGA 能量外补上长程瞬时偶极作用，常见 D3、D4 与非局域泛函。" },
      { t: "DFT+U", en: "DFT+U", d: "对局域 d/f 轨道加 Hubbard 惩罚，修正自交互误差，打开带隙、稳住磁矩。" },
      { t: "自旋极化", en: "UKS / LSD", d: "让自旋向上与向下电子占用不同轨道，描述开壳层与磁性体系。" },
      { t: "杂化泛函", en: "hybrid functional", d: "混入一部分精确交换的泛函，如 PBE0（25%）、HSE06（25% 短程）。" },
      { t: "ADMM", en: "auxiliary density matrix method", d: "把密度矩阵投影到辅助基上算精确交换，以较小代价加速杂化计算。" },
    ],
    sources: [
      { t: "Exchange-Correlation Functionals", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/XC.html" },
      { t: "Dispersion Corrections (VDW_POTENTIAL)", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/XC/VDW_POTENTIAL.html" },
      { t: "DFT+U (KIND/DFT_PLUS_U)", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/SUBSYS/KIND/DFT_PLUS_U.html" },
      { t: "HFX with ADMM", url: "https://manual.cp2k.org/trunk/methods/dft/hartree-fock/admm.html" },
    ],
  };
})();
