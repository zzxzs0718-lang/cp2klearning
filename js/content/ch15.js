(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch15"] = {
    id: "ch15",
    num: 15,
    part: "后处理",
    title: "振动谱与自由能面：从轨迹到可发表的图",
    subtitle: "Wannier 中心 + TRAVIS 算 IR/Raman，HILLS 与约束 MD 算 PMF",
    hours: 4.5,
    level: "高级",
    intro:
      "MD 跑完只是拿到坐标，真正的物理往往藏在后处理里：偶极如何随时间抖动，决定红外谱；集体变量如何被填平，决定自由能面。这一章用两条独立的流水线把这件事讲透——一条把 Wannier 中心交给 TRAVIS 算振动谱，另一条把元动力学与约束 MD 的输出还原成 PMF。两条线都要求你在跑 MD 时就记录对的东西，事后补不回来。",
    goals: [
      "说清红外谱为什么需要逐帧偶极，以及 Wannier 中心怎样给出这个偶极",
      "写出带 &LOCALIZE 与 &WANNIER_CENTERS 的 AIMD 输入，并按 TRAVIS 的要求控制输出频率",
      "独立完成一次 TRAVIS 问答、重放 input.txt，并读懂 spectrum CSV 的峰位与强度",
      "配置元动力学的 CV、METAVAR、HILLS 与墙，判断采样是否收敛",
      "用约束 MD 与 LAGRANGE_MULTIPLIERS 计算平均力，理解 blue-moon 与 slow-growth 的差别",
    ],
    sections: [
      {
        id: "15.1",
        title: "两条后处理线：谱与自由能面",
        blocks: [
          {
            type: "p",
            text: "同一条 AIMD 轨迹，可以做两类完全不同的后处理。**振动谱**关心的是电子云与原子核的相对运动怎样产生随时间变化的偶极，需要每一帧都有偶极信息；**自由能面**关心的是体系沿某个集体变量（CV）怎样翻越能垒，需要在跑的时候额外加偏置或约束。两者的共同点是：后处理只能在已有输出上做，跑 MD 时没记录的量，事后无法补。",
          },
          {
            type: "compare",
            left: {
              title: "振动谱这条线",
              items: [
                "额外记录：每帧的偶极（Wannier 中心或 MOMENTS）",
                "核心工具：TRAVIS（外部程序），或 CP2K 自带的 MOMENTS 输出",
                "产物：IR/Raman 谱、峰位与强度、去偏振比",
                "判据：峰位能否对上实验与文献指认，强度只作定性比较",
              ],
            },
            right: {
              title: "自由能面这条线",
              items: [
                "额外记录：CV 的瞬时值、偏置势、HILLS 文件或约束力",
                "核心工具：CP2K 的 METADYN/CONSTRAINT，加 graph.psmp 或脚本",
                "产物：一维/二维自由能面、PMF、能垒",
                "判据：CV 是否反复回到极小、面是否被填平、误差棒多大",
              ],
            },
          },
          {
            type: "p",
            text: "这一章按 15.2–15.5 讲第一条线，15.6–15.8 讲第二条线。两条线都建立在第 11 章的 AIMD 设置之上：步长、SCF 阈值、恒温器参数不对，后处理只会把错误放大成更漂亮的图。第 10 章已经讲过静态频率与 TRAVIS 的基本用法，本章不重复概念，只把流水线走完；第 12 章讲增强采样方法本身，15.6 之后只关心输入怎么写、输出怎么读。",
          },
          {
            type: "demo",
            id: "md",
            title: "动手：看清一条轨迹里有什么",
            desc: "在 MD 演示里加载一条含 Wannier 中心的轨迹，确认每帧的原子数、X 粒子数与帧间隔，再决定 TRAVIS 里该填多大的时间步。",
          },
          {
            type: "keypoints",
            items: [
              "后处理的能力上限由 MD 阶段的输出决定，跑之前先想清楚要算什么",
              "振动谱要偶极，自由能面要 CV 与偏置/约束，两类信息互不替代",
              "两条线的验证方式不同：谱看峰位，自由能面看采样与误差",
            ],
          },
        ],
      },
      {
        id: "15.2",
        title: "让轨迹带上偶极：LOCALIZE 与 Wannier 中心",
        blocks: [
          {
            type: "p",
            text: "红外强度正比于偶极对简正坐标的导数，因此需要偶极随时间的涨落。CP2K 的波函数是离域的，直接由占据轨道算总偶极在周期体系里还要处理 Berry 相位；一个更稳的做法是把占据轨道局域化成 Wannier 中心，用「原子核电荷 + Wannier 中心电荷」的经典图像逐帧算偶极。TRAVIS 读的就是这种带 X 粒子的轨迹。第 10 章为静态谱展示过这套设置，这里把它当作流水线的第一步补全参数。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "AIMD 里打开局域化与 Wannier 输出",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &MGRID
      CUTOFF 280
      REL_CUTOFF 40
    &END MGRID
    &SCF
      &OT
        MINIMIZER DIIS
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
    &END SCF
    &XC
      &XC_FUNCTIONAL BLYP
      &END XC_FUNCTIONAL
      &VDW_POTENTIAL
        POTENTIAL_TYPE PAIR_POTENTIAL
        &PAIR_POTENTIAL
          TYPE DFTD3
          REFERENCE_FUNCTIONAL BLYP
        &END PAIR_POTENTIAL
      &END VDW_POTENTIAL
    &END XC
    &LOCALIZE
      METHOD CRAZY
      MAX_ITER 2000
      &PRINT
        &WANNIER_CENTERS
          IONS_CENTERS T
          FILENAME wannier.xyz
          FORMAT XYZ
          &EACH
            MD 5
          &END EACH
        &END WANNIER_CENTERS
      &END PRINT
    &END LOCALIZE
  &END DFT
&END FORCE_EVAL`,
            note: "METHOD CRAZY 是快速近似旋转法；MAX_ITER 2000 对分子体系通常够用。片段省略了 &SUBSYS 的坐标与晶胞。",
          },
          {
            type: "p",
            text: "`IONS_CENTERS T` 让输出的每一帧同时包含原子与 Wannier 中心，`FORMAT XYZ` 是 TRAVIS 能读的格式；`&EACH MD 5` 表示每 5 个 MD 步写一帧，0.5 fs 步长下就是 2.5 fs 一帧。局域化本身默认每一步都做，打印频率只决定轨迹里有多少帧。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "对应的 NVT 设置（步长与帧间隔要记住）",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    TIMESTEP 0.5
    STEPS 60000
    TEMPERATURE 400
    &THERMOSTAT
      TYPE NOSE
      &NOSE
        TIMECON 100
      &END NOSE
    &END THERMOSTAT
    &PRINT
      &RESTART
        &EACH
          MD 1
        &END EACH
      &END RESTART
    &END PRINT
  &END MD
&END MOTION`,
          },
          {
            type: "p",
            text: "课程里的经验值：孤立分子 40000–60000 步、0.5 fs 步长，其中每 5 步一帧，得到 8000–12000 帧带 Wannier 中心的轨迹，足够做一条像样的谱。体系越大、要分辨的峰越密，就需要越长的轨迹；体相体系可以按分子数适当减少总步数，但不要指望几百帧就能出图。跑完先看输出末尾有没有 `PROGRAM ENDED AT`：没有这一行，轨迹大概率被截断，后处理只会得到半条谱。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "两个电荷数必须对上",
            text: "TRAVIS 会问 Wannier 中心的负电荷（闭壳层一对电子填 2.0）和每种原子的 core charge。用赝势时 core charge 填的是价电子数，不是原子序数；C/H/N/O 的默认值对 CP2K 的 GTH 赝势通常正确，但过渡金属一定要自己核对。填错会让谱的整体强度与低频行为变形。",
          },
          {
            type: "keypoints",
            items: [
              "Wannier 中心把离域轨道变成可加和的局域电荷，逐帧偶极才可计算",
              "IONS_CENTERS 打开后轨迹里多出 X 粒子，FORMAT 要选 TRAVIS 能读的 XYZ",
              "打印间隔与 MD 步长共同决定 TRAVIS 里的时间步，记错就会把峰位整体缩放",
            ],
          },
        ],
      },
      {
        id: "15.3",
        title: "TRAVIS 跑 IR：问答、参数与产物",
        blocks: [
          {
            type: "p",
            text: "TRAVIS 是 Brehm 组为 CP2K 轨迹写的谱学后处理程序，文本界面，靠问答收参数。它只认 XYZ/PDB 轨迹，扩展名要与内容一致；结果写到当前目录，同名文件不覆盖，而是改名成 `#1#output.txt` 之类，所以重复跑不会丢历史。",
          },
          {
            type: "code",
            lang: "bash",
            title: "一次最小调用与重放",
            text: `# 编译：Makefile 里设 CXX=g++，make 后在 exe/travis
export PATH=$PATH:/opt/travis/exe

# 第一次交互运行，按提示回答
travis -p wannier.xyz

# 答完会自动生成 input.txt；答错时 Ctrl+C，
# 编辑 input.txt，删掉出错行及其后所有行，再重放
travis -p wannier.xyz -i input.txt

# 产物是分号分隔的 CSV，用 xmgrace 直接看
xmgrace -block spectrum_global.csv -bxy 1:2`,
          },
          {
            type: "table",
            head: ["问题", "怎么答", "答错的后果"],
            caption: "TRAVIS 的 IR 问答（课程水盒子示例）",
            rows: [
              ["cell vector length", "按 pm 填，水盒子填 782", "峰位整体缩放，频率对不上"],
              ["functions", "ir", "算成别的谱，输出文件对不上"],
              ["time step", "与帧间隔一致，例如 2.5 fs", "频率轴按比例偏，峰宽也变"],
              ["whole system", "先答 y，得到整体谱", "只得到某个分子片段的谱"],
              ["分子片段谱", "可选，用于指认或扣溶剂", "多花时间，但便于把峰归给谁"],
              ["dipole mode / 参考点", "默认模式 1；带电分子填参考点", "带电体系的偶极原点不对，强度变形"],
              ["Wannier label", "X（CP2K 固定用 X）", "找不到中心，直接报错"],
              ["Wannier 负电荷", "闭壳层填 2.0", "强度与低频行为失真"],
              ["core charge", "按赝势价电子数填", "同上，过渡金属尤其要查"],
              ["dipole ACF 深度", "每 5 步一帧填 1024 或 2048", "太小分辨率低，太大噪声大"],
              ["最高波数 / dB 轴", "默认 / no", "一般不影响主线结论"],
            ],
          },
          {
            type: "p",
            text: "问答顺序与提示文字会随版本变，但物理量不变：盒子长度、时间步、每个 Wannier 中心的电荷、每种原子的 core charge、以及偶极自相关函数（ACF）的深度。ACF 深度是这段轨迹里参与相关的帧数，越大频率分辨率越高，代价是噪声与计算量；课程示例里 0.5 fs 步长、每步一帧时默认深度约 3115。",
          },
          {
            type: "code",
            lang: "bash",
            title: "检查产物与画图",
            text: `# CSV 第一列是波数，第二列是强度，分隔符是分号
head -5 spectrum_global.csv

# 只看高频区，快速判断 O-H 伸缩有没有出来
awk -F';' '$1 > 2500 && $1 < 4000' spectrum_global.csv | head

# 片段谱与整体谱放在一起比较，判断哪些峰来自溶剂
ls spectrum_*.csv`,
          },
          {
            type: "callout",
            kind: "tip",
            title: "把问答变成可复现的 input.txt",
            text: "TRAVIS 每答一题就把答案写进 input.txt，文件读完后才回到键盘。答辩、换体系、给别人复现时，保留这个文件比截图问答界面可靠得多；重放时用 `-i input.txt`，要改某一项就删掉它及其后所有行再重跑。",
          },
          {
            type: "p",
            text: "一次只做一种分析，别在同一目录并行跑两个 TRAVIS：两者都写 `travis.log`，会互相覆盖甚至崩掉。要同时算 IR 与 Raman，就分目录、分批次。",
          },
        ],
      },
      {
        id: "15.4",
        title: "读谱与指认：峰位、强度与边界",
        blocks: [
          {
            type: "p",
            text: "谱图的横轴是波数，纵轴是强度（或吸光度）。读出三件事：峰位在哪、峰宽多大、相对强度多少。峰位主要由力常数与约化质量决定，是你和实验对比的硬指标；强度来自偶极导数，受轨迹长度与 ACF 深度影响更大，通常只作定性比较。",
          },
          {
            type: "list",
            ordered: true,
            items: [
              "先看整体谱的低频区：平动、转动与分子间振动混在一起，周期体系里还要看盒子够不够大。",
              "再看指纹区：每个官能团的弯曲与伸缩应当能与结构对应，指认不出来的峰往往是氢键或构象混合。",
              "最后看高频区：O–H、N–H 伸缩对氢键环境极其敏感，峰位红移与峰宽是判断氢键网络的第一手证据。",
              "把片段谱与整体谱叠在一起：只出现在整体谱里的峰来自溶剂或界面，可以借此做扣除。",
            ],
          },
          {
            type: "p",
            text: "强度不要过度解读。有限长度的轨迹让低频端的统计噪声很大，ACF 深度改变时峰的相对高度会变；如果两个峰在改变深度后排序翻转，说明它们的强度差在误差之内。真正稳的结论是峰位与峰形，而不是某两个峰的面积比。",
          },
          {
            type: "callout",
            kind: "info",
            title: "CP2K 也能直接输出偶极",
            text: "`&DFT/&PRINT/&MOMENTS` 可以按步打印偶极，`FORMAT TRAJECTORY` 给出机器可读的记录，配合 `PERIODIC` 选择 Berry 相位或简单偶极算符。课程讲义对这条路的评价是结果不理想，它更适合检查偶极的走向与量级，而不是出最终谱图；要出图，仍用 Wannier 中心 + TRAVIS。",
          },
          {
            type: "p",
            text: "验证一条谱，至少做三件事：换一段轨迹（前一半与后一半）看峰位是否稳定；把 ACF 深度加倍看峰宽是否收敛；对一个已知峰（例如水的弯曲与伸缩）确认指认没有整体错位。三件事都过，再谈与实验的细节比较。",
          },
        ],
      },
      {
        id: "15.5",
        title: "Raman：多一步电场，多三倍开销",
        blocks: [
          {
            type: "p",
            text: "Raman 强度取决于极化率对简正坐标的导数，比 IR 多一层响应计算。TRAVIS 的做法是：先有 IR 用的 Wannier 轨迹，再由它生成一组「用有限场法加外电场、重算 Wannier 中心」的 CP2K 输入，跑完这些输入得到极化率，最后做第二遍 TRAVIS 得到 Raman 谱。",
          },
          {
            type: "steps",
            items: [
              {
                t: "准备 IR 轨迹",
                d: "与 15.2 完全相同：局部化 + 逐帧 Wannier 中心。没有这条轨迹，Raman 无从开始。",
              },
              {
                t: "第一遍 TRAVIS 选 raman",
                d: "functions 填 raman，程序会问是否创建新的 CP2K 输入；选创建，它会按电场方向生成若干输入文件。",
              },
              {
                t: "跑电场计算",
                d: "把生成的一组输入跑完，得到每个方向的极化率；这些计算互相独立，可以并行。",
              },
              {
                t: "第二遍 TRAVIS 读结果",
                d: "选 process existing，读回极化率，输出三个偏振方向的谱与去偏振比。",
              },
            ],
          },
          {
            type: "p",
            text: "成本要提前算：取向平均要做三次计算，等于三倍电场开销；每个方向还要按轨迹帧数重算 Wannier 中心。柔性体系可以先关掉取向平均，用小体系把流程跑通，再对大体系开满。电场强度默认 5.0E-4 a.u.，太小会被数值噪声淹没，太大就进入非线性区，不要随意放大。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "别在 CP2K 输入里找 Raman 关键词",
            text: "Raman 这一步由 TRAVIS 组织：它生成的仍是普通的 CP2K 单点/电场计算，没有专门的 Raman 输入节。手册的红外页目前只有外部链接（TRAVIS 与官方练习），写方法段时引用 TRAVIS 与这些练习，不要杜撰 CP2K 关键词。",
          },
          {
            type: "p",
            text: "Raman 的产物里，`depol_ratio` 只在该频段确实有 Raman 强度时才有意义；强度接近零的地方，比值是噪声放大出来的。把三个偏振方向的谱与去偏振比一起看，能区分全对称呼吸峰与不对称振动，这比单看一条谱信息量大得多。",
          },
          {
            type: "p",
            text: "去偏振比的物理含义值得单独说清：全对称振动通常给出很小的比值，非全对称振动接近 0.75，介于两者之间说明振动模式混合。它不依赖绝对强度，因此比峰高更稳，适合作指认的第二证据。前提仍是该峰真的有强度——在噪声区里算出来的比值没有意义。",
          },
        ],
      },
      {
        id: "15.6",
        title: "元动力学输入：CV、METADYN 与墙",
        blocks: [
          {
            type: "p",
            text: "元动力学在真实势能面上不断叠加高斯，把体系从极小里「推」出来。要写对三件事：CV 是什么、高斯多高多宽多久加一次、以及要不要加墙防止体系跑飞。CV 定义在 `&FORCE_EVAL/&SUBSYS/&COLVAR`，偏置在 `&MOTION/&FREE_ENERGY/&METADYN`。方法推导见第 12 章，这里只讲输入与输出。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "两个 CV：一个组合距离，一个配位数式的距离差",
            text: `&FORCE_EVAL
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
        ERROR_LIMIT 1.0E-8
      &END COMBINE_COLVAR
    &END COLVAR
    &COLVAR
      &DISTANCE
        ATOMS 49 50
      &END DISTANCE
    &END COLVAR
  &END SUBSYS
&END FORCE_EVAL`,
            note: "COLVAR 在 SUBSYS 下按顺序编号；METAVAR 里的整数索引就是这里的顺序。",
          },
          {
            type: "p",
            text: "`&DISTANCE` 给两原子间距；`&COMBINE_COLVAR` 把若干子 CV 用表达式合成一个新的 CV，`FUNCTION` 写表达式，`VARIABLES` 给变量名，`ERROR_LIMIT` 是数值误差上限。CV 的选取决定整条自由能面有没有意义：它必须区分你想研究的两个状态，又不能在无关方向上乱跑。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "METADYN：加高斯、定宽度、加墙",
            text: `&MOTION
  &FREE_ENERGY
    &METADYN
      DO_HILLS T
      NT_HILLS 50
      WW 3.0E-3
      &METAVAR
        COLVAR 1
        SCALE 0.3
        &WALL
          TYPE QUADRATIC
          POSITION [angstrom] 5.0
          &QUADRATIC
            DIRECTION WALL_PLUS
            K [kcalmol] 40.0
          &END QUADRATIC
        &END WALL
      &END METAVAR
      &METAVAR
        COLVAR 2
        SCALE 0.3
      &END METAVAR
      &PRINT
        &COLVAR
          COMMON_ITERATION_LEVELS 3
          &EACH
            MD 1
          &END EACH
        &END COLVAR
        &HILLS
          COMMON_ITERATION_LEVELS 3
          &EACH
            MD 1
          &END EACH
        &END HILLS
      &END PRINT
    &END METADYN
  &END FREE_ENERGY
&END MOTION`,
            note: "片段：省略了 &SUBSYS 与 &DFT，MD 与恒温器设置见 15.2；两个 METAVAR 分别对应两个 CV。",
          },
          {
            type: "table",
            head: ["关键词", "含义", "默认/常见取值"],
            rows: [
              ["DO_HILLS", "是否真的往势能面加高斯", "F；只观察不加偏置时保持 F"],
              ["NT_HILLS", "每隔多少 MD 步加一个高斯", "默认 30；手册示例 60，课程示例 50"],
              ["WW", "高斯高度（hartree）", "默认 0.1，偏大；常用 0.5E-3–3.0E-3"],
              ["SCALE", "该 CV 方向上的高斯宽度", "按 CV 涨落幅度估，课程示例 0.3"],
              ["COLVAR", "METAVAR 作用的 CV 序号", "从 1 开始，按 SUBSYS 里的顺序"],
              ["WALL TYPE", "防止跑飞的墙", "REFLECTIVE/QUADRATIC/QUARTIC/GAUSSIAN"],
              ["TARGET", "约束 MD 的目标值", "用于 blue-moon，不是元动力学"],
            ],
          },
          {
            type: "callout",
            kind: "danger",
            title: "WW 默认 0.1 hartree 会直接把面填坏",
            text: "0.1 hartree 约 2.7 eV，对普通化学能垒来说是一个巨大的台阶。正确做法是先跑一段 `DO_HILLS .FALSE.` 的无偏 MD，量出 CV 的涨落幅度，再用「峰高约为预估能垒的 1/50」定 WW，用涨落幅度定 SCALE；不是照抄默认值。",
          },
          {
            type: "keypoints",
            items: [
              "CV 在 SUBSYS/COLVAR 定义，METAVAR 用整数索引引用它",
              "WW、NT_HILLS、SCALE 三者共同决定填面速度与分辨率，必须按体系定",
              "墙用来限制 CV 的探索范围，参数不当会把真实极小也挡住",
            ],
          },
        ],
      },
      {
        id: "15.7",
        title: "HILLS 与 COLVAR：把偏置还原成自由能面",
        blocks: [
          {
            type: "p",
            text: "元动力学跑完，目录里会出现 `cp2k-HILLS.metadynLog` 与 `cp2k-COLVAR.metadynLog`。前者记录每一次加高斯的中心、宽度与高度，是重建自由能面的原料；后者记录每一步的 CV 值与偏置，用来看采样路径与是否回到极小。",
          },
          {
            type: "table",
            head: ["文件", "列的顺序", "用途"],
            caption: "手册给出的输出列定义",
            rows: [
              ["HILLS", "步数、CV1、CV2、CV1 宽度、CV2 宽度、峰高", "叠加高斯，重建 FES"],
              ["COLVAR", "步数、CV1、CV2、偏置对 CV1/CV2 的梯度、墙的梯度、偏置值、墙的值", "看路径、看是否收敛、排查墙"],
            ],
          },
          {
            type: "p",
            text: "重建一维面最省事的是课程里的 `gaussian.py`：它读 `cp2k-HILLS.metadynLog`，按每行的高斯参数叠加并画出自由能。注意脚本头写明它对 CP2K 只处理一维；要做二维面，用 CP2K 自带的 graph 工具，或按 HILLS 的列自己叠加。",
          },
          {
            type: "code",
            lang: "bash",
            title: "一维用脚本，二维用 graph",
            text: `# 一维：脚本读 cp2k-HILLS.metadynLog，参数是横轴范围
python gaussian.py 1 0.5 5.0

# 二维：手册给的 graph 调用，HILLS 指最后一次写出的 HILLS 文件
graph.psmp -i HILLS -stride 10 -ndim 2 -ndw 1 2 \
  -cp2k -integrated_fes

# 先数一数加了多少个高斯，判断采样量够不够
wc -l cp2k-HILLS.metadynLog`,
          },
          {
            type: "p",
            text: "判收敛看两件事：CV 是否在目标区间内来回穿越多次（课程的经验是至少十次以上），以及自由能面在后续时间段是否不再变化。只跑一段、CV 从没回到起点，得到的「能垒」可能只是偏置还没填平时的假象。把轨迹按时间分块，各自重建一次面，块与块之间差多少，就是最朴素的误差棒。",
          },
          {
            type: "callout",
            kind: "info",
            title: "峰高与峰宽的折中",
            text: "峰高直接进入能垒误差：太高会把面填过头、把能垒压低，太低则要跑很久。峰宽太小需要很多高斯、面不平滑；太大则还原不出陡峭的极小与鞍点。允许在同一条轨迹里改 WW/SCALE 重启，常见做法是先用大一点的高斯快速铺开，再用小高斯精修。",
          },
        ],
      },
      {
        id: "15.8",
        title: "PMF 与 slow-growth：约束 MD 怎么给自由能",
        blocks: [
          {
            type: "p",
            text: "当过程没有明显能垒（吸附、溶剂化、离子配对），或者你只想要一条沿 CV 的自由能曲线，约束 MD 比元动力学更直接。把 CV 固定在某个值上采样，测出约束力，再沿 CV 积分，就得到平均力势（PMF）。约束会改变统计分布，所以积分前要做 blue-moon 重加权。",
          },
          {
            type: "formula",
            tex: "\\frac{\\mathrm{d}A}{\\mathrm{d}\\xi}=\\frac{\\left\\langle Z^{-1/2}\\left(-\\lambda+k_\\mathrm{B}TG\\right)\\right\\rangle_\\xi}{\\left\\langle Z^{-1/2}\\right\\rangle_\\xi}",
            caption: "blue-moon 系综下的自由能梯度；λ 是约束乘子，Z 是质量度规，G 是度规导数项",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "固定窗口与移动约束（slow growth）",
            text: `&MOTION
  &CONSTRAINT
    &COLLECTIVE
      COLVAR 1
      INTERMOLECULAR TRUE
      TARGET [angstrom] 2.0
      TARGET_GROWTH [angstrom*fs^-1] 0.0008
      TARGET_LIMIT [angstrom] 3.0
    &END COLLECTIVE
    &LAGRANGE_MULTIPLIERS ON
      FILENAME constraint_force
      COMMON_ITERATION_LEVELS 1
    &END LAGRANGE_MULTIPLIERS
  &END CONSTRAINT
  &MD
    ENSEMBLE NVT
    TIMESTEP 0.5
    STEPS 20000
    TEMPERATURE 300
  &END MD
&END MOTION`,
            note: "TARGET_GROWTH 与 TARGET_LIMIT 都省略时，就是固定窗口的约束 MD。",
          },
          {
            type: "p",
            text: "`LAGRANGE_MULTIPLIERS` 输出两个记录：`ShakeLagrangianMultipliers` 是位置约束的乘子，对应构型约束力，是热力学积分要用的量；`RattleLagrangianMultipliers` 只管速度约束，不是第二个构型力样本。对两原子距离这种 CV，Z 是常数、G 为零，重加权相消，自由能梯度就简化成负的平均 λ。角度、二面角或组合 CV 不能这样简化，必须把 Z 与 G 一起算。",
          },
          {
            type: "p",
            text: "CP2K 只输出 λ，不替你算完整的 blue-moon 估计量；手册给出的后处理器在源码的 `tools/blue_moon`，支持距离、角度、二面角、点到平面距离及其线性组合，需要配套的 XYZ 轨迹、SHAKE 输出、真实质量、固定晶胞与温度。多窗口的流程是：每个 TARGET 单独平衡并采样，逐窗算梯度，再沿 CV 积分；窗口间距、采样长度与积分方向都要在方法段交代。",
          },
          {
            type: "p",
            text: "把 `TARGET` 线性推动就是 slow growth：`TARGET_GROWTH` 每个 MD 步按 `TARGET_GROWTH × TIMESTEP` 改变目标值，`TARGET_LIMIT` 到点即停。CP2K 不会自动把功积分成自由能，拉动太快会有滞后、耗散与方向滞后；要用 Jarzynski 恒等式或把它当作定性路径。想要平衡自由能，回到固定窗口的 blue-moon 更稳。",
          },
          {
            type: "p",
            text: "两条路怎么选：想一次看到整条路径、能垒明显、CV 容易加偏置，用元动力学；只关心一段自由能差、过程没有明显能垒、或 CV 不方便加偏置，用约束 MD。误差预算要写清四块：窗口间距与积分方向、每窗的采样长度与相关时间、blue-moon 重加权项是否完整、以及电子结构层面的误差。每块都可以用分块标准差给出一条误差棒，不要只报一个数。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "INCREM 是别的程序的关键词",
            text: "课程讲义里的 slow-growth 用 VASP 的 `INCREM` 推进 CV；CP2K 输入里没有这个关键词，对应物是 `TARGET_GROWTH`（配合 `TARGET_LIMIT`）。同理，讲义里 `grep cc`/`grep b_m` 读的是 VASP 的 REPORT 文件，在 CP2K 里要读的是 `constraint_force` 与轨迹。",
          },
          {
            type: "keypoints",
            items: [
              "约束 MD 的原始输出是约束乘子，积分前要按 blue-moon 公式重加权",
              "距离 CV 的 Z 为常数、G 为零，梯度就是负的平均 λ；别的 CV 不行",
              "TARGET_GROWTH 做 slow growth，固定 TARGET 做多窗口 PMF，两者误差结构不同",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "为什么算红外谱要在 AIMD 里输出 Wannier 中心，而不是只存坐标？",
        options: [
          "坐标太大，Wannier 中心能压缩轨迹",
          "偶极随时间的涨落决定谱，Wannier 中心给出逐帧偶极",
          "Wannier 中心能替代 SCF 收敛",
          "TRAVIS 只读 Wannier 中心，不读坐标",
        ],
        answer: 1,
        explain: "红外强度来自偶极对简正坐标的导数。Wannier 中心把电子部分局域化，逐帧可算偶极；只有坐标无法还原偶极的电子贡献。",
      },
      {
        q: "TRAVIS 问 cell vector length，你填了 782（pm），但实际盒子是 7.82 Å。会发生什么？",
        options: [
          "没有影响，TRAVIS 会自动换算",
          "峰位整体缩放，频率轴对不上",
          "只会影响 Raman，不影响 IR",
          "轨迹读不进去",
        ],
        answer: 1,
        explain: "盒子长度参与频率换算；单位错 100 倍会让峰位整体偏移。782 pm 正好等于 7.82 Å，填之前先统一单位。",
      },
      {
        q: "元动力学里 WW 保持默认 0.1 hartree，最可能的后果是？",
        options: [
          "面填得太慢，需要更长的轨迹",
          "高斯过高，面被填过头，能垒被严重低估",
          "CV 无法定义",
          "只会影响墙的高度",
        ],
        answer: 1,
        explain: "0.1 hartree 约 2.7 eV，对普通能垒是巨大台阶，会快速把极小填平并压低压垒。先做无偏 MD 估涨落，再用约为能垒 1/50 的高度。",
      },
      {
        q: "重建一维自由能面时，gaussian.py 读的是哪个文件？",
        options: [
          "cp2k-COLVAR.metadynLog",
          "cp2k-HILLS.metadynLog",
          "cp2k-1.ener",
          "constraint_force",
        ],
        answer: 1,
        explain: "HILLS 文件记录每个高斯的中心、宽度与高度，叠加后得到偏置势，再取其负值就是自由能面；COLVAR 记录的是路径与瞬时值。",
      },
      {
        q: "想在 CP2K 里用 slow growth 连续推动一个距离约束，应该用哪个关键词？",
        options: ["INCREM", "TARGET_GROWTH", "NT_HILLS", "SCALE"],
        answer: 1,
        explain: "INCREM 是讲义里 VASP 的写法；CP2K 在 COLLECTIVE 里用 TARGET_GROWTH 线性改变 TARGET，并用 TARGET_LIMIT 设定终点。",
      },
    ],
    terms: [
      { t: "TRAVIS", en: "Trajectory Analyzer and Visualizer", d: "面向 CP2K 轨迹的谱学后处理程序，可从 Wannier 中心轨迹算 IR、Raman 等。" },
      { t: "Wannier 中心", en: "Wannier center", d: "局域化占据轨道的中心，可当作电子的局域电荷位置，用于逐帧计算偶极。" },
      { t: "偶极自相关函数", en: "dipole autocorrelation function", d: "偶极随时间涨落的自相关，其傅里叶变换给出红外谱的峰位与强度。" },
      { t: "元动力学", en: "metadynamics", d: "沿集体变量不断叠加高斯偏置，填平自由能面以加速稀有事件的采样方法。" },
      { t: "集体变量", en: "collective variable", d: "描述过程进度的低维坐标；选得好坏决定自由能面是否有物理意义。" },
      { t: "blue-moon", en: "blue-moon ensemble", d: "对约束 MD 的偏置分布做重加权，得到无约束系综下的平均力的方法。" },
      { t: "PMF", en: "potential of mean force", d: "沿某个坐标的平均力势，等于自由能对该坐标的曲线，可由约束力积分得到。" },
      { t: "TARGET_GROWTH", en: "target growth", d: "CP2K 约束 MD 中让目标值随步长线性变化的设置，对应 slow-growth 协议。" },
    ],
    sources: [
      { t: "Methods / Infrared Spectroscopy", url: "https://manual.cp2k.org/trunk/methods/properties/infrared.html" },
      { t: "Methods / Metadynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/metadynamics.html" },
      { t: "Methods / Constrained molecular dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/constrained_dynamics.html" },
      { t: "CP2K_INPUT / FORCE_EVAL / DFT / LOCALIZE", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/LOCALIZE.html" },
      { t: "CP2K_INPUT / FORCE_EVAL / SUBSYS / COLVAR", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/SUBSYS/COLVAR.html" },
    ],
  };
})();