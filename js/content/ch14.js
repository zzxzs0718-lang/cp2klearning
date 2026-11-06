(function () {
  "use strict";

  window.CONTENT = window.CONTENT || {};

  window.CONTENT["ch14"] = {
    id: "ch14",
    num: 14,
    part: "动力学",
    title: "分子动力学：让原子动起来",
    subtitle: "&MD、系综、时间步、恒温恒压与能量守恒",
    hours: 4,
    level: "进阶",
    intro:
      "单点能只回答一个构型有多高，分子动力学回答它接下来会怎么走。这一章从一段能直接跑的 NVE 输入开始，把系综、时间步、恒温器、恒压器逐项拆开，最后给出判断一条轨迹能不能用的检查清单。",
    goals: [
      "写出并跑通 NVE、NVT、NPT 三种系综的 CP2K 输入",
      "根据物理问题选择系综与恒温器，并说清选择理由",
      "用 TIMESTEP 和能量守恒数据判断一条轨迹是否可信",
      "知道 AIMD 每一步都要算电子结构，从而知道该收紧哪些参数"
    ],
    sections: [
      {
        id: "14.1",
        title: "从单点到轨迹：&MD 只多做两件事",
        blocks: [
          {
            type: "p",
            text: "单点能计算输出的是「这个构型能量多少」。分子动力学输出的是「从这一步到下一步，原子往哪里走、能量怎么在动能与势能之间来回换」。在 CP2K 里，这两件事的输入差别只有两处：==`&GLOBAL` 的 `RUN_TYPE` 改成 `MD`，再补一个 `&MOTION` 段==。泛函、基组、赝势、截断这些力学设置一行都不用改（下面这份输入连泛函都省了，默认就是 PBE），这也是为什么第 3 章的输入可以直接拿来改。"
          },
          {
            type: "p",
            text: "下面这份输入拿一个水分子放在 12 Å 的周期盒里跑 200 步 NVE。盒子开得比分子大很多，是为了让周期性镜像之间不互相作用；分子在盒子里自由平动转动，对教学演示没有影响。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_nve.inp：最小可运行的 NVE",
            note: "步数刻意取得很少。这个规模的体系在个人电脑上几十秒就能跑完。泛函没显式写，默认就是 PBE；要换就在 `&DFT` 里补 `&XC%&XC_FUNCTIONAL`。",
            text: `&GLOBAL
  PROJECT h2o_md
  RUN_TYPE MD
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
  &END DFT
  &SUBSYS
    &CELL
      ABC 12 12 12
      PERIODIC XYZ
    &END CELL
    &COORD
      O 0.000 0.000 0.000
      H 0.757 0.586 0.000
      H -0.757 0.586 0.000
    &END COORD
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
  &MD
    ENSEMBLE NVE
    STEPS 200
    TIMESTEP 0.5
    TEMPERATURE 300
  &END MD
&END MOTION`
          },
          {
            type: "p",
            text: "`ENSEMBLE NVE` 表示不跟外界交换能量。`STEPS 200` 乘 `TIMESTEP 0.5` 等于 100 fs，这个长度只够看几轮 O–H 键的伸缩振动，远不够看扩散或构象变化。`TEMPERATURE 300` 在 NVE 里只做一件事：按 300 K 生成初始速度。"
          },
          {
            type: "key",
            items: [
              { k: "RUN_TYPE", v: "MD", tag: "打开离子步循环" },
              { k: "ENSEMBLE", v: "NVE", tag: "固定能量" },
              { k: "STEPS", v: "步数", tag: "乘时间步得总时长" },
              { k: "TIMESTEP", v: "fs", tag: "默认 0.5" },
              { k: "TEMPERATURE", v: "K", tag: "初速度与 NVT/NPT 目标温度" }
            ]
          },
          {
            type: "callout",
            kind: "info",
            title: "先 NVE 再 NVT",
            text: "几乎所有 MD 工作流都从一段短 NVE 开始。理由很实际：NVE 没有恒温器在悄悄加减能量，体系出了问题（时间步太大、SCF 不收敛、结构太离谱）会直接反映成总能量漂移，而不是被恒温器掩盖。"
          },
          { type: "keypoints", items: ["MD 输入 = 单点能输入 + RUN_TYPE MD + &MOTION 段", "STEPS × TIMESTEP 是轨迹的物理长度，不是质量指标", "NVE 里 TEMPERATURE 只用来生成初速度"] }
        ]
      },
      {
        id: "14.2",
        title: "系综：你到底固定了什么量",
        blocks: [
          {
            type: "p",
            text: "系综听起来抽象，其实就是一句话：**哪几个热力学量被钉死，哪几个量允许涨落**。真实实验大多在恒温恒压下进行，所以 NVT 和 NPT 才是生产段的常客；NVE 更像一把尺子，用来量你的积分器准不准。"
          },
          {
            type: "table",
            caption: "常用系综与适用场景",
            head: ["ENSEMBLE", "固定什么", "什么时候用"],
            rows: [
              ["NVE", "粒子数、体积、总能量", "标定时间步、检查能量守恒、看纯动力学"],
              ["NVT", "粒子数、体积、温度", "平衡、溶液与生物体系生产段、最常用"],
              ["NPT_I", "粒子数、压力、温度（各向同性）", "液体、气体、近似各向同性的固体"],
              ["NPT_F", "粒子数、压力、温度（晶胞可变）", "固体、界面、各向异性应力"],
              ["LANGEVIN", "随机动力学（摩擦 + 噪声）", "稳健平衡、需要耗散或控温分区时"]
            ]
          },
          {
            type: "p",
            text: "选择顺序可以按这个思路：需要观察的时间尺度在常温下对温度涨落敏感吗？敏感就用 NVT。体系有明确的晶胞和外部压力吗？有就先 NVT 平衡、再 NPT 生产。只是想验证积分器？NVE。想要强稳健性（模型粗糙、初结构不好、离子液体这类难平衡体系）？`ENSEMBLE LANGEVIN` 加 `&MD%&LANGEVIN%GAMMA`，摩擦系数小则接近 NVE，大则控得更紧。"
          },
          {
            type: "callout",
            kind: "key",
            title: "一句话选法",
            text: "平衡用 NVT（或 LANGEVIN），生产看问题：恒容用 NVT，恒压用 NPT_I，晶胞要自由变形用 NPT_F，NVE 只用来做诊断。"
          },
          {
            type: "demo",
            id: "md",
            title: "分子动力学小实验",
            desc: "动手改 TIMESTEP、TEMPERATURE 和 STEPS，看温度与总能量怎么变。"
          },
          {
            type: "p",
            text: "在演示里把 TIMESTEP 从 0.5 一路加大，会看到温度曲线先稳定、后持续上翘。那不是「跑得更快」，而是高频振动被积分坏了，能量漏进了低频自由度。第 3 节专门讲怎么标定这个数。"
          },
          { type: "keypoints", items: ["系综 = 固定哪些量、允许哪些量涨落", "NVT 是最常用的生产系综，NVE 是诊断工具", "NPT_I 管各向同性，NPT_F 才允许晶胞形状变化"] }
        ]
      },
      {
        id: "14.3",
        title: "TIMESTEP：唯一必须先标定的数",
        blocks: [
          {
            type: "p",
            text: "`TIMESTEP` 默认 0.5 fs，单位是飞秒。它决定你能分辨的最高频率：步长越大，越快追上积分器的稳定边界。经验上让最快的振动周期至少有十几个步长，误差才压得住。"
          },
          {
            type: "formula",
            tex: "\\Delta t \\;\\lesssim\\; \\frac{1}{10}\\,\\frac{2\\pi}{\\omega_{\\max}}",
            caption: "最高角频率决定步长上限；实际取更小，因为还要留出错容差"
          },
          {
            type: "p",
            text: "含氢体系（O–H、N–H 伸缩）最快，AIMD 的常见起点是 0.5 fs 到 1.0 fs。温度更高、有弱键或正在断键、氢原子很多，就往小的方向走。重原子体系可以到 1–2 fs，但**每一次改大都要重新验一遍守恒**，不能凭体系「看起来重」就跳步。"
          },
          {
            type: "steps",
            items: [
              { t: "先用 0.5 fs 跑 200 步 NVE", d: "这一步同时验证输入、SCF 收敛和结构合理性。" },
              { t: "把 TIMESTEP 乘二再跑同样步数", d: "只改这一个参数，其它全部不动。" },
              { t: "比较两条轨迹的 e_tot", d: "放大后总能量开始单向漂移、温度持续上翘，就说明已经过头。" },
              { t: "回到通过检验的最大步长的八成", d: "留余量，因为生产段会遇到平衡阶段没出现的构型。" }
            ]
          },
          {
            type: "callout",
            kind: "warn",
            title: "温度自己往上爬是最典型的症状",
            text: "恒温器开着的时候，时间步过大不容易看出来——恒温器一直在把多出来的热量抽走。所以步长标定一定要在 NVE 下做，或者至少对比恒温器注入/移除能量的量级。"
          },
          { type: "keypoints", items: ["TIMESTEP 由体系里最快的振动决定，不由体系大小决定", "标定必须在 NVE 下做，否则被恒温器掩盖", "通过检验后仍要留 20% 余量"] }
        ]
      },
      {
        id: "14.4",
        title: "恒温器：CSVR 是默认答案",
        blocks: [
          {
            type: "p",
            text: "NVT 需要一个恒温器来补上「与热浴交换能量」这件事。`&MD%&THERMOSTAT%TYPE` 的默认值是 `NOSE`，但常规生产更推荐 `CSVR`：它通过随机重标定速度实现正则分布，对远离平衡的初结构更耐受，也不会像长链 Nose-Hoover 那样在小型体系里出现能量在链上「卡住」的振荡。"
          },
          {
            type: "table",
            caption: "CP2K 里能选的控温方式",
            head: ["写法", "机理", "适合"],
            rows: [
              ["TYPE NOSE", "Nose-Hoover 链（默认）", "已经平衡好的体系，需要严格动力学时"],
              ["TYPE CSVR", "随机速度重标定（Bussi 型）", "通用首选，平衡与生产都能用"],
              ["TYPE GLE", "广义 Langevin，需要给摩擦核", "要复现特定溶剂涨落谱时"],
              ["TYPE AD_LANGEVIN", "自适应 Langevin", "难平衡体系，自动调整摩擦"],
              ["ENSEMBLE LANGEVIN", "加摩擦与随机力（&MD%&LANGEVIN%GAMMA）", "分区控温、需要耗散时"]
            ]
          },
          {
            type: "code",
            lang: "cp2k",
            title: "NVT + CSVR 的写法",
            note: "只列 &MOTION 段，力学部分沿用 14.1。",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 2000
    TIMESTEP 0.5
    TEMPERATURE 330
    &THERMOSTAT
      TYPE CSVR
      &CSVR
        TIMECON 100.0
      &END CSVR
    &END THERMOSTAT
  &END MD
&END MOTION`
          },
          {
            type: "p",
            text: "`TIMECON` 单位是 fs，控制恒温器「多急」。典型值 100 fs 附近对多数 AIMD 体系是稳健的（典型值，需自测）：50 fs 左右升温降温快，适合平衡初期；200 fs 以上更温和，适合不希望恒温器干扰动力学谱的生产段。默认值是 1000 fs，对几十到几百 fs 的轨迹来说等于几乎不控温。"
          },
          {
            type: "compare",
            left: {
              title: "CSVR",
              items: ["随机重标定，采样正则分布", "对初结构粗糙、温度偏差大的情况稳健", "只有一个时间常数要调", "生产段首选"]
            },
            right: {
              title: "NOSE（Nose-Hoover 链）",
              items: ["确定性扩展变量，动力学可逆", "小体系、远离平衡时容易振荡", "链长与时间常数都要顾", "体系已平衡、且在意严格动力学时用"]
            }
          },
          {
            type: "callout",
            kind: "danger",
            title: "CP2K 里没有 BERENDSEN 这个恒温器",
            text: "老教程里常见的「每 N 步把速度乘一个因子拉回目标温度」属于 Berendsen 型弱耦合，它不产生正确的正则分布。CP2K 的 `TYPE` 里没有这一项；早期 `&MD` 的速度重标定参数也已不推荐当作恒温器使用。要「拉得快一点」的正确做法是把 CSVR 的 TIMECON 调小，而不是自己重标定速度。"
          },
          { type: "keypoints", items: ["常规 NVT 用 TYPE CSVR，TIMECON 从 100 fs 起调", "TIMECON 越小控温越强，也越容易干扰真实动力学", "不要手写速度重标定来当恒温器"] }
        ]
      },
      {
        id: "14.5",
        title: "恒压：NPT 是「会呼吸的盒子」",
        blocks: [
          {
            type: "p",
            text: "恒压靠 `&MD%&BAROSTAT`。`PRESSURE` 是外压（单位 bar），`TIMECON` 是晶胞「呼吸」的时间常数，同样以 fs 计。`NPT_I` 只允许晶胞整体缩放，`NPT_F` 允许三个方向独立变形，后者才需要关心 `VIRIAL`。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "NPT_I 的写法",
            note: "恒压器段和恒温器段可以同时存在。",
            text: `&MOTION
  &MD
    ENSEMBLE NPT_I
    STEPS 2000
    TIMESTEP 0.5
    TEMPERATURE 330
    &THERMOSTAT
      TYPE CSVR
      &CSVR
        TIMECON 100.0
      &END CSVR
    &END THERMOSTAT
    &BAROSTAT
      PRESSURE 1.0
      TIMECON 500.0
    &END BAROSTAT
  &END MD
&END MOTION`
          },
          {
            type: "p",
            text: "NPT 的常见麻烦不是发散，而是晶胞一直小幅振荡、体积平均值随窗口漂移。原因通常有两个：盒子相对分子太小，压力涨落被放大；或者 barostat 的时间常数和你要观察的现象在同一个时间尺度上。前者的解法是加大超胞，后者是加大 `TIMECON`，让晶胞响应变慢。"
          },
          {
            type: "callout",
            kind: "warn",
            title: "小晶胞不要直接上 NPT",
            text: "几十个原子的小盒子在 NPT 下压力噪声很大，晶胞会跟着噪声抖。稳妥流程是先在 NVT 下把结构和温度平衡好，再用同一结构做一段短 NPT 试探，确认体积落在合理范围后才切生产。"
          },
          {
            type: "steps",
            items: [
              { t: "NVT 平衡", d: "固定实验晶胞，先把温度与局部结构跑顺。" },
              { t: "短 NPT 试探", d: "几百到一两千步，观察体积是否朝一个方向漂移。" },
              { t: "检查晶胞与密度", d: "体积变化量级要和热膨胀、初始结构误差相称，不能跳变。" },
              { t: "生产段", d: "用试探确认过的 PRESSURE、TIMECON 继续跑，并记住统计要从平衡之后算起。" }
            ]
          },
          { type: "keypoints", items: ["NPT_I 各向同性缩放，NPT_F 才放开晶胞形状", "PRESSURE 单位 bar，TIMECON 单位 fs", "先 NVT 再 NPT，别拿小盒子直接试"] }
        ]
      },
      {
        id: "14.6",
        title: "输出：轨迹、能量文件与 restart",
        blocks: [
          {
            type: "p",
            text: "不用额外设置，CP2K 也会写两样东西：坐标轨迹 `PROJECT-pos-1.xyz` 和能量文件 `PROJECT-1.ener`。能量文件每步一行，列依次是步数、时间（fs）、动能（hartree）、温度（K）、势能（hartree）、总能量（hartree）、每步墙钟时间（s），画温度曲线和守恒曲线都靠它。"
          },
          {
            type: "table",
            caption: "常用的打印开关都在 &MOTION%&PRINT 下",
            head: ["开关键", "产出", "典型频率"],
            rows: [
              ["&TRAJECTORY", "`-pos-1.xyz` 轨迹", "每 1–10 步"],
              ["&VELOCITIES", "`-vel-1.xyz` 速度", "和轨迹同频，用于后处理动力学"],
              ["&FORCES", "`-frc-1.xyz` 力", "只在调试时开，文件很大"],
              ["&RESTART", "`-1.restart` 续算文件", "每几百到几千步"],
              ["&CELL / &STRESS", "晶胞与应力", "NPT 时必须"]
            ]
          },
          {
            type: "code",
            lang: "cp2k",
            title: "只写需要的输出",
            note: "&EACH 里的 MD 10 表示每 10 个 MD 步输出一次。",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 2000
    TIMESTEP 0.5
    TEMPERATURE 330
  &END MD
  &PRINT
    &TRAJECTORY
      &EACH
        MD 10
      &END EACH
    &END TRAJECTORY
    &VELOCITIES
      &EACH
        MD 10
      &END EACH
    &END VELOCITIES
    &RESTART
      &EACH
        MD 500
      &END EACH
    &END RESTART
  &END PRINT
&END MOTION`
          },
          {
            type: "p",
            text: "续算靠 `PROJECT-1.restart`：它是一个完整输入，直接 `cp2k.psmp -i PROJECT-1.restart` 就能接着跑；也可以在自己写的输入里加一个顶层的 `&EXT_RESTART` 段，用 `RESTART_FILE_NAME` 指过去。restart 里已经包含坐标、速度、恒温器/恒压器的内部变量，所以**不要手工从轨迹最后一帧重启**——那样速度丢了，恒温器的历史也丢了，等于换了一条轨迹。"
          },
          {
            type: "callout",
            kind: "tip",
            title: "打印频率是成本项",
            text: "轨迹每步写、力每步写，在小体系上看不出来，在上千原子的体系上会明显拖慢并行效率。经验做法：坐标按分析需要定（10 步足够看振动，1 步才够做速度自相关），力只在排查问题时临时打开。"
          },
          { type: "keypoints", items: ["pos-1.xyz 与 1.ener 是默认就有的，不用额外开", "restart 里带速度和恒温器状态，续算要用它", "输出频率按分析需求定，别默认每步全写"] }
        ]
      },
      {
        id: "14.7",
        title: "能量守恒检查与 AIMD 的额外注意点",
        blocks: [
          {
            type: "p",
            text: "NVE 下总能量应当守恒，实际只会小幅振荡，振荡幅度来自积分器误差。可用的判据是：扣除平衡前的一小段后，`e_tot` 的最大值与最小值之差相对于平均动能足够小，并且**没有单向漂移**。漂移比振幅更危险——它说明每一步都在系统性地注入或抽走能量。"
          },
          {
            type: "formula",
            tex: "\\frac{\\max E_{\\rm tot}-\\min E_{\\rm tot}}{\\langle E_{\\rm kin}\\rangle} \\ll 1,\\qquad \\frac{\\Delta E_{\\rm tot}}{\\Delta t}\\approx 0",
            caption: "看振幅，更看漂移；具体阈值随体系与步长变化，要自己标定"
          },
          {
            type: "list",
            ordered: true,
            items: [
              "先确认每一步 SCF 都**收敛**，日志里不应出现未收敛的警告。",
              "再确认结构合理：最短原子间距没有塌缩，也没有原子飞出盒子。",
              "然后才看 e_tot 的振幅与漂移；此时出现漂移才归因到时间步。",
              "最后看温度：NVT 下温度应围绕目标值涨落，而不是稳定偏高或偏低。"
            ]
          },
          {
            type: "p",
            text: "AIMD 与经典 MD 的区别在于：每一步都要重新解一次电子结构，力是「近似收敛的电子结构」给出的。所以电子结构精度直接变成力噪声，力噪声再变成能量漂移和人为加热。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "AIMD 该收紧的两处",
            note: "截断与 SCF 阈值是主要控制点；外推用来省掉每步的重复迭代。",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &MGRID
      CUTOFF 400
      REL_CUTOFF 40
    &END MGRID
    &QS
      EPS_DEFAULT 1.0E-12
      EXTRAPOLATION ASPC
      EXTRAPOLATION_ORDER 3
    &END QS
    &SCF
      SCF_GUESS RESTART
      EPS_SCF 1.0E-6
      MAX_SCF 30
    &END SCF
  &END DFT
&END FORCE_EVAL`
          },
          {
            type: "p",
            text: "`EXTRAPOLATION` 用前几步的波函数外推下一步的初猜，`ASPC` 配 `EXTRAPOLATION_ORDER 3` 是好用的起点，能明显减少每步迭代次数。但外推只是初猜：如果外推质量差，SCF 迭代会变多甚至不收敛，这时要检查结构是否在剧烈变化，而不是一味放宽阈值。"
          },
          {
            type: "callout",
            kind: "danger",
            title: "截断放太松 = 给体系装了一个加热器",
            text: "把 CUTOFF 或 EPS_SCF 放宽，单步能快一点，但力变得不平滑。轨迹上表现为总能量单向漂移、温度缓慢上升，而且看起来「一切正常」。这类问题在短轨迹上极难发现，往往要跑几千步才暴露。"
          },
          { type: "keypoints", items: ["守首要看漂移，不只看振幅", "SCF 收敛不了时先怀疑结构，再怀疑阈值", "AIMD 的截断与 EPS_SCF 决定力的平滑程度"] }
        ]
      }
    ],
    quiz: [
      {
        q: "想标定时间步是否合适，最合适的做法是？",
        options: [
          "在 NVT 下跑长轨迹，看温度是否稳定",
          "在 NVE 下跑短轨迹，看总能量是否漂移",
          "把 TIMESTEP 直接设成 2 fs，能跑完就说明没问题",
          "看轨迹文件里原子是否飞出去"
        ],
        answer: 1,
        explain: "NVE 没有恒温器掩盖问题，能量漂移会直接暴露积分器误差；能跑完不等于结果可信。"
      },
      {
        q: "`&MD%&THERMOSTAT%&CSVR%TIMECON` 的单位与含义是？",
        options: [
          "fs，恒温器响应的时间常数，越小控温越强",
          "K，目标温度",
          "bar，外部压力",
          "hartree，恒温器的能量偏置"
        ],
        answer: 0,
        explain: "TIMECON 以 fs 计，表示恒温器把温度拉回目标的快慢；默认 1000 fs 对短轨迹几乎等于不控温。"
      },
      {
        q: "体系要允许晶胞三个方向独立变形，应选哪个系综？",
        options: ["NVT", "NVE", "NPT_I", "NPT_F"],
        answer: 3,
        explain: "NPT_I 只做各向同性缩放，NPT_F 才允许晶胞形状与各轴长度独立变化。"
      },
      {
        q: "关于 CP2K 的恒温器，下面哪句是错的？",
        options: [
          "TYPE 默认是 NOSE",
          "常规 NVT 生产推荐 CSVR",
          "TYPE 里可以直接选 BERENDSEN",
          "ENSEMBLE LANGEVIN 配合 &MD%&LANGEVIN%GAMMA 使用"
        ],
        answer: 2,
        explain: "CP2K 的 THERMOSTAT TYPE 没有 BERENDSEN 这一项；想要更强的控温应把 CSVR 的 TIMECON 调小。"
      },
      {
        q: "轨迹跑了 500 步后要续算，正确做法是？",
        options: [
          "取轨迹最后一帧坐标，重新生成速度",
          "用 PROJECT-1.restart，它包含速度与恒温器状态",
          "重新从初始结构开始，把 STEPS 改成 500",
          "把 .ener 文件最后一行的能量读进来当初始能量"
        ],
        answer: 1,
        explain: "restart 文件保存了坐标、速度以及恒温器/恒压器的内部变量；手工从轨迹重启会丢失速度与热浴历史。"
      }
    ],
    terms: [
      { t: "系综", en: "Ensemble", d: "一组宏观约束下所有微观状态的集合；在输入里表现为固定哪些热力学量。" },
      { t: "恒温器", en: "Thermostat", d: "让体系维持目标温度的机制，CP2K 中由 &MD%&THERMOSTAT 控制。" },
      { t: "恒压器", en: "Barostat", d: "让体系维持目标外压、允许晶胞变化的机制，由 &MD%&BAROSTAT 控制。" },
      { t: "时间步", en: "Timestep", d: "相邻两个 MD 步之间的物理时间，默认 0.5 fs，决定能分辨的最高频率。" },
      { t: "平衡段", en: "Equilibration", d: "丢弃的初始阶段，用于让温度、密度、局部结构达到稳定。" },
      { t: "生产段", en: "Production run", d: "真正用来做统计分析的轨迹段，必须在平衡之后开始计。" },
      { t: "外推", en: "Extrapolation", d: "用前几步波函数外推下一步初猜，减少 AIMD 每步的 SCF 迭代。" }
    ],
    sources: [
      { t: "CP2K 手册：Molecular Dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/molecular_dynamics.html" },
      { t: "CP2K 手册：Langevin Dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/langevin_dynamics.html" },
      { t: "输入参考：MOTION/MD", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD.html" },
      { t: "输入参考：MOTION/MD/THERMOSTAT", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD/THERMOSTAT.html" }
    ]
  };
})();