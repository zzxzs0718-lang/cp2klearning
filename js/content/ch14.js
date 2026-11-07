(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch14"] = {
    id: "ch14", num: 14, part: "分析与实战",
    title: "表面、水与 QM/MM 案例",
    subtitle: "四套真实输入：Au(111)/水、Cu(100)/水、Au/TiO2、QM/MM 元动力学",
    hours: 7.0, level: "高级",
    intro: "前面各章把 CP2K 的零件拆开讲过，这一章把它们装回去：四套来自「庚子计算 CP2K 课程」的真实练习输入——Au(111) 上的水加 AIMD、Cu(100) 上的水（OT 与对角化两版）、Au/TiO2 界面（DFT+U）、以及一个 2936 原子的 QM/MM 元动力学算例。每套都按「体系怎么来、哪些设置是必须的、算出来的数怎么读」讲，输入片段按原文件引用，数值只给文件里真实存在的。这些是课程练习，不是官方教程；`CUTOFF 350`、`EPS_SCF 1.0E-6` 这类取值是那套体系在那台机器上的选择，不是普适最优。",
    goals: [
      "能独立搭一个金属 slab + 水层的模型：层数、真空、固定层、偶极校正各自怎么定",
      "读懂 Au(111)/水 的 AIMD 输入，知道 UKS、SMEAR、ADDED_MOS、ASPC 为什么一个都不能少",
      "在 OT 与对角化之间做选择，并能解释 OUTER_SCF 在难收敛体系里的作用",
      "会用 DFT+U 处理 TiO2 的 Ti 3d 电子，并把接口处的固定层设对",
      "理解 QM/MM 的三种力场拼装方式（MIXED/GENMIX、&QMMM、MULTIPLE_FORCE_EVALS）与元动力学的墙"
    ],
    sections: [
      {
        id: "14.1", title: "四个体系的共同骨架",
        blocks: [
          { type: "p", text: "四个练习看起来差异很大，骨架其实一样：**一块金属或氧化物 slab，上面放一层分子，边界条件用周期盒子，能量用第一性原理或半经验方法算**。差别在体系大小、电子结构难度（金属的费米面、TiO2 的强关联 d 电子）、以及是否把大部分原子降级成力场。" },
          {
            type: "table",
            caption: "四套练习的规模与关键设置（数值取自各目录的 cp2k.inp 与 coord 文件）",
            head: ["体系", "原子组成", "盒子（Å）", "电子结构", "动力学"],
            rows: [
              ["Au-H2O", "72 Au（6 层 × 12）+ 40 H2O + 6 Na = 198", "8.6507 × 9.9899 × 31.000", "PBE，UKS，SMEAR 300 K，ADDED_MOS 500", "NVT 330 K，0.5 fs，100000 步"],
              ["cuh2o", "48 Cu + 46 H2O = 186", "10.2425 × 10.2425 × 21.0", "PBE，UKS，SMEAR 300 K（diag 版）", "单点/优化为主"],
              ["Au-TiO2", "20 Au + 144 Ti + 288 O = 452", "17.7540 × 19.4907 × 27.2817", "PBE + U（Ti 3d，U−J = 13.6 eV）", "NVT 600 K，2 fs，100000 步"],
              ["meta-qmmm", "56 个 QM 原子 + 2880 个 MM 原子 = 2936", "40.764229 × 39.715716 × 70.0", "PM6 半经验（QM 区）", "NVT 450 K，0.5 fs，元动力学"]
            ]
          },
          { type: "p", text: "注意最后一行：这个算例的 QM 区只有 56 个原子，用的是 **PM6 半经验**而不是 DFT，其余 2880 个原子用 EAM（金属）与 Morse/Lennard-Jones（有机部分）描述。这是 QM/MM 的典型取舍——把电子结构的预算全花在反应中心，环境用便宜的方法兜住。" },
          { type: "callout", kind: "note", title: "算之前先问三个问题", text: "① 这块 slab 需要几层才能让表面性质收敛（通常 3–6 层，看你要算的量对层数的敏感度）？② 真空留多厚（一般 15 Å 起，含偶极的体系要更厚或做校正）？③ 哪些原子固定（固定体相层，让表面与吸附层松弛）？这三个答不上来，后面的 SCF 设置再漂亮也没用。" }
        ]
      },
      {
        id: "14.2", title: "搭 slab：层数、真空、固定层、偶极校正",
        blocks: [
          { type: "p", text: "slab 模型是把体相沿某个晶面切开、在法向留出真空。三件事决定它是否可信：**厚度**（要厚到内部原子已经像体相）、**真空**（要厚到周期像之间不互相看见）、**固定层**（把底部若干层钉住，模拟半无限固体）。" },
          {
            type: "code", lang: "cp2k", title: "金属 slab 的 CELL、坐标与固定层（Au-H2O 练习的原样结构）",
            text: `&FORCE_EVAL
  &SUBSYS
    &CELL
      ABC 8.6507 9.9899 31.000
    &END CELL
    &COORD
      @INCLUDE coord.inc
    &END COORD
    &CONSTRAINT
      &FIXED_ATOMS
        LIST 151..174
      &END FIXED_ATOMS
    &END CONSTRAINT
    &KIND Au
      ELEMENT Au
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q11
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`
          },
          { type: "p", text: "`LIST 151..174` 这 24 个原子是什么，得回去数 `coord.inc`：那个文件按元素分块排列（H、O、Na、Au 依次），Au 从第 127 号开始，按 z 分成 6 层、每层 12 个，所以 151–174 正好是 z = −1.258 与 1.097 的那两层——**第 3、4 层，不是最底下那层**。课程选择固定中间偏下两层，让最底两层也参与弛豫（它们是 slab 的「体内」，其实几乎不动），表面侧则完全自由。" },
          { type: "callout", kind: "warn", title: "固定层编号不能照抄", text: "同一个 `LIST 151..174` 换到别的 coord 文件就完全是另一批原子。改体系后必须重新数：按元素分块、按 z 排序、确认你要固定的是哪几层。课程里另一个练习（cuh2o 的 opt）固定的是 `LIST 139..170`，Au-TiO2 固定的是 `1..54` 与 `289..324`——三套编号毫无可比性，全靠对着自己的坐标文件核对。" },
          { type: "h3", text: "真空与偶极校正" },
          { type: "p", text: "真空厚度的判据是**静电势在真空区出现平台**：对 z 做平面平均后，如果曲线在真空段是平的，说明上下周期像之间没有净相互作用；如果带斜率，说明存在净偶极，需要加厚真空或者做偶极校正。Au-H2O 的盒子在 z 向给了 31 Å，而 Au 的 6 层只占 11.77 Å，剩下的空间基本都给了真空与水层。" },
          { type: "p", text: "CP2K 没有 VASP 里 `IDIPOL` 那样的开关，它用的是**解析偶极校正**：在 `&DFT` 里打开 `SURFACE_DIPOLE_CORRECTION T`，并用 `SURF_DIP_DIR` 指明法向。这一项在校正的是「slab 上下表面不对称造成的虚假电场」，和加真空是互补的两件事——真空不够时靠校正救不回来，因为周期像已经物理上重叠了。" },
          { type: "callout", kind: "tip", title: "固定层与约束不是一回事", text: "`&FIXED_ATOMS` 把原子钉死在原位（零自由度）；`&CONSTRAINT` 里的几何约束则是「保持某个键长/键角」，原子还能在约束面上动。做表面反应扫描时常用后者固定某个 O–H 距离；做 slab 时用前者固定体相层。两者混用要先想清楚自由度还剩几个。" }
        ]
      },
      {
        id: "14.3", title: "水层与固液界面：从建模到预平衡",
        blocks: [
          { type: "p", text: "水层不是随手撒点分子就行。合理的流程是：**先用经典工具把密度和排布做对，再交给第一性原理做短程重排**。课程包里带了一个 `packmol` 目录，就是用来按区域填分子的——给定盒子、给定每个组分的目标密度，packmol 把分子塞进去且保证不重叠。" },
          {
            type: "steps",
            items: [
              { t: "定水层厚度", d: "按实验密度估分子数：1 g/cm³ 对应约 0.0334 分子/Å³。先算出目标区域的体积，再折算成 H2O 个数，不要凭感觉写。" },
              { t: "packmol 填分子", d: "把 slab 的坐标固定住，只在水层区域填水，输出合并后的 xyz。" },
              { t: "转 CP2K 坐标", d: "xyz 转成 `&COORD` 或坐标文件，按元素把 KIND 排好；元素顺序决定了后面固定层与 COLVAR 的编号。" },
              { t: "短程预平衡", d: "先跑 1–2 ps 低温或带强恒温器的 NVT，让水的取向与密度松弛；检查温度曲线与水的 g(r) 是否合理。" },
              { t: "生产段", d: "回到目标温度跑长轨迹；分析时丢掉预热段。" }
            ]
          },
          { type: "p", text: "Au-H2O 的输入里有 6 个 Na 原子，KIND 里给的是 `GTH-PBE-q9`。这类「多余」的原子通常是建模时带入的补偿离子或电解液成分，跑之前要确认它在该体系里是否真有物理意义——如果没有，删掉比留着好，因为它会显著改变界面处的静电势与水的取向。" },
          { type: "p", text: "界面水的分析在前一章讲过：按层切片算密度分布、算 Au–O 与 O–O 的 g(r)、看第一水层的取向角分布。这里补一条实践细节：**真空层的存在会让体相归一化失效**，所以界面处的 g(r) 与配位数必须用局部密度做归一化，否则第一水层的峰高会被系统性地压低。" }
        ]
      },
      {
        id: "14.4", title: "Au(111)/水 的 AIMD：金属 + 水 + 真空，一个都不能少",
        blocks: [
          { type: "p", text: "这套输入把三个难点叠在了一起：**金属**（费米面处连续态）、**水**（氢键网络、需要足够长的时间尺度）、**真空**（z 向一半是空的）。金属决定了必须开自旋与展宽；水决定了必须处理部分占据带来的 SCF 震荡；真空则意味着 Poisson 求解器要走对分支。" },
          {
            type: "code", lang: "cp2k", title: "Au-H2O 的电子结构核心（课程原文件的取值）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME  BASIS_MOLOPT
    POTENTIAL_FILE_NAME  GTH_POTENTIALS
    UKS T
    &MGRID
      CUTOFF 350
    &END MGRID
    &QS
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
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "逐项说清楚。`UKS T` 是自旋非限制——Au 的 5d/6s 与水分子的闭壳层混在一起，开 UKS 让两个自旋通道各自优化；代价是计算量翻倍。`&SMEAR` 用电子的费米–狄拉克分布替代阶梯占据，`ELECTRONIC_TEMPERATURE` 给的是**电子温度**（不是离子温度），300 K 意味着约 0.026 eV 的展宽，足以抹平费米面附近的占据跳变。`ADDED_MOS 500` 给额外 500 条空轨道，因为金属的部分占据会用到费米能级以上的态——不给空带，SMEAR 就等于没开。" },
          { type: "p", text: "`CHOLESKY INVERSE` 指定用 Cholesky 分解来求 overlap 矩阵的逆，在难收敛体系上比默认路径更稳。`ALGORITHM STANDARD` 是标准的对角化算法（对应前面章节讲过的 ELPA 这类加速库是另一层优化）。`MIXING` 用 Broyden，ALPHA 0.1 是较小的步长、NBROYDEN 8 表示保留 8 步历史来构造近似 Jacobian——金属体系的密度对 mixer 很敏感，小步长是常态。" },
          { type: "h3", text: "为什么 AIMD 里要开 ASPC" },
          { type: "p", text: "`WF_INTERPOLATION ASPC` + `EXTRAPOLATION_ORDER 3` 是一对：MD 每一步的波函数都用前几步的波函数做高阶外推，作为下一步的初猜。原子在 0.5 fs 内移动很小，外推出的初猜离真解很近，SCF 往往几步就收敛。代价是外推误差会随时间积累，所以外层还要有 `EPS_SCF 1.0E-6` 兜底——外推只管初猜，收敛判据不管折扣。" },
          { type: "callout", kind: "warn", title: "ASPC 不是万能加速键", text: "外推要求体系在时间上连续，且步长不要大到结构剧变。做退火、加约束突然放开、或者从优化结构刚切进 MD 的头几步，外推可能给出很差的初猜，表现为前几步 SCF 步数暴涨。做法是头几步用 `SCF_GUESS ATOMIC` 或降低 `EXTRAPOLATION_ORDER`，等轨迹稳定后再切回 ASPC。" },
          { type: "demo", id: "md" },
          { type: "p", text: "`EPS_SCF 1.0E-6` 这个值也不是随便写的。课程讲义里有一张 BOMD 稳定性表（64 个水分子、PBE、0.5 fs），以 `EPS_SCF 1e-10` 的轨迹为参照：`1e-8` 时总能平均绝对误差约 1.2e-11 Ha、力误差 5.1e-9 Ha/Bohr、能量漂移 0.0 K/ns；放到 `1e-6`，总能误差升到 6.9e-8 Ha、力误差 4.8e-7、漂移 0.4 K/ns；到 `1e-4` 就开始不可接受——总能误差 3.3e-4 Ha、力误差 5.9e-5、漂移 50 K/ns。这张表说明的是**趋势**：判据越松，力误差与能量漂移越大，而漂移比总能误差更致命，因为它会在长轨迹里累积成假温度。" }
        ]
      },
      {
        id: "14.5", title: "OT 还是对角化：Cu(100)/水 的两套输入",
        blocks: [
          { type: "p", text: "同一个 Cu(100)+水 体系，课程给了两套输入，只差电子结构求解器。这是一次现成的对照实验：几何、基组、泛函、截断全同，只有 SCF 路线不同，所以能量与步数的差别可以直接归因到求解器。" },
          {
            type: "code", lang: "cp2k", title: "OT 路线（cuh2o/ot）：CG 最小化 + 外层 SCF 循环",
            text: `&FORCE_EVAL
  &DFT
    &QS
      NGRIDS 4
      CUTOFF 350
      REL_CUTOFF 60
    &END QS
    UKS T
    &SCF
      MAX_SCF 100
      EPS_SCF 1.0E-6
      SCF_GUESS RESTART
      &OT
        MINIMIZER CG
        PRECONDITIONER FULL_ALL
        LINESEARCH 2PNT
      &END OT
      &OUTER_SCF
        EPS_SCF 1.0E-5
        MAX_SCF 100
      &END OUTER_SCF
    &END SCF
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "OT（orbital transformation）把「解本征值问题」换成「直接最小化总能量对轨道旋转的泛函」，不需要显式对角化，内存与 I/O 都省，适合大体系。它的前提是**体系有带隙**：HOMO–LUMO 间隙太小时，最小化会在近简并的态之间来回摆，收敛变慢甚至失败。`MINIMIZER CG` 是共轭梯度，`PRECONDITIONER FULL_ALL` 是最贵的预条件（也最有效），`LINESEARCH 2PNT` 用两点线搜索——讲义里对应的经验是：2PNT 大多数情况够用，大体系有时要 3PNT，极难收敛的体系才上 GOLD。" },
          { type: "p", text: "`&OUTER_SCF` 把 SCF 拆成两层：内层用 OT 最小化到 `EPS_SCF 1.0E-6`，外层检查轨道旋转的梯度是否真的降到 `1.0E-5`，不达标就再跑一轮内层。内层 `MAX_SCF 100` 乘以外层最多几轮，才是总的 SCF 预算。这个练习的实际输出是内层 83 步收敛、外层 2 轮，合计 183 步。" },
          {
            type: "code", lang: "cp2k", title: "对角化路线（cuh2o/diag）：显式本征值 + 展宽",
            text: `&FORCE_EVAL
  &DFT
    &QS
      EPS_DEFAULT 1.0E-14
      WF_INTERPOLATION ASPC
      EXTRAPOLATION_ORDER 3
    &END QS
    UKS T
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
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "对角化路线显式构造并求解本征值问题，天然支持部分占据（配合 SMEAR），也能给出空轨道用于 DOS/PDOS 与光学性质。代价是内存与时间随轨道数平方增长，`ADDED_MOS 500` 意味着要多算 500 条空带——这个体系的输出里 `Number of molecular orbitals: 948`（448 条占据 + 500 条空带，对应 896 个电子），比 OT 路线的 448 条多了一倍多。" },
          {
            type: "table",
            caption: "同体系的两次实际运行（数据取自课程输出文件）",
            head: ["项目", "OT 路线", "对角化路线"],
            rows: [
              ["SCF 步数", "内层 83 步，外层 2 轮（合计 183）", "4 步"],
              ["总能（Ha）", "−3101.834603", "−3101.838526"],
              ["电子熵项（Ha）", "未单独打印", "−0.0040250399"],
              ["费米能级", "不输出", "0.0471347 Ha（1.2826 eV）"],
              ["轨道数", "448（全占据）", "948（448 + 500 空带）"]
            ]
          },
          { type: "p", text: "两个总能差了 0.0039 Ha（约 0.11 eV），看着像方法误差，其实要先做一步归一：对角化路线的 `Total energy` 里已经包含了展宽带来的电子熵项 −TS_el。把 −0.004025 Ha 加回对角化结果得到 −3101.834501 Ha，与 OT 的 −3101.834603 Ha 只差约 1e-4 Ha（3 meV，折合 0.015 meV/atom）。**比较这两种路线的能量之前，先把熵项对齐**，否则会把热力学项误读成数值误差。" },
          { type: "callout", kind: "tip", title: "选择建议", text: "绝缘体/半导体、大体系、内存紧张 → OT。金属、小带隙、需要空带或 DOS/PDOS、需要分数占据 → 对角化 + SMEAR。拿不准时的稳妥流程是：先用对角化跑一个单点确认能量与占据合理，再切 OT 做长轨迹；如果 OT 在金属上收敛困难，回到对角化而不是继续调 OT 参数。" }
        ]
      },
      {
        id: "14.6", title: "Au/TiO2：DFT+U 与界面固定",
        blocks: [
          { type: "p", text: "TiO2 的 Ti 3d 电子是强关联的，纯 GGA 会把带隙算小、把 Ti 的 d 电子过度离域。标准补救是 DFT+U（Hubbard 修正）：对指定角动量加一个惩罚项，把过于离域的 d 电子推回定域。CP2K 的写法是在 `&DFT` 里给 `PLUS_U_METHOD` 选投影方式，再在 `&KIND` 里给对应元素加 `&DFT_PLUS_U` 段。" },
          {
            type: "key", title: "Au-TiO2 练习里的 +U 设置",
            items: [
              { k: "PLUS_U_METHOD", v: "MULLIKEN（按 Mulliken 布居做投影）" },
              { k: "作用对象", v: "Ti 的 L = 2（d 轨道）" },
              { k: "U_MINUS_J", v: "13.6 eV（课程取值）" },
              { k: "EPS_U_RAMPING", v: "1.0E-3（U 值逐步加上的收敛辅助）" }
            ]
          },
          { type: "p", text: "为什么是 U−J 而不是 U：CP2K 的参数是「有效 U」，即库仑 U 减去交换 J。文献里同一材料报的 U 从 3 到 8 eV 都有，因为定义与投影方式不同——**换一篇文献的 U 值之前，先确认它的 U−J 定义与投影方法**，否则带隙会算得离谱。`EPS_U_RAMPING` 控制 U 从 0 到目标值的爬升速度，是防止 SCF 因为突然加 U 而发散的小技巧。" },
          { type: "p", text: "这套输入的电子结构还有两个特点：一是 OT 用的是 `PRECONDITIONER FULL_SINGLE_INVERSE` 配 `MINIMIZER DIIS`，`OUTER_SCF MAX_SCF 4 / EPS_SCF 1.0E-5`——外层只给 4 轮，说明作者预期这个体系收敛不算太难；二是 `&SCF EPS_SCF 3.0E-6 / MAX_SCF 150`，比 Au-H2O 的 1e-6 松一档，452 个原子的 AIMD 要在精度和机时之间折中。" },
          { type: "p", text: "固定层是 `1..54` 与 `289..324` 两段，共 90 个原子。界面体系的固定层要按**远离界面的一侧**选：Au 团簇和 TiO2 的上表面必须能松弛，底层金属/氧化物则钉住。固定的原子太多，界面应力无处释放；太少，slab 会在 z 向整体漂移。" },
          { type: "p", text: "分析这套轨迹的脚本也在练习目录里：`rdf/` 下是 Au–Au、Au–O、Au–Ti、Ti–O 的 g(r) 成品曲线（两列，从 0.01 Å 起、步长 0.02 Å），`rmsd/` 下是按时间窗分组的位移曲线，`massC/masscenter-TiO2.py` 则按帧算 Au 原子到金团簇质心的距离——用来判断团簇在 600 K、2 fs 步长下有没有整体迁移。这些是后处理脚本的产物，不是 CP2K 内置打印。" },
          { type: "callout", kind: "warn", title: "界面体系的温度与步长要一起看", text: "Au-TiO2 用的是 2 fs 步长、600 K。重原子（Au、Ti）的振动周期长，2 fs 可以；但如果体系里有自由的 H（比如羟基或水），2 fs 就偏大，必须靠约束（如 SHAKE 类）或者降回 0.5 fs。判断方法很简单：跑 1 ps 看能量守恒与温度稳定性，漂移明显就降步长。" }
        ]
      },
      {
        id: "14.7", title: "QM/MM：三种拼装方式与 2936 原子的算例",
        blocks: [
          { type: "p", text: "QM/MM 要把同一批原子分给两套能量表达式，再按某种规则混合。CP2K 给了不止一条路，选哪条取决于你要什么：" },
          {
            type: "list",
            ordered: false,
            items: [
              "**原生 &QMMM**：一个 `&FORCE_EVAL` 里同时放 QM 与 MM，用 `&QMMM` 段指定 QM 区、链接原子、周期与多极；适合 QM 区与 MM 区在同一套周期边界内、需要静电嵌入的场景。",
              "**MULTIPLE_FORCE_EVALS + MIXED**：把多个完整的 `&FORCE_EVAL` 各算一遍，再按混合函数加起来；适合 QM 区与 MM 区需要不同盒子/不同边界条件（比如 QM 区孤立、MM 区周期）的场景。",
              "**MIXED + GENMIX 的通用混合**：不限于 QM/MM，任何两套能量都能按权重混合，甚至可以三项相加做 ONIOM 式分层。"
            ]
          },
          { type: "p", text: "meta-qmmm 这个算例走的是第二条路，而且是三段式：顶层 `&MULTIPLE_FORCE_EVALS` 声明计算顺序 `2 3`（先算第 2 个、再算第 3 个力场），`MULTIPLE_SUBSYS T` 表示每个 `&FORCE_EVAL` 自带子系统；第 1 个力场是混合器（MIXED），第 2 个是 MM（FIST，含 EAM），第 3 个是 QM（Quickstep，PM6）。" },
          {
            type: "code", lang: "cp2k", title: "三段式 QM/MM 的混合器（课程原文件结构）",
            text: `&MULTIPLE_FORCE_EVALS
  FORCE_EVAL_ORDER 2 3
  MULTIPLE_SUBSYS T
&END MULTIPLE_FORCE_EVALS

&FORCE_EVAL
  METHOD MIXED
  &MIXED
    MIXING_TYPE GENMIX
    GROUP_PARTITION 2 6
    &GENERIC
      ERROR_LIMIT 1.0E-10
      MIXING_FUNCTION E1+E2
      VARIABLES E1 E2
    &END GENERIC
    &MAPPING
      &FORCE_EVAL_MIXED
        &FRAGMENT 1
          1 56
        &END FRAGMENT
        &FRAGMENT 2
          57 2936
        &END FRAGMENT
      &END FORCE_EVAL_MIXED
      &FORCE_EVAL 1
        DEFINE_FRAGMENTS 1 2
      &END FORCE_EVAL
      &FORCE_EVAL 2
        DEFINE_FRAGMENTS 1
      &END FORCE_EVAL
    &END MAPPING
  &END MIXED
&END FORCE_EVAL`
          },
          { type: "p", text: "`&MAPPING` 是这套写法的心脏：`&FORCE_EVAL_MIXED` 把 1–56 号原子划成片段 1、57–2936 号划成片段 2；然后 `&FORCE_EVAL 1`（MM）被要求同时提供两个片段（`DEFINE_FRAGMENTS 1 2`），`&FORCE_EVAL 2`（QM）只提供片段 1。混合函数 `E1+E2` 里，E1 就是 QM 算的片段 1，E2 是 MM 算的片段 2——两段拼接，切口处没有重复计数，因为这个模型里 QM 与 MM 的原子集合本来就不相交。" },
          { type: "p", text: "MM 侧用的是 FIST：`&CHARGE` 把所有原子电荷设为 0，靠 `&GENPOT` 的 Morse 型对势（Cu–C、Cu–H 各一套参数）加 `&EAM` 的金属多体势（`PARM_FILE_NAME ./CU.pot`）描述相互作用。注意 `&KIND CU_FIX ELEMENT CU MASS 1000000000.`——质量设成 1e9，这些 Cu 原子就成了几乎不动的「冻结壁」，比用约束固定更省事，因为动力学积分器自然把它们冻住。" },
          { type: "p", text: "QM 侧：`&QS METHOD PM6` 走半经验，`&SE` 里给了 Coulomb 与 Exchange 的截断 20 Å；`&QMMM` 体系常见的周期问题是「QM 区不该是周期的」，所以这里 QM 的盒子是 `ABC 30 30 30 PERIODIC NONE`，配 `POISSON PERIODIC NONE / POISSON_SOLVER WAVELET`，并把 QM 区坐标用 `&CENTER_COORDINATES` 挪到盒子中心——孤立分子放进足够大的真空盒，是避免周期像相互作用的常规手段。" },
          { type: "callout", kind: "warn", title: "QM/MM 的三个经典坑", text: "① **切口**：QM 区边界上的化学键必须用链接原子或伪势处理，否则悬空键会带来自旋污染与虚假的电荷转移；这个模型用「QM 区正好是完整分子/团簇」避开了切口。② **静电嵌入**：MM 电荷为 0 时没有嵌入静电，等于机械嵌入，反应能垒会被系统性低估。③ **EMAX_SPLINE**：MM 邻居表用样条插值，原子靠得太近时会直接 abort，报 `GEOMETRY wrong or EMAX_SPLINE too small!`——建模后先检查最短原子间距，别一上来就加 `&SPLINE` 的精度。" },
          { type: "p", text: "另外两条 QM/MM 的原生路线（`&QMMM` 段、以及内置力场 + GROMACS 外部力场）在手册的方法页里有完整说明，涉及链接原子、多极展开、镜像电荷与可极化力场等选项。用原生 `&QMMM` 时，QM 与 MM 的边界、周期性与泊松求解器都要在同一个 `&FORCE_EVAL` 里协调好，比三段式简单但灵活性低。" }
        ]
      },
      {
        id: "14.8", title: "元动力学、性能与排错",
        blocks: [
          { type: "p", text: "这个 QM/MM 算例的动力学部分是 NVT 450 K、0.5 fs、20 万步，恒温器是 CSVR（`REGION MASSIVE`，`TIMECON 200 fs`）。真正的主角是 `&FREE_ENERGY/&METADYN`：沿两个集合变量（COLVAR）加高斯沉积，把体系从初始构型推出去，最后从 HILLS 文件重建自由能面。" },
          {
            type: "code", lang: "cp2k", title: "元动力学：恒温器、沉积参数与集合变量",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    STEPS    200000
    TIMESTEP 0.5
    TEMPERATURE 450.0
    &THERMOSTAT
      TYPE CSVR
      REGION MASSIVE
      &CSVR
        TIMECON [fs] 200.0
      &END CSVR
    &END THERMOSTAT
  &END MD
  &FREE_ENERGY
    &METADYN
      DO_HILLS
      NT_HILLS 50
      WW 3.0e-3
      &METAVAR
        SCALE 0.3
        COLVAR 1
      &END METAVAR
    &END METADYN
  &END FREE_ENERGY
&END MOTION`
          },
          { type: "p", text: "墙写在 `&METAVAR` 里，每一侧一道：`&WALL TYPE QUADRATIC`、`POSITION [angstrom] 5.0`、方向 `DIRECTION WALL_PLUS`、`K [kcalmol] 40.0`，另一侧把位置换成 1.0、方向换成 `WALL_MINUS`。这个模型里 CV1 被夹在 1.0–5.0 Å、CV2 在 0.6–4.00 Å；第三个集合变量的整段在最开始的文件里是被注释掉的——说明作者先在二维面上跑，之后再决定要不要升三维。" },
          { type: "p", text: "集合变量本身定义在 `&FORCE_EVAL/&SUBSYS/&COLVAR` 里，这个模型用了 `&COMBINE_COLVAR`：两条 `&DISTANCE`（原子 4–50、原子 7–49）线性组合成 CV1，`FUNCTION CV1+CV2`、`ERROR_LIMIT 1.0E-8`；另有一条独立的 `&COLVAR/&DISTANCE ATOMS 49 50` 作为 CV2。原子编号在这里是**全局编号**，跨 QM/MM 区直接引用，写错一位整条自由能面就是别的量。" },
          { type: "h3", text: "性能与 I/O" },
          { type: "p", text: "2936 个原子、20 万步，产出量是必须提前规划的。这个算例的 `cp2k-pos-1.xyz` 有 262 MB，`cp2k-COLVAR.metadynLog` 有 8.3 MB，`cp2k-HILLS.metadynLog` 107 KB。对应的输出频率设置是 `TRAJECTORY each MD 50`（每 50 步一帧）、`RESTART each MD 100`（每 100 步一个重启）、`RESTART_HISTORY OFF`（不留历史重启，只保留最新一个）。" },
          { type: "p", text: "三条经验：**轨迹频率按分析需求定**，不是越密越好——每步都存轨迹会让 I/O 成为瓶颈，且文件大到无法处理；**重启文件要留**，长跑必然遇到机时上限或掉线；**SCF 的中间输出要关**，`&PRINT/&RESTART` 与 `&RESTART_HISTORY` 在这种规模下都设成了 OFF。" },
          {
            type: "table",
            caption: "练习里遇到过的三类报错与处理",
            head: ["现象", "含义", "处理"],
            rows: [
              ["`GEOMETRY wrong or EMAX_SPLINE too small!`", "MM 邻居表里有两个原子近到样条无法插值", "检查建模后的最短距离；冲突原子重叠就重排，或临时放宽 `EMAX_SPLINE`"],
              ["`User requested to restart the wavefunction from the file named: ./cp2k-RESTART.wfn. This file does not exist. ... Calculation continues using ATOMIC GUESS.`", "SCF_GUESS RESTART 但工作目录里没有 wfn", "首次运行属正常；续算时确认 wfn 文件名与 `WFN_RESTART_FILE_NAME` 一致"],
              ["OT 在金属体系上步数暴涨甚至不收敛", "带隙太小，OT 的最小化前提不成立", "换对角化 + SMEAR；或先把 `MINIMIZER` 换 DIIS 试一次"],
              ["能量漂移、温度爬升", "SCF 判据过松或步长过大", "把 `EPS_SCF` 收紧一档，或把步长减半重跑短轨迹验证"]
            ]
          },
          {
            type: "keypoints",
            items: [
              "slab 三要素：层数够厚、真空够平、固定层按物理意图选（编号务必对着 coord 文件数）",
              "金属 + 水 + 真空的 AIMD，UKS / SMEAR / ADDED_MOS / ASPC 是配套的一组设置",
              "OT 适合有带隙的大体系，金属与小带隙走对角化 + SMEAR + 空带",
              "OT 与对角化的能量比较前，先把电子熵项对齐",
              "DFT+U 的 U 是有效 U（U−J），换文献参数前先确认投影方式",
              "QM/MM 三种拼装：原生 &QMMM、MULTIPLE_FORCE_EVALS + MIXED、GENMIX 通用混合",
              "元动力学先跑低维面、加墙限定区域，再决定是否升维",
              "长轨迹先规划输出频率：轨迹、重启、日志三者的体积要提前估"
            ]
          }
        ]
      }
    ],
    quiz: [
      {
        q: "Au(111)/水 的输入里同时开了 UKS、SMEAR 和 ADDED_MOS 500。如果去掉 ADDED_MOS，最直接的后果是？",
        options: ["SCF 无法处理费米能级以上的占据，展宽等于失效，能量与力都不对", "只是少了空轨道，总能量不受影响", "计算会变慢但结果相同", "CP2K 会自动补齐空带"],
        answer: 0,
        explain: "SMEAR 允许部分占据，被占据的态可能高于原始占据轨道数，必须有额外空带可用。不给 ADDED_MOS，可用的轨道数不够，展宽方案没有足够的态去摊电子，能量与力都会出错。"
      },
      {
        q: "&OUTER_SCF 在这个 OT 输入里 EPS_SCF 1.0E-5、MAX_SCF 100，实际输出是内层 83 步、外层 2 轮。这说明什么？",
        options: ["内层已经收敛，外层是在检查轨道旋转梯度是否也达标，再补跑一轮", "内层没收敛，靠外层补救", "总步数是 83 × 2 = 166", "外层循环只检查能量"],
        answer: 0,
        explain: "内层 OT 最小化在 83 步达到 1e-6，外层随后检查轨道旋转梯度是否满足 1e-5，不满足就再跑一轮内层（这里又跑了 100 步以内），合计 183 步。两层判据针对不同的量，不能相乘。"
      },
      {
        q: "对比 OT 与对角化的总能时，第一步应该做什么？",
        options: ["直接比较 Total energy", "把对角化结果里的电子熵项（−TS_el）加回去归一再比", "把两者的 CUTOFF 调成一样再比", "取两者的平均值"],
        answer: 1,
        explain: "开了 SMEAR 的对角化结果，Total energy 已含 −TS_el。直接相减会把热力学项当成数值误差；归一到同一基准后，两者相差约 1e-4 Ha。"
      },
      {
        q: "meta-qmmm 里 &KIND CU_FIX 的 MASS 设成 1e9，作用是？",
        options: ["让这些原子在动力学中几乎不动，充当冻结壁", "提高 EAM 势的精度", "让 CP2K 忽略这些原子", "加快 SCF 收敛"],
        answer: 0,
        explain: "质量极大 → 加速度极小，积分器自然把它们冻在原位。比逐原子加约束省事，也不会引入约束算法带来的能量项；代价是这些原子仍参与力场计算，只是不移动。"
      },
      {
        q: "同体系 slab 计算里，真空区的静电势曲线出现明显斜率，最合理的处理是？",
        options: ["把真空加厚，并检查是否需要 SURFACE_DIPOLE_CORRECTION", "把 SURF_DIP_DIR 从 Z 改成 X", "降低 CUTOFF", "把固定层扩大到全部原子"],
        answer: 0,
        explain: "斜率说明 slab 上下不对称带来净偶极。加厚真空减小周期像相互作用，偶极校正消除虚假电场；改方向或降截断都不解决物理问题。"
      }
    ],
    terms: [
      { t: "板模型", en: "slab model", d: "把体相沿某晶面切开、在法向留真空的周期性模型，用有限层数模拟半无限固体表面；厚度、真空、固定层是三个关键参数。" },
      { t: "偶极校正", en: "dipole correction", d: "针对 slab 上下表面不对称造成的虚假电场所做的解析修正；CP2K 里用 SURFACE_DIPOLE_CORRECTION 与 SURF_DIP_DIR 打开，与加真空互补。" },
      { t: "固定层", en: "fixed atoms layer", d: "在几何优化或 MD 中被钉住的原子集合，通常取远离界面的体相层，用来模拟半无限固体并抑制 slab 整体漂移。" },
      { t: "轨道变换", en: "orbital transformation (OT)", d: "不解本征值问题、直接最小化能量对轨道旋转泛函的求解路线；内存省、适合大体系，但要求体系有足够带隙。" },
      { t: "外层 SCF", en: "outer SCF (OUTER_SCF)", d: "把 SCF 分成内外两层：内层做 OT 或对角化，外层检查轨道旋转梯度是否达标，不达标再补一轮，用于难收敛体系。" },
      { t: "德法模型", en: "DFT+U", d: "对强关联的局域轨道（如 Ti 3d）加 Hubbard 惩罚项，修正 GGA 对 d 电子过度离域的倾向；CP2K 用 PLUS_U_METHOD 选投影方式。" },
      { t: "QM/MM", en: "quantum mechanics / molecular mechanics", d: "QM 区用第一性原理或半经验方法、MM 区用力场的分层计算；关键问题是切口、静电嵌入与两区之间的能量混合方式。" },
      { t: "元动力学", en: "metadynamics", d: "沿少数集合变量不断沉积高斯偏置势，把体系推出局部极小，再从 HILLS 记录重建自由能面；墙用来限定采样区域。" }
    ],
    sources: [
      { t: "CP2K 手册：&FORCE_EVAL/&QMMM（QM/MM 原生接口）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/QMMM.html" },
      { t: "CP2K 手册：QM/MM 方法总览", url: "https://manual.cp2k.org/trunk/methods/qm_mm/index.html" },
      { t: "CP2K 手册：内置力场与 QM/MM 的力场组合", url: "https://manual.cp2k.org/trunk/methods/qm_mm/builtin.html" },
      { t: "CP2K 手册：&FORCE_EVAL/&MIXED（多力场混合与 GENMIX）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/MIXED.html" },
      { t: "CP2K 手册：&FORCE_EVAL/METHOD FIST 与 &MM 力场", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/MM.html" },
      { t: "CP2K 手册：&FREE_ENERGY/&METADYN（元动力学）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/FREE_ENERGY/METADYN.html" },
      { t: "CP2K 手册：&SUBSYS/&COLVAR（集合变量定义）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/SUBSYS/COLVAR.html" }
    ]
  };
})();