(function () {
  "use strict";

  window.CONTENT = window.CONTENT || {};

  window.CONTENT["ch17"] = {
    id: "ch17",
    num: 17,
    part: "分析与性质",
    title: "光谱与激发态：从跃迁能量到谱图",
    subtitle: "TDDFT、XAS/XPS、IR 与 Raman",
    hours: 4.5,
    level: "进阶",
    intro:
      "光谱计算卖的不是能量，而是「能级差」和「跃迁强度」。这两件事对基组、截断、SCF 收敛比基态计算敏感得多，差一点设置，峰位和相对强度就可能变样。这一章把 TDDFT、芯谱与振动光谱的入口和判读方式过一遍，重点放在怎么确认结果可以拿去用。",
    goals: [
      "写出可运行的 TDDFT 输入，并把激发能、跃迁偶极、振子强度对应上",
      "用 &XAS_TDP 算芯态激发，理解为什么必须用 GAPW 与全电子基组",
      "知道 XPS 在 CP2K 里没有专门输入段，要靠 &XAS 的 DSCF 路线",
      "用 &VIBRATIONAL_ANALYSIS 取 IR/Raman 频率与强度，并识别常见坑"
    ],
    sections: [
      {
        id: "17.1",
        title: "光谱计算到底输出什么",
        blocks: [
          {
            type: "p",
            text: "基态计算给一个总能量，光谱计算给一串**跃迁**：从某个占据态跳到某个空态需要多少能量、这个跳跃有多「亮」。前者对应谱峰位置，后者对应峰的相对高低。CP2K 只输出分立跃迁，连续谱的形状要靠你自己加展宽做出来。"
          },
          {
            type: "formula",
            tex: "f_{i\\to f} = \\frac{2}{3}\\,\\Delta E_{if}\\,\\left|\\langle f|\\hat{\\boldsymbol{\\mu}}|i\\rangle\\right|^2",
            caption: "原子单位下的振子强度：跃迁能差乘上跃迁偶极矩的模方。注意它对跃迁能是线性的，对偶极是平方"
          },
          {
            type: "table",
            caption: "四类光谱在 CP2K 的入口",
            head: ["要算的", "入口", "输出形式"],
            rows: [
              ["紫外-可见（价激发）", "&FORCE_EVAL%&PROPERTIES%&TDDFPT", "控制台表格：激发能、跃迁偶极、振子强度"],
              ["X 射线吸收（XAS/近边）", "&DFT%&XAS_TDP", "独立的 `<PROJECT>.spectrum` 文件"],
              ["X 射线光电子能谱（XPS）", "&DFT%&XAS%METHOD DSCF（ΔSCF）", "总能量差"],
              ["红外 / 拉曼", "&VIBRATIONAL_ANALYSIS（顶层段）", "频率、IR 强度、Raman 活性"]
            ]
          },
          {
            type: "p",
            text: "四者共同的前提是**基态必须先算对**。TDDFT 与振动频率都建立在已收敛的基态密度上；基态差一点，激发能往往被放大成几十分之一 eV 的偏差。所以这一章的顺序是：先把基态收敛与基组做扎实，再看激发态。"
          },
          {
            type: "callout",
            kind: "info",
            title: "为什么峰强比峰位更难算",
            text: "跃迁能是能量差，误差大致随泛函系统性偏移；振子强度取决于跃迁偶极，对波函数细节与基组更敏感。同一个计算里，峰位可能对得不错而相对强度全错，这不是矛盾。"
          },
          { type: "keypoints", items: ["光谱输出的是分立跃迁：能量 + 强度", "振子强度对跃迁偶极是平方依赖，比能量更敏感", "基态不收敛时一切后处理都不可信"] }
        ]
      },
      {
        id: "17.2",
        title: "TDDFT：一份可运行的输入",
        blocks: [
          {
            type: "p",
            text: "CP2K 的 TDDFT 用 Tamm-Dancoff 近似（TDA），只求单激发、忽略 de-excitation 块。入口是 `&FORCE_EVAL%&PROPERTIES%&TDDFPT`，与 `&DFT` 平级——写成 `&DFT%&PROPERTIES` 是最常见的报错来源。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_tddft.inp：水分子前 5 个单重激发态",
            note: "完整可运行。分子孤立放在 12 Å 盒子里，PERIODIC NONE；KERNEL FULL 表示用完整核（PBE 这类 GGA 走这条）。",
            text: `&GLOBAL
  RUN_TYPE ENERGY
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SCF
      EPS_SCF 1.0E-7
    &END SCF
  &END DFT
  &PROPERTIES
    &TDDFPT
      NSTATES 5
      MAX_ITER 100
      CONVERGENCE [eV] 1.0E-6
      KERNEL FULL
    &END TDDFPT
  &END PROPERTIES
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
            type: "list",
            items: [
              "`NSTATES`：要解几个最低激发态。默认只有 1，想拼出谱形至少要十几个。",
              "`CONVERGENCE [eV]`：本征值收敛判据，默认 1.0E-5 hartree 量级，比 eV 粗，拼谱时建议收紧。",
              "`MAX_ITER`：Davidson 迭代上限，默认 50。慢收敛体系要放宽，否则会在中途报未收敛。",
              "`KERNEL FULL`：完整耦合核，GGA 与杂化都用它；`STDA` 是简化版，快但只适合大体系的粗略谱形。",
              "`RKS_TRIPLETS F`：默认不算三重态；要算磷光才打开。"
            ]
          },
          {
            type: "callout",
            kind: "warn",
            title: "杂化泛函要配 ADMM",
            text: "PBE0 这类杂化泛函的交换项极贵，CP2K 的做法是开 `&AUXILIARY_DENSITY_MATRIX_METHOD`（ADMM），基组里同时给 `BASIS_SET ORB` 与 `BASIS_SET AUX_FIT`。不开 ADMM 也能算，但成本会高一个量级。"
          },
          { type: "keypoints", items: ["&TDDFPT 在 &FORCE_EVAL 下，与 &DFT 平级", "NSTATES 默认 1，拼谱要放大", "杂化泛函配 ADMM 才实用"] }
        ]
      },
      {
        id: "17.3",
        title: "读 TDDFPT 的输出",
        blocks: [
          {
            type: "p",
            text: "输出分两段。第一段是初猜表，标题 `TDDFPT Initial Guess`，列出每个态的占据→空轨道序号与粗略激发能。它只是起点，**不要拿它当结果**。第二段在收敛之后出现，标题会写 `R-TDDFPT states of multiplicity 1`，数据行以 `TDDFPT|` 开头。"
          },
          {
            type: "table",
            caption: "收敛后表格的列",
            head: ["列", "含义", "怎么用"],
            rows: [
              ["State number", "激发态编号（按能量升序）", "与下文讨论的「第几个态」对应"],
              ["Excitation energy (eV)", "跃迁能", "横向平移即谱峰位置"],
              ["Transition dipole x y z", "跃迁偶极的三个分量（a.u.）", "判断跃迁极性、选择定则"],
              ["Oscillator strength", "振子强度（a.u.）", "决定峰高"]
            ]
          },
          {
            type: "p",
            text: "表头上方还会有一行说明偶极是用哪种形式算的。`DIPOLE_FORM` 可取 `VELOCITY`（默认，分子与周期体系都能用）、`LENGTH`（仅分子）、`BERRY`（仅周期）。长度形式的结果依赖原点，所以还要配 `&DIPOLE_MOMENTS%REFERENCE`（COM / COAC / ZERO / USER_DEFINED）——拿不准就留在默认的 VELOCITY。"
          },
          {
            type: "list",
            items: [
              "振子强度接近零的态在谱里几乎不出现，但它可能存在并参与后续弛豫。",
              "某个态的能量随 NSTATES 增大而明显变化，说明它和更高态耦合强，需要解更多态。",
              "同一体系换基组后峰位移动超过零点几 eV，说明基组还不够，别急着归因于泛函。",
              "谱线的宽度来自后处理展宽，CP2K 不会替你做。"
            ]
          },
          {
            type: "callout",
            kind: "key",
            title: "先看强度再看位置",
            text: "把振子强度列排序，找出最亮的几个态，再核对它们的能量与实验峰是否对得上。只盯着「第一个激发能」容易把暗态当成吸收边。"
          },
          { type: "keypoints", items: ["初猜表不是结果，要等 `TDDFPT|` 数据行", "振子强度决定峰高，偶极决定极化方向", "DIPOLE_FORM 与参考点要不匹配就会算错长度形式"] }
        ]
      },
      {
        id: "17.4",
        title: "XAS：&XAS_TDP",
        blocks: [
          {
            type: "p",
            text: "X 射线吸收看的是芯电子被激发到空态，能量在几百 eV 以上，空间上高度局域在原子上。这带来两个硬性要求：**必须用 GAPW**（高斯与平面波混合方法，能正确处理芯区），且被激发的原子要用**全电子基组与全电子赝势**（`POTENTIAL ALL`），否则芯态根本不在计算里。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "碳 K 边的 XAS_TDP 设置",
            note: "片段。要点：GAPW、全电子基组、&DONOR_STATES 指明激发哪个原子的哪个芯态、&KERNEL 单独给交换项。",
            text: `&DFT
  &QS
    METHOD GAPW
  &END QS
  &MGRID
    CUTOFF 500
    REL_CUTOFF 40
    NGRIDS 5
  &END MGRID
  &SCF
    EPS_SCF 1.0E-8
  &END SCF
  &XC
    &XC_FUNCTIONAL BHandHLYP
    &END XC_FUNCTIONAL
  &END XC
  &XAS_TDP
    GRID C 250 500
    &DONOR_STATES
      DEFINE_EXCITED BY_INDEX
      ATOM_LIST 1
      STATE_TYPES 1s
      N_SEARCH 3
      LOCALIZE
    &END DONOR_STATES
    &KERNEL
      RI_REGION 2.0
      &XC_FUNCTIONAL BHandHLYP
      &END XC_FUNCTIONAL
    &END KERNEL
  &END XAS_TDP
&END DFT`
          },
          {
            type: "p",
            text: "`&DONOR_STATES` 决定「从哪个芯态激发」：`ATOM_LIST` 给原子序号，`STATE_TYPES 1s` 指明 1s 芯态，`DEFINE_EXCITED BY_KIND` 则改按元素选。`N_SEARCH` 是搜索局部芯轨道的范围，`LOCALIZE` 打开后会把芯态先局域化，识别更稳。`GRID` 是芯区专用的积分网格，比基态需要的更密。"
          },
          {
            type: "p",
            text: "运行后先看一段诊断：CP2K 会打印 `The following localized MO(s) have been associated with the donor state(s)`，后面跟着 `overlap(sum)` 与 `Mulliken population analysis`。这两项都应接近 1.0——它们衡量「找到的这个轨道到底是不是那个原子的芯轨道」。若明显偏低，加大 `N_SEARCH` 或补上 `LOCALIZE`。"
          },
          {
            type: "callout",
            kind: "tip",
            title: "先只做识别，很便宜",
            text: "把 `&XAS_TDP%CHECK_ONLY` 设为 `.TRUE.`，CP2K 只做 donor 态识别就退出。用它先把原子序号、基组、赝势调对，再花时间算谱。"
          },
          { type: "keypoints", items: ["GAPW + 全电子基组是全电子芯态的前提", "overlap 与 Mulliken 接近 1 才说明选对了芯轨道", "谱数据在独立的 .spectrum 文件里"] }
        ]
      },
      {
        id: "17.5",
        title: "XPS：没有 &XPS，只有 ΔSCF",
        blocks: [
          {
            type: "p",
            text: "CP2K 没有 `&XPS` 这个输入段。做 XPS 的通行做法是 ΔSCF：分别算基态、以及某个原子芯能级被挖掉一个电子后的态，两者总能量之差就是该芯能级的结合能（只差一个符号或常数偏移）。入口是 `&DFT%&XAS`，把 `METHOD` 设为 `DSCF`。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "用 &XAS 的 DSCF 路线算芯能级",
            note: "片段，放在 &DFT 内。必须配合 GAPW 与全电子基组，否则没有芯态可挖。",
            text: `&DFT
  &QS
    METHOD GAPW
  &END QS
  &XAS
    METHOD DSCF
    ATOMS_LIST 1
    STATE_TYPE 1S
    ADDED_MOS 20
  &END XAS
&END DFT`
          },
          {
            type: "p",
            text: "`METHOD` 同一位置还能取 `TP_HH`（半空穴过渡势）、`TP_FH`（全空穴）、`TP_FLEX` 等近似，它们比 DSCF 便宜，但都需要先知道要激发哪个芯态。`ATOMS_LIST` 是被激发的原子序号，`STATE_TYPE` 默认 `1S`。ΔSCF 的关键难点在于**芯空穴态必须收敛到正确的那个解**，否则会掉回基态或落到别的局域解上，得到的能量差毫无意义。"
          },
          {
            type: "compare",
            left: {
              title: "ΔSCF",
              items: ["直接算能量差，物理图像清楚", "每个不等价原子都要单独算一次", "对初猜与收敛很挑剔"]
            },
            right: {
              title: "过渡势近似",
              items: ["一次计算拿到多个芯能级", "精度依赖半空穴假设", "适合先做趋势比较"]
            }
          },
          {
            type: "callout",
            kind: "danger",
            title: "化学位移要用同一套设置比",
            text: "XPS 的化学位移通常只有几 eV，而绝对结合能有几十到几百 eV 的系统偏移。跨体系比较时泛函、基组、芯空穴处理必须完全一致，绝对值的偏差不能靠「修正」掩盖。"
          },
          { type: "keypoints", items: ["CP2K 无 &XPS，用 &XAS%METHOD DSCF", "芯空穴态要确认收敛到正确解", "化学位移只在同一套设置内可比"] }
        ]
      },
      {
        id: "17.6",
        title: "IR 与 Raman：&VIBRATIONAL_ANALYSIS",
        blocks: [
          {
            type: "p",
            text: "振动频率来自质量加权的 Hessian 本征值，CP2K 用有限差分逐原子位移求 Hessian：每个原子每个方向都要做一次位移计算，所以总代价随原子数增长得很快。`INTENSITIES` 打开后同时算 IR 强度（偶极对位移的导数）与 Raman 活性（极化率对位移的导数），后者需要额外开极化率计算。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "频率 + IR/Raman 强度",
            note: "注意 &VIBRATIONAL_ANALYSIS 是顶层段（与 &FORCE_EVAL 平级），不在 &PROPERTIES 里面；IR 强度要 &DFT%&PRINT%&MOMENTS，Raman 要 &PROPERTIES%&LINRES%&POLAR。",
            text: `&FORCE_EVAL
  &DFT
    &PRINT
      &MOMENTS
        &EACH
          JUST_ENERGY 1
        &END EACH
      &END MOMENTS
    &END PRINT
  &END DFT
  &PROPERTIES
    &LINRES
      &POLAR
        DO_RAMAN .TRUE.
      &END POLAR
    &END LINRES
  &END PROPERTIES
&END FORCE_EVAL

&VIBRATIONAL_ANALYSIS
  INTENSITIES .TRUE.
  DX 0.01
&END VIBRATIONAL_ANALYSIS`
          },
          {
            type: "p",
            text: "`DX` 是有限差分步长（bohr），默认 0.01。太大则简谐近似被破坏、频率偏高；太小则数值噪声放大。分子用 0.01 通常合适，键很软或含重元素时可以试 0.005 看频率是否稳定。做频率前**必须先几何优化**，否则会出现虚频——虚频既可能是真过渡态，也可能是没优化好。"
          },
          {
            type: "callout",
            kind: "warn",
            title: "最容易放错的一段",
            text: "`&VIBRATIONAL_ANALYSIS` 写在最外层，和 `&FORCE_EVAL`、`&MOTION` 平级；塞进 `&PROPERTIES` 里会报 `unknown section`。它自己不是力场计算，只是拿当前结构做有限差分，所以位置在顶层。"
          },
          {
            type: "list",
            items: [
              "IR 强度需要偶极矩随位移变化，`&MOMENTS` 不开就只有频率没有强度。",
              "Raman 需要极化率，`&LINRES%&POLAR` 不开时 `DO_RAMAN` 没有数据可算。",
              "周期体系的偶极要用 Berry 相位（`PERIODIC_DIPOLE_OPERATOR` 默认开），关掉会退回局域偶极近似。",
              "`NPROC_REP` 控制并行复制的原子数，不设时可能对每个原子都做一次完整的位移计算。"
            ]
          },
          {
            type: "callout",
            kind: "warn",
            title: "简谐近似的固有偏差",
            text: "实验频率与简谐频率系统性差几个百分点，常靠经验缩放因子对齐。缩放因子依赖泛函与基组，不能拿别的体系的因子直接套。"
          },
          { type: "keypoints", items: ["频率必须先优化结构再算", "IR 要 MOMENTS，Raman 要 LINRES/POLAR", "DX 与缩放因子都要自测，不能照抄"] }
        ]
      },
      {
        id: "17.7",
        title: "常见坑：基组、截断、收敛",
        blocks: [
          {
            type: "p",
            text: "光谱计算对设置比基态敏感，原因很直接：它算的是**差值**。两个大数相减，每个大数的小误差都会被放大。下面四类问题按出现频率排列。"
          },
          {
            type: "p",
            text: "**基组**。激发态与芯态需要比基态更灵活的函数：价激发要在弥散区有分量，芯激发要在近核区有分量。用基态算得动的 DZVP 直接算 TDDFT，峰位常偏高、Rydberg 态整个缺失。Raman 对极化率敏感，加弥散函数通常明显改善。"
          },
          {
            type: "p",
            text: "**截断与网格**。`&MGRID%CUTOFF` 太小时，平面波部分无法表示尖锐的芯区或高能空态；XAS 这类要 GAPW 的计算对网格更挑。判断标准很简单：把 CUTOFF 提高一档重算，峰位变化应小于你要的分辨率，否则就是没收敛。"
          },
          {
            type: "p",
            text: "**收敛**。TDDFT 的 `CONVERGENCE` 默认偏松，XAS 的 `EPS_SCF` 要更紧，ΔSCF 还要额外确认落在了正确的局域解上。这三处共同的经验是：把判据收紧一个量级，看结果是否还在小数点后同样的位置。"
          },
          {
            type: "table",
            caption: "症状与可能原因",
            head: ["症状", "先查什么"],
            rows: [
              ["激发能整体偏高", "基组缺弥散函数、泛函、截断不足"],
              ["第一个峰强度接近零", "落在暗态上，需要按强度而非能量排序"],
              ["Raman 强度全是零", "没开 &LINRES%&POLAR 或 DO_RAMAN"],
              ["XAS 的 overlap 明显小于 1", "N_SEARCH 太小、没开 LOCALIZE、选错原子"],
              ["ΔSCF 的能量差接近 0", "芯空穴态掉回基态，初猜或占据设置有问题"]
            ]
          },
          { type: "keypoints", items: ["差值是光谱的核心，误差会被放大", "基组与截断要用「提高一档看变化」的方法验证", "收敛判据默认值对光谱偏松"] }
        ]
      },
      {
        id: "17.8",
        title: "交付前的检查清单",
        blocks: [
          {
            type: "p",
            text: "光谱结果最容易被误用的地方，是把「算出来了一条曲线」当成「算对了」。下面这份清单按顺序走完，能挡掉绝大多数低级错误。"
          },
          {
            type: "steps",
            items: [
              { t: "基态先过关", d: "几何优化收敛、EPS_SCF 收紧、无虚频（振动计算前）。" },
              { t: "基组够不够", d: "换大一档基组重算关键峰，峰位移动应小于目标分辨率。" },
              { t: "截断与网格", d: "CUTOFF 提高一档，检查峰位稳定性；XAS 用 GAPW 且检查 donor 识别。" },
              { t: "强度与位置分开看", d: "先按振子强度排序找亮态，再核对能量。" },
              { t: "记录全部设置", d: "泛函、基组、截断、展宽、缩放因子，少一项别人就无法复现。" }
            ]
          },
          {
            type: "demo",
            id: "scf",
            title: "SCF 收敛小实验",
            desc: "把收敛判据从松到紧改一遍，观察能量与后续性质怎么变。"
          },
          {
            type: "p",
            text: "最后一句实话：这一章所有数值（峰位、强度、频率）都必须来自你自己的计算，任何教程里给出的具体数字都只适用于它当时的体系与设置。方法层面的判断——该用什么基组、要不要收紧收敛、峰值可信到什么程度——才是能迁移的部分。"
          },
          {
            type: "callout",
            kind: "key",
            title: "可复现才算完成",
            text: "一个光谱结果的完整交付物是：输入、结构、以及一句「在什么设置下这个峰位稳定到多少 eV」。只有曲线没有设置，等于没有结果。"
          },
          { type: "keypoints", items: ["清单按「基态→基组→截断→判读」顺序走", "方法与设置比具体数值更可迁移", "交付要带完整设置与稳定性结论"] }
        ]
      }
    ],
    quiz: [
      {
        q: "在 CP2K 里 `&TDDFPT` 应该放在哪？",
        options: ["&DFT 里，和 &SCF 平级", "&FORCE_EVAL 里，和 &DFT 平级", "&MOTION 里", "&GLOBAL 里"],
        answer: 1,
        explain: "正确路径是 `&FORCE_EVAL%&PROPERTIES%&TDDFPT`；写进 &DFT 会因未知段报错。"
      },
      {
        q: "`TDDFPT Initial Guess` 表里的激发能可以直接当结果用吗？",
        options: ["可以，它就是最终激发能", "不可以，它只是初猜，要等收敛后的 `TDDFPT|` 数据行", "可以，但只对第一个态有效", "不可以，这张表只有轨道序号"],
        answer: 1,
        explain: "初猜表给出粗略能量与轨道配对，只有收敛后的表才带跃迁偶极与振子强度。"
      },
      {
        q: "算 XAS 时为什么必须用 GAPW 和全电子基组？",
        options: [
          "因为只有 GAPW 支持周期性",
          "因为芯态高度局域在核附近，需要正确描述近核区且赝势不能把芯态冻结掉",
          "因为这样才能用 ADMM",
          "因为 GAPW 更快"
        ],
        answer: 1,
        explain: "常规赝势把芯电子冻结进有效势，芯态根本不在计算里；GAPW 才能在核区用全电子描述。"
      },
      {
        q: "CP2K 里做 XPS 的正确入口是？",
        options: ["&DFT%&XPS", "&PROPERTIES%&XPS", "&DFT%&XAS 且 METHOD 取 DSCF", "&FORCE_EVAL%&PRINT%&XPS"],
        answer: 2,
        explain: "CP2K 没有 &XPS 段；芯能级结合能靠 ΔSCF，即 `&DFT%&XAS` 下 `METHOD DSCF`。"
      },
      {
        q: "Raman 强度算出来全是零，最可能的原因是？",
        options: ["没有做几何优化", "没开 &LINRES%&POLAR（或 DO_RAMAN）", "KERNEL 不是 FULL", "NSTATES 太小"],
        answer: 1,
        explain: "Raman 强度来自极化率对位移的导数，需要在 `&PROPERTIES%&LINRES%&POLAR` 里打开。"
      }
    ],
    terms: [
      { t: "激发能", en: "Excitation Energy", d: "从一个占据态跃迁到空态所需的能量，对应谱峰位置。" },
      { t: "振子强度", en: "Oscillator Strength", d: "无量纲的跃迁强度，正比于跃迁能与跃迁偶极矩模方的乘积，对应峰高。" },
      { t: "跃迁偶极矩", en: "Transition Dipole Moment", d: "初末态之间偶极算符的矩阵元，决定跃迁的选择定则与极化方向。" },
      { t: "Tamm-Dancoff 近似", en: "Tamm-Dancoff Approximation", d: "只保留单激发块、忽略去激发耦合的近似，CP2K 的 TDDFPT 基于它。" },
      { t: "芯态", en: "Core State", d: "近核的深能级（如 1s），XAS/XPS 的跃迁起点，需要用全电子方法描述。" },
      { t: "ΔSCF", en: "Delta SCF", d: "分别计算初末两个自洽态的总能量，用差值得出激发或电离能的方法。" },
      { t: "简谐频率", en: "Harmonic Frequency", d: "由质量加权 Hessian 的本征值换算的频率，与实验值有系统性偏差。" },
      { t: "展宽", en: "Broadening", d: "把分立跃迁卷积成连续谱时所加的线型宽度，属于后处理而非计算输出。" }
    ],
    sources: [
      { t: "CP2K 手册：TDDFT", url: "https://manual.cp2k.org/trunk/methods/properties/optical/tddft.html" },
      { t: "CP2K 手册：X 射线光谱", url: "https://manual.cp2k.org/trunk/methods/properties/x-ray/index.html" },
      { t: "CP2K 手册：红外光谱", url: "https://manual.cp2k.org/trunk/methods/properties/infrared.html" },
      { t: "CP2K 手册：拉曼光谱", url: "https://manual.cp2k.org/trunk/methods/properties/raman.html" }
    ]
  };
})();