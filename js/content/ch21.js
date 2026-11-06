(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch21"] = {
    id: "ch21",
    num: 21,
    part: "进阶与工程",
    title: "科研实战配方：从模型到可发表的结果",
    subtitle: "CO2RR、PEMFC 界面与 AIMD 的完整工作流",
    hours: 7.0,
    level: "高级",
    intro:
      "前面几章把工具讲完了，这一章把它们串成能交付的工作流：怎么建 slab、怎么定吸附能、怎么做界面模型、怎么跑 AIMD，以及怎么用收敛测试与误差棒让结果站得住。这里的每个配方都写清「要做什么、为什么、怎么验证」，不替你编造数值。",
    goals: [
      "独立搭建 CO2RR 中间体的 slab 模型并给出定义清晰的吸附能",
      "为 PEMFC 的 Pt/ionomer 界面选择分层建模方案并说明其局限",
      "按「平衡 → 采样 → 分析」跑完一套 AIMD 并做自相关检查",
      "用收敛测试、k 点、基组与误差棒组织出可复现的发表级数据",
    ],
    sections: [
      {
        id: "21.1",
        title: "实战总模板：三层验证，再谈生产",
        blocks: [
          {
            type: "p",
            text: "任何一本正经的计算都过三道关：**单点能**（模型与电子结构对不对）、**几何/晶胞**（结构是不是极小）、**采样**（有限温度下结论稳不稳）。跳过前两层直接跑长 MD 或大批吸附能，是最常见的返工原因。",
          },
          {
            type: "steps",
            items: [
              { t: "定模型", d: "切面、层数、真空、超胞、覆盖度、电荷与自旋。每一项都要能回答「为什么是这个值」。" },
              { t: "跑单点", d: "确认 SCF 收敛、力合理、无重叠原子；记录 CUTOFF、k 点、泛函、色散设置。" },
              { t: "做弛豫", d: "固定底层、放开表面与吸附物；确认所有力判据达标，而不是「跑满步数」。" },
              { t: "做收敛", d: "层数、真空、k 点、cutoff、超胞逐个加严，直到目标量变化小于你声称的精度。" },
              { t: "生产与分析", d: "批量计算、统一后处理、给误差棒；保留输入、输出与版本信息。" },
            ],
          },
          {
            type: "callout",
            kind: "key",
            title: "价格与精度要匹配",
            text: "如果你的结论是「不同中间体的吸附能差 0.1 eV」，那么 cutoff、k 点、真空、层数带来的误差必须显著小于 0.1 eV。**先做误差预算，再决定算多贵**；反过来做，通常会在审稿意见里补算三个月。",
          },
        ],
      },
      {
        id: "21.2",
        title: "配方一：CO2RR 中间体吸附能",
        blocks: [
          {
            type: "p",
            text: "以 Cu 表面上的 *CO 为例，流程是：建 slab → 放吸附物 → 固定底层 → 加真空与色散 → 弛豫 → 算参考态 → 组合出吸附能。吸附能定义为 $E_{ads}=E_{slab+ads}-E_{slab}-E_{ads}$，负值表示吸附有利；**符号与参考态必须在文中写死**，否则读者无法复现。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Cu(111) slab + *CO（骨架）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 500
      REL_CUTOFF 60
    &END MGRID
    &SCF
      EPS_SCF 1.0E-7
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
      &VDW_POTENTIAL
        POTENTIAL_TYPE PAIR_POTENTIAL
        &PAIR_POTENTIAL
          TYPE DFTD3(BJ)
          REFERENCE_FUNCTIONAL PBE
        &END PAIR_POTENTIAL
      &END VDW_POTENTIAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 8.85 8.85 22.0
      PERIODIC XY
    &END CELL
    &COORD
      ! 4 层 Cu(111) + 顶位 CO
    &END COORD
    &KIND Cu
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q11
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`&KIND C` 与 `&KIND O` 分别用 `DZVP-MOLOPT-GTH` 配 `GTH-PBE-q4` / `GTH-PBE-q6`，`RUN_TYPE` 设为 `GEO_OPT`。几个不能省的细节：**真空方向不弛豫**（`PERIODIC XY`，晶胞 z 方向留 15 Å 以上并做真空收敛）；**底层固定**，只放开最上两层与吸附物；**色散必开**，CO 在金属上的吸附能对色散很敏感；`REFERENCE_FUNCTIONAL` 要与泛函一致，否则 D3 参数取错。",
          },
          {
            type: "p",
            text: "CP2K 没有 VASP 那种 `IDIPOL` 偶极修正开关。slab 的偶极处理靠**二维周期静电**：`&POISSON` 用 `PERIODIC XY` 配解析求解器，或用 `&POISSON/&IMPLICIT` 的边界与介电设置；再配合足够厚的真空与「上下对称」的 slab。真空不够时，镜像偶极会让吸附能随真空厚度漂移——这正是要用收敛测试抓的。",
          },
          {
            type: "p",
            text: "算吸附能还要算三个参考态：清洁 slab、气相吸附物（单独放在大盒子里，`PERIODIC NONE`，做自旋与色散一致的单点）。若要做自由能，再加上 ZPE 与 $-T\\Delta S$：吸附物用谐频，气相分子用标准态熵；电极电位用计算氢电极（CHE）把 $(H^+ + e^-)$ 换成 $\\tfrac{1}{2}H_2$。这些校正不写清，数字之间不可比。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "覆盖度与超胞是一对",
            text: "同一个吸附物在 $2\\times2$ 与 $3\\times3$ 超胞里的吸附能不同，因为侧向相互作用变了。**报告时必须写清覆盖度**（例如 1/4 ML），并对超胞做一次收敛检查；否则「吸附能」只是一个没有定义的数。",
          },
        ],
      },
      {
        id: "21.3",
        title: "配方二：PEMFC 的 Pt/ionomer 界面",
        blocks: [
          {
            type: "p",
            text: "PEMFC 阴极的三相界面同时有**金属、水、ionomer**。全用 DFT 算不现实，正确做法是分层：Pt 表面与第一层水/磺酸根用 DFT，外层水与疏水骨架用经典力场，中间用 QM/MM 或分区耦合。建模顺序决定了后面能不能算得动。",
          },
          {
            type: "steps",
            items: [
              { t: "金属 slab", d: "Pt(111) 或 (100)，4–5 层，底部两层固定，真空 15 Å 以上，`PERIODIC XY`；先做清洁表面弛豫，确认表面能合理。" },
              { t: "水层", d: "按实验密度铺 2–3 层水，先做经典力场平衡，再取快照做 DFT 优化；水层厚度要覆盖到「体相水」行为。" },
              { t: "ionomer 片段", d: "用磺酸根头基 + 短全氟链代表 ionomer，末端用封端基团；避免用整条长链，除非你确实要研究构象。" },
              { t: "电荷平衡", d: "磺酸根带负电，体系要加反离子（$H_3O^+$ 或 $Na^+$）或显式质子；总电荷与自旋必须写清。" },
              { t: "分层耦合", d: "界面区 DFT、外层水/骨架力场；QM/MM 用静电嵌入，QM 区切在磺酸根或水簇上，别切 C–F 键。" },
              { t: "验证", d: "水的密度剖面、Pt–O 径向分布、界面电位；与纯水/Pt 体系对比，确认 ionomer 没有把水排空。" },
            ],
          },
          {
            type: "code",
            lang: "cp2k",
            title: "界面区的 QM/MM 骨架",
            text: `&FORCE_EVAL
  METHOD QMMM
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 400
      REL_CUTOFF 50
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
    &END SCF
  &END DFT
  &QMMM
    E_COUPL COULOMB
    &QM_KIND O
      MM_INDEX 1 2 3 4 5
    &END QM_KIND
    &QM_KIND S
      MM_INDEX 6
    &END QM_KIND
    &MM
      &FORCEFIELD
        PARMTYPE AMBER
        PARM_FILE_NAME interface.prmtop
      &END FORCEFIELD
    &END MM
  &END QMMM
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "这个模型的软肋在**金属**：经典力场无法描述 Pt 的电子结构，所以金属必须整体留在 QM 区，或者用专门的金属–水势。如果你的问题涉及电位、氧还原中间体或 Pt 氧化，老实做全 DFT；如果只关心 ionomer 的形貌与水的分布，经典力场加少量 DFT 验证更划算。",
          },
          {
            type: "table",
            head: ["研究问题", "建议方案", "代价"],
            rows: [
              ["ionomer 形貌、水通道", "全经典力场 + DFT 抽样验证", "低，可到纳秒/微米"],
              ["磺酸根在 Pt 上的吸附", "Pt slab + 磺酸根 DFT", "中，几百度原子"],
              ["界面电位、ORR 中间体", "全 DFT（含溶剂/电位）", "高，几十到几百原子"],
              ["水/ionomer 与 Pt 的耦合", "QM/MM 分层", "中高，需拓扑与切键处理"],
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "先问「界面在哪里」",
            text: "PEMFC 的结论对界面定义极其敏感：磺酸根是直接接触 Pt，还是隔着一层水？质子是在磺酸根上还是在 $H_3O^+$ 里？**把你假设的界面写进方法部分**，并做一个「去掉 ionomer」的对照，读者才知道效应来自哪里。",
          },
        ],
      },
      {
        id: "21.4",
        title: "配方三：AIMD 的平衡、采样与分析",
        blocks: [
          {
            type: "p",
            text: "AIMD 的流程是**先平衡、再采样、最后分析**，不是「跑一条长轨迹然后截图」。平衡阶段去掉初始结构与速度分布的假象；采样阶段要足够长以覆盖你关心的自相关时间；分析阶段用 RDF、MSD、振动谱等观测量说话。下面只保留 MD 骨架：`&GLOBAL` 里要写 `RUN_TYPE MD`，`&QS` 里加 `EXTRAPOLATION ASPC`，轨迹用 `&PRINT/&TRAJECTORY` 每 50 步写一帧。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "NVT AIMD（CSVR 恒温）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 300
      REL_CUTOFF 50
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
    &END SCF
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.42 12.42 12.42
      PERIODIC XYZ
    &END CELL
    &TOPOLOGY
      COORD_FILE_NAME equilibrated.xyz
      COORD_FILE_FORMAT XYZ
    &END TOPOLOGY
  &END SUBSYS
&END FORCE_EVAL

&MOTION
  &MD
    ENSEMBLE NVT
    TEMPERATURE 330
    TIMESTEP 0.5
    STEPS 20000
    &THERMOSTAT TYPE CSVR
      &CSVR
        TIMECON 100.0
      &END CSVR
    &END THERMOSTAT
  &END MD
&END MOTION`,
          },
          {
            type: "p",
            text: "时间步先小后大：含氢体系从 0.5 fs 起，确认能量守恒后再考虑放大。`ASPC` 外推能显著减少 SCF 步数，但**外推失效时会悄悄给出坏力**，所以每跑一段要用 `RUN_TYPE ENERGY_FORCE` 抽查几帧的力与能量。",
          },
          {
            type: "p",
            text: "平衡是否结束，不能只看温度到没到 330 K。看势能是否漂移、水的 RDF 是否稳定、密度剖面是否收敛。生产段丢弃前 20–30% 是常规做法，但**丢弃比例要写出来**，并且用 block average 给误差棒，而不是把每一帧当独立样本。",
          },
          {
            type: "demo",
            id: "md",
            title: "动手：调整系综与恒温器",
            desc: "在 MD 演示里切换 NVE/NVT，改 CSVR 时间常数，观察温度与势能曲线的差别。",
          },
          {
            type: "table",
            head: ["分析目标", "观测量", "常见坑"],
            rows: [
              ["水的结构", "O–O / O–H 径向分布 g(r)", "盒子太小，长程结构被镜像截断"],
              ["扩散", "MSD 斜率 → 扩散系数", "拟合区间太短或包含弹道段"],
              ["氢键网络", "氢键数、寿命", "定义（距离/角度阈值）不写清"],
              ["振动谱", "速度自相关 → VDOS", "采样间隔与总时长不足，峰被抹平"],
            ],
          },
        ],
      },
      {
        id: "21.5",
        title: "参数选择清单：每个数字都要有理由",
        blocks: [
          {
            type: "p",
            text: "下面这张表是开算前的自检。每一项都不是「手册默认值」了事，而是要能回答：为什么选它、怎么验证、误差多大。",
          },
          {
            type: "table",
            head: ["参数", "起点", "怎么定", "影响"],
            rows: [
              ["`CUTOFF` / `REL_CUTOFF`", "400–600 Ry / 50–60 Ry", "固定一个扫另一个，看总能量到 1e-6 Ry", "网格误差、力噪声"],
              ["k 点", "分子/大胞：Γ 点", "金属/小胞加密，看能量与态密度", "金属体系必须测"],
              ["基组", "DZVP-MOLOPT-SR-GTH", "加极化/弥散做对比；与赝势匹配", "吸附能、带隙"],
              ["泛函", "PBE + D3(BJ)", "与文献可比性优先；必要时杂化", "电子结构、吸附强度"],
              ["色散", "DFTD3(BJ)", "`REFERENCE_FUNCTIONAL` 与泛函一致", "分子吸附、层间作用"],
              ["展宽", "绝缘体不开", "金属开 Fermi–Dirac，外推到 0 K", "收敛与带结构"],
              ["真空", "≥15 Å", "10/15/20 Å 看吸附能与功函数", "slab 偶极误差"],
              ["超胞/层数", "4 层、2×2", "逐级加严到目标量稳定", "覆盖度与量子尺寸效应"],
            ],
            caption: "先在便宜设置下把流程跑通，再逐项加严；不要一开始就堆最高精度。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "「默认值」也是别人做的选择",
            text: "CP2K 的默认 CUTOFF、k 点、展宽都针对通用场景。分子体系照抄金属的设置会浪费几十倍机时，金属照抄分子的设置会算错。**先判断体系属于哪一类，再改参数**。",
          },
        ],
      },
      {
        id: "21.6",
        title: "收敛测试：把误差写成数字",
        blocks: [
          {
            type: "p",
            text: "收敛测试不是「看起来平了」，而是**两个相邻设置的目标量之差小于你声称的精度**。以 CUTOFF 为例：固定 `REL_CUTOFF`，把 `CUTOFF` 从 300 扫到 700 Ry，比较总能量与吸附能；能量差小于 1 meV/atom、吸附能差小于 0.02 eV，才可以说收敛。",
          },
          {
            type: "code",
            lang: "bash",
            title: "CUTOFF 收敛扫描",
            text: `#!/usr/bin/env bash
set -euo pipefail
for cut in 300 350 400 450 500 550 600 700; do
  dir="cut_\${cut}"
  mkdir -p "\${dir}"
  sed "s/CUTOFF_RY/\${cut}/g" template.inp > "\${dir}/run.inp"
  cp BASIS_MOLOPT GTH_POTENTIALS dftd3.dat "\${dir}/"
  ( cd "\${dir}" && cp2k.psmp -i run.inp -o run.out )
  # 从输出取总能量（单位换算成 eV 再比较）
  grep "ENERGY| Total FORCE_EVAL" "\${dir}/run.out" | tail -1
done | tee cutoff_scan.dat`,
          },
          {
            type: "p",
            text: "k 点、真空、层数、超胞同理：每次只改一个变量，其余保持最严设置。把结果画成「目标量 vs 参数」的曲线，标出你选的点与两条误差线；这比一句「测试了收敛」有说服力得多。",
          },
          {
            type: "p",
            text: "还有两类误差不在参数里：**有限尺寸误差**（超胞不够大、slab 层数不够）与**统计误差**（MD 采样不足、只算了一个构象）。前者靠加严测试，后者靠多个独立轨迹或 block average。两者都要在结果表里单独给出，不能混进「计算误差」一笔带过。",
          },
        ],
      },
      {
        id: "21.7",
        title: "发表级工作流：可复现、可审计、可扩展",
        blocks: [
          {
            type: "p",
            text: "最后一公里不是算，而是**让别人能重跑**。一个项目目录应该能回答：用了哪个版本、哪套参数、每个数字来自哪个文件、后处理脚本在哪。做到这点，审稿人要补算时你不用翻聊天记录。",
          },
          {
            type: "code",
            lang: "bash",
            title: "一个项目的最小目录约定",
            text: `project/
  00_inputs/        # 模板输入，参数统一命名
  01_slab/          # 清洁表面
  02_adsorbates/    # 每个中间体一个子目录
  03_gas/           # 气相参考态
  04_analysis/      # 后处理脚本与图
  05_reports/       # 生成的表与图
  README.md         # 版本、参数、命令、负责人
  env.sh            # module load / OMP 设置

# 每次生产都保留：输入、输出、restart、作业脚本
# 用 git 管输入与脚本，用校验和管大文件
sha256sum 02_adsorbates/*/run.inp > inputs.sha256`,
          },
          {
            type: "p",
            text: "报告结果时，给三样东西：**定义**（吸附能/自由能的公式与参考态）、**设置**（泛函、基组、cutoff、k 点、色散、真空、覆盖度）、**不确定度**（收敛测试的极差、统计误差、方法误差）。如果与文献对比，只有在设置一致时才逐数比较；设置不同就比趋势，并说明差异来源。",
          },
          {
            type: "keypoints",
            items: [
              "先单点、再优化、后采样；三层都过再谈生产",
              "吸附能必须写清参考态、覆盖度、真空与色散；符号约定固定",
              "界面模型先定义「界面在哪」，再做去掉某一层的对照",
              "AIMD 的采样长度由自相关时间决定，误差棒用 block average",
              "收敛测试每次只改一个变量，把误差写成数字写进论文",
              "输入、输出、restart、脚本、版本一起归档，才叫可复现",
            ],
          },
          {
            type: "quote",
            text: "计算化学里最昂贵的错误，不是算错一个数，而是用三个月算了一个没人能复现的数。",
            who: "给赶论文的人",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "CO2RR 吸附能 $E_{ads}=E_{slab+ads}-E_{slab}-E_{ads}$ 中，最容易被忽略却必须一并计算的是？",
        options: [
          "slab 的层数",
          "气相吸附物参考态与一致的色散/自旋设置",
          "k 点网格",
          "MD 时间步",
        ],
        answer: 1,
        explain: "参考态的气相单点必须与吸附体系使用一致的泛函、色散与自旋设置，否则差值没有意义。层数与 k 点属于收敛项，但参考态是定义问题。",
      },
      {
        q: "CP2K 处理 slab 偶极的可行做法是？",
        options: [
          "设置 IDIPOL=3",
          "用二维周期静电（PERIODIC XY + 解析求解器）并做真空收敛测试",
          "把真空层设为 5 Å 即可",
          "关闭所有周期性",
        ],
        answer: 1,
        explain: "CP2K 没有 VASP 式的 IDIPOL 开关。slab 靠二维周期静电与足够厚的真空处理，并通过真空收敛测试确认结果稳定。",
      },
      {
        q: "AIMD 生产前，判断「平衡够了」最可靠的依据是？",
        options: [
          "温度瞬时值等于目标温度",
          "势能无漂移、结构观测量（如 RDF）稳定",
          "轨迹帧数达到 1000",
          "SCF 每步都收敛",
        ],
        answer: 1,
        explain: "温度是涨落量，单帧到温不算平衡。应看势能漂移与结构观测量是否稳定，再决定从哪里开始采样。",
      },
      {
        q: "关于收敛测试，下面哪句正确？",
        options: [
          "相邻两个设置的目标量之差小于声称精度，才算收敛",
          "能量曲线看起来平了就是收敛",
          "只要用默认 CUTOFF 就无需测试",
          "收敛测试只需做一次，换体系不用重做",
        ],
        answer: 0,
        explain: "收敛是可量化的：相邻设置差异小于目标精度。默认值不保证对你的体系足够，换体系、换元素都要重做。",
      },
      {
        q: "PEMFC 界面建模时，哪种做法最不推荐？",
        options: [
          "Pt 与第一层水用 DFT，外层水用经典力场",
          "用磺酸根头基 + 短链代表 ionomer",
          "把整条长 ionomer 链与全部水都用 DFT 做纳秒 MD",
          "做「去掉 ionomer」的对照计算",
        ],
        answer: 2,
        explain: "全 DFT 的纳秒级界面 MD 代价极高且通常不必要。分层建模 + 对照才是可行方案；关键是写清界面假设与局限。",
      },
    ],
    terms: [
      { t: "吸附能", en: "adsorption energy", d: "吸附体系总能量减去清洁表面与气相吸附物能量；负值表示吸附有利。" },
      { t: "计算氢电极", en: "computational hydrogen electrode", d: "把质子–电子对用 1/2 H2 替代，将电极电位与 pH 引入自由能的热力学约定。" },
      { t: "覆盖度", en: "coverage", d: "吸附物数与表面位点数之比；吸附能依赖覆盖度，报告时必须注明。" },
      { t: "ionomer", en: "ionomer", d: "燃料电池催化层中传导质子的离聚物，通常含磺酸根头基与疏水骨架。" },
      { t: "自相关时间", en: "autocorrelation time", d: "观测量失去记忆所需的时间尺度，决定 MD 采样长度与误差棒。" },
      { t: "block average", en: "block averaging", d: "把相关轨迹切成块、用块均值估计统计误差的方法，避免高估样本数。" },
      { t: "误差预算", en: "error budget", d: "把 cutoff、k 点、基组、有限尺寸、统计等误差逐项量化并相加的清单。" },
    ],
    sources: [
      { t: "Cutoff and Relative Cutoff", url: "https://manual.cp2k.org/trunk/methods/dft/cutoff.html" },
      { t: "Geometry and Cell Optimization", url: "https://manual.cp2k.org/trunk/methods/optimization/geometry_and_cell_opt.html" },
      { t: "Molecular Dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/molecular_dynamics.html" },
      { t: "VDW_POTENTIAL / PAIR_POTENTIAL", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/XC/VDW_POTENTIAL/PAIR_POTENTIAL.html" },
    ],
  };
})();