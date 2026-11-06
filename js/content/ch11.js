(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch11"] = {
    id: "ch11",
    num: 11,
    part: "结构与振动",
    title: "几何与晶胞优化",
    subtitle: "让原子走到力为零的地方，再决定要不要放开晶胞",
    hours: 3,
    level: "进阶",
    intro:
      "优化就是在一个高维能量面上找力为零的点。听起来简单，实际工作里 90% 的麻烦来自三件事：判据没读懂、优化器选错、以及把「SCF 收敛」当成「结构收敛」。这一章把 GEO_OPT 和 CELL_OPT 拆开讲，最后告诉你为什么收敛之后还要再算一次频率。",
    goals: [
      "写出一份完整的 GEO_OPT 输入，读懂 OPT 报告块，并解释四个收敛判据的含义与单位",
      "在 BFGS、LBFGS、CG 之间做出有理由的选择，并会调 trust radius 止血",
      "用 CELL_OPT 优化晶胞，正确设置外压、压力容差与 cell 自由度约束",
      "用固定原子约束搭 slab 模型，并在收敛后用振动分析确认没有虚频",
    ],
    sections: [
      {
        id: "11.1",
        title: "优化在做什么：从力出发的一小步一步",
        blocks: [
          {
            type: "p",
            text: "给定原子位置，DFT 给你总能量 $E$ 和每个原子上的力 $\\mathbf{F}_i = -\\partial E/\\partial \\mathbf{R}_i$。优化器用这些力猜一个方向、走一步、再算力，如此循环。力的单位是 Hartree/Bohr，判据里出现的 4.5E-4 就是「每 Bohr 上 4.5×10⁻⁴ Hartree 的斜率」——听起来抽象，换算成 eV/Å 大约是 0.023。",
          },
          {
            type: "p",
            text: "两个任务要分清：`RUN_TYPE GEO_OPT` 只动原子、晶胞固定，回答「这些原子怎么排最稳」；`RUN_TYPE CELL_OPT` 同时动原子和晶胞，回答「这个材料在给定外压下晶格常数是多少」。后者每步都要应力张量，贵得多，所以先做前者。",
          },
          {
            type: "key",
            items: [
              { k: "RUN_TYPE GEO_OPT", v: "固定晶胞，只松弛原子位置", tag: "常用" },
              { k: "RUN_TYPE CELL_OPT", v: "原子 + 晶胞一起松弛，需要应力", tag: "进阶" },
              { k: "OPTIMIZER BFGS", v: "默认优化器，小中型体系首选", tag: "默认值" },
              { k: "MAX_ITER 200", v: "最多走多少步；到不了就停，不会自动加", tag: "默认值" },
              { k: "&CONSTRAINT", v: "固定某些原子或某些方向，做 slab 必备", tag: "常用" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "起点比优化器重要",
            text: "手册对初始结构的要求写得很直白：严重近接触、不合理配位、坏晶胞会让力变成天文数字，优化器第一步就把结构甩到能量面之外，接着 SCF 失败。搭结构时多花十分钟，比事后调一百步优化器划算。",
          },
        ],
      },
      {
        id: "11.2",
        title: "第一份 GEO_OPT 输入",
        blocks: [
          {
            type: "p",
            text: "拿甲醛（CH₂O）做例子，放在 12 Å 的盒子里，PBE + MOLOPT 基组。注意 `RUN_TYPE` 改成 `GEO_OPT` 之后，其余部分和单点输入完全一样——优化不是另一种计算，只是把单点算很多次。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "ch2o_geo.inp",
            text: `&GLOBAL
  PROJECT ch2o
  RUN_TYPE GEO_OPT
  PRINT_LEVEL MEDIUM
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
      EXTRAPOLATION ASPC
      EXTRAPOLATION_ORDER 3
    &END QS
    &SCF
      SCF_GUESS ATOMIC
      EPS_SCF 1.0E-7
      MAX_SCF 50
      &OT
        MINIMIZER DIIS
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
      &OUTER_SCF
        EPS_SCF 1.0E-7
        MAX_SCF 10
      &END OUTER_SCF
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
      C   0.000  0.000  0.000
      O   0.000  0.000  1.205
      H   0.000  0.943 -0.588
      H   0.000 -0.943 -0.588
    &END COORD
    &KIND C
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q4
    &END KIND
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
  &GEO_OPT
    TYPE MINIMIZATION
    OPTIMIZER BFGS
    MAX_ITER 200
    MAX_DR 3.0E-03
    RMS_DR 1.5E-03
    MAX_FORCE 4.5E-04
    RMS_FORCE 3.0E-04
  &END GEO_OPT
&END MOTION`,
          },
          {
            type: "p",
            text: "`&MOTION` 是 `&FORCE_EVAL` 的兄弟节点，不是它的子节点。放错层级是新手最常见的输入错误之一——CP2K 会报 unknown section，然后你以为是关键字拼错了。",
          },
          {
            type: "p",
            text: "另外两个细节值得现在就养成习惯：`EXTRAPOLATION ASPC` 让每一步用上一步的波函数作初猜，能省大量 SCF 迭代；`&OUTER_SCF` 在 OT 之后再做一轮自洽校正，把优化末段最容易出现的「力有噪声」压下去。",
          },
          {
            type: "table",
            head: ["任务类型", "动什么", "需要额外设置"],
            rows: [
              ["`ENERGY`", "什么都不动", "无"],
              ["`ENERGY_FORCE`", "什么都不动，但算力", "用来估时、检查初始结构是否合理"],
              ["`GEO_OPT`", "原子位置", "`&MOTION %GEO_OPT`"],
              ["`CELL_OPT`", "原子位置 + 晶胞", "`&MOTION %CELL_OPT` + `STRESS_TENSOR`"],
              ["`VIBRATIONAL_ANALYSIS`", "微扰原子，算 Hessian", "`&VIBRATIONAL_ANALYSIS`，见第 13 章"],
            ],
          },
        ],
      },
      {
        id: "11.3",
        title: "四个判据，和 OPT 报告块怎么读",
        blocks: [
          {
            type: "p",
            text: "收敛不是「能量不再下降」，而是**位移和力同时小到阈值以下**。四个判据两两成对：`MAX_*` 管最坏的那个原子/分量，`RMS_*` 管整体均方根。四个**全部**满足才算收敛；只看 RMS 会漏掉某个别原子还在乱跑的情况。",
          },
          {
            type: "table",
            head: ["关键字", "量的是什么", "单位", "手册默认"],
            rows: [
              ["`MAX_DR`", "单步最大原子位移", "Bohr", "3.0E-03"],
              ["`RMS_DR`", "单步位移的均方根", "Bohr", "1.5E-03"],
              ["`MAX_FORCE`", "最大原子受力分量", "Hartree/Bohr", "4.5E-04"],
              ["`RMS_FORCE`", "受力的均方根", "Hartree/Bohr", "3.0E-04"],
              ["`MAX_ITER`", "最多优化步数", "步", "200"],
            ],
          },
          {
            type: "code",
            lang: "text",
            title: "输出里的 OPT 块（结构示意）",
            text: `OPT| Step number                            12
OPT| Optimization method                    BFGS
OPT| Total energy [hartree]                 -114.xxxxxx
OPT| Internal pressure [bar]                 -
OPT| Change in energy [hartree]             -x.xxE-04
OPT| Step size [Bohr]                        x.xxE-02
OPT| Trust radius [angstrom]                 2.500E-01
OPT| Decrease in energy                      YES
OPT| Maximum step size         x.xxE-02     tolerance  3.00E-03   NO
OPT| RMS step size             x.xxE-03     tolerance  1.50E-03   YES
OPT| Maximum gradient          x.xxE-04     tolerance  4.50E-04   YES
OPT| RMS gradient              x.xxE-04     tolerance  3.00E-04   YES`,
          },
          {
            type: "p",
            text: "这个块每步打一次，`YES/NO` 就是四个判据的当场判定。看到三个 YES 一个 NO，就知道该往哪个方向使劲：NO 在 `Maximum step size` 说明还有原子在走大步，通常是结构还差得远；NO 在 `Maximum gradient` 但 `RMS gradient` 已经 YES，往往是个别原子的力降不下去，先怀疑 SCF 噪声或约束设错。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "收敛不代表能量单调",
            text: "手册专门提醒：几何收敛和能量单调下降是两件事。中间某一步能量升高完全可能——优化器在绕过一个鞍点或调整整体取向。真正要警惕的是「最后一步能量仍明显升高」并且判据刚满足：那多半落在了一个非真极小点上，用第 13 章的振动分析查虚频就能确认。",
          },
          {
            type: "p",
            text: "还有一条容易忽略：优化会因为你放在工作目录里的 `EXIT` 或 `EXIT_GEO` 文件而停下来，也会被 `WALLTIME` 截断。所以「跑完了」有三种含义——收敛、超步数、被中止。看输出末尾的提示，别看文件在不在。",
          },
        ],
      },
      {
        id: "11.4",
        title: "优化器：BFGS、LBFGS、CG 怎么选",
        blocks: [
          {
            type: "p",
            text: "三个优化器的差别在于**它们怎么猜下一步**。BFGS 逐步累积一个完整的 Hessian 近似，方向准、步数少，代价是内存随原子数平方增长；LBFGS 只保留最近几步的曲率信息，内存便宜，适合大体系；CG 不用 Hessian，每步沿梯度方向做线搜索，稳健但费评估次数。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "三种优化器的写法",
            text: `&MOTION
  &GEO_OPT
    OPTIMIZER BFGS
    MAX_ITER 300
    &BFGS
      TRUST_RADIUS 0.25
      USE_MODEL_HESSIAN T
    &END BFGS
  &END GEO_OPT
&END MOTION

&MOTION
  &GEO_OPT
    OPTIMIZER LBFGS
    MAX_ITER 300
    &LBFGS
      MAX_H_RANK 5
      MAX_F_PER_ITER 20
    &END LBFGS
  &END GEO_OPT
&END MOTION

&MOTION
  &GEO_OPT
    OPTIMIZER CG
    MAX_ITER 300
    &CG
      &LINE_SEARCH
        TYPE 2PNT
      &END LINE_SEARCH
    &END CG
  &END GEO_OPT
&END MOTION`,
          },
          {
            type: "p",
            text: "`TRUST_RADIUS` 是替优化器踩刹车的：一步最多走这么远（BFGS 默认 0.25 Å）。它默认值历史上从 0.1 改到 0.25，手册也注明「大的值可能不稳」。所以优化一开始就上下横跳、能量忽高忽低，第一反应是把 `TRUST_RADIUS` 降到 0.1–0.15，而不是加 `MAX_ITER`。",
          },
          {
            type: "compare",
            left: {
              title: "BFGS：默认，先试它",
              items: [
                "小到中型体系（几十到一两百原子）",
                "步数最少，因为 Hessian 信息最全",
                "振荡时调小 `TRUST_RADIUS`",
                "`USE_MODEL_HESSIAN T` 是默认，别乱关",
                "Hessian 可以跨任务重启，省前面几十步",
              ],
            },
            right: {
              title: "LBFGS / CG：大体系与保底方案",
              items: [
                "LBFGS 内存便宜，几百到几千原子",
                "LBFGS 的 `MAX_H_RANK` 提到 30 会更快但更吃内存",
                "LBFGS 有自己的专用收敛判据，会覆盖通用判据",
                "CG 最稳健，线搜索要多次算力，最贵",
                "CG 的 `LINE_SEARCH TYPE`：2PNT 便宜、GOLD 稳、FIT 最贵",
              ],
            },
          },
          {
            type: "callout",
            kind: "danger",
            title: "LBFGS 的收敛判据可能「静默生效」",
            text: "`&LBFGS` 的 `WANTED_PROJ_GRADIENT` 与 `WANTED_REL_F_ERROR` 一旦设成非默认值，就会**覆盖** `MAX_FORCE` 那一套通用判据，输出里会多一句 `Specific L-BFGS convergence criteria ... run CONVERGED!`。如果你照着别人的输入抄了这两个关键字，却以为自己在用 MAX_FORCE 判据，那所有「收敛了」的结论都要重新核对。",
          },
        ],
      },
      {
        id: "11.5",
        title: "每一步优化，其实是一次 SCF",
        blocks: [
          {
            type: "p",
            text: "优化循环的真实结构是：改坐标 → 算 SCF → 得能量与力 → 优化器决定下一步。所以**力的质量上限就是 SCF 的质量**。末段位移已经小到 10⁻³ Bohr 量级时，力的差异往往也在 10⁻⁴ 量级——正好是你判据的量级，SCF 噪声直接决定优化器是继续收敛还是原地打转。",
          },
          {
            type: "demo",
            id: "scf",
            title: "动手：SCF 不收敛时优化会怎样",
            desc: "切换 mixing / DIIS / OT，拖动 α 与 EPS_SCF，看残差曲线。优化卡在最后几步、力一直不达标，多半是这里的残差没有真正降下去。",
          },
          {
            type: "p",
            text: "针对优化的 SCF 设置有三处和单点不同。**第一，阈值要更严**：`EPS_SCF` 从 1E-6 收到 1E-7 是常见做法，`EPS_DEFAULT` 也别放松。**第二，开外推**：`EXTRAPOLATION ASPC` 或 `GEXT_PROJ` 用上一步波函数当初猜，能把每步 SCF 从几十轮砍到几轮。**第三，注意外推失效的信号**。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "为优化调过的 QS / SCF",
            text: `&QS
  EPS_DEFAULT 1.0E-12
  EXTRAPOLATION ASPC
  EXTRAPOLATION_ORDER 3
&END QS
&SCF
  EPS_SCF 1.0E-7
  MAX_SCF 50
  &OT
    MINIMIZER DIIS
    PRECONDITIONER FULL_SINGLE_INVERSE
  &END OT
  &OUTER_SCF
    EPS_SCF 1.0E-7
    MAX_SCF 10
  &END OUTER_SCF
&END SCF`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "cell 变了，外推就不安全了",
            text: "手册点名 `USE_PREV_P` 和 `LINEAR_P` 在**晶胞或邻居表变化**时是危险的，输出里可能出现 `*** WARNING in qs_wf_history_methods.F :: Change in cell ***` 和邻居表警告。这类警告意味着初猜已经不可信，后面的能量可能带一个不连续的小台阶——做 CELL_OPT 时尤其要盯着它。",
          },
          {
            type: "p",
            text: "反过来，如果某一步 SCF 明显不收敛（步数顶到 `MAX_SCF`），最省事的处理不是加 `MAX_SCF`，而是先把 `&MIXING` 的 `ALPHA` 从默认 0.4 降到 0.2，或改用 `BROYDEN_MIXING` 配 `NBUFFER 8`。金属、开壳层、强关联小体系都属于「默认混合参数不管用」的常客。",
          },
        ],
      },
      {
        id: "11.6",
        title: "CELL_OPT：把晶胞也放开",
        blocks: [
          {
            type: "p",
            text: "GEO_OPT 里晶胞是钉死的，所以它永远给不出正确的晶格常数。要算晶格常数、体模量、相图上的能量差，必须让晶胞跟着应力一起松弛。这需要打开应力张量计算，并把任务类型换成 `CELL_OPT`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "cell_opt.inp",
            text: `&GLOBAL
  PROJECT si_cell
  RUN_TYPE CELL_OPT
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  STRESS_TENSOR ANALYTICAL
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SCF
      EPS_SCF 1.0E-7
      &OT
        MINIMIZER DIIS
      &END OT
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
    &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 3.90 3.90 3.90
      ALPHA_BETA_GAMMA 60 60 60
      PERIODIC XYZ
    &END CELL
    &COORD
      SCALED T
      Si 0.00 0.00 0.00
      Si 0.25 0.25 0.25
    &END COORD
    &KIND Si
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q4
    &END KIND
  &END SUBSYS
&END FORCE_EVAL
&MOTION
  &CELL_OPT
    OPTIMIZER BFGS
    MAX_ITER 200
    EXTERNAL_PRESSURE 1.01325
    PRESSURE_TOLERANCE 10.0
    MAX_DR 3.0E-03
    RMS_DR 1.5E-03
    MAX_FORCE 4.5E-04
    RMS_FORCE 3.0E-04
  &END CELL_OPT
&END MOTION`,
          },
          {
            type: "p",
            text: "三处要解释。**`STRESS_TENSOR ANALYTICAL`** 必须显式打开——默认是 `NONE`，不打开 CELL_OPT 会报错或拿不到应力。**`EXTERNAL_PRESSURE 1.01325`** 的单位是 bar，这个数就是 1 个大气压；默认值是 100 bar，直接拿来算常压晶格常数会大得离谱。**`PRESSURE_TOLERANCE`** 的默认值同样是 100 bar，对「算准晶格常数」这个目标太松了，通常要收到 10 bar 甚至更小。",
          },
          {
            type: "p",
            text: "`&CELL_REF` 解决的是变胞带来的技术问题：晶胞缩放时，平面波辅助网格的格点数会跟着跳，能量和力出现不连续的小台阶，优化器就会在台阶附近来回试探。给一个比预期上界略大的参考 cell，网格布局就固定下来，曲线立刻变滑。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "把 &CELL_REF 塞进 &CELL",
            text: `&CELL
  ABC 3.90 3.90 3.90
  ALPHA_BETA_GAMMA 60 60 60
  PERIODIC XYZ
  &CELL_REF
    ABC 4.10 4.10 4.10
    ALPHA_BETA_GAMMA 60 60 60
  &END CELL_REF
&END CELL`,
          },
          {
            type: "table",
            head: ["关键字", "默认", "算常压晶格常数时怎么做"],
            rows: [
              ["`STRESS_TENSOR`", "`NONE`", "改成 `ANALYTICAL`"],
              ["`EXTERNAL_PRESSURE`", "100 bar", "改成 `1.01325`（1 atm）或你想要的压力"],
              ["`PRESSURE_TOLERANCE`", "100 bar", "收到 10 bar 或更小"],
              ["`CONSTRAINT`", "`NONE`", "slab/2D 体系按方向固定，见 11.7"],
              ["`KEEP_VOLUME` / `KEEP_ANGLES`", "`F`", "只想知道体积响应时打开"],
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "初始晶胞别离目标太远",
            text: "手册要求 CELL_OPT 的初始晶胞接近目标密度。差 20% 以上时，第一步的应力巨大、原子被推到不合理位置，SCF 很容易崩。先用实验值或文献值起手，把 `MAX_ITER` 留给真正的松弛。",
          },
        ],
      },
      {
        id: "11.7",
        title: "约束：固定原子与固定晶胞分量",
        blocks: [
          {
            type: "p",
            text: "slab 模型必须固定底部几层原子，否则整块会漂移；扫描吸附能时还要固定更多的自由度。约束写在 `&MOTION %CONSTRAINT %FIXED_ATOMS` 里，两个关键字各管一半：`LIST` 给原子序号（**按 `&COORD` 里出现的顺序**，从 1 开始），`COMPONENTS_TO_FIX` 给方向。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "固定 slab 底部两层",
            text: `&MOTION
  &CONSTRAINT
    &FIXED_ATOMS
      COMPONENTS_TO_FIX XYZ
      LIST 1 2 3 4 5 6 7 8
    &END FIXED_ATOMS
    &FIXED_ATOMS
      COMPONENTS_TO_FIX Z
      LIST 9 10 11 12
    &END FIXED_ATOMS
  &END CONSTRAINT
  &GEO_OPT
    OPTIMIZER BFGS
    MAX_ITER 300
  &END GEO_OPT
&END MOTION`,
          },
          {
            type: "p",
            text: "上面两块约束是叠加的：1–8 号原子三个方向全固定（体相部分），9–12 号只固定 z（面内仍可弛豫，模拟次表层的横向响应）。`COMPONENTS_TO_FIX` 还可以取 `X`、`Y`、`Z`、`XY`、`XZ`、`YZ`。",
          },
          {
            type: "p",
            text: "CELL_OPT 的自由度用另一套写法：`&CELL_OPT CONSTRAINT` 接收的是**晶胞分量 token**（`A`、`B`、`C` 是整个矢量；`AX`、`BX`、`BY`、`CX`、`CY`、`CZ` 是六个独立分量）。做 2D 材料时固定真空方向（通常是 c 矢量），只让面内两个方向松弛。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "约束设错，收敛了也是错的",
            text: "手册把「多加约束」列为「看似收敛实则物理错」的头号原因。两个典型：把吸附体系整个基底全固定，于是基底不能弛豫、吸附能偏高；或者忘了固定，slab 整体平移，优化器花了 50 步只是在消除刚体平移。跑之前先问自己：**这些自由度是我有意冻结的，还是我不知道怎么设才冻结的？**",
          },
        ],
      },
      {
        id: "11.8",
        title: "收敛之后：读输出、查虚频",
        blocks: [
          {
            type: "p",
            text: "优化跑完，先别急着抄能量。CP2K 会写出一组文件，每个回答不同的问题。至少要看 `-pos-1.xyz`（轨迹，判断过程是否合理）、`-1.restart`（能续算）、以及 CELL_OPT 的 `-1.cell` 与 `-1.stress`。",
          },
          {
            type: "table",
            head: ["文件", "内容", "怎么用"],
            rows: [
              ["`<PROJECT>-pos-1.xyz`", "每步的原子坐标轨迹", "丢进 VMD / OVITO 看有没有跳变"],
              ["`<PROJECT>-FINAL-1_*.cif` / `.xyz`", "最终结构", "作为后续计算的起点"],
              ["`<PROJECT>-1.cell`", "最终晶胞", "核对晶格常数与角度"],
              ["`<PROJECT>-1.stress`", "最终应力", "CELL_OPT 后确认压力已达标"],
              ["`<PROJECT>-1.restart`", "重启文件", "`cp2k -i x-1.restart -o x-restart.out` 直接续算"],
            ],
          },
          {
            type: "steps",
            items: [
              { t: "看四个判据", d: "最后一步的 OPT 块里四个 YES 才算收敛；只有一个 NO 就去找原因，别改判据。" },
              { t: "看压力", d: "CELL_OPT 还要看压力偏差是否在 PRESSURE_TOLERANCE 内，以及晶胞形状有没有变成你不认识的样子。" },
              { t: "看轨迹", d: "原子有没有穿过周期性边界、有没有整体漂移、能量是不是最后几步还在明显下降。" },
              { t: "复查约束", d: "确认被固定的原子真的是你想固定的那些，序号别错位。" },
              { t: "算一次频率", d: "优化只保证力为零；是不是真极小点，要 Hessian 没有虚频才算数。" },
            ],
          },
          {
            type: "p",
            text: "最后一步最容易被跳过。优化器找到的是「梯度为零的点」，它可能是极小、可能是鞍点、也可能只是数值噪声下的平坦区。判据满足但 Hessian 有一个小虚频，说明结构还差一点点；虚频明显（几十上百 cm⁻¹），说明你停在了一个过渡态或完全错误的结构上。下一章讲怎么找过渡态，第 13 章讲怎么算频率。",
          },
          {
            type: "keypoints",
            items: [
              "GEO_OPT 只动原子，CELL_OPT 才动晶胞；后者要 `STRESS_TENSOR ANALYTICAL`、外压与压力容差",
              "四个判据（MAX_DR / RMS_DR / MAX_FORCE / RMS_FORCE）必须**同时**满足，单位分别是 Bohr 与 Hartree/Bohr",
              "BFGS 默认、步数少；LBFGS 省内存但可能用专用判据覆盖通用判据；CG 最稳但最贵",
              "优化末段的力由 SCF 质量决定，`EPS_SCF` 要比单点更严，`EXTRAPOLATION` 要开",
              "约束设错是「收敛了但物理错」的头号原因；原子序号按 `&COORD` 顺序数",
              "收敛后要再用振动分析确认没有虚频，才算找到真极小点",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一步",
            text: "如果优化停下来的点有一个明显虚频，而你又确信它是某个反应的过渡态，那就该换方法了：GEO_OPT 只能往极小跑，找鞍点要用 NEB 或 dimer。下一章讲这两条路线。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "优化输出里 `RMS gradient` 显示 YES，但 `Maximum gradient` 是 NO，说明什么？",
        options: [
          "已经收敛，可以停",
          "整体受力已经很小，但个别原子/分量还没降到阈值以下，四个判据要全 YES 才算收敛",
          "SCF 没收敛，与优化无关",
          "优化器选错了，应该换 CG",
        ],
        answer: 1,
        explain: "四个判据必须同时满足。MAX 管最坏情况、RMS 管整体，只看 RMS 会掩盖某个原子还在被大力的情形。此时先查那个原子的环境是否合理、SCF 是否有噪声。",
      },
      {
        q: "做常压下的晶格常数优化，最需要改的两个默认值是？",
        options: [
          "`MAX_ITER` 与 `MAX_DR`",
          "`EXTERNAL_PRESSURE`（默认 100 bar）与 `PRESSURE_TOLERANCE`（默认 100 bar）",
          "`OPTIMIZER` 与 `TYPE`",
          "`EPS_SCF` 与 `CUTOFF`",
        ],
        answer: 1,
        explain: "外压默认 100 bar、压力容差默认也是 100 bar。常压计算要把前者改成 1.01325 bar 左右，后者收到远小于 100 bar，否则「压力已达标」这句话没有意义。",
      },
      {
        q: "优化开始后能量上下横跳、几十步不见改善，第一件该试的事是？",
        options: [
          "把 `MAX_ITER` 加到 1000",
          "调小 `TRUST_RADIUS`（或改用更保守的优化器/混合参数）",
          "把四个收敛判据都放松 10 倍",
          "关掉 `EXTRAPOLATION`",
        ],
        answer: 1,
        explain: "横跳通常是步长相对能量面的曲率太大。BFGS 的 TRUST_RADIUS 默认 0.25 Å，手册也提示大值不稳，降到 0.1–0.15 常常立刻见效。放松判据只是把问题藏起来。",
      },
      {
        q: "为什么 CELL_OPT 里建议设置 `&CELL_REF`？",
        options: [
          "它决定外压的取值",
          "它固定辅助网格布局，避免晶胞缩放时格点数跳变导致的能量/力不连续",
          "它用来约束晶胞角度",
          "它是重启文件的路径",
        ],
        answer: 1,
        explain: "变胞时平面波网格会重新划分，格点数变化带来小台阶，优化器就在台阶附近打转。给一个略大于预期上界的参考 cell，网格布局固定，曲线变平滑。",
      },
      {
        q: "一个结构优化收敛了，为什么还要算振动频率？",
        options: [
          "为了得到更精确的能量",
          "因为「力为零」只说明是驻点，可能是鞍点；有虚频就说明不是真极小点",
          "为了检查 SCF 是否收敛",
          "因为 CELL_OPT 必须配频率计算才能结束",
        ],
        answer: 1,
        explain: "优化器只保证梯度为零。极小点要求 Hessian 正定，也就是所有频率为实。虚频意味着结构还差一点或停在鞍点上，结论会随之改变。",
      },
    ],
    terms: [
      {
        t: "几何优化",
        en: "geometry optimization (GEO_OPT)",
        d: "固定晶胞，迭代原子位置使受力降到阈值以下。每一步都需要一次完整的电子结构计算。",
      },
      {
        t: "晶胞优化",
        en: "cell optimization (CELL_OPT)",
        d: "同时松弛原子位置与晶胞矢量，需要应力张量；常用于求晶格常数、体模量与相稳定性。",
      },
      {
        t: "trust radius",
        en: "trust radius",
        d: "优化器单步允许的最大位移。太大容易越过极小点而振荡，太小则步数暴涨。",
      },
      {
        t: "Hessian",
        en: "Hessian matrix",
        d: "能量对坐标的二阶导数矩阵。优化器用它决定搜索方向，振动分析用它给频率。",
      },
      {
        t: "固定原子约束",
        en: "fixed atoms constraint",
        d: "&FIXED_ATOMS 指定原子序号与方向，让它们不参与优化。slab 计算里用来冻结体相部分。",
      },
      {
        t: "应力张量",
        en: "stress tensor",
        d: "晶胞形变对应的能量导数。CELL_OPT 用它更新晶胞，需要 FORCE_EVAL 里显式打开。",
      },
      {
        t: "虚频",
        en: "imaginary frequency",
        d: "Hessian 负本征值对应的频率，通常以负数或带 i 的形式输出。极小点不应有虚频。",
      },
    ],
    sources: [
      {
        t: "Geometry and Cell Optimization",
        url: "https://manual.cp2k.org/trunk/methods/optimization/geometry_and_cell_opt.html",
      },
      {
        t: "CP2K_INPUT / MOTION / GEO_OPT",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/GEO_OPT.html",
      },
      {
        t: "CP2K_INPUT / MOTION / CELL_OPT",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/CELL_OPT.html",
      },
      {
        t: "CP2K_INPUT / MOTION / CONSTRAINT / FIXED_ATOMS",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/CONSTRAINT/FIXED_ATOMS.html",
      },
    ],
  };
})();
