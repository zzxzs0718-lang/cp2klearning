(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch03"] = {
    id: "ch03",
    num: 3,
    part: "上手",
    title: "第一个计算：水分子的单点能",
    subtitle: "写一份 40 行的输入，跑通 CP2K，读懂输出里的能量",
    hours: 1.5,
    level: "入门",
    intro:
      "你不需要先学完所有理论，才能跑第一个计算。这一章把一个水分子放进盒子里，用 PBE 泛函算它的电子能量。输入文件只有 40 行，跑完只要几秒——但它包含了 CP2K 输入文件的全部骨架。跑通之后，我们再逐段拆开看每一行在做什么。",
    goals: [
      "写出并运行一个最小可用的 CP2K 输入文件",
      "说清 &GLOBAL、&FORCE_EVAL、&DFT、&SUBSYS 四层结构各自负责什么",
      "在输出文件里找到总能量、SCF 收敛信息和耗时",
      "认出这个例子里的三个「非默认」选择：非周期盒子、GTH 赝势、MOLOPT 基组",
    ],
    sections: [
      {
        id: "3.1",
        title: "这次要算什么",
        blocks: [
          {
            type: "p",
            text: "我们要算的是**孤立水分子的电子基态能量**：给定原子核位置，求解 Kohn–Sham 方程，得到电子密度和总能量。这在 CP2K 里叫**单点能**（single-point energy）——原子不动，只算电子。它是后面几何优化、分子动力学、频率分析的共同地基。",
          },
          {
            type: "p",
            text: "所用方法：**Quickstep 模块 + GPW**（Gaussian and Plane Waves，高斯基组配平面波辅助网格）+ **PBE** 泛函 + **GTH 赝势** + **DZVP-MOLOPT-GTH** 基组。这几个名词现在不用全懂，第 6–8 章会逐个拆开；这一章只要求你把流程跑通。",
          },
          {
            type: "key",
            items: [
              { k: "PROJECT h2o", v: "给这次计算起名，决定输出文件名与中间文件前缀", tag: "必填" },
              { k: "RUN_TYPE ENERGY", v: "只算能量，原子不动；后续优化改成 GEO_OPT", tag: "必填" },
              { k: "METHOD Quickstep", v: "用 GPW 的 DFT 模块，绝大多数计算都用它", tag: "必填" },
              { k: "CUTOFF 400", v: "平面波辅助网格的截断能，单位 Ry；收敛测试的起点", tag: "常用" },
              { k: "PERIODIC NONE", v: "非周期（孤立分子）；做晶体时改 XYZ 或 XY", tag: "常用" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "为什么先拿水开刀",
            text: "水分子小、有极性、实验数据多，是检验基组和泛函的经典试金石。更重要的是：它足够小，任何错误都会在几秒内暴露，而不是等你跑完 300 个原子才发现输入写错了。",
          },
        ],
      },
      {
        id: "3.2",
        title: "建目录，写输入",
        blocks: [
          {
            type: "p",
            text: "新建一个目录，把下面的内容保存为 `h2o.inp`。缩进不是语法要求，但**强烈建议**按层级缩进——CP2K 的输入树很深，缩进错了人眼很难查。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o.inp",
            text: `&GLOBAL
  PROJECT h2o
  RUN_TYPE ENERGY
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
    &POISSON
      PERIODIC NONE
      PSOLVER MT
    &END POISSON
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 50
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 10.0 10.0 10.0
      PERIODIC NONE
    &END CELL
    &COORD
      O  5.0000  5.0000  5.0000
      H  5.7586  5.0000  5.5043
      H  4.2414  5.0000  5.5043
    &END COORD
    &KIND O
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
    &KIND H
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "三个容易写错的地方",
            text: "① 每个 `&SECTION` 必须有配对的 `&END SECTION`，`&END` 后面写全名最稳妥。② 关键词与值之间用空格，不能用等号；`CUTOFF = 400` 会被当成错误。③ CP2K 不区分大小写，但**文件名区分**：`BASIS_MOLOPT` 与实际文件必须一字不差。",
          },
          {
            type: "p",
            text: "把基组和赝势文件放到同一目录（或让 CP2K 在搜索路径里找到它们）。如果你用发行版安装，这两个文件通常在 `$CP2K_DATA_DIR` 下；用 `cp2k.psmp --version` 看不到数据目录时，直接 `find / -name BASIS_MOLOPT` 找一下。",
          },
          {
            type: "code",
            lang: "bash",
            title: "准备与运行",
            text: `mkdir -p ~/cp2k-tutorial/h2o && cd ~/cp2k-tutorial/h2o
# 把 h2o.inp 存进来，并确认数据文件可访问
ls $CP2K_DATA_DIR/BASIS_MOLOPT $CP2K_DATA_DIR/GTH_POTENTIALS

# 串行/单节点 OpenMP 运行
export OMP_NUM_THREADS=1
cp2k.psmp -i h2o.inp -o h2o.out`,
          },
        ],
      },
      {
        id: "3.3",
        title: "四层结构：输入文件到底在说什么",
        blocks: [
          {
            type: "p",
            text: "CP2K 输入文件是一棵**分层的树**：顶层只有几个大节，每个大节里嵌套子节。这个例子里出现了四层，理解它们的分工，后面所有章节都只是往对应位置填关键词。",
          },
          {
            type: "table",
            head: ["层级", "负责什么", "本例中的内容"],
            rows: [
              ["&GLOBAL", "全局设置：任务名、跑什么类型的计算、打印级别", "PROJECT、RUN_TYPE"],
              ["&FORCE_EVAL", "能量与力：用什么方法、体系是什么", "METHOD Quickstep，下挂 &DFT 与 &SUBSYS"],
              ["&DFT", "电子结构：基组文件、网格、泊松求解、SCF、泛函", "MGRID、POISSON、SCF、XC"],
              ["&SUBSYS", "体系本身：盒子、坐标、每种元素的基组与赝势", "CELL、COORD、KIND"],
            ],
            caption: "先记住这个骨架，第 4 章会展开成完整地图。",
          },
          {
            type: "p",
            text: "`&GLOBAL` 里的 `RUN_TYPE ENERGY` 决定了这次只做单点。`PROJECT h2o` 决定了输出文件、restart 文件、轨迹文件的前缀——所以**不同计算要用不同 PROJECT**，否则会互相覆盖。",
          },
          {
            type: "p",
            text: "`&DFT` 下有四个子节，各管一件事：`&MGRID` 管实空间积分网格（CUTOFF 与 REL_CUTOFF）；`&POISSON` 管静电势的边界条件；`&SCF` 管自洽迭代的收敛标准；`&XC` 管交换关联泛函。**这四个是 DFT 计算的四个旋钮**，后面第 6、8、9 章分别深入。",
          },
          {
            type: "p",
            text: "`&SUBSYS` 里，`&CELL` 定义 10 Å 的立方盒子并声明 `PERIODIC NONE`；`&COORD` 用笛卡尔坐标（Å）给出三个原子；两个 `&KIND` 分别给 O 和 H 指定基组与赝势。注意 `GTH-PBE-q6` 的 `q6` 表示氧的 6 个价电子被显式处理，`q1` 对应氢的 1 个——**赝势的 q 值必须和基组、元素匹配**，否则 CP2K 会报价电子数错误。",
          },
          {
            type: "key",
            items: [
              { k: "PERIODIC NONE", v: "分子体系；盒子只是为了避免波函数交叠", tag: "本例" },
              { k: "PSOLVER MT", v: "非周期体系的泊松求解器（Martyna–Tuckerman）", tag: "配套" },
              { k: "DZVP-MOLOPT-GTH", v: "为 GTH 赝势优化的双ζ价电子基组", tag: "本例" },
              { k: "EPS_SCF 1.0E-6", v: "密度/能量收敛阈值，常规计算够用", tag: "常用" },
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "读输入文件的顺序",
            text: "先看 `RUN_TYPE` 知道算什么，再看 `&SUBSYS` 知道算什么体系，最后看 `&DFT` 里的方法细节。反过来读（从 CUTOFF 开始抠）最容易迷路。",
          },
        ],
      },
      {
        id: "3.4",
        title: "跑起来，找到能量",
        blocks: [
          {
            type: "p",
            text: "运行命令是 `cp2k.psmp -i 输入 -o 输出`。程序会把几乎所有信息写进 `h2o.out`，终端只留少量进度。跑完后先做三件事：搜能量、确认 SCF 收敛、看耗时。",
          },
          {
            type: "code",
            lang: "bash",
            title: "检查结果",
            text: `grep -n "ENERGY|" h2o.out | tail -5
grep -n "SCF run converged" h2o.out
grep -n "CP2K ENDED" h2o.out
tail -40 h2o.out`,
          },
          {
            type: "p",
            text: "总能量出现在这样一行里（数值因基组、赝势、截断能和几何而异，不要照抄）：",
          },
          {
            type: "code",
            lang: "text",
            title: "h2o.out（节选）",
            text: ` ENERGY| Total FORCE_EVAL ( QS ) energy [hartree]   -17.xxxxxxxxxx`,
          },
          {
            type: "p",
            text: "这行之前的 `SCF run converged in N steps` 说明自洽场迭代成功；如果看到 `SCF run NOT converged`，先别往下做——结果不可用。文件末尾的 `CP2K ENDED` 与 timing 表说明程序正常退出；如果中途 MPI 报错，通常根本走不到这里。",
          },
          {
            type: "table",
            head: ["在输出里搜", "含义", "正常值"],
            rows: [
              ["`SCF run converged`", "SCF 是否收敛", "出现，且步数 < MAX_SCF"],
              ["`Total FORCE_EVAL`", "总能量（Hartree）", "一个负数，量级 −17 Ha"],
              ["`CP2K ENDED`", "程序是否正常结束", "出现"],
              ["`ABORT` / `ERROR`", "是否异常", "不应出现"],
              ["`CP2K    1  ...` 计时表", "各阶段耗时", "用于性能对比"],
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "能量绝对值不是重点",
            text: "单点能没有「标准答案」，它依赖基组、赝势、泛函和截断能。有意义的是**同一方法下的能量差**（结合能、反应能、势垒）。所以第一次跑通后，不要纠结 −17.2 还是 −17.3，而要做截断能收敛测试（第 6 章）。",
          },
          {
            type: "demo",
            id: "grid",
            title: "动手：截断能如何影响网格",
            desc: "拖动 CUTOFF 与 REL_CUTOFF，看高斯函数被分配到哪一层网格。本例的 400/50 是一个合理起点。",
          },
        ],
      },
      {
        id: "3.5",
        title: "第一次运行最可能遇到的四个错误",
        blocks: [
          {
            type: "p",
            text: "下面四个报错覆盖了新手 90% 的失败。看到红字先对照，不要急着重装。",
          },
          {
            type: "table",
            head: ["报错关键词", "原因", "修法"],
            rows: [
              ["`BASIS_MOLOPT` not found / Could not open file", "数据文件不在搜索路径", "用绝对路径，或设置 `CP2K_DATA_DIR`，或把文件复制到工作目录"],
              ["`PERIODIC` mismatch / Poisson solver", "&CELL 与 &POISSON 的周期性设置不一致", "两处都写 `PERIODIC NONE`（分子）或都改为 XYZ（晶体）"],
              ["`Number of valence electrons` / q 值错误", "KIND 里的赝势 q 值与元素不匹配", "查 GTH_POTENTIALS 文件里该元素的 q 值，如 O 用 q6、H 用 q1"],
              ["`SCF run NOT converged`", "初始猜测差、混合参数不合适、体系难收敛", "先增大 MAX_SCF，再按第 9 章调 &SCF；必要时加 smearing"],
            ],
          },
          {
            type: "callout",
            kind: "danger",
            title: "别用 ENERGY 任务做几何优化",
            text: "`RUN_TYPE ENERGY` 只算能量和力，不会移动原子。想优化结构必须改成 `GEO_OPT`，并在 `&FORCE_EVAL` 下加 `&MOTION`。第 11 章有完整模板。",
          },
          {
            type: "p",
            text: "还有一个隐蔽的坑：**PROJECT 重名**。同一目录下两次计算都用 `PROJECT h2o`，第二次启动时 CP2K 可能读到旧的 restart 文件，行为和你以为的不一样。养成习惯：每个任务一个目录，或每次换 PROJECT 名。",
          },
        ],
      },
      {
        id: "3.6",
        title: "这一章之后，你应该能",
        blocks: [
          {
            type: "keypoints",
            items: [
              "从零写出一个 40 行的 CP2K 输入文件，并知道每一层在管什么",
              "用 `cp2k.psmp -i ... -o ...` 运行，并在输出里定位能量、SCF 收敛与结束标志",
              "解释 CUTOFF、REL_CUTOFF、PERIODIC、KIND 四个关键词的作用",
              "在遇到文件缺失、周期性冲突、q 值错误、SCF 不收敛时，知道先查哪里",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一步",
            text: "先别急着换体系。把这份输入里的 `RUN_TYPE` 改成 `GEO_OPT` 跑一遍，看水分子几何怎样微调——这会逼你读第 11 章，也会让你第一次感受到「力」在计算里长什么样。",
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "动手：生成你自己的输入",
            desc: "换元素、换任务、换泛函，生成一份结构合法、可直接保存运行的输入文件。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "`RUN_TYPE ENERGY` 的计算会做什么？",
        options: [
          "优化原子位置直到力收敛",
          "只计算给定几何下的电子能量与力，不移动原子",
          "计算振动频率",
          "生成分子动力学轨迹",
        ],
        answer: 1,
        explain: "ENERGY 是单点计算：固定原子核，解 Kohn–Sham 方程得到能量与力。几何优化要用 GEO_OPT，频率要用 VIBRATIONAL_ANALYSIS。",
      },
      {
        q: "这个水分子例子为什么要同时写 `&CELL ... PERIODIC NONE` 和 `&POISSON ... PERIODIC NONE`？",
        options: [
          "两处都是可选的装饰",
          "前者定义盒子，后者告诉泊松求解器体系非周期；两者必须一致",
          "PERIODIC 只影响输出格式",
          "为了让计算更慢但更准",
        ],
        answer: 1,
        explain: "&CELL 的周期性决定体系拓扑，&POISSON 的周期性决定静电边界条件。对孤立分子两者都应为 NONE；晶体则都应为 XYZ（或相应方向）。",
      },
      {
        q: "`GTH-PBE-q6` 里的 `q6` 表示什么？",
        options: [
          "基组有 6 个函数",
          "该赝势显式处理 6 个价电子",
          "计算使用 6 个 MPI 进程",
          "截断能是 6 Ry",
        ],
        answer: 1,
        explain: "GTH 赝势名里的 q 值是价电子数。氧的 q6 表示 1s²2s²2p⁴ 共 6 个电子显式处理；氢是 q1。q 值与元素、基组必须匹配。",
      },
      {
        q: "在 `h2o.out` 里看到 `SCF run NOT converged`，最合理的下一步是？",
        options: [
          "直接使用这次的能量，反正只差一点",
          "把 CUTOFF 改成 1000 再说",
          "先增大 MAX_SCF 并检查初始猜测/混合参数，必要时按第 9 章调整",
          "删除输出文件重跑一次",
        ],
        answer: 2,
        explain: "未收敛的能量不可用。先给 SCF 更多步数，再检查体系是否难收敛（金属、开壳层、大体系），按第 9 章调 &SCF 或改用 OT。",
      },
      {
        q: "为什么不同计算不要共用同一个 `PROJECT` 名？",
        options: [
          "CP2K 会拒绝启动",
          "restart、轨迹、输出等文件会互相覆盖或误读",
          "PROJECT 名必须含元素符号",
          "会影响泛函选择",
        ],
        answer: 1,
        explain: "PROJECT 决定输出与中间文件前缀。同名会让新计算读到旧 restart，或覆盖旧结果。一个任务一个目录、一个 PROJECT 是最省心的做法。",
      },
    ],
    terms: [
      { t: "单点能", en: "single-point energy", d: "固定原子核位置，只求解电子结构的计算，输出总能量与力。" },
      { t: "GPW", en: "Gaussian and Plane Waves", d: "CP2K 的核心方法：高斯基组描述波函数，平面波辅助网格处理密度与势。" },
      { t: "赝势", en: "pseudopotential", d: "用有效势替代内层电子，只显式处理价电子，大幅降低计算量。" },
      { t: "基组", en: "basis set", d: "把分子轨道展开成原子中心函数的集合；基组越大越灵活，也越贵。" },
      { t: "自洽场", en: "SCF", d: "因为 Kohn–Sham 势依赖电子密度，需要迭代求解直到输入输出密度一致。" },
      { t: "截断能", en: "cutoff", d: "平面波辅助网格能表示的最高动能，单位 Ry；越大网格越细、越贵。" },
    ],
    sources: [
      { t: "Run a First Calculation", url: "https://manual.cp2k.org/trunk/getting-started/first-calculation.html" },
      { t: "Gaussian Plane Wave (GPW)", url: "https://manual.cp2k.org/trunk/methods/dft/gpw.html" },
      { t: "How to Converge the CUTOFF and REL_CUTOFF", url: "https://manual.cp2k.org/trunk/methods/dft/cutoff.html" },
      { t: "Basis Sets", url: "https://manual.cp2k.org/trunk/methods/dft/basis_sets.html" },
      { t: "Pseudopotentials", url: "https://manual.cp2k.org/trunk/methods/dft/pseudopotentials.html" },
    ],
  };
})();