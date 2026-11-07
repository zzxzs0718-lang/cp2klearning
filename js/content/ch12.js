(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch12"] = {
    id: "ch12",
    num: 12,
    part: "动力学与自由能",
    title: "增强采样与自由能面",
    subtitle: "约束 MD、slow-growth 与 metadynamics",
    hours: 5.5,
    level: "高级",
    intro:
      "稀有事件在几十皮秒的普通 MD 里往往一次都不发生，可自由能垒就藏在这些事件里。增强采样沿选定的集体变量施加约束或偏置，把高维自由能面投影成一两维的曲线或曲面。这一章从 PMF 的定义开始，讲 blue-moon、slow-growth 与 metadynamics 的输入、公式和常见失败，最后用课程里的 QM/MM 二维元动力学案例把整套流程串起来。",
    goals: [
      "说清 PMF、集体变量与增强采样的关系，判断一个问题是否需要偏置",
      "用 &COLVAR 与 &CONSTRAINT 做约束 MD，并从拉格朗日乘子得到平均力",
      "用 TARGET_GROWTH 做 slow-growth，理解不可逆功与 Jarzynski 修正",
      "配置 metadynamics 的 NT_HILLS、WW、SCALE 与二次墙，并判断收敛",
      "读懂 HILLS/COLVAR 日志，选择 graph 或自写脚本重建自由能面",
    ],
    sections: [
      {
        id: "12.1",
        title: "为什么普通 MD 等不到稀有事件",
        blocks: [
          {
            type: "p",
            text: "按 Arrhenius 估计，指前因子约 $10^{13}\\,\\mathrm{s^{-1}}$。若能垒是 0.75 eV，300 K 下 $e^{-E_a/k_BT}$ 约为 $10^{-13}$，事件平均要等 1 s；而一条 AIMD 轨迹通常只有几十到几百 ps，跨垒一次都看不到。",
          },
          {
            type: "p",
            text: "把温度升高能加速，但会改变机理与结构；换更快的力场能拉长时间，却可能丢掉电子结构。增强采样的思路是：选一个能区分反应进度的**集体变量**（CV），沿它加约束或偏置，让体系在 ps 量级内往返穿越能垒，再把偏置去掉、还原出自由能。",
          },
          {
            type: "callout",
            kind: "key",
            title: "先问「CV 能不能代表反应」",
            text: "增强采样只保证沿 CV 的采样变好，不保证 CV 抓住了真正的慢自由度。CV 选错，得到的是一条漂亮但无意义的曲线；这类错误花多少机时都救不回来。",
          },
        ],
      },
      {
        id: "12.2",
        title: "PMF 与集体变量",
        blocks: [
          {
            type: "p",
            text: "沿 CV $\\xi$ 的自由能曲线常叫 PMF（potential of mean force）。它由平衡概率分布得到：$F(\\xi)=-k_BT\\ln P(\\xi)+C$。$P(\\xi)$ 越小，该处的自由能越高；把其他自由度积分掉之后，剩下的就是这条一维曲线。",
          },
          {
            type: "formula",
            tex: "F(\\xi)=-k_BT\\ln P(\\xi)+C",
          },
          {
            type: "p",
            text: "平均力是 PMF 的导数：$\\mathrm{d}F/\\mathrm{d}\\xi=\\langle -\\partial H/\\partial\\xi\\rangle_\\xi$。约束 MD 直接测这个平均力，再积分；metadynamics 则用偏置势去填平它。两条路线的输入不同，最后都要做同一件事：沿 CV 积分或求和。",
          },
          {
            type: "table",
            head: ["CV 类型", "例子", "适用与风险"],
            rows: [
              ["距离", "成键/断键、吸附距离", "直观；多步反应一条距离不够"],
              ["配位数", "溶剂化层、表面配位", "平滑，适合多原子协同"],
              ["角度/二面角", "构象转变", "周期边界要处理"],
              ["组合变量", "距离之和、差", "可降维；权重需要物理依据"],
            ],
          },
          {
            type: "p",
            text: "CV 要满足两点：能区分初末态，且在过渡区变化平滑。太快（一碰就跨）会导致偏置来不及平衡，太慢（几十 ps 不动）则采样效率低。先跑一段无偏 MD，看 CV 的时间序列，再决定偏置参数。",
          },
        ],
      },
      {
        id: "12.3",
        title: "约束 MD 与 blue-moon",
        blocks: [
          {
            type: "p",
            text: "约束 MD 把 CV 固定在目标值，用拉格朗日乘子维持约束。体系在约束面上采样，乘子就是维持约束所需的广义力；对距离型 CV，乘子的负平均值直接给出平均力。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "定义距离 CV 并施加约束",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &SUBSYS
    &COLVAR
      &DISTANCE
        ATOMS 1 2
      &END DISTANCE
    &END COLVAR
  &END SUBSYS
&END FORCE_EVAL
&MOTION
  &CONSTRAINT
    &COLLECTIVE
      COLVAR 1
      TARGET [angstrom] 2.0
    &END COLLECTIVE
    &LAGRANGE_MULTIPLIERS ON
      FILENAME constraint_force
      COMMON_ITERATION_LEVELS 1
    &END LAGRANGE_MULTIPLIERS
  &END CONSTRAINT
&END MOTION`,
          },
          {
            type: "p",
            text: "`TARGET` 是约束值；`&LAGRANGE_MULTIPLIERS` 把乘子逐步写进文件。做 blue-moon 时，对每个窗口取乘子的系综平均，得到该点的平均力，再沿 CV 积分。窗口要覆盖整个反应路径，过渡区加密，两端可以稀一些。",
          },
          {
            type: "formula",
            tex: "\\frac{\\mathrm{d}A}{\\mathrm{d}\\xi}=\\frac{\\langle Z^{-1/2}(-\\lambda+k_BT\\,G)\\rangle_\\xi}{\\langle Z^{-1/2}\\rangle_\\xi}",
          },
          {
            type: "p",
            text: "其中 $Z=\\sum_i m_i^{-1}|\\nabla_i\\xi|^2$，$G$ 来自约束面的曲率。对两个原子之间的距离，$Z$ 是常数、$G=0$，式子化简为 $\\mathrm{d}A/\\mathrm{d}\\xi=-\\langle\\lambda\\rangle_\\xi$。这就是为什么距离型 CV 的 blue-moon 最好处理。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "单位",
            text: "CP2K 打印的乘子是内部单位（Hartree/Bohr），不随 TARGET 的单位变化。换算成 eV/Å 要乘 51.422；积分前先统一单位，否则自由能会差一个常数因子。",
          },
        ],
      },
      {
        id: "12.4",
        title: "slow-growth：让 CV 慢慢走",
        blocks: [
          {
            type: "p",
            text: "slow-growth 不做多个窗口，而是在一条 MD 里让约束目标匀速移动。体系被拖着走，外力做的功近似等于自由能差；走得越慢，耗散越小。CP2K 用 `TARGET_GROWTH` 与 `TARGET_LIMIT` 控制。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "以 0.0008 Å/fs 拉动距离",
            text: `&MOTION
  &CONSTRAINT
    &COLLECTIVE
      COLVAR 1
      TARGET_GROWTH [angstrom*fs^-1] 0.0008
      TARGET_LIMIT [angstrom] 3.0
    &END COLLECTIVE
  &END CONSTRAINT
&END MOTION`,
          },
          {
            type: "p",
            text: "按 0.5 fs 步长，0.0008 Å/fs 意味着每步移动 0.0004 Å；从上例的 2.0 Å 走到 3.0 Å 是 1 Å，需要 2500 步，约 1.25 ps。速度再快，功里混进的耗散就不可忽略。`TARGET_LIMIT` 是终点，到了就停，不会无限拉。",
          },
          {
            type: "p",
            text: "CP2K 只负责产生轨迹与乘子，**不自动积分功**。后处理要对时间积分 $\\langle\\lambda\\rangle\\dot\\xi$，或者用 Jarzynski 关系从多条不可逆轨迹估计自由能：$e^{-\\Delta A/k_BT}=\\langle e^{-W/k_BT}\\rangle$。单条快拉轨迹的功通常大于真实 $\\Delta A$。",
          },
          {
            type: "p",
            text: "slow-growth 的优点是实现简单、一条轨迹就能给出连续曲线；缺点是系统性偏差难估计，必须做速度收敛测试。把生长速率减半，看曲线是否还在移动；移动明显就继续减。",
          },
        ],
      },
      {
        id: "12.5",
        title: "metadynamics：用高斯山填平势能面",
        blocks: [
          {
            type: "p",
            text: "metadynamics 每隔若干步，在当前 CV 位置加一座高斯山。山越堆越多，体系被推着离开已采过的区域，最终把自由能面填平；把所有山加起来取负，就得到自由能估计。每座山由高度、宽度和投放间隔决定。",
          },
          {
            type: "formula",
            tex: "V_{\\mathrm{bias}}(s,t)=\\sum_{t'}\\;WW\\exp\\left[-\\sum_k\\frac{(s_k-s_k(t'))^2}{2\\,SCALE_k^2}\\right]",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "二维 metadynamics 的骨架",
            text: `&MOTION
  &FREE_ENERGY
    &METADYN
      DO_HILLS
      NT_HILLS 50
      WW 3.0E-3
      &METAVAR
        COLVAR 1
        SCALE 0.3
      &END METAVAR
      &METAVAR
        COLVAR 2
        SCALE 0.3
      &END METAVAR
      &PRINT
        &COLVAR
          COMMON_ITERATION_LEVELS 3
        &END COLVAR
        &HILLS
          COMMON_ITERATION_LEVELS 3
        &END HILLS
      &END PRINT
    &END METADYN
  &END FREE_ENERGY
&END MOTION`,
          },
          {
            type: "p",
            text: "`NT_HILLS` 是投放间隔（步），`WW` 是山高（Hartree），`SCALE` 是高斯宽度（内部单位 Bohr，别名 `WIDTH`），不是 CV 的缩放系数。上面这组值来自课程案例：每 50 步（0.5 fs 步长下 25 fs）加一座 0.003 Ha 的山，宽度 0.3 Bohr。",
          },
          {
            type: "p",
            text: "山高取预估能垒的几十分之一：太高会把面填得粗糙，太低则要很久才能跨垒。宽度要覆盖 CV 的热涨落，太窄需要大量山、太宽会抹平窄垒。`WW` 与 `SCALE` 都是每维独立可调，二维时先分别看两个 CV 的涨落幅度。",
          },
          {
            type: "p",
            text: "不写 `WELL_TEMPERED` 时是定高 metadynamics，FES 近似为 $F(s)\\approx -V_{\\mathrm{bias}}(s)+C$。课程案例就是定高方案；如果打开 well-tempered，山高会随已填的偏置衰减，需要额外给 $\\Delta T$，收敛更稳但参数更多。",
          },
        ],
      },
      {
        id: "12.6",
        title: "墙、CV 选择与收敛判断",
        blocks: [
          {
            type: "p",
            text: "偏置会把体系越推越远，若 CV 没有物理边界（例如距离可以无限增大），需要加墙把采样限制在感兴趣的区域。墙是外加势，不改变真实自由能；分析时必须把墙附近的数据排除，否则会把人为约束当成真实能垒。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "给一个 CV 加两道二次墙",
            text: `&METAVAR
  COLVAR 1
  SCALE 0.3
  &WALL
    TYPE QUADRATIC
    POSITION 5.0
    DIRECTION WALL_PLUS
    K [kcalmol] 40.0
  &END WALL
  &WALL
    TYPE QUADRATIC
    POSITION 1.0
    DIRECTION WALL_MINUS
    K [kcalmol] 40.0
  &END WALL
&END METAVAR`,
          },
          {
            type: "p",
            text: "`POSITION` 用内部单位，要按 Å 写就在数值后加 `[angstrom]`；`WALL_PLUS` 管上界，`WALL_MINUS` 管下界；`K` 是二次势的力常数。墙位置要对照初始 CV：如果初始值已经在上墙之外，墙从第一步就施力，轨迹会被猛地推回来，先检查这是不是你想要的行为。",
          },
          {
            type: "p",
            text: "判断收敛不要只看「山不再长」。更可靠的做法是：CV 在目标区间来回穿越多次；把轨迹分成前后两半，各自重建 FES，比较差值；改变 `NT_HILLS` 或 `WW` 复算，看曲线是否在误差内不变。二维 FES 的收敛比一维慢得多，机时要提前算够。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "偏置不是免费的",
            text: "墙会改变 CV 的分布，偏置会改变其他自由度的耦合；把一维 PMF 当成完整机理，往往漏掉正交方向的慢过程。至少用另一条独立轨迹或另一个 CV 做交叉验证。",
          },
        ],
      },
      {
        id: "12.7",
        title: "案例：2936 原子 QM/MM 二维元动力学",
        blocks: [
          {
            type: "p",
            text: "课程练习里有一个 Cu/有机分子体系的 QM/MM 元动力学：总共 2936 个原子，QM 区是 56 个原子的 C36H20 有机分子，其余 2880 个 Cu 用 MM；QM 用 PM6 半经验，MM 用课程自带的 Cu–C/Cu–H 势与 EAM。体系在 450 K 下跑 200000 步 × 0.5 fs = 100 ps。",
          },
          {
            type: "p",
            text: "两个 CV 都定义在 `&FORCE_EVAL/&SUBSYS/&COLVAR`：CV1 是两个距离之和（4–50 与 7–49），CV2 是 49–50 的距离。两个 `&METAVAR` 各配两道二次墙，K 都是 40 kcal/mol；`NT_HILLS 50`、`WW 3.0E-3`、`SCALE 0.3`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "案例的 CV 与元动力学核心（节选）",
            text: `&FORCE_EVAL
  METHOD MIXED
  &SUBSYS
    &COLVAR
      &COMBINE_COLVAR
        &COLVAR
          &DISTANCE
            ATOMS 4 50
          &END DISTANCE
        &END COLVAR
        &COLVAR
          &DISTANCE
            ATOMS 7 49
          &END DISTANCE
        &END COLVAR
        FUNCTION CV1+CV2
        VARIABLES CV1 CV2
      &END COMBINE_COLVAR
    &END COLVAR
    &COLVAR
      &DISTANCE
        ATOMS 49 50
      &END DISTANCE
    &END COLVAR
  &END SUBSYS
&END FORCE_EVAL
&MOTION
  &FREE_ENERGY
    &METADYN
      DO_HILLS
      NT_HILLS 50
      WW 3.0E-3
    &END METADYN
  &END FREE_ENERGY
&END MOTION`,
          },
          {
            type: "p",
            text: "输出有两个关键日志：`cp2k-COLVAR.metadynLog` 每行 9 列，前三列是时间、CV1、CV2；`cp2k-HILLS.metadynLog` 每行 6 列，依次是时间、CV1、CV2、两个宽度、山高。首行类似 `25.0 4.19568 5.71958 0.30000 0.30000 0.00300`——时间是 25 fs，两个 CV 用 Bohr。",
          },
          {
            type: "code",
            lang: "bash",
            title: "查看 HILLS 日志并重建二维 FES",
            text: `head -n 3 cp2k-HILLS.metadynLog
graph.psmp -i cp2k-HILLS.metadynLog -stride 10 \\
  -ndim 2 -ndw 1 2 -cp2k -integrated_fes`,
          },
          {
            type: "p",
            text: "`graph` 是 CP2K 配套的外部工具，`-stride` 控制隔多少座山取一座（降采样），`-ndim 2` 与 `-ndw 1 2` 指定二维与两个宽度列、`-cp2k` 声明日志格式、`-integrated_fes` 输出积分后的自由能面。CP2K 本身不会在 MD 结束时自动生成 FES；这一步必须做后处理。",
          },
          {
            type: "p",
            text: "课程还给了 `gaussian.py` 的等高线画法，适合快速检查形状。无论用哪个工具，先确认 CV 单位：日志是 Bohr，换算成 Å 要乘 0.529177；把 Bohr 当 Å 画图，峰位会整体偏大约 1.9 倍。",
          },
          {
            type: "demo",
            id: "scf",
            title: "动手：每步 SCF 与偏置力",
            desc: "在 SCF 演示里收紧 EPS_SCF，观察迭代数与能量差；元动力学每步的偏置力都建立在收敛的 SCF 上。",
          },
        ],
      },
      {
        id: "12.8",
        title: "常见失败与工作流",
        blocks: [
          {
            type: "table",
            head: ["现象", "可能原因", "处理"],
            rows: [
              ["CV 来回震荡但不前进", "山高太小或宽度太窄", "增大 WW 或 SCALE；先跑无偏 MD 看涨落"],
              ["一步就被推到边界", "墙位置贴着初始值，或 WW 过大", "把墙放远；降低 WW；检查初始 CV"],
              ["FES 出现明显滞后环", "CV 不是慢自由度，或有隐藏变量", "换 CV；加正交 CV；延长采样"],
              ["前后两半 FES 差很多", "尚未收敛", "延长轨迹；分块比较；降低山高"],
              ["墙附近自由能异常低", "把墙的偏置算进了 FES", "排除墙外数据；只分析墙内区间"],
              ["二维 FES 很粗糙", "山太少或 stride 太大", "减小 stride；增加采样；平滑处理"],
            ],
          },
          {
            type: "steps",
            items: [
              { t: "无偏预跑", d: "看 CV 的时间尺度与涨落，确认它是慢变量，估算需要多长的偏置。" },
              { t: "一维试跑", d: "先用一个 CV 加少量山，确认能跨垒、墙不打架，再上二维。" },
              { t: "生产", d: "固定 NT_HILLS、WW、SCALE 与墙；每步 SCF 收敛；按需输出 COLVAR/HILLS。" },
              { t: "收敛检查", d: "CV 往返多次；前后半段 FES 一致；改参数复算不改变结论。" },
              { t: "重建与报告", d: "HILLS 求和或 graph；换算单位；说明墙与排除区间；给出误差估计。" },
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "单位与符号",
            text: "HILLS 的 CV 与宽度用 Bohr，WW 用 Hartree；墙位置也用内部单位。换算和符号（$F=-V_{\\mathrm{bias}}$）错一次，整张图的结论就反了。重建后先用已知的初末态或实验能垒做一次量级检查。",
          },
          {
            type: "keypoints",
            items: [
              "PMF 由概率分布得到，平均力是其导数；约束 MD 测平均力，metadynamics 填偏置",
              "距离型 CV 的 blue-moon 平均力就是乘子负平均",
              "slow-growth 要慢，CP2K 不自动积分功",
              "SCALE 是高斯宽度（Bohr），不是 CV 缩放",
              "墙附近的数据不能直接进 FES；收敛要看前后半段与参数敏感性",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "沿 CV 的 PMF 与概率分布是什么关系？",
        options: [
          "F = k_BT ln P，概率越大自由能越高",
          "F = −k_BT ln P，概率越小自由能越高",
          "F 与 P 无关，只由温度决定",
          "F 是 P 对时间的导数",
        ],
        answer: 1,
        explain: "PMF 由 F(ξ) = −k_BT ln P(ξ) + C 定义；概率越低的状态自由能越高。常数 C 不影响差值与能垒。",
      },
      {
        q: "对两个原子间的距离 CV 做 blue-moon，平均力怎么取？",
        options: [
          "拉格朗日乘子的负系综平均",
          "约束力的平方平均",
          "偏置势的平均",
          "温度的倒数",
        ],
        answer: 0,
        explain: "距离 CV 的 Z 为常数、G=0，blue-moon 公式化简为 dA/dξ = −⟨λ⟩。乘子要用内部单位，换算后再积分。",
      },
      {
        q: "slow-growth 里 `TARGET_GROWTH [angstrom*fs^-1] 0.0008` 表示？",
        options: [
          "每步把 CV 增加 0.0008 Å",
          "每秒增加 0.0008 Å，实际步长还要乘 TIMESTEP",
          "约束力的上限",
          "高斯山的宽度",
        ],
        answer: 1,
        explain: "TARGET_GROWTH 是速率，单位 Å/fs；每步位移等于速率乘 TIMESTEP。0.5 fs 步长下每步 0.0004 Å。",
      },
      {
        q: "`&METAVAR` 里的 `SCALE 0.3` 是什么？",
        options: [
          "把 CV 缩小 0.3 倍",
          "高斯山的宽度（内部单位 Bohr）",
          "山的投放间隔",
          "墙的力常数",
        ],
        answer: 1,
        explain: "SCALE 是高斯宽度，别名 WIDTH，默认单位 internal_cp2k（Bohr）；它不是 CV 的缩放系数。投放间隔由 NT_HILLS 控制。",
      },
      {
        q: "metadynamics 加墙的主要目的是？",
        options: [
          "提高自由能分辨率",
          "把采样限制在感兴趣区间，避免 CV 跑到无物理意义的区域",
          "自动判断收敛",
          "替代恒温器",
        ],
        answer: 1,
        explain: "墙是人为势，用来限制 CV 范围；它不提高分辨率，也不自动判断收敛。分析时要排除墙附近被扭曲的数据。",
      },
    ],
    terms: [
      { t: "PMF", en: "potential of mean force", d: "沿某个集体变量积分掉其他自由度后的自由能曲线，由概率分布得到。" },
      { t: "集体变量", en: "collective variable", d: "用来描述反应进度的低维坐标，可以是距离、配位数、角度或其组合。" },
      { t: "blue-moon", en: "blue-moon ensemble", d: "用约束 MD 的拉格朗日乘子计算平均力，再积分得到 PMF 的方法。" },
      { t: "slow-growth", en: "slow-growth", d: "让约束目标随时间缓慢移动，用外力功近似自由能差的增强采样方法。" },
      { t: "metadynamics", en: "metadynamics", d: "沿 CV 不断加高斯山填平自由能面，用偏置势的负值估计 FES。" },
      { t: "高斯山", en: "Gaussian hill", d: "metadynamics 每次投放的偏置，由高度 WW、宽度 SCALE 与间隔 NT_HILLS 定义。" },
      { t: "热力学积分", en: "thermodynamic integration", d: "对平均力沿 CV 积分得到自由能差；blue-moon 与约束 MD 的常用后处理。" },
      { t: "well-tempered", en: "well-tempered metadynamics", d: "山高随已填偏置衰减的变体，收敛更稳，但需要额外的温度参数。" },
    ],
    sources: [
      { t: "Methods / Metadynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/metadynamics.html" },
      { t: "Methods / Constrained molecular dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/constrained_dynamics.html" },
      { t: "CP2K_INPUT / MOTION / FREE_ENERGY", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/FREE_ENERGY.html" },
      { t: "CP2K_INPUT / MOTION / FREE_ENERGY / METADYN", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/FREE_ENERGY/METADYN.html" },
      { t: "CP2K_INPUT / METADYN / METAVAR / WALL", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/FREE_ENERGY/METADYN/METAVAR/WALL.html" },
      { t: "CP2K_INPUT / MOTION / CONSTRAINT / COLLECTIVE", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/CONSTRAINT/COLLECTIVE.html" },
    ],
  };
})();