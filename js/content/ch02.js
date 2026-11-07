(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch02"] = {
    id: "ch02",
    num: 2,
    part: "起步",
    title: "AIMD 基础：势能面、系综与时间步",
    subtitle: "把「每步算一次电子结构」这件事拆开看",
    hours: 4.0,
    level: "入门",
    intro:
      "AIMD 不神秘：每一步用 DFT 算力，再用牛顿方程把原子推一小步。真正决定结果可不可信的是四件事——势能面是否连续、系综是否选对、时间步是否够小、每步 SCF 是否收敛。这一章按这四件事展开，最后给出一张 VASP→CP2K 的参数对照表。",
    goals: [
      "在势能面上区分极小点、过渡态与高阶鞍点，并说清 AIMD 采样的是什么",
      "描述一步 BOMD 的完整流程，解释 SCF 收敛、ASPC 与时间步的关系",
      "写出 NVE/NVT/NPT 的能量与温度约束，算出一个体系的自由度数",
      "根据最轻原子的振动频率选择时间步，并用 NVE 能量漂移验证",
      "把 VASP 的 NSW、POTIM、SMASS、NBLOCK 映射到 CP2K 关键词",
    ],
    sections: [
      {
        id: "2.1",
        title: "势能面：AIMD 在什么上面滚动",
        blocks: [
          {
            type: "p",
            text: "把 3N 个核坐标记作 $R$，电子基态能量记作 $E(R)$，这张 3N 维的曲面就是**势能面**（PES）。原子受力是它的负梯度，AIMD 做的就是让原子沿这张曲面滚动。",
          },
          {
            type: "formula",
            tex: "F_I=-\\frac{\\partial E(R)}{\\partial R_I},\\qquad M_I\\ddot{R}_I=F_I",
            caption: "第一式由电子结构给出，第二式由经典力学积分。AIMD 的「A」就体现在第一式每步都重算。",
          },
          {
            type: "p",
            text: "曲面上梯度为零的点叫**驻点**。用二阶导（Hessian）分类：所有方向都为正，是**极小点**；恰有一个方向为负，是**一阶鞍点**，也就是过渡态；有两个及以上负方向，是更高阶的鞍点，通常不是有物理意义的反应通道。",
          },
          {
            type: "table",
            head: ["类型", "梯度", "Hessian 本征值", "物理含义"],
            rows: [
              ["极小点", "0", "全部为正", "稳定结构、反应物、产物、中间体"],
              ["一阶鞍点", "0", "恰有一个为负", "过渡态；需频率分析确认只有一个虚频"],
              ["高阶鞍点", "0", "两个及以上为负", "通常是路径交叉点，不是反应过渡态"],
              ["普通点", "非零", "—", "受力，会沿负梯度方向移动"],
            ],
            caption: "几何优化找极小点，过渡态搜索找一阶鞍点，两者都必须用频率验证。",
          },
          {
            type: "p",
            text: "连接两个极小点、并经过一阶鞍点的最低能量路径叫 **IRC**（内禀反应坐标）。它是在质量加权坐标下定义的，不是简单的直线插值。第 9 章会用 NEB/dimer 实际找它。",
          },
          {
            type: "p",
            text: "AIMD 与几何优化的关系要说清：优化是**沿势能面往下走，直到受力小于阈值**；AIMD 是**给体系一个温度，让它在势能面上不停运动**。有限温度的轨迹不会停在极小点，而是在盆地内来回穿越，偶尔翻过鞍点——这正是它能采样构象与反应的原因。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "AIMD 不是「更贵的优化」",
            text: "如果目标只是一个稳定结构，用 GEO_OPT 更快更准。AIMD 的价值是温度、熵、时间相关性与稀有事件；用 100 ps 轨迹去「优化」一个结构，是把机时花在了不需要的地方。",
          },
        ],
      },
      {
        id: "2.2",
        title: "一步 AIMD 里发生了什么：电子步与离子步",
        blocks: [
          {
            type: "p",
            text: "下面是一份可以直接跑的最小 NVT 输入：一个水分子放在 10 Å 的非周期盒子里，300 K，时间步 0.5 fs，只跑 10 步。它的作用是让你看清 MD 段与 SCF 段如何咬合，不是生产算例。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_md.inp：10 步 NVT",
            text: `&GLOBAL
  PROJECT h2o_md
  RUN_TYPE MD
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
      EXTRAPOLATION ASPC
      EXTRAPOLATION_ORDER 3
    &END QS
    &SCF
      SCF_GUESS ATOMIC
      EPS_SCF 1.0E-6
      MAX_SCF 50
      &OT
        MINIMIZER DIIS
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
    &POISSON
      PERIODIC NONE
      PSOLVER MT
    &END POISSON
  &END DFT
  &SUBSYS
    &CELL
      ABC 10.0 10.0 10.0
      PERIODIC NONE
    &END CELL
    &COORD
      O   0.0000   0.0000   0.0000
      H   0.7570   0.5860   0.0000
      H  -0.7570   0.5860   0.0000
    &END COORD
    &KIND H
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
    &KIND O
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
  &END SUBSYS
&END FORCE_EVAL

&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 10
    TIMESTEP 0.5
    TEMPERATURE 300
    &THERMOSTAT
      TYPE CSVR
      &CSVR
        TIMECON 100
      &END CSVR
    &END THERMOSTAT
    &PRINT
      &ENERGY
        &EACH
          MD 1
        &END EACH
      &END ENERGY
    &END PRINT
  &END MD
  &PRINT
    &TRAJECTORY
      &EACH
        MD 1
      &END EACH
    &END TRAJECTORY
    &RESTART_HISTORY
      &EACH
        MD 5
      &END EACH
    &END RESTART_HISTORY
  &END PRINT
&END MOTION`,
          },
          {
            type: "p",
            text: "一次 MD 步的顺序是固定的：**位置与速度 → 用当前核坐标做 SCF → 得到力 → 用积分器更新速度与位置 → 输出 → 进入下一步**。所以 `STEPS 10` 意味着至少 10 次独立的电子结构求解，而不是一次 SCF 算 10 个几何。",
          },
          {
            type: "p",
            text: "每一步的 SCF 不一定要收敛到静态计算那么紧。课程给的经验是：`EPS_SCF 1E-6` 足够让能量漂移可以接受；`1E-4` 会让 NVE 的总能量明显漂移；`1E-5` 在长轨迹（数百 ps）后也会显现。手册也提醒，AIMD 更看重**力的稳定与漂移**，而不是每一步都把能量压到极限。",
          },
          {
            type: "p",
            text: "为了减少每步 SCF 迭代，CP2K 在常规 BOMD 中默认用 **ASPC** 外推历史电子密度作为初猜。上例显式写了 `EXTRAPOLATION ASPC` 与 `EXTRAPOLATION_ORDER 3`，通常 3 阶就够；轨迹连续时，它能明显减少每步的 SCF 迭代次数。反过来，如果体系发生突变（成键、断键、吸附），外推会失准，SCF 迭代数会突然上升——这本身就是一个有用的信号。",
          },
          {
            type: "p",
            text: "成本可以这样估：假设每步 SCF 加力总共 50 秒，时间步 1 fs，一天 86400 秒能跑 1728 步，也就是约 1.7 ps；想跑 30 ps，需要约 17 天。这是课程给的量级，用来判断「这个课题的轨迹长度现不现实」，不是对你的机器的承诺。",
          },
          {
            type: "h3",
            text: "BOMD 与 Ehrenfest 的区别",
          },
          {
            type: "p",
            text: "**BOMD** 在每一步都把电子结构调整到当前核坐标的基态，原子只感受到一个势能面的力；**Ehrenfest dynamics** 则让电子波函数随时间演化，原子受到的是多个态按布居加权的平均力。前者便宜、适合基态平衡性质；后者能描述非绝热跃迁、激光激发等过程，但需要很小的电子时间步，成本高得多。CP2K 主用的是 BOMD，Ehrenfest 是专门场景的工具。",
          },
          {
            type: "keypoints",
            items: [
              "一步 AIMD = 一次 SCF/力计算 + 一次积分器更新",
              "STEPS 是离子步数，不是 SCF 次数；每步都重新解电子结构",
              "ASPC 用历史密度外推初猜，减少 SCF 迭代；轨迹突变时失效",
              "BOMD 走单一基态势能面，Ehrenfest 走含时电子态平均力",
            ],
          },
        ],
      },
      {
        id: "2.3",
        title: "系综：NVE、NVT、NPT 各固定了什么",
        blocks: [
          {
            type: "p",
            text: "系综回答的是「哪些量固定」。AIMD 里最常用 NVE 与 NVT；NPT 不是不能用，而是小体系的压力涨落太大，课程明确建议原子数少的 AIMD 优先 NVT/NVE，体积提前算好。",
          },
          {
            type: "table",
            head: ["系综", "固定", "允许涨落", "典型用途", "CP2K 写法"],
            rows: [
              ["NVE", "N、V、E", "温度", "验证时间步与能量守恒；孤立体系生产", "`ENSEMBLE NVE`"],
              ["NVT", "N、V、T", "总能量", "固定体积的平衡与生产；AIMD 最常用", "`ENSEMBLE NVT` + 恒温器"],
              ["NPT_I", "N、P、T", "体积（各向同性）", "液体、气体、近似各向同性固体", "`ENSEMBLE NPT_I` + 恒压器"],
              ["NPT_F", "N、P、T", "体积与晶胞形状", "各向异性固体、界面", "`ENSEMBLE NPT_F` + 恒压器"],
            ],
            caption: "NPT 的 I/F 是各向同性/柔性晶胞；小盒子做 NPT 容易出现非物理的晶胞振荡。",
          },
          {
            type: "p",
            text: "温度不是输入值，而是从动能反推的统计量。对 $N_c$ 个自由度：",
          },
          {
            type: "formula",
            tex: "\\langle E_{\\mathrm{kin}}\\rangle=\\frac{3}{2}N_c k_B T,\\qquad N_c=3N-3-3N_{\\mathrm{fixed}}",
            caption: "减 3 是去掉质心平动；若还固定了原子层，再减去 3N_fixed。固定的 10 个原子等于去掉 30 个自由度。",
          },
          {
            type: "p",
            text: "这解释了为什么小体系的温度涨落大：$N_c$ 越小，瞬时温度围绕均值的相对涨落越明显。一个 3 原子的水分子在 300 K 下温度可以瞬间跳到几百 K，这不代表恒温器坏了。生产计算里不要用单帧温度判断平衡。",
          },
          {
            type: "p",
            text: "NVE 下不能用恒温器，否则就不是 NVE 了。它的用途是**诊断**：给一个合理的初始结构，跑短轨迹，看总能量是否漂移。NVT 下总能量本来就会被恒温器交换，不能拿它判断时间步好坏。",
          },
          {
            type: "callout",
            kind: "info",
            title: "AIMD 为什么少做 NPT",
            text: "压力是维里与动能的瞬时量，原子数少时涨落极大。用几十个原子去控压，晶胞会被噪声推着振荡，得到的密度不可信。常见做法是先用实验/经典 MD 定好体积，再做 NVT；确需 NPT 时，至少用足够大的超胞与较长的恒压器时间常数。",
          },
        ],
      },
      {
        id: "2.4",
        title: "时间步与积分器：0.5 fs 不是随便定的",
        blocks: [
          {
            type: "p",
            text: "CP2K 用 velocity Verlet 积分牛顿方程。它每步只需一次力计算，误差是时间步的二阶；代价是时间步必须小到能分辨最快的核运动，否则能量会持续注入或耗散。",
          },
          {
            type: "formula",
            tex: "R(t+\\Delta t)=R(t)+v(t)\\Delta t+\\frac{F(t)}{2M}\\Delta t^2,\\qquad v(t+\\Delta t)=v(t)+\\frac{F(t)+F(t+\\Delta t)}{2M}\\Delta t",
            caption: "速度更新用到新旧两步的力，所以每步只需存一份力；这也是它比高阶积分器流行的原因。",
          },
          {
            type: "p",
            text: "选步长的经验规则是：**最快振动周期除以 10 到 20**。水分子的 O–H 伸缩在 3300–3600 cm⁻¹，周期约 9–10 fs，除以 20 得到 0.5 fs；重水 O–D 约 2500 cm⁻¹，周期更长，可以用到 1 fs 以上。课程给的经验区间是 0.5–2 fs，手册对含轻原子的 AIMD 建议从 0.5–1.0 fs 起步。",
          },
          {
            type: "table",
            head: ["体系/条件", "建议步长", "原因"],
            rows: [
              ["含 O–H、N–H 等轻原子", "0.5 fs", "高频伸缩，周期约 10 fs"],
              ["只含重原子、已优化结构", "1.0–1.5 fs", "最快振动周期更长"],
              ["高温、反应性、初始结构差", "0.25–0.5 fs", "力变化剧烈，需要更细的积分"],
              ["加了键长约束或氘代", "可适当放大", "约束去掉了最高频模式，但仍需验证"],
            ],
            caption: "步长没有全局最优值；同一个体系在 300 K 与 2000 K 下的合适步长也不同。",
          },
          {
            type: "p",
            text: "验证方法只有一个：跑一段 **NVE**，看总能量。下面这条命令从 `.ener` 文件里取总能量列，报告整段轨迹的漂移幅度。CP2K 的 `project-1.ener` 列依次是步数、时间、动能、温度、势能、总能量、每步耗时。",
          },
          {
            type: "code",
            lang: "bash",
            title: "从 h2o_md-1.ener 检查能量漂移",
            text: `# 第 6 列是总能量（Hartree）；只取数字行，跳过表头
awk '$1 ~ /^[0-9]+$/ {
       if (n == 0) e0 = $6;
       d = $6 - e0;
       if (n == 0 || d > max) max = d;
       if (n == 0 || d < min) min = d;
       n++;
     }
     END {
       if (n < 2) { print "步数太少，无法判断"; exit }
       printf "步数 %d，总能量漂移 %.3e Ha\\n", n, max - min;
     }' h2o_md-1.ener`,
          },
          {
            type: "p",
            text: "漂移多大算可以接受？课程给的参照是：`EPS_SCF 1E-4` 时漂移严重，`1E-5` 在 300 ps 后明显，`1E-6` 与 `1E-7` 几乎看不出。除了 SCF，`CUTOFF` 不足、步长过大、初始结构有近距离接触，也都会表现为能量漂移或温度单向上升。逐项排除，不要只盯着一个参数。",
          },
        ],
      },
      {
        id: "2.5",
        title: "恒温器：把温度按住，但不改变物理",
        blocks: [
          {
            type: "p",
            text: "NVT 需要一个热浴。好的恒温器不仅要让平均温度等于目标值，还要让速度分布接近 **Maxwell–Boltzmann 分布**，并且不破坏体系本身的动力学。课程把常见做法分成四类。",
          },
          {
            type: "table",
            head: ["类型", "机制", "CP2K", "适用与风险"],
            rows: [
              ["速度调节", "每隔若干步把所有速度乘同一个因子", "`TEMP_TOL`（已过时）", "简单粗暴；只适合预平衡/升温，生产会扭曲动力学"],
              ["CSVR", "随机重标速度，同时保持正则分布", "`TYPE CSVR` + `TIMECON`", "常规 NVT 的稳妥选择；升温用 50 fs，生产用 100–200 fs"],
              ["Nosé–Hoover", "引入虚拟热浴变量，扩展哈密顿量", "`TYPE NOSE` + `NOSE/TIMECON`", "平衡体系表现好；离平衡远或体系很小时不够稳健"],
              ["Langevin", "摩擦项 + 随机力", "`ENSEMBLE LANGEVIN` + `GAMMA`", "适合隐式溶剂、局域热化；会改变扩散系数"],
              ["Andersen", "随机选取粒子重赋 Maxwell 速度", "无同名选项；用 Langevin/GLE 近似", "轨迹不连续；适合平衡，不适合算动力学"],
            ],
            caption: "手册当前把 CSVR 列为常规 NVT 的推荐默认；课程录制时更常用 NOSE。两者都能用，关键是时间常数与体系匹配。",
          },
          {
            type: "p",
            text: "Nosé–Hoover 的虚拟质量 $Q$ 决定耦合强弱：$Q$ 越大，热浴与体系的能量交换越慢，耦合越弱。VASP 用 `SMASS` 间接控制 $Q$，CP2K 用 `TIMECON` 直接给时间尺度。CSVR 的 `TIMECON` 单位是 fs：50 表示快速把温度拉回目标，100 是稳健默认，200 以上适合平衡后的温和生产。",
          },
          {
            type: "p",
            text: "一个常见误区是「温度曲线平就是好」。如果恒温器耦合太强（`TIMECON` 太小），温度确实会贴着目标线，但速度分布被反复重标，扩散、振动弛豫等动力学量都会被压低。判断标准不是曲线好看，而是**速度分布与相关函数是否合理**。",
          },
          {
            type: "demo",
            id: "md",
            title: "温度、时间步与能量漂移",
            desc: "拖动时间步与恒温器耦合，观察 NVE 能量漂移与 NVT 温度涨落的变化趋势。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "细节留给第 11 章",
            text: "这一节只建立概念。具体到「先 CSVR 50 升温、再 CSVR 200 生产」「NOSE 链长与 Yoshida 阶数怎么设」「重启文件怎么接」，第 11 章会用完整案例展开。",
          },
        ],
      },
      {
        id: "2.6",
        title: "VASP 与 CP2K：一张参数对照表",
        blocks: [
          {
            type: "p",
            text: "课程先用 VASP 讲 AIMD，因为它的参数少、语义直白；CP2K 的关键词更多，但一一对应之后并不难。先看同一件事在两边的写法。",
          },
          {
            type: "code",
            lang: "text",
            title: "VASP：300 K、0.5 fs、Nosé–Hoover 的 INCAR 片段",
            text: `IBRION = 0          ! 分子动力学
NSW    = 5000       ! 总离子步数
POTIM  = 0.5        ! 时间步长，fs
MDALGO = 2          ! 2 = Nosé–Hoover
SMASS  = 0          ! >=0：Nosé–Hoover 的耦合参数
TEBEG  = 300        ! 初始/目标温度，K
TEEND  = 300        ! 结束温度，K
NBLOCK = 1          ! 每 1 步写一次 XDATCAR/CONTCAR
KBLOCK = 100        ! 每 100*NBLOCK 步写 PCDAT/DOSCAR`,
          },
          {
            type: "code",
            lang: "cp2k",
            title: "CP2K：同一个任务的 MOTION 段",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    STEPS 5000
    TIMESTEP 0.5
    TEMPERATURE 300
    &THERMOSTAT
      TYPE NOSE
      &NOSE
        TIMECON 100
        LENGTH 3
      &END NOSE
    &END THERMOSTAT
    &PRINT
      &ENERGY
        &EACH
          MD 1
        &END EACH
      &END ENERGY
    &END PRINT
  &END MD
  &PRINT
    &TRAJECTORY
      &EACH
        MD 1
      &END EACH
    &END TRAJECTORY
  &END PRINT
&END MOTION`,
          },
          {
            type: "table",
            head: ["作用", "VASP", "CP2K", "备注"],
            rows: [
              ["开启 MD", "`IBRION = 0`", "`RUN_TYPE MD`", "CP2K 在 GLOBAL 段"],
              ["总步数", "`NSW`", "`STEPS`", "都是离子步"],
              ["时间步长", "`POTIM`（fs）", "`TIMESTEP`（fs）", "单位相同，不要混用原子单位"],
              ["初始/目标温度", "`TEBEG`、`TEEND`", "`TEMPERATURE`", "CP2K 没有单独的终止温度；变温要分段或约束"],
              ["系综", "`MDALGO` + `SMASS`", "`ENSEMBLE` + `THERMOSTAT`", "VASP 用两个开关组合，CP2K 分开写"],
              ["NVE", "`SMASS = -3`", "`ENSEMBLE NVE`", "NVE 下不写恒温器"],
              ["速度调节/退火", "`SMASS = -1`", "`TEMP_TOL`（过时）或分段控温", "两边都不建议用于生产"],
              ["Nosé–Hoover", "`MDALGO = 2`，`SMASS >= 0`", "`TYPE NOSE` + `TIMECON`", "`SMASS` 对应虚拟质量，`TIMECON` 对应时间尺度"],
              ["Andersen", "`MDALGO = 1`", "无同名选项；用 Langevin/GLE 近似", "轨迹不连续，慎用于动力学"],
              ["Langevin", "`MDALGO = 3`", "`ENSEMBLE LANGEVIN`", "CP2K 还可按区域设置热浴"],
              ["轨迹写出频率", "`NBLOCK`", "`&EACH MD n`", "CP2K 对每种输出分别设间隔"],
              ["统计量写出频率", "`KBLOCK * NBLOCK`", "`&EACH MD n`", "PCDAT/DOSCAR 对应能量/温度打印"],
            ],
            caption: "对照的依据是课程讲义与两边手册的语义，不是逐字翻译；具体默认值以你的版本为准。",
          },
          {
            type: "p",
            text: "两个容易踩的坑。第一，VASP 的 `SMASS` 不是一个「温度」而是一个耦合参数，直接照搬到 CP2K 会找不到对应关键词；CP2K 用 `TIMECON` 表达同一个物理量。第二，VASP 编 AIMD 需要 `-Dtbdyn`（5.4 以后通常自动），CP2K 没有这个开关，但需要正确的 `RUN_TYPE MD` 与 `&MOTION` 段。",
          },
          {
            type: "p",
            text: "还有一处语义差异：VASP 的 `TEBEG/TEEND` 可以在一次运行里线性变温，CP2K 的 `TEMPERATURE` 是恒温目标；要做退火，得用分段重启或约束/控温方案。第 11 章会给分段升温的实际脚本。",
          },
        ],
      },
      {
        id: "2.7",
        title: "相关函数、采样长度与统计误差",
        blocks: [
          {
            type: "p",
            text: "轨迹跑完不等于采样够了。宏观量是**时间平均**：假设体系遍历，沿一条足够长的轨迹求平均，才等于系综平均。相邻帧高度相关，1000 帧可能只相当于几十个独立样本。判断采样是否充分，靠**自相关函数**与**自相关时间**。",
          },
          {
            type: "formula",
            tex: "C_{AA}(t)=\\frac{\\langle A(0)A(t)\\rangle-\\langle A\\rangle^2}{\\langle A^2\\rangle-\\langle A\\rangle^2},\\qquad N_{\\mathrm{eff}}\\approx\\frac{T_{\\mathrm{total}}}{2\\tau_A}",
            caption: "C 从 1 衰减到 0 的时间尺度是 τ；总时长除以 2τ 给出有效独立样本数的量级。",
          },
          {
            type: "p",
            text: "实践上更常用**分块平均**（block averaging）：把轨迹切成若干块，分别求均值，再看块均值随块大小的变化。当块均值不再随块长明显变化时，误差棒才算稳定。下面是一个最小实现，读取 `.ener` 的温度列做分块。",
          },
          {
            type: "code",
            lang: "python",
            title: "block_average.py：从 .ener 估计温度误差棒",
            text: `import sys
import numpy as np

# 跳过表头，取第 4 列（温度，K）
data = np.loadtxt(sys.argv[1], comments="#")
temp = data[:, 3]
n = len(temp)

for nblock in (1, 2, 5, 10, 20):
    m = n // nblock
    if m < 2:
        continue
    blocks = temp[: m * nblock].reshape(m, nblock).mean(axis=1)
    print(f"块数 {m:4d}  块长 {nblock:3d}  "
          f"均值 {blocks.mean():7.2f} K  标准误 {blocks.std(ddof=1)/np.sqrt(m):6.2f} K")`,
          },
          {
            type: "p",
            text: "如果标准误随块长持续上升，说明块还不够长，轨迹里的慢过程还没被平均掉；当它进入平台，才可以用这个误差棒。课程强调 AIMD 的**混沌性**：初速度随机、浮点误差会被放大，单次轨迹可能错过小概率事件。重要结论至少用 2–3 个不同初速度的独立轨迹验证，而不是把一条轨迹跑得更长。",
          },
          {
            type: "list",
            items: [
              "先丢弃平衡段：温度、密度、RDF 稳定之前的帧不算生产数据。",
              "采样长度至少是目标慢过程相关时间的若干倍；扩散、配位交换往往需要几十到几百 ps。",
              "报告均值时同时报告误差棒与所用块长，否则数字无法复现。",
              "稀有事件不要靠加长轨迹硬等，改用增强采样（第 12 章）。",
            ],
          },
        ],
      },
      {
        id: "2.8",
        title: "后处理全景：从轨迹到可发表的量",
        blocks: [
          {
            type: "p",
            text: "AIMD 的原始产出只有几样：轨迹坐标、速度、能量、晶胞、力。所有「性质」都是对这些量再做统计。先认清文件，再谈分析。",
          },
          {
            type: "table",
            head: ["文件", "内容", "第一眼用来判断"],
            rows: [
              ["`project-pos-1.xyz`", "每帧坐标", "轨迹是否连续、有没有原子飞走"],
              ["`project-1.ener`", "步数、时间、动能、温度、势能、总能量、每步耗时", "能量漂移、温度是否到目标、性能"],
              ["`project-1.cell`", "晶胞向量", "NPT 是否稳定、盒子有没有塌缩"],
              ["`project-frc-1.xyz`", "力", "有没有异常大的力（结构重叠）"],
              ["`project-1.restart`", "完整重启信息", "续算、换系综、延长轨迹"],
            ],
            caption: "先看 .ener 与轨迹，再看具体性质；顺序反了会把结构问题当成方法问题。",
          },
          {
            type: "p",
            text: "最常用的四个统计量：",
          },
          {
            type: "table",
            head: ["量", "定义", "能回答什么", "本站章节"],
            rows: [
              ["RDF $g(r)$", "径向分布函数", "液体结构、配位数、氢键网络", "第 13 章"],
              ["MSD", "$\\langle |r(t)-r(0)|^2\\rangle$", "扩散系数、迁移机制", "第 13 章"],
              ["VACF", "$\\langle v(0)\\cdot v(t)\\rangle$", "振动密度、红外/拉曼谱", "第 10、13 章"],
              ["寿命/相关函数", "氢键、配位、取向的时间相关", "动力学与交换过程", "第 12、13 章"],
            ],
            caption: "同一批轨迹可以算出全部四类量；差别在参考帧、时间窗与统计处理。",
          },
          {
            type: "p",
            text: "扩散系数由 MSD 的长期斜率给出。三维体系用 Einstein 关系：",
          },
          {
            type: "formula",
            tex: "D=\\frac{1}{6}\\lim_{t\\to\\infty}\\frac{d}{dt}\\langle |r(t)-r(0)|^2\\rangle",
            caption: "系数 6 = 2×3，来自三个方向的均方位移；一维、二维体系分别换成 2、4。",
          },
          {
            type: "p",
            text: "温度依赖的扩散系数可以拟合 Arrhenius 形式，得到表观活化能：",
          },
          {
            type: "formula",
            tex: "D(T)=D_0\\exp\\!\\left(-\\frac{E_a}{k_B T}\\right),\\qquad \\ln D=\\ln D_0-\\frac{E_a}{k_B}\\cdot\\frac{1}{T}",
            caption: "用 ln D 对 1/T 作图，斜率是 −Ea/kB。课程用 log10 形式时，斜率要乘 2.303 换算。",
          },
          {
            type: "p",
            text: "振动谱有两条路：对速度自相关函数做傅里叶变换得到 vDOS；对偶极自相关函数做变换得到红外谱。前者只需轨迹，后者还需要每帧偶极。CP2K 可以输出偶极，TRAVIS 可以直接从轨迹算光谱与 RDF，第 10 章会给出完整流程。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "分析之前先做三件事",
            text: "一、用 VMD 或 Ovito 把轨迹快速放一遍，确认没有原子飞出盒子；二、看 `.ener` 的温度与总能量，确认生产段平稳；三、确认轨迹的写出频率足够——RDF 与 VACF 对时间分辨率比对总长度更敏感。",
          },
          {
            type: "p",
            text: "后处理的工具链不必一次学全：VMD 适合看结构与 RDF，TRAVIS 适合光谱与溶剂化分析，MDAnalysis/ASE 适合写脚本批量处理。第 13 章会把这些工具接进同一条流水线，并给出可复现的脚本骨架。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "势能面上的一阶鞍点，其 Hessian 本征值应满足什么条件？",
        options: ["全部为正", "全部为负", "恰有一个为负，其余为正", "至少两个为负"],
        answer: 2,
        explain: "一阶鞍点只有一个负曲率方向，对应反应坐标；频率分析中表现为恰好一个虚频。",
      },
      {
        q: "AIMD 中 `STEPS 5000`、`TIMESTEP 0.5` 意味着什么？",
        options: [
          "总共 5000 次 SCF，模拟 2.5 ps",
          "总共 5000 个离子步，模拟 2.5 ps",
          "总共 5000 个离子步，模拟 2500 fs 的电子步",
          "每 5000 步做一次 SCF",
        ],
        answer: 1,
        explain: "STEPS 是离子步数；5000 × 0.5 fs = 2500 fs = 2.5 ps。每步内部仍要做 SCF，但 SCF 次数不等于 STEPS。",
      },
      {
        q: "为什么课程建议原子数少的 AIMD 优先用 NVT/NVE，而不是 NPT？",
        options: [
          "CP2K 不支持 NPT",
          "小体系的压力涨落太大，晶胞容易被噪声推着振荡",
          "NPT 不能控温",
          "NPT 只适用于金属",
        ],
        answer: 1,
        explain: "压力是瞬时量，原子数少时涨落剧烈；小盒子做 NPT 会得到非物理的晶胞振荡。CP2K 支持 NPT，问题在采样质量。",
      },
      {
        q: "用 NVE 短轨迹验证时间步时，最该看什么？",
        options: [
          "温度是否严格等于 300 K",
          "总能量随时间的漂移幅度",
          "SCF 迭代次数是否最少",
          "轨迹文件是否最大",
        ],
        answer: 1,
        explain: "NVE 下总能量应守恒；漂移幅度直接反映时间步、SCF 收敛与网格是否足够。温度在 NVE 下本来就会涨落。",
      },
      {
        q: "VASP 的 `SMASS >= 0` 与 `MDALGO = 2` 组合，对应 CP2K 的哪种设置？",
        options: [
          "ENSEMBLE NVE",
          "ENSEMBLE NVT + THERMOSTAT TYPE NOSE",
          "ENSEMBLE NPT_F",
          "ENSEMBLE LANGEVIN",
        ],
        answer: 1,
        explain: "MDALGO=2 是 Nosé–Hoover，SMASS≥0 设定其耦合；CP2K 对应 NVT 加 TYPE NOSE，用 TIMECON 控制时间尺度。",
      },
    ],
    terms: [
      { t: "势能面", en: "Potential Energy Surface, PES", d: "给定核坐标下电子基态能量构成的曲面，AIMD 与几何优化都在它上面运动。" },
      { t: "BOMD", en: "Born–Oppenheimer Molecular Dynamics", d: "每步求解电子基态、原子按单一势能面受力的分子动力学，CP2K 的主用形式。" },
      { t: "Ehrenfest 动力学", en: "Ehrenfest dynamics", d: "电子波函数随时间演化、原子受多态平均力的非绝热动力学，适合激发态过程。" },
      { t: "系综", en: "Ensemble", d: "固定不同宏观量（NVE/NVT/NPT）的轨迹集合，决定温度、体积、能量哪些量涨落。" },
      { t: "恒温器", en: "Thermostat", d: "在 NVT 中与体系交换能量、把温度维持在目标值的算法，如 CSVR、Nosé–Hoover、Langevin。" },
      { t: "自相关时间", en: "Autocorrelation time", d: "一个观测量与自身过去值的相关性衰减到零的时间尺度，决定有效独立样本数。" },
      { t: "MSD", en: "Mean Squared Displacement", d: "粒子位移平方的系综平均，其长期斜率给出扩散系数。" },
    ],
    sources: [
      { t: "Molecular Dynamics（系综、时间步、恒温器、验证清单）", url: "https://manual.cp2k.org/trunk/methods/sampling/molecular_dynamics.html" },
      { t: "Langevin Dynamics（局域热浴与热区）", url: "https://manual.cp2k.org/trunk/methods/sampling/langevin_dynamics.html" },
      { t: "Input Reference · MOTION/MD", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD.html" },
      { t: "Input Reference · MOTION/MD/THERMOSTAT", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD/THERMOSTAT.html" },
      { t: "Input Reference · GLOBAL（RUN_TYPE）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/GLOBAL.html" },
    ],
  };
})();