(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch01"] = {
    id: "ch01",
    num: 1,
    part: "起步",
    title: "认识 CP2K：方法版图与能力边界",
    subtitle: "先弄清它能做什么、为什么快、什么时候该换工具",
    hours: 3.0,
    level: "入门",
    intro:
      "CP2K 常被当成「另一个 VASP」或「免费版 Gaussian」，这两种理解都会让你在错误的体系上浪费机时。这一章先建立地图：它由哪些方法组成，快在哪里，代价是什么，哪些任务应该交给别的程序。地图清楚之后，第 2 章的 AIMD 原理和第 3 章的安装才有落点。",
    goals: [
      "把课程五讲映射到本站十五章，知道自己现在该读哪一节",
      "用一句话说清 Quickstep 与 GPW 的关系，并列出 CP2K 的五类方法",
      "解释「速度—精度—尺度」三角，说明 CP2K 快在哪、代价是什么",
      "判断一个课题该用 CP2K 还是 VASP，能说出至少三条依据",
      "认出 ssmp、popt、psmp 三种二进制与常见依赖库的作用",
    ],
    sections: [
      {
        id: "1.1",
        title: "从五讲课程到十五章：先看完整地图",
        blocks: [
          {
            type: "p",
            text: "这套内容来自五讲课程：第一讲 AIMD 基础与 VASP 对照，第二讲 CP2K 简介、编译与建模，第三讲基组、赝势、输出、优化与过渡态，第四讲频率、AIMD 详解、DFT+U、磁性、杂化、电子结构与 TRAVIS，第五讲 PMF、blue-moon、slow-growth 与 metadynamics。课程是主线，手册是查证工具。",
          },
          {
            type: "table",
            head: ["课程", "讲什么", "对应本站"],
            rows: [
              ["第一讲", "势能面、系综、时间步、VASP AIMD 参数、后处理", "第 2 章打原理，第 11 章做实战，第 13 章做分析"],
              ["第二讲", "CP2K 能力、编译、计算流程、建模", "第 1 章认版图，第 3 章装起来，第 4–5 章写输入与建模"],
              ["第三讲", "基组赝势坐标、输出、几何优化、过渡态", "第 4–5 章，第 9 章"],
              ["第四讲", "频率、AIMD、DFT+U/磁性/杂化、电子结构、TRAVIS、自由能", "第 7–8 章，第 10–13 章"],
              ["第五讲", "PMF、blue-moon、slow-growth、metadynamics", "第 12 章"],
            ],
            caption: "五讲是「课」，十五章是「书」：同一批知识点被拆成可以按需查阅的模块。",
          },
          {
            type: "p",
            text: "全站分六部分：**起步**（第 1–3 章）、**输入与体系**（第 4–5 章）、**电子结构**（第 6–8 章）、**结构与振动**（第 9–10 章）、**动力学与自由能**（第 11–12 章）、**分析与实战**（第 13–15 章）。你现在读的是第一部分，目标不是算出一个结果，而是知道每个旋钮在哪、为什么存在。",
          },
          {
            type: "steps",
            items: [
              { t: "第 1–3 章：建立地图并装好", d: "认识方法版图与边界，理解 AIMD 的基本量，得到一个能跑的二进制。读完只能跑通，不能保证算对。" },
              { t: "第 4–5 章：把体系变成输入", d: "输入树、坐标、基组、赝势、盒子与表面。这一部分决定你的模型是否代表真实体系。" },
              { t: "第 6–8 章：把电子结构算对", d: "CUTOFF 与网格、泛函与色散、DFT+U 与磁性、SCF 的 OT/对角化/展宽。" },
              { t: "第 9–10 章：结构与振动", d: "几何与晶胞优化、过渡态、频率、热化学与 TRAVIS 光谱。" },
              { t: "第 11–12 章：动力学与自由能", d: "AIMD 实战、恒温器与重启、PMF、metadynamics。" },
              { t: "第 13–15 章：分析与发表", d: "轨迹与电子结构分析、表面/水/QM-MM 案例、可复现的发表级工作流。" },
            ],
          },
        ],
      },
      {
        id: "1.2",
        title: "CP2K 是什么：一个程序，三种身份",
        blocks: [
          {
            type: "p",
            text: "一句话：CP2K 是一个以 **Quickstep** 模块为核心、用 **GPW**（Gaussian and Plane Waves）做第一性原理计算的原子模拟程序。它用 Fortran 2008 写成，支持 MPI、OpenMP 以及 CUDA/HIP 加速，开源且不需要注册。",
          },
          {
            type: "p",
            text: "名字容易误导：CP 指 Car–Parrinello，2K 指 2000 年。但原始的 CPMD 表述**并没有实现**，CP2K 实际主用的是 **BOMD**（Born–Oppenheimer MD）。手册在 Foreword 里明确写了这一点，读旧文献时要留意。",
          },
          {
            type: "table",
            head: ["身份", "代表能力", "你会在哪一章用到"],
            rows: [
              ["电子结构程序", "DFT（LDA/GGA/meta/杂化）、MP2/RPA 等后 HF、DFTB、半经验（AM1/PM3/PM6/RM1/MNDO）", "第 6–8 章"],
              ["动力学引擎", "BOMD、Ehrenfest dynamics、Monte Carlo、metadynamics、振动分析", "第 2、11、12 章"],
              ["多尺度平台", "QM/MM、QM/ML、隐式溶剂、经典力场（AMBER/CHARMM）", "第 14 章"],
            ],
            caption: "同一个 MD 驱动可以接不同 FORCE_EVAL：力场、ML 势、半经验、QM/MM 或 AIMD。",
          },
          {
            type: "p",
            text: "这三种身份共用一套输入树和一套轨迹输出。好处是换方法只换 `FORCE_EVAL` 里的几段；代价是输入树很深，同一个关键词在不同方法下的含义需要分别确认。手册的 Input Reference 就是为后者准备的。",
          },
          {
            type: "callout",
            kind: "info",
            title: "先记住两个词",
            text: "**Quickstep** 是 CP2K 里做 DFT 的那个模块；**GPW** 是它把高斯基组和平面波网格拼起来的方法。后面看到「用 Quickstep 算」「GPW 级别」，说的都是同一件事：DFT 框架下的电子结构计算。",
          },
        ],
      },
      {
        id: "1.3",
        title: "方法版图：从力场到后 HF，各自站在哪一格",
        blocks: [
          {
            type: "p",
            text: "把方法排成一条线，横轴是精度，纵轴是能算多大、多久。CP2K 的覆盖面很宽，但不是每一格都同样成熟。下表按「常见用途」排，不按代码年资排。",
          },
          {
            type: "table",
            head: ["层级", "方法", "能算什么", "代价与限制"],
            rows: [
              ["经典", "AMBER/CHARMM 力场", "大体系构象、液体、生物分子", "不能描述断键；参数决定一切"],
              ["机器学习", "ML 势（外部接口）", "接近 DFT 精度的大规模 MD", "需要训练集；外推有风险"],
              ["半经验/DFTB", "AM1、PM3、PM6、RM1、MNDO、DFTB", "大体系预筛、定性趋势", "精度有限；元素覆盖与参数要查"],
              ["GGA/meta", "PBE、PBEsol、rVV10 等", "常规固体、表面、液体 AIMD", "带隙低估；强关联体系需 +U"],
              ["杂化", "PBE0、HSE06、B3LYP 等", "带隙、反应能、缺陷", "HFX 很贵，需 ADMM/RI 与更多内存"],
              ["后 HF", "MP2、RPA", "弱相互作用、参考能量", "标度更高，只适合小体系"],
            ],
            caption: "CP2K 的强项在中间三层：GGA/meta 的大体系 AIMD，以及杂化的可行性优化。",
          },
          {
            type: "p",
            text: "所谓「速度—精度—尺度」三角，意思是三者不能同时拉满：选定方法和体系大小，精度与时间就被绑定；想更快，只能降精度、缩体系或换算法。CP2K 的设计选择是：**用高斯基组换小基组尺寸，用平面波网格换精确的静电与泊松求解，再用 OT 与稀疏矩阵把标度压下来**。",
          },
          {
            type: "formula",
            tex: "\\text{cost} \\;\\propto\\; N_{\\text{atom}} \\times N_{\\text{SCF}} \\times N_{\\text{step}}",
            caption: "AIMD 的总开销是三者相乘：体系、每步 SCF、步数。任何一项翻倍，机时都翻倍。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "方法层级不是「越高越好」",
            text: "用杂化泛函跑 500 原子 100 ps 的 AIMD，通常不是精度高，而是算不完。先问「这个课题需要什么精度」，再选方法；手册和课程里的 benchmark 是依据，不是装饰。",
          },
        ],
      },
      {
        id: "1.4",
        title: "为什么快：GPW、赝势、OT 与 ASPC",
        blocks: [
          {
            type: "p",
            text: "CP2K 的速度不是靠某一行代码，而是四个设计叠在一起。理解它们，你才知道调参时该动哪里、什么时候会失效。",
          },
          {
            type: "list",
            items: [
              "**GPW**：波函数与密度用高斯基组展开，密度在平面波网格上表示。矩阵元用高斯积分解析算，静电与泊松方程用 FFT 在网格上解。",
              "**GTH 赝势 + 价电子基组**：只显式处理价电子，芯电子被赝势吸收；MOLOPT 基组为气相/凝聚相分子优化，基组数量比全电子少得多。",
              "**OT（Orbital Transformation）**：直接对轨道旋转做能量最小化，不解广义本征值问题，绝缘体体系可做到线性标度。",
              "**ASPC 外推**：用前几步的电子密度外推下一步的初始猜测，减少每步 SCF 迭代；这是 AIMD 能跑长的关键之一。",
            ],
          },
          {
            type: "p",
            text: "代价也随之而来。GPW 需要 `CUTOFF` 足够大才能把密度网格收敛；赝势意味着芯电子效应被近似；OT 要求体系有带隙，金属和小带隙体系会退化甚至失败；外推假设轨迹连续，体系发生突变时会失效。这些不是 bug，而是方法本身的前提。",
          },
          {
            type: "table",
            head: ["机制", "带来的好处", "什么时候会反噬"],
            rows: [
              ["高斯基组", "基组小、矩阵元解析、适合分子与液体", "BSSE；结合能需要 counterpoise"],
              ["平面波网格", "泊松求解精确、FFT 高效、易并行", "CUTOFF 不足时力有噪声；大盒子网格点数暴涨"],
              ["GTH 赝势", "只算价电子，元素覆盖广", "芯极化/相对论效应需选对赝势"],
              ["OT", "无需对角化，大体系近线性", "金属、小带隙、占据数展宽场景不适用"],
              ["ASPC", "每步 SCF 迭代显著减少", "轨迹不连续、反应事件附近会拖慢或跳变"],
            ],
            caption: "速度的来源同时定义了失效边界。调参之前先确认自己还在前提之内。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "性能问题的第一问",
            text: "先看输出里的 SCF 迭代次数与每步耗时，再决定是调 `CUTOFF`、换 OT/对角化，还是加并行。盲目加核数经常只是把内存打满，不会让 SCF 变快。",
          },
        ],
      },
      {
        id: "1.5",
        title: "能力边界：这五件事不要硬上",
        blocks: [
          {
            type: "p",
            text: "这一节列的是课程里反复强调、也最容易被忽略的限制。它们不是「CP2K 不好」，而是「工具与方法不匹配」。",
          },
          {
            type: "compare",
            left: {
              title: "适合 CP2K 的任务",
              items: [
                "有带隙的分子、液体、表面、固体，做 AIMD 或优化",
                "需要 0D–3D 任意周期性组合的体系",
                "QM/MM、隐式溶剂、团簇与界面",
                "大体系 GGA/meta 的长时间 BOMD",
                "同一套输入里做 DFT、性质分析与增强采样",
              ],
            },
            right: {
              title: "换工具更省事的任务",
              items: [
                "金属、强关联小带隙体系的大规模 MD（OT 不适用）",
                "密集 k 点、能带、声子、DFPT（支持有限）",
                "需要程序自动寻找磁矩与自旋态",
                "以 BSSE 敏感的结合能为唯一目标",
                "Car–Parrinello MD（原始表述未实现）",
              ],
            },
          },
          {
            type: "h3",
            text: "边界一：导体与 OT",
          },
          {
            type: "p",
            text: "OT 的原理建立在「占据轨道与空轨道之间有明确间隙」上。金属没有这个间隙，OT 会不收敛或给出错误占据。此时要改用对角化并加展宽（smearing），代价是每步更贵、并行扩展性更差。课程的原话是「对导体慢」，原因就在这里。",
          },
          {
            type: "h3",
            text: "边界二：k 点与能带",
          },
          {
            type: "p",
            text: "k 点采样只在 QUICKSTEP 的部分功能里支持，而且仍在活跃开发。做金属、能带、声子之前，先查手册对应页面，确认你要的组合被支持；不要拿「CP2K 也能算固体」推断「CP2K 能算声子」。",
          },
          {
            type: "h3",
            text: "边界三：磁性要自己指定",
          },
          {
            type: "p",
            text: "CP2K 不会像 VASP 那样在默认设置下自动尝试磁矩。你需要打开 `UKS`、给定 `MULTIPLICITY`，并保证初始结构/初始磁矩落在想要的势能面上。铁磁、反铁磁、高低自旋，都是不同的计算，不会自动切换。",
          },
          {
            type: "h3",
            text: "边界四：BSSE",
          },
          {
            type: "p",
            text: "高斯基组有基组重叠误差（BSSE）。算分子间结合能、吸附能时，碎片基组不完备会让结合能被高估。标准做法是 counterpoise 校正，或改用平面波程序交叉验证。课程明确把「高斯基组 BSSE 大，不适合直接算结合能」列为 CP2K 的短板。",
          },
          {
            type: "h3",
            text: "边界五：时间尺度",
          },
          {
            type: "p",
            text: "AIMD 的现实尺度通常是皮秒量级，条件好时才能到纳秒，不是微秒。一个需要数小时才能在实验里发生的反应，靠直接 AIMD 通常等不到；这类问题要么用增强采样（第 12 章），要么先用静态势能面与过渡态估算速率。",
          },
        ],
      },
      {
        id: "1.6",
        title: "与 VASP 的分工：同一课题怎么选",
        blocks: [
          {
            type: "p",
            text: "课程用 VASP 讲 AIMD 参数，再用 CP2K 做同样的任务，这个安排本身就说明两者是互补关系。下面按「实际差异」列，不按程序名气列。",
          },
          {
            type: "table",
            head: ["维度", "CP2K", "VASP"],
            rows: [
              ["基组", "高斯型基组 + 平面波辅助网格（GPW）", "平面波 + PAW/赝势"],
              ["周期性", "0D、1D、2D、3D 统一支持", "3D；表面用 slab + 真空"],
              ["磁性", "需显式 UKS、MULTIPLICITY、初始磁矩", "给初始磁矩后收敛到附近的自旋解"],
              ["k 点", "部分功能支持，仍在开发", "成熟，固体/金属工作流完整"],
              ["AIMD 成本", "有带隙的分子/液体通常更快", "金属与密集 k 点更稳"],
              ["BSSE", "有，结合能需校正", "平面波基组基本没有"],
              ["内置增强采样", "metadynamics、QM/MM、约束 MD", "基础 MD，增强采样多靠外部工具"],
            ],
            caption: "差异的根源是基组与周期性实现，不是「谁更先进」。",
          },
          {
            type: "p",
            text: "课程举过一个很典型的分工：同一项工作里，**AIMD 用 CP2K，相对能与态密度用 VASP**。原因不是偏好，而是 CP2K 跑长轨迹更省，VASP 做平面波固体性质更成熟。选型时先问三个问题：体系有带隙吗？需要密集 k 点吗？磁性是主角吗？",
          },
          {
            type: "steps",
            items: [
              { t: "第一问：有带隙、以 MD 为主", d: "优先 CP2K。液体、分子、表面吸附、界面反应，OT + ASPC 的优势明显。" },
              { t: "第二问：金属、小带隙、强关联", d: "优先 VASP 或别的平面波程序；CP2K 需要对角化 + 展宽，成本高且更容易出问题。" },
              { t: "第三问：能带、声子、k 点网格", d: "优先 VASP/QE。CP2K 的 k 点支持不完整，不要用它硬做。" },
              { t: "第四问：磁性是核心变量", d: "VASP 更省心；CP2K 可以算，但你要自己枚举自旋态并验证收敛到哪一个。" },
              { t: "第五问：结合能精度", d: "两者交叉验证。CP2K 做 counterpoise，VASP 做平面波极限，结论一致才可信。" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "不要用「哪个快」当唯一标准",
            text: "同一个体系，CP2K 可能快一些，但如果它算错了磁性，这点速度毫无意义。先确认方法在目标性质上可信，再比较机时。",
          },
        ],
      },
      {
        id: "1.7",
        title: "版本、二进制与生态：装之前先认清",
        blocks: [
          {
            type: "p",
            text: "CP2K 的版本号、编译方式和依赖库会直接影响你能用哪些功能。课程录制时用的是 6.1 与 7.1，手册现在对应 2026.x，差异不小，先把坐标对齐。",
          },
          {
            type: "table",
            head: ["时期", "版本形态", "构建方式", "要注意"],
            rows: [
              ["课程环境", "6.1、7.1", "GNU Make + ARCH 文件", "预编译包多为 ssmp；arch 模板需按机器改"],
              ["过渡期", "2023.1–2025.2（年份式版本号）", "仍以 ARCH 为主", "老教程大多落在这里"],
              ["当前手册", "2026.1 起", "CMake；2026.1 需手工配置", "ARCH 已弃用，旧命令不能照抄"],
              ["当前稳定", "2026.2 及以后", "CMake + `build_cp2k.sh` / `make_cp2k.sh`", "用 release tarball，不要用自动生成的源码包"],
            ],
            caption: "版本差异不只是数字：构建系统换代会让一半旧命令失效。",
          },
          {
            type: "p",
            text: "三个二进制名字经常让人困惑，它们不是「版本高低」，而是并行模型不同：",
          },
          {
            type: "table",
            head: ["二进制", "并行方式", "适用场景", "限制"],
            rows: [
              ["cp2k.ssmp", "仅 OpenMP（单进程多线程）", "单节点、快速上手、预编译包", "不能跨节点；课程实测效率比正常编译低约 30%–50%"],
              ["cp2k.popt", "仅 MPI", "跨节点，纯 MPI 布局", "每进程内存开销大；线程利用不足"],
              ["cp2k.psmp", "MPI + OpenMP 混合", "正式生产，跨节点 + 多线程", "需正确设置 `OMP_NUM_THREADS` 与进程绑定"],
            ],
            caption: "名字里的 s/p 指 SMP 与 MPI；选错二进制，后面的调参都是白费。",
          },
          {
            type: "p",
            text: "依赖库里最常被问到的是四个：**ELPA**（本征求解器，编译进来后通常是默认对角化库）、**libxsmm**（小矩阵乘）、**libxc**（泛函库）、**libint**（杂化的 HFX 积分）。此外还有 ScaLAPACK、COSMA、SpLA、DBCSR，以及 CUDA/HIP 后端。装的时候不是越多越好：每加一个库，就多一个版本匹配问题。",
          },
          {
            type: "p",
            text: "许可证是 **GPLv2 或更高版本**，可以自由使用与修改；引用则按手册要求，至少引三篇综述：Kühne2020（理论与算法）、Luber2025（激发态/光谱/非绝热）、Iannuzzi2026（实用与案例），再补上你所用方法对应的原始文献。输出末尾的 REFERENCES 就是现成清单。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "别拿 trunk 手册配 6.1 二进制",
            text: "手册 trunk 对应当前开发版，关键词的默认值会随版本变化。生产环境请用与二进制同版本的旧手册；查不到时，以 `cp2k -v` 的版本号和输出里的实际默认值为准。",
          },
        ],
      },
      {
        id: "1.8",
        title: "本站怎么用：主线、手册与关键词三条路",
        blocks: [
          {
            type: "p",
            text: "这一站不是把手册翻译一遍，而是把「课程的主线」和「手册的准确性」接起来。每章末尾的 sources 指向手册原文，正文只做取舍与串联。",
          },
          {
            type: "list",
            items: [
              "**主线**：按第 1→15 章顺序读。每章先给可运行的输入或命令，再解释参数；读完能复现，才算过关。",
              "**手册参考**：每节末尾的来源链接直达 manual.cp2k.org。查默认值、查某个关键词属于哪个 section，都以手册为准。",
              "**关键词速查**：站内关键词表按 `&SECTION/KEYWORD` 索引，适合已经知道要改什么、只忘了拼写或默认值的场景。",
            ],
          },
          {
            type: "p",
            text: "读的时候保持一个习惯：任何「更快」的建议，都要能回答「代价是什么」。下面四条命令是这一章唯一需要动手的部分，用来确认你面对的是哪个 CP2K。",
          },
          {
            type: "code",
            lang: "bash",
            title: "先认清手上的二进制",
            text: `# 版本、编译选项、并行后端
cp2k.psmp -v

# 看它链接了哪个 MPI、哪个数学库、有没有 ELPA
ldd "$(command -v cp2k.psmp)" | grep -Ei 'mpi|mkl|openblas|scalapack|elpa|xsmm'

# 机器有多少核，决定 OMP_NUM_THREADS 的上限
nproc`,
          },
          {
            type: "p",
            text: "第一条命令会打印版本号与 `cp2kflags`，后者告诉你这个二进制带没带 libint、ELPA、ScaLAPACK、CUDA。第二条命令能立刻暴露「mpirun 与二进制不是同一套 MPI」这个最常见的事故。第三条决定你能开多少线程，但线程数不等于核数，第 3 章会讲怎么排布。",
          },
          {
            type: "code",
            lang: "bash",
            title: "跑一个计算，并确认它真的结束",
            text: `cp2k.psmp -i h2o.inp -o h2o.out

# 正常结束的标志
grep -n "PROGRAM ENDED AT" h2o.out

# 总能量（不同方法的关键词可能不同，先确认再取值）
grep -n "Total energy" h2o.out | tail -5`,
          },
          {
            type: "p",
            text: "「进程退出码为 0」不等于「计算成功」。CP2K 正常结束会打印 `PROGRAM ENDED AT`；如果只看到 `ABORT`、`CPASSERT failed` 或输出在半截停住，就要按第 3 章的排错表定位。",
          },
          {
            type: "code",
            lang: "bash",
            title: "三种并行布局，对应三个二进制",
            text: `# 单节点：ssmp + 多线程（课程示例是 28 核节点）
export OMP_NUM_THREADS=28
./cp2k-6.1-Linux-x86_64.ssmp -i h2o.inp -o h2o.ssmp.out

# 纯 MPI：popt，跨节点
mpirun -np 32 cp2k.popt -i h2o.inp -o h2o.popt.out

# 混合：psmp，8 进程 × 4 线程 = 32 核
mpirun -np 8 -x OMP_NUM_THREADS=4 cp2k.psmp -i h2o.inp -o h2o.psmp.out`,
          },
          {
            type: "p",
            text: "三种布局算的是同一个输入，输出应当一致到数值误差范围内。如果 psmp 的结果与 ssmp 明显不同，先怀疑并行布局或 `CUTOFF`/SCF 收敛，而不是物理。第 3 章会给完整的提交脚本与核数估算。",
          },
          {
            type: "code",
            lang: "bash",
            title: "引用信息就在输出末尾",
            text: `# 手册要求引用方法对应的文献，输出里已经列好
grep -n -A 40 "REFERENCES" h2o.out | head -50`,
          },
          {
            type: "keypoints",
            items: [
              "CP2K 的核心是 Quickstep + GPW；主用 BOMD，原始 CPMD 并未实现",
              "它的强项是有带隙体系的大体系 DFT、AIMD、QM/MM 与增强采样",
              "速度来自 GPW、赝势、OT、ASPC；失效边界也来自这四件事",
              "金属/密集 k 点/自动磁性/BSSE 敏感的结合能，应优先考虑 VASP 或交叉验证",
              "ssmp 只能单节点，popt 是纯 MPI，psmp 是 MPI+OpenMP；装之前先认清",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一章做什么",
            text: "地图有了，下一步是理解 AIMD 这台机器怎么转：势能面、系综、时间步、恒温器，以及 VASP 与 CP2K 的参数如何一一对应。第 2 章不写长输入，只把「每一步发生了什么」讲清楚。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "CP2K 里负责 DFT 计算的核心模块是哪一个？",
        options: ["CPMD", "Quickstep", "DBCSR", "libint"],
        answer: 1,
        explain: "Quickstep 是 CP2K 的 DFT 模块；DBCSR 是稀疏矩阵库，libint 是积分库，CPMD 是另一套程序与表述。",
      },
      {
        q: "关于 CP2K 的 OT 方法，下面哪条说法正确？",
        options: [
          "它通过解广义本征值问题得到轨道",
          "它适合金属，因为不需要带隙",
          "它直接做轨道旋转的能量最小化，要求体系有带隙",
          "它只能用于 QM/MM",
        ],
        answer: 2,
        explain: "OT 避开对角化，直接最小化能量，因此适合绝缘体/半导体；金属和小带隙体系会失效，需要改用对角化与展宽。",
      },
      {
        q: "课程把哪一项列为 CP2K 相对 VASP 的明显短板？",
        options: [
          "不能做周期性计算",
          "高斯基组带来 BSSE，结合能需校正",
          "不能做分子动力学",
          "不支持任何泛函",
        ],
        answer: 1,
        explain: "CP2K 用高斯基组，BSSE 明显；VASP 的平面波基组基本没有这个问题。周期性、MD、泛函支持都不是短板。",
      },
      {
        q: "ssmp、popt、psmp 三种二进制的主要区别是什么？",
        options: [
          "支持的泛函数量不同",
          "并行模型不同：OpenMP、MPI、MPI+OpenMP",
          "支持的体系维度不同",
          "版本新旧不同",
        ],
        answer: 1,
        explain: "三者是同一套代码的不同并行构建：ssmp 仅 OpenMP（单节点），popt 仅 MPI，psmp 是 MPI+OpenMP 混合。",
      },
      {
        q: "下面哪种任务最应该优先考虑 VASP 而不是 CP2K？",
        options: [
          "水盒子 100 ps 的 NVT AIMD",
          "金属表面的密集 k 点与声子",
          "蛋白质活性中心的 QM/MM",
          "分子在 2D 材料上的吸附构型优化",
        ],
        answer: 1,
        explain: "金属、密集 k 点、声子/DFPT 是 VASP 的成熟区；CP2K 的 k 点支持不完整，金属还会让 OT 失效。",
      },
    ],
    terms: [
      { t: "Quickstep", en: "Quickstep", d: "CP2K 的 DFT 模块，采用 GPW 方案，是绝大多数电子结构计算的入口。" },
      { t: "GPW", en: "Gaussian and Plane Waves", d: "高斯基组展开波函数与密度、平面波网格处理密度与静电的方法组合。" },
      { t: "OT", en: "Orbital Transformation", d: "直接对轨道旋转做能量最小化的方法，避免对角化，适合有带隙体系。" },
      { t: "ASPC", en: "Always Stable Predictor–Corrector", d: "用历史电子密度外推下一步初始猜测，减少 AIMD 每步 SCF 迭代。" },
      { t: "BSSE", en: "Basis Set Superposition Error", d: "高斯基组不完备导致的结合能高估，需 counterpoise 校正。" },
      { t: "GTH 赝势", en: "Goedecker–Teter–Hutter pseudopotential", d: "CP2K 常用的模守恒赝势，只显式处理价电子。" },
      { t: "psmp", en: "MPI + OpenMP build", d: "同时使用 MPI 进程与 OpenMP 线程的构建，适合跨节点生产计算。" },
    ],
    sources: [
      { t: "CP2K Manual · 首页", url: "https://manual.cp2k.org/trunk/index.html" },
      { t: "Foreword and FAQ（名称、BOMD、PBC、k 点、引用）", url: "https://manual.cp2k.org/trunk/getting-started/foreword-and-faq.html" },
      { t: "Methods · Density Functional Theory", url: "https://manual.cp2k.org/trunk/methods/dft/index.html" },
      { t: "GPW 方法说明", url: "https://manual.cp2k.org/trunk/methods/dft/gpw.html" },
      { t: "Input Reference · GLOBAL（RUN_TYPE 等）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/GLOBAL.html" },
    ],
  };
})();