(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch09"] = {
    id: "ch09",
    num: 9,
    part: "结构与振动",
    title: "几何优化、晶胞优化与过渡态",
    subtitle: "让原子和晶胞走到能量极小，再沿反应路径找到鞍点",
    hours: 3,
    level: "中级",
    intro:
      "电子结构算得再准，也要有可信的结构。这一章做三件事：固定晶胞优化原子（GEO_OPT）、连晶胞一起优化（CELL_OPT）、以及沿反应路径找过渡态（CI-NEB、DIMER）。它们共用一套逻辑——用力和应力把结构推向驻点，再用频率确认你到达的是极小还是鞍点。",
    goals: [
      "写出可运行的 GEO_OPT 与 CELL_OPT 输入，并读懂 OPT 表的四个判据",
      "在 BFGS、LBFGS、CG 之间按体系大小与稳定性做选择",
      "固定 slab 底层或指定方向，做有物理意义的约束优化",
      "用 CI-NEB 找过渡态，并判断结果是否可信",
    ],
    sections: [
      {
        id: "9.1",
        title: "优化之前，先确认三件事",
        blocks: [
          {
            type: "p",
            text: "优化不是在坏结构上「自动修好」。如果初始结构有原子重叠、缺失的氢、错误的配位或严重畸变的晶胞，第一步的力就会大到离谱，SCF 先崩，或者原子直接飞走。所以在写 `RUN_TYPE GEO_OPT` 之前，先做三件事。",
          },
          {
            type: "steps",
            items: [
              { t: "① 单点能收敛", d: "先用 RUN_TYPE ENERGY 在起点跑通 SCF，确认结构没有病、收敛阈值够用。" },
              { t: "② 估机时", d: "单点耗时 × 预计步数（几十到几百）。一步优化可能包含多次力评估。" },
              { t: "③ 看结构", d: "用 VMD/Jmol 检查键长、配位、周期边界处有没有重叠或过大空隙。" },
            ],
          },
          {
            type: "p",
            text: "还有一条容易被忽略：**优化用的电子结构设置至少要和单点一样严，通常更严**。力是能量对坐标的导数，SCF 噪声会被放大；`EPS_SCF` 太松、`CUTOFF` 太低，都会让优化在极小点附近来回震荡。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "0 K 优化不等于有限温结构",
            text: "GEO_OPT/CELL_OPT 找到的是势能面驻点，不含零点能与热膨胀。拿它和室温实验晶格常数比较时，差 1% 量级是正常的；要做有限温结构，得走 MD 或准简谐路线。",
          },
        ],
      },
      {
        id: "9.2",
        title: "GEO_OPT：四个判据一起看",
        blocks: [
          {
            type: "p",
            text: "下面是一份最小可用的优化输入。`&MOTION` 挂在 `&FORCE_EVAL` 下面，`&GEO_OPT` 里放优化器与收敛判据；电子结构部分和单点完全一样。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "geo_opt.inp",
            text: `&GLOBAL
  PROJECT co_ads
  RUN_TYPE GEO_OPT
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
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 100
      &OT T
        MINIMIZER CG
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
      &OUTER_SCF T
        EPS_SCF 1.0E-5
        MAX_SCF 20
      &END OUTER_SCF
    &END SCF
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
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 20.0
      PERIODIC XY
    &END CELL
    &COORD
      C  0.0000  0.0000  8.0000
      O  0.0000  0.0000  9.1500
    &END COORD
    &KIND C
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q4
    &END KIND
    &KIND O
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
  &END SUBSYS
  &MOTION
    &GEO_OPT
      TYPE MINIMIZATION
      OPTIMIZER BFGS
      MAX_ITER 200
      MAX_DR 3.0E-3
      RMS_DR 1.5E-3
      MAX_FORCE 4.5E-4
      RMS_FORCE 3.0E-4
    &END GEO_OPT
  &END MOTION
&END FORCE_EVAL`,
          },
          {
            type: "table",
            head: ["判据", "含义", "单位", "常规值"],
            rows: [
              ["`MAX_DR`", "最大原子位移", "Bohr", "3.0E-3"],
              ["`RMS_DR`", "均方位移", "Bohr", "1.5E-3"],
              ["`MAX_FORCE`", "最大力分量", "Hartree/Bohr", "4.5E-4"],
              ["`RMS_FORCE`", "均方力", "Hartree/Bohr", "3.0E-4"],
            ],
            caption: "BFGS/CG 下必须四个都满足；只看到力达标而位移没达标，仍不算收敛。",
          },
          {
            type: "p",
            text: "输出里的 `OPT|` 表每行给出步数、总能量、最大/均方梯度、最大/均方位移与信任半径。判断收敛看判据列，不看总能量——中间步能量可以上升，最后一步也可能有微小上升，这都正常。若最后一步能量上升且幅度可疑，用频率分析确认它到底是不是极小点。",
          },
          {
            type: "callout",
            kind: "info",
            title: "MAX_ITER 到了还没收敛怎么办",
            text: "不要直接把 `MAX_ITER` 翻十倍。先看每一步的力是否在下降：下降慢但单调，可以加步数；来回震荡，换优化器或减小信任半径；力不降反升，回去查 SCF 噪声与结构。",
          },
        ],
      },
      {
        id: "9.3",
        title: "优化器：BFGS、LBFGS 与 CG",
        blocks: [
          {
            type: "p",
            text: "三个优化器不是「谁更高级」，而是三种不同的取舍。BFGS 用完整 Hessian 近似，中小体系收敛快；LBFGS 只保留有限步历史，内存省，适合大体系；CG 每步只沿梯度方向做线搜索，最稳健但一步要多次力评估。",
          },
          {
            type: "compare",
            left: {
              title: "BFGS（默认）",
              items: [
                "中小体系首选，步数少",
                "用完整 Hessian 近似，内存随原子数增长",
                "震荡时先减小 TRUST_RADIUS",
                "可用 USE_MODEL_HESSIAN 减少步数",
              ],
            },
            right: {
              title: "LBFGS / CG",
              items: [
                "LBFGS 省内存，大体系友好，但判据可能提前宣布收敛",
                "CG 最稳健，适合差初始结构与噪声力",
                "CG 每步线搜索多次力评估，单步更贵",
                "CG 线搜索可换 2PNT/GOLD/FIT 控制成本",
              ],
            },
          },
          {
            type: "p",
            text: "课程里的经验是：超大体系用 LBFGS，中等体系用 BFGS，结构很差时用 CG。LBFGS 有一条要特别注意：它可能在其他判据还没满足时就宣布 `CONVERGED`，并写出 `iterate.dat`；如果你不放心，可以同时看 `MAX_FORCE` 与位移，或改用 BFGS 复核。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "震荡时的最小改动",
            text: "先别换优化器。把 BFGS 的 `TRUST_RADIUS` 调小（如 0.1），或者把 `EPS_SCF` 收紧一个数量级，往往就能解决「最后 0.01 eV 反复横跳」的问题。",
          },
        ],
      },
      {
        id: "9.4",
        title: "约束：固定 slab 底层，放开表面",
        blocks: [
          {
            type: "p",
            text: "表面吸附计算里，基底不是刚体：靠近吸附物的几层会弛豫，底层则近似体相。全固定会高估吸附能，全放开又会让 slab 整体漂移。标准做法是固定底部若干层，放开表面两层。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "固定底层 + LBFGS 优化",
            text: `&MOTION
  &CONSTRAINT
    &FIXED_ATOMS
      COMPONENTS_TO_FIX XYZ
      LIST 1..54
      LIST 289..324
    &END FIXED_ATOMS
  &END CONSTRAINT
  &GEO_OPT
    OPTIMIZER LBFGS
    MAX_ITER 400
    MAX_FORCE 6.0E-4
    &LBFGS
      MAX_H_RANK 30
    &END LBFGS
  &END GEO_OPT
&END MOTION`,
          },
          {
            type: "p",
            text: "`LIST` 里的编号是 `&COORD` 里的原子顺序，不是元素序号，也不是可视化软件里显示的序号。**改结构、重排坐标后一定要重新核对编号**，否则你固定的可能是吸附物本身。`COMPONENTS_TO_FIX XYZ` 表示三个方向都固定；只想固定 z 方向时写 `Z`。",
          },
          {
            type: "p",
            text: "除了固定原子，`&CONSTRAINT/&COLLECTIVE` 可以约束集体变量（键长、配位数、角度等），配合 `&COLVAR` 定义变量与目标值。它适合「扫描一个反应坐标」或「保持某个配位环境」的场景；用之前先想清楚：约束会改变势能面，得到的能量不是自由能。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "固定太多 = 算了个假表面",
            text: "如果连表面第一层都固定，吸附能会明显偏大。判断标准：固定层数增加时吸附能应逐渐收敛；做一次「多放开一层」的对照，是最便宜的自检。",
          },
        ],
      },
      {
        id: "9.5",
        title: "CELL_OPT：压力、晶胞与真空方向",
        blocks: [
          {
            type: "p",
            text: "只知道原子位置不够时（体相晶体、应变固体、二维材料的面内晶格），要让晶胞也动。CELL_OPT 同时优化原子与晶胞，用应力（stress）而不是力来驱动晶胞；类比 VASP 的 `vc-relax`。关键是给对**外压**，并想清楚哪些方向该弛豫。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "cell_opt.inp（体相，1 atm）",
            text: `&GLOBAL
  PROJECT bcc_fe
  RUN_TYPE CELL_OPT
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  STRESS_TENSOR ANALYTICAL
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 500
      REL_CUTOFF 60
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 100
      &OT T
        MINIMIZER CG
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
      ABC 2.87 2.87 2.87
      ALPHA_BETA_GAMMA 90.0 90.0 90.0
    &END CELL
    &COORD
      Fe 0.0 0.0 0.0
      Fe 0.5 0.5 0.5
    &END COORD
    &KIND Fe
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q16
    &END KIND
  &END SUBSYS
  &MOTION
    &CELL_OPT
      TYPE DIRECT_CELL_OPT
      OPTIMIZER BFGS
      MAX_ITER 200
      EXTERNAL_PRESSURE 1.01325E+00
      PRESSURE_TOLERANCE 100.0
      KEEP_ANGLES T
    &END CELL_OPT
  &END MOTION
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`STRESS_TENSOR ANALYTICAL` 打开解析应力；没有它，晶胞没有正确的驱动力。`EXTERNAL_PRESSURE` 的单位是 bar，1 atm 约 1.01325 bar；`PRESSURE_TOLERANCE 100` 表示压力残差在 100 bar 内可接受（对体相不算苛刻）。`KEEP_ANGLES` 让晶胞角度保持不变；已知空间群时，还可以配合 `&CELL` 的对称性设置用 `KEEP_SYMMETRY`，把优化限制在对称性允许的形变内。",
          },
          {
            type: "p",
            text: "做 slab 或二维材料时，**真空方向不该弛豫**。要么固定该方向（用 `CONSTRAINT` 限定），要么先定晶胞再只做固定晶胞的 GEO_OPT。真空层厚度本身也要做收敛测试：真空从 15 Å 加到 20 Å，吸附能变化小于你的误差目标，才算够。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "变胞会改变网格",
            text: "CUTOFF 固定时，晶胞变大意味着格点间距变化，能量/力/应力可能出现不连续。做 CELL_OPT 时可用 `&CELL/CELL_REF` 指定参考晶胞（取优化范围的上限），让格点数保持稳定，再做一次 CUTOFF 复核。",
          },
        ],
      },
      {
        id: "9.6",
        title: "CI-NEB：从初末态找鞍点",
        blocks: [
          {
            type: "p",
            text: "过渡态不能靠「把原子推过去再优化」得到——那只会滑回起点或终点。NEB 的思路是：在初末态之间插一串镜像，给相邻镜像加弹簧，同时把垂直于路径的力投影掉，让整条链沿最小能量路径（MEP）走。CI-NEB 再让最高点不受弹簧力并「爬坡」，从而精确落在鞍点。",
          },
          {
            type: "p",
            text: "先各优化初态与末态，再插点。课程用的脚本是 `xyz2neb.pl`：",
          },
          {
            type: "code",
            lang: "bash",
            title: "插点与检查",
            text: `# is.xyz / fs.xyz 是优化好的初态与末态（同原子数、同顺序）
./xyz2neb.pl is.xyz fs.xyz 5
ls 0.xyz 1.xyz 2.xyz 3.xyz 4.xyz 5.xyz

# 确认原子数一致：每个文件第二行之后应有相同行数
for f in 0.xyz 1.xyz 2.xyz 3.xyz 4.xyz 5.xyz; do
  echo -n "$f "; sed -n '1p' $f
done`,
          },
          {
            type: "code",
            lang: "cp2k",
            title: "band.inp（CI-NEB 骨架）",
            text: `&GLOBAL
  PROJECT neb
  RUN_TYPE BAND
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
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 100
      SCF_GUESS RESTART
      &OT T
        MINIMIZER CG
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
      &OUTER_SCF T
        EPS_SCF 1.0E-5
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
      ABC 12.0 12.0 20.0
      PERIODIC XYZ
    &END CELL
    &COORD
      O 0.0 0.0 8.0
      H 0.0 0.0 9.0
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
  &MOTION
    &BAND
      BAND_TYPE CI-NEB
      NUMBER_OF_REPLICA 6
      NPROC_REP 8
      K_SPRING 0.08
      ALIGN_FRAMES F
      ROTATE_FRAMES F
      &CONVERGENCE_CONTROL
        MAX_DR 0.01
        RMS_DR 0.02
        MAX_FORCE 0.001
        RMS_FORCE 0.001
      &END CONVERGENCE_CONTROL
      &CI_NEB
        NSTEPS_IT 5
      &END CI_NEB
      &OPTIMIZE_BAND
        OPT_TYPE DIIS
        OPTIMIZE_END_POINTS F
      &END OPTIMIZE_BAND
      &REPLICA
        COORD_FILE_NAME ./0.xyz
      &END REPLICA
      &REPLICA
        COORD_FILE_NAME ./1.xyz
      &END REPLICA
      &REPLICA
        COORD_FILE_NAME ./2.xyz
      &END REPLICA
      &REPLICA
        COORD_FILE_NAME ./3.xyz
      &END REPLICA
      &REPLICA
        COORD_FILE_NAME ./4.xyz
      &END REPLICA
      &REPLICA
        COORD_FILE_NAME ./5.xyz
      &END REPLICA
    &END BAND
  &END MOTION
&END FORCE_EVAL`,
          },
          {
            type: "table",
            head: ["关键词", "含义", "怎么设"],
            rows: [
              ["`NUMBER_OF_REPLICA`", "含初末态的总结构数", "3–5 个中间点通常够；路径远则 6–8"],
              ["`NPROC_REP`", "每个镜像分到的核数", "总核数 ÷ 镜像数；可超额排队"],
              ["`K_SPRING`", "弹簧常数", "先 0.08 求稳，收敛后再放松到 0.02"],
              ["`NSTEPS_IT`", "爬坡前先跑的 IT 步数", "5 左右，先让链铺开"],
              ["`OPTIMIZE_END_POINTS`", "是否优化端点", "F 表示不优化，但**仍会计算**端点"],
            ],
          },
          {
            type: "p",
            text: "`&SUBSYS` 里的坐标不会用于镜像计算（每个 `&REPLICA` 自带文件），但输入校验要求它存在，放一个合法结构即可。跑完后用 `grep -1 MAX cp2k-BAND6.out` 看最高点能量，再把各镜像轨迹拼起来画能垒。",
          },
          {
            type: "callout",
            kind: "key",
            title: "DIMER 什么时候用",
            text: "只有一个初猜、没有末态时，用 DIMER：它从一点出发，沿最低曲率方向爬坡找鞍点。代价是对初猜敏感，且需要较好的 Hessian 估计；有明确初末态时，CI-NEB 更稳。",
          },
        ],
      },
      {
        id: "9.7",
        title: "验证：频率告诉你到了哪里",
        blocks: [
          {
            type: "p",
            text: "优化收敛只说明「力很小」，不说明「这是极小」。要区分极小点与鞍点，做频率分析：极小点没有虚频，一阶鞍点（过渡态）恰好一个虚频。CP2K 用有限位移，每个原子在 ±x/±y/±z 六个方向各算一次，共 6N+1 次 SCF。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "频率分析片段",
            text: `&GLOBAL
  PROJECT freq
  RUN_TYPE VIBRATIONAL_ANALYSIS
&END GLOBAL

&MOTION
  &VIBRATIONAL_ANALYSIS
    DX 0.01
    NPROC_REP 7
    FULLY_PERIODIC T
    INTENSITIES F
  &END VIBRATIONAL_ANALYSIS
&END MOTION`,
          },
          {
            type: "p",
            text: "`DX` 是位移步长，太大有非谐误差、太小被数值噪声淹没，0.01 bohr 是常用值。`FULLY_PERIODIC T` 对周期体系必要；分子/团簇则要关掉，否则平动转动模会被周期性人为改变。频率结果还能给零点能（ZPE = Σhν/2），用于把电子能量修成 0 K 能量。",
          },
          {
            type: "p",
            text: "对表面吸附体系，3N 个模里有 6 个对应整体平动/转动（被表面势阱部分限制），通常表现为很低的几个模，不要把它们误判为虚频。真正的虚频应显著为负，且振动模式指向你预期的反应坐标。频率的完整用法（强度、热化学）在第 10 章。",
          },
        ],
      },
      {
        id: "9.8",
        title: "四个常见失败与收束",
        blocks: [
          {
            type: "table",
            head: ["现象", "原因", "怎么修"],
            rows: [
              ["固定的不是底层", "原子编号与 &COORD 顺序不一致", "打印坐标顺序核对，改结构后重查 LIST"],
              ["力不降、能量乱跳", "SCF 噪声、CUTOFF 太低、泛函/色散不一致", "收紧 EPS_SCF、做 CUTOFF 收敛、复核 &XC"],
              ["晶胞来回震荡", "压力容差太紧、真空方向也在弛豫", "放宽 PRESSURE_TOLERANCE、固定真空方向、减小信任半径"],
              ["NEB 镜像塌到端点", "K_SPRING 太大或初末态没优化好", "先优化端点，K_SPRING 从 0.08 起，必要时加点"],
            ],
          },
          {
            type: "p",
            text: "NEB 还有两个隐蔽坑：一是**镜像数太少**，最高点落在两个镜像之间，能垒被低估；判断方法是看能量曲线是否光滑、最高点两侧是否都有点。二是**端点原子顺序不一致**，`xyz2neb.pl` 会插出化学上无意义的路径，优化一开始就崩。",
          },
          {
            type: "keypoints",
            items: [
              "优化前先跑单点：结构合理、SCF 收敛、机时可控",
              "GEO_OPT 看四个判据，不看总能量；震荡先减小信任半径或收紧 SCF",
              "约束的原子编号按 &COORD 顺序，改结构必须重查",
              "CELL_OPT 要有解析应力与正确外压；真空方向不要弛豫",
              "CI-NEB 的产物必须用频率验证：过渡态恰好一个虚频",
            ],
          },
          {
            type: "demo",
            id: "scf",
            title: "动手：优化一步要花多少 SCF",
            desc: "观察一次 GEO_OPT 迭代里 SCF 步数与能量变化，理解「一步优化 ≠ 一次 SCF」。",
          },
          {
            type: "callout",
            kind: "key",
            title: "下一章",
            text: "结构定下来，振动频率能告诉你更多：它是不是真极小、零点能多大、红外峰在哪。第 10 章把频率、热化学与振动分析展开。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "GEO_OPT 收敛的判据是？",
        options: [
          "总能量连续两步不变",
          "MAX_DR、RMS_DR、MAX_FORCE、RMS_FORCE 都满足",
          "SCF 步数小于 50",
          "最大力小于 1 eV/Å 即可",
        ],
        answer: 1,
        explain: "四个判据分别约束最大/均方位移与最大/均方力，BFGS/CG 下必须全部满足。总能量在中间步可以上升，不能作为收敛依据。",
      },
      {
        q: "做 slab 吸附计算时，通常怎么处理基底？",
        options: [
          "全部固定，省机时",
          "全部放开，包括最底层",
          "固定底部若干层，放开表面几层",
          "只固定吸附物",
        ],
        answer: 2,
        explain: "底层近似体相，固定它可避免整体漂移；表面层必须弛豫，否则吸附能偏大。固定层数是否足够，用「多放开一层」的对照来验证。",
      },
      {
        q: "CELL_OPT 相比 GEO_OPT 多需要什么？",
        options: [
          "&KPOINTS",
          "解析应力（STRESS_TENSOR ANALYTICAL）与外部压力",
          "&VDW_POTENTIAL",
          "UKS",
        ],
        answer: 1,
        explain: "晶胞由应力驱动，必须让 CP2K 算应力（通常解析应力），并给出 EXTERNAL_PRESSURE；同时用 KEEP_ANGLES/KEEP_SYMMETRY 等控制自由度。",
      },
      {
        q: "CI-NEB 中 `K_SPRING` 太大时会发生什么？",
        options: [
          "镜像分布更均匀但能垒偏低、收敛慢",
          "弹簧力主导，路径偏离 MEP，能垒不可信",
          "SCF 自动切换为 OT",
          "端点被自动优化",
        ],
        answer: 1,
        explain: "弹簧太硬会让镜像被「拉直」，路径不再沿最小能量路径，能垒失真。通常先用 0.08 求稳，收敛后再放松到 0.02 复核。",
      },
      {
        q: "频率分析发现两个显著虚频，最可能说明？",
        options: [
          "这是过渡态",
          "结构不是极小点，或约束/周期性设置有问题",
          "基组太小",
          "泛函选错",
        ],
        answer: 1,
        explain: "一阶鞍点只有一个虚频。两个及以上通常意味着结构仍在不稳定方向、优化未真正收敛，或 slab/团簇的约束与周期性处理不当。",
      },
    ],
    terms: [
      { t: "几何优化", en: "geometry optimization", d: "沿力方向移动原子，直到力与位移判据同时满足，得到势能面驻点。" },
      { t: "晶胞优化", en: "cell optimization", d: "同时弛豫原子与晶胞，用应力与外压驱动，类比 VASP 的 vc-relax。" },
      { t: "信任半径", en: "trust radius", d: "限制单步位移的上限，防止优化在坏初始结构上走太远。" },
      { t: "CI-NEB", en: "climbing image NEB", d: "让最高镜像爬坡到鞍点的 NEB 变体，用于定位过渡态。" },
      { t: "虚频", en: "imaginary frequency", d: "频率的负值平方根，表示该方向曲率为负；极小点为零，过渡态为一个。" },
      { t: "零点能", en: "ZPE", d: "量子谐振子基态能量之和，用于把电子能量修成 0 K 能量。" },
    ],
    sources: [
      { t: "Geometry and Cell Optimization", url: "https://manual.cp2k.org/trunk/methods/optimization/geometry_and_cell_opt.html" },
      { t: "Nudged Elastic Band", url: "https://manual.cp2k.org/trunk/methods/optimization/nudged_elastic_band.html" },
      { t: "&GEO_OPT input reference", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/GEO_OPT.html" },
      { t: "&BAND input reference", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/BAND.html" },
    ],
  };
})();
