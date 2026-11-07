(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch04"] = {
    id: "ch04",
    num: 4,
    part: "输入与体系",
    title: "输入文件与计算流程",
    subtitle: "从一份 .inp 到 CP2K 输出：语法、四层结构、RUN_TYPE、提交与重启",
    hours: 2.5,
    level: "入门",
    intro:
      "CP2K 的输入文件是一棵用 & 开头的节点树：GLOBAL 说「做什么」，FORCE_EVAL 说「用什么方法算」，SUBSYS 说「算谁」，MOTION 说「怎么动」。这一章把这四层拆开，用水的单点能把整条链跑通——你将会写输入、提交任务、在输出里找到能量、判断算没算成，并且知道中断之后怎么接着算。",
    goals: [
      "写出一份段落配对、单位明确、能被 CP2K 完整读入的输入文件",
      "说清 GLOBAL / FORCE_EVAL / SUBSYS / MOTION 四层各管什么，以及 DFT 挂在哪一层",
      "按任务类型选对 RUN_TYPE，并用对应的小节给它配上参数",
      "用 grep 在输出里确认 SCF 收敛、拿到总能量，并能从 restart 文件续算",
    ],
    sections: [
      {
        id: "4.1",
        title: "一次计算，从输入到结果经过什么",
        blocks: [
          {
            type: "p",
            text: "一次 CP2K 计算只做一件事：读一份文本输入，算出一个数（能量、力、轨迹、谱）。中间会产生一批文件，认清它们的名字和用途，比记住参数更重要——出问题时你第一眼要看的就是它们。",
          },
          {
            type: "steps",
            items: [
              { t: "准备输入", d: "写 .inp；把基组、赝势文件（BASIS_MOLOPT、GTH_POTENTIALS）放在当前目录或写绝对路径；坐标可以在输入里，也可以在单独的 .xyz / .cif 文件里。" },
              { t: "启动程序", d: "选一个二进制（ssmp / popt / psmp），用 -i 指定输入、-o 指定输出；标准输出和标准错误也各自重定向到文件。" },
              { t: "建网格、迭代 SCF", d: "QUICKSTEP 先按 &MGRID 构造多级实空间网格，再由初始猜测出发迭代 Kohn–Sham 方程，直到密度变化小于 EPS_SCF。" },
              { t: "写结果", d: "屏幕/输出文件里给出能量与受力；同时写出 .ener 能量表、-pos-1.xyz 轨迹、-1.restart 重启文件、RESTART.wfn 波函数。" },
              { t: "后处理", d: "用 grep/脚本抽能量，用 VMD、Jmol、OVITO 看结构，用 Python 算 RDF、MSD 等。" },
            ],
          },
          {
            type: "table",
            head: ["文件", "内容", "什么时候看"],
            rows: [
              ["h2o.inp", "你写的输入，全部参数都在这里", "改参数、复现计算"],
              ["h2o.out", "完整日志：版本、并行布局、SCF 表、能量、受力、计时", "判断成败、找报错"],
              ["h2o-1.ener", "每一步离子步的总能量，纯数字两列", "画能量曲线、看优化收敛"],
              ["h2o-pos-1.xyz", "每一帧的坐标，多帧串联的 XYZ", "看轨迹、看优化路径"],
              ["h2o-1.restart", "完整输入 + 当前状态，可直接当输入再跑", "续算、改参数接着算"],
              ["h2o-RESTART.wfn", "波函数（密度矩阵），可当初猜", "省掉重新收敛的时间"],
            ],
            caption: "以 PROJECT h2o 为例，文件名前缀都来自 GLOBAL 里的 PROJECT",
          },
          {
            type: "callout",
            kind: "warn",
            title: "同一个输出文件会被追加",
            text: "用 `-o` 指定输出时，CP2K 是**追加写入**而不是覆盖。重复跑同一个任务前先删掉旧的 .out，否则新日志接在旧日志后面，grep 会一次抓到好几次计算的能量，很容易误判收敛。",
          },
          {
            type: "keypoints",
            items: [
              "一次计算 = 一份输入 + 基组赝势文件 + 一个二进制；结果分散在 out / ener / xyz / restart / wfn 五类文件里。",
              "文件名前缀由 PROJECT 决定，改 PROJECT 等于换一整套输出名。",
              "先学会看文件，再学会调参数：九成的「算错了」都能在 .out 里找到证据。",
            ],
          },
        ],
      },
      {
        id: "4.2",
        title: "语法：& 节点、关键词、单位与预处理",
        blocks: [
          {
            type: "p",
            text: "CP2K 输入只有两种行：**节点行**和**关键词行**。节点用 `&` 开头，必须有配对的 `&END`；节点内部可以再嵌节点，也可以写关键词。关键词是「名字 + 值」，一行一个，值与名字之间用空格隔开。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "syntax.inp（只演示语法，不可单独运行）",
            text: `&GLOBAL
  PROJECT demo          # 关键词：名字 + 值
  RUN_TYPE ENERGY
  PRINT_LEVEL MEDIUM
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &MGRID
      CUTOFF 400        # 默认单位 Ry，也可以写 400 [Ry]
      REL_CUTOFF 50
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
    &END SCF
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "几个容易踩的点：`&END` 后面可以写节点名，也可以不写；但**写了就必须和开头一致**，`&END MGRID` 配 `&DFT` 会直接报错。节点之间的顺序不影响结果，嵌套层级不能乱——`&MGRID` 只能出现在 `&DFT` 里面。大小写和多余空格都无所谓，`&scf` 与 `&SCF` 等价。",
          },
          {
            type: "h3",
            text: "单位：默认值写在每个关键词的手册页里",
          },
          {
            type: "p",
            text: "CP2K 大部分关键词有内置默认单位：长度是 Å，能量是 Hartree，`CUTOFF` 和 `REL_CUTOFF` 例外，默认 Ry。想换单位就紧跟方括号写，例如 `ABC [nm] 1.0 1.0 1.0`、`EMAX_SPLINE [eV] 50`，也支持组合单位 `[hartree*bohr^-2]`。**不要凭印象假设单位**，算出来的能量差十倍，多半是把 Hartree 当成了 eV。",
          },
          {
            type: "h3",
            text: "预处理：把路径和参数提到文件开头",
          },
          {
            type: "list",
            items: [
              "`@SET DATAPATH /opt/cp2k/data` 定义变量，后面用 `${DATAPATH}` 引用；换机器只改这一行。",
              "`@INCLUDE 'coord.inc'` 把另一个文件的文本原地插进来，坐标常用这招。",
              "`@IF ${USE_OT} == 1` … `@ENDIF` 做条件分支，同一份模板可以切两套 SCF 设置。",
              "`#` 之后是注释，行尾注释同样有效。",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "变量只做文本替换",
            text: "@SET 是纯文本替换，不认算术。想按体系改 CUTOFF，就老老实实设 `@SET CUTOFF 400` 再把关键词写成 `CUTOFF ${CUTOFF}`；不要指望在输入里做乘法。",
          },
          {
            type: "keypoints",
            items: [
              "节点成对、关键词一行一个；`&END` 名字写错是最高频的低级错误。",
              "顺序随意、层级不能乱；缩进只是为了人看。",
              "单位默认值因关键词而异，能写方括号就别靠记忆。",
              "@SET / @INCLUDE / @IF 让一份模板适配多个体系。",
            ],
          },
        ],
      },
      {
        id: "4.3",
        title: "四层结构：拿水分子写一份完整输入",
        blocks: [
          {
            type: "p",
            text: "CP2K 把「算什么」拆成四层，各管一段，互不越界：**GLOBAL** 决定任务类型与输出量；**FORCE_EVAL** 决定用什么方法算能量和力；**SUBSYS** 描述体系本身（原子、晶胞、每个元素的基组与赝势）；**MOTION** 决定原子怎么动。DFT 的参数全部挂在 FORCE_EVAL/DFT 下面。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o.inp（上半段：GLOBAL + FORCE_EVAL/DFT）",
            text: `&GLOBAL
  PROJECT h2o
  RUN_TYPE ENERGY
  PRINT_LEVEL MEDIUM
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
      SCF_GUESS ATOMIC
      EPS_SCF 1.0E-6
      MAX_SCF 50
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "逐行读一遍：`PROJECT h2o` 决定所有输出文件的前缀；`RUN_TYPE ENERGY` 只算能量、不算力，比默认的 `ENERGY_FORCE` 便宜；`METHOD Quickstep` 选中 GPW 的 DFT 模块；两个 `*_FILE_NAME` 告诉程序去哪个库里找基组和赝势；`&MGRID` 是第 6 章的主角；`&POISSON PERIODIC NONE` 说明这是孤立分子，`PSOLVER MT` 是与之匹配的泊松求解器。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o.inp（下半段：SUBSYS 描述体系）",
            text: `  &SUBSYS
    &CELL
      ABC 10.0 10.0 10.0
      PERIODIC NONE
    &END CELL
    &COORD
      O   0.000000   0.000000   0.000000
      H   0.757000   0.586000   0.000000
      H  -0.757000   0.586000   0.000000
    &END COORD
    &KIND H
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
    &KIND O
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
  &END SUBSYS`,
          },
          {
            type: "p",
            text: "把这两段按顺序拼在 `&END FORCE_EVAL` 之前，就是一份能跑的输入。SUBSYS 里三件事：`&CELL` 给盒子（10 Å 的立方盒子，足以让分子不与镜像作用）、`&COORD` 给原子坐标（默认笛卡尔、单位 Å）、`&KIND` 给每种元素配基组和赝势。`q1`、`q6` 是价电子数，必须与赝势对上——第 5 章专门讲。",
          },
          {
            type: "callout",
            kind: "key",
            title: "四层各管什么",
            text: "GLOBAL：任务类型 + 输出量 + 项目名。FORCE_EVAL：方法（QS/FIST/QMMM）+ 电子结构参数（全在 &DFT 里）。SUBSYS：原子、晶胞、周期性、每种元素的基组赝势。MOTION：优化 / MD / 约束——只有 RUN_TYPE 要求时才需要。",
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "输入文件生成器",
            desc: "勾选任务类型、基组与泛函，看四层结构怎么一层层长出来；注意 MOTION 只在需要时出现。",
          },
          {
            type: "keypoints",
            items: [
              "四层 = GLOBAL（做什么）+ FORCE_EVAL（怎么算）+ SUBSYS（算谁）+ MOTION（怎么动）。",
              "DFT 的一切参数都在 FORCE_EVAL/&DFT 内部，不散落在别处。",
              "SUBSYS 至少要有 CELL、COORD、KIND 三块；KIND 的名字与 COORD 里的元素标签必须一致。",
            ],
          },
        ],
      },
      {
        id: "4.4",
        title: "RUN_TYPE：选对任务，才配得对小节",
        blocks: [
          {
            type: "p",
            text: "`RUN_TYPE` 是 GLOBAL 里唯一的「总开关」，决定 CP2K 这一趟要干什么。它的默认值是 `ENERGY_FORCE`（算能量和力）——所以只想要能量时必须显式写 `ENERGY`，否则白算一遍受力。",
          },
          {
            type: "table",
            head: ["RUN_TYPE", "做什么", "配套小节", "典型用途"],
            rows: [
              ["ENERGY", "只算电子能量，不算力", "无", "收敛测试、单点能"],
              ["ENERGY_FORCE", "能量 + 原子受力（默认）", "无", "看结构合不合理、准备优化"],
              ["GEO_OPT", "原子位置优化", "&MOTION/&GEO_OPT", "吸附构型、分子结构"],
              ["CELL_OPT", "晶胞 + 原子一起优化", "&MOTION/&CELL_OPT", "晶格常数、加压"],
              ["MD", "分子动力学", "&MOTION/&MD", "AIMD、轨迹、扩散"],
              ["VIBRATIONAL_ANALYSIS", "振动频率与简正模", "&MOTION/&VIBRATIONAL_ANALYSIS", "红外/Raman、虚频检查"],
              ["BAND", "反应路径（NEB 等）", "&MOTION/&BAND", "过渡态"],
              ["MC", "蒙特卡洛", "&MOTION/&MC", "特殊取样"],
              ["NONE", "什么都不算", "无", "只做输入检查"],
            ],
            caption: "常用取值；完整枚举见 CP2K_INPUT/GLOBAL 手册页",
          },
          {
            type: "p",
            text: "选型的顺序是反的：先问「我要的最终数字是什么」，再倒推 RUN_TYPE，最后才去配小节。要一条能量曲线就用 `GEO_OPT`；要一个能量值就用 `ENERGY`；要原子怎么动起来的轨迹就用 `MD`。反过来先抄一份 MD 输入再改参数，通常会在 `&MOTION` 里留下用不上的小节。",
          },
          {
            type: "compare",
            left: {
              title: "ENERGY 适合",
              items: [
                "网格/基组收敛测试（几十上百次单点）",
                "已有结构、只想知道能量差",
                "最便宜：不算力，省掉一遍导数",
              ],
            },
            right: {
              title: "ENERGY_FORCE 适合",
              items: [
                "检查初始结构有没有离谱的受力",
                "优化/MD 的前置检查",
                "默认值，忘记写 RUN_TYPE 时就是它",
              ],
            },
          },
          {
            type: "callout",
            kind: "warn",
            title: "RUN_TYPE 与小节不匹配不会报错",
            text: "写了 `RUN_TYPE GEO_OPT` 却没有 `&MOTION/&GEO_OPT`，CP2K 会用默认优化参数照跑；写了 `&GEO_OPT` 却忘了把 RUN_TYPE 改成 GEO_OPT，那一节就被完全忽略。**任务类型只认 RUN_TYPE**，别指望小节自己生效。",
          },
          {
            type: "keypoints",
            items: [
              "RUN_TYPE 默认 ENERGY_FORCE；只要能量就显式写 ENERGY。",
              "RUN_TYPE 决定跑什么，小节只提供参数；两者对不上时以 RUN_TYPE 为准。",
              "倒推法：先定要的输出，再选 RUN_TYPE，最后配小节。",
            ],
          },
        ],
      },
      {
        id: "4.5",
        title: "提交任务：选二进制、配线程、重定向",
        blocks: [
          {
            type: "p",
            text: "CP2K 有四个常用二进制，名字里的字母就是并行方式：`s` 代表串行（serial），`p` 代表 MPI，`ssmp` 是单进程多线程（OpenMP），`psmp` 是 MPI + OpenMP 混合。选错二进制不会算错，但会慢，或者在跨节点时直接跑不起来。",
          },
          {
            type: "table",
            head: ["二进制", "并行方式", "适用场景"],
            rows: [
              ["cp2k.ssmp", "单节点 OpenMP", "笔记本、单机调试"],
              ["cp2k.popt", "纯 MPI", "跨节点，大体系"],
              ["cp2k.psmp", "MPI + OpenMP", "现代集群首选，内存效率高"],
              ["cp2k.sdbg / pdbg", "调试版", "复现崩溃、给开发者报错"],
            ],
            caption: "ssmp 只能在一个节点内跑，跨节点必须用 popt / psmp",
          },
          {
            type: "code",
            lang: "bash",
            title: "run.sh（单机、MPI、Slurm 三种提交方式）",
            text: `# 1) 单机多线程：线程数 = 物理核心数
export OMP_NUM_THREADS=8
cp2k.ssmp -i h2o.inp -o h2o.out 2> h2o.err

# 2) 单机 MPI：进程数 x 线程数 = 物理核心数
export OMP_NUM_THREADS=1
mpirun -np 8 cp2k.psmp -i h2o.inp -o h2o.out 2> h2o.err

# 3) Slurm 队列：先 module load，再 srun
module load cp2k
srun -n 56 -N 2 cp2k.popt h2o.inp 1> h2o.out 2> h2o.err

# 只检查输入语法，不真算（排错第一步）
cp2k.ssmp -check h2o.inp`,
          },
          {
            type: "p",
            text: "三条纪律。第一，**进程数乘线程数不要超过物理核心数**：`mpirun -np 8` 又 `export OMP_NUM_THREADS=8`，在 8 核机器上就是 64 个线程抢 8 个核，比串行还慢。第二，**标准输出和标准错误分开重定向**：`1> h2o.out 2> h2o.err`，崩溃信息通常在 .err 或 .out 末尾，混在一起反而难找。第三，**`-o` 是追加写**，重跑前先删旧文件。",
          },
          {
            type: "p",
            text: "如果只是想确认输入没写错，用 `-i` 加一个空的输出目标跑几秒即可：CP2K 会先解析全部节点与关键词，语法错误在这一步就暴露，不用等到 SCF。真实的报错往往藏在 .out 的最后几十行，而不是第一屏。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "让输出小一点，跑得快一点",
            text: "长 MD 用 `PRINT_LEVEL LOW`，只在需要时打开 `&PRINT` 里的受力/轨迹；输出写满磁盘会直接让任务挂掉。反过来，调试收敛问题时把 `PRINT_LEVEL` 提到 `MEDIUM` 以上，网格和 SCF 的中间信息才有得看。",
          },
          {
            type: "keypoints",
            items: [
              "ssmp 单机多线程，popt 纯 MPI，psmp 混合；跨节点必须用 p 系列。",
              "进程数 × 线程数 ≈ 物理核心数，超订是性能杀手。",
              "stdout 与 stderr 分开重定向；`-o` 追加写，重跑前清空。",
            ],
          },
        ],
      },
      {
        id: "4.6",
        title: "读输出：三个判据确认「算成了」",
        blocks: [
          {
            type: "p",
            text: "输出文件开头是环境信息（版本、数学库、并行布局），不用细看。真正要盯的是中间那块 SCF 迭代表，和紧跟其后的能量行。判据只有三条：SCF 收敛了、能量行存在且合理、程序正常结束。",
          },
          {
            type: "table",
            head: ["判据", "在输出里找什么", "不满足说明什么"],
            rows: [
              ["SCF 收敛", "`*** SCF run converged in N steps ***`", "达到 MAX_SCF 仍未达标，占据与能量都不可信"],
              ["拿到能量", "`ENERGY| Total FORCE_EVAL ( QS ) energy (a.u.):` 后面那个负数", "任务在 SCF 之前就退出了"],
              ["正常结束", "末尾 `PROGRAM ENDED AT` 与计时表", "被 walltime 杀掉、或中途 ABORT"],
              ["电子数合理", "`Number of electrons:` 与体系价电子数一致", "赝势 q 值或 &DFT 的 CHARGE 设错"],
            ],
            caption: "四条一起看；只看能量数字容易把未收敛的结果当真",
          },
          {
            type: "code",
            lang: "bash",
            title: "check.sh（三行脚本判断一次计算）",
            text: `# 有没有收敛？收敛在第几步？
grep -n "SCF run converged" h2o.out

# 总能量：QS 模块、单位 Hartree（a.u.）
grep "ENERGY| Total FORCE_EVAL" h2o.out | tail -1

# 正常结束 + 警告数量；报错通常在最后几十行
tail -60 h2o.out | grep -E "PROGRAM ENDED|warnings|ABORT|ERROR"`,
          },
          {
            type: "p",
            text: "SCF 表有五列：步数、更新方法（如 `Broy./Diag.` 表示 Broyden 混合 + 对角化）、耗时、收敛指标、总能量与能量变化。收敛指标一栏要降到 `EPS_SCF` 以下才算达标；能量列在最后几步应当只在小数点后第 6 位以后抖动。看到「能量在第 3 步很好看、第 8 步又跳回去」，说明混合参数不合适，而不是算完了。",
          },
          {
            type: "p",
            text: "`ENERGY|` 行里的单位是 Hartree（a.u.），1 Hartree ≈ 27.211 eV。做能量差（吸附能、反应能）时保持全程 Hartree 更安全，最后一步再换算；中途换单位最容易出现「差 27 倍」的经典错误。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "新版不收敛会直接中止",
            text: "从 CP2K 2024.1 起，SCF 达到 MAX_SCF 仍未满足 EPS_SCF 时默认**终止运行**。想让它带病继续，得显式写 `IGNORE_CONVERGENCE_FAILURE`——那会把未收敛的密度带进后续每一步，优化出乱飞的原子。正确做法是回到 SCF 设置（第 8 章），而不是关掉检查。",
          },
          {
            type: "keypoints",
            items: [
              "四个判据：SCF converged、ENERGY| 行、PROGRAM ENDED、电子数对得上。",
              "能量单位 Hartree，1 Ha ≈ 27.211 eV；做差时别换单位。",
              "未收敛的结果不能用于任何结论；先修 SCF，再谈物理。",
            ],
          },
        ],
      },
      {
        id: "4.7",
        title: "重启：断点续算与「便宜算完再算贵」",
        blocks: [
          {
            type: "p",
            text: "CP2K 的重启有两层，用途完全不同。**整跑重启**用 `-1.restart` 文件：它本身就是一份完整输入，把当时的坐标、速度、计数器和所有参数都写进去了，直接把它当输入再跑，MD 步数会接着编号。**波函数重启**只搬初猜：告诉程序「从这份 .wfn 出发」，省掉重新收敛的几十步。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "restart_wfn.inp（只给关键片段，其余与 h2o.inp 相同）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    WFN_RESTART_FILE_NAME ./h2o-RESTART.wfn
    &SCF
      SCF_GUESS RESTART
      EPS_SCF 1.0E-6
    &END SCF
    &PRINT
      &RESTART
        FILENAME ./h2o
        BACKUP_COPIES 3
      &END RESTART
    &END PRINT
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "这两行必须成对出现：`SCF_GUESS RESTART` 说「我要读波函数」，`WFN_RESTART_FILE_NAME` 说「读哪一个」。只写前者，程序会在当前目录找默认名字；找不到文件时它退回 `ATOMIC` 初猜，你只会看到 SCF 步数没变少，而不会看到报错。`&PRINT/&RESTART` 控制每次写出哪个文件、留几份备份（`BACKUP_COPIES` 默认 1）。",
          },
          {
            type: "p",
            text: "要把「位置/速度/计数器」从外部文件搬进来，用顶层的 `&EXT_RESTART`：`RESTART_FILE_NAME` 指向那个 restart 文件，`RESTART_DEFAULT`（默认 `T`）统一控制各项是否读入，也可以用 `RESTART_POS`、`RESTART_VEL`、`RESTART_CELL`、`RESTART_COUNTERS` 逐项开关。续算 MD 时这一节比手动改坐标可靠得多。",
          },
          {
            type: "code",
            lang: "bash",
            title: "续算的两种起手式",
            text: `# A. 整跑续算：restart 文件就是输入
cp2k.ssmp -i h2o-1.restart -o h2o.out

# B. 只搬初猜：先确认 wfn 在，再跑新输入
ls -lh h2o-RESTART.wfn
cp2k.ssmp -i h2o_tzvp.inp -o h2o_tzvp.out

# 确认这次真的读到了波函数（应看到 restart 相关提示）
grep -n -i "restart" h2o_tzvp.out | head`,
          },
          {
            type: "p",
            text: "最值得养成的习惯是**阶梯式计算**：先用 DZVP 基组把结构收敛，把 `h2o-RESTART.wfn` 拿来当 TZVP 计算的初猜；先用 PBE 收敛，再换 PBE0。同一赝势、同一网格的前提下，初猜越接近解，SCF 步数越少。手册把这套做法列成推荐路线，前提是「便宜那一步已经收敛」。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "换了基组，旧波函数只能当初猜",
            text: "波函数是基组展开的系数，换了基组就不能直接复用，只能作为初猜（CP2K 会做投影）。换了赝势、换了元素、换了自旋态则连初猜都不该用——那是另一个电子态。restart 文件与 wfn 文件也不能跨 gamma 点与 k 点计算混用。",
          },
          {
            type: "keypoints",
            items: [
              "整跑续算用 `-1.restart`，它就是输入；波函数重启用两个关键词成对出现。",
              "找不到 wfn 时 CP2K 静默退回 ATOMIC，必须去输出里确认。",
              "阶梯式：便宜基组/泛函收敛 → 拿 wfn 当贵计算的初猜。",
            ],
          },
        ],
      },
      {
        id: "4.8",
        title: "五类最常见输入错误",
        blocks: [
          {
            type: "p",
            text: "下面五类错误占了新手报错的大半，共同点是**语法没错、程序也能跑**，但结果不对或直接中止。看症状比看报错更快。",
          },
          {
            type: "table",
            head: ["症状", "多半是", "改法"],
            rows: [
              ["`&END` 名字与开头不一致，程序启动即退出", "节点配对错，或把 `&END MGRID` 写进了 `&DFT`", "按缩进重新对齐，逐个节点核对名字"],
              ["报错找不到基组/赝势", "`BASIS_SET`、`POTENTIAL` 名字拼错，或 `*_FILE_NAME` 没指向正确库", "在库里 grep 元素名，确认全名含 q 后缀"],
              ["坐标明显错位、能量离谱", "把 Å 当 Bohr，或该用分数坐标却没写 `SCALED T`", "显式写 `UNIT angstrom`，检查 `&COORD` 一行的列数"],
              ["晶体算出「分子」结果", "忘了 `&CELL`，或 `PERIODIC` 留成了 `NONE`", "周期性体系写 A/B/C 或 ABC，`PERIODIC XYZ`"],
              ["跑得比串行还慢 / 任务被杀", "进程数与线程数相乘超订，或输出写满磁盘", "`OMP_NUM_THREADS` 与 `-np` 相乘等于物理核数；降 PRINT_LEVEL"],
            ],
            caption: "先核对这五条，再去看物理参数",
          },
          {
            type: "h3",
            text: "一个必须记住的细节：KIND 的名字",
          },
          {
            type: "p",
            text: "`&COORD` 里第一列是**标签**，不是化学元素。标签叫 `O` 就去匹配 `&KIND O`；标签写成 `Ow`（水的氧）就必须有 `&KIND Ow`，并且在里面用 `ELEMENT O` 告诉程序它其实是氧。不写 `ELEMENT` 时，程序按标签猜元素——`Ow` 猜不出来，就会在启动阶段报「unknown element」。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "别用「能跑通」当验收标准",
            text: "上面五类错误里，只有第一类会立刻中止；其余四类都能算出一个数。所以每次新体系的第一件事不是看能量，而是看：电子数对不对、受力是否在合理量级、`MULTIGRID INFO` 里的网格分配是否正常。",
          },
          {
            type: "keypoints",
            items: [
              "先查配对、再查名字、再查单位、再查周期性、最后查并行与磁盘。",
              "KIND 的名字来自 COORD 的标签；自定义标签必须配 `ELEMENT`。",
              "能跑出数字 ≠ 算对了，四条判据与物理量级要一起看。",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "不写 RUN_TYPE 时，CP2K 默认执行哪种任务？",
        options: ["ENERGY（只算能量）", "ENERGY_FORCE（能量 + 受力）", "GEO_OPT（几何优化）", "MD（分子动力学）"],
        answer: 1,
        explain: "手册中 RUN_TYPE 的默认值是 ENERGY_FORCE。所以想让上百次收敛测试便宜一点，必须显式写 RUN_TYPE ENERGY，否则每次都会多算一遍原子受力。",
      },
      {
        q: "要让晶体做原子位置优化，RUN_TYPE 与配套小节应该怎么组合？",
        options: [
          "RUN_TYPE ENERGY + &MOTION/&GEO_OPT",
          "RUN_TYPE GEO_OPT + &MOTION/&GEO_OPT",
          "RUN_TYPE GEO_OPT + &MOTION/&MD",
          "RUN_TYPE CELL_OPT + &MOTION/&GEO_OPT",
        ],
        answer: 1,
        explain: "任务类型只由 RUN_TYPE 决定，&MOTION/&GEO_OPT 只提供优化算法与收敛标准。RUN_TYPE 写成 ENERGY 时，GEO_OPT 小节会被完全忽略，程序只算一个单点能。",
      },
      {
        q: "第二次用同一个 `-o h2o.out` 跑计算，输出文件会怎样？",
        options: ["被覆盖，只剩新日志", "新日志追加在旧日志后面", "程序拒绝启动", "自动改名为 h2o.out.1"],
        answer: 1,
        explain: "CP2K 的输出是追加写入。重跑前应删除旧的 .out，否则文件里会有两次计算的 SCF 表和能量，grep 取最后一条时很容易拿到上一次的结果。",
      },
      {
        q: "想用已有波函数当初猜，需要哪两个关键词配合？",
        options: [
          "SCF_GUESS RESTART 与 WFN_RESTART_FILE_NAME",
          "EXT_RESTART 与 RESTART_FILE_NAME",
          "RUN_TYPE RESTART 与 PROJECT",
          "SCF_GUESS ATOMIC 与 &PRINT/&RESTART",
        ],
        answer: 0,
        explain: "SCF_GUESS RESTART 表示「读波函数」，WFN_RESTART_FILE_NAME 指定读哪个文件。文件不存在时程序会静默退回 ATOMIC 初猜，因此要在输出里确认真的读到了。",
      },
      {
        q: "输入里写了 `@SET DATAPATH /opt/cp2k/data`，后面引用这个变量应写成？",
        options: ["$DATAPATH", "@DATAPATH", "${DATAPATH}", "&DATAPATH"],
        answer: 2,
        explain: "CP2K 的预处理变量用 ${VAR} 形式引用，@SET 负责定义。它是纯文本替换，不做算术，所以拼路径时可以直接写在其它字符串中间。",
      },
    ],
    terms: [
      { t: "输入文件", en: "input file", d: "以 & 节点组织参数树的纯文本文件，扩展名习惯写 .inp，名字本身无限制。" },
      { t: "节点", en: "section", d: "用 &NAME 开头、&END NAME 结尾的一段参数块，可以嵌套，是 CP2K 输入的基本结构单位。" },
      { t: "单点能", en: "single-point energy", d: "固定原子位置只求电子基态能量，对应 RUN_TYPE ENERGY 或 ENERGY_FORCE。" },
      { t: "重启文件", en: "restart file", d: "名为 PROJECT-1.restart 的完整输入加当前状态，可直接当输入继续计算。" },
      { t: "波函数文件", en: "wavefunction file", d: "保存密度矩阵/轨道系数的二进制文件，可用作下一次计算的初猜以缩短 SCF。" },
      { t: "标准错误", en: "standard error", d: "程序错误与警告的输出流，通常重定向到 .err，崩溃信息多在这里或其对应 .out 末尾。" },
    ],
    sources: [
      { t: "Run a First Calculation", url: "https://manual.cp2k.org/trunk/getting-started/first-calculation.html" },
      { t: "Input Reference: GLOBAL", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/GLOBAL.html" },
      { t: "Input Reference: EXT_RESTART", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/EXT_RESTART.html" },
      { t: "Restarting CP2K Calculations", url: "https://manual.cp2k.org/trunk/methods/restarting.html" },
    ],
  };
})();