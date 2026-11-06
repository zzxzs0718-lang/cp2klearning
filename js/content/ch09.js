(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch09"] = {
    id: "ch09",
    num: 9,
    part: "DFT 核心",
    title: "SCF 收敛与 OT：让电子密度定下来",
    subtitle: "混合、smearing、OT 与那套「不收敛就先看结构」的排查顺序",
    hours: 2.5,
    level: "进阶",
    intro:
      "前面几章把能量表达式搭好了，剩下的问题是把它解出来。Kohn–Sham 方程是自洽的：密度决定势，势决定轨道，轨道又决定密度。这一章讲 CP2K 怎么把这条循环推到不动点：mixing 与 DIIS 怎么调、金属为什么要 smearing、OT 与对角化到底差在哪，以及卡住时按什么顺序排查。",
    goals: [
      "说清 SCF 迭代在做什么，以及 EPS_SCF 与 MAX_SCF 分别控制什么",
      "根据体系类型选择 &MIXING 方案并调整 ALPHA、BETA 等参数",
      "判断什么时候需要 smearing 与 ADDED_MOS，并写出金属体系的 SCF 设置",
      "区分 &SCF%OT 与 &SCF%DIAGONALIZATION%OT，按失败症状给出排查顺序",
    ],
    sections: [
      {
        id: "9.1",
        title: "SCF 在迭代什么",
        blocks: [
          {
            type: "p",
            text: "给定一组轨道，可以算出密度；密度决定 Hartree 势与交换关联势；势进入哈密顿量，解出新的轨道；新轨道又给出新密度。如果新密度和旧密度一样，就自洽了。SCF 做的就是把这条循环推到不动点。",
          },
          {
            type: "p",
            text: "问题在于，直接把「输出密度」当作下一次的输入，几乎总是不收敛：误差会在迭代间放大、振荡，甚至发散。所以实际用的是**混合**（mixing）：新输入取旧输入与输出密度的加权组合，权重 α 通常小于 1。",
          },
          {
            type: "formula",
            tex: "\\rho_{\\mathrm{in}}^{n+1} = \\rho_{\\mathrm{in}}^{n} + \\alpha\\,(\\rho_{\\mathrm{out}}^{n} - \\rho_{\\mathrm{in}}^{n})",
            caption: "最简单的线性混合；α 就是 &MIXING 的 ALPHA，默认 0.4",
          },
          {
            type: "p",
            text: "更聪明的做法是用历史信息外推：Pulay、Broyden 这类方法记住前几步的残差，构造一个近似 Jacobian 的逆，把残差直接压掉。这就是通常说的 **DIIS** 类加速。CP2K 把这些方案都放在 `&SCF/&MIXING` 下，用 METHOD 选。",
          },
          {
            type: "callout",
            kind: "info",
            title: "两条完全不同的求解路线",
            text: "对角化路线每步要解一次本征值问题，再做密度混合；OT 路线干脆不做对角化，直接把电子能量对轨道做变分最小化。两条路线共享 EPS_SCF 与 MAX_SCF 这两个旋钮，但内部参数完全不同，第 9.5 节专门区分。",
          },
        ],
      },
      {
        id: "9.2",
        title: "收敛判据：EPS_SCF 与 MAX_SCF",
        blocks: [
          {
            type: "p",
            text: "EPS_SCF 是收敛阈值，默认 `1.0E-5`；MAX_SCF 是允许的最大迭代步数，默认 50。每一次迭代，程序计算一个误差量（与密度矩阵的变化相关），小于 EPS_SCF 就判定收敛。两个参数一个管「多准」，一个管「最多试多久」。",
          },
          {
            type: "table",
            head: ["关键词", "默认值", "含义"],
            rows: [
              ["EPS_SCF", "1.0E-5", "SCF 收敛阈值，越小越准也越贵"],
              ["MAX_SCF", "50", "单次 SCF 的最大迭代步数"],
              ["SCF_GUESS", "ATOMIC", "初始猜测：用各元素的原子密度拼起来"],
              ["IGNORE_CONVERGENCE_FAILURE", "F", "未收敛时是否继续，默认不允许"],
              ["LEVEL_SHIFT", "0", "给虚轨道加一个平移，帮助难收敛体系"],
            ],
            caption: "&SCF 里最常动的几个参数",
          },
          {
            type: "p",
            text: "从 CP2K 2024.1 起，**SCF 不收敛默认直接中止**。达到 MAX_SCF 时 Convergence 列仍未满足 EPS_SCF，程序就 ABORT，并在提示里建议你设置 IGNORE_CONVERGENCE_FAILURE。别把它当成默认选项。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "打开忽略开关的代价",
            text: "手册用 Danger 框写这件事：强行忽略会让后续性质失去意义——占据数可能错、能带可能错、响应性质可能非物理，动力学里原子还可能飞掉。它只能作为「先跑完看看」的最后手段，绝不能进生产流程。",
          },
          {
            type: "p",
            text: "反过来，EPS_SCF 也不是越小越好。你要分辨 1e-6 Ry 的能量差，SCF 至少要比它紧一到两个量级；但如果目标只是看结构，`1.0E-6` 已经足够。把判据写成数字，和你要报告的量对齐。",
          },
        ],
      },
      {
        id: "9.3",
        title: "混合：&MIXING 与 DIIS",
        blocks: [
          {
            type: "p",
            text: "CP2K 的默认方案是 **DIRECT_P_MIXING**：直接把新密度按 ALPHA 混进去。它保守、稳，但对金属、大体系、带真空层的 slab 往往太慢。此时换 Broyden 或 Pulay，用历史步数加速。",
          },
          {
            type: "p",
            text: "**ALPHA** 是新密度所占比例，默认 0.4；调小更稳但更慢。**BETA** 是 Kerker 阻尼参数，默认 0.5（单位 bohr 的倒数），作用是压制长波段的电荷振荡（charge sloshing）——金属与导体表面最容易出这个问题。",
          },
          {
            type: "formula",
            tex: "\\rho_{\\mathrm{mix}}(G) = \\rho_{\\mathrm{in}} + \\alpha\\,\\frac{G^2}{G^2+\\beta^2}\\,(\\rho_{\\mathrm{out}}-\\rho_{\\mathrm{in}})",
            caption: "Kerker 阻尼：长波（G 小）的修正被压掉，短波照常混合",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "Broyden 混合（片段）",
            text: `&SCF
  EPS_SCF 1.0E-6
  MAX_SCF 100
  &MIXING
    METHOD BROYDEN_MIXING
    ALPHA 0.3
    BETA 0.5
    NBUFFER 8
  &END MIXING
&END SCF`,
          },
          {
            type: "table",
            head: ["METHOD", "特点", "适用"],
            rows: [
              ["DIRECT_P_MIXING", "只用当前步，最简单最稳", "默认；绝缘体、小体系"],
              ["KERKER_MIXING", "带 Kerker 阻尼的线性混合", "简单金属、slab"],
              ["BROYDEN_MIXING", "用历史残差近似 Jacobian", "难收敛体系的主力"],
              ["PULAY_MIXING", "另一种 DIIS 实现", "与 Broyden 互为备选"],
              ["MULTISECANT_MIXING", "多割线加速", "特殊难例"],
            ],
            caption: "&MIXING/METHOD 的常用取值",
          },
          {
            type: "callout",
            kind: "tip",
            title: "调参顺序",
            text: "先降 ALPHA（0.4 → 0.2 → 0.1），再换 Broyden，再加 NBUFFER。不要一上来就把 ALPHA 压到 0.01：那会让 SCF 慢到你以为它卡死了。",
          },
        ],
      },
      {
        id: "9.4",
        title: "金属与 smearing",
        blocks: [
          {
            type: "p",
            text: "金属的费米面会切过能带，占据数在 0 与 1 之间跳变。固定整数占据会让 SCF 在两个几乎简并的解之间来回振荡，永不收敛。**smearing** 的做法是允许分数占据，用费米–狄拉克分布把占据在费米能附近抹开，相当于给电子一个有限温度。",
          },
          {
            type: "p",
            text: "&SMEAR 打开后，METHOD 选展宽函数（FERMI_DIRAC 或 GAUSSIAN 等），温度或宽度由 ELECTRONIC_TEMPERATURE 与 SIGMA 控制。默认 ELECTRONIC_TEMPERATURE 是 300 K，SIGMA 是 $2\\times10^{-3}$ Ha。对金属，常用几百到几千 K 的温度先把 SCF 稳住。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "金属体系：smearing + 额外空带（片段）",
            text: `&SCF
  ADDED_MOS 20
  EPS_SCF 1.0E-6
  MAX_SCF 100
  &SMEAR ON
    METHOD FERMI_DIRAC
    ELECTRONIC_TEMPERATURE 500
  &END SMEAR
  &MIXING
    METHOD BROYDEN_MIXING
    ALPHA 0.3
  &END MIXING
&END SCF`,
          },
          {
            type: "p",
            text: "**ADDED_MOS** 是给每个自旋通道额外加的空带数，默认 0。展宽之后，费米能附近的空带也有可观占据，不加空带就等于把电子硬塞进被截断的能带里，输出会警告最高带仍有占据。设成正数表示加几条，设成 -1 表示原子基组里所有可用态，设成 AUTO 则让程序为有限温 k 点 OT 自动选择缓冲。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "温度不是物理结论",
            text: "Fermi–Dirac 展宽下的能量是有限温自由能。要和 0 K 的基态结果比较，必须把温度或 SIGMA 系统降到 0 并做外推。直接拿 1000 K 的能量和别人的 0 K 数据比，是没有意义的。",
          },
        ],
      },
      {
        id: "9.5",
        title: "两种 OT，别搞混",
        blocks: [
          {
            type: "p",
            text: "OT（orbital transformation）在保持轨道正交归一的子空间里直接最小化电子能量，绕开全对角化。对大绝缘体它比对角化快得多。CP2K 里有两个地方能写 OT，含义完全不同，这是本章最容易混的一点。",
          },
          {
            type: "compare",
            left: {
              title: "&SCF%OT（直接 OT）",
              items: [
                "整个 SCF 就是一次变分最小化",
                "轨道（及可选的旋转、辅助能量）都是优化变量",
                "不需要 &MIXING，也不需要对角化",
                "固定占据或分数占据都能做",
              ],
            },
            right: {
              title: "&SCF%DIAGONALIZATION%OT",
              items: [
                "只是把对角化那一步换成 OT 本征求解器",
                "KS 矩阵固定，外层仍由 SCF 负责占据与混合",
                "需要 &MIXING，与普通对角化流程并列",
                "数学上与直接 OT 不等价",
              ],
            },
          },
          {
            type: "code",
            lang: "cp2k",
            title: "直接 OT：固定占据的标准写法",
            text: `&SCF
  EPS_SCF 1.0E-7
  MAX_SCF 50
  &OT
    ALGORITHM STRICT
    MINIMIZER CG
    PRECONDITIONER FULL_SINGLE_INVERSE
  &END OT
&END SCF`,
          },
          {
            type: "p",
            text: "ALGORITHM 的 STRICT 与 MINIMIZER 的 CG 都是默认值，PRECONDITIONER 则强烈依赖体系与基组：FULL_SINGLE_INVERSE 对多数分子够用，FULL_ALL 更贵但更稳。手册的建议很实在——预条件的优劣要实测，不要按名字里的等级拍脑袋。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "直接 OT + 分数占据（金属）",
            text: `&SCF
  ADDED_MOS AUTO
  MAX_SCF 30
  &SMEAR ON
    METHOD FERMI_DIRAC
    ELECTRONIC_TEMPERATURE 500
  &END SMEAR
  &OT
    ALGORITHM STRICT
    MINIMIZER CG
    PRECONDITIONER FULL_ALL
    ROTATION
    ENERGIES
  &END OT
  &OUTER_SCF
    MAX_SCF 10
    EPS_SCF 1.0E-6
  &END OUTER_SCF
&END SCF`,
          },
          {
            type: "p",
            text: "做分数占据的直接 OT，必须同时打开 **ROTATION** 与 **ENERGIES**：前者让占据列参与旋转变分，后者加入辅助能量变量。两者要一起用，单开一个没有意义。OCCUPATION_PRECONDITIONER 是可选的附加项，不能替代 PRECONDITIONER。",
          },
          {
            type: "p",
            text: "`&OUTER_SCF` 是 OT 的外层循环，用来更新预条件。内层跑到 MAX_SCF 仍未满足 EPS_SCF 时，程序退出内层、做一次外层再进去。正因为有这层，OT 的内层 MAX_SCF 可以降到 16–32，外层 MAX_SCF 取 8–16 通常够用。",
          },
          {
            type: "callout",
            kind: "info",
            title: "OT 适合谁",
            text: "大绝缘体、分子、表面都适合。金属与窄带隙体系也能用，但要开展宽与旋转能量变量，参数更多。如果你的体系有大量近简并态，先老老实实用对角化加 smearing，再考虑 OT。",
          },
        ],
      },
      {
        id: "9.6",
        title: "收敛失败：按顺序排查",
        blocks: [
          {
            type: "p",
            text: "SCF 不收敛几乎总有原因，而且大多数原因不在 SCF 参数里。下面这个顺序是手册推荐的思路：从物理设置开始，逐步往数值参数走，每一步只改一件事。",
          },
          {
            type: "steps",
            items: [
              { t: "查结构与电荷", d: "键长是否离谱、有没有原子重叠；CHARGE 与 MULTIPLICITY 是否符合真实电子态，开壳层要加 UKS" },
              { t: "查基组与网格", d: "基组是否太小、赝势 q 值是否对；CUTOFF 与 REL_CUTOFF 是否够，EPS_DEFAULT 是否过松" },
              { t: "换初猜", d: "SCF_GUESS RESTART 从便宜计算的波函数重启；确认 gamma-only 用 -RESTART.wfn、k 点用 -RESTART.kp" },
              { t: "调混合", d: "先降 ALPHA，再换 BROYDEN_MIXING，加 NBUFFER；金属再加 BETA 压制 sloshing" },
              { t: "开 smearing", d: "金属与窄带隙体系用 FERMI_DIRAC 加有限温度，配合 ADDED_MOS 给空带" },
              { t: "换求解器", d: "大绝缘体改直接 OT；或先用对角化收敛，再拿波函数给 OT 当初猜" },
            ],
          },
          {
            type: "table",
            head: ["症状", "最可能的原因", "处理"],
            rows: [
              ["能量在两步之间大幅振荡", "混合太激进，或金属费米面跳变", "降 ALPHA；开 smearing"],
              ["Convergence 缓慢下降后卡住", "初猜太差，或基组/网格不足", "RESTART 初猜；回查第 6、7 章"],
              ["警告最高带仍有占据", "ADDED_MOS 不够，或温度/展宽不当", "加空带；检查电子数与温度"],
              ["第一步就发散", "结构有重叠原子，或电荷/多重度写错", "先修结构，再谈参数"],
              ["内存不足被杀", "杂化或大体系的内存需求", "调 &HF/&MEMORY，或换 ADMM"],
            ],
            caption: "常见失败与对应处理",
          },
          {
            type: "code",
            lang: "bash",
            title: "从输出里读收敛信息",
            text: `grep -n "SCF run converged" h2o.out
grep -n "SCF run NOT converged" h2o.out
grep -n "Total energy" h2o.out | tail -n 3
grep -n "highest band" h2o.out`,
          },
          {
            type: "p",
            text: "如果输出里既没有收敛也没有失败信息，多半是程序被外部杀掉了。先看日志末尾与作业系统的记录，再去怀疑 SCF 参数。",
          },
          {
            type: "demo",
            id: "scf",
            title: "SCF 收敛模拟器",
            desc: "调混合参数、切换求解器，看迭代曲线怎么变收敛、振荡或发散；把本章的排查顺序用一遍。",
          },
        ],
      },
      {
        id: "9.7",
        title: "检查清单",
        blocks: [
          {
            type: "p",
            text: "这一章可以压成一条检查顺序：先看体系（结构、电荷、多重度、基组），再看初猜与混合，然后才轮到展宽与求解器。下面这份清单按这个顺序排，出问题就从最上面一条开始排除。",
          },
          {
            type: "keypoints",
            items: [
              "EPS_SCF 默认 1e-5、MAX_SCF 默认 50；判据要和你要报告的能量差对齐",
              "2024.1 起不收敛默认中止，IGNORE_CONVERGENCE_FAILURE 只能当临时手段",
              "默认混合是 DIRECT_P_MIXING；难收敛先降 ALPHA，再换 Broyden",
              "金属靠 smearing 加空带解决，温度/展宽最终要外推到 0",
              "&SCF%OT 是直接变分求解，&SCF%DIAGONALIZATION%OT 只是换本征求解器",
              "分数占据的直接 OT 必须同时开 ROTATION 与 ENERGIES",
              "先修结构、电荷与基组，再调 SCF 参数",
            ],
          },
          {
            type: "callout",
            kind: "key",
            title: "一句话记住",
            text: "SCF 失败时，先怀疑物理设置，再怀疑数值参数；OT 是对角化的替代路线，不是它的加速开关。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "EPS_SCF 与 MAX_SCF 分别控制什么？",
        options: [
          "内存上限与迭代步数",
          "收敛阈值与最大迭代步数",
          "混合比例与历史步数",
          "初始猜测与最终精度",
        ],
        answer: 1,
        explain:
          "EPS_SCF 是判定收敛的阈值（默认 1e-5），MAX_SCF 是允许的最大迭代步数（默认 50）。一个管精度，一个管预算。",
      },
      {
        q: "从 CP2K 2024.1 起，SCF 达到 MAX_SCF 仍未收敛时默认会怎样？",
        options: [
          "静默继续，用最后一步的结果",
          "自动提高 MAX_SCF 重试",
          "直接中止计算，并在提示里建议设置 IGNORE_CONVERGENCE_FAILURE",
          "自动切换到 OT",
        ],
        answer: 2,
        explain:
          "新版本默认 ABORT，避免把未收敛的结果带进后续分析。IGNORE_CONVERGENCE_FAILURE 能强行继续，但手册明确警告其结果可能非物理。",
      },
      {
        q: "计算金属体系时，最应该先做的是？",
        options: [
          "把 ALPHA 调到 0.01",
          "打开 smearing 并给出足够的空带",
          "把 EPS_SCF 放宽到 1e-3",
          "改用 LDA 泛函",
        ],
        answer: 1,
        explain:
          "金属的费米面切过能带，固定整数占据会让迭代振荡。用 Fermi–Dirac 展宽允许分数占据，并用 ADDED_MOS 提供空带，才能稳定收敛。",
      },
      {
        q: "&SCF%OT 与 &SCF%DIAGONALIZATION%OT 的关键区别是？",
        options: [
          "前者更快，后者更准",
          "前者直接对电子能量做变分最小化，后者只是把本征求解器换成 OT，外层仍要混合",
          "前者只能算绝缘体，后者只能算金属",
          "两者完全等价，只是写法不同",
        ],
        answer: 1,
        explain:
          "直接 OT 把整个 SCF 变成一次最小化，不需要 &MIXING；DIAGONALIZATION%OT 只是在固定 KS 矩阵下迭代求本征值，外层仍由 SCF 负责占据与混合，两者数学上不等价。",
      },
      {
        q: "用直接 OT 做分数占据（金属）时，&OT 里必须同时打开什么？",
        options: [
          "ALGORITHM 与 MINIMIZER",
          "ROTATION 与 ENERGIES",
          "CHOLESKY 与 SAFE_DIIS",
          "STEPSIZE 与 ENERGY_GAP",
        ],
        answer: 1,
        explain:
          "ROTATION 让占据列参与旋转变分，ENERGIES 引入辅助能量变量，两者必须一起用；OCCUPATION_PRECONDITIONER 是可选附加项，不能替代 PRECONDITIONER。",
      },
    ],
    terms: [
      { t: "SCF", en: "self-consistent field", d: "反复求解「密度 → 势 → 轨道 → 新密度」直到不动点的迭代过程。" },
      { t: "mixing", en: "density mixing", d: "把输出密度与旧密度按比例组合成新输入，避免迭代振荡。" },
      { t: "DIIS", en: "direct inversion in the iterative subspace", d: "用历史残差构造近似逆 Jacobian 的加速收敛方法，Broyden 与 Pulay 都属于这一类。" },
      { t: "charge sloshing", en: "charge sloshing", d: "长波电荷在迭代间来回振荡的现象，金属与 slab 常见，用 Kerker 阻尼（BETA）压制。" },
      { t: "smearing", en: "level smearing", d: "允许分数占据、在费米能附近按分布函数抹开占据，用于金属与窄带隙体系。" },
      { t: "Fermi–Dirac", en: "Fermi–Dirac distribution", d: "由电子温度控制的占据分布，给出固定电子数下的有限温自由能。" },
      { t: "OT", en: "orbital transformation", d: "在正交归一约束下直接最小化电子能量的方法，避免全对角化，适合大绝缘体。" },
      { t: "ADDED_MOS", en: "added molecular orbitals", d: "在每个自旋通道额外加入的空带数，展宽后必须有足够空带承载分数占据。" },
    ],
    sources: [
      { t: "SCF 收敛（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/convergence.html" },
      { t: "Orbital Transformation（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/orbital_transformation.html" },
      { t: "&SCF 输入参考", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/SCF.html" },
      { t: "&MIXING 输入参考", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/SCF/MIXING.html" },
    ],
  };
})();