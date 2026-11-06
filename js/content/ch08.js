(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch08"] = {
    id: "ch08",
    num: 8,
    part: "DFT 核心",
    title: "泛函与色散：选对 XC，补上缺的那块吸引",
    subtitle: "从 LDA 到杂化泛函的阶梯，以及为什么 PBE 算不出分子晶体",
    hours: 2.5,
    level: "进阶",
    intro:
      "交换关联泛函决定了 DFT 能算多准。CP2K 的 &XC 段把泛函、Hartree–Fock 交换、色散修正分成三个独立的部分。这一章讲清它们各自出现在哪里、怎么写，以及最容易被忽略的一件事：半局域泛函天生缺长程关联，算弱相互作用时必须额外补上色散。",
    goals: [
      "按 Jacob 阶梯说清 LDA、GGA、meta-GGA、杂化泛函的差别与代价",
      "在 &XC 里写出 &XC_FUNCTIONAL、&HF、&VDW_POTENTIAL 三个子节并说明分工",
      "为给定泛函选择并正确配置 DFT-D3(BJ) 或 rVV10 色散修正",
      "判断哪些体系必须加色散，并说明它主要影响哪些可观测量",
    ],
    sections: [
      {
        id: "8.1",
        title: "泛函的阶梯：从 LDA 到杂化",
        blocks: [
          {
            type: "p",
            text: "交换关联泛函是 DFT 里唯一需要近似的部分。Perdew 把它比作一架梯子：每上一级，泛函用到的信息更多，精度通常更高，成本也更高。CP2K 里能直接用的泛函覆盖了整架梯子。",
          },
          {
            type: "table",
            head: ["阶梯", "用到的信息", "代表泛函", "&XC 写法"],
            rows: [
              ["LDA", "局域电子密度", "PADE、PZ81", "&XC_FUNCTIONAL LDA"],
              ["GGA", "密度与梯度", "PBE、BLYP、BP", "&XC_FUNCTIONAL PBE"],
              ["meta-GGA", "再加动能密度", "TPSS", "&XC_FUNCTIONAL TPSS"],
              ["杂化", "再加一部分精确交换", "PBE0、B3LYP", "&XC_FUNCTIONAL PBE0 + &HF"],
              ["双杂化", "再加未占据轨道", "—", "CP2K 主流程不支持"],
            ],
            caption: "常见的四级泛函；双杂化需要后 HF 方法，不在 Quickstep 的标准路径上",
          },
          {
            type: "p",
            text: "成本排序与精度排序大致同向，但**不是所有体系都吃这一套**。杂化泛函对分子体系的主旨能隙、反应势垒常有改善，对金属与强关联体系却未必；meta-GGA 便宜一些，宽带隙材料与分子晶体里表现不错。选择泛函要看你报告的量是什么，而不是「越贵越好」。",
          },
          {
            type: "callout",
            kind: "info",
            title: "基组与赝势要跟着泛函走",
            text: "`GTH-PBE-q6` 这套赝势是为 PBE 参数化的。你把泛函换成 B3LYP，赝势却还是 PBE 的，就出现了第 7 章说的族不一致。做方法对比时，要么整套替换，要么在文章里老老实实说明。",
          },
        ],
      },
      {
        id: "8.2",
        title: "&XC 的三块拼图",
        blocks: [
          {
            type: "p",
            text: "CP2K 把「交换关联」拆成三个可以独立配置的子节，这是它比很多代码灵活的地方：**&XC_FUNCTIONAL** 选半局域泛函，**&HF** 加精确交换并控制它的截断方式，**&VDW_POTENTIAL** 加色散或非局域关联。三者相加才是你真正在算的能量。",
          },
          {
            type: "p",
            text: "&XC_FUNCTIONAL 有一个便捷写法：直接把泛函名写在节参数上，例如 `&XC_FUNCTIONAL PBE`。手册列出的快捷值包括 BLYP、BP、PADE、LDA、PBE、TPSS、HCTH120、OLYP、BEEFVDW，以及 B3LYP、PBE0 这类杂化。默认值是 NO_SHORTCUT，意思是「我不预设任何组合，全部由下面的子节显式给出」。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "最简写法：一行选 PBE",
            text: `&XC
  &XC_FUNCTIONAL PBE
  &END XC_FUNCTIONAL
&END XC`,
          },
          {
            type: "p",
            text: "等价的显式写法是把泛函作为子节列出来：BLYP 就是 Becke88 交换加 LYP 关联。需要给某个成分单独调缩放因子（SCALE_X、SCALE_C）或参数化时，就得用这种形式。注意别把本身已经同时含交换与关联的泛函（例如 PBE）再和关联项叠在一起，那样会重复计数。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "显式写法：Becke88 交换 + LYP 关联",
            text: `&XC
  &XC_FUNCTIONAL
    &BECKE88
    &END BECKE88
    &LYP
    &END LYP
  &END XC_FUNCTIONAL
&END XC`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "别把快捷值当完整方法",
            text: "写 `&XC_FUNCTIONAL PBE0` 只选定了泛函形式。HF 交换的库、截断半径、内存上限都要在 &HF 里另外设，CP2K 不会自动配好——手册对此说得很直接：即使对 LibXC 泛函也不会自动设置。",
          },
        ],
      },
      {
        id: "8.3",
        title: "meta-GGA：多一个动能密度",
        blocks: [
          {
            type: "p",
            text: "meta-GGA 在密度与梯度之外，还用到动能密度 $\\tau$。这让它能区分单占据与多占据区域，对氢键、弱相互作用、带隙的描述通常比 GGA 好，成本只比 GGA 高一点。CP2K 内置了 TPSS，可以直接当快捷值用。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "用 TPSS 做 meta-GGA 计算",
            text: `&XC
  &XC_FUNCTIONAL TPSS
  &END XC_FUNCTIONAL
&END XC`,
          },
          {
            type: "p",
            text: "内置清单之外的 meta-GGA 要走 LibXC：CP2K 编译时链接了 LibXC，就能按 LibXC 的函数名调用（例如 r2SCAN 的交换与关联部分），写法和内置泛函一样放在 &XC_FUNCTIONAL 里。手册给了所有受支持 LibXC 函数的子节，名字与 LibXC 官方一致。",
          },
          {
            type: "p",
            text: "两个实现层面的注意点。第一，**TPSS 在 LSD（即 UKS/开壳层自旋极化）下不可用**，手册明确要求这种情况改用 LibXC 版本。第二，meta-GGA 依赖占据轨道的动能密度，对角化与 OT 都能算，但 OT 的预条件选择要重新验证，别照抄 GGA 的参数。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "什么时候值得上 meta-GGA",
            text: "如果你在 GGA 下已经做完了收敛测试，只是想改善氢键或弱相互作用，又不想付杂化泛函的代价，TPSS 是合理的下一步。但要先确认赝势族：GTH 库以 PBE 参数化为主，换泛函后的一致性要自己把关。",
          },
        ],
      },
      {
        id: "8.4",
        title: "杂化泛函与 &HF",
        blocks: [
          {
            type: "p",
            text: "杂化泛函把一部分交换换成精确（Hartree–Fock）交换，比例由泛函定义：PBE0 是 25%，B3LYP 是 20%。在 CP2K 里，泛函形式由 &XC_FUNCTIONAL 的快捷值给出，精确交换的实现细节由 &HF 控制，两者必须同时存在。",
          },
          {
            type: "p",
            text: "&HF 下最常动的是三样：**FRACTION** 是 HF 交换比例（默认 1.0，即纯 HF 用 `&XC_FUNCTIONAL NONE` 加 `FRACTION 1.0`）；**&SCREENING** 里的 EPS_SCHWARZ 控制远距离交换的截断；**&MEMORY** 里的 MAX_MEMORY 限制每个 MPI 进程用于存储交换矩阵的内存。杂化计算最容易死在这三处，而不是数学上。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "PBE0：泛函 + HF 截断与内存",
            text: `&XC
  &XC_FUNCTIONAL PBE0
  &END XC_FUNCTIONAL
  &HF
    &SCREENING
      EPS_SCHWARZ 1.0E-10
    &END SCREENING
    &MEMORY
      MAX_MEMORY 500
    &END MEMORY
  &END HF
&END XC`,
          },
          {
            type: "p",
            text: "杂化的成本来自四中心交换积分，随体系尺寸增长很快。CP2K 提供几条降本路线：**ADMM**（辅助密度矩阵方法）用一套辅助基组近似交换，需要在 &KIND 里额外声明 `BASIS_SET AUX_FIT`；**RI-HFX** 用 RI 分解加速；以及调节 EPS_SCHWARZ 的截断半径。三条路线都改变数值，必须单独做收敛测试。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "杂化计算的三个常见死法",
            text: "内存不够被 OOM 杀掉、截断太松导致能量漂移、以及忘了杂化需要更大的基组与更细的网格。前两个调 &HF，第三个回第 6、7 章。别一上来就把 MAX_MEMORY 调到机器物理内存之上。",
          },
        ],
      },
      {
        id: "8.5",
        title: "色散：半局域泛函缺的那块",
        blocks: [
          {
            type: "p",
            text: "LDA 与 GGA 只看局域密度与梯度，天生描述不了两个闭壳层之间由瞬时涨落产生的吸引。后果很具体：用 PBE 算分子晶体，晶格常数偏大、结合能偏小；算石墨层间距，层与层几乎不粘；算物理吸附，吸附能可能只剩零点几。这不是收敛问题，换更大的基组也救不回来。",
          },
          {
            type: "p",
            text: "工程上的解法是加经验色散修正：在 DFT 能量上叠一个原子对之间的 $C_6/R^6$ 型吸引项。CP2K 通过 `&VDW_POTENTIAL` 配置，`POTENTIAL_TYPE PAIR_POTENTIAL` 表示对势型修正，具体方案在 `&PAIR_POTENTIAL` 里选。",
          },
          {
            type: "table",
            head: ["方案", "特点", "什么时候用"],
            rows: [
              ["DFTD2", "最老的方案，只有 C6 与阻尼", "复现老文献"],
              ["DFTD3", "按配位数调整 C6，零阻尼", "一般较少单独用"],
              ["DFTD3(BJ)", "Becke–Johnson 阻尼，短程行为更合理，CP2K 默认", "通用首选"],
              ["DFTD4", "含电荷依赖与三体项，更新一代", "需要更系统描述时"],
            ],
            caption: "PAIR_POTENTIAL 支持的经验色散方案",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "PBE + D3(BJ)（片段，放在 &XC 内）",
            text: `&XC
  &XC_FUNCTIONAL PBE
  &END XC_FUNCTIONAL
  &VDW_POTENTIAL
    POTENTIAL_TYPE PAIR_POTENTIAL
    &PAIR_POTENTIAL
      TYPE DFTD3(BJ)
      REFERENCE_FUNCTIONAL PBE
      PARAMETER_FILE_NAME dftd3.dat
    &END PAIR_POTENTIAL
  &END VDW_POTENTIAL
&END XC`,
          },
          {
            type: "p",
            text: "**REFERENCE_FUNCTIONAL 必须和实际泛函一致**。D3 的缩放参数是按泛函拟合的，程序靠这个名字去参数文件里查 $s_6$、$a_1$、$s_8$、$a_2$。名字写错或留空，程序会猜，而猜错不会报错，只会给你一套错的色散能。这也是「加了色散但结果更怪」的常见原因。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "色散不是可选项",
            text: "对分子晶体、层状材料、多孔材料、液体、以及任何靠物理吸附的体系，不加色散的 GGA 结果没有物理意义。审稿人看方法部分第一眼就会找这一句。",
          },
        ],
      },
      {
        id: "8.6",
        title: "非局域 vdW：rVV10 与 vdW-DF",
        blocks: [
          {
            type: "p",
            text: "经验色散是「事后补一个对势」，不改变电子密度。另一条路是把长程关联写进泛函本身，做成**非局域关联泛函**：它依赖整个空间的密度，参与自洽迭代，因此能同时修正密度与能量。代价是要多算一次卷积，成本明显更高。",
          },
          {
            type: "p",
            text: "CP2K 支持 DRSLL（即 vdW-DF 系列）与 LMKLL，以及 rVV10。rVV10 用一个可调的 $b$ 参数控制短程行为，参数在 `&NON_LOCAL` 的 PARAMETERS 里给。手册默认值是 $b=6.3$、$C=9.3\\times10^{-3}$。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "rVV10 非局域泛函（片段，放在 &XC 内）",
            text: `&XC
  &XC_FUNCTIONAL PBE
  &END XC_FUNCTIONAL
  &VDW_POTENTIAL
    POTENTIAL_TYPE NON_LOCAL
    &NON_LOCAL
      TYPE RVV10
      KERNEL_FILE_NAME rVV10_kernel_table.dat
      PARAMETERS 6.3 9.3E-3
    &END NON_LOCAL
  &END VDW_POTENTIAL
&END XC`,
          },
          {
            type: "p",
            text: "选 D3 还是 rVV10，取决于你要什么。**D3 便宜、成熟、可移植**，绝大多数吸附与分子晶体研究够用；**非局域泛函自洽地改变密度**，对层状材料的电子结构、表面偶极更自洽，但对参数更敏感，也更容易和赝势/基组产生交互。两者不能简单叠加——同时开两套色散等于重复计算吸引。",
          },
          {
            type: "callout",
            kind: "info",
            title: "核文件从哪来",
            text: "KERNEL_FILE_NAME 指向的核表放在 CP2K data 目录里，rVV10 用 rVV10_kernel_table.dat，其他非局域泛函用 vdW_kernel_table.dat。文件名写错时会直接报找不到文件，比参数错好排查。",
          },
        ],
      },
      {
        id: "8.7",
        title: "色散改变了什么，什么时候必须加",
        blocks: [
          {
            type: "p",
            text: "色散修正主要影响三类量。**能量差**：吸附能、结合能、层间剥离能，不加色散会系统性偏小；**几何**：层间距、分子晶体晶格常数、液体密度，不加色散会偏大或偏松；**振动**：低频模式与热力学量对结合是否合理很敏感。电子结构本身（带隙、态密度）受影响较小，但密度一变，表面偶极与功函数也会跟着动。",
          },
          {
            type: "list",
            ordered: true,
            items: [
              "体系里有分子晶体、层状材料、多孔骨架：必须加",
              "研究物理吸附、气体存储、表面浸润：必须加",
              "液体、水、溶剂化：必须加，且要做密度收敛",
              "刚性小分子、共价键主导的反应能垒：影响较小，但仍建议加并说明",
              "金属表面吸附：选与泛函匹配的 D3 参数，注意金属的屏蔽",
            ],
          },
          {
            type: "p",
            text: "还有一条容易忘记的：**做方法对比时色散设置必须一致**。PBE 加 D3 与 PBE0 不加 D3 比出来的「杂化更好」，比的可能只是色散。方法部分的表格里要把泛函与色散方案写在同一列。",
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "输入文件生成器",
            desc: "在生成器里换泛函、打开色散，对照生成结果检查 &XC_FUNCTIONAL、&HF、&VDW_POTENTIAL 三个子节是否齐全。",
          },
          {
            type: "keypoints",
            items: [
              "&XC 的三块拼图：半局域泛函、精确交换、色散修正，缺一不可",
              "快捷值只决定泛函形式，&HF 的截断、内存、库要自己配",
              "杂化泛函按比例混入精确交换，PBE0 是 25%，B3LYP 是 20%",
              "D3(BJ) 是通用首选的色散方案，REFERENCE_FUNCTIONAL 必须与泛函一致",
              "rVV10 把长程关联写进泛函并参与自洽，成本更高，别与 D3 叠加",
              "分子晶体、层状材料、吸附与液体，不加色散的结果不可用",
            ],
          },
          {
            type: "callout",
            kind: "key",
            title: "一句话记住",
            text: "泛函决定「能算多准」，色散决定「吸不吸得住」。选完泛函，先问一句：这个体系靠什么结合？靠范德华的，就必须补色散。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "用 PBE 计算分子晶体，最可能出现什么偏差？",
        options: [
          "晶格常数偏小、结合能偏大",
          "晶格常数偏大、结合能偏小，甚至几乎不结合",
          "带隙完全消失",
          "SCF 一定不收敛",
        ],
        answer: 1,
        explain:
          "PBE 是半局域泛函，缺少描述瞬时涨落产生的长程吸引。分子晶体靠范德华结合，不加色散时结合被显著低估，晶格被撑大。",
      },
      {
        q: "在 CP2K 里给 PBE 加 D3(BJ)，正确的写法是？",
        options: [
          "&DFT 下写 PAIR_POTENTIAL DFTD3(BJ)",
          "&XC 下写 &VDW_POTENTIAL，POTENTIAL_TYPE PAIR_POTENTIAL，再在 &PAIR_POTENTIAL 里设 TYPE DFTD3(BJ)",
          "&SCF 下写 VDW DFTD3",
          "&SUBSYS 下写 DISPERSION D3",
        ],
        answer: 1,
        explain:
          "色散修正属于交换关联项，挂在 &XC 的 &VDW_POTENTIAL 下。PAIR_POTENTIAL 表示对势型修正，具体方案写在嵌套的 &PAIR_POTENTIAL 节里。",
      },
      {
        q: "&PAIR_POTENTIAL 里 REFERENCE_FUNCTIONAL 的作用是？",
        options: [
          "指定计算用什么泛函",
          "告诉程序去参数文件里取哪套泛函对应的色散缩放参数",
          "设定参考体系的能量零点",
          "控制色散的截断半径",
        ],
        answer: 1,
        explain:
          "D3 的 s6、a1、s8、a2 是按泛函拟合的。REFERENCE_FUNCTIONAL 决定取哪一组；写错或留空时程序会自行猜测，往往不报错但结果错。",
      },
      {
        q: "PBE0 里精确交换的比例是多少？",
        options: ["10%", "20%", "25%", "50%"],
        answer: 2,
        explain:
          "PBE0 由 25% 的 HF 交换与 75% 的 PBE 交换混合而成（B3LYP 是 20%）。这个比例由泛函定义，不需要也不应该手动改 FRACTION。",
      },
      {
        q: "meta-GGA 相对 GGA 多用了什么信息？",
        options: [
          "电子密度的二阶导数",
          "动能密度（以及由此得到的占据信息）",
          "Hartree–Fock 交换",
          "原子核坐标",
        ],
        answer: 1,
        explain:
          "meta-GGA 在密度与梯度之外还依赖动能密度 τ，因此能区分单占据与多占据区域，对氢键和弱相互作用描述更好，成本只略高于 GGA。",
      },
    ],
    terms: [
      { t: "LDA", en: "local density approximation", d: "只依赖局域电子密度的泛函，最简单也最便宜，代表是 PADE 与 PZ81。" },
      { t: "GGA", en: "generalized gradient approximation", d: "在密度之外加入梯度的泛函，PBE 与 BLYP 是最常用的两个。" },
      { t: "meta-GGA", en: "meta-GGA", d: "再加入动能密度的泛函，如 TPSS；能更好地区分单占据与多占据区域。" },
      { t: "杂化泛函", en: "hybrid functional", d: "按比例混入 Hartree–Fock 精确交换的泛函，PBE0 为 25%，B3LYP 为 20%。" },
      { t: "DFT-D3(BJ)", en: "dispersion correction with BJ damping", d: "按配位数调整 C6 并采用 Becke–Johnson 阻尼的经验色散修正，CP2K 的默认方案。" },
      { t: "rVV10", en: "revised Vydrov–Van Voorhis", d: "把长程关联写成非局域泛函的色散方案，参与自洽迭代，靠 b 参数调节。" },
      { t: "非局域关联", en: "non-local correlation", d: "依赖整个空间密度的关联项，用于描述长程范德华吸引。" },
      { t: "ADMM", en: "auxiliary density matrix method", d: "用辅助基组近似精确交换、降低杂化泛函成本的方法，需在 &KIND 里声明 AUX_FIT 基组。" },
    ],
    sources: [
      { t: "DFT 方法总览（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/index.html" },
      { t: "Hartree–Fock 与杂化（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/hartree-fock/index.html" },
      { t: "&XC 输入参考", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/XC.html" },
      { t: "&VDW_POTENTIAL 输入参考", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/XC/VDW_POTENTIAL.html" },
    ],
  };
})();