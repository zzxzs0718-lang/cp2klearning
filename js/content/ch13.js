(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch13"] = {
    id: "ch13", num: 13, part: "分析与实战",
    title: "轨迹与电子结构分析",
    subtitle: "从 cp2k.out、cp2k-pos-1.xyz 和 cube 文件里，把数字变成图",
    hours: 6.0, level: "高级",
    intro: "算完不算完。一次 AIMD 跑完，磁盘上留下的是几万帧坐标、一个 .ener 文件、几个 cube 文件，而论文要的是 RDF 曲线、扩散系数、差分电荷密度和态密度图。本章讲的就是中间这一段：**哪些文件对应哪个物理量、用什么命令把它取出来、取出来之后怎么判断结果可信**。全部示例来自「庚子计算 CP2K 课程」的练习文件与讲义（Au-H2O、cuh2o、Au-TiO2 三个体系），不是官方教程；数值能引用的都注明出处，没有把握的地方会说明判断方法而不是给一个数字。",
    goals: [
      "分清 cp2k-pos-1.xyz、cp2k-1.ener、cp2k-1.restart、cube 文件各自承载什么信息",
      "会用 cp2k2gro.py 把轨迹转成 gro，交给 VMD / GROMACS / TRAVIS 做后处理",
      "能从轨迹算出径向分布函数、配位数、均方位移与扩散系数，并说清拟合区间怎么选",
      "会输出电荷密度、差分电荷密度、ELF、分子轨道、静电势 cube，并从中读出功函数",
      "理解 Mulliken / Hirshfeld / Löwdin / Bader 原子电荷的差别，知道哪些数可以比、哪些不能比"
    ],
    sections: [
      {
        id: "13.1", title: "分析地图：从输出文件到一张图",
        blocks: [
          { type: "p", text: "CP2K 的分析工作可以分成两条互不干扰的线。**第一条是轨迹线**：MD 跑完得到坐标随时间的演化，问的是结构问题——水在表面怎么排、氢键网络什么样、分子扩散多快。**第二条是电子结构线**：对某个（或某几个）结构做单点，输出电荷密度、轨道、态密度，问的是电子问题——电荷往哪转移、键是什么性质、功函数多大。" },
          { type: "p", text: "两条线的入口不同：轨迹线的入口是 `cp2k-pos-1.xyz`，电子结构线的入口是 `&PRINT` 段里那几个 cube / pdos / mulliken 子段。出口也不同：轨迹线通常走向 TRAVIS、GROMACS、VMD；电子结构线走向 VESTA、Origin。中间那一步「把文件变成能画的数据」，才是最容易卡住的地方。" },
          {
            type: "table",
            caption: "一次 MD 计算会留下的文件，以及它们各自能回答什么",
            head: ["文件", "内容", "用途"],
            rows: [
              ["cp2k-pos-1.xyz", "每帧原子数 + 注释行（步号、时间、能量）+ 坐标", "轨迹分析的总入口：RDF、MSD、氢键、可视化"],
              ["cp2k-vel-1.xyz", "速度轨迹（Bohr/a.u. 时间）", "振动谱、速度自相关；转 gro 时可一并带上"],
              ["cp2k-1.ener", "每步的动能、温度、势能、守恒量、耗时", "检查温度是否守住、能量是否漂移"],
              ["cp2k-1.cell", "每步晶胞（NPT 才有意义）", "转 gro 时给盒子；NVT 用固定 CELL 文件即可"],
              ["cp2k-1.restart", "可直接续算的完整输入", "断点续算的起点"],
              ["cp2k-RESTART.wfn", "波函数/密度矩阵", "续算时跳过 SCF 初猜"],
              ["cp2k-cube-ELECTRON_DENSITY-1_0.cube", "电子密度（格点）", "差分密度、Bader 电荷、范德华表面着色"],
              ["cp2k-hartree-v_hartree-1_0.cube", "静电势（格点）", "功函数、异质结能带对齐"],
              ["cp2k-elf-ELF_S1-1_0.cube", "电子定域化函数", "成键性质、孤对电子、多中心键"],
              ["cp2k-ALPHA_k1-1.pdos", "按原子/角动量投影的态密度", "分析杂化与电荷转移"],
              ["cp2k-Mulliken-1.mulliken", "Mulliken 原子电荷", "同一方法内部的电荷趋势比较"]
            ]
          },
          { type: "h3", text: "一条稳定的六步流程" },
          {
            type: "steps",
            items: [
              { t: "先看 .ener 和 out", d: "温度曲线是否绕着设定值波动、SCF 是否每步都收敛、有没有 WARNING。这一步不通过，后面的图都不用画。" },
              { t: "确认轨迹完整", d: "原子数 × 帧数 + 2 × 帧数 应等于文件行数；末帧时间要等于 STEPS × TIMESTEP（课程 Au-H2O 是 100000 × 0.5 fs，末帧 time = 2151 fs，说明中途有重启接续）。" },
              { t: "丢掉预热段", d: "课程讲义的做法是分析时丢掉前 1/3 轨迹，只统计平衡后的部分。" },
              { t: "选工具", d: "RDF、MSD、振动谱优先 TRAVIS；需要 GROMACS 的分析命令就先转 gro；纯几何统计可以写几十行 Python。" },
              { t: "单点补电子结构", d: "取一帧代表性结构（不是第一帧），在同一套泛函/基组/截断下做单点，输出 cube 与 pdos。" },
              { t: "核对量纲", d: "cube 里是原子单位，gro 里是 nm，pdos 的能量是 a.u.，MD 时间是 fs。混用单位是这类分析最常见的错误来源。" }
            ]
          },
          { type: "demo", id: "units" },
          { type: "callout", kind: "note", title: "本章的数据来源", text: "轨迹、RDF/RMSD 曲线、电荷密度设置均取自「庚子计算 CP2K 课程」练习目录（`练习/Au-H2O`、`练习/Au-TiO2`、`练习/cuh2o`）与其讲义；手册页作为关键词依据。个案数值只代表那套设置，不是普适推荐值。" }
        ]
      },
      {
        id: "13.2", title: "轨迹文件：xyz 的结构与格式转换",
        blocks: [
          { type: "p", text: "`cp2k-pos-1.xyz` 是标准扩展 XYZ：第一行原子数，第二行注释，之后每行一个原子。注释行不是装饰，很多后处理脚本（包括课程里的 `zdistr.py`、`cp2k2gro.py`）都从里面读时间。CP2K 的注释行长这样：`i = 4302, time = 2151.000, E = -3366.8465934426`——按空格切开后第 6 个字段是时间（`2151.000,`），带一个逗号，脚本用 `float(info[5].strip(','))` 去掉那个逗号。" },
          {
            type: "code", lang: "bash", title: "先确认文件结构：头四行 + 能量列",
            text: `head -4 cp2k-pos-1.xyz
# 198                        <- 原子数
# i = 0, time = 0.000, E = -3365.7933150126
# H  8.6700000000  2.3300000000 20.5000000000
# ...

head -3 cp2k-1.ener
# Step Nr. Time[fs] Kin.[a.u.] Temp[K] Pot.[a.u.] Cons Qty[a.u.] UsedTime[s]
#     0      0.000000    0.000000000   330.000     -3365.793315   ...
#     1      0.500000    0.031234567   329.980     -3365.793421   ...`
          },
          { type: "p", text: "`.ener` 的列顺序在 CP2K 里是固定的：步号、时间（fs）、动能（a.u.）、温度（K）、势能（a.u.）、守恒量（a.u.）、本步耗时（s）。NVT 下守恒量一列会因为恒温器注采能量而**不严格守恒**，所以看漂移要看势能加动能的总和，而不是只看 Cons Qty。Au-TiO2 那份 `cp2k-1.ener` 的首行表头就是这一串列名，首步温度正好是 600.000000000 K——那是初始速度按设定温度生成的结果。" },
          { type: "h3", text: "转成 gro：交给 GROMACS 和 VMD" },
          { type: "p", text: "VMD 能直接读 xyz，但盒子信息要靠 pbc set 手动给；GROMACS 的分析工具（`gmx rdf`、`gmx msd`、`gmx hbond`）只认 trr/xtc/gro。课程包里附的 `cp2k2gro.py` 就是干这件事的：读 xyz 与晶胞，逐帧写 gro（坐标除以 10 变成 nm，时间除以 1000 变成 ps）。" },
          {
            type: "code", lang: "bash", title: "转轨迹（NVT 用 CELL 文件，NPT 用 cp2k-1.cell）",
            text: `# NVT：把盒子写进 CELL（两行：A B C / ALPHA BETA GAMMA，单位 Å）
# 8.6507 9.9899 31.000
# 90.0 90.0 90.0

python cp2k2gro.py -x cp2k-pos-1.xyz -c CELL -f au_h2o.gro
# 有速度轨迹时一并转换（速度按 Bohr/a.u. 时间读入）
python cp2k2gro.py -x cp2k-pos-1.xyz -v cp2k-vel-1.xyz -c CELL -f au_h2o.gro

# 之后就可以用 GROMACS 的分析命令（选择组用 selection 语法指定）
gmx rdf -f au_h2o.gro -s au_h2o.tpr \\
        -ref "name Au" -sel "resname SOL" -o rdf_au_o.xvg`
          },
          { type: "callout", kind: "warn", title: "脚本附带的 mdp/top 不能直接用来做模拟", text: "`cp2k2gro.py -a` 会顺手生成 `.mdp` 和 `.top`，但脚本自己在 top 文件开头写了 `WARNING, it cannot be used for a simulation.` 这句——它的用途是让 `grompp` 能跑通、把 gro 包成一个 tpr，方便用 GROMACS 的分析工具；真做 MM 模拟必须换成自己的力场参数。" },
          { type: "p", text: "工具箱的分工建议：**VMD** 看轨迹、做氢键和距离测量；**OVITO** 看大体系的配位环境与多面体；**GROMACS** 做定量分析（rdf/msd/hbond，命令成熟、有现成教程）；**TRAVIS** 做与 CP2K 配套的光谱与统计（专门为 CP2K 的 MD 设计）；**Origin** 画最终曲线。" }
        ]
      },
      {
        id: "13.3", title: "径向分布函数与配位数",
        blocks: [
          { type: "p", text: "径向分布函数 g(r) 回答的是「以某个原子为中心，半径 r 到 r+dr 的球壳里，找到另一类原子的概率是均匀分布的多少倍」。均匀分布时 g(r)=1；第一峰的位置就是最近邻距离，峰的尖锐程度说明结构有序程度，长程趋于 1 说明液体失去了长程序。" },
          { type: "p", text: "算 g(r) 需要三样东西：**成对的定义**（哪些原子算中心、哪些算邻居）、**密度归一化**（体相用 N/V，slab 体系只算吸附层区域，别把真空层算进体积）、**方向处理**（表面体系要区分面内与本征法向）。第三点最容易被忽略：把 slab 当成各向同性液体去算，得到的 g(r) 会被真空层稀释。" },
          { type: "p", text: "课程练习里 Au-TiO2 的 `rdf/` 目录给了一组成品曲线，五条分别是 Au–Au、Au–Au（界面处）、Au–O、Au–Ti、Ti–O。数据格式很朴素：两列，第一列距离、第二列 g(r)，从 0.01 Å 起、步长 0.02 Å，前几行 g(r)=0 那段对应「比最近邻还近，不可能有原子」。这套曲线是用后处理脚本从轨迹里统计出来的（同目录还放着 Origin 工程文件 `UNTITLED.opj`），不是 CP2K 内置打印的。" },
          {
            type: "code", lang: "bash", title: "两条可用路线：TRAVIS 交互式，或课程自带的 Python 脚本",
            text: `# 路线一：TRAVIS（专门为 CP2K 轨迹写的后处理程序）
travis -p cp2k-pos-1.xyz
#   交互式选择要算的量（rdf / msd / 光谱等），再指定帧间隔
#   （0.5 fs 的轨迹取每一帧；文件大时可以每隔几帧取一帧）
#   输出可直接进 Origin 的 csv

# 路线二：课程脚本，按帧抽取某个元素的 z 坐标（做密度分布/层间分布）
python zdistr.py cp2k-pos-1.xyz O     # 生成 distance-O.xyz
python zdistr.py cp2k-pos-1.xyz H     # 生成 distance-H.xyz`
          },
          { type: "p", text: "配位数是把 g(r) 积分到第一峰后的第一个极小值：`n = 4πρ ∫ r² g(r) dr`，其中 ρ 是邻居原子的数密度。手工做的时候注意三点：积分上限取**第一极小**而不是峰顶；ρ 要用同一区域的数密度；表面体系最好先按层切片再积分，否则第一层水的配位数会被第二层污染。" },
          {
            type: "table",
            caption: "看 g(r) 曲线时先问这四个问题",
            head: ["观察到的现象", "物理含义", "常见误判"],
            rows: [
              ["第一峰位置 2.8 Å 左右", "O–O 最近邻距离（氢键）", "把 H–O 峰当成 O–O 峰——先确认元素对"],
              ["第一峰很高、第二峰清晰", "结构有序，接近固体/刚性溶剂化层", "峰高受统计帧数和 bin 宽度影响，不同设置不可直接比"],
              ["g(r) 长时间不为 1", "归一化密度取错，或体系没达到平衡", "把未平衡段算进去，导致平台偏移"],
              ["表面附近 g(r) 明显被压低", "真空层被算进体积，密度被稀释", "改用切片后的局部密度"]
            ]
          },
          { type: "callout", kind: "tip", title: "统计量先问样本量", text: "g(r) 是系综平均，帧数太少时峰高会随取样抖动。判断方法很简单：把轨迹对半分，各算一次 g(r)，两条曲线在峰高上差多少，就知道你的误差棒有多长。讲义建议分析时丢掉前 1/3 轨迹，也是同一个道理——预热段的构型不代表平衡态。" }
        ]
      },
      {
        id: "13.4", title: "均方位移与扩散系数",
        blocks: [
          { type: "p", text: "均方位移 MSD 衡量的是「一个粒子从起点走了多远」：⟨|r(t) − r(0)|²⟩。在液体里，长时间极限下 MSD 对时间线性增长，斜率就是扩散系数。三维各向同性时用 6t 归一，二维（表面上的吸附层、膜内扩散）用 4t。" },
          { type: "formula", tex: "D = \\frac{\\Delta r^{2}}{6t}", caption: "Δr² 为均方位移；表面/膜内二维扩散把 6 换成 4，只统计面内分量时用 4t 并对 xy 求平均" },
          { type: "p", text: "**拟合区间是整个计算里最容易做错的一步**。MSD 曲线分三段：弹道段（很短，MSD ∝ t²）、线性段（真正的扩散）、平台段（被边界或吸附限制住）。只在线性段拟合，通常取曲线明显变直之后到开始弯曲之前。把平台段也塞进线性回归，斜率被拉平，扩散系数会被系统性低估；反过来只取前几个点，会落进弹道段，系数被高估。" },
          { type: "p", text: "课程 Au-TiO2 练习的 `rmsd/` 目录放的是另一类量：金团簇相对自身质心的位移随时间的变化，按时间窗分成 `multiplot-0/250/500/750/1000.dat` 五组，第一列是时间（fs）、第二列是位移（Å），首行 `4.0 0.0405`，之后 8.0 fs 对应 0.0791 Å、12.0 fs 对应 0.1147 Å。这条曲线的用途不是算扩散系数，而是判断**团簇在模拟过程中有没有整体漂移**：如果几条时间窗的曲线彼此重合，说明统计窗口选得合理；如果后段的曲线整体抬高，说明体系在慢慢跑掉，需要检查固定层和真空层。" },
          {
            type: "code", lang: "bash", title: "用 GROMACS 算 MSD（先按 13.2 转成 gro）",
            text: `# 选一组原子做 MSD；-mol 按分子统计，-rmcomm 去掉质心平动
gmx msd -f au_h2o.gro -s au_h2o.tpr -n index.ndx \\
        -sel "resname SOL" -mol -beginfit 5 -endfit 40 -o msd.xvg

# 只统计面内扩散时先投影到 xy：用 trjconv 去掉 z 向涨落再算
# 拟合区间由 -beginfit/-endfit（单位 ps）控制，先用默认值看曲线形状再调`
          },
          { type: "p", text: "CP2K 自己也能出 MSD：`&MOTION/&MD` 下的 `&REFTRAJ` 段可以做参考轨迹分析，其 `&MSD` 子段支持用 `DEFINE_REGION` 限定统计区域——这一条对 slab 上的水很有用，因为你不希望把真空层和固定层也算进去。具体子关键词随版本有差异，按手册页 `CP2K_INPUT/MOTION/MD/REFTRAJ/MSD` 填；日常更省事的做法仍是转 gro 交给 GROMACS，或者用 TRAVIS 的 msd 功能。" },
          { type: "callout", kind: "warn", title: "扩散系数对时间步长和恒温器敏感", text: "同一个体系换恒温器（Nose 与 CSVR）或换时间步，D 可以差百分之几到十几。报数时把温度、恒温器类型、拟合区间、统计的分子数一起写出来；只写一个 D 值，别人无法复现也无法判断可信度。" }
        ]
      },
      {
        id: "13.5", title: "电荷密度：cube 文件、差分与平面平均",
        blocks: [
          { type: "p", text: "电子密度 cube 是所有电子结构分析的原料：差分电荷密度、Bader 电荷、范德华表面着色，都从它出发。输出只需要**单点计算**，把 `&PRINT` 里对应子段打开即可。默认 `STRIDE 2 2 2`（每两个格点取一个），文件小、图粗；`STRIDE 1 1 1` 全格点输出，图细但文件大好几倍。" },
          {
            type: "code", lang: "cp2k", title: "输出电子密度（放在 &FORCE_EVAL/&DFT/&PRINT 下）",
            text: `&FORCE_EVAL
  &DFT
    &PRINT
      &E_DENSITY_CUBE
        FILENAME cube
        STRIDE 1 1 1
      &END E_DENSITY_CUBE
    &END PRINT
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "跑完得到两个文件：`cp2k-cube-ELECTRON_DENSITY-1_0.cube`（电荷密度）与 `cp2k-cube-SPIN_DENSITY-1_0.cube`（自旋密度）。后缀里的 `1_0` 是自旋通道与迭代号。自旋密度对磁性体系（含过渡金属、缺陷态）才看得出信息：课程讲义里的例子是 Au/CeO2(111) 与 H-TiO2，前者电子从 Au 转移到表面 Ce，后者电子从 H 转移到表面 Ti——图上出现的就是自旋密度在哪个原子上鼓包。" },
          { type: "h3", text: "差分电荷密度" },
          { type: "p", text: "差分有两种定义，用到的是不同的问题。**片段相减**回答「A 和 B 放在一起时电荷怎么重新分布」，**形变密度**回答「这个体系里每个原子成键后电子云怎么变形」。" },
          { type: "formula", tex: "\\Delta\\rho = \\rho_{AB} - \\rho_{A} - \\rho_{B}", caption: "片段相减：三次单点，几何结构完全相同，计算参数完全相同" },
          {
            type: "steps",
            items: [
              { t: "优化整体结构", d: "先对 AB 复合体系做几何优化，得到有意义的构型。" },
              { t: "截取片段", d: "从优化好的结构里直接删掉另一片段，**不要再优化**，保证原子位置与复合体系逐位对齐。" },
              { t: "三次单点", d: "AB、A、B 各算一次单点，泛函、基组、CUTOFF、盒子、k 点全部保持一致，各输出一个 cube。" },
              { t: "相减", d: "AB 的 cube 减去 A 和 B 的 cube。VESTA 里依次导入三个文件做减法，或用自带脚本处理格点数据。" }
            ]
          },
          { type: "p", text: "看三维等值面之外，**平面平均**往往更有说服力：把 xy 平面内的格点做平均，只留 z 方向的一维曲线，能量转移发生在哪一层一目了然。课程讲义给的做法是 `python ./cube.py <cube文件>`，三个 cube 各做一条线，相减就得到差分密度的平面平均曲线。" },
          {
            type: "code", lang: "bash", title: "平面平均与 Bader 预处理",
            text: `# 三个 cube 各做一次 XY 平面平均，得到沿 z 的一维密度曲线
python ./cube.py cp2k-cube-ELECTRON_DENSITY-1_0.cube

# VESTA 里看三维等值面：
#   1) 先导入 cp2k-cube-ELECTRON_DENSITY-1_0.cube（提供格点与晶胞）
#   2) 再导入另外两个片段 cube，用 Edit -> Edit Data -> Subtract 做减法
#   3) 等值面数值按体系大小调，一般从 ±0.002 e/Bohr^3 起试`
          },
          { type: "callout", kind: "warn", title: "差分图里混进基组误差的三种情况", text: "三次单点用了不同的盒子（片段单独算时缩小了 cell）、不同的 CUTOFF、或者片段没做鬼原子补偿——这三种都会让「差分」里混进基组重叠误差，看起来像电荷转移，其实只是基函数变了。做法是把三个计算的 cell 设成同一个（哪怕片段周围是空的），参数逐行一致，只在原子列表上做删减。" },
          { type: "callout", kind: "tip", title: "等值面的正负要成对看", text: "差分密度有正有负：正值表示该区域电子聚集，负值表示电子减少。只画一个符号的等值面，等于只看了一半故事。VESTA 里给正负分别设颜色（讲义常用红/蓝），并在图注里写清「红 = 增加，蓝 = 减少」。" }
        ]
      },
      {
        id: "13.6", title: "原子电荷：Mulliken、Hirshfeld、Löwdin 与 Bader",
        blocks: [
          { type: "p", text: "原子电荷的定义是「核电荷数减去分配给这个原子的电子数」。问题在于「分配」没有唯一答案：电子密度是连续分布的，把它切成原子的份额必须人为定规则。所以**不同方法给出的绝对值不可直接比较**，同一方法内部的趋势才是有意义的物理信息。" },
          { type: "p", text: "CP2K 内置三种，一次单点就能全部输出：Mulliken 按基函数归属划分（对基组敏感，弥散函数会带来布居数问题）；Löwdin 先把基函数正交化再划分；Hirshfeld 按自由的原子密度在空间中的比例划分（对基组不敏感，但绝对值偏小）。Bader 不在 CP2K 里，要用 Henkelman 组的独立程序对 cube 文件做后处理，按电子密度零通量面划分原子盆。" },
          {
            type: "code", lang: "cp2k", title: "三种内置原子电荷，一次单点全出",
            text: `&FORCE_EVAL
  &DFT
    &PRINT
      &MULLIKEN
        SILENT
        FILENAME Mulliken
      &END MULLIKEN
      &HIRSHFELD
        SILENT
        FILENAME hirshfeld
      &END HIRSHFELD
      &LOWDIN
        SILENT
        FILENAME lowdin
      &END LOWDIN
    &END PRINT
  &END DFT
&END FORCE_EVAL`
          },
          {
            type: "table",
            caption: "同一个 CO/Ni(100) 体系，四种方法给出的净电荷（单位 e，讲义原表）",
            head: ["方法", "Ni", "C", "O"],
            rows: [
              ["Bader（AIM）", "+0.06", "+1.64", "−1.86"],
              ["Löwdin", "−0.062", "+0.239", "+0.138"],
              ["Hirshfeld", "−0.630", "+0.947", "−0.240"],
              ["Mulliken", "−0.327", "+0.443", "−0.076"]
            ]
          },
          { type: "p", text: "这张表的重点不是哪个数「对」，而是四个方法连**符号**都不一致：Ni 在 Bader 下是 +0.06，在 Löwdin/Mulliken/Hirshfeld 下都是负的。原因在划分规则：Bader 按密度拓扑切盆，Ni 的 3d 电荷被算进自己的盆里就偏正；Mulliken/Löwdin 按基函数归属，Ni 的 d 轨道与 C/O 的基函数有重叠，重叠布居按一半一半分，方向就反过来了。写论文时的正确做法是：**只用一种方法画趋势图，在方法段注明用的是哪一种，绝不跨方法比较绝对值**。" },
          {
            type: "code", lang: "bash", title: "Bader 电荷：先出 cube，再用外部程序划分",
            text: `# 1) 单点计算，输出电子密度（见 13.5）
# 2) 用 Bader 程序读 cube，得到 ACF.dat / BCF.dat / AVF.dat
bader cp2k-cube-ELECTRON_DENSITY-1_0.cube

# 3) ACF.dat 里第 5 列是原子盆内的电子数
#    净电荷 = 价电子数 - 盆内电子数
#    讲义例子：Ni 用 q18 基组 -> 18 - 17.94 = +0.06 e
#              C  用 q4  基组 ->  4 - 2.36  = +1.64 e
#              O  用 q6  基组 ->  7.86 - 6  = -1.86 e

# 自旋布居同理：对自旋密度 cube 再跑一次 bader
bader cp2k-cube-SPIN_DENSITY-1_0.cube`
          },
          { type: "callout", kind: "warn", title: "价电子数要对上赝势", text: "净电荷 = 价电子数 − 盆内电子数，这个「价电子数」由赝势决定，不是元素周期表上的总电子数。Ni 用 `GTH-PBE-q18` 就是 18，换成 q10 就会算错 8 个电子。做 Bader 前先把 `&KIND` 里的赝势名确认一遍。" },
          { type: "callout", kind: "tip", title: "展宽体系下的 Mulliken 要谨慎", text: "开了 `&SMEAR` 之后轨道有分数占据，Mulliken 布居会把分数占据按权重摊到各原子上，数值随电子温度变化。金属体系做电荷分析时，优先用 Bader（基于总密度，与占据数无关），并把 `ELECTRONIC_TEMPERATURE` 固定住再比较。" }
        ]
      },
      {
        id: "13.7", title: "态密度与投影态密度",
        blocks: [
          { type: "p", text: "态密度 DOS 把「有多少个能级落在 E 到 E+dE 之间」画成曲线。它回答的是电子结构问题里最实用的几个：费米能级附近有没有态（金属还是绝缘体）、带隙多宽、吸附分子与表面的轨道在哪个能量区间重叠（杂化）。" },
          { type: "p", text: "两个前提必须满足。**金属/小带隙体系**要开 `&SMEAR`，否则分数占据无法处理、SCF 会震荡；**要画空带**就必须给 `ADDED_MOS`，因为 CP2K 默认只算占据轨道——空带数不够，费米能级以上就是空的，DOS 图在带边处会被硬生生截断。" },
          {
            type: "code", lang: "cp2k", title: "总 DOS 与按原子投影的 PDOS",
            text: `&FORCE_EVAL
  &DFT
    &PRINT
      &DOS
        &DOS
          NLUMO -1
        &END DOS
      &END DOS
      &PDOS
        NLUMO -1
        &LDOS
          LIST 1..26
        &END LDOS
      &END PDOS
    &END PRINT
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "`&LDOS` 的 `LIST` 把若干原子合并成一组投影输出，`1..26` 表示前 26 个原子一起算——分析吸附分子时通常把分子的一组原子、表面第一层的一组原子分别合并，避免几十条曲线糊在一起。每个原子组会生成 `cp2k-ALPHA_k1-1.pdos`、`cp2k-BETA_k1-1.pdos` 这样的文件（自旋向上/向下各一个）。" },
          { type: "p", text: "pdos 文件是纯文本，头部一行给出费米能与原子种类，之后每行是「轨道序号、本征值、占据数、s/p/d/f 投影」。讲义里给出的真实头部是 `# Projected DOS for atomic kind Ni1 at iteration step i = 0, E(Fermi) = 0.122425 a.u.`，列名是 `MO Eigenvalue [a.u.]  Occupation  s  p  d  f`。**费米能级就藏在这一行里**，也可以在 `cp2k.out` 里 `grep Fermi` 拿到。" },
          {
            type: "code", lang: "bash", title: "加高斯展宽后画图",
            text: `# 原始的 pdos 只有离散能级，画成曲线前要加展宽
# -s 0.01 是展宽宽度，具体单位以脚本内定义为准
python new.py -s 0.01 cp2k-ALPHA_k26-1.pdos cp2k-BETA_k26-1.pdos > dos.txt

# 费米能级（作图时对齐零点用）
grep Fermi cp2k.out`
          },
          {
            type: "table",
            caption: "DOS 图上的四种特征与它们的物理含义",
            head: ["特征", "含义", "在催化/材料里的用法"],
            rows: [
              ["费米能级处 DOS 不为零", "金属性", "判断体系是否需要用 SMEAR + 空带"],
              ["带隙中冒出小峰", "缺陷态或表面态", "定位多余电子/空穴落在哪个原子上"],
              ["吸附后分子峰变宽、位置移动", "与表面杂化、电荷转移", "解释活化（如 CO 的 5σ 与 2π* 变化）"],
              ["两个自旋通道不对称", "自旋极化", "磁性、单原子催化剂的电子结构分析"]
            ]
          },
          { type: "callout", kind: "warn", title: "DOS 图不能直接读「电子数」", text: "DOS 的绝对值依赖展宽宽度与能量 bin：展宽调大，峰变矮变宽，曲线下面积不变但峰高不能互比。两张 DOS 图要放在一起比较时，两边的 `NLUMO`、展宽、能量零点（是否对齐费米能级）必须一致，并在图注里写清。" },
          { type: "h3", text: "从 DOS 到能带：k 点与路径" },
          { type: "p", text: "DOS 是**对整个布里渊区积分**之后的结果，能带图是**沿一条路径**的本征值。两者信息互补：DOS 告诉你「有没有态、在什么能量」，能带告诉你「这些态怎么随 k 变化」——带隙是直接还是间接、有效质量大不大、表面态是不是落进带隙里，只能从能带图上看出来。" },
          { type: "p", text: "k 点的密度取决于你要的量。总能与小分子吸附能通常 2×2×1 到 4×4×1 就够（面内周期大，倒空间就小）；态密度与能带需要密得多的网格，因为要分辨费米面附近的细节。slab 体系的特点是 z 方向周期很长，所以 k 点网格的第三维取 1——这一点和体相计算完全不同。" },
          {
            type: "code", lang: "cp2k", title: "面内 k 点网格（&DFT 下的 &KPOINTS）",
            text: `&FORCE_EVAL
  &DFT
    &KPOINTS
      SCHEME MONKHORST-PACK 6 6 1
    &END KPOINTS
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "上面是自洽计算用的网格（Monkhorst-Pack，三维各给一个数）。画能带要另做一次非自洽计算：在 `&DFT/&PRINT` 里打开 `&BAND_STRUCTURE`，按高对称点给出路径（面内 2D 方格的常用路径是 Γ → M → K → Γ），程序沿路径取一串 k 点，输出每条带的本征值。**`&BAND_STRUCTURE` 的子关键词随版本有差异**，具体写法以手册的能带章节为准，但要点固定：先用密网格自洽拿到密度，再沿路径做非自洽。" },
          {
            type: "table",
            caption: "能带图上要读的四件事",
            head: ["看什么", "怎么读", "常见错误"],
            rows: [
              ["带隙类型", "价带顶与导带底是否在同一 k 点", "只看一个 k 点就断言直接带隙"],
              ["带隙宽度", "两段曲线的最小间距", "密度泛函低估带隙，别拿去和实验直接比"],
              ["能带弯曲程度", "弯曲越小有效质量越大", "坐标轴单位没换算，把 a.u. 当成 eV"],
              ["带隙中的平带", "缺陷态或表面态", "把 k 点不足造成的虚假平带当成真实表面态"]
            ]
          },
          { type: "p", text: "金属没有带隙，能带图的信息变成「哪条带穿过费米能级、在哪个方向色散强」——这直接对应导电与催化活性的各向异性。做金属表面时，路径选面内的 Γ → M → K → Γ 就够；沿 z 方向加路径对 slab 没意义，因为那个方向本来就是真空。" }
        ]
      },
      {
        id: "13.8", title: "ELF、分子轨道与静电势：成键性质与功函数",
        blocks: [
          { type: "p", text: "ELF（电子定域化函数）取值在 0 到 1 之间，衡量实空间中电子定域的强弱：ELF 接近 1 表示电子高度定域（共价键、孤对电子、内层电子、多中心键），接近 0 表示接近均匀电子气。经验判据是 **ELF > 0.5 的区域**就是成键或孤对电子的位置。它比分子轨道好用，因为轨道有相位和任意线性组合的问题，ELF 是密度泛函，与占据态一一对应。" },
          { type: "p", text: "分子轨道 cube 用来画能级图与轨道形状，`NHOMO`/`NLUMO` 控制输出哪几条。**一般不需要 `-1` 全输出**：一个 200 原子的金属 slab 动辄几百条轨道，每条一个 cube 文件、体积几十 MB 起。只输出费米能级上下几条就够说明问题。" },
          { type: "p", text: "静电势 cube 有两个用途：一是看分子表面的静电势分布（亲电/亲核位点），二是算功函数。功函数的定义是真空能级减费米能级：`Φ = E_vac − E_F`。做法是对 slab 的法向（通常 z）做平面平均，取真空区那段平台的平台值作为 E_vac，费米能级从 `grep Fermi cp2k.out` 或 pdos 头部读。" },
          {
            type: "code", lang: "cp2k", title: "ELF、选择性输出的分子轨道、静电势（同一个 &PRINT 里）",
            text: `&FORCE_EVAL
  &DFT
    SURFACE_DIPOLE_CORRECTION T
    SURF_DIP_DIR Z
    &PRINT
      &ELF_CUBE
        FILENAME elf
        STRIDE 1 1 1
      &END ELF_CUBE
      &MO_CUBES
        NHOMO 3
        NLUMO 3
        FILENAME MO
        STRIDE 1 1 1
      &END MO_CUBES
      &V_HARTREE_CUBE
        FILENAME hartree
        STRIDE 1 1 1
      &END V_HARTREE_CUBE
    &END PRINT
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "输出文件名分别是 `cp2k-elf-ELF_S1-1_0.cube`（自旋向上；自旋极化体系还有 `ELF_S2`）、`cp2k-MO-WFN_00001_1-1_0.cube`（轨道号 + 自旋通道）、`cp2k-hartree-v_hartree-1_0.cube`。前两个直接进 VESTA 看等值面；第三个除了看三维分布，更常见的用法是做 z 方向的平面平均曲线，从曲线平台读真空能级。" },
          { type: "formula", tex: "Φ = E_{\\mathrm{vac}} - E_{F}", caption: "功函数 = 真空能级 − 费米能级；真空能级取真空区静电势平台，单位换算 1 Ha = 27.2114 eV" },
          { type: "p", text: "课程讲义给了一个完整的算例：某 slab 的真空区静电势平台是 0.3158 a.u.，费米能级是 0.12242 a.u.，两者相减 0.19338 a.u.，乘 27.2114 得 **5.26 eV**——这就是该表面模型在那一套设置下的功函数。同页讲义还强调了一句很关键的话：**真空层的静电势如果不平，说明 slab 上下表面不对称**，这时要么做偶极校正（`SURFACE_DIPOLE_CORRECTION T` + `SURF_DIP_DIR Z`），要么构造对称的 slab，否则算出来的 Φ 里混着一个人为的偶极场。" },
          { type: "p", text: "看静电势分布还有一个进阶用法：异质结界面的能带对齐。两种材料接触后，各自的静电势平台会有高低差，电子从平台高的那一侧流向低的一侧；讲义举的例子是 TiO2/g-C3N4 异质结，两侧功函数分别 5.22 eV 与 6.43 eV，结论与差分电荷密度给出的电子转移方向一致——两条独立的证据指向同一个物理图像，这种互相印证比单一证据可靠得多。" },
          {
            type: "table",
            caption: "分析工具的选择",
            head: ["工具", "强项", "典型任务"],
            rows: [
              ["VESTA", "cube 等值面、晶格面、表面着色", "差分电荷密度、ELF、静电势、自旋密度"],
              ["OVITO", "大体系配位/多面体/缺陷识别", "几千原子的界面结构统计"],
              ["VMD", "轨迹播放、氢键、距离测量", "水层结构、吸附构型快照"],
              ["TRAVIS", "CP2K 轨迹的后处理与光谱", "RDF、MSD、IR/Raman 谱"],
              ["GROMACS", "成熟的定量分析命令", "rdf/msd/hbond，需要先转 gro"],
              ["Origin", "出版级作图", "所有曲线的最终排版"]
            ]
          },
          {
            type: "keypoints",
            items: [
              "先看 .ener 和 out：温度守住、SCF 每步收敛，再谈画图",
              "丢前 1/3 轨迹；末帧时间对不上 STEPS×TIMESTEP 就回去查重启记录",
              "g(r) 的三个参数：元素对、归一化密度、方向（表面体系要分层）",
              "MSD 只拟合线性段；二维扩散用 4t，报数时写清恒温器与拟合区间",
              "cube 全是原子单位；差分密度三次单点的 cell 与参数必须逐行一致",
              "原子电荷不跨方法比较；Bader 的价电子数要对着赝势核对",
              "金属体系的 DOS 需要 SMEAR + ADDED_MOS，否则费米能级以上是空的",
              "功函数 = 真空平台 − 费米能级；真空不平先做偶极校正"
            ]
          }
        ]
      }
    ],
    quiz: [
      {
        q: "在 g(r) 曲线上把积分上限取在第一峰后的第一个极小值，目的是什么？",
        options: ["得到第一配位壳层的配位数", "得到体系的总电子数", "得到扩散系数", "得到功函数"],
        answer: 0,
        explain: "第一峰对应最近邻距离，峰后的极小值是第一配位壳层与第二壳层的分界。积分到极小值得到第一壳层配位数；积分上限若取到峰顶或更远，会把第二壳层的原子也计进来。"
      },
      {
        q: "金属 slab 上要画 DOS 图，下面哪一项是必须的？",
        options: ["只开 UKS 就够，空带会自动算出来", "需要 SMEAR 处理分数占据，并给 ADDED_MOS 留出空带", "必须用 OT 而不是对角化", "必须关掉 SURFACE_DIPOLE_CORRECTION"],
        answer: 1,
        explain: "金属在费米能级处有部分占据，不开 SMEAR 会让占据数在两步之间来回跳、SCF 震荡；CP2K 默认只算占据轨道，空带不足时费米能级以上没有态，DOS 在带边被截断。"
      },
      {
        q: "把 MSD 的平台段也放进线性回归拟合扩散系数，结果会怎样？",
        options: ["D 被系统性低估", "D 被系统性高估", "没有影响，只是误差棒变大", "D 变成负值"],
        answer: 0,
        explain: "平台段的斜率接近零，混进回归会拉低整体斜率，而 D 正比于斜率，于是被低估。反过来只取最前面几个点会落进弹道段（MSD ∝ t²），那时斜率偏大、D 被高估。"
      },
      {
        q: "同一个 CO/Ni(100) 体系，Bader 给 Ni +0.06 e，Mulliken 给 −0.327 e。最合理的解读是？",
        options: ["其中一个程序算错了", "划分规则不同，绝对值不可跨方法比较，只能在同一方法内看趋势", "应该取两者的平均值", "说明体系没有电荷转移"],
        answer: 1,
        explain: "Bader 按电子密度零通量面切原子盆，Mulliken 按基函数归属并平分重叠布居。规则不同，连符号都可以不同。论文里只用一种方法画趋势并在方法段注明，不要跨方法比绝对值。"
      },
      {
        q: "算功函数时发现真空区的静电势曲线不平、有斜率，最应该先做什么？",
        options: ["直接把曲线两端取平均当真空能级", "检查 slab 是否上下不对称，必要时做偶极校正或改用对称 slab", "把 SURF_DIP_DIR 改成 X", "改用更大的 CUTOFF"],
        answer: 1,
        explain: "真空区静电势不平意味着 slab 上下表面不等价，存在净偶极。此时「真空能级」本身没有唯一值，取平均只是掩盖问题；正确做法是用 SURFACE_DIPOLE_CORRECTION 做偶极校正，或构造上下对称的 slab。"
      }
    ],
    terms: [
      { t: "径向分布函数", en: "radial distribution function (RDF)", d: "g(r) 描述以某原子为中心、半径 r 处找到另一类原子的概率相对均匀分布的倍数；第一峰位置给最近邻距离，峰后极小值是第一配位壳层边界。" },
      { t: "配位数", en: "coordination number", d: "把 g(r) 从 0 积分到第一极小值得到的第一壳层邻居数，需用同一区域的数密度归一化。" },
      { t: "均方位移", en: "mean square displacement (MSD)", d: "⟨|r(t) − r(0)|²⟩，粒子位移平方的系综平均；长时间极限下对时间线性增长，斜率给出扩散系数。" },
      { t: "扩散系数", en: "diffusion coefficient", d: "MSD 线性段斜率除以 6（三维）或 4（二维/面内），只应在一段明确标注的线性区间内拟合。" },
      { t: "差分电荷密度", en: "charge density difference", d: "Δρ = ρ(AB) − ρ(A) − ρ(B)，用来显示成键或吸附时电子在空间中的重新分布；要求三次单点的几何与计算参数完全一致。" },
      { t: "电子定域化函数", en: "electron localization function (ELF)", d: "取值 0–1 的实空间函数，反映电子定域程度；ELF > 0.5 的区域通常对应共价键、孤对电子或多中心键。" },
      { t: "功函数", en: "work function", d: "把电子从固体表面移到真空所需的最小能量，Φ = E_vac − E_F；它是表面的性质而非体相本征量，对晶面与吸附物敏感。" },
      { t: "投影态密度", en: "projected density of states (PDOS)", d: "把态密度按原子与角动量（s/p/d/f）分解，用来看某个原子的哪些轨道在某个能量区间有贡献，是判断杂化与电荷转移的主要工具。" }
    ],
    sources: [
      { t: "CP2K 手册：&PRINT（所有打印段的入口）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/PRINT.html" },
      { t: "CP2K 手册：&PRINT/&E_DENSITY_CUBE（电子密度与自旋密度 cube）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/PRINT/E_DENSITY_CUBE.html" },
      { t: "CP2K 手册：&PRINT/&DOS（总 DOS、PDOS 与 LDOS 的层次结构）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/PRINT/DOS.html" },
      { t: "CP2K 手册：态密度与投影态密度的原理", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/dos.html" },
      { t: "CP2K 手册：布居分析与原子电荷（Mulliken/Löwdin/Hirshfeld）", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/population/index.html" },
      { t: "CP2K 手册：分子轨道与 cube 输出", url: "https://manual.cp2k.org/trunk/methods/electronic_structure/molecular_orbitals.html" }
    ]
  };
})();