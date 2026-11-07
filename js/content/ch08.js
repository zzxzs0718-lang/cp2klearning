(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch08"] = {
    id: "ch08",
    num: 8,
    part: "电子结构",
    title: "SCF：OT、对角化与展宽",
    subtitle: "同一套 PBE，怎么把 Kohn–Sham 方程解出来、解稳",
    hours: 2.5,
    level: "中级",
    intro:
      "泛函决定「方程长什么样」，SCF 决定「方程怎么解」。CP2K 给你两条路：把能量对轨道做最小化的 OT，和把 Kohn–Sham 矩阵对角化的传统路线。选错路线，轻则多花几倍机时，重则在金属体系上永远不收敛。这一章用两份真实练习输入做骨架，把两条路线、展宽和排错一次讲透。",
    goals: [
      "说清 SCF 在迭代什么，以及「收敛」在输出里对应哪一列",
      "判断一个体系该用 OT 还是对角化，并写出对应输入",
      "用 SMEAR 与 ADDED_MOS 处理金属和小带隙体系",
      "在 SCF 不收敛时按「结构—混合—展宽—外循环—初猜」顺序定位",
    ],
    sections: [
      {
        id: "8.1",
        title: "SCF 在算什么",
        blocks: [
          {
            type: "p",
            text: "Kohn–Sham 方程里，势依赖电子密度；密度又由方程的解（轨道）决定。这是一个**不动点问题**：给一个密度 → 构造势 → 解方程 → 得到新密度 → 混合新旧密度 → 再来一遍。所谓 SCF（自洽场），就是把这个循环跑到「输入密度和输出密度一致」。",
          },
          {
            type: "formula",
            tex: "\\left[-\\frac{1}{2}\\nabla^2 + V_{ext}(\\mathbf{r}) + V_H[\\rho](\\mathbf{r}) + V_{xc}[\\rho](\\mathbf{r})\\right]\\psi_i = \\varepsilon_i\\psi_i",
            caption: "势里的 ρ 来自上一轮轨道；这个互相依赖就是必须迭代的原因。",
          },
          {
            type: "p",
            text: "每一轮 SCF 里有两件独立的事：**解方程**（对角化或 OT）和**更新密度**（mixing）。对角化路线把两件事分开：先对角化拿到本征值与本征矢，再按占据数构造密度、做混合。OT 路线把它们揉进一个最小化里：直接让能量对轨道下降，密度随之更新。",
          },
          {
            type: "table",
            head: ["输出里的量", "含义", "怎么用"],
            rows: [
              ["`Convergence` 列", "本轮密度/能量变化量", "要小于 `EPS_SCF` 才算收敛"],
              ["`Total energy`", "当前总能量", "收敛前会小幅波动，不必每步都看"],
              ["`SCF run converged`", "收敛标志", "出现才说明结果可用"],
              ["`outer SCF iter`", "外层循环编号（OT）", "外层每轮更新一次预条件器"],
            ],
          },
          {
            type: "callout",
            kind: "danger",
            title: "版本差异：不收敛现在会直接退出",
            text: "课程录像用的是 7.1 时代版本，即使 SCF 不收敛也会继续算下一个离子步。**2024.1 起默认改为中止**：达到 `MAX_SCF`（默认 50）仍未达标，程序直接报 `SCF run NOT converged` 并退出。这更安全，但也意味着旧脚本里「带病往下跑」的习惯不再可行。",
          },
        ],
      },
      {
        id: "8.2",
        title: "两条路线：OT 与对角化",
        blocks: [
          {
            type: "compare",
            left: {
              title: "OT（轨道变换）",
              items: [
                "把能量对轨道做最小化，不做完整对角化",
                "成本约 O(MN²)，内存约 O(MN)：M 基函数、N 占据轨道",
                "适合绝缘体、大体系、无空带",
                "金属/小带隙收敛差，需要展宽与新式选项",
                "课程版本不支持 k 点；新版手册已支持复数 k 点",
              ],
            },
            right: {
              title: "对角化（DIAG）",
              items: [
                "构造并对角化 Kohn–Sham 矩阵，成本约 O(M³)",
                "天然支持空带、展宽、k 点",
                "需要密度混合，参数更敏感",
                "课程版本下 +U 只能配 OT",
                "大体系内存与机时都更贵",
              ],
            },
          },
          {
            type: "p",
            text: "课程给的判断很直接：**大体系、绝缘体、只关心占据轨道 → OT**；**金属、需要空带/展宽、要 k 点 → 对角化**。但手册更新后边界变模糊了：直接 OT 现在也支持分数占据与 k 点，只是要额外打开 `ROTATION` 与 `ENERGIES`，并且要验证结果与对角化一致。所以正确说法是：**OT 是默认快路，遇到金属或 k 点先确认你的版本支持到什么程度**。",
          },
          {
            type: "callout",
            kind: "info",
            title: "两种 OT 不是一回事",
            text: "`&SCF/&OT` 是直接 OT；`&SCF/&DIAGONALIZATION/&OT` 只是把 OT 当「固定矩阵的迭代本征求解器」，外层仍走对角化的占据、密度与混合。后者不能设 `ROTATION`、`ENERGIES`，也不等价于直接 OT。",
          },
        ],
      },
      {
        id: "8.3",
        title: "OT 实战：从练习输入读起",
        blocks: [
          {
            type: "p",
            text: "下面是课程练习里 Cu(111)/H₂O 体系的 OT 输入骨架（几何与基组已简化，关键词保持原样）。注意它用的是 `FULL_ALL` 预条件器，而不是常见的 `FULL_SINGLE_INVERSE`——两者都能用，前者更稳、更贵。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "ot.inp（节选）",
            text: `&GLOBAL
  PROJECT cuh2o_ot
  RUN_TYPE ENERGY_FORCE
  PRINT_LEVEL LOW
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    UKS T
    &MGRID
      NGRIDS 4
      CUTOFF 350
      REL_CUTOFF 60
    &END MGRID
    &QS
      WF_INTERPOLATION ASPC
      EXTRAPOLATION_ORDER 3
    &END QS
    &SCF
      MAX_SCF 100
      EPS_SCF 1.0E-6
      SCF_GUESS RESTART
      &OT T
        MINIMIZER CG
        LINESEARCH 2PNT
        PRECONDITIONER FULL_ALL
      &END OT
      &OUTER_SCF T
        EPS_SCF 1.0E-5
        MAX_SCF 100
      &END OUTER_SCF
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "三个参数值得单独说。`MINIMIZER CG` 是默认且稳健的共轭梯度；`DIIS` 在难收敛时更快但可能不稳，`BROYDEN` 介于两者之间，课程建议「都要测试」。`PRECONDITIONER` 决定轨道更新的「尺度」：`FULL_SINGLE_INVERSE` 是常用默认，`FULL_ALL` 更稳定但更贵；超大体系在 CUDA 版本里还可以试 `PRECOND_SOLVER INVERSE_UPDATE`。",
          },
          {
            type: "p",
            text: "`OUTER_SCF` 是 OT 特有的结构：内层 SCF 不必一次收敛，达到 `MAX_SCF` 就退出，外层更新一次预条件器再继续。手册建议内层 `MAX_SCF` 可降到 16–32、外层 8–16，多数体系够用；课程输入给 100/100 是保守写法。`LINESEARCH 2PNT` 比 3PNT 便宜，难收敛时再换 3PNT。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "OT 的前置条件",
            text: "OT 最小化的是**占据子空间**。如果体系有部分占据（金属、小 gap），必须显式给展宽并打开 `ROTATION`、`ENERGIES`，否则能量对占据数不驻定，收敛会假象般停住。",
          },
        ],
      },
      {
        id: "8.4",
        title: "对角化实战：混合比最小化更关键",
        blocks: [
          {
            type: "p",
            text: "同一体系的对角化版本，把 `&OT` 换成 `&DIAGONALIZATION`，并补上混合与展宽。这份输入里 `NBROYDEN 8` 是 `NBUFFER` 的别名（历史写法），作用都是控制 Broyden 混合保留的历史步数。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "diag.inp（节选）",
            text: `&DFT
  UKS T
  &MGRID
    CUTOFF 350
    REL_CUTOFF 60
  &END MGRID
  &QS
    EPS_DEFAULT 1.0E-14
    WF_INTERPOLATION ASPC
    EXTRAPOLATION_ORDER 3
  &END QS
  &SCF
    SCF_GUESS RESTART
    EPS_SCF 1.0E-6
    MAX_SCF 500
    ADDED_MOS 500
    CHOLESKY INVERSE
    &SMEAR ON
      METHOD FERMI_DIRAC
      ELECTRONIC_TEMPERATURE [K] 300
    &END SMEAR
    &DIAGONALIZATION
      ALGORITHM STANDARD
      EPS_ADAPT 0.01
    &END DIAGONALIZATION
    &MIXING
      METHOD BROYDEN_MIXING
      ALPHA 0.1
      BETA 1.5
      NBROYDEN 8
    &END MIXING
  &END SCF
&END DFT`,
          },
          {
            type: "p",
            text: "`ADDED_MOS 500` 是给展宽留的空带缓冲：费米面附近的电子会占据到空带上，缓冲不够会把最高带占满，得到错误的占据与力。`CHOLESKY INVERSE` 指定用 Cholesky 分解求逆，通常比通用求逆快。`EPS_ADAPT 0.01` 让对角化在 SCF 早期用较松的精度，避免每步都做「无用功」。",
          },
          {
            type: "p",
            text: "混合参数是这门课里最「手艺」的部分：`ALPHA 0.1` 表示新密度只占 10%，步子小、稳但慢；`BETA 1.5` 是 Broyden 的历史权重；`NBROYDEN 8` 多留几步历史。收敛困难时先降 `ALPHA`（如 0.05），再考虑换 `PULAY_MIXING` 或 `KERKER_MIXING`；不要同时改三个参数，否则你不知道是谁起了作用。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "对角化与 +U 的兼容性",
            text: "课程版本（7.1）的对比表明确写「对角化不支持 DFT+U」，所以含 +U 的体系要走 OT。新版是否支持要以你手头版本的输入参考为准；拿不准时按课程口径选 OT，或先做小体系测试。",
          },
        ],
      },
      {
        id: "8.5",
        title: "展宽：金属与小带隙的必需品",
        blocks: [
          {
            type: "p",
            text: "绝缘体有明确的带隙，占据数非 0 即 2（或 1），能量对占据数不敏感。金属没有带隙，费米面附近有无数近简并态；如果强行整数占据，SCF 会在两个几乎简并的解之间来回跳，永远不收敛。展宽的做法是：允许分数占据，按费米–狄拉克分布填充，相当于给电子一个「温度」。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "金属体系的 SCF 片段",
            text: `&SCF
  EPS_SCF 1.0E-6
  MAX_SCF 200
  ADDED_MOS AUTO
  &SMEAR ON
    METHOD FERMI_DIRAC
    ELECTRONIC_TEMPERATURE [K] 500
  &END SMEAR
  &MIXING
    METHOD BROYDEN_MIXING
    ALPHA 0.1
    BETA 1.5
  &END MIXING
&END SCF`,
          },
          {
            type: "table",
            head: ["METHOD", "特点", "使用要点"],
            rows: [
              ["FERMI_DIRAC", "有明确温度解释，对应 Helmholtz 自由能", "结果要外推到 T→0"],
              ["GAUSSIAN", "高斯展宽，收敛更「软」", "SIGMA 要逐步降到 0 再报能量"],
              ["METHFESSEL_PAXTON", "冷展宽，接近整数占据", "适合需要更准能量的金属"],
              ["MARZARI_VANDERBILT", "冷展宽变体", "同样要做展宽参数收敛"],
            ],
            caption: "展宽越大越容易收敛，但能量与力偏离零温结果越多——必须做参数收敛。",
          },
          {
            type: "p",
            text: "`ADDED_MOS AUTO` 让 CP2K 自动给缓冲空带，并在最高带仍被明显占据时继续加；加到基组上限还没解决，会给出诊断并停止。这比手写一个固定数字省心，但不能突破基组本身的限制。",
          },
          {
            type: "callout",
            kind: "key",
            title: "展宽不是「免费稳定器」",
            text: "用 500 K 展宽收敛后，直接拿这个能量和力去报 0 K 性质，误差可能比收敛误差大得多。正确做法：用较高温度帮助收敛，再逐步降温（或降 SIGMA）到目标值，并检查总能量、磁矩、力是否稳定。",
          },
        ],
      },
      {
        id: "8.6",
        title: "阈值、初猜与重启",
        blocks: [
          {
            type: "p",
            text: "`EPS_SCF` 默认约 1.0E-5，课程建议至少设到 1.0E-5 以下；算力/应力、频率、NEB 时建议 1.0E-6。注意收敛判据是密度/能量的变化量，不是总能量的绝对值，所以「能量看起来不动了」不等于收敛。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "从便宜计算续算波函数",
            text: `&SCF
  SCF_GUESS RESTART
  WFN_RESTART_FILE_NAME ./pbe_DZVP-RESTART.wfn
  EPS_SCF 1.0E-6
  MAX_SCF 100
&END SCF`,
          },
          {
            type: "p",
            text: "`SCF_GUESS` 有三个常用值：`ATOMIC`（原子密度叠加，默认）、`RESTART`（读波函数文件）、`EXTERNAL_DENSITY`（读 cube 密度，仅半局域 GPW，且网格必须与最细网格一致）。`RESTART` 是最实用的加速手段：先用小基组 DZVP 收敛，再把波函数喂给 TZVP；先用 PBE 收敛，再喂给 PBE0。前提是**赝势相同**，否则波函数没有意义。",
          },
          {
            type: "p",
            text: "重启文件有两种：Gamma-only 的 `<project>-RESTART.wfn` 与 k 点的 `<project>-RESTART.kp`，**不能互换**。想从 Gamma-only 结果出发做 k 点计算，得用 `&DFT/&ENERGY_CORRECTION` 的 Harris 泛函生成 `.kp`（2026.2 起），或者干脆重算。",
          },
          {
            type: "table",
            head: ["参数", "作用", "常见取值"],
            rows: [
              ["`EPS_SCF`", "SCF 收敛阈值", "1.0E-5（常规）、1.0E-6（力/频率）"],
              ["`MAX_SCF`", "内层最大步数", "50–200；OT 可降到 16–32"],
              ["`EPS_DEFAULT`", "QS 总精度（含积分筛）", "1.0E-12 左右"],
              ["`CUTOFF`", "网格截断", "350–600 Ry，需收敛测试"],
            ],
          },
        ],
      },
      {
        id: "8.7",
        title: "不收敛时的六个诊断",
        blocks: [
          {
            type: "p",
            text: "不要一上来就 `IGNORE_CONVERGENCE_FAILURE`。手册的态度很明确：忽略收敛失败会带来错误的占据、带结构、响应性质和「原子乱飞」，只能当最后手段。按下面的顺序排查，绝大多数问题在前三步就能定位。",
          },
          {
            type: "steps",
            items: [
              { t: "① 结构", d: "有没有原子重叠、缺失的氢、错误的键长？先在起点做单点，确认 SCF 能收敛。" },
              { t: "② 电子态", d: "CHARGE 与 MULTIPLICITY 是否符合真实电子数？开壳层是否开了 UKS？" },
              { t: "③ 混合", d: "先降 ALPHA（0.1→0.05），再换 BROYDEN/PULAY/KERKER；一次只改一个。" },
              { t: "④ 展宽", d: "金属/小 gap 是否忘了 SMEAR？温度是否太低？ADDED_MOS 是否被占满？" },
              { t: "⑤ 外循环", d: "OT 的内层 MAX_SCF 是否太大、预条件器是否该换 FULL_ALL？OUTER_SCF 是否缺少？" },
              { t: "⑥ 初猜", d: "用 RESTART 从便宜计算续算；多自旋态给 MAGNETIZATION；必要时先用小基组。" },
            ],
          },
          {
            type: "table",
            head: ["症状", "最可能原因", "验证方法"],
            rows: [
              ["Convergence 在 1E-4 附近来回", "混合太激进或体系近简并", "降 ALPHA 重跑，看是否单调下降"],
              ["能量振荡、占据乱跳", "金属未展宽", "加 SMEAR，检查最高带占据"],
              ["第一步就失败", "结构坏或 CHARGE 错", "可视化结构，核对电子数"],
              ["OT 步数很多但不降", "预条件器不适配", "换 FULL_ALL，检查 ENERGY_GAP"],
              ["杂化/大体系特别慢", "HFX 内存不足在落盘", "看 HFX_MEM_INFO，增大 MAX_MEMORY"],
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "一个便宜的诊断实验",
            text: "把 `MAX_SCF` 改成 1 跑一次，看第一轮的 Convergence 量级。如果第一轮就是 1E+2，说明初猜/结构有大问题；如果第一轮是 1E-1，只是收敛慢，调混合或加步数即可。",
          },
        ],
      },
      {
        id: "8.8",
        title: "k 点、自旋与这一章的收束",
        blocks: [
          {
            type: "p",
            text: "k 点采样解决的是「小晶胞 → 倒空间格矢长 → 布里渊区需要更密采样」的问题。金属必须做 k 点收敛；半导体/绝缘体也要检查。课程口径是：**k 点只能配对角化**（7.1 时代），所以含 k 点的计算通常走 DIAG 路线。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Monkhorst-Pack 3×3×3",
            text: `&DFT
  &KPOINTS
    SCHEME MONKHORST-PACK 3 3 3
    SYMMETRY T
    VERBOSE T
    FULL_GRID T
  &END KPOINTS
&END DFT`,
          },
          {
            type: "p",
            text: "`SYMMETRY T` 用晶体对称性约化 k 点，省机时；`FULL_GRID T` 用完整网格，避免对称约化带来的边界问题。做收敛测试时建议先 `FULL_GRID T` 确认，再开对称性比较。自旋与 k 点是独立的两个维度：`UKS T` 管自旋，`&KPOINTS` 管倒空间采样，可以同时开。",
          },
          {
            type: "keypoints",
            items: [
              "SCF 是「解方程 + 更新密度」的不动点迭代，收敛看 Convergence 列而非总能量",
              "OT 快、省内存，适合绝缘体与大体系；对角化稳、支持空带与 k 点",
              "金属/小 gap 必须展宽，且展宽参数要收敛，不能拿高温结果直接报 0 K",
              "不收敛先查结构、电荷/多重度、混合，再谈展宽与外循环",
              "2024.1 起不收敛会中止；不要用 IGNORE_CONVERGENCE_FAILURE 掩盖问题",
            ],
          },
          {
            type: "demo",
            id: "scf",
            title: "动手：调一遍 SCF",
            desc: "切换 OT/对角化、改混合参数与展宽温度，观察收敛步数与能量震荡。",
          },
          {
            type: "callout",
            kind: "key",
            title: "下一章",
            text: "电子结构收敛了，接下来让原子动起来：几何优化、晶胞优化、约束，以及用 CI-NEB 找过渡态。第 9 章会把「力」真正用起来。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "CP2K 2024.1 之后，SCF 达到 MAX_SCF 仍未收敛会怎样？",
        options: [
          "继续计算下一个离子步，只打印警告",
          "默认中止程序并报 SCF run NOT converged",
          "自动把 EPS_SCF 放宽十倍",
          "自动切换到 OT",
        ],
        answer: 1,
        explain: "2024.1 起默认 abort。旧版本会继续，这正是课程录像里需要特别提醒的差异；IGNORE_CONVERGENCE_FAILURE 只应作为最后手段。",
      },
      {
        q: "下列哪种情形最适合直接用 OT？",
        options: [
          "需要大量空带与 k 点采样的金属",
          "大体系绝缘体，只关心占据轨道",
          "必须使用 DFT+U 且版本只支持对角化",
          "需要精确的带结构",
        ],
        answer: 1,
        explain: "OT 避免完整对角化，成本约 O(MN²)，适合大体系绝缘体。金属、空带、k 点在课程版本里应走对角化；+U 在课程版本里也只能配 OT。",
      },
      {
        q: "`ADDED_MOS` 的作用是？",
        options: [
          "增加 MPI 进程数",
          "给展宽提供额外的空带缓冲",
          "指定混合历史步数",
          "控制 SCF 最大步数",
        ],
        answer: 1,
        explain: "展宽会让电子占据到费米面以上的空带；ADDED_MOS 提供这些空带。设置太小会让最高带被占满，得到错误的占据与力。",
      },
      {
        q: "金属体系用 500 K 费米–狄拉克展宽收敛后，正确的做法是？",
        options: [
          "直接把该能量作为 0 K 结果发表",
          "逐步降低温度/展宽并检查能量与力，外推到目标温度",
          "把 MULTIPLICITY 改成 1",
          "关闭 UKS",
        ],
        answer: 1,
        explain: "展宽改变的是有限温自由能。要得到可与 0 K 比较的结果，需要做展宽参数收敛并外推，不能拿高温结果直接当基态能量。",
      },
      {
        q: "`SCF_GUESS RESTART` 的前提是？",
        options: [
          "必须与上次使用完全相同的泛函和基组",
          "赝势相同即可，基组/泛函可以升级",
          "必须同一天运行",
          "只能用于 Gamma-only",
        ],
        answer: 1,
        explain: "波函数由赝势与基组定义；只要赝势一致，就可以从 DZVP 续算到 TZVP、从 PBE 续算到 PBE0。基组/泛函升级正是 RESTART 的典型用法。",
      },
    ],
    terms: [
      { t: "自洽场", en: "SCF", d: "迭代求解依赖自身密度的 Kohn–Sham 方程，直到输入输出密度一致。" },
      { t: "OT", en: "orbital transformation", d: "把能量对轨道做最小化、避免完整对角化的方法，适合大体系绝缘体。" },
      { t: "展宽", en: "smearing", d: "允许分数占据并用有限温分布填充，处理金属与小带隙体系。" },
      { t: "混合", en: "mixing", d: "把新一轮密度与历史密度加权组合，控制 SCF 稳定性与速度。" },
      { t: "预条件器", en: "preconditioner", d: "OT 中近似 Hessian 的矩阵，决定轨道更新方向与收敛速度。" },
      { t: "空带缓冲", en: "ADDED_MOS", d: "为展宽额外保留的虚轨道数，防止最高带被部分占据填满。" },
    ],
    sources: [
      { t: "How to Converge the SCF", url: "https://manual.cp2k.org/trunk/methods/dft/convergence.html" },
      { t: "Orbital Transformation", url: "https://manual.cp2k.org/trunk/methods/dft/orbital_transformation.html" },
      { t: "&SCF input reference", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/SCF.html" },
      { t: "&SMEAR input reference", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/SCF/SMEAR.html" },
    ],
  };
})();