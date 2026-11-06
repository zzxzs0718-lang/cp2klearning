(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch18"] = {
    id: "ch18",
    num: 18,
    part: "进阶与工程",
    title: "高级方法：QM/MM、隐式溶剂、机器学习势与半经验",
    subtitle: "当纯 DFT 不够用：换方法、换边界，而不是硬堆核时",
    hours: 6.0,
    level: "高级",
    intro:
      "纯 DFT 能算的体系有上限：几百个原子、几百皮秒，再大就要换思路。这一章讲四种「扩展」——把大环境交给力场（QM/MM）、把溶剂交给连续介质（SCCS）、把势能面交给神经网络（ML 势）、把电子结构降级成半经验（xTB/DFTB）。它们不是替代 DFT，而是把 DFT 用在真正需要它的那一小块上。",
    goals: [
      "判断一个问题该用 QM/MM、隐式溶剂、机器学习势还是半经验方法",
      "写出一个能跑的 &QMMM 输入，并正确处理切共价键与电荷重分配",
      "用 &SCCS 设置隐式溶剂，说清 ALPHA、BETA、GAMMA 各自对应哪一项能量",
      "把 NNP、DeePMD、NequIP、MACE、ACE 模型接进 CP2K，并知道各自的并行代价",
    ],
    sections: [
      {
        id: "18.1",
        title: "四种扩展，各补一块短板",
        blocks: [
          {
            type: "p",
            text: "先明确一件事：**高级方法不提高精度，只扩大适用范围**。DFT 的精度由泛函和基组决定；QM/MM、隐式溶剂、ML 势、半经验改变的是「哪些原子用量子方法处理」「环境怎么表示」「势能面从哪来」。选错的代价往往不是算错一位小数，而是物理模型根本不成立。",
          },
          {
            type: "table",
            head: ["你的问题", "首选", "原因"],
            rows: [
              ["酶活性中心、溶液中的反应", "QM/MM", "几十个原子要量子精度，上万原子的蛋白/水只要静电与位阻"],
              ["溶质在溶剂里的自由能、pKa", "隐式溶剂（&SCCS）", "不需要显式溶剂分子，几次 SCF 就得到溶剂化能"],
              ["纳秒级 MD、上千原子、仍要断键", "机器学习势", "训练好后每步成本接近力场，精度接近训练数据所用方法"],
              ["上万原子的构象筛查、QM/MM 的 QM 引擎", "半经验（xTB/DFTB）", "比 DFT 便宜一到两个数量级，能描述电子结构"],
            ],
            caption: "先按「体系多大、要多准、要不要断键」三问定位，再谈关键词。",
          },
          {
            type: "compare",
            left: {
              title: "QM/MM 与隐式溶剂：都在处理环境",
              items: [
                "QM/MM 保留环境的**每个原子**，用经典力场描述",
                "隐式溶剂把环境抹成**连续介质**，只剩介电常数和空腔",
                "前者能看氢键网络、离子配对；后者只给平均溶剂化效应",
                "前者需要拓扑文件与平衡；后者几乎不增加准备成本",
              ],
            },
            right: {
              title: "ML 势与半经验：都在替换 QM 引擎",
              items: [
                "ML 势来自拟合，**外推区域不可信**，必须做适用域检查",
                "半经验是近似哈密顿量，参数集决定它能描述哪些元素",
                "两者都能驱动力、优化、MD 与增强采样",
                "ML 势的训练在 Python 侧；CP2K 只做推理",
              ],
            },
          },
          {
            type: "callout",
            kind: "warn",
            title: "不要用高级方法掩盖坏模型",
            text: "如果 slab 的真空层不够、自旋态没设对、赝势和基组不匹配，换成 QM/MM 或 ML 势只会让错误更贵。**先把纯 DFT 的单点能跑收敛**，再决定要不要加环境。",
          },
        ],
      },
      {
        id: "18.2",
        title: "QM/MM：先切体系，再调参数",
        blocks: [
          {
            type: "p",
            text: "QM/MM 的总能量写成三块：$E = E_{QM} + E_{MM} + E_{QM/MM}$。真正决定物理的是第三块，也就是**耦合项**。CP2K 里用 `&FORCE_EVAL METHOD QMMM` 打开它，QM 区用 `&QM_KIND` 逐元素列出 MM 原子编号，MM 区用 `&MM/&FORCEFIELD` 读拓扑。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "qmmm.inp（骨架）",
            text: `&FORCE_EVAL
  METHOD QMMM
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 320
      REL_CUTOFF 50
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 50
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &QMMM
    E_COUPL COULOMB
    &QM_KIND O
      MM_INDEX 5668 5669 5670
    &END QM_KIND
    &QM_KIND C
      MM_INDEX 5665 5666 5667 5671 5672
    &END QM_KIND
    &MM
      &FORCEFIELD
        PARMTYPE AMBER
        PARM_FILE_NAME complex.prmtop
      &END FORCEFIELD
    &END MM
  &END QMMM
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`E_COUPL COULOMB` 是**静电嵌入**：MM 点电荷进入 QM 哈密顿量，QM 电子云会被环境极化；`E_COUPL NONE` 是**机械嵌入**，QM 只感受到 MM 的位阻，感受不到电荷。做酶催化、离子附近反应，默认应该用静电嵌入；只有环境几乎无极性、或只想省时间时才用 NONE。",
          },
          {
            type: "key",
            items: [
              { k: "MM_INDEX", v: "MM 拓扑里的原子序号（从 1 开始），必须与 prmtop/PSF 完全一致", tag: "易错" },
              { k: "PARMTYPE AMBER", v: "读 Amber prmtop；CHARMM 体系改成 CHM 并给 PSF", tag: "必填" },
              { k: "&QM_KIND", v: "按元素分组列 MM_INDEX，可写多行；同一原子不能重复出现", tag: "必填" },
              { k: "E_COUPL COULOMB", v: "静电嵌入；QM 区被 MM 电荷极化", tag: "推荐" },
            ],
          },
          {
            type: "callout",
            kind: "danger",
            title: "QM 区不要跨共价键",
            text: "如果 QM 区边界切在 C–C 键中间，边界碳会缺一个键、电子数也不对。**优先把整个残基或整个分子放进 QM 区**；确实要切，必须加 `&LINK` 并重分配电荷（下一节）。",
          },
        ],
      },
      {
        id: "18.3",
        title: "切共价键：&LINK、link atom 与电荷重分配",
        blocks: [
          {
            type: "p",
            text: "QM 区边界落在共价键上时，CP2K 用**link atom**（通常是氢）补足 QM 边界的悬挂键。关键词是 `&LINK`：`MM_INDEX` 指向被切掉的 MM 原子，`QM_INDEX` 指向留在 QM 区的原子，`LINK_TYPE IMOMM` 表示按 IMOMM 方案放置 link atom。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "切断 Cα–Cβ 的 &LINK",
            text: `  &QMMM
    E_COUPL COULOMB
    &LINK
      MM_INDEX 1411
      QM_INDEX 1413
      LINK_TYPE IMOMM
    &END LINK
    &QM_KIND C
      MM_INDEX 1409 1410 1413 1414 1415
    &END QM_KIND
  &END QMMM`,
          },
          {
            type: "p",
            text: "切键的原则：**切最没有化学意义的键**。脂肪族 Cα–Cβ、远离反应中心的烷基链都可以；不要切 C–O、C–N、C=O 或任何带强极性的键，因为 link atom 无法还原它的电子结构。切点越靠近反应中心，误差越大。",
          },
          {
            type: "p",
            text: "切键后体系总电荷变了：被切掉的 MM 片段少了一部分，QM 区的形式电荷必须补回来，MM 残基上的部分电荷也要相应重分配。Amber 体系的做法是用 `parmed` 改残基电荷，再改 `PARM_FILE_NAME` 指向新拓扑。",
          },
          {
            type: "code",
            lang: "bash",
            title: "用 parmed 修拓扑（Amber）",
            text: `# 把主链 6 个原子的电荷各减 0.0362/6，
# 保证切键后整个残基仍为电中性
parmed -p complex.prmtop <<'EOF'
change charge @1409 -0.3419
changeLJSingleType :WAT@H1 0.3019 0.047
changeLJSingleType :*@HO 0.3019 0.047
outparm complex_LJ_mod.prmtop
EOF`,
          },
          {
            type: "p",
            text: "第二、三行处理的是 Amber 水模型和羟基氢的**零 LJ 参数**：HO/HG 类型的 ε 与 σ 为 0，QM 电子云会一头扎进这个没有排斥的核，表现为 SCF 崩溃或力爆炸。给它们补上 0.3019 Å 与 0.047 kcal/mol 的 LJ 参数是手册教程的做法。",
          },
          {
            type: "keypoints",
            items: [
              "先决定 QM 区，再决定切哪根键；能整残基进 QM 就不要切",
              "切键必须加 &LINK，并同步修改 QM 形式电荷与 MM 部分电荷",
              "Amber 的 HO/HG 氢 LJ 为零，必须补参数，否则会「算着算着炸掉」",
              "每次改完拓扑，都用单点能确认总电荷与原子数没有错",
            ],
          },
        ],
      },
      {
        id: "18.4",
        title: "隐式溶剂：&SCCS 与 SMD/PCM 参数",
        blocks: [
          {
            type: "p",
            text: "显式溶剂要几百个水分子和长时间采样；隐式溶剂把溶剂换成**连续介质**，只保留介电常数与一个由电子密度定义的空腔。CP2K 的实现叫 **SCCS**（self-consistent continuum solvation），输入节是 `&DFT/&SCCS`。很多文献把这类模型统称 PCM 或 SMD；在 CP2K 里你找不到名为 `&IMPLICIT_SOLVATION` 的 DFT 节，对应的就是 `&SCCS`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "水中的溶质（SCCS）",
            text: `&DFT
  &SCCS ON
    METHOD ANDREUSSI
    RELATIVE_PERMITTIVITY 78.36
    EPS_SCF 1.0E-2
    EPS_SCCS 1.0E-6
    MAX_ITER 100
    DERIVATIVE_METHOD CD7
    CORE_FILL T
    ! 非静电项默认 0；复现某套 SMD/PCM 参数时
    ! 按溶剂填 GAMMA、ALPHA、BETA
  &END SCCS
&END DFT`,
          },
          {
            type: "p",
            text: "三个非静电项对应三种物理：$G^{cav}=\\gamma S$ 是**空化**（挖洞要能量，γ 是表面张力），$G^{rep}=\\alpha S$ 是**排斥**（溶剂不愿进到溶质电子云里），$G^{dis}=\\beta V$ 是**色散**（溶剂与溶质的吸引）。`GAMMA` 的别名是 `SURFACE_TENSION`，单位 mN/m；`BETA` 单位 GPa。",
          },
          {
            type: "table",
            head: ["关键词", "作用", "默认值 / 注意"],
            rows: [
              ["`RELATIVE_PERMITTIVITY`", "溶剂介电常数", "默认 80；水用 78.36"],
              ["`GAMMA`（`SURFACE_TENSION`）", "空化项 γS", "默认 0，必须按模型补"],
              ["`ALPHA` / `BETA`", "排斥项 αS / 色散项 βV", "默认 0，不补就只剩静电"],
              ["`METHOD`", "介电函数平滑方式", "ANDREUSSI / FATTEBERT-GYGI / SAA_ANDREUSSI"],
              ["`EPS_SCF`", "SCF 收敛到此值才启动 SCCS 循环", "默认 0.5，太松会震荡"],
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "默认参数只给你「静电溶剂化」",
            text: "ALPHA、BETA、GAMMA 的默认值都是 0。这意味着默认的 &SCCS 只包含极化与介电屏蔽，**不包含空化与色散**。要与文献的 SMD/PCM 数值对比，必须使用同一套溶剂参数，并把这三项填全；随手填一个数只会得到无法解释的偏移。",
          },
          {
            type: "p",
            text: "如果还需要非周期的静电边界或分区介电（例如真空/溶剂两层），用 `&DFT/&POISSON/&IMPLICIT`：它支持 `BOUNDARY_CONDITIONS MIXED`、`NEUMANN_DIRECTIONS` 与 `&IMPLICIT/&DIELECTRIC` 的 `RHO_MIN`、`RHO_MAX` 空腔阈值。它和 `&SCCS` 是两个层次：前者管静电边界与介电分布，后者管溶剂化自由能的表面项。",
          },
        ],
      },
      {
        id: "18.5",
        title: "机器学习势：五种模型，一个接口逻辑",
        blocks: [
          {
            type: "p",
            text: "CP2K 里的 ML 势都只替换 `FORCE_EVAL` 的能量与力，**MD、优化、增强采样的输入一个字都不用改**。区别在模型格式、编译依赖和并行方式。先把这张表记住，再看具体输入。",
          },
          {
            type: "table",
            head: ["模型", "输入节", "编译依赖", "并行特点"],
            rows: [
              ["NNP（n2p2）", "`METHOD NNP` + `&NNP`", "内置", "MPI 分原子 + OpenMP，扩展性好"],
              ["DeePMD", "`&MM/&NONBONDED/&DEEPMD`", "libdeepmd_c", "随 CUDA 自动用 GPU"],
              ["NequIP / Allegro", "`&NONBONDED/&NEQUIP`", "LibTorch 2.4–2.7", "每 rank 算全系统再平均，MPI 扩展差"],
              ["MACE", "`&NONBONDED/&MACE`", "LibTorch", "同样每 rank 算全系统"],
              ["ACE", "`&NONBONDED/&ACE`", "ACE 库", "线性标度，便宜"],
            ],
            caption: "选型先看体系大小与并行规模，再看精度。ML 势都要求模型与元素一一对应。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "NNP：committee 给误差棒",
            text: `&FORCE_EVAL
  METHOD NNP
  &NNP
    NNP_INPUT_FILE_NAME nnp-1/input.nn
    SCALE_FILE_NAME nnp-1/scaling.data
    VERLET_SKIN 1.0
    &MODEL
      WEIGHTS nnp-1/weights
    &END MODEL
    &MODEL
      WEIGHTS nnp-2/weights
    &END MODEL
  &END NNP
  &SUBSYS
    &CELL
      ABC 12.42 12.42 12.42
    &END CELL
    &COORD
      O 0.000 0.000 0.000
      H 0.957 0.000 0.000
      H -0.240 0.927 0.000
    &END COORD
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "NNP 读 n2p2 格式：`input.nn` 定义描述符与网络结构，`scaling.data` 做输入归一化，每个 `&MODEL` 指向一组权重。用 8 个模型组成 committee，模型间标准差就是**外推诊断**：某帧的标准差突然变大，说明它跑出了训练集，该停下来补数据，而不是继续跑 MD。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "MACE / NequIP：LibTorch 模型",
            text: `&FORCE_EVAL
  METHOD FIST
  &MM
    &FORCEFIELD
      &NONBONDED
        &MACE
          ATOMS Cu
          POT_FILE_NAME MACE/my_mace.model-cp2k.pth
        &END MACE
      &END NONBONDED
    &END FORCEFIELD
  &END MM
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "MACE 模型要先在 Python 侧导出成 TorchScript：`python create_cp2k_model.py my_mace.model --dtype float64`，得到 `*-cp2k.pth`。NequIP/Allegro 则用 `&NEQUIP MODEL_TYPE NEQUIP`，并显式写 `UNIT_ENERGY eV`、`UNIT_FORCES eV*angstrom^-1`、`UNIT_LENGTH angstrom`——**单位写错不会报错，只会给你一条斜率不对的能量曲线**。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "消息传递模型的并行陷阱",
            text: "MACE、NequIP 是非局域感受野：每个 MPI rank 都要算整个系统，再把能量、力、virial 除以 rank 数。开 32 个 rank 不会快 32 倍，常常只快一点甚至更慢。**这类模型应该用少量 rank + 多 OpenMP 线程**，或者干脆单节点跑。",
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "动手：生成一份 ML 势或 QM/MM 输入",
            desc: "在生成器里选 METHOD NNP 或 QMMM，看对应的节应该放在哪一层。",
          },
        ],
      },
      {
        id: "18.6",
        title: "半经验方法：xTB 与 DFTB 的定位",
        blocks: [
          {
            type: "p",
            text: "半经验方法保留了量子力学的骨架（轨道、占据、自洽电荷），但把大量积分换成参数。它比力场贵、比 DFT 便宜一到两个数量级，能描述断键与电荷转移，是**大体系预筛**和 **QM/MM 的 QM 引擎**的常见选择。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "GFN2-xTB（tblite 后端）",
            text: `&GLOBAL
  PROJECT ice_gfn2
  RUN_TYPE ENERGY
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &QS
      EPS_DEFAULT 1.0E-12
      METHOD xTB
      &XTB
        GFN_TYPE TBLITE
        &TBLITE
          METHOD GFN2
          ACCURACY 0.1
        &END TBLITE
      &END XTB
    &END QS
    &SCF
      EPS_SCF 1.0E-9
      MAX_SCF 300
      SCF_GUESS MOPAC
    &END SCF
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 12.0
      PERIODIC XYZ
    &END CELL
    &COORD
      O 0.0 0.0 0.0
      H 0.96 0.0 0.0
      H -0.24 0.93 0.0
    &END COORD
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`GFN_TYPE TBLITE` 走 tblite 库，可选 `GFN1`、`GFN2`、`IPEA1`；`GFN_TYPE 0` 和 `1` 用 CP2K 内部实现（GFN0/GFN1），不需要外部库。注意节名是 `&QS METHOD xTB`，不是把 `METHOD Quickstep` 改成 xTB——`METHOD` 仍然写在 `&FORCE_EVAL`，`xTB` 是 `&QS` 的选项。",
          },
          {
            type: "table",
            head: ["方法", "输入", "适合", "代价与限制"],
            rows: [
              ["GFN0-xTB", "`GFN_TYPE 0`", "极便宜的构象筛查", "无 SCC 变量，精度最低"],
              ["GFN1-xTB", "`GFN_TYPE 1` 或 tblite GFN1", "大体系 MD、QM/MM", "参数覆盖的元素有限"],
              ["GFN2-xTB", "tblite `METHOD GFN2`", "含弱相互作用、卤键的体系", "每步比 GFN1 贵，需 tblite"],
              ["DFTB/DFTB3", "`&QS/&DFTB`", "固体、大体系预筛", "参数集（Slater-Koster 表）决定可用元素"],
            ],
          },
          {
            type: "p",
            text: "DFTB 在 CP2K 里是 `&DFT/&QS/&DFTB`，`SELF_CONSISTENT` 默认开，`DISPERSION` 打开色散，`HB_SR_GAMMA` 针对氢键调参。它和 xTB 的差别主要在参数化来源与静电处理：xTB 的 GFN2 含各向异性静电与 D4 色散，对分子间作用更稳；DFTB 在固体与含时问题上有更长的历史。",
          },
          {
            type: "callout",
            kind: "info",
            title: "怎么验证半经验结果",
            text: "不要拿半经验绝对值去和 DFT 比。正确做法是：**同一性质、同一构象**，用 10–30 个代表点做 xTB vs DFT 的相关性检查。如果能量差的相关性好（斜率接近 1、截距稳定），才能用 xTB 做大规模筛查；否则只能当定性工具。",
          },
        ],
      },
      {
        id: "18.7",
        title: "GROMACS 接口与选型清单",
        blocks: [
          {
            type: "p",
            text: "如果 MM 侧需要复杂的力场、膜、约束或成熟的采样工具，可以让 **GROMACS 管 MM、CP2K 只算 QM 区**。这要求 GROMACS 编译时带 CP2K QM/MM 支持，并且运行环境能找到 `cp2k` 可执行文件与数据目录。",
          },
          {
            type: "steps",
            items: [
              { t: "编译与连通性", d: "确认 GROMACS 构建带 QM/MM 支持，`cp2k` 在 PATH 中，数据目录可读；先用单个水分子做一次 QM/MM 单点，确认接口通。" },
              { t: "准备 MM 体系", d: "用 GROMACS 工具完成拓扑、溶剂化、离子与能量极小化；体系必须先在没有 QM 的情况下稳定。" },
              { t: "选 QM 原子", d: "在索引文件里定义 QM 组，写出对应的 CP2K 输入片段；QM 区同样要避开共价键。" },
              { t: "定耦合模型", d: "决定静电/机械嵌入、边界处理与 QM 电荷；这些必须与 MM 力场的电荷模型一致。" },
              { t: "短轨迹验证", d: "先跑 1–5 ps，检查能量守恒、温度与 QM 区几何；没问题再延长。" },
            ],
          },
          {
            type: "p",
            text: "无论用内置力场还是 GROMACS，CP2K 这一侧仍然是 Quickstep 的规则：基组与赝势匹配、CUTOFF 收敛、SCF 稳健。**QM/MM 不会放宽对 QM 精度的要求**，它只是把 QM 限制在更小的区域。",
          },
          {
            type: "key",
            items: [
              { k: "体系 < 200 原子、要断键", v: "纯 DFT 或 xTB；先试 DFT", tag: "默认" },
              { k: "蛋白/溶液中的活性中心", v: "QM/MM + 静电嵌入 + 隐式溶剂可叠加", tag: "QM/MM" },
              { k: "只关心溶剂化自由能", v: "&SCCS，省掉显式水", tag: "隐式" },
              { k: "纳秒 MD、上千原子", v: "NNP / DeePMD / MACE / NequIP；先做 committee 或外推检查", tag: "ML" },
              { k: "上万原子筛查", v: "GFN1/GFN2-xTB；用 DFT 抽样校验", tag: "半经验" },
            ],
          },
          {
            type: "keypoints",
            items: [
              "高级方法扩大适用范围，不自动提高精度；模型错了，换方法只会更贵",
              "QM/MM 的关键是 QM 区边界与电荷；切键必须 &LINK + 重分配电荷 + 补 LJ",
              "隐式溶剂在 CP2K 是 &SCCS；ALPHA/BETA/GAMMA 默认 0，等于只算静电",
              "ML 势只换能量力，MD/优化流程不变；消息传递模型的 MPI 扩展要提前算进预算",
              "xTB/DFTB 是「便宜的量子」，适合筛查与 QM/MM，不适合直接报绝对能量",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "QM/MM 里 `E_COUPL COULOMB` 与 `E_COUPL NONE` 的核心区别是？",
        options: [
          "前者算得更快",
          "前者让 MM 点电荷进入 QM 哈密顿量，QM 区被环境极化",
          "后者不允许 QM 区存在",
          "两者只影响输出格式",
        ],
        answer: 1,
        explain: "COULOMB 是静电嵌入，MM 电荷会极化 QM 电子云；NONE 是机械嵌入，QM 只感受位阻。酶与离子体系通常必须用静电嵌入。",
      },
      {
        q: "QM 区边界切在 Cα–Cβ 键上时，下面哪一步不是必须的？",
        options: [
          "加 &LINK 指定 MM_INDEX、QM_INDEX 与 LINK_TYPE",
          "调整 QM 形式电荷并重分配 MM 部分电荷",
          "给 Amber 的 HO/HG 氢补上非零 LJ 参数",
          "把整个蛋白的所有残基都放进 QM 区",
        ],
        answer: 3,
        explain: "QM 区越大越贵，且没有必要。切键后需要 link atom、电荷重分配和零 LJ 修正；把整个蛋白放进 QM 区不现实也不必要。",
      },
      {
        q: "在 CP2K 的 &SCCS 中，`GAMMA` 对应哪一项？",
        options: [
          "色散项 βV",
          "空化项 γS，γ 是溶剂表面张力",
          "排斥项 αS",
          "介电常数",
        ],
        answer: 1,
        explain: "GAMMA（别名 SURFACE_TENSION）是空化项 γS；ALPHA 是排斥项 αS，BETA 是色散项 βV，介电常数是 RELATIVE_PERMITTIVITY。",
      },
      {
        q: "为什么 MACE/NequIP 在 CP2K 里开很多 MPI rank 往往不加速？",
        options: [
          "它们只能用 GPU",
          "消息传递模型每个 rank 都要算整个系统，再把结果除以 rank 数",
          "它们不支持周期性边界",
          "它们只能处理 10 个原子以内",
        ],
        answer: 1,
        explain: "非局域感受野让每个 rank 拥有全系统视图，通信与重复计算抵消了并行收益。这类模型更适合少量 rank + 多线程，或单节点运行。",
      },
      {
        q: "关于半经验方法的使用，下面哪种说法最稳妥？",
        options: [
          "xTB 的能量可以直接替代 DFT 报绝对吸附能",
          "DFTB 的参数集决定它能描述哪些元素，换元素前必须确认参数存在",
          "GFN2-xTB 不需要任何外部库，永远可用",
          "半经验方法不能做几何优化",
        ],
        answer: 1,
        explain: "DFTB 依赖 Slater-Koster 参数表，缺参数就不能算。xTB 适合筛查与趋势，绝对值要与 DFT 抽样校验；GFN2 需要 tblite 库。",
      },
    ],
    terms: [
      { t: "QM/MM", en: "quantum mechanics / molecular mechanics", d: "把体系分成量子区与经典区，分别用电子结构方法与时效力场描述，并加上耦合项。" },
      { t: "静电嵌入", en: "electrostatic embedding", d: "MM 点电荷进入 QM 哈密顿量，使 QM 波函数被环境极化；对应 E_COUPL COULOMB。" },
      { t: "link atom", en: "link atom", d: "切共价键时补在 QM 边界的虚拟原子（通常是氢），用来满足悬挂键。" },
      { t: "SCCS", en: "self-consistent continuum solvation", d: "CP2K 的隐式溶剂模型：由电子密度定义空腔，叠加极化、空化、排斥与色散项。" },
      { t: "描述符", en: "descriptor", d: "把原子局部环境编码成固定长度向量的函数，如 ACSF；ML 势的输入。" },
      { t: "committee", en: "committee of models", d: "训练多个同架构模型，用预测方差估计外推误差；NNP 常用 8 个成员。" },
      { t: "半经验方法", en: "semi-empirical method", d: "保留量子力学框架但用参数替代大量积分的方法，如 xTB 与 DFTB。" },
    ],
    sources: [
      { t: "QM/MM", url: "https://manual.cp2k.org/trunk/methods/qm_mm/index.html" },
      { t: "QM/MM with the Built-in Force Field", url: "https://manual.cp2k.org/trunk/methods/qm_mm/builtin.html" },
      { t: "Machine Learning", url: "https://manual.cp2k.org/trunk/methods/machine_learning/index.html" },
      { t: "Extended Tight Binding", url: "https://manual.cp2k.org/trunk/methods/semiempiricals/xtb.html" },
    ],
  };
})();