(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch10"] = {
    id: "ch10",
    num: 10,
    part: "结构与振动",
    title: "周期性、k 点与自旋",
    subtitle: "从只算 Γ 点，到金属体系的网格与自旋设置",
    hours: 2.5,
    level: "进阶",
    intro:
      "把分子放进周期性盒子之后，电子波函数多了一个倒空间标签 k。任何要在布里渊区上积分的量——能量、密度、力——都被一个有限网格近似掉。这一章讲清三件事：网格怎么选、对称性替你省了什么、以及自旋与金属占据为什么会让同一个体系变得难收敛。",
    goals: [
      "说清 k 点网格在近似什么，以及省略 &KPOINTS 时 CP2K 实际在算什么",
      "用 MONKHORST-PACK、MACDONALD、GENERAL 三种 SCHEME 写出正确的网格，并读出 UNITS 的含义",
      "画出 k 点收敛曲线，判断总能量、力、金属占据各自需要多密的网格；判断哪些体系 Γ 点就够",
      "用 UKS + MULTIPLICITY + MAGNETIZATION 设置自旋态，用 &SMEAR 处理金属占据",
    ],
    sections: [
      {
        id: "10.1",
        title: "k 点到底在近似什么",
        blocks: [
          {
            type: "p",
            text: "晶体里电子波函数是 Bloch 波 $\\psi_{n\\mathbf{k}}(\\mathbf{r}) = e^{i\\mathbf{k}\\cdot\\mathbf{r}} u_{n\\mathbf{k}}(\\mathbf{r})$，标签 $\\mathbf{k}$ 跑遍第一布里渊区。总能量、电子密度、Hellmann–Feynman 力，全都要对 $\\mathbf{k}$ 做积分——这个积分没有解析解，只能数值近似。",
          },
          {
            type: "formula",
            tex: "\\frac{1}{\\Omega_{\\mathrm{BZ}}}\\int_{\\mathrm{BZ}} f(\\mathbf{k})\\,d\\mathbf{k} \\;\\approx\\; \\sum_{\\mathbf{k}} w_{\\mathbf{k}}\\, f(\\mathbf{k})",
            caption: "CP2K 的做法：用有限个加权 k 点代替整块布里渊区",
          },
          {
            type: "p",
            text: "`&DFT` 下的 `&KPOINTS` 定义的就是这组采样点。**省略它不等于「不做 k 点计算」，而是只算 Γ 点**（$\\mathbf{k}=0$）——`SCHEME GAMMA` 是它的显式写法。所以「要不要加 k 点」这个问题的真实形式是：**只取 Γ 点时，积分误差有多大？**",
          },
          {
            type: "p",
            text: "判断标准很朴素：Γ 点近似相当于假设被积函数在布里渊区里变化平缓。绝缘体、分子晶体、大超胞满足得比较好；金属的占据数在费米面处跳变，小晶胞的半导体的带边也很陡，这两类体系只算 Γ 点会系统性算错。",
          },
          {
            type: "key",
            items: [
              { k: "&KPOINTS", v: "定义 SCF 采样网格；不写就是 Γ-only", tag: "核心" },
              { k: "SCHEME MONKHORST-PACK", v: "最常用：给三个方向的网格数，均匀铺开", tag: "常用" },
              { k: "GAMMA_CENTERED", v: "是否让网格包含 Γ 点；偶网格时默认不含", tag: "易错" },
              { k: "UNITS", v: "KPOINT 坐标的单位，默认 B_VECTOR（倒格矢分数坐标）", tag: "单位" },
              { k: "WAVEFUNCTIONS", v: "k 点计算默认 COMPLEX；REAL 只在 Γ 或实 Bloch 相位时成立", tag: "默认值" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "k 点 ≠ 能带",
            text: "&KPOINTS 是**为了算积分**而选的点，结果只给你一个总能量。要画能带图，得另外用 `&DFT %PRINT %BAND_STRUCTURE` 配 `&KPOINT_SET` 指定一条高对称路径——那是后处理，和 SCF 采样是两套东西，不要混在同一个块里。",
          },
        ],
      },
      {
        id: "10.2",
        title: "一个能跑的体相输入",
        blocks: [
          {
            type: "p",
            text: "下面用金刚石结构的硅做例子。用的是**原胞**：2 个原子、边长 $a/\\sqrt{2}$ 的菱形 cell（三个夹角 60°），比 8 原子的常规立方胞小四倍，扫 k 点网格时省得多。坐标用分数坐标写（`SCALED T`）。你的体系当然要换成自己的 cell——这一节只关心那四行 `&KPOINTS`。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "si_kpoints.inp",
            text: `&GLOBAL
  PROJECT si
  RUN_TYPE ENERGY
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SCF
      EPS_SCF 1.0E-7
      &OT
        MINIMIZER DIIS
      &END OT
    &END SCF
    &KPOINTS
      SCHEME MONKHORST-PACK 4 4 4
      GAMMA_CENTERED T
    &END KPOINTS
    &XC
      &XC_FUNCTIONAL PBE
    &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 3.8396 3.8396 3.8396
      ALPHA_BETA_GAMMA 60 60 60
    &END CELL
    &COORD
      SCALED T
      Si 0.00 0.00 0.00
      Si 0.25 0.25 0.25
    &END COORD
    &KIND Si
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q4
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`EPS_SCF 1.0E-7` 比单点默认更严一档：k 点网格加密时能量变化本来就在 10⁻³–10⁻⁴ Hartree 量级，SCF 噪声要是同量级，收敛曲线就是假的。算力和精度在这里必须同时加。为了让输入短到能一眼看完，这里省掉了 `&MGRID`——CUTOFF 用默认值；正式计算按第 6 章讲的方法把它收敛一遍再加回来。",
          },
          {
            type: "table",
            head: ["块", "管什么", "本例的取值"],
            rows: [
              ["`&CELL`", "晶胞矢量与周期性方向", "菱形原胞，边长 3.8396 Å、夹角 60°"],
              ["`&COORD` + `SCALED T`", "原子位置，分数坐标", "2 个 Si，金刚石结构"],
              ["`&KPOINTS`", "SCF 采样的 k 点集", "MONKHORST-PACK 4×4×4，含 Γ"],
              ["`&SCF`", "电子结构求解", "OT + EPS_SCF 1E-7"],
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "先跑 2×2×2 再加密",
            text: "第一次跑新体系，把 `SCHEME` 降到 `2 2 2`，确认几何、赝势、基组都没问题、SCF 能收敛，再按 10.4 节的方法往上加。直接上 8×8×8 只会让你在报错时不知道是网格还是别的地方出问题。",
          },
        ],
      },
      {
        id: "10.3",
        title: "三种 SCHEME 与它们的单位",
        blocks: [
          {
            type: "p",
            text: "`SCHEME` 决定网格怎么生成。**MONKHORST-PACK** 只给三个数，均匀铺开，最常用；**MACDONALD** 在同一套网格上再加三个 shift 参数（0 到 1 之间），用来把网格从 Γ 中心挪到别处；**GENERAL** 让你一行一个 `KPOINT` 手写坐标和权重，适合做特殊点检查或复现文献里的点集。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "三种写法",
            text: `&KPOINTS
  SCHEME MONKHORST-PACK 6 6 6
  GAMMA_CENTERED T
&END KPOINTS

&KPOINTS
  SCHEME MACDONALD 4 4 4 0.25 0.25 0.25
&END KPOINTS

&KPOINTS
  SCHEME GENERAL
  UNITS B_VECTOR
  KPOINT 0.0 0.0 0.0 1.0
  KPOINT 0.5 0.5 0.5 1.0
&END KPOINTS`,
          },
          {
            type: "p",
            text: "`MACDONALD` 的前三个数是网格，后三个是 shift；shift 取 0.5 就是常见的「偏移网格」。`GENERAL` 的 `KPOINT` 是**三个坐标加一个权重**，坐标单位由 `UNITS` 决定：默认 `B_VECTOR`（倒格矢分数坐标），也可以写 `CART_BOHR` 或 `CART_ANGSTROM`（此时数值是按 2π/Bohr、2π/Å 计的笛卡尔分量）。权重 CP2K 会内部归一化，所以填 1.0 还是 0.5 不影响结果的比例。",
          },
          {
            type: "table",
            head: ["SCHEME", "你要给什么", "什么时候用"],
            rows: [
              ["`MONKHORST-PACK`", "三个整数网格数", "默认选择，收敛测试就扫它"],
              ["`MACDONALD`", "三个网格数 + 三个 shift", "需要偏移网格、避开高对称点"],
              ["`GENERAL`", "逐条 `KPOINT x y z w`", "复现文献点集、只算个别特殊点"],
              ["`GAMMA`", "什么都不用给", "显式声明 Γ-only（等同于省略该块）"],
            ],
          },
          {
            type: "p",
            text: "一个小陷阱：**偶数的 MONKHORST-PACK 网格默认不包含 Γ 点**。这本身没错（偏移网格往往收敛更快），但如果你要对比「含 Γ」和「不含 Γ」，必须显式写 `GAMMA_CENTERED T`，否则你以为在改网格密度，其实同时在改网格偏移。",
          },
          {
            type: "demo",
            id: "units",
            title: "动手：k 点坐标的单位换算",
            desc: "在 B_VECTOR、2π/Å、2π/Bohr 之间换一换，体会为什么 KPOINT 的数值不能随便抄别人的输入。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "抄来的 KPOINT 坐标先看 UNITS",
            text: "文献里写 `KPOINT 0.5 0.5 0.5`，八成是分数坐标（B_VECTOR）；但同一行数字在 `CART_ANGSTROM` 下是完全不同的点。`&DFT %PRINT %KPOINTS` 加上 `VERBOSE T` 会把 CP2K 实际生成的 k 点列出来——抄参数之后的第一件事就是打出来核对。",
          },
        ],
      },
      {
        id: "10.4",
        title: "收敛测试：扫网格，看曲线拐平",
        blocks: [
          {
            type: "p",
            text: "k 点不像 CUTOFF 那样有唯一「够用」的值，只能对你的体系、你关心的量做收敛测试。做法是固定其他一切，只改网格数，看目标量随网格的变化什么时候平掉。用 shell 循环最省事：",
          },
          {
            type: "code",
            lang: "bash",
            title: "扫 2→8 的网格",
            text: `for n in 2 4 6 8; do
  sed "s/SCHEME MONKHORST-PACK .*/SCHEME MONKHORST-PACK $n $n $n/" si.inp > si_$n.inp
  cp2k.psmp -i si_$n.inp -o si_$n.out
  printf "%s  " "$n"
  grep "Total energy" si_$n.out | tail -1
done`,
          },
          {
            type: "p",
            text: "把四次的总能量抄进一张表，再算相邻两档的差。判断标准是：**差值小于你后续要用的精度**就停。做能量对比（比如反应能）通常要几 meV/atom 的稳定性；只做定性趋势可以松一些。注意别拿 Hartree 和 meV 混着比——一个 Hartree 约 27.2 eV，差 10⁻⁴ Hartree 就是 2.7 meV。",
          },
          {
            type: "table",
            head: ["你要的量", "收敛快慢", "说明"],
            rows: [
              ["总能量", "较快", "平滑体系的积分误差，往往是最先收敛的量"],
              ["力 / 应力", "较慢", "对占据和带边敏感，几何优化前要单独测"],
              ["金属占据数 / 费米能", "很慢", "费米面处的跳变让积分收敛变差，必须配 smearing"],
              ["DOS / 带边位置", "很慢", "本质上是 k 分辨的量，密集网格或特殊方法才靠谱"],
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "smearing 不能代替 k 点收敛",
            text: "给金属加电子温度（smearing）只是把占据数的跳变抹平，让 SCF 能收敛；它**不会**替你补上布里渊区积分的采样误差。两者要分开测：先固定 smearing，扫 k 点；再固定 k 点，扫展宽。加宽 smearing 让能量「看起来稳了」，往往只是把误差藏进了自由能里。",
          },
          {
            type: "p",
            text: "还有一个方向性技巧：**真空方向不需要 k 点**。slab 的法向、nanowire 的两个横向，这些方向的能带几乎不色散，网格数给 1 就够。`SCHEME MONKHORST-PACK 6 6 1` 对 (001) 表面是标准写法，白算的那些点纯属浪费。",
          },
        ],
      },
      {
        id: "10.5",
        title: "对称性约化：省一半算力，也带来两个坑",
        blocks: [
          {
            type: "p",
            text: "布里渊区有对称性，很多 k 点算出来的本征值其实是同一套。规则网格下 CP2K **默认**做 $\\mathbf{k} \\leftrightarrow -\\mathbf{k}$ 的时间反演约化，这不需要你设置。再往前一步是用**原子结构的空间群**约化，这由 `&KPOINTS` 里的 `SYMMETRY` 控制，默认关闭。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "打开原子对称约化并核对点集",
            text: `&DFT
  &KPOINTS
    SCHEME MONKHORST-PACK 4 4 4
    SYMMETRY T
    WAVEFUNCTIONS COMPLEX
    EPS_SYMMETRY 1.0E-6
  &END KPOINTS
  &PRINT
    &KPOINTS
      VERBOSE T
    &END KPOINTS
  &END PRINT
&END DFT`,
          },
          {
            type: "p",
            text: "手册对这件事的措辞很谨慎：原子对称约化是 **experimental** 功能，必须拿 `FULL_GRID T` 的全网格结果做参考验证，确认能量和力一致才能用。`SYMMETRY T` 还要求 `WAVEFUNCTIONS COMPLEX`（k 点计算本来就是默认值，只有你手动改成 REAL 之后才需要加回来）。",
          },
          {
            type: "p",
            text: "第二个坑是 cell 的表示。完整原子约化要求 cell 满足标准下三角约定（A 沿 x 轴，B 在 xy 平面内）。如果你的 cell 是从实验文件里原样读进来的、没有转成这个约定，CP2K 会打警告并**退回只做时间反演**（`INVERSION_SYMMETRY_ONLY`）——计算结果没错，但你期待的加速没发生，而很多人不会去看那条警告。",
          },
          {
            type: "compare",
            left: {
              title: "想省时间，用约化",
              items: [
                "`SYMMETRY T`：空间群 + 时间反演一起约化",
                "`INVERSION_SYMMETRY_ONLY T`：只做时间反演，最保守",
                "默认（不写）：时间反演自动生效",
                "先跑 `FULL_GRID T` 存档，再对比能量与力",
              ],
            },
            right: {
              title: "想要可复现的严格结果",
              items: [
                "`SYMMETRY F` + `FULL_GRID T`：一点不省，全算",
                "适合发表级数字、也适合当参考基准",
                "GEO_OPT / CELL_OPT 中约化集每步会变",
                "要保持空间群另开 `KEEP_SPACE_GROUP`",
              ],
            },
          },
          {
            type: "callout",
            kind: "danger",
            title: "优化过程中 k 点集不再是常数",
            text: "GEO_OPT、CELL_OPT、MD 每一步都会按当前几何重新做对称性分析，约化后的 k 点集可能在某一步突然变化。表现出来就是能量或力出现一个没有任何物理原因的小跳变，优化器随即震荡。要做严格的对称性保持优化，用 `&GEO_OPT KEEP_SPACE_GROUP T`（CELL_OPT 用 `KEEP_SYMMETRY`），或者干脆 `SYMMETRY F` 全程用同一套全网格。",
          },
        ],
      },
      {
        id: "10.6",
        title: "自旋：UKS、多重度与初猜磁矩",
        blocks: [
          {
            type: "p",
            text: "默认的 Kohn–Sham 求解让每对电子共用一个轨道（闭壳层）。有未成对电子时，alpha 和 beta 要分开算，这就是 **UKS**（unrestricted Kohn–Sham，CP2K 里也写作 LSD）。打开方式只有一行 `UKS T`，代价是自由度翻倍、SCF 更难收敛。",
          },
          {
            type: "p",
            text: "`MULTIPLICITY` 是 $2S+1$：单重态 1、双重态 2、三重态 3。**不写它时** CP2K 按电子数奇偶给默认值——偶数电子当单重态、奇数电子当双重态，也就是默认闭壳层。所以「我打开了 UKS，为什么还是得到零磁矩」的答案通常是：多重度还停在默认值上。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "bcc Fe：自旋 + 展宽的完整输入",
            text: `&GLOBAL
  PROJECT fe
  RUN_TYPE ENERGY
&END GLOBAL
&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    UKS T
    &SCF
      EPS_SCF 1.0E-7
      MAX_SCF 100
      ADDED_MOS 20
      &MIXING
        METHOD BROYDEN_MIXING
        ALPHA 0.3
        ALPHA_MAG 0.8
        NBUFFER 8
      &END MIXING
      &SMEAR ON
        METHOD FERMI_DIRAC
        ELECTRONIC_TEMPERATURE 500
      &END SMEAR
    &END SCF
    &KPOINTS
      SCHEME MONKHORST-PACK 8 8 8
    &END KPOINTS
    &XC
      &XC_FUNCTIONAL PBE
    &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 2.87 2.87 2.87
    &END CELL
    &COORD
      SCALED T
      Fe 0.00 0.00 0.00
      Fe 0.50 0.50 0.50
    &END COORD
    &KIND Fe
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q16
      MAGNETIZATION 2.0
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`MAGNETIZATION` 在 `&KIND` 里，含义是**原子初猜**：给这个原子加 $m/2$ 个 alpha 电子、减掉同样多的 beta 电子。它不改变最终的物理，只决定 SCF 往哪个自旋解走——铁磁、反铁磁、非磁解常常是同一套输入的不同自洽解，落点由初猜决定。做反铁磁就把相邻两个 Fe 的初猜设成一正一负。",
          },
          {
            type: "p",
            text: "`ALPHA_MAG` 是磁化密度的混合系数，默认跟随 `ALPHA`。手册建议磁性过渡金属常用 0.8–1.6 这一档；太小收敛慢，太大则在两个解之间来回跳。看到磁矩在 0 和某个大数之间反复摆动，先把 `ALPHA_MAG` 降到 0.5 以下，而不是加步数。",
          },
          {
            type: "table",
            head: ["关键字", "位置", "作用"],
            rows: [
              ["`UKS T`", "`&DFT`", "打开自旋极化，alpha/beta 分开求解"],
              ["`MULTIPLICITY`", "`&DFT`", "$2S+1$；默认按电子数奇偶给 1 或 2"],
              ["`CHARGE`", "`&DFT`", "体系总电荷；改它会同时改电子数与默认多重度"],
              ["`MAGNETIZATION`", "`&KIND`", "单原子初猜磁矩，只影响收敛到哪个解"],
              ["`ALPHA_MAG`", "`&SCF %MIXING`", "磁化密度的混合比例，磁性体系要单独调"],
              ["`ROKS`", "`&DFT`", "限制性开壳层，省算力但只能描述一种固定形式"],
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "先验证自旋态是你要的那个",
            text: "算完别只看能量。在输出里找每个原子的 Mulliken 自旋布居（population analysis），确认磁矩确实落在你预期的原子上、符号也对。一个「收敛了」的反铁磁输入，很可能实际收敛到了非磁解，而能量差别足以改变你的结论。",
          },
        ],
      },
      {
        id: "10.7",
        title: "金属：smearing 与占据数",
        blocks: [
          {
            type: "p",
            text: "绝缘体里每个能带要么全满要么全空，占据数是整数；金属里费米面穿过某些能带，占据数在 0 和 1 之间连续变化。如果还按整数占据去迭代，SCF 会在两个几乎简并的占据方案之间反复横跳，永远收敛不了。解法是把占据数按费米分布展宽，让它们变成光滑函数。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Fermi–Dirac 展宽 + 空带",
            text: `&SCF
  ADDED_MOS 20
  EPS_SCF 1.0E-6
  MAX_SCF 100
  &SMEAR ON
    METHOD FERMI_DIRAC
    ELECTRONIC_TEMPERATURE 300
    EPS_FERMI_DIRAC 1.0E-10
  &END SMEAR
  &MIXING
    METHOD BROYDEN_MIXING
    ALPHA 0.3
    NBUFFER 8
  &END MIXING
&END SCF`,
          },
          {
            type: "p",
            text: "两个配套项不能忘：`&SMEAR ON` 打开展宽（这个节默认是关的，`SECTION_PARAMETERS` 是它真正的开关），`ADDED_MOS` 给出额外的空带——占据数要能在费米能级以上流动，就必须有地方可去。k 点计算里写成 `ADDED_MOS AUTO` 让 CP2K 自己决定。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "开了 smearing 就不能再用 OT",
            text: "OT 求的是**固定整数占据**下的极小值，而展宽改的正是占据数，两者放在一起是矛盾的。手册在 SCF 收敛那一页写得很含蓄：「有些算法只兼容均匀占据」——说的就是 OT。金属体系请走对角化路线：**把 `&OT` 整段删掉**，SCF 就默认走标准对角化（需要时可显式写一个空的 `&DIAGONALIZATION` 节），再配 `&SMEAR` 与 `&MIXING`。",
          },
          {
            type: "table",
            head: ["METHOD", "展宽形式", "用在哪"],
            rows: [
              ["`FERMI_DIRAC`", "物理的费米分布，宽度由温度定", "金属首选；温度越低越接近真实占据"],
              ["`GAUSSIAN`", "高斯展宽，宽度 `SIGMA`", "平滑但需向 SIGMA→0 外推才能拿到 0 K 能量"],
              ["`METHFESSEL_PAXTON`", "冷 smearing", "手册明确说不要用于半导体和绝缘体"],
              ["`MARZARI_VANDERBILT`", "冷 smearing 变体", "同上，适合金属"],
              ["`ENERGY_WINDOW` / `LIST`", "按能量窗或给定列表", "特殊用途，需要你对占据有明确控制"],
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "力和应力对应的是自由能",
            text: "手册特别提醒：开启 smearing 后，输出的**力与应力对应的是自由能**，不是向零展宽外推后的能量。所以做金属的 GEO_OPT 时，几何是在有限温度的自由能面上优化的；如果你报的是「0 K 能量」，两者之间还差一个熵项，别把不同展宽下的数字混在一张表里比较。",
          },
          {
            type: "p",
            text: "展宽大小的经验做法：先取一个能让 SCF 稳定收敛的温度（金属常见 300–1000 K 这个量级），收敛后再降到更低的值复算。如果能量随展宽单调漂移、降不下去，说明 k 点还不够密——回到 10.4 节。展宽是收敛的**润滑剂**，不是精度的替代品。",
          },
        ],
      },
      {
        id: "10.8",
        title: "Γ 点什么时候真的够用",
        blocks: [
          {
            type: "p",
            text: "这是最常被问、也最容易答错的问题。判据不在体系「大小」，而在**你的盒子在三个方向上是否已经大到让能带不色散**。下面这张对照表可以直接当决策清单用。",
          },
          {
            type: "compare",
            left: {
              title: "Γ 点通常够用",
              items: [
                "孤立分子放在足够大的盒子里（真空 ≥ 10 Å）",
                "大超胞（几十到几百原子），能带已接近平带",
                "绝缘体 / 宽带隙半导体，且你只要定性趋势",
                "slab 的真空方向，nanowire 的两个横向",
              ],
            },
            right: {
              title: "Γ 点一定不够",
              items: [
                "金属、半金属：费米面处的占据必须采样",
                "原胞级的小晶胞半导体：带边对 k 很敏感",
                "要算带隙、有效质量、态密度",
                "几何/晶胞优化：力对 k 点比能量更敏感",
                "任何要发表的绝对能量与晶格常数",
              ],
            },
          },
          {
            type: "steps",
            items: [
              { t: "先只想清楚一件事", d: "你要报的是能量差、结构、还是电子结构量？能量差和结构对 k 点要求不同，别用错判据。" },
              { t: "从 2×2×2 起扫", d: "固定 CUTOFF、基组、SCF 阈值，只改网格数，记录目标量。" },
              { t: "看相邻档的差", d: "差值稳定小于你的目标精度就停；不够就继续加密，别跳档。" },
              { t: "换性质再测一遍", d: "能量收敛了不代表力收敛。做优化的话，用力的差来定网格。" },
              { t: "写进方法段", d: "把最终网格数、是否 GAMMA_CENTERED、是否开对称约化记下来，别人才能复现。" },
            ],
          },
          {
            type: "keypoints",
            items: [
              "省略 `&KPOINTS` 就是 Γ-only；它是对布里渊区积分的一种近似，不是「关掉周期性」",
              "`MONKHORST-PACK` 给网格数、`MACDONALD` 加 shift、`GENERAL` 逐点写；`KPOINT` 的坐标单位由 `UNITS` 决定",
              "k 点收敛要逐量测：能量快、力慢、金属占据最慢；smearing 不能代替采样",
              "原子对称约化是 experimental，必须用 `FULL_GRID T` 全网格验证；优化中约化集每步会变",
              "自旋要同时设 `UKS T`、`MULTIPLICITY`，必要时用 `&KIND MAGNETIZATION` 给初猜",
              "金属必须 `&SMEAR ON` + `ADDED_MOS`，并且记住力与应力对应的是自由能",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一步",
            text: "网格定下来之后，就可以把它带进几何优化了。下一章讲 GEO_OPT 与 CELL_OPT：优化器怎么选、四个收敛判据各自在管什么、以及为什么「收敛了」不等于「找到了极小点」。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "一个周期性输入里完全没写 `&KPOINTS`，CP2K 实际在做的是？",
        options: [
          "报错，周期性计算必须给 k 点",
          "只算 Γ 点，即 k = 0 一个采样点",
          "自动按晶胞长度生成 Monkhorst-Pack 网格",
          "关掉周期性，退化成孤立分子计算",
        ],
        answer: 1,
        explain: "省略 &KPOINTS 等价于 SCHEME GAMMA，只采 Γ 点。周期性（&CELL 的 PERIODIC）依然生效，只是布里渊区积分被一个点近似。",
      },
      {
        q: "`SCHEME MONKHORST-PACK 4 4 4` 默认会包含 Γ 点吗？",
        options: [
          "会，Monkhorst-Pack 定义上总是含 Γ",
          "不会，偶网格默认不含，需要 `GAMMA_CENTERED T`",
          "取决于 `UNITS` 的设置",
          "取决于是否打开 `SYMMETRY`",
        ],
        answer: 1,
        explain: "偶数网格默认是偏移的、不含 Γ 点。想包含就显式写 GAMMA_CENTERED T。这也是对比收敛时最容易无意中改变的一个变量。",
      },
      {
        q: "金属体系加了 `&SMEAR` 之后 SCF 收敛了，关于 k 点你可以得出什么结论？",
        options: [
          "smearing 已经补上了布里渊区积分误差，2×2×2 就够",
          "仍需单独做 k 点收敛测试；smearing 只解决占据数跳变",
          "smearing 会强制使用 Γ 点，所以不需要 k 点",
          "只要 ELECTRONIC_TEMPERATURE 足够高，k 点可以取 1",
        ],
        answer: 1,
        explain: "展宽让占据数变成光滑函数、帮助 SCF 收敛，但它不改变采样密度不足带来的积分误差。两者必须分开测，而且加大展宽只是把误差藏进自由能。",
      },
      {
        q: "打开 `UKS T` 但没设 `MULTIPLICITY`，一个偶数电子的体系会怎样？",
        options: [
          "默认取三重态，因为 UKS 意味着有未成对电子",
          "默认按电子数奇偶给值，偶数电子即单重态，结果可能仍是零磁矩",
          "报错，UKS 必须显式给多重度",
          "自动搜索所有自旋态并取能量最低者",
        ],
        answer: 1,
        explain: "MULTIPLICITY 默认 0，CP2K 据此按电子数奇偶给 1 或 2。打开 UKS 不会自动改变多重度，所以常见现象是「开了自旋极化却没有磁矩」。",
      },
      {
        q: "在 GEO_OPT 中打开 `SYMMETRY T` 做 k 点约化，最需要注意什么？",
        options: [
          "优化过程中约化后的 k 点集会随几何每步变化，可能引起能量/力的小跳变",
          "打开后必须同时关闭 `&SMEAR`，否则报错",
          "只能在 Γ 点计算里使用",
          "它会把晶胞也一起优化",
        ],
        answer: 0,
        explain: "对称性每步按当前几何重算，约化集可能改变，导致不连续的跳变。要保持空间群用 KEEP_SPACE_GROUP，或干脆 SYMMETRY F 全程用同一套全网格；而且原子约化本身是 experimental，需用 FULL_GRID 参考验证。",
      },
    ],
    terms: [
      {
        t: "布里渊区",
        en: "Brillouin zone",
        d: "倒空间里的原胞。所有 k 点相关的积分都在这个区域内做，CP2K 用有限加权网格近似它。",
      },
      {
        t: "k 点",
        en: "k-point",
        d: "Bloch 波的倒空间标签。SCF 里每个 k 点是一套独立的电子本征问题，计算量随点数线性增长。",
      },
      {
        t: "Monkhorst-Pack 网格",
        en: "Monkhorst-Pack mesh",
        d: "在三个倒格矢方向上均匀铺 n₁×n₂×n₃ 个采样点的方案，是 CP2K 里最常用的 &KPOINTS SCHEME。",
      },
      {
        t: "时间反演对称",
        en: "time-reversal symmetry",
        d: "k 与 −k 的本征值相同，因此规则网格默认只算一半。它独立于原子结构的空间群约化。",
      },
      {
        t: "自旋极化 / UKS",
        en: "unrestricted Kohn-Sham (UKS/LSD)",
        d: "alpha 与 beta 电子用不同轨道求解，能描述磁矩。代价是自由度翻倍、SCF 更难收敛。",
      },
      {
        t: "多重度",
        en: "multiplicity",
        d: "2S+1，标明体系的总自旋。默认按电子数奇偶取 1 或 2，改自旋态必须显式设置。",
      },
      {
        t: "smearing / 电子温度",
        en: "smearing / electronic temperature",
        d: "按费米分布把占据数展宽成光滑函数，让金属的 SCF 能收敛。它不替代 k 点收敛测试。",
      },
      {
        t: "费米面",
        en: "Fermi surface",
        d: "占据与空态的分界。金属的占据数在这里跳变，是 k 点积分收敛慢的根源。",
      },
    ],
    sources: [
      {
        t: "k-Points",
        url: "https://manual.cp2k.org/trunk/methods/dft/k-points.html",
      },
      {
        t: "Band structure and GW",
        url: "https://manual.cp2k.org/trunk/methods/electronic_structure/band/index.html",
      },
      {
        t: "CP2K_INPUT / FORCE_EVAL / DFT / KPOINTS",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/KPOINTS.html",
      },
      {
        t: "CP2K_INPUT / FORCE_EVAL / DFT / SCF / SMEAR",
        url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/SCF/SMEAR.html",
      },
    ],
  };
})();