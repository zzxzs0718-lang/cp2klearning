(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch07"] = {
    id: "ch07",
    num: 7,
    part: "DFT 核心",
    title: "基组与赝势：把原子描述对",
    subtitle: "读懂 DZVP-MOLOPT-SR-GTH-q6 这一串名字，配对基组、赝势与泛函",
    hours: 2,
    level: "进阶",
    intro:
      "网格决定密度算得细不细，基组决定轨道能不能展开得开。这一章把 CP2K 里最常见的那串名字拆开：DZVP 是什么、MOLOPT 优化了什么、SR 省掉了什么、q6 为什么必须是 6。然后讲清基组与赝势怎么配对、怎么在 &KIND 里写，以及配错时 CP2K 会怎么报错。",
    goals: [
      "把 DZVP-MOLOPT-SR-GTH-q6 这类名字逐段拆开，说出每一段的含义",
      "根据计算所用泛函与元素，选出匹配的 GTH 赝势并核对价电子数",
      "在 &KIND 里正确配置 BASIS_SET 与 POTENTIAL，并说明文件搜索路径",
      "判断什么时候需要更大基组或弥散函数，并解释 BSSE 与 counterpoise 校正",
    ],
    sections: [
      {
        id: "7.1",
        title: "基组是什么：一条轨道由几条高斯拼出来",
        blocks: [
          {
            type: "p",
            text: "Kohn–Sham 轨道是未知函数，数值求解必须给它一个有限的展开空间。CP2K 用**原子中心高斯函数**：每个原子贡献一组基函数，分子轨道写成它们的线性组合。基组越大，能展开的形状越丰富，代价也越高。",
          },
          {
            type: "p",
            text: "基组的「大小」由两个指标决定。**ζ 数**是每个原子轨道方向用几套径向函数描述：单ζ（SZV）只有一套，双ζ（DZVP）两套，三ζ（TZVP、TZV2P）三套。**极化**是在角动量上再加一层，例如给氧的 p 函数配 d 函数，让电子云能被化学环境拉偏。",
          },
          {
            type: "table",
            head: ["基组", "径向套数", "极化", "典型用途"],
            rows: [
              ["SZV", "1", "无", "快速试探、看结构是否合理"],
              ["DZVP", "2", "有", "常规凝聚相计算的起点"],
              ["TZVP", "3", "有", "需要更可靠能量差时"],
              ["TZV2P", "3", "两层", "响应性质、较精细的弱相互作用"],
              ["QZVPP", "4", "两层", "基准计算，成本高"],
            ],
            caption: "常见后缀的含义与用途；实际函数个数还取决于元素与收缩方式",
          },
          {
            type: "p",
            text: "要记住的因果关系是：==基组误差和网格误差互相独立==。CUTOFF 再高，也只能把密度和势表示得更准，不会让 SZV 变成 DZVP。手册在基组页面开头就点明了这一点：提高 CUTOFF 达不到完备基组极限，两者要分别收敛。",
          },
          {
            type: "callout",
            kind: "info",
            title: "为什么 CP2K 不用平面波展开轨道",
            text: "平面波展开轨道需要很大的截断能才能描述核附近的尖峰，成本随体系体积线性增长。高斯基组天然贴合原子，函数少得多。CP2K 用平面波只做辅助网格，正是想把两者的长处都拿到。",
          },
        ],
      },
      {
        id: "7.2",
        title: "读懂 MOLOPT 的名字",
        blocks: [
          {
            type: "p",
            text: "CP2K 数据目录里最常出现的基组名长这样：`DZVP-MOLOPT-SR-GTH-q6`。它其实是五段信息压在一起，从右往左读最清楚：q6 是价电子数，GTH 说明配套的赝势类型，SR 是短程变体，MOLOPT 是优化方案，DZVP 是质量等级。",
          },
          {
            type: "list",
            items: [
              "**DZVP**：双ζ加极化，每个价轨道两套径向函数外加一层极化函数",
              "**MOLOPT**：为分子与凝聚相计算优化的收缩基组，函数紧凑，是 GPW 计算的主力",
              "**SR**：short-range 变体，弥散函数更少，大体系与周期性体系里更省，也更不容易出现线性依赖",
              "**GTH**：配套 GTH 模守恒赝势；不带 GTH 的基组配的是别的势或全电子",
              "**q6**：这套基组与「显式处理 6 个价电子」的赝势配对，例如氧的 GTH-PBE-q6",
            ],
          },
          {
            type: "p",
            text: "**要不要带 SR** 是实践中最常纠结的一点。不带 SR 的 MOLOPT 带弥散尾巴，适合阴离子、激发态、极化率、弱相互作用这类需要电子云「往外伸」的问题；带 SR 的版本去掉了长尾，在分子晶体、液体、表面这类大体系里更稳、更便宜。判断标准是你的目标性质是否依赖远离核的电子密度。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "同一篇文章里别混用",
            text: "比较两个体系的能量时，基组必须完全一致，连 SR 都不能一个带一个不带。混用会让能量差里混进基组误差，而这类误差往往和你关心的化学效应同量级。",
          },
        ],
      },
      {
        id: "7.3",
        title: "GTH 赝势与 q 值",
        blocks: [
          {
            type: "p",
            text: "除氢以外，内层电子在化学反应里几乎不动，却让计算量暴涨：电子数变多，核附近密度变尖，网格也得跟着变细。**赝势**把内层电子连同核一起替换成一个有效势，只显式处理价电子。CP2K 的 GPW 计算默认配 **GTH 模守恒赝势**。",
          },
          {
            type: "p",
            text: "名字里的 **q 值就是被显式处理的价电子数**。`GTH-PBE-q6` 表示用 PBE 泛函参数化、处理 6 个价电子，正好对应氧的 $2s^2 2p^4$；氢是 q1，碳是 q4，氮是 q5，硅是 q4。中间的 PBE 不是装饰：赝势是针对某个泛函族生成的，换泛函就该换赝势。",
          },
          {
            type: "table",
            head: ["元素", "价电子数", "常用赝势", "配套基组"],
            rows: [
              ["H", "1", "GTH-PBE-q1", "DZVP-MOLOPT-SR-GTH"],
              ["C", "4", "GTH-PBE-q4", "DZVP-MOLOPT-SR-GTH"],
              ["N", "5", "GTH-PBE-q5", "DZVP-MOLOPT-SR-GTH"],
              ["O", "6", "GTH-PBE-q6", "DZVP-MOLOPT-SR-GTH"],
              ["Si", "4", "GTH-PBE-q4", "DZVP-MOLOPT-SR-GTH"],
            ],
            caption: "PBE 计算下常见的配对；同一元素也可能有 q12、q16 等小核版本，用途不同",
          },
          {
            type: "p",
            text: "动手前值得花十秒确认文件里真有这对组合。基组与赝势分别存在 `BASIS_MOLOPT` 与 `GTH_POTENTIALS` 里，用 grep 查一下比跑一遍报错快得多。",
          },
          {
            type: "code",
            lang: "bash",
            title: "核对基组与赝势是否成对",
            text: `# 把 DATA 换成你的 CP2K data 目录，例如 /usr/share/cp2k/data
DATA=/usr/share/cp2k/data
grep -E "^(H|C|N|O|Si) +GTH-PBE-q" $DATA/GTH_POTENTIALS
grep -c "DZVP-MOLOPT-SR-GTH" $DATA/BASIS_MOLOPT
grep -n "DZVP-MOLOPT-GTH q6" $DATA/BASIS_MOLOPT`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "q 值必须和基组对上",
            text: "基组文件里同一元素往往有好几套 q 版本。用 q6 的赝势配了按 q12 优化的基组，CP2K 未必立刻报错，但芯态与价态的划分不一致，能量没有可比性。拿不准时用全名，例如 DZVP-MOLOPT-GTH-q6。",
          },
        ],
      },
      {
        id: "7.4",
        title: "配置：文件、&KIND 与可选类型",
        blocks: [
          {
            type: "p",
            text: "基组和赝势都不是写在输入文件里的，而是从外部文件读。`&DFT` 下用 **BASIS_SET_FILE_NAME** 与 **POTENTIAL_FILE_NAME** 列出文件名；CP2K 会先在当前目录找，再去 CP2K 的 data 目录找。文件名写错，或者文件不在搜索路径里，都会直接报找不到。",
          },
          {
            type: "p",
            text: "具体到每个元素，在 `&SUBSYS` 里用 **&KIND** 指定。一个 kind 对应一类原子（同元素、同基组、同赝势、同自旋设置）。BASIS_SET 可以只写名字，也可以显式标出用途：`BASIS_SET ORB DZVP-MOLOPT-GTH` 与短写等价，其他用途还有 AUX_FIT（ADMM 辅助基组）、RI_AUX（RI 方法）、LRI（局部 RI）。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "&KIND：为每个元素配基组与赝势（片段）",
            text: `&KIND O
  BASIS_SET ORB DZVP-MOLOPT-SR-GTH
  POTENTIAL GTH-PBE-q6
&END KIND

&KIND H
  BASIS_SET ORB DZVP-MOLOPT-SR-GTH
  POTENTIAL GTH-PBE-q1
&END KIND`,
          },
          {
            type: "p",
            text: "新写的生产输入推荐用 **UZH 协议**这一对文件：基组 `BASIS_MOLOPT_UZH` 配赝势 `POTENTIAL_UZH`。它们按同一套协议生成，配对关系比老库更明确。老的 `BASIS_MOLOPT` 加 `GTH_POTENTIALS` 仍然可用，复现旧文献时需要它。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "换成 UZH 配对（片段）",
            text: `&DFT
  BASIS_SET_FILE_NAME BASIS_MOLOPT_UZH
  POTENTIAL_FILE_NAME POTENTIAL_UZH
  &MGRID
    CUTOFF 400
    REL_CUTOFF 50
  &END MGRID
&END DFT`,
          },
          {
            type: "callout",
            kind: "info",
            title: "POTENTIAL 关键词与 POTENTIAL 段",
            text: "&KIND 里的 POTENTIAL 是一个关键词，后面接赝势名。别把它和同名的 POTENTIAL 段搞混：段形式用来直接写完整的赝势内部数据，只有做特殊势或调试时才需要。正常输入里用关键词就够了，restart 文件会自动展开成段。",
          },
        ],
      },
      {
        id: "7.5",
        title: "怎么选，以及 BSSE 这件事",
        blocks: [
          {
            type: "p",
            text: "选择策略可以先按目标性质分档。常规凝聚相的能量与结构，`DZVP-MOLOPT-SR-GTH` 是性价比最高的起点；需要可靠的相对能量、弱相互作用或响应性质，升到 `TZV2P-MOLOPT-GTH`；只有做基准或验证时才考虑 QZVPP。每升一档，函数个数和 FFT 之外的所有矩阵操作都会变贵。",
          },
          {
            type: "list",
            ordered: true,
            items: [
              "先确认体系里有哪些元素、每个元素的价电子数，定下赝势",
              "从 DZVP-MOLOPT-SR-GTH 起步，跑通并检查 SCF 与电子数",
              "用目标性质做基组收敛：把基组升一档，看结论是否改变",
              "涉及阴离子、激发态、极化率、氢键时，去掉 SR 或改用带弥散函数的基组",
              "全电子或 core-level 计算改用 -ae 基组加 GAPW，并设 POTENTIAL ALL",
            ],
          },
          {
            type: "p",
            text: "**BSSE（基组叠加误差）** 是有限基组带来的系统性偏差：算 A–B 复合物时，A 会「借用」B 的基函数来降低自己的能量，而这个便宜在孤立 A 的计算里没有。结果是结合能被高估，弱相互作用体系尤其明显。标准做法是 counterpoise 校正：在复合物几何下，把另一片段的基函数保留、原子和电子去掉，重新算每个片段的能量。",
          },
          {
            type: "p",
            text: "CP2K 在 `&FORCE_EVAL` 下有专门的 `&BSSE` 段，可以按片段自动做这类校正。不过更常见的做法是选一套本身 BSSE 就小的基组，再配合足够大的基组做收敛检验——校正能救数据，但救不了太小的基组。下面这份水分子输入把 SR 变体从头走一遍（RUN_TYPE ENERGY 与 MAX_SCF 50 用默认值，所以没写）。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_sr.inp：一份可直接运行的完整输入",
            text: `&GLOBAL
  PROJECT h2o_sr
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
    &SCF
      EPS_SCF 1.0E-7
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 12.0 12.0 12.0
      PERIODIC NONE
    &END CELL
    &COORD
      O  0.000 0.000 0.000
      H  0.757 0.586 0.000
      H -0.757 0.586 0.000
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
            type: "callout",
            kind: "tip",
            title: "基组收敛比 cutoff 收敛更容易被跳过",
            text: "很多人做了 CUTOFF 扫描就以为收敛做完了。基组升级往往改变相对能量更多：把 DZVP 换成 TZV2P，吸附能可能移动几十毫电子伏。目标性质是能量差时，基组收敛是不能省的一步。",
          },
        ],
      },
      {
        id: "7.6",
        title: "基组与赝势不匹配的典型报错",
        blocks: [
          {
            type: "p",
            text: "这一类错误几乎都发生在输入解析阶段，报错信息其实很直白，只是第一次见容易慌。下面几种是真正会遇到的，按出现频率排。",
          },
          {
            type: "table",
            head: ["输出里的症状", "原因", "怎么改"],
            rows: [
              ["BASIS SET ... NOT FOUND", "文件名没列进 BASIS_SET_FILE_NAME，或基组名拼错、该元素没有这套基组", "核对文件名与数据目录里的真实名字"],
              ["POTENTIAL ... NOT FOUND", "POTENTIAL_FILE_NAME 指向的文件里没有这个势，或 q 值写错", "用全名，如 GTH-PBE-q6"],
              ["总电子数为奇数却按闭壳层算", "q 值与真实价电子数不符，或体系本身是开壳层", "核对 q 值；开壳层加 UKS 与 MULTIPLICITY"],
              ["GAPW 报错说不支持该基组", "全电子方法配了价电子基组", "换 -ae 基组并设 POTENTIAL ALL"],
              ["SCF 反复警告最高占据带", "基组太小或缺少弥散函数，占据在边界上不稳", "升基组或加弥散函数，而不是硬压 SCF"],
            ],
            caption: "基组/赝势相关的常见失败与处理",
          },
          {
            type: "p",
            text: "还有一类不报错但结果可疑：用 PBE 赝势配 BLYP 泛函。手册的说法是，混用泛函族在探索性工作里有时可接受，但它不是系统性达到高精度的路线。审稿人问起方法细节时，这一条很难解释。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "别用 IGNORE_CONVERGENCE_FAILURE 掩盖基组问题",
            text: "基组太小导致的 SCF 震荡，靠放宽收敛判据或忽略失败只会得到一个数值，不会得到一个态。先检查基组与赝势，再考虑 SCF 参数。",
          },
        ],
      },
      {
        id: "7.7",
        title: "检查清单",
        blocks: [
          {
            type: "keypoints",
            items: [
              "后缀从右往左读：q 值 → 赝势类型 → SR → MOLOPT → ζ 与极化等级",
              "赝势的泛函族必须与 &XC 里选的泛函一致：PBE 计算配 GTH-PBE",
              "基组与赝势必须来自声明的文件，名字能在 data 目录里 grep 到",
              "基组误差与网格误差独立，CUTOFF 不能替代基组收敛",
              "比较能量时基组必须完全一致，连 SR 与非 SR 都不能混",
              "BSSE 会高估结合能，弱相互作用要么用大基组、要么做 counterpoise",
            ],
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "输入文件生成器",
            desc: "选元素、基组与赝势，生成带 &KIND 的完整输入，再对照本章核对每一行的含义。",
          },
          {
            type: "callout",
            kind: "key",
            title: "一句话记住",
            text: "基组决定轨道能展开多开，赝势决定还剩多少个电子要算；两者按元素、按泛函成对出现，q 值是它们的接口。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "DZVP-MOLOPT-SR-GTH-q6 里的 q6 表示什么？",
        options: [
          "基组包含 6 个收缩函数",
          "配套赝势显式处理 6 个价电子",
          "该元素原子序数为 6",
          "最多支持 6 个 k 点",
        ],
        answer: 1,
        explain:
          "q 值是赝势的价电子数。q6 表示这套基组与「只显式处理 6 个价电子」的赝势配对，例如氧的 GTH-PBE-q6；芯电子被赝势吸收。",
      },
      {
        q: "基组名里的 -SR 表示什么？",
        options: [
          "自旋限制（spin restricted）",
          "短程变体，弥散函数更少，适合大体系",
          "只用于固体的基组",
          "单参考方法专用",
        ],
        answer: 1,
        explain:
          "SR 是 short-range 的缩写，指去掉长尾弥散的 MOLOPT 变体。它在凝聚相与大体系里更省、更稳定，但当目标性质依赖远离核的电子密度时不该用。",
      },
      {
        q: "用 PBE 泛函算水，氧原子应当配哪个赝势？",
        options: ["GTH-LDA-q6", "GTH-PBE-q6", "GTH-BLYP-q6", "任意 q6 赝势都一样"],
        answer: 1,
        explain:
          "赝势是针对泛函族参数化的，计算用什么泛函就该配同族的势。PBE 计算用 GTH-PBE-q6，与 DZVP-MOLOPT-GTH 或 SR 版本配对。",
      },
      {
        q: "BASIS_SET_FILE_NAME 的作用是？",
        options: [
          "指定输出的基组信息文件名",
          "声明去哪里搜索基组定义，可列多个文件",
          "设定基组的最大角动量",
          "打开基组打印",
        ],
        answer: 1,
        explain:
          "CP2K 不在输入里内联基组，而是从声明的文件读取。程序先在当前目录找，再去 CP2K data 目录找；没有声明或名字拼错就会报 BASIS SET NOT FOUND。",
      },
      {
        q: "基组叠加误差（BSSE）在计算弱相互作用时通常造成什么后果？",
        options: [
          "结合能被低估，复合物显得太松",
          "结合能被高估，因为片段互相借用了对方的基函数",
          "总能量出现虚部",
          "只影响力，不影响能量",
        ],
        answer: 1,
        explain:
          "复合物里每个片段都能用到对方的基函数，等于用更大的有效基组描述自己，能量被额外压低，结合能被高估。counterpoise 校正在复合物几何下用各自片段的基函数重算，扣掉这部分。",
      },
    ],
    terms: [
      { t: "基组", en: "basis set", d: "把分子轨道展开成原子中心函数的集合；大小由 ζ 数与极化函数决定。" },
      { t: "MOLOPT", en: "molecularly optimized", d: "为分子与凝聚相 GPW 计算优化的收缩高斯基组，函数紧凑，是 CP2K 的常用主力。" },
      { t: "-SR", en: "short range", d: "去掉长尾弥散的 MOLOPT 变体，适合大体系与周期性计算，成本更低。" },
      { t: "GTH 赝势", en: "Goedecker-Teter-Hutter pseudopotential", d: "模守恒赝势，把芯电子替换成有效势，只显式处理价电子；GPW 计算默认使用。" },
      { t: "q 值", en: "valence charge", d: "赝势显式处理的价电子数，如 q6 表示 6 个价电子，必须与基组后缀一致。" },
      { t: "BSSE", en: "basis set superposition error", d: "有限基组下片段互相借用基函数导致的能量偏差，通常高估结合能。" },
      { t: "counterpoise", en: "counterpoise correction", d: "在复合物几何下用各片段自身基函数重算能量，用以扣除 BSSE 的标准方法。" },
      { t: "UZH 协议", en: "UZH basis/potential protocol", d: "配套使用 BASIS_MOLOPT_UZH 与 POTENTIAL_UZH 的基组-赝势组合，新生产输入推荐。" },
    ],
    sources: [
      { t: "基组（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/basis_sets.html" },
      { t: "赝势（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/pseudopotentials.html" },
      { t: "&KIND 输入参考", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/SUBSYS/KIND.html" },
    ],
  };
})();