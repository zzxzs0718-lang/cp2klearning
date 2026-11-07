(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch11"] = {
    id: "ch11",
    num: 11,
    part: "动力学与自由能",
    title: "AIMD 实战：从平衡到生产",
    subtitle: "NVT 采样、SCF 外推、约束、重启与自检",
    hours: 5.0,
    level: "高级",
    intro:
      "AIMD 每一步都重算电子结构，轨迹可信不可信，取决于四件事：SCF 有没有真的收敛、步长是否匹配最快振动、恒温器有没有破坏分布、采样够不够长。这一章用课程里一条真实的 Au–水界面 NVT 输入，把参数选择、波函数外推、固定原子、重启和自检串成一条能复现的流程。",
    goals: [
      "独立写出 NVT/NVE 的 AIMD 输入，并解释 ENSEMBLE、TIMESTEP、STEPS 的作用",
      "按体系选择恒温器与时间常数，说清速度调节、Nosé–Hoover 与 CSVR 的差别",
      "配置 ASPC 外推与每步 SCF，避免轨迹因 SCF 不收敛而崩掉",
      "设计平衡段与生产段，按目标频率输出轨迹与重启文件",
      "用能量、温度与 SCF 记录判断一条轨迹是否可信，并会从重启文件续算",
    ],
    sections: [
      {
        id: "11.1",
        title: "一条 AIMD 输入由哪几块组成",
        blocks: [
          {
            type: "p",
            text: "AIMD 与单点计算共用同一套 `&FORCE_EVAL`，区别只在 `RUN_TYPE MD` 和 `&MOTION/&MD`。电子结构部分要额外关心两件事：每步 SCF 的收敛阈值，以及上一步波函数怎样被复用成下一步的初猜；运动部分则决定系综、步长、步数与输出频率。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "最小 AIMD 骨架（水盒子示例）",
            text: `&GLOBAL
  PROJECT aimd
  RUN_TYPE MD
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SCF
      EPS_SCF 1.0E-6
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 12.0
    &END CELL
    &COORD
      @INCLUDE coord.inc
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
&END FORCE_EVAL`,
          },
          {
            type: "code",
            lang: "cp2k",
            title: "运动部分：NVT + CSVR",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    TIMESTEP 0.5
    STEPS 20000
    TEMPERATURE 330.0
    &THERMOSTAT
      TYPE CSVR
      &CSVR
        TIMECON 100.0
      &END CSVR
    &END THERMOSTAT
  &END MD
&END MOTION`,
          },
          {
            type: "p",
            text: "`&MD` 里 `STEPS` 与 `MAX_STEPS` 是同义词；`TIMESTEP` 单位 fs，默认 0.5。`&THERMOSTAT` 只在 NVT 下有意义；NVE 不写恒温器，靠初始温度决定总能量。手册建议 AIMD 步长取 0.5–1.0 fs，水与有机分子通常用 0.5 fs。",
          },
          {
            type: "callout",
            kind: "key",
            title: "先问三个问题",
            text: "这条轨迹要回答什么？需要多长的相关时间？体系里最快的振动是什么？三个答案决定步长、总步数与输出间隔；先定这三个，再调 SCF 和基组，不要反过来。",
          },
        ],
      },
      {
        id: "11.2",
        title: "系综与恒温器：别把分布搞坏",
        blocks: [
          {
            type: "p",
            text: "`ENSEMBLE` 可选 NVE、NVT、NPT_I、NPT_F 与 LANGEVIN。AIMD 原子数通常只有几十到几百，压强涨落很大，所以 NPT 要谨慎；多数结构性质用 NVT，能量守恒检查用 NVE。",
          },
          {
            type: "table",
            head: ["恒温器", "怎么做", "适用与代价"],
            rows: [
              ["速度调节", "每步把速度整体缩放到目标温度", "预平衡可用；破坏正则分布，生产段不要用"],
              ["Andersen", "随机碰撞重置速度", "分布正确，但轨迹不平滑，动力学性质受影响"],
              ["Nosé–Hoover", "引入额外热浴自由度", "分布正确；耦合由 TIMECON 控制，参数不当时温度振荡"],
              ["CSVR", "随机速度重标，保持正则分布", "手册推荐；轨迹较平滑，TIMECON 控制耦合强弱"],
              ["Langevin", "摩擦 + 随机力", "有明确温度，但摩擦会改变扩散系数"],
            ],
          },
          {
            type: "p",
            text: "CSVR 的 `TIMECON` 越大，耦合越松：50 耦合快，100 是默认，200 更温和。耦合太快会把真实的热涨落压平，太慢则平衡需要很久。选一个比体系最快振动周期长、又比目标相关时间短的值，并在方法段写清楚。",
          },
          {
            type: "p",
            text: "NPT 还要配 `&BAROSTAT`，给 `PRESSURE` 与 `TIMECON`。如果只是要 300 K 下的结构或谱，NVT 更省事；如果结论依赖密度，先跑 NPT 得到平衡体积，再用该体积跑 NVT 生产。",
          },
        ],
      },
      {
        id: "11.3",
        title: "步长、SCF 与外推",
        blocks: [
          {
            type: "p",
            text: "步长由最快振动决定：经验是取最快周期的 1/10–1/20。水 O–H 伸缩在 3300–3600 cm⁻¹，周期约 10 fs，所以 0.5 fs 能给出足够的时间分辨率；把步长加到 2 fs，高频振动立刻失真，能量漂移也跟着上来。",
          },
          {
            type: "p",
            text: "每步 SCF 要比静态计算更严。`EPS_SCF` 1E-6 是常用起点；1E-4 会让力带明显噪声，NVE 下很快就能看到总能量漂移。除了阈值，还要给 `MAX_SCF` 留余量，并监控输出里有没有 `SCF run NOT converged`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "在 &DFT 里加波函数外推",
            text: `&DFT
  &MGRID
    CUTOFF 400
    REL_CUTOFF 60
  &END MGRID
  &QS
    WF_INTERPOLATION ASPC
    EXTRAPOLATION_ORDER 3
  &END QS
&END DFT`,
          },
          {
            type: "p",
            text: "`WF_INTERPOLATION ASPC` 用前几步的波函数外推下一步的初猜，默认就是 ASPC，`EXTRAPOLATION_ORDER 3` 是常用阶数。它只改变初猜，不改变收敛判据：省下来的是 SCF 迭代次数，不是精度。体系变化剧烈（成断键、扩散事件）时，外推可能反而拖慢收敛，看 `SCF` 迭代数再决定。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "金属与窄带隙",
            text: "金属体系要开 `&SMEAR`，用 Fermi–Dirac 展宽让占据数连续；展宽温度是数值参数，报告时要说明。开 smearing 后能量不再是严格变分量，比较不同展宽的结果要小心。",
          },
        ],
      },
      {
        id: "11.4",
        title: "平衡段、生产段与输出节奏",
        blocks: [
          {
            type: "p",
            text: "一条能用的轨迹分三段：**优化**（拿到合理几何）、**平衡**（让温度、密度、氢键网络松弛）、**生产**（只采样，不改变设置）。平衡段长度取决于体系，水和有机液体通常几 ps；界面与聚合物要更长。生产段至少 10 ps，才谈得上统计。",
          },
          {
            type: "p",
            text: "升温不要一步到位。可以先把温度设低跑一段，再用 `ANNEALING` 或分段升温到目标值；每换一次温度，重新平衡。平衡段的数据不能拿去做生产平均，判断标准是温度、势能与关键结构量不再有单调漂移。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "轨迹与重启的输出频率",
            text: `&MOTION
  &PRINT
    &TRAJECTORY
      &EACH
        MD 50
      &END EACH
    &END TRAJECTORY
    &RESTART
      &EACH
        MD 100
      &END EACH
    &END RESTART
  &END PRINT
&END MOTION`,
          },
          {
            type: "p",
            text: "输出间隔是精度与磁盘的折中。每 50 步存一帧、步长 0.5 fs，就是 25 fs 一帧；100 ps 会产生约 4000 帧，xyz 很快到几百 MB。重启每 100 步（50 fs）一次，既能在崩溃后少丢时间，也不会写得太频繁。",
          },
          {
            type: "table",
            head: ["量", "建议起点", "怎么判断够不够"],
            rows: [
              ["步长", "0.5 fs", "能量漂移、振动谱是否失真"],
              ["平衡段", "几 ps", "温度与势能无单调漂移"],
              ["生产段", "≥10 ps", "目标量的块平均误差可接受"],
              ["轨迹间隔", "25–50 fs", "相关时间与谱分辨率"],
              ["重启间隔", "50 fs 左右", "崩溃时可接受的重算量"],
            ],
          },
        ],
      },
      {
        id: "11.5",
        title: "约束与固定原子",
        blocks: [
          {
            type: "p",
            text: "表面、电极与生物体系常需要固定一部分原子，避免有限尺寸盒子整体漂移，或保持底层晶格。CP2K 用 `&MOTION/&CONSTRAINT/&FIXED_ATOMS`，`LIST` 支持 `151..174` 这样的区间写法。固定的原子不参与积分，但仍在力与能量的计算里。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "固定 151–174 号原子",
            text: `&MOTION
  &CONSTRAINT
    &FIXED_ATOMS
      LIST 151..174
    &END FIXED_ATOMS
  &END CONSTRAINT
&END MOTION`,
          },
          {
            type: "p",
            text: "固定原子会改变体系的自由度与振动谱：被固定的模式不再出现，热容与熵也少了一部分。做热力学量时要么把固定部分单独处理，要么明确声明这是「部分驰豫」的结果。对表面吸附，固定底层、放开表面与吸附物是常见折中。",
          },
          {
            type: "p",
            text: "如果约束的是一个集体变量而不是单个原子，用 `&CONSTRAINT/&COLLECTIVE`，配 `&SUBSYS/&COLVAR` 定义距离、配位数或组合变量。约束 MD、拉格朗日乘子与自由能积分是下一章的主题；这一章只需要知道固定原子与约束 MD 是两套不同机制。",
          },
        ],
      },
      {
        id: "11.6",
        title: "重启与续算",
        blocks: [
          {
            type: "p",
            text: "AIMD 跑到一半断电、被调度器杀掉、或需要加长，都靠重启文件恢复。CP2K 默认写 `项目名-1.restart`，里面包含坐标、速度、恒温器状态与输入副本；续算时用 `&EXT_RESTART` 指向它。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "从 restart 文件续算",
            text: `&EXT_RESTART
  RESTART_FILE_NAME cp2k-1.restart
  RESTART_POS T
  RESTART_VEL T
  RESTART_THERMOSTAT T
&END EXT_RESTART`,
          },
          {
            type: "p",
            text: "三个开关分别恢复坐标、速度与恒温器状态。只恢复坐标而不恢复速度，等于把一条热轨迹重新从静止起步，温度会先掉下去；只恢复速度不恢复恒温器，Nosé–Hoover 的额外自由度会从头开始，前期温度会漂。",
          },
          {
            type: "p",
            text: "续算时改 `STEPS` 是在原步数上继续，还是从零重新计，取决于 restart 文件里的计数器；最稳妥的做法是保留原输入，只改步数与输出文件名，跑完检查 `cp2k-1.ener` 的时间列是否连续。",
          },
          {
            type: "callout",
            kind: "key",
            title: "重启不是备份",
            text: "restart 文件只保证能继续跑，不保证和原轨迹逐位一致。换核数、换 CP2K 版本、换数学库都会改变浮点求和顺序；需要严格复现时，连编译选项与并行布局一起记录。",
          },
        ],
      },
      {
        id: "11.7",
        title: "自检：能量、温度与 SCF",
        blocks: [
          {
            type: "p",
            text: "跑完先看三样：`项目-1.ener` 的时间序列、输出里的 SCF 收敛记录、以及轨迹本身。能量文件每行依次是步数、时间、动能、温度、势能、总能量；用 awk 抽出来就能画图。",
          },
          {
            type: "code",
            lang: "bash",
            title: "抽取温度与总能量",
            text: `awk 'NR>1 {print $1, $4, $6}' cp2k-1.ener > thermo.dat
tail -n 5 thermo.dat`,
          },
          {
            type: "p",
            text: "NVE 下总能量应是一条水平线；漂移随时间线性增大，说明步长太大、SCF 太松或外推失效。NVT 有恒温器交换能量，总能量本来就不守恒，改看温度是否在目标值附近涨落、势能是否平稳。",
          },
          {
            type: "p",
            text: "温度突然飙升、原子飞散、能量出现 NaN，第一嫌疑永远是 SCF 没收敛。去输出里搜 `NOT converged`，看是哪一步开始；再看那一步的几何是否出现原子重叠。AIMD 不允许「SCF 失败也继续跑」，一步坏波函数会污染后面所有步骤。",
          },
          {
            type: "keypoints",
            items: [
              "NVE 看总能量漂移，NVT 看温度分布与势能平稳",
              "EPS_SCF 1E-6 起步；出现 NOT converged 先停下来修",
              "步长 0.5 fs 对应水 O–H 周期的约 1/20",
              "平衡段数据不能进生产平均",
            ],
          },
        ],
      },
      {
        id: "11.8",
        title: "案例：Au–水界面的 330 K NVT",
        blocks: [
          {
            type: "p",
            text: "课程练习里有一条 Au–水界面的 NVT 输入：盒子 8.6507 × 9.9899 × 31.0 Å，330 K，100000 步 × 0.5 fs = 50 ps，固定 151–174 号原子，PBE + DZVP-MOLOPT-SR-GTH，`CUTOFF 350`，开 UKS 与 Fermi–Dirac 展宽。下面是它的电子结构核心，路径变量按你的环境替换。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Au–水案例：DFT 与 SCF 设置（节选）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME \${DATAPATH}/BASIS_MOLOPT
    POTENTIAL_FILE_NAME \${DATAPATH}/GTH_POTENTIALS
    WFN_RESTART_FILE_NAME ./cp2k-RESTART.wfn
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
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "运动部分用 Nosé–Hoover，`LENGTH 3`、`YOSHIDA 3`、`MTS 2`，`TIMECON` 写成 `[wavenumber_t] 1000`，折合约 33 fs（注意这里的单位是波数，不是 fs）；同时固定 151–174 号原子。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Au–水案例：MD 与约束（节选）",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 100000
    TIMESTEP 0.5
    TEMPERATURE 330.0
    &THERMOSTAT
      TYPE NOSE
      &NOSE
        LENGTH 3
        YOSHIDA 3
        MTS 2
        TIMECON [wavenumber_t] 1000
      &END NOSE
    &END THERMOSTAT
  &END MD
  &CONSTRAINT
    &FIXED_ATOMS
      LIST 151..174
    &END FIXED_ATOMS
  &END CONSTRAINT
&END MOTION`,
          },
          {
            type: "p",
            text: "这条输入还留了一个没启用的 `&GEO_OPT` 块：`RUN_TYPE MD` 时它不执行，改了 `RUN_TYPE GEO_OPT` 才生效。案例的金属 slab 开了 `UKS` 与 `SMEAR`，`ADDED_MOS 500` 给展宽留空带；如果关掉 smearing，金属的 SCF 会来回振荡。",
          },
          {
            type: "p",
            text: "生产轨迹的用途是界面结构：水的密度分布、O–O/O–H 径向分布、氢键数与寿命、表面原子的均方位移。RDF 与 MSD 的具体算法放在第 13 章；这里只需确认轨迹的时间步、帧间隔与盒子，后处理才不会把单位弄错。",
          },
          {
            type: "demo",
            id: "md",
            title: "动手：切换系综与恒温器",
            desc: "在 MD 演示里把 NVT 换成 NVE，改 CSVR 的 TIMECON，观察温度与总能量曲线各自怎么变。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "水与有机分子的 AIMD，步长通常从多少开始？",
        options: ["0.1 fs", "0.5 fs", "2 fs", "5 fs"],
        answer: 1,
        explain: "水 O–H 伸缩周期约 10 fs，步长取周期的 1/10–1/20，即 0.5 fs 左右。步长过大让高频振动失真，能量漂移也会增大。",
      },
      {
        q: "CSVR 恒温器的 TIMECON 从 100 改成 200，意味着什么？",
        options: [
          "耦合更强，温度被拉得更紧",
          "耦合更弱，温度涨落恢复得更慢",
          "目标温度自动翻倍",
          "只对 NVE 生效",
        ],
        answer: 1,
        explain: "TIMECON 是耦合时间常数，越大耦合越松。50 耦合快，100 默认，200 更温和；太强会把真实热涨落压平。",
      },
      {
        q: "`WF_INTERPOLATION ASPC` 的主要作用是？",
        options: [
          "把 SCF 收敛阈值自动放松",
          "用前几步波函数外推下一步初猜，减少 SCF 迭代",
          "把 NVT 改成 NVE",
          "替代赝势",
        ],
        answer: 1,
        explain: "ASPC 只改变每步 SCF 的初始猜测，不改变收敛判据与物理；`EXTRAPOLATION_ORDER` 控制用多少阶历史。",
      },
      {
        q: "NVE 轨迹里总能量随时间线性下降，最不该先怀疑什么？",
        options: [
          "步长太大",
          "EPS_SCF 太松",
          "恒温器参数不对",
          "外推设置不合适",
        ],
        answer: 2,
        explain: "NVE 没有恒温器，总能量漂移与恒温器无关。先查步长、SCF 阈值与波函数外推；NVT 才需要讨论恒温器。",
      },
      {
        q: "用 `&EXT_RESTART` 续算时，只恢复坐标不恢复速度会怎样？",
        options: [
          "没有任何影响",
          "温度会先异常下降，轨迹不等于原轨迹的延续",
          "会自动重新升温到目标值",
          "SCF 一定不收敛",
        ],
        answer: 1,
        explain: "速度携带动能与温度信息；只恢复坐标相当于从静止起步。要延续热轨迹，坐标、速度与恒温器状态一起恢复。",
      },
    ],
    terms: [
      { t: "AIMD", en: "ab initio molecular dynamics", d: "每一步都用电子结构计算力的分子动力学；轨迹精度受 SCF、步长与采样长度限制。" },
      { t: "系综", en: "ensemble", d: "固定宏观条件的统计集合；NVE 固定能量，NVT 固定温度，NPT 固定温度与压强。" },
      { t: "恒温器", en: "thermostat", d: "在 NVT 中维持目标温度的算法；不同实现会改变分布与动力学。" },
      { t: "CSVR", en: "canonical sampling through velocity rescaling", d: "随机速度重标恒温器，保持正则分布且轨迹较平滑，手册推荐。" },
      { t: "ASPC", en: "always stable predictor-corrector", d: "用历史波函数外推下一步初猜的方法，减少每步 SCF 迭代。" },
      { t: "能量漂移", en: "energy drift", d: "NVE 中总能量随时间的系统性偏移；通常来自步长过大或 SCF 不收敛。" },
      { t: "约束 MD", en: "constrained MD", d: "固定原子或集体变量的分子动力学；固定原子减少自由度，集体变量约束用于自由能计算。" },
    ],
    sources: [
      { t: "Methods / Molecular Dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/molecular_dynamics.html" },
      { t: "CP2K_INPUT / MOTION / MD", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD.html" },
      { t: "CP2K_INPUT / MOTION / MD / THERMOSTAT / CSVR", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD/THERMOSTAT/CSVR.html" },
      { t: "Methods / Restarting CP2K Calculations", url: "https://manual.cp2k.org/trunk/methods/restarting.html" },
      { t: "CP2K_INPUT / MOTION / CONSTRAINT / FIXED_ATOMS", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/CONSTRAINT/FIXED_ATOMS.html" },
    ],
  };
})();