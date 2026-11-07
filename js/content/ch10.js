(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch10"] = {
    id: "ch10",
    num: 10,
    part: "结构与振动",
    title: "频率、振动光谱与 TRAVIS",
    subtitle: "从 Hessian 到 IR/Raman 谱，再到轨迹后处理",
    hours: 4.5,
    level: "高级",
    intro:
      "优化收敛只说明你站在一个驻点上，不说明它是极小点；实验谱上的每个峰，也要能从简正模式里找到对应。这一章先把频率算对：有限差分 Hessian、虚频判据、IR/Raman 强度的前置开关、热化学的适用边界；再把含 Wannier 中心的轨迹交给 TRAVIS，做出能和实验对比的谱图。",
    goals: [
      "写出可运行的频率输入，并说清 RUN_TYPE 与顶层 &VIBRATIONAL_ANALYSIS 的位置",
      "用虚频数目区分极小点、过渡态与未收敛结构，解释 3N−6 与刚体模式投影",
      "打开 IR/Raman 强度所需的前置设置，读懂强度表与周期性体系的偶极处理",
      "用 THERMOCHEMISTRY 得到 ZPE、熵与吉布斯自由能，并说明 RRHO 的边界",
      "用 Wannier 中心轨迹配合 TRAVIS，产出 IR/Raman 谱与可复现的输入记录",
    ],
    sections: [
      {
        id: "10.1",
        title: "先优化，再算频率：最小输入",
        blocks: [
          {
            type: "p",
            text: "频率是能量对原子坐标的二阶导数，必须在驻点取值。几何没优化干净，残余梯度会混进 Hessian，低频模式首先被污染，表现为一串忽大忽小的虚频。所以流程永远是：**优化到所有力判据达标 → 再算频率**，不要用单点结构直接开频率。",
          },
          {
            type: "p",
            text: "和单点输入相比只改两处：`RUN_TYPE` 改成 `VIBRATIONAL_ANALYSIS`，并在文件末尾加一个 `&VIBRATIONAL_ANALYSIS`。当前手册把它列为==顶层节==，与 `&FORCE_EVAL`、`&MOTION` 平级；旧教程常写在 `&MOTION` 下，照抄前先核对你的 CP2K 版本。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_freq.inp：水分子频率（示例坐标，请换成你的优化结果）",
            text: `&GLOBAL
  PROJECT h2o_freq
  RUN_TYPE VIBRATIONAL_ANALYSIS
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SCF
      EPS_SCF 1.0E-8
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 10.0 10.0 10.0
    &END CELL
    &COORD
      O 0.0000 0.0000 0.0000
      H 0.0000 0.7570 0.5870
      H 0.0000 -0.7570 0.5870
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
          },
          {
            type: "code",
            lang: "cp2k",
            title: "文件末尾的频率设置",
            text: `&VIBRATIONAL_ANALYSIS
  DX 1.0E-2
  &PRINT
    &MOLDEN_VIB
      FILENAME h2o_freq
    &END MOLDEN_VIB
    &HESSIAN
      FILENAME h2o_freq.hess
    &END HESSIAN
  &END PRINT
&END VIBRATIONAL_ANALYSIS`,
          },
          {
            type: "p",
            text: "`&MOLDEN_VIB` 写出 `h2o_freq.molden`，用 Molden 或 VMD 打开就能看每个模式怎么动；`&HESSIAN` 把矩阵本身落盘，方便换单位或做二次分析。第一轮先只要频率，不打开强度和热化学——确认没有意外虚频，再花钱。",
          },
          {
            type: "callout",
            kind: "key",
            title: "盒子与坐标",
            text: "上面的 10 Å 盒子给分子留真空，周期镜像仍在，但对水分子频率的影响很小。坐标是标准水几何的示意值，真实计算必须用你自己优化后的结构；频率对键长非常敏感，差 0.01 Å 就能让高频峰移动十几个 cm⁻¹。",
          },
        ],
      },
      {
        id: "10.2",
        title: "Hessian、3N−6 与虚频判据",
        blocks: [
          {
            type: "p",
            text: "Hessian 是 $3N\\times 3N$ 的矩阵，元素是能量对两个坐标分量的二阶偏导。用原子质量加权、对角化，得到 $3N$ 个本征值 $\\lambda_i$；本征值的平方根给出角频率，再除以 $2\\pi c$ 就是常见的波数。",
          },
          {
            type: "formula",
            tex: "\\tilde{\\nu}_i=\\frac{1}{2\\pi c}\\sqrt{\\lambda_i}",
          },
          {
            type: "p",
            text: "其中 6 个模式对应整体平动与转动（线性分子是 5 个），频率接近 0；剩下的 $3N-6$ 个才是真正的振动。CP2K 默认会把整体转动从 Hessian 里清掉，所以频率表不会从 0 开始；做固体或带约束的体系时，用 `FULLY_PERIODIC T` 关掉这个清理，避免把真正的低频声子当成刚体模式删掉。",
          },
          {
            type: "p",
            text: "本征值为负时，频率是虚数。CP2K 在频率表里直接写成负数，例如 `-123.4`，不会加 `i` 前缀。看到负数就去数个数，而不是盯着绝对值猜。",
          },
          {
            type: "key",
            items: [
              { k: "0 个虚频", v: "极小点；结构可以作为热力学与谱计算的起点" },
              { k: "1 个虚频", v: "一阶鞍点，通常就是过渡态；用 MOLDEN_VIB 确认它连接的反应坐标" },
              { k: "多个虚频", v: "高阶鞍点，或几何/SCF 没收敛；先收紧优化与 EPS_SCF 再重算" },
              { k: "低频小虚频", v: "常见于弱相互作用、近简并或数值噪声；做 DX 敏感性测试" },
            ],
          },
          {
            type: "demo",
            id: "units",
            title: "动手：cm⁻¹、THz 与周期",
            desc: "在单位演示里把 3300 cm⁻¹ 换成 THz 与飞秒周期，理解为什么 0.5 fs 步长能采样 O–H 伸缩。",
          },
          {
            type: "p",
            text: "虚频不一定是错误，但**不能带着虚频去报热化学或 IR 谱**。过渡态的频率计算本来就应该有且只有一个虚频；极小点出现虚频，先把几何重新优化到更严的力判据，再检查 `DX` 是否过大、盒子是否太小、是否有原子几乎重叠。",
          },
        ],
      },
      {
        id: "10.3",
        title: "数值细节决定频率可信度",
        blocks: [
          {
            type: "p",
            text: "CP2K 用中心差分构造 Hessian：每个原子沿 $\\pm x,\\pm y,\\pm z$ 各位移一次，算一次力。一次完整频率计算的开销约为 **6N 次力计算**，这也是它比几何优化还贵的原因；大体系先想清楚是否只需要部分模式。",
          },
          {
            type: "p",
            text: "`DX` 默认 0.01 Bohr。步长太大，非谐性让频率系统性偏移；步长太小，SCF 噪声会淹没力的差分。手册给的底线是 `EPS_SCF` 收到 1E-8 量级，否则低频不可信；几何也要优化到 `MAX_FORCE` 全部达标，而不是只看能量变化。",
          },
          {
            type: "key",
            items: [
              { k: "DX 1.0E-2", v: "有限差分步长，单位 Bohr；默认值，先别改" },
              { k: "EPS_SCF 1.0E-8", v: "频率计算建议的 SCF 阈值；低频对残差最敏感" },
              { k: "FULLY_PERIODIC", v: "默认 F；固体/周期体系设 T，避免清理转动模式" },
              { k: "INTENSITIES", v: "默认 F；打开后算 IR/Raman 强度，需要额外响应设置" },
              { k: "THERMOCHEMISTRY", v: "默认 F；只对气相分子有意义" },
            ],
          },
          {
            type: "p",
            text: "频率是二阶导数，对基组、`CUTOFF`、`REL_CUTOFF` 都比能量更敏感。报数之前至少做一次参数校验：把 `DX` 改大或改小 2–5 倍复算同一个模式，把 `CUTOFF` 提高一档，看目标峰的漂移是否小于你声称的精度。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "不要用默认 SCF 跑低频",
            text: "优化时 1E-6 的 SCF 残差够用，频率不够。低频模式的力常数很小，残差和数值噪声会直接变成几十 cm⁻¹ 的假峰或假虚频；先把 `EPS_SCF` 收紧，再谈基组。",
          },
        ],
      },
      {
        id: "10.4",
        title: "IR 强度：看偶极矩怎么变",
        blocks: [
          {
            type: "p",
            text: "红外吸收来自振动过程中偶极矩的变化。第 $i$ 个模式的强度正比于偶极矩对简正坐标导数的平方：$I_i\\propto|\\partial\\mu/\\partial Q_i|^2$。偶极矩不变的模式（如对称分子的对称伸缩）是 IR 非活性的，算出来强度接近 0，这不是程序出错。",
          },
          {
            type: "p",
            text: "所以除了 Hessian，还需要**每个位移构型上的偶极矩**。CP2K 里由 `&DFT/&PRINT/&MOMENTS` 提供，最后由 `INTENSITIES T` 把两边拼起来。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "让每个位移都输出偶极矩",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &PRINT
      &MOMENTS
      &END MOMENTS
    &END PRINT
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "code",
            lang: "cp2k",
            title: "打开 IR 强度",
            text: `&VIBRATIONAL_ANALYSIS
  DX 1.0E-2
  INTENSITIES T
&END VIBRATIONAL_ANALYSIS`,
          },
          {
            type: "p",
            text: "输出里每个模式会多一列强度，常见单位是 km/mol。简并模式共享强度，比较实验谱时要把它们加在一起；低频模式受非谐与数值噪声影响更大，强度不如高频峰可靠，不要拿它去和实验峰高直接比。",
          },
          {
            type: "p",
            text: "周期性体系要留意偶极的定义。`MOMENTS` 的 `PERIODIC` 默认是 T，用 Berry 相位公式，适用于绝缘体；设成 F 时用简单偶极算符，手册明确只有**垂直于周期方向的分量**是良定义的。slab 的法向通常是真空，垂直分量正好可用；三维体相则要认真处理。",
          },
        ],
      },
      {
        id: "10.5",
        title: "Raman：极化率的故事",
        blocks: [
          {
            type: "p",
            text: "Raman 散射来自诱导偶极，强度取决于极化率对简正坐标的导数。IR 看偶极矩的一阶变化，Raman 看极化率的一阶变化，两套选择定则互补；一个模式可以在 IR 里很弱、在 Raman 里很强，反过来也一样。",
          },
          {
            type: "p",
            text: "CP2K 里 Raman 强度仍然由 `INTENSITIES T` 汇总，但极化率必须在 `&PROPERTIES/&LINRES/&POLAR` 里显式打开。少任何一个前置开关，强度都只会是空列。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Raman 需要的极化率设置",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &PROPERTIES
    &LINRES
      &POLAR ON
      &END POLAR
    &END LINRES
  &END PROPERTIES
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "线性响应要解耦合微扰方程，成本明显高于纯频率。实践顺序是：先确认频率与虚频，再开 IR；IR 正常后再开 Raman。把三步分开跑，出错时能立刻定位是几何、SCF 还是响应设置。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "强度不是判据",
            text: "强度对基组、泛函、数值步长都敏感，绝对峰高很少能和实验逐点对上。用频率位置和模式归属做主要比较，强度只用来看相对强弱与哪些峰该出现。",
          },
        ],
      },
      {
        id: "10.6",
        title: "热化学：ZPE、熵与吉布斯自由能",
        blocks: [
          {
            type: "p",
            text: "有了频率就能算配分函数，进而得到零点能、内能、焓、熵和吉布斯自由能。CP2K 把这一套放在 `&VIBRATIONAL_ANALYSIS` 里，用 `THERMOCHEMISTRY T` 打开，用 `TC_TEMPERATURE` 与 `TC_PRESSURE` 给条件；没有独立的 `&THERMOCHEMISTRY` 节。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "298.15 K、1 atm 的热化学",
            text: `&VIBRATIONAL_ANALYSIS
  DX 1.0E-2
  THERMOCHEMISTRY T
  TC_TEMPERATURE 298.15
  TC_PRESSURE 1.01325E+5
  &PRINT
    &MOLDEN_VIB
      FILENAME h2o_freq
    &END MOLDEN_VIB
  &END PRINT
&END VIBRATIONAL_ANALYSIS`,
          },
          {
            type: "formula",
            tex: "E_{\\mathrm{ZPE}}=\\frac{1}{2}\\sum_i h\\nu_i",
          },
          {
            type: "p",
            text: "零点能是所有振动模式 $h\\nu_i/2$ 的和；热修正再叠加每个模式的振动熵与平动/转动贡献。两个默认值要记住：`TC_TEMPERATURE` 默认 **273.15 K**（不是 298.15），`TC_PRESSURE` 默认 101325 Pa。要报标准态数据，就显式写 298.15。",
          },
          {
            type: "table",
            head: ["输出量", "来自", "使用时的注意点"],
            rows: [
              ["ZPE", "全部实频", "虚频存在时 ZPE 没有意义"],
              ["内能 / 焓", "电子能 + ZPE + 热修正", "确认报告的是哪个参考态"],
              ["熵", "平动、转动、振动配分函数", "低频模式贡献大，RRHO 容易高估"],
              ["吉布斯自由能", "G = H − TS", "只适用于气相分子，别直接套到表面"],
            ],
          },
          {
            type: "p",
            text: "手册写得很清楚：热化学基于刚性转子–谐振子（RRHO）模型，只适用于气相分子；柔性体系里非常低的振动频率会让 RRHO 失效。表面吸附、团簇、氢键网络都要另外处理低频与平动/转动，不能把气相公式硬套。",
          },
        ],
      },
      {
        id: "10.7",
        title: "TRAVIS：把 Wannier 中心交给后处理",
        blocks: [
          {
            type: "p",
            text: "有限差分的 IR 强度只给静态谱峰；要算有限温度下的谱线形状，需要偶极矩的时间序列。TRAVIS 是 Martin Brehm 开发的 CP2K 轨迹分析工具，读取含 Wannier 中心的轨迹，用偶极自相关函数得到 IR，用极化率自相关得到 Raman。",
          },
          {
            type: "p",
            text: "第一步是在 AIMD 里每一步都做局域化并打印 Wannier 中心。`&LOCALIZE T` 打开局域化，`METHOD CRAZY` 是课程示例采用的局域化方法；`&PRINT/&WANNIER_CENTERS` 的 `IONS+CENTERS` 把原子和中心写进同一个 xyz。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "AIMD 中输出 Wannier 中心轨迹",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &LOCALIZE T
      METHOD CRAZY
    &END LOCALIZE
    &PRINT
      &WANNIER_CENTERS
        IONS+CENTERS
        FILENAME wannier.xyz
        &EACH
          MD 1
        &END EACH
      &END WANNIER_CENTERS
    &END PRINT
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "轨迹准备好后，按官网说明编译 TRAVIS（g++/gfortran 加 make），在 `exe/` 下得到可执行文件。运行时它会逐项提问：盒子边长（pm）、要算的函数（`ir`）、帧间隔（fs）、偶极模式、ACF 深度、是否输出整体谱。",
          },
          {
            type: "code",
            lang: "bash",
            title: "用 Wannier 轨迹算 IR",
            text: `travis -p wannier.xyz
# 交互示例：782 / ir / 0.5 / 1 / 3115 / y
ls ir_spectrum_global.csv ir_spectrum_H2O.csv`,
          },
          {
            type: "steps",
            items: [
              { t: "确认轨迹", d: "xyz 里同时有原子和 X 中心，帧间隔与 MD 的 TIMESTEP 一致；中心数等于占据轨道数。" },
              { t: "选分析", d: "一次只做一种分析；IR 选 ir，Raman 另起一轮，避免输入串味。" },
              { t: "给时间步", d: "每 5 步保存一次、TIMESTEP 0.5 fs，则这里填 2.5 fs；填错会让峰位整体缩放。" },
              { t: "定 ACF 深度", d: "深度越大频率分辨率越高，但不能超过总帧数；总时长不足时低频峰会被截断。" },
              { t: "导出与记录", d: "结果写在当前目录的 CSV；把盒子、步长、ACF 深度和 travis 版本一起记进方法段。" },
            ],
          },
          {
            type: "p",
            text: "TRAVIS 的交互答案可以用输入文件复用，适合批量与复现；结果文件默认不覆盖旧文件，重复运行会加 `#1#` 后缀。谱图导入 Origin 或 Python 画图时，横轴是波数、纵轴是强度，注意单位与是否做了归一化。",
          },
        ],
      },
      {
        id: "10.8",
        title: "常见坑与交付检查",
        blocks: [
          {
            type: "table",
            head: ["症状", "常见原因", "处理"],
            rows: [
              ["极小点出现一个明显虚频", "几何未优化到位，或盒子太小", "收紧 MAX_FORCE 重优化；加大真空；复算 DX"],
              ["低频一片小虚频", "EPS_SCF 太松、网格噪声", "EPS_SCF 收到 1E-8；提高 CUTOFF；做 DX 敏感性"],
              ["IR 强度全是 0", "没开 MOMENTS，或没设 INTENSITIES T", "补 `&DFT/&PRINT/&MOMENTS` 与 `INTENSITIES T`"],
              ["Raman 没有强度", "没开 `&PROPERTIES/&LINRES/&POLAR`", "补极化率设置，再重跑响应"],
              ["热化学报错或数值离谱", "有虚频，或体系不是气相分子", "先消虚频；表面/团簇改用别的自由能路线"],
              ["TRAVIS 峰位整体偏移", "帧间隔填错，或盒子单位不是 pm", "核对 TIMESTEP×保存间隔；确认盒子单位"],
            ],
          },
          {
            type: "steps",
            items: [
              { t: "结构", d: "优化判据全部达标；记录泛函、基组、CUTOFF、k 点与色散设置。" },
              { t: "纯频率", d: "先不开强度与热化学，确认虚频数目符合预期。" },
              { t: "数值校验", d: "DX 改 2–5 倍复算目标模式；确认漂移小于声称精度。" },
              { t: "强度", d: "先 IR 后 Raman；每一步都确认前置开关真的打开。" },
              { t: "交付", d: "输入、Molden、频率表、热化学输出、TRAVIS 命令与版本一起归档。" },
            ],
          },
          {
            type: "keypoints",
            items: [
              "`&VIBRATIONAL_ANALYSIS` 是顶层节；`RUN_TYPE` 用 `VIBRATIONAL_ANALYSIS`",
              "极小点 0 个虚频，过渡态 1 个；多个虚频先怀疑几何与 SCF",
              "IR 要 `INTENSITIES T` + `MOMENTS`；Raman 再加 `LINRES/POLAR`",
              "热化学是 RRHO，只对气相分子；默认温度 273.15 K",
              "有限温度谱用 Wannier 中心轨迹 + TRAVIS，帧间隔必须与保存频率一致",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "频率计算里，`&VIBRATIONAL_ANALYSIS` 应该放在哪里？",
        options: [
          "顶层，与 `&FORCE_EVAL`、`&MOTION` 平级",
          "放进 `&MOTION` 里，作为它的子节",
          "放进 `&DFT` 里，紧挨 `&SCF`",
          "放进 `&SUBSYS` 里，紧挨 `&COORD`",
        ],
        answer: 0,
        explain: "当前手册把 VIBRATIONAL_ANALYSIS 列为顶层输入节；配 RUN_TYPE VIBRATIONAL_ANALYSIS 使用。旧教程常写在 &MOTION 下，照抄前先核对版本。",
      },
      {
        q: "一个本应是小极小的结构算出 1 个明显虚频，最合理的解释是？",
        options: [
          "程序把平动模式算成了虚频",
          "结构是一阶鞍点，或优化/SCF 尚未收敛",
          "虚频一定代表计算失败，必须换泛函",
          "基组越大虚频越多，属于正常现象",
        ],
        answer: 1,
        explain: "一个虚频对应一个负曲率方向：可能确实是过渡态，也可能是几何没优化到位或 SCF 太松。先用 MOLDEN_VIB 看模式方向，再收紧优化与 EPS_SCF 复算。",
      },
      {
        q: "要得到 IR 强度，除了 `INTENSITIES T` 还需要打开什么？",
        options: [
          "`&PROPERTIES/&LINRES/&POLAR`",
          "`&DFT/&PRINT/&MOMENTS`，让每个位移都有偶极矩",
          "`&SMEAR ON`，让占据数连续",
          "`FULLY_PERIODIC T`，去掉转动模式",
        ],
        answer: 1,
        explain: "IR 强度来自偶极矩对简正坐标的导数，需要每个位移构型的偶极矩；Raman 才需要 LINRES/POLAR 的极化率。INTENSITIES 只是汇总开关。",
      },
      {
        q: "`TC_TEMPERATURE` 不写时，CP2K 的默认热化学温度是？",
        options: ["0 K", "273.15 K", "298.15 K", "300 K"],
        answer: 1,
        explain: "手册给的默认值是 273.15 K，不是常见的 298.15 K。要报标准态数据必须显式写 TC_TEMPERATURE 298.15。",
      },
      {
        q: "用 TRAVIS 算有限温度 IR，轨迹里必须包含什么？",
        options: [
          "只含原子坐标的 xyz 即可",
          "每帧的受力",
          "Wannier 中心（IONS+CENTERS）",
          "每个原子的电荷",
        ],
        answer: 2,
        explain: "TRAVIS 用 Wannier 中心与原子坐标构造偶极时间序列，再做自相关；只有原子坐标无法得到偶极矩。CP2K 侧要开 LOCALIZE 并打印 WANNIER_CENTERS。",
      },
    ],
    terms: [
      { t: "Hessian", en: "Hessian matrix", d: "能量对原子坐标的二阶偏导矩阵；对角化后给出简正模式与频率。" },
      { t: "虚频", en: "imaginary frequency", d: "Hessian 负本征值对应的频率，表示该方向是能量极大；一个虚频通常是一阶鞍点。" },
      { t: "零点能", en: "zero-point energy", d: "所有振动模式 hν/2 之和，即使在 0 K 也存在。" },
      { t: "RRHO", en: "rigid-rotor harmonic oscillator", d: "刚性转子–谐振子近似；热化学的标准模型，低频模式与柔性体系下会失效。" },
      { t: "偶极导数", en: "dipole derivative", d: "偶极矩对简正坐标的导数；平方正比于 IR 强度。" },
      { t: "Wannier 中心", en: "Wannier center", d: "局域化轨道的中心位置；与原子坐标一起构造偶极矩时间序列，供 TRAVIS 做 IR。" },
      { t: "自相关函数", en: "autocorrelation function", d: "TRAVIS 用偶极或极化率的时间自相关，经傅里叶变换得到谱线形状。" },
    ],
    sources: [
      { t: "CP2K_INPUT / VIBRATIONAL_ANALYSIS", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/VIBRATIONAL_ANALYSIS.html" },
      { t: "Methods / Infrared Spectroscopy", url: "https://manual.cp2k.org/trunk/methods/properties/infrared.html" },
      { t: "Methods / Raman Spectroscopy", url: "https://manual.cp2k.org/trunk/methods/properties/raman.html" },
      { t: "CP2K_INPUT / FORCE_EVAL / DFT / PRINT / MOMENTS", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/PRINT/MOMENTS.html" },
      { t: "CP2K_INPUT / DFT / LOCALIZE / PRINT / WANNIER_CENTERS", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/LOCALIZE/PRINT/WANNIER_CENTERS.html" },
    ],
  };
})();