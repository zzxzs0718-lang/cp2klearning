(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch12"] = {
    id: "ch12",
    num: 12,
    part: "结构与振动",
    title: "过渡态与 NEB",
    subtitle: "从初末态之间的那条链，读出能垒和鞍点",
    hours: 3,
    level: "高级",
    intro:
      "上一章的优化器只会往山下走，而过渡态在山脊上。要找到它，要么先把整条路径拖出来（NEB），要么带着一个初始方向直接爬（dimer）。这一章讲 CP2K 的 &BAND 怎么用、每一块关键字在物理上意味着什么，以及最常见的那几种「跑了一晚上，能垒是假的」是怎么发生的。",
    goals: [
      "说清 NEB 把力分解成「沿路径」和「垂直路径」两部分后各起什么作用",
      "写出完整的 &BAND 输入（端点、像数、弹簧常数、CI-NEB、优化器），并区分五种 BAND_TYPE",
      "在输出里正确读出能垒，并判断路径是否真的收敛",
      "知道什么时候该用 dimer，以及两者如何互相验证",
    ],
    sections: [
      {
        id: "12.1",
        title: "过渡态：能量面上的鞍点",
        blocks: [
          {
            type: "p",
            text: "反应从初态 A 走到末态 B，中间要翻过一道脊。脊上的最低点就是过渡态：它沿反应方向是极大、其余所有方向是极小——一个一阶鞍点。能量差 $E_{\\mathrm{TS}} - E_A$ 就是能垒，通常写作 $E_a$。",
          },
          {
            type: "p",
            text: "麻烦在于，普通的几何优化只会顺着负梯度走，碰到鞍点会立刻滑下去。所以你没法「直接优化出一个鞍点」。可行的路线只有两类：一类是把 A 到 B 之间的整条路径离散成一串**像**（image），让它们互相牵着一起松弛（NEB）；另一类是从一个猜测结构出发，带着一个方向去爬（dimer）。",
          },
          {
            type: "key",
            items: [
              { k: "RUN_TYPE BAND", v: "跑 NEB/string 类方法的任务类型", tag: "必填" },
              { k: "&MOTION %BAND", v: "NEB 的全部设置都在这里", tag: "核心" },
              { k: "NUMBER_OF_REPLICA", v: "像的总数，含两个端点；默认 10", tag: "常用" },
              { k: "K_SPRING", v: "相邻像之间的弹簧常数，默认 2.0E-2", tag: "易错" },
              { k: "BAND_TYPE", v: "IT-NEB（默认）/ CI-NEB / D-NEB / SM / EB / B-NEB", tag: "核心" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "手册这一页是空的",
            text: "CP2K 手册的 NEB 章节目前只有一句「还没人写这一页」，指向 cp2k.org 上的练习。所以本章的技术细节全部来自 `&BAND` 的关键字文档和实际行为，涉及「手册怎么说」的地方我会写明出处；碰到文档没覆盖的判断，我会告诉你「取决于体系」。",
          },
        ],
      },
      {
        id: "12.2",
        title: "一条 NEB 需要三样东西",
        blocks: [
          {
            type: "p",
            text: "**两个已经优化好的端点**、**一串中间像**、**一根把像串起来的弹簧**。端点必须先用同一套方法（同样的泛函、基组、截断、k 点）各自做 GEO_OPT 收敛——如果端点本身没收敛，能垒里就混进了两个端点各自的残余力，误差方向和大小都不可控。",
          },
          {
            type: "p",
            text: "中间像最简单的方式是只给两个端点文件，让 CP2K 自己插值：`NUMBER_OF_REPLICA` 大于你给的 `&REPLICA` 数量时，它会反复找相邻距离最大的一对、在中间插一个新像，直到凑够数目。这条规则写在 `NUMBER_OF_REPLICA` 的关键字文档里，意味着插值是**等距二分**，对弯曲路径不一定贴得最好，但作为起点足够。",
          },
          {
            type: "p",
            text: "本章的跑题例子用氨的伞形翻转：N 带着三个 H 穿过平面，反应物与产物是同一种分子的两个对映构型。它小、闭壳层、能垒不大，正好用来看整条链路的行为。先写电子结构那一半——和普通单点输入没有区别，唯一的约定是**原子顺序必须与两个端点 xyz 完全一致**，否则 CP2K 会把 H 当成 N 去插值。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "neb.inp（上半：电子结构）",
            text: `&GLOBAL
  PROJECT neb
  RUN_TYPE BAND
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
      ABC 12.0 12.0 12.0
      PERIODIC NONE
    &END CELL
    &COORD
      N  0.0000  0.0000  0.0000
      H  0.9370  0.0000 -0.3800
      H -0.4685  0.8116 -0.3800
      H -0.4685 -0.8116 -0.3800
    &END COORD
    &KIND N
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q5
    &END KIND
    &KIND H
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "下半是把像串起来的那一节。两个端点写成两个 `&REPLICA`，每个给一条 xyz 文件名；中间的像交给 `NUMBER_OF_REPLICA` 去插值。两半拼在同一个文件里，就是一个完整的 NEB 输入。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "neb.inp（下半：&MOTION %BAND）",
            text: `&MOTION
  &BAND
    BAND_TYPE IT-NEB
    NUMBER_OF_REPLICA 9
    K_SPRING 2.0E-2
    NPROC_REP 1
    ALIGN_FRAMES T
    ROTATE_FRAMES T
    &REPLICA
      COORD_FILE_NAME nh3_reactant.xyz
    &END REPLICA
    &REPLICA
      COORD_FILE_NAME nh3_product.xyz
    &END REPLICA
    &CONVERGENCE_CONTROL
      MAX_DR 2.0E-04
      RMS_DR 1.0E-04
      MAX_FORCE 4.5E-04
      RMS_FORCE 3.0E-04
    &END CONVERGENCE_CONTROL
    &OPTIMIZE_BAND
      OPT_TYPE DIIS
      &DIIS
        MAX_STEPS 100
        N_DIIS 7
      &END DIIS
    &END OPTIMIZE_BAND
    &CI_NEB
      NSTEPS_IT 5
    &END CI_NEB
  &END BAND
&END MOTION`,
          },
          {
            type: "p",
            text: "`NUMBER_OF_REPLICA 9` 加上两个端点共 9 个像，8 段路径。像太少，路径会走成折线、最高点被削平；像太多，每个像都要一次完整的 SCF，成本线性上涨。做一维反应（比如质子转移）8–16 个像通常够，扩散路径弯曲时再加。这个数字没有普适最优，**取决于体系**。",
          },
          {
            type: "p",
            text: "`ALIGN_FRAMES` 与 `ROTATE_FRAMES` 处理的是另一类麻烦：分子在盒子里整体转动或平移，会让「相邻像的距离」里混进刚体运动，弹簧力白算。两者默认都开，只有在体系被约束住、转动无意义时才可以关掉省一点时间。",
          },
          {
            type: "table",
            head: ["块", "管什么", "漏了会怎样"],
            rows: [
              ["`&REPLICA`", "至少给两个端点（文件或内联坐标）", "没有端点，链无从谈起"],
              ["`NUMBER_OF_REPLICA`", "像的总数，含端点", "默认 10；数字太小路径被拉直"],
              ["`K_SPRING`", "弹簧刚度", "太软像会挤进两端极小；太硬会阻止垂直方向松弛"],
              ["`&CONVERGENCE_CONTROL`", "链的收敛判据", "用默认值也能跑，但默认比 GEO_OPT 更严"],
              ["`&OPTIMIZE_BAND`", "怎么把链往下推", "默认 DIIS，通常不用改"],
            ],
          },
        ],
      },
      {
        id: "12.3",
        title: "NEB 的物理：一部分力推着走，一部分力往边上挪",
        blocks: [
          {
            type: "p",
            text: "真梯度 $\\nabla E$ 在中间像上同时含有两种成分：沿路径方向的（想让它滑向某一端的极小）和垂直路径方向的（想让路径本身向能量更低处弯）。纯梯度下降会把所有像都吸进端点，路径塌缩成两个点。NEB 的做法是：**沿路径的真实力全部丢掉，只留垂直分量；沿路径只保留弹簧力**。结果就是像之间保持间距、路径整体向谷底滑动。",
          },
          {
            type: "formula",
            tex: "\\mathbf{F}_i^{\\mathrm{NEB}} = \\mathbf{F}_i^{\\perp} + \\mathbf{F}_i^{\\mathrm{spring}} = \\left(\\mathbf{F}_i - (\\mathbf{F}_i\\cdot\\hat{\\tau}_i)\\hat{\\tau}_i\\right) + k\\,(|\\mathbf{R}_{i+1}-\\mathbf{R}_i| - |\\mathbf{R}_i-\\mathbf{R}_{i-1}|)\\,\\hat{\\tau}_i",
            caption: "垂直分量负责让路径落到最低能量通道，弹簧项负责让像均匀分布",
          },
          {
            type: "p",
            text: "`K_SPRING` 就是在调这根弹簧。太软（小到 1E-3 量级）：像会互相挤、有的掉进端点附近的极小，路径出现断点。太硬：弹簧力压过真实力，像被强行拉成直线，最高点被削平，**能垒偏低**——这是最常见的一种系统性误差。手册给的默认值是 2.0E-2，多数体系从它开始，觉得像分布不均再小幅度调整。",
          },
          {
            type: "table",
            head: ["BAND_TYPE", "关键区别", "什么时候用"],
            rows: [
              ["`IT-NEB`", "改进切线，默认方法", "先跑它，稳定、便宜"],
              ["`CI-NEB`", "能量最高的像去掉弹簧、沿路径反向爬", "要精确的鞍点结构与能垒"],
              ["`D-NEB`", "doubly nudged，切线与弹簧都做修正", "路径弯曲大、IT-NEB 收敛慢"],
              ["`SM`", "string method，按弧长重分布像", "像分布严重不均时"],
              ["`EB`", "弹性带，用哈密顿量形式", "特殊用途，一般不作首选"],
              ["`B-NEB`", "手册只给了枚举，没有叙述页", "先在 IT-NEB 上验证路径合理，再换它对比"],
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "CI-NEB 的爬升像会「翘出去」",
            text: "把最高像的弹簧力关掉、再把沿路径的力反号，它就会自己往鞍点爬。副作用是这个像不再受弹簧约束，容易沿着软模（整体转动、甲基扭转）跑偏。看到最高像的结构里某个无关基团转了个角度，就是它了——把该基团用 `&CONSTRAINT %FIXED_ATOMS` 约束住，或者改用 D-NEB。",
          },
        ],
      },
      {
        id: "12.4",
        title: "CI-NEB：先让链铺好，再让最高点爬上去",
        blocks: [
          {
            type: "p",
            text: "`CI-NEB` 不是一上来就爬。它的实际行为是：先按 IT-NEB 跑若干步把整条链铺开，然后切换到 climbing image 模式，让能量最高的那个像沿路径方向反向爬升到鞍点。切换前的步数由 `&CI_NEB NSTEPS_IT` 控制，默认 5。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "只改 BAND_TYPE 与 CI_NEB 段",
            text: `&MOTION
  &BAND
    BAND_TYPE CI-NEB
    NUMBER_OF_REPLICA 11
    K_SPRING 2.0E-2
    &REPLICA
      COORD_FILE_NAME nh3_reactant.xyz
    &END REPLICA
    &REPLICA
      COORD_FILE_NAME nh3_product.xyz
    &END REPLICA
    &CI_NEB
      NSTEPS_IT 5
    &END CI_NEB
    &CONVERGENCE_CONTROL
      MAX_DR 2.0E-04
      RMS_DR 1.0E-04
      MAX_FORCE 4.5E-04
      RMS_FORCE 3.0E-04
    &END CONVERGENCE_CONTROL
  &END BAND
&END MOTION`,
          },
          {
            type: "p",
            text: "`NSTEPS_IT 5` 是个不太够看的数字：路径还没铺开就切爬升，最高像可能停在一个与真实鞍点无关的凸起上。稳妥做法是先用 IT-NEB 跑到大致收敛，把中间像的坐标存下来，再用它们作为起点跑 CI-NEB（或者直接把 `NSTEPS_IT` 加到需要的大小，代价是前期多花几步）。",
          },
          {
            type: "p",
            text: "判断 CI 有没有真的爬上去，看两件事：**最高像的能量在你切换之后是否还在持续下降**（说明它还在往鞍点走），以及**最高像上的力是否最终满足 `&CONVERGENCE_CONTROL`**。如果最高像的能量顺手就掉下去、和相邻像几乎一样平，那不是鞍点，是路径插值太平滑、缺了真正的势垒——加密像数或换更贴的插值起点。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "两端点也参与判据",
            text: "`OPTIMIZE_END_POINTS` 默认是 `F`，也就是端点不动。手册明确说明：只有在两个端点**已经用同一套 FORCE_EVAL 优化过**的前提下，才可以把它设成 `T`（此时每步把端点力清零）。如果你拿一个没收敛的端点、又设了 `T`，能垒会被端点的残余力污染，而且从输出上完全看不出来。",
          },
        ],
      },
      {
        id: "12.5",
        title: "链的收敛判据与优化器",
        blocks: [
          {
            type: "p",
            text: "`&BAND %CONVERGENCE_CONTROL` 的四个判据名字和 GEO_OPT 一模一样，但默认值更严：`MAX_DR` 默认 2.0E-4 Bohr（GEO_OPT 是 3.0E-3），`RMS_DR` 默认 1.0E-4。原因很直接：路径上的每个像都要力小，而能垒是两个大数之差的差，噪声会被放大。",
          },
          {
            type: "table",
            head: ["关键字", "默认值", "含义"],
            rows: [
              ["`MAX_DR`", "2.0E-04 Bohr", "单步最大位移"],
              ["`RMS_DR`", "1.0E-04 Bohr", "位移均方根"],
              ["`MAX_FORCE`", "4.5E-04 Ha/Bohr", "最大力分量"],
              ["`RMS_FORCE`", "3.0E-04 Ha/Bohr", "力均方根"],
            ],
          },
          {
            type: "p",
            text: "推进链的默认优化器是 DIIS（`&OPTIMIZE_BAND OPT_TYPE DIIS`），`MAX_STEPS` 默认 100、`N_DIIS` 默认 7、`STEPSIZE` 默认 1.0。DIIS 在这里的作用是外推：用前几步的位移和力做线性组合，跳出单纯梯度下降的锯齿。步长上限 `MAX_STEPSIZE` 默认 2.0，就是防止某一步被外推甩太远。",
          },
          {
            type: "p",
            text: "另一种选择是 `OPT_TYPE MD`（带阻尼的动力学），在路径很长、DIIS 反复震荡时更稳但更慢。`NO_LS`、`NP_LS` 控制线搜索：默认会做线搜索，把 `NO_LS` 设成 `T` 能省评估次数，代价是步长可能不合适。",
          },
          {
            type: "demo",
            id: "scf",
            title: "动手：为什么 NEB 比单点更怕 SCF 噪声",
            desc: "在优化循环里，每一步的力都来自一次 SCF。把收敛阈值、混合方法调一调，看残差要降到多低，力的差才稳定。链上每个像都要重复这件事。",
          },
          {
            type: "p",
            text: "由此得到一条实用建议：跑 NEB 前，先把 `EPS_SCF` 比平时再收紧一档，并确认**中间像的 SCF 也能收敛**。中间像的几何往往是最扭曲的（键被拉长、配位不完整），它们的 SCF 是全链最难的部分，一旦某步没收敛，链路就会出现一个假的能量尖峰，看起来像「第二个过渡态」，实际上是数值噪声。",
          },
        ],
      },
      {
        id: "12.6",
        title: "读能垒：哪个数才是你要的",
        blocks: [
          {
            type: "p",
            text: "跑完之后，你要从输出里拿三个数：初态能量、最高像能量、末态能量。能垒是最高像减初态，反应能是末态减初态。注意区分「正向能垒」和「逆向能垒」，它们一般不等——这也是为什么路径要跑到两端都收敛，只在中间收敛的链给出的两个数都不可信。",
          },
          {
            type: "code",
            lang: "bash",
            title: "从输出里把每一步的能量抓出来",
            text: `# 链的每步能量，按 step 打印
grep -n "Step number" neb.out | tail -3

# 各 replica 的能量（不同 CP2K 版本标题措辞略有差异）
grep -n -i "replica" neb.out | grep -i "energy" | tail -20

# 结束标志与总耗时
grep -n -E "BAND run converged|PROGRAM ENDED" neb.out`,
          },
          {
            type: "p",
            text: "更省事的办法是让 CP2K 把结果写成文件。`&BAND` 下面有四个打印节，每个只需要一个 `FILENAME`——手册里这几个节只有 `FILENAME`、`LOG_PRINT_KEY`、`ADD_LAST`、`COMMON_ITERATION_LEVELS` 这几个通用键，**没有更细的子节**，不用再猜。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "把路径、能量、收敛历史都落盘",
            text: `&MOTION
  &BAND
    &FINAL_BAND
      FILENAME nh3_band
    &END FINAL_BAND
    &ENERGY
      FILENAME nh3_energies
    &END ENERGY
    &CONVERGENCE_INFO
      FILENAME nh3_conv
    &END CONVERGENCE_INFO
    &REPLICA_INFO
      FILENAME nh3_replicas
    &END REPLICA_INFO
  &END BAND
&END MOTION`,
          },
          {
            type: "table",
            head: ["输出/文件", "内容", "用途"],
            rows: [
              ["`&BAND %ENERGY` 打印块", "每个像的能量与链的收敛信息", "读能垒、看能量是不是单调下降"],
              ["`&BAND %FINAL_BAND`", "最终的整条路径轨迹（默认文件名前缀 `FINAL`）", "画能垒图、看路径形状"],
              ["`&BAND %CONVERGENCE_INFO`", "各判据的收敛历史", "判断是收敛还是顶到 MAX_STEPS"],
              ["`&BAND %REPLICA_INFO`", "每个像的细节", "定位是哪个像在捣乱"],
            ],
          },
          {
            type: "p",
            text: "读能垒时有三个坑。**一，单位**：CP2K 输出是 Hartree，1 Hartree ≈ 27.211 eV，也常换算成 kcal/mol 或 kJ/mol；报数时把单位写清楚，别把 0.02 Hartree 写成 0.02 eV。**二，零点能**：电子能垒和实验活化能之间还差零点振动能校正，做定量对比要另外算频率（第 13 章）。**三，展宽**：金属体系开了 smearing 时，能量是自由能，能垒的含义要跟着改。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "「最高像」不等于「鞍点」",
            text: "离散路径上能量最高的那个像，只是你采到的最高点。真正的鞍点在两个像之间时，最高像的能量必然偏低、能垒也就偏低。CI-NEB 就是为解决这件事设计的；如果只跑 IT-NEB，报能垒时最好说明像数，并做一次加密像数的验证。",
          },
        ],
      },
      {
        id: "12.7",
        title: "失败模式：六种「跑完了但答案是错的」",
        blocks: [
          {
            type: "table",
            head: ["现象", "常见原因", "怎么查/怎么修"],
            rows: [
              ["能垒接近 0", "端点之间其实是同一条通道；或路径走了刚体转动", "检查端点结构；关掉/打开 ROTATE_FRAMES 对比"],
              ["能垒偏低很多", "像数太少、K_SPRING 太大、最高点被削平", "加密像数、减小 K_SPRING、改 CI-NEB"],
              ["路径出现断点或折返", "K_SPRING 太小、插值起点离真实通道太远", "加大 K_SPRING、手动给中间像"],
              ["最高像结构里有无关基团转动", "CI 的爬升像沿软模跑偏", "固定该基团，或改用 D-NEB"],
              ["能量曲线出现尖刺", "某个像的 SCF 没收敛", "收紧 EPS_SCF、给该像更好的初猜"],
              ["收敛判据一直 NO", "端点未收敛、或链在两种路径间摇摆", "先收敛端点；减少像数看趋势"],
            ],
          },
          {
            type: "steps",
            items: [
              { t: "先确认端点", d: "两个端点各自 GEO_OPT 到四个判据全 YES，且用完全相同的设置。这一步省不得。" },
              { t: "用少一点的像跑通", d: "7–9 个像先跑 IT-NEB，看能量曲线形状是否合理，别一上来就 20 个像。" },
              { t: "再加 CI", d: "把 IT-NEB 的中间像存下来当起点，跑 CI-NEB，看最高像能量是否继续下降。" },
              { t: "验证鞍点", d: "把最高像单独拿出来做振动分析，应该恰好有一个虚频，且振动方向就是反应坐标方向。" },
              { t: "报数带上下文", d: "像数、K_SPRING、BAND_TYPE、是否含零点能校正，一起写进方法段。" },
            ],
          },
          {
            type: "p",
            text: "最后一步的验证最容易被省略，但它才是唯一能证明「这是鞍点」的证据。频率分析的输出里会有虚频，把它的简正模可视化（MOLDEN 文件），看原子是不是沿着你预期的方向动。如果虚频不止一个，说明这个结构是高阶鞍点；如果一个都没有，那你停在了一个极小点上，能垒是假的。",
          },
        ],
      },
      {
        id: "12.8",
        title: "dimer 与 NEB：什么时候用哪个",
        blocks: [
          {
            type: "p",
            text: "NEB 的强项是给你整条路径和两个方向的能垒，弱项是需要两个收敛好的端点、成本随像数线性增长。dimer 反过来：只要一个猜测结构和一个初始方向，成本接近单点优化，但只给你一个鞍点、不告诉你路径长什么样。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "dimer：从振动模出发找鞍点",
            text: `&GLOBAL
  PROJECT ts
  RUN_TYPE GEO_OPT
&END GLOBAL
&MOTION
  &GEO_OPT
    TYPE TRANSITION_STATE
    OPTIMIZER BFGS
    MAX_ITER 200
    &TRANSITION_STATE
      METHOD DIMER
      &DIMER
        DR 0.01
        ANGLE_TOLERANCE 0.087266
        INITIALIZATION_METHOD MOLDEN
        VIB_MOLDEN_NAME ts_guess.molden
        VIB_INDEX 1
      &END DIMER
    &END TRANSITION_STATE
  &END GEO_OPT
&END MOTION`,
          },
          {
            type: "p",
            text: "`DR 0.01`（Å）是 dimer 探针的步长：它在当前点上沿方向 $\\hat{n}$ 和 $-\\hat{n}$ 各走 0.01 Å 取两个力，用差分得到曲率，从而知道该往哪个方向爬、该往哪个方向转。`ANGLE_TOLERANCE` 控制方向优化的收敛。这两个值来自关键字文档的默认值，一般不用改。",
          },
          {
            type: "p",
            text: "把这段接在 12.2 上半那个 `&FORCE_EVAL` 后面就是一份完整的 dimer 输入：`RUN_TYPE` 写 `GEO_OPT`，SCF、基组、cell 全部复用同一套设置——能量要和 NEB 的端点、鞍点放在同一张表里比较，电子结构就不能换。",
          },
          {
            type: "p",
            text: "`INITIALIZATION_METHOD RANDOM` 是默认，但文档自己写了它「可能扭曲结构、拖慢收敛」。更好的做法是先对猜测结构做一次振动分析，用 `&VIBRATIONAL_ANALYSIS %PRINT %MOLDEN_VIB` 写出文件，再用 `INITIALIZATION_METHOD MOLDEN` + `VIB_INDEX` 指定那个虚频模——这样方向一开始就对准了反应坐标。",
          },
          {
            type: "compare",
            left: {
              title: "NEB / CI-NEB",
              items: [
                "需要两个收敛好的端点",
                "给出整条路径与正/逆向能垒",
                "成本 ∝ 像数，十几个像很常见",
                "适合：机理不清、需要看路径形状",
                "CI-NEB 直接给鞍点结构",
              ],
            },
            right: {
              title: "dimer",
              items: [
                "只需要一个猜测结构 + 一个方向",
                "只给一个鞍点，不给路径",
                "成本接近普通优化",
                "适合：已知机理，只想精修能垒",
                "方向设错会收敛到错误的鞍点",
              ],
            },
          },
          {
            type: "p",
            text: "实践中两者常常连用：NEB 给出路径和粗略鞍点，把它交给 dimer 精修到力更小；或者 dimer 先找到一个鞍点，再用 NEB 验证它确实连接了你想要的初末态。二者的结论要一致，否则先怀疑其中一个跑偏了——最常见的偏法是 NEB 的端点根本不是同一条反应通道的两端。",
          },
          {
            type: "keypoints",
            items: [
              "NEB = 垂直路径的真实力 + 沿路径的弹簧力；弹簧太硬会削平能垒，太软会让像挤进端点",
              "端点必须先各自收敛，且用与链完全相同的设置；否则能垒被残余力污染",
              "`NUMBER_OF_REPLICA` 含两端，不足的中间像按最大间距二分插值；默认 10",
              "CI-NEB 先按 IT-NEB 跑 `NSTEPS_IT` 步再爬升；最高像要单独做频率验证（恰好一个虚频）",
              "`&BAND %CONVERGENCE_CONTROL` 的默认判据比 GEO_OPT 严，因为能垒是差值的差",
              "dimer 只要一个猜测结构和方向，用 MOLDEN 初猜比 RANDOM 可靠；与 NEB 互为验证",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一步",
            text: "无论是验证 NEB 的鞍点，还是给能垒做零点能校正，都要算振动。下一章讲 `&VIBRATIONAL_ANALYSIS`：频率怎么从 Hessian 来、零点能和热化学怎么读、以及 IR/Raman 强度需要额外打开什么。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "NEB 中把真实力沿路径的分量丢掉、只保留垂直分量，是为了什么？",
        options: [
          "节省计算量",
          "避免所有像都滑向端点、路径塌缩；沿路径的间距改由弹簧力维持",
          "让弹簧常数自动确定",
          "让 SCF 更容易收敛",
        ],
        answer: 1,
        explain: "沿路径的真实力会把像拉向附近的极小，导致路径塌缩。NEB 只保留垂直分量让路径落到低能量通道，沿路径的分布由弹簧力控制。",
      },
      {
        q: "`K_SPRING` 设得过大，最可能造成什么？",
        options: [
          "能垒偏高",
          "像被强行拉成直线、最高点被削平，能垒偏低",
          "SCF 不收敛",
          "端点自动被优化",
        ],
        answer: 1,
        explain: "弹簧太硬会压过真实力，像无法沿垂直方向弛豫，路径被拉直、势垒被削平，结果是系统性的能垒偏低。太软则相反，像会挤进端点。",
      },
      {
        q: "关于 `OPTIMIZE_END_POINTS T`，正确的说法是？",
        options: [
          "只要打开它，端点就会被自动优化到收敛",
          "只有两个端点已用同一套 FORCE_EVAL 优化过时才该打开；打开后每步把端点力清零",
          "它控制 CI-NEB 的爬升步数",
          "它决定插值方式",
        ],
        answer: 1,
        explain: "端点不会因为你打开这个开关而真的被优化；它只是把端点力清零。前提是端点已经收敛，否则能垒会被残余力污染且难以察觉。",
      },
      {
        q: "CI-NEB 跑完，如何确认最高像真的是过渡态？",
        options: [
          "看它的能量是不是全链最高",
          "把它单独做振动分析，应当恰好有一个虚频，且振动方向沿反应坐标",
          "看 `&BAND %ENERGY` 是否打印了 converged",
          "看弹簧力是否为零",
        ],
        answer: 1,
        explain: "能量最高只是离散路径上的最高采样点。只有 Hessian 恰好一个负本征值、且模方向对得上，才能说这是一阶鞍点。",
      },
      {
        q: "相比 NEB，dimer 的主要限制是？",
        options: [
          "不能处理周期性体系",
          "需要两个端点结构",
          "只给一个鞍点、不给整条路径，且初始方向设错会收敛到错误的鞍点",
          "必须配合 smearing 使用",
        ],
        answer: 2,
        explain: "dimer 成本低、只要一个猜测结构，但它只针对一个鞍点，没有路径信息；方向（通常来自虚频模）决定了它爬上哪个鞍点。",
      },
    ],
    terms: [
      {
        t: "过渡态",
        en: "transition state",
        d: "能量面上沿反应方向为极大、其余方向为极小的一阶鞍点。它的能量减去初态能量就是能垒。",
      },
      {
        t: "反应坐标",
        en: "reaction coordinate",
        d: "描述反应从初态到末态推进程度的参数。NEB 用离散的像近似它，虚频模给出它的局部方向。",
      },
      {
        t: "像 / replica",
        en: "image / replica",
        d: "NEB 链上的一个构型。每个像都要单独做一次能量与力的计算，成本与像数成正比。",
      },
      {
        t: "nudging",
        en: "nudging",
        d: "把真实力投影到路径的法向、剔除沿路径分量，再叠加弹簧力，是 NEB 系列方法的核心操作。",
      },
      {
        t: "climbing image",
        en: "climbing image (CI-NEB)",
        d: "取消最高像的弹簧力并把沿路径的力反号，使它沿路径爬升到鞍点的技术。",
      },
      {
        t: "能垒",
        en: "energy barrier / activation energy",
        d: "过渡态与初态的能量差。电子能垒与实验活化能之间还差零点能与热校正。",
      },
      {
        t: "dimer 方法",
        en: "dimer method",
        d: "用一个两点的「二聚体」估计局部曲率，直接从猜测结构爬向最近鞍点的方法，不需要端点。",
      },
    ],
    sources: [
      {
        t: "Nudged Elastic Band（手册此页尚未撰写）",
        url: "https://manual.cp2k.org/trunk/methods/optimization/nudged_elastic_band.html",
      },
      {
        t: "CP2K_INPUT / MOTION / BAND",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/BAND.html",
      },
      {
        t: "CP2K_INPUT / MOTION / BAND / CONVERGENCE_CONTROL",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/BAND/CONVERGENCE_CONTROL.html",
      },
      {
        t: "CP2K_INPUT / MOTION / GEO_OPT / TRANSITION_STATE / DIMER",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/GEO_OPT/TRANSITION_STATE/DIMER.html",
      },
    ],
  };
})();
