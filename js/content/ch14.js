(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch14"] = {
    id: "ch14",
    num: 14,
    part: "后处理",
    title: "电子结构后处理：把一次 SCF 变成图",
    subtitle: "cube、电荷、DOS、ELF、MO 与功函数的实操路径",
    hours: 3,
    level: "进阶",
    intro: "算完单点能，真正的信息在密度里：电子往哪转移、成键靠什么、费米面附近有没有态、表面功函数多大。这一章把 CP2K 的 `&PRINT` 输出家族逐个打开，从 cube 文件一路做到能放进论文的图，每一步都给出对应命令和判断标准。",
    goals: [
      "打开 `&PRINT` 里正确的子段，稳定拿到 cube、布居与 DOS 文件",
      "用差分电荷密度和平面平均曲线说清电子从哪转移到哪",
      "用四种原子电荷、ELF 与分子轨道定位成键与电荷转移",
      "从静电势平台和费米能级算出功函数，并判断要不要做偶极校正"
    ],
    sections: [
      {
        id: "14.1",
        title: "输出家族：一次 SCF 能拿到哪些图",
        blocks: [
          { type: "p", text: "后处理的第一步不是打开 VESTA，而是打开 `&PRINT`。CP2K 把「画图要用的中间量」全部做成 `&FORCE_EVAL%&DFT%&PRINT` 下的独立子段，每个子段一个开关、一个文件名，算完直接落在工作目录里。下面这张表是这张地图：先想清楚你要回答哪个问题，再回表里找对应的段。" },
          {
            type: "table",
            head: ["你想回答的问题", "打开哪个段", "落盘文件", "用什么看"],
            rows: [
              ["电荷在空间怎么分布", "`&E_DENSITY_CUBE`", "`...ELECTRON_DENSITY...cube`", "VESTA 等值面"],
              ["未成对电子在谁身上", "`&E_DENSITY_CUBE`（UKS 才出）", "`...SPIN_DENSITY...cube`", "VESTA 等值面"],
              ["总密度（含芯电子）", "`&TOT_DENSITY_CUBE`", "`...cube`（文件名带密度类型）", "VESTA"],
              ["每个原子带多少电荷", "`&MULLIKEN` / `&LOWDIN` / `&HIRSHFELD`", "`.mulliken` / `.lowdin` / `.hirshfeld`", "文本表格"],
              ["费米能级附近有没有态", "`&DOS` + `&PDOS` / `&LDOS`", "`.pdos`", "Origin 绘图"],
              ["电子定域在哪、成什么键", "`&ELF_CUBE`", "`...ELF_S1...cube`", "VESTA 等值面"],
              ["轨道长什么样", "`&MO_CUBES`", "`...WFN_00001...cube`", "VMD"],
              ["静电势、功函数", "`&V_HARTREE_CUBE` + `&DFT%&PLANAR_AVERAGED_V_HARTREE`", "`...v_hartree...cube`", "VESTA / 曲线"]
            ],
            caption: "后处理输出的对应关系。所有段都挂在 &FORCE_EVAL%&DFT%&PRINT 下，例外是 PLANAR_AVERAGED_V_HARTREE 直接在 &DFT 下。"
          },
          { type: "p", text: "每个段都有一组共同的关键词，其中两个决定你等文件的时间和磁盘占用。**STRIDE** 控制隔几个格点取一个值：默认 `2 2 2`，每个方向取一半，格点总数降到八分之一，图会粗一点但文件小得多；`1 1 1` 是全格点，等值面边缘干净，代价是体积乘八。**FILENAME** 决定文件名前缀，不写就用项目名。经验是：先在 `2 2 2` 上确认现象存在，定稿那张图再换 `1 1 1` 重算一次。" },
          { type: "p", text: "还有两个省事的关键词值得记住：体积大的那几个段（`&MO_CUBES`、`&TOT_DENSITY_CUBE`、`&V_HARTREE_CUBE`）多一个 `MAX_FILE_SIZE_MB`，给个体积上限，程序自己挑一个够用的 stride，`0` 表示不限；`APPEND` 打开后多次运行往同一个文件里追加，适合 MD 里隔若干步抓一帧的用法（配合 `&EACH` 控制频率）。" },
          {
            type: "key",
            items: [
              { k: "STRIDE", v: "格点抽样步长，默认 `2 2 2`；`1 1 1` 最精细", tag: "常用" },
              { k: "FILENAME", v: "输出文件名前缀，不写用项目名", tag: "常用" },
              { k: "MAX_FILE_SIZE_MB", v: "cube 体积上限，0 表示不限制；超限时自动加大 stride（只在体积大的段里有）", tag: "省空间" },
              { k: "APPEND", v: "多次运行追加到同一文件，配 `&EACH` 抓轨迹帧", tag: "MD" },
              { k: "SECTION_PARAMETERS", v: "各段默认打印级别不同，显式写段名最稳", tag: "默认" }
            ]
          },
          { type: "p", text: "cube 文件里的数全是**原子单位**：长度是 Bohr，密度是 e/Bohr³。VESTA 里填的等值面数值也是原子单位，所以「0.002」和「0.002 e/Å³」差了 6.7 倍。下面这个演示就是这两个换算，动手拖一遍比记数字快。" },
          { type: "demo", id: "units", title: "Bohr ↔ Å、e/Bohr³ ↔ e/Å³ 换算", desc: "调等值面数值之前先确认单位：1 Bohr = 0.529 Å，1 e/Bohr³ = 6.748 e/Å³。" },
          { type: "callout", kind: "warn", title: "别在 MD 轨迹里每步都写 cube", text: "cube 是三维格点，一个几百原子的表面模型动辄几十 MB。生产轨迹里要抓构型就配 `&EACH`，或者在 `&MOTION%&PRINT%&TRAJECTORY` 里存 xyz、需要时再拿单帧做单点输出 cube。" },
          { type: "keypoints", items: ["后处理入口是 `&FORCE_EVAL%&DFT%&PRINT`，一问题一段", "STRIDE 默认 `2 2 2`，`1 1 1` 精细但体积乘八", "cube 全是原子单位，等值面数值先换算再调", "定稿图用 `1 1 1` 重算，探索阶段用 `2 2 2`"] }
        ]
      },
      {
        id: "14.2",
        title: "电子密度与自旋密度：cube 的两种画法",
        blocks: [
          { type: "p", text: "最小可用的一条后处理链，是一份能跑通的单点输入加一个 `&E_DENSITY_CUBE` 段。下面这份水分子输入可以直接存成 `h2o_cube.inp` 运行，跑完在目录里就能找到 cube 文件；把 `&COORD` 换成你自己的结构，其余部分不用动。" },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_cube.inp：单点 + 电子密度 cube（可直接运行）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 400
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
    &END SCF
    &PRINT
      &E_DENSITY_CUBE
        FILENAME cube
        STRIDE 1 1 1
      &END E_DENSITY_CUBE
    &END PRINT
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 12.0
    &END CELL
    &COORD
      O   0.000  0.000  0.000
      H   0.757  0.587  0.000
      H  -0.757  0.587  0.000
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
&END FORCE_EVAL`,
            note: "默认 RUN_TYPE 就是 ENERGY；要改项目名在文件最前面加 `&GLOBAL` + `PROJECT 你的名字`。周期性默认 XYZ，12 Å 的盒子外面是真空。跑法是 `cp2k.psmp -i h2o_cube.inp -o cp2k.out`，日志末尾出现 `PROGRAM ENDED AT` 才算正常结束；缺这一行就先去 `cp2k.out` 里找报错，别急着打开 cube 文件。"
          },
          { type: "p", text: "跑完得到的是 `cp2k-cube-ELECTRON_DENSITY-1_0.cube` 这类文件：前缀是项目名，中间是密度类型，`1_0` 是自旋通道与迭代号。文件名中间的段数随版本略有差别，认准带 `ELECTRON_DENSITY` 的那个就行。开了 `UKS`（自旋极化）之后还会多一个 `SPIN_DENSITY`，那是自旋向上减自旋向下的密度。" },
          {
            type: "code",
            lang: "cp2k",
            title: "同时输出电子密度、自旋密度与总密度（放进 &DFT 的 &PRINT）",
            text: `&PRINT
  &E_DENSITY_CUBE
    FILENAME cube
    STRIDE 1 1 1
    ADD_LAST NUMERIC
  &END E_DENSITY_CUBE
  &TOT_DENSITY_CUBE
    FILENAME total
    STRIDE 2 2 2
    MAX_FILE_SIZE_MB 500
  &END TOT_DENSITY_CUBE
&END PRINT`,
            note: "`ADD_LAST NUMERIC` 让文件名带迭代号，避免多次运行互相覆盖。总密度含芯电子，看等值面形状用它；价电子重排看 E_DENSITY_CUBE。"
          },
          { type: "p", text: "自旋密度比总电荷有用得多，因为它直接告诉你「那个多出来的电子停在哪」。讲义里两个例子：Au/CeO2(111) 上，自旋密度在界面 Ce 上鼓包，说明电子从 Au 转移到了表面的 Ce；H-TiO2(111) 上，鼓包出现在表面 Ti 上，说明电子从 H 转移到了 Ti。这两张图上能开口说话的信息，都来自同一次单点计算。" },
          { type: "p", text: "等值面数值的起点可以照抄讲义：气相分子用 `0.001 a.u.`，凝聚相用 `0.002 a.u.`。VESTA 里这个数就是密度阈值，调小一点出现的东西越多、噪声也越多，调大只留下核附近的高密度区。第一次总从 `±0.002` 起，看着像一团湿棉花就往上加一个量级。" },
          { type: "callout", kind: "tip", title: "GAPW 下密度的硬软分量", text: "`&E_DENSITY_CUBE` 的 `DENSITY_INCLUDE` 默认是 `TOTAL_HARD_APPROX`：GAPW 把密度拆成硬（原子中心的尖锐部分）和软（网格部分），默认把硬分量近似合进来。做全电子或芯态相关的图时，显式写成 `TOTAL` 再对比一次，判断这个近似有没有影响结论。" },
          { type: "callout", kind: "danger", title: "自旋密度是 0 不代表算错了", text: "`SPIN_DENSITY` 只有 UKS 才非零。闭壳层（`UKS F`）算出来的自旋密度整张图都是零，这是对的。要分析磁性，先在 `&DFT` 里写 `UKS T`，必要时再给 `MULTIPLICITY`。" },
          { type: "keypoints", items: ["`&E_DENSITY_CUBE` 一份单点就够，默认 `STRIDE 2 2 2`", "自旋密度只在 UKS 下有意义，用来定位转移电子", "等值面起点：气相 `0.001 a.u.`、凝聚相 `0.002 a.u.`", "总密度含芯，价电子重排看 ELECTRON_DENSITY"] }
        ]
      },
      {
        id: "14.3",
        title: "差分电荷三步法：三个单点回答一个电子流向",
        blocks: [
          { type: "p", text: "差分电荷密度回答的是「A 和 B 放在一起之后，电子怎么重新分布」。两种定义各管一件事：**片段相减**看相互作用带来的重新分布，**形变密度**看每个原子成键后电子云怎么变形。前者适合吸附、界面、异质结，后者适合单分子内的成键分析。" },
          { type: "formula", tex: "\\Delta\\rho = \\rho_{AB} - \\rho_{A} - \\rho_{B}", caption: "片段相减：复合体系减掉两个孤立片段。" },
          { type: "formula", tex: "\\Delta\\rho = \\rho_{AB}^{SCF} - \\rho_{AB}^{atomic}", caption: "形变密度：同一体系的 SCF 密度减掉原子球对称密度之和。" },
          { type: "steps", items: [
            { t: "优化复合体系结构", d: "吸附/界面体系先做几何优化，后面的三份单点都用这一个结构，不要再动原子位置。" },
            { t: "截出两个片段", d: "从优化好的结构里直接删原子得到 A 和 B，盒子、原子坐标原样保留，不要重新居中。" },
            { t: "三次同参数单点", d: "AB、A、B 各跑一次单点，`&MGRID`、`&XC`、基组、赝势逐行一致，只差在原子列表。" },
            { t: "cube 相减", d: "cubecruncher 一条命令相减，或者在 VESTA 里依次导入、做减法。" },
            { t: "平面平均", d: "沿法向做平面平均，把三维等值面压成一维曲线，能量转移发生在哪一层就看出来了。" }
          ] },
          { type: "p", text: "讲义用的是 CO/Ni(100)：先优化 CO 吸附在 Ni(100) 上的结构，再分别算 CO/Ni(100)、Ni(100)、CO 的单点，三个 cube 依次相减得到 `r = r(CO/Ni) − r(CO) − r(Ni)`。注意讲义里那句提醒：片段的**结构从复合体系直接截取，不要再优化**，否则比的是两个不同的几何构型。" },
          {
            type: "code",
            lang: "bash",
            title: "cubecruncher 做差分（源码在 CP2K 的 tools/cubecruncher 下）",
            text: `# 1) 编译
cp -r /path/to/cp2k/tools/cubecruncher .
cd cubecruncher && make && cd ..

# 2) 先减掉分子，再减掉表面
./cubecruncher.x -i ab-cube-ELECTRON_DENSITY-1_0.cube \\
                 -subtract a-cube-ELECTRON_DENSITY-1_0.cube \\
                 -o tmp.cube
./cubecruncher.x -i tmp.cube \\
                 -subtract b-cube-ELECTRON_DENSITY-1_0.cube \\
                 -center geo -o delta.cube

# 3) 把 delta.cube 拖进 VMD / VESTA 看等值面（正负各设一个颜色）`,
            note: "`-center geo` 按几何中心对齐格点。三个片段的原子位置必须已经对上，否则「差分」里混的是平移误差。文件名读法是 `<项目名>-<FILENAME>-<标签>-1_0.cube`：项目名 `ab` 配 `FILENAME cube`，就得到 `ab-cube-ELECTRON_DENSITY-1_0.cube`。"
          },
          { type: "p", text: "不想在图形界面里手工点三次，就走命令行：差分步骤写进脚本，每次重算都用同一套参数，结果可复现。图形界面那条路（VESTA 里先导入整体 cube，再依次减去两个片段）适合一次性检查，交付前建议再用脚本复核一遍。" },
          { type: "callout", kind: "danger", title: "三种误差会伪装成电荷转移", text: "① 三次计算用了不同盒子（片段单独算时缩小了 cell）；② `CUTOFF` 或基组不一致，基函数变了本身就是密度差；③ 片段重新居中了，格点错位。做法是把三次的 cell、`&MGRID`、`&XC`、`&KIND` 设成完全一样，片段只删原子不重排。判断办法：真空区里应该几乎没有差分值，如果真空里有大片颜色，说明参数没对齐。" },
          { type: "callout", kind: "info", title: "从三维到一维：平面平均", text: "把 xy 平面内的格点做平均，只剩 z 方向的曲线，红色峰表示电子聚集、蓝色谷表示电子减少。讲义给的脚本用法是 `python ./cube.py <cube 文件>`，三个 cube 各做一条线再相减。写论文时这张一维曲线往往比等值面截图更好排版，也更容易读出转移的层间距。" },
          { type: "keypoints", items: ["片段相减看相互作用，形变密度看成键变形", "三次单点的盒子、截断、基组必须逐行一致", "片段从复合体系直接删原子，不优化、不重新居中", "真空区出现大片差分值就是参数没对齐"] }
        ]
      },
      {
        id: "14.4",
        title: "原子电荷：四种划分，四个不同答案",
        blocks: [
          { type: "p", text: "原子电荷的定义是「核电荷数减去分配给这个原子的电子数」。麻烦在于「分配」没有唯一答案：电子密度连续分布，切成原子的份额必须人为定规则。所以要看的是**同一方法内部的趋势**，而不是不同方法之间的绝对值。" },
          { type: "p", text: "CP2K 内置三种，一次单点全部输出：Mulliken 按基函数归属划分，算得快、对基组敏感；Löwdin 先把基函数正交化再划分，比 Mulliken 稳一些；Hirshfeld 按自由原子密度在空间中的比例划分，对基组不敏感。Bader 不在 CP2K 里，要拿 cube 交给 Henkelman 组的独立程序，按电子密度零通量面切原子盆。" },
          {
            type: "code",
            lang: "cp2k",
            title: "三个布居段一次输出（放进 &DFT 的 &PRINT）",
            text: `&PRINT
  &MULLIKEN SILENT
    FILENAME Mulliken
    &EACH
      JUST_ENERGY 1
    &END EACH
  &END MULLIKEN
  &LOWDIN SILENT
    FILENAME lowdin
  &END LOWDIN
  &HIRSHFELD SILENT
    FILENAME hirshfeld
  &END HIRSHFELD
&END PRINT`,
            note: "`SILENT` 把屏幕输出关掉、只写文件，长任务里省日志。想让结果留在标准输出里就去掉 SILENT，`FILENAME` 默认就是 `__STD_OUT__`。"
          },
          { type: "p", text: "文件名分别是 `cp2k-Mulliken-1.mulliken`、`cp2k-lowdin-1.lowdin`、`cp2k-hirshfeld-1.hirshfeld`，每个原子一行，列是 `Net charge`（净电荷）与 `Spin moment`（自旋磁矩）。自旋矩这一列在 UKS 下才有内容，单位是玻尔磁子，判断磁性中心时直接看它。" },
          { type: "p", text: "讲义里的 CO/Ni(100) 是一张很好的教具：同样的结构、同一份密度，四种方法给出四个不同的答案，连符号都不一致。" },
          {
            type: "table",
            head: ["方法", "Ni", "C", "O"],
            rows: [
              ["Bader（AIM）", "+0.06", "+1.64", "−1.86"],
              ["Löwdin", "−0.062", "+0.239", "+0.138"],
              ["Hirshfeld", "−0.630", "+0.947", "−0.240"],
              ["Mulliken", "−0.327", "+0.443", "−0.076"]
            ],
            caption: "同一份 CO/Ni(100) 密度上四种划分的结果（数据来自课程讲义）。重点不是谁对，而是符号都可能不一致。"
          },
          { type: "p", text: "原因是划分规则。Bader 按密度拓扑切盆，Ni 的 3d 电荷落进自己的盆里就偏正；Mulliken 与 Löwdin 按基函数归属，Ni 的 d 轨道与 C/O 的基函数有重叠，重叠布居对半分，方向就反过来了。做法固定成两条：一张图里只用一种方法画趋势，方法段写明用的是哪一种，不跨方法比较绝对值。" },
          {
            type: "code",
            lang: "bash",
            title: "Bader：从 cube 到每个原子的净电荷",
            text: `# 1) 单点输出电子密度（见 14.2），得到 ab-cube-ELECTRON_DENSITY-1_0.cube
# 2) Henkelman 组的 bader 程序读 cube
bader ab-cube-ELECTRON_DENSITY-1_0.cube

# 3) 生成 ACF.dat / BCF.dat / AVF.dat，净电荷在 ACF.dat 里算：
#    净电荷 = 该原子的价电子数 - 原子盆内的电子数
bader ab-cube-SPIN_DENSITY-1_0.cube   # 自旋布居同理`,
            note: "ACF.dat 的列依次是：原子序号、XYZ 坐标、原子盆内电子数、盆体积、原子核到盆边界的最小距离。"
          },
          { type: "p", text: "ACF.dat 里那一列电子数是原子盆里的电子总数，减之前先确认**价电子数取的是赝势的 q 值**。讲义里 Ni 用 `GTH-PBE-q18`，所以 18 − 17.94 = +0.06；C 用 q4 得 4 − 2.36 = +1.64；O 用 q6 得 6 − 7.86 = −1.86。q 值填错，整张表一起偏。" },
          { type: "callout", kind: "danger", title: "价电子数由赝势决定", text: "同一个元素换个赝势，q 值就变了（Ni 有 q10、q16、q18 等）。做 Bader 之前回到 `&KIND` 把 `POTENTIAL` 那一行读一遍，用错了会让所有净电荷整体平移几个电子。" },
          { type: "callout", kind: "warn", title: "金属体系里 Mulliken 会随电子温度漂移", text: "开了 `&SMEAR` 之后轨道有分数占据，Mulliken 布居把分数占据按权重摊到各原子上，数值随 `ELECTRONIC_TEMPERATURE` 变化。金属与磁性体系做电荷分析时，优先用 Bader（只依赖总密度，与占据数无关），并把电子温度固定住再横向比较。" },
          { type: "keypoints", items: ["四种方法的绝对值不可比，趋势可比", "三个内置布居一次单点全出，`SILENT` 只写文件", "Bader 净电荷 = 赝势 q 值 − 盆内电子数", "金属体系优先 Bader，Mulliken 受分数占据影响"] }
        ]
      },
      {
        id: "14.5",
        title: "PDOS：从离散能级到一条曲线",
        blocks: [
          { type: "p", text: "态密度把「有多少能级落在 E 到 E+dE 之间」画成曲线，用来回答三个高频问题：费米能级处有没有态（金属还是绝缘体）、带隙多宽、吸附分子与表面的轨道在哪个能量区间重叠。投影态密度（PDOS）再把每个能级按原子或角动量摊开，才能看出「是哪个原子的哪个轨道在起作用」。" },
          {
            type: "code",
            lang: "cp2k",
            title: "DOS + PDOS + LDOS（放进 &DFT 的 &PRINT）",
            text: `&PRINT
  &DOS
    NLUMO -1
    DELTA_E 0.01
    &PDOS
      COMPONENTS .TRUE.
    &END PDOS
    &LDOS
      LIST 1..26
    &END LDOS
  &END DOS
&END PRINT`,
            note: "当前版本 `&PDOS` 与 `&LDOS` 是 `&DOS` 的子段。讲义用的 CP2K 6.x 把它们写成 `&PRINT` 的直接子段（`&PDOS NLUMO -1` 里再套 `&LDOS`），照老写法在新版本里会被当成未知段。"
          },
          { type: "p", text: "关键词逐个说清楚：`NLUMO` 控制算多少条空轨道，`-1` 是全部，不写默认 0（导带那一侧就是空的）；`DELTA_E` 是输出网格的能量间距，默认 1e-3，要更细的峰就写小一点（也可以带单位写 `DELTA_E [eV] 0.01`）；`&PDOS` 按原子种类分解，`&LDOS` 的 `LIST` 把若干原子合并成一组投影输出；`COMPONENTS` 拆出 s、p、d、f 的磁量子数分量（讲义写作 s、px、py、pz、d）。" },
          { type: "p", text: "输出是纯文本，按自旋通道（以及原子种类）分文件：`cp2k-ALPHA_k1-1.pdos`、`cp2k-BETA_k1-1.pdos`，命名里的 kind 名与序号随版本略有差别。头部一行给出原子种类与费米能级，后面每行是「轨道序号、本征值、占据数、s/p/d/f 投影」。讲义里真实的一行长这样：" },
          {
            type: "code",
            lang: "text",
            title: "pdos 文件的样子（来自讲义）",
            text: `# Projected DOS for atomic kind Ni1 at iteration step i = 0, E(Fermi) = 0.122425 a.u.
#     MO Eigenvalue [a.u.]      Occupation        s          p          d          f
1         -3.773372        1.000000    0.00000092  0.00000001  0.00000076  0.00000284
2         -3.758844        1.000000    0.00537526  0.00109648  0.00027729  0.00110881`,
            note: "费米能级就在头部，同一行数字也可以在 `cp2k.out` 里 `grep Fermi` 拿到。"
          },
          { type: "p", text: "离散能级直接画是竖线，作图前要加高斯展宽。两条路：新版 CP2K 在 `&DOS` 里直接给 `&CURVE` 与 `&BROADEN`，程序输出展宽后的曲线文件（2026.2 起支持）；老版本或想自己控制展宽，用讲义里的 `new.py` 脚本把 pdos 转成带展宽的 dos.txt，再拖进 Origin。" },
          {
            type: "code",
            lang: "cp2k",
            title: "让 CP2K 直接输出展宽曲线（2026.2 起，放进 &DOS）",
            text: `&DOS
  NLUMO -1
  DELTA_E 0.01
  &CURVE
    ENERGY_UNIT EV
    ENERGY_ZERO FERMI
    &BROADEN
      TYPE GAUSSIAN
      WIDTH 0.1
    &END BROADEN
  &END CURVE
&END DOS`,
            note: "`ENERGY_UNIT` 默认是 HARTREE，画 eV 的图要显式写 `EV`；`ENERGY_ZERO FERMI` 把零点对齐到费米能级；`WIDTH` 是半高全宽，单位 eV。"
          },
          {
            type: "code",
            lang: "bash",
            title: "老路线：脚本展宽 + 读费米能级",
            text: `# -s 后面的数是展宽宽度，具体单位以脚本内定义为准
python new.py -s 0.01 cp2k-ALPHA_k26-1.pdos cp2k-BETA_k26-1.pdos > dos.txt

# 费米能级（作图对齐零点用）
grep Fermi cp2k.out`,
            note: "自旋向上/向下两个文件一起喂给脚本，出来的是两列，正好画自旋分辨的 DOS。"
          },
          { type: "p", text: "读图时有四个坑最常见，先记住再看曲线：展宽调大峰变矮变宽，峰高不能跨图比较；两张图放一起时能量零点必须一起对齐（都对齐费米能级，或者都不对齐）；带边处曲线被硬生生截断，说明 `NLUMO` 不够；金属体系没开 `&SMEAR`，费米能级附近的占据会震荡。" },
          {
            type: "table",
            head: ["现象", "说明什么", "怎么用"],
            rows: [
              ["费米能级处 DOS 不为零", "金属性电子结构", "需要 `&SMEAR`，比较时要固定电子温度"],
              ["带隙中冒出小峰", "缺陷态或表面态", "配 ELF / 自旋密度定位是哪个原子"],
              ["吸附后分子峰变宽、位置移动", "与表面杂化、电荷转移", "对照差分电荷密度互相验证"],
              ["两个自旋通道不对称", "自旋极化", "磁性中心、单原子催化剂的指纹"]
            ],
            caption: "四种最常见读法。峰位对比时两边的展宽与零点必须一致。"
          },
          { type: "p", text: "讲义给的几个案例正好覆盖这些读法：CeO2 上的 Au，看 O–Au 的态密度重叠判断共价作用，同时 Ce 4f 的空轨道位置解释电子转移；TiO2 里的 Al 缺陷，带隙中多出的态对应多余空穴停在表面 O 上；GaN 表面的配位不饱和原子，在带隙里长出表面态，和体相 DOS 一比就出来。这些结论都不靠单张图，而是 PDOS 加电荷、加 ELF 多条证据指向同一件事。" },
          { type: "callout", kind: "warn", title: "展宽不能替代 k 点", text: "DOS 是布里渊区积分的结果。slab 体系 z 方向周期很长，k 网格第三维取 1；面内要密到能分辨费米面附近的细节（几×几×1，具体值做收敛测试）。Gamma 点一个 k 点算出来的「DOS」，本质是离散能级的展宽，只能定性看峰的位置。" },
          { type: "keypoints", items: ["`&PDOS`/`&LDOS` 现在收在 `&DOS` 里，老写法会报未知段", "画带边必须给 `NLUMO`，默认 0 时导带侧是空的", "峰高受展宽控制，跨图比较前先对齐零点与宽度", "金属开 `&SMEAR`，slab 的 k 网格第三维取 1"] }
        ]
      },
      {
        id: "14.6",
        title: "ELF：把成键画成一张定域图",
        blocks: [
          { type: "p", text: "电子定域化函数（electron localization function, ELF）取值在 0 到 1 之间，衡量实空间中电子定域的强弱：接近 1 表示电子高度定域，接近 0 表示接近均匀电子气。经验判据很好用——`ELF > 0.5` 的区域就是共价键、孤对电子、内层电子或多中心键出现的地方。" },
          { type: "p", text: "ELF 比分子轨道省事：轨道有相位、有任意线性组合的问题，画出来还得解释「这条轨道代表什么」；ELF 是密度的泛函，与占据态一一对应，颜色深的地方就是电子待着的地方。代价是它不区分具体是哪个轨道贡献的，要回答「是 d 还是 p」还得回 PDOS。" },
          {
            type: "code",
            lang: "cp2k",
            title: "输出 ELF（放进 &DFT 的 &PRINT）",
            text: `&PRINT
  &ELF_CUBE
    FILENAME elf
    STRIDE 1 1 1
  &END ELF_CUBE
&END PRINT`,
            note: "`STRIDE` 对 ELF 尤其敏感：`2 2 2` 会把细窄的键区采样掉，ELF 建议直接用 `1 1 1`。`DENSITY_CUTOFF`（默认 1e-10）控制密度低于阈值处的处理，真空区本来就没有定域信息，画图时把它调高一点能少掉一片噪声。"
          },
          { type: "p", text: "文件名是 `cp2k-elf-ELF_S1-1_0.cube`，自旋极化体系还有 `ELF_S2`，两个通道分开看：磁性体系里自旋向上的电子和自旋向下的电子定域位置可能不同，这正是解释磁耦合的线索。VESTA 里按 `0.5` 到 `0.9` 调等值面，先把「有键的地方」滤出来，再往上调看核心区。" },
          { type: "h3", text: "四种典型读法" },
          { type: "list", items: [
            "**共价键**：两核之间有连成一片的高 ELF 区（> 0.5），形状沿键轴拉长。",
            "**孤对电子**：原子外侧鼓出一个瓣，不指向任何邻居，典型如水、氨、表面氧。",
            "**多中心键**：三个以上原子中间出现连通的定域区，形状像个三角或笼。",
            "**离子键 / 电子化合物**：原子之间 ELF 很低（≈ 0），电子要么回到核附近，要么停在没有核的空腔里。"
          ] },
          { type: "p", text: "讲义里的四个例子正好把这四类各占一个：CeO2 上 H2 异裂的过渡态，O–H 之间 ELF 高说明共价成分大，Ce–H 之间发蓝说明离子性强；FeB6 二维材料中间三个 B 之间变红，提示三中心键，Fe–B 之间偏蓝说明 Fe 呈离子态；Na2He 是电子化合物，电子对在晶体里不依赖原子核孤立存在，ELF 上是一个游离的高定域区；ZrO2、HfO2、ThO2 表面氧空位把一对电子局域在空穴位置，也在 ELF 上看得一清二楚。" },
          { type: "callout", kind: "tip", title: "ELF 与 PDOS 分工", text: "问「键在哪里、是共价还是离子」用 ELF；问「是哪个轨道、哪个原子的参与」用 PDOS。同一份结果里两条证据一致，结论就站得住：比如 Ce–H 的 ELF 发蓝（离子性）配 Ce 4f 的空轨道位置（电荷转移去向），是同一物理图像的两个侧面。" },
          { type: "callout", kind: "warn", title: "等值面数值决定你看到的故事", text: "ELF 的等值面阈值没有「标准答案」，0.5、0.7、0.85 会给出不同的拓扑。图注里必须写清阈值，并且同一篇工作里所有 ELF 图用同一个阈值，否则两张图没法互相比较。" },
          { type: "keypoints", items: ["ELF ∈ [0,1]，`> 0.5` 是成键/孤对电子的位置", "ELF 建议 `STRIDE 1 1 1`，粗采样会切掉细键区", "共价看连通、离子看空隙、多中心看三角连通", "图注写清等值面阈值，全文统一"] }
        ]
      },
      {
        id: "14.7",
        title: "分子轨道：只看费米能级附近几条",
        blocks: [
          { type: "p", text: "分子轨道 cube 用来画能级图与轨道形状，回答「这条带/这个峰是哪个轨道」。`&MO_CUBES` 的 `NHOMO` 与 `NLUMO` 控制输出哪几条：`NHOMO` 往下数几条占据轨道（`-1` 是全输出），`NLUMO` 往上数几条空轨道。" },
          { type: "p", text: "这两个关键词的默认值容易踩坑：`NHOMO` 默认 1、`NLUMO` 默认 0。想让导带最小那几条也出来，必须显式写 `NLUMO 3`；只想看价带顶，`NHOMO 3` 配 `NLUMO 0` 就够。" },
          {
            type: "code",
            lang: "cp2k",
            title: "轨道能级 + 轨道 cube（放进 &DFT 的 &PRINT）",
            text: `&PRINT
  &MO
    ENERGIES .TRUE.
    OCCUPATION_NUMBERS .TRUE.
    NDIGITS 6
  &END MO
  &MO_CUBES
    NHOMO 3
    NLUMO 3
    FILENAME MO
    STRIDE 1 1 1
    MAX_FILE_SIZE_MB 200
  &END MO_CUBES
&END PRINT`,
            note: "`&MO` 只往日志里打印本征值与占据数，用来画能级图；`&MO_CUBES` 才是写文件的那个。`MAX_FILE_SIZE_MB` 保证单文件不失控。"
          },
          { type: "p", text: "cube 文件名是 `cp2k-MO-WFN_00001_1-1_0.cube` 这种：`WFN` 后面是轨道号，`1-1_0` 是自旋通道与迭代号。轨道号与 `&MO` 打印出来的本征值一一对应，对照着看就知道哪张图对应哪个能级。VMD 里导入 cube、按等值面着色，同一组阈值下比较几条轨道的空间分布。" },
          { type: "p", text: "分子体系要画完整的能级图，还可以用 `&MO_MOLDEN` 一次导出全部本征值与系数（文本格式，带轨道对称性标签），交给 Molden 或 Chemcraft 排版；周期体系要用 `&MO_KP`，`&MO_MOLDEN` 只支持 Gamma 点。挑工具的原则简单：要图片看 cube，要能级表看 `&MO` 与 MOLDEN，要程序化后处理看 TREXIO。" },
          { type: "callout", kind: "danger", title: "别用 `-1` 全输出", text: "一个几百原子的金属 slab 有上千条轨道，`NHOMO -1` 加 `NLUMO -1` 会生成上千个 cube 文件、占满磁盘、VMD 也打不开。正确做法是先看 `&MO` 打印的本征值，定位费米能级上下各两三条，再单独跑一次只输出这几条。" },
          { type: "callout", kind: "info", title: "轨道图能说明的与不能说明的", text: "`&MO` 的本征值是一粒子的 Kohn-Sham 能级，不能直接当电离能、激发能或带隙来引用（带隙要取所有 k 点与自旋的价带顶、导带底，还可能是间接的）。轨道图适合讲「这条带的成分与空间分布」，能量位置请回 DOS 与能带图。" },
          { type: "keypoints", items: ["`NHOMO` 默认 1、`NLUMO` 默认 0，看空带必须显式写", "`&MO` 打能级表，`&MO_CUBES` 写 cube，两者配合看", "Gamma 点用 `&MO_MOLDEN`，周期体系用 `&MO_KP`", "只输出费米能级附近几条，别用 `-1` 全出"] }
        ]
      },
      {
        id: "14.8",
        title: "静电势与功函数：从真空平台读材料性质",
        blocks: [
          { type: "p", text: "哈特里势 cube（`&V_HARTREE_CUBE`）给出的是 r 处单位点电荷与体系的静电相互作用势：靠近原子核是很大的负值，进到真空里趋于 0。它的两个用途都很实用——给分子/表面做静电势着色，看亲电亲核位点；沿表面法向做平面平均，读出真空能级，再算功函数。" },
          { type: "p", text: "功函数的定义是「把一个电子从固体表面拽出来所需的最小能量」，计算上就是真空能级减费米能级。注意它不是体相的本征性质，而是**表面的性质**：暴露哪个晶面、表面吸附了什么，都会改变它。" },
          {
            type: "code",
            lang: "cp2k",
            title: "静电势 cube + 平面平均 + 偶极校正",
            text: `&FORCE_EVAL
  &DFT
    SURFACE_DIPOLE_CORRECTION T
    SURF_DIP_DIR Z
    &PLANAR_AVERAGED_V_HARTREE ON
      PARALLEL_PLANE XY
    &END PLANAR_AVERAGED_V_HARTREE
    &PRINT
      &V_HARTREE_CUBE
        FILENAME hartree
        STRIDE 1 1 1
      &END V_HARTREE_CUBE
    &END PRINT
  &END DFT
&END FORCE_EVAL`,
            note: "`SURF_DIP_DIR` 默认就是 Z，显式写出来更清楚。`&PLANAR_AVERAGED_V_HARTREE` 直接在 `&DFT` 下（不在 `&PRINT` 里），`PARALLEL_PLANE` 取 XY 表示表面平行于 xy 平面、沿 z 平均。"
          },
          { type: "formula", tex: "\\Phi = E_{vac} - E_{F}", caption: "功函数等于真空能级减费米能级，单位 eV。" },
          { type: "steps", items: [
            { t: "跑 slab 单点", d: "slab 上下留足真空（十几 Å 起），开 `SURFACE_DIPOLE_CORRECTION`，输出 V_HARTREE cube。" },
            { t: "沿法向平均", d: "用 cube.py 做平面平均，或者直接读 `&PLANAR_AVERAGED_V_HARTREE` 打在日志里的数据。" },
            { t: "读真空平台", d: "曲线在真空区应该走平，取那段平台的值作为真空能级；上下两个平台不等高说明表面不对称。" },
            { t: "读费米能级", d: "`grep Fermi cp2k.out`，或者从 pdos 文件头部读。" },
            { t: "算功函数", d: "两者相减再乘 27.2114 换算成 eV，图注写明晶面、覆盖度与是否做了偶极校正。" }
          ] },
          {
            type: "code",
            lang: "bash",
            title: "从一个真实算例读真空平台与费米能级",
            text: `# 1) 费米能级
grep Fermi cp2k.out

# 2) 平面平均：沿 z 展开的一维曲线
python ./cube.py cp2k-hartree-v_hartree-1_0.cube

# 3) 讲义算例（原子单位）
#    真空平台  Evac = 0.3158
#    费米能级  EF   = 0.12242
#    0.3158 - 0.12242 = 0.19338 a.u.
#    0.19338 * 27.2114 = 5.26 eV`,
            note: "真空层静电势不平，说明 slab 上下表面不对称，这个 5.26 eV 里就混着一个人为的偶极场。"
          },
          { type: "p", text: "讲义这个算例值得反复看：真空平台 0.3158 a.u.、费米能级 0.12242 a.u.，相减 0.19338 a.u.，乘 27.2114 得到 5.26 eV。同一页还提醒了一句关键的话——真空层的静电势如果走不平，说明 slab 上下表面不对称，这时要么做偶极校正（`SURFACE_DIPOLE_CORRECTION T` 配 `SURF_DIP_DIR Z`），要么构造对称 slab，否则算出来的功函数里混着人为偶极场。" },
          { type: "p", text: "静电势还能用来做能带对齐。两种材料接触后各自的真空平台有高低差，电子从平台高的一侧流向低的一侧。讲义举的例子是 TiO2/g-C3N4 异质结，两侧功函数分别 5.22 eV 与 6.43 eV，据此判断电子从 g-C3N4 流向 TiO2，这个结论与差分电荷密度给出的方向一致——两条独立证据指向同一物理图像，比任何单张图都可靠。" },
          { type: "callout", kind: "danger", title: "VESTA 着色的两个数", text: "在 VESTA 里给结构表面着色，用的是**电子密度**的等值面（凝聚相从 `0.002 e/Bohr³` 起，讲义里写作 `0.002` 的原子单位值），颜色映射的才是哈特里势 cube。把两个文件的角色弄反，出来的是噪声。顺序是：先导入电子密度 cube 定晶格与等值面，再用 surface coloring 载入 v_hartree cube。" },
          {
            type: "table",
            head: ["想做的判断", "看哪个量", "判据"],
            rows: [
              ["表面电子往哪跑", "静电势平台高低 + 差分电荷", "电子从平台高流向平台低，与差分正负一致"],
              ["亲电/亲核位点", "范德华表面静电势着色", "偏红易受亲电进攻，偏蓝易受亲核进攻"],
              ["功函数是否可信", "真空区平台是否走平", "不平就做偶极校正或换对称 slab"],
              ["异质结能带对齐", "两侧真空平台差", "差值对应内建电场方向，与电荷转移互证"]
            ],
            caption: "静电势的四种用法。前两条看三维分布，后两条必须回一维平面平均曲线。"
          },
          { type: "callout", kind: "key", title: "这一章的最小交付清单", text: "一次单点至少要留下三样东西：电子密度 cube（后续差分、Bader、着色都靠它）、布居文件（`&MULLIKEN`/`&LOWDIN`/`&HIRSHFELD` 之一并写明方法）、PDOS 文件（含费米能级那一行）。表面体系再加真空平台与功函数。有这四样，成键、电荷转移、态分布、表面性质四条故事线都能讲完。" },
          { type: "keypoints", items: ["`&V_HARTREE_CUBE` 给静电势，真空里趋于 0", "功函数 = 真空平台 − 费米能级，乘 27.2114 得 eV", "真空平台不平就先做偶极校正或换对称 slab", "着色用电子密度定表面、用哈特里势上色，别弄反"] }
        ]
      }
    ],
    quiz: [
      {
        q: "`&E_DENSITY_CUBE` 的 `STRIDE` 从默认的 `2 2 2` 改成 `1 1 1`，最直接的变化是什么？",
        options: [
          "格点数变成八倍，文件更大、等值面更平滑",
          "格点数变成八分之一，文件更小、等值面更粗糙",
          "只改变文件名，格点数不变",
          "只影响自旋密度，不影响电子密度"
        ],
        answer: 0,
        explain: "STRIDE 是每个方向的抽样步长。默认 `2 2 2` 每个方向隔一个取一个，格点数降到约八分之一；`1 1 1` 取全部格点，体积约八倍，等值面更精细。"
      },
      {
        q: "做片段相减的差分电荷密度时，下面哪一项是必须保证的？",
        options: [
          "三个片段各自重新优化，保证能量最低",
          "三个单点的盒子、截断、基组与泛函逐行一致，片段只删原子",
          "三个单点用不同的 CUTOFF，谁的精度高用谁",
          "把每个片段重新居中到盒子中央，方便比较"
        ],
        answer: 1,
        explain: "差分的前提是三次计算除了原子列表以外完全相同。片段重新优化会换成不同几何构型，重新居中会让格点错位，截断/基组不一致会引入基函数差异——三种都会伪装成电荷转移。"
      },
      {
        q: "用 Bader 程序算净电荷时，公式里的「价电子数」应该取什么？",
        options: [
          "元素周期表上的总电子数",
          "体系的总电子数除以原子数",
          "Mulliken 布居给出的电子数",
          "该原子 `&KIND` 里所用赝势的 q 值"
        ],
        answer: 3,
        explain: "Bader 的盆里装的是价电子密度对应的电子数，所以净电荷等于赝势 q 值减去 ACF.dat 里的盆内电子数。讲义例子：Ni 用 q18，18 − 17.94 = +0.06。"
      },
      {
        q: "画 PDOS 时导带一侧是空的，最可能的原因是什么？",
        options: [
          "没有开 `&SMEAR`",
          "`NLUMO` 用了默认值 0，空轨道没被算出来",
          "`DELTA_E` 设得太小",
          "没有做偶极校正"
        ],
        answer: 1,
        explain: "`&DOS` 的 `NLUMO` 默认 0，只输出占据态。要画带边与导带必须写 `NLUMO -1` 或一个具体条数。`&SMEAR` 影响的是金属体系的占据处理，不是空轨道有无。"
      },
      {
        q: "功函数算出来偏大，发现真空中静电势曲线没有走平，正确的下一步是什么？",
        options: [
          "把 `STRIDE` 改成 `1 1 1` 重算",
          "加大 `CUTOFF` 提高精度",
          "检查 slab 是否上下不对称：做偶极校正或换对称 slab",
          "改用 Bader 电荷重新算一遍"
        ],
        answer: 2,
        explain: "真空区静电势不平说明 slab 上下表面不等价，存在净偶极，真空能级本身不确定。这时要么开 `SURFACE_DIPOLE_CORRECTION` 配 `SURF_DIP_DIR`，要么构造上下对称的 slab，否则功函数里混着人为偶极场。"
      }
    ],
    terms: [
      { t: "cube 文件", en: "Gaussian cube file", d: "三维格点数据的文本格式：先给原点、格点数与三个格矢量，再给每个格点上的标量值。CP2K 的密度、ELF、轨道、静电势都以它输出，单位是原子单位。" },
      { t: "差分电荷密度", en: "charge density difference", d: "复合体系密度减去各片段密度之和，用来显示相互作用引起的电子重排；另一种定义是形变密度（SCF 密度减原子球对称密度之和）。" },
      { t: "Bader 电荷", en: "Bader / AIM charge", d: "按电子密度零通量面把空间切成原子盆，净电荷等于赝势价电子数减去盆内电子数。CP2K 不自带，需要用 Henkelman 组的 bader 程序处理 cube。" },
      { t: "投影态密度", en: "projected density of states (PDOS)", d: "把每个能级按原子种类或角动量投影后得到的态密度，用来看「哪个原子的哪个轨道」贡献了费米能级附近的态。" },
      { t: "电子定域化函数", en: "electron localization function (ELF)", d: "取值 0 到 1 的实空间函数，衡量电子定域程度；大于 0.5 的区域对应共价键、孤对电子、内层电子与多中心键。" },
      { t: "功函数", en: "work function", d: "把一个电子从固体表面移到真空所需的最小能量，计算上是真空能级减费米能级。它是表面性质，随晶面与吸附状态变化。" },
      { t: "真空能级", en: "vacuum level", d: "真空区静电势的平台值。slab 上下不对称时两侧平台不等高，需要做偶极校正后再读。" },
      { t: "平面平均", en: "planar average", d: "把某个平面内的格点值做平均，只留一个方向的一维曲线。用来把三维密度/静电势压成能直接读数的剖面。" }
    ],
    sources: [
      { t: "Density of States（手册）", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/dos.html" },
      { t: "Population and atomic charges（手册）", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/population/index.html" },
      { t: "Molecular orbitals output（手册）", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/molecular_orbitals.html" },
      { t: "E_DENSITY_CUBE 关键词（手册）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/PRINT/E_DENSITY_CUBE.html" },
      { t: "PLANAR_AVERAGED_V_HARTREE（手册）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/PLANAR_AVERAGED_V_HARTREE.html" }
    ]
  };
})();