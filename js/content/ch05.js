(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch05"] = {
    id: "ch05",
    num: 5,
    part: "上手",
    title: "运行控制与输出：把一次计算看明白",
    subtitle: "命令行、并行布局、输出分段与「跑完了吗」",
    hours: 1.5,
    level: "入门",
    intro:
      "输入写好只是开始。一次真正的计算要经过：选对二进制、给出命令行、等它跑完、从几百行输出里挖出你要的那几个数。这一章把这条链路拆开，重点放在「怎么判断它真的跑完了」——这是新手最容易误判的一步。",
    goals: [
      "用 `-i` / `-o` 与重定向控制输入输出，并说清 stdout 与 stderr 的分工",
      "按体系大小选择 MPI 进程数与 OpenMP 线程数，避免超订",
      "在输出文件里定位 SCF 收敛行、总能量行与耗时表",
      "用 PRINT_LEVEL 与 `&PRINT` 控制输出详略，并用 restart 续算",
      "用退出码、日志末尾与 Slurm 状态三重确认计算是否成功",
    ],
    sections: [
      {
        id: "5.1",
        title: "命令行：-i、-o 与三个标准流",
        blocks: [
          {
            type: "p",
            text: "CP2K 的命令行短得惊人：`-i` 给输入，`-o` 给输出，其余全靠输入文件。没有 `--cutoff` 这种选项，也没有日常意义上的交互模式（只有供外部程序驱动的 `cp2k_shell`）。这种设计让作业脚本极易复现，代价是你必须把一切写进输入。",
          },
          {
            type: "code",
            lang: "bash",
            title: "三种等价的运行方式",
            text: `# 1) 标准写法：-i 输入，-o 输出
cp2k.psmp -i h2o.inp -o h2o.out

# 2) 用 shell 重定向：stdout 与 stderr 分开
cp2k.psmp -i h2o.inp 1> h2o.out 2> h2o.err

# 3) 合并两个流：调试时最常用
cp2k.psmp -i h2o.inp 1> h2o.out 2>&1
# 或者同时看屏幕、留文件
cp2k.psmp -i h2o.inp 2>&1 | tee h2o.out`,
          },
          {
            type: "p",
            text: "`-o` 与 `>` 看似一样，差别在细节。`-o` 是 CP2K 自己打开文件写入，日志被分成「大部分进文件、少量进屏幕」；`>` 只是 shell 把 stdout 接到文件，stderr 仍然打在终端。所以用 `-o` 时，屏幕上的报错信息不该被忽略。",
          },
          {
            type: "table",
            head: ["流", "编号", "里面是什么"],
            rows: [
              ["stdin", "0", "标准输入；CP2K 用它接 `-i` 指定的输入"],
              ["stdout", "1", "正常日志：版本、输入回显、SCF、能量、耗时"],
              ["stderr", "2", "警告与错误、MPI 运行时的消息"],
            ],
            caption: "只重定向 stdout 而漏掉 stderr，是「日志里找不到错误」的常见原因。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "屏幕上的东西也要留",
            text: "批量跑几十个任务时，建议统一写 `> job.out 2>&1`，把两个流合并。否则 MPI 的报错（比如进程被杀、无法分配内存）只在终端一闪而过，事后完全查不到。",
          },
        ],
      },
      {
        id: "5.2",
        title: "挑对二进制，排好并行布局",
        blocks: [
          {
            type: "p",
            text: "生产计算几乎都用 `cp2k.psmp`：MPI 负责跨节点/跨进程，OpenMP 负责进程内多线程。布局只有一个约束：**MPI 进程数 × 每进程线程数 ≤ 申请到的核数**。超过就是超订，线程互相抢核，程序不报错但变慢，严重时被调度器 cgroup 限流到假死。",
          },
          {
            type: "code",
            lang: "bash",
            title: "两种布局与它们的适用场景",
            text: `# 小体系：4 进程 × 1 线程。通信开销小，负载均衡好
mpirun -np 4 -x OMP_NUM_THREADS=1 cp2k.psmp -i h2o.inp -o h2o.out

# 大体系、内存吃紧：2 进程 × 8 线程。副本少，每副本内存大
mpirun -np 2 -x OMP_NUM_THREADS=8 cp2k.psmp -i h2o.inp -o h2o.out

# 没有 MPI 的环境
OMP_NUM_THREADS=8 cp2k.ssmp -i h2o.inp -o h2o.out`,
          },
          {
            type: "p",
            text: "`-x` 是 Open MPI 的写法；MPICH 系列用 `-genv OMP_NUM_THREADS 8`。不确定 `mpirun` 属于哪一家，看 `mpirun --version` 的第一行。写错参数名不会静默失败，但会报「unrecognized argument」，也算个好信号。",
          },
          {
            type: "p",
            text: "怎么选？经验规则：体系小（几十个原子）、SCF 每步很快时，多进程更划算；体系大、每个 MPI 进程都要复制一份密度矩阵与格点数据时，多线程更省内存。没有普适最优，跑之前用 2×8、4×4、8×2 各试十分钟，比看任何教程都准。",
          },
          {
            type: "callout",
            kind: "info",
            title: "先确认 MPI 真的生效",
            text: "正常并行时，输出里应有 `DBCSR| MPI: Number of processes 4` 这样的行。如果它显示 1、而日志又逐行重复出现 `PROGRAM STARTED AT`，说明 `mpirun` 与 CP2K 链接的 MPI 不是同一个——这是第 2 章排错表里的第一条。",
          },
        ],
      },
      {
        id: "5.3",
        title: "输出文件的分段结构",
        blocks: [
          {
            type: "p",
            text: "一份正常结束的 CP2K 输出有固定的骨架。知道每段在哪，就不必从头读到尾：找能量直接跳到 `ENERGY|`，查设置看 `INPUT|`，看并行看 `DBCSR|`。",
          },
          {
            type: "table",
            head: ["顺序", "段落", "看什么"],
            rows: [
              ["1", "版本 banner 与引用", "版本号、编译选项，确认跑的是哪个二进制"],
              ["2", "`INPUT|` 输入回显", "CP2K 实际接受的每个节点与关键字"],
              ["3", "MPI / DBCSR 信息", "进程数、线程数、通信后端"],
              ["4", "体系与原子信息", "原子数、元素、晶胞、总电子数、电荷与自旋"],
              ["5", "SCF 迭代", "每步能量变化、DIIS/OT 状态、是否收敛"],
              ["6", "`ENERGY|` 总能量", "单点能，也是后续所有分析的基准"],
              ["7", "MOTION 步信息", "优化/MD 时每步的能量、最大力、坐标"],
              ["8", "timing 表", "各阶段耗时，判断瓶颈在 SCF 还是别的"],
              ["9", "`CP2K ENDED`", "正常终止的标志"],
            ],
            caption: "第 2、6、9 段是日常最常回看的三个位置。",
          },
          {
            type: "code",
            lang: "text",
            title: "骨架节选（数值用省略号代替）",
            text: ` CP2K version 2026.2
 ...
 INPUT| # Global Input Parameters
 INPUT| PROJECT   h2o
 INPUT| RUN_TYPE  ENERGY
 ...
 DBCSR| MPI: Number of processes                     4
 ...
 *** Start of SCF ***
  ...
  SCF run converged in      ... steps
  ...
 ENERGY| Total FORCE_EVAL ( QS ) energy [hartree]        ...
 ...
 CP2K                                              ...
  Total ...`,
          },
          {
            type: "p",
            text: "注意 `ENERGY|` 这一行的格式：标签里带方法名 `( QS )`，方括号里是单位 hartree，数值在行尾。它前面的 `SCF run converged` 说明这一步自洽了；没有这行、直接出现能量，通常意味着用了读入的波函数或做了别的初猜。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "先看最后 50 行",
            text: "任务失败时，末尾往往有 `ABORT`、`ERROR` 或 MPI 的终止信息。养成 `tail -50 job.out` 的习惯，比从头翻快得多；确认失败后再往上找第一个异常点。",
          },
        ],
      },
      {
        id: "5.4",
        title: "PRINT_LEVEL 与 &PRINT：控制它说多少",
        blocks: [
          {
            type: "p",
            text: "CP2K 默认输出已经不少，但真正做生产时你往往想要更多（每步力、每步坐标）或更少（只留能量）。控制手段有两层：全局的 `PRINT_LEVEL`，和局部的 `&PRINT` 节点。",
          },
          {
            type: "p",
            text: "`GLOBAL PRINT_LEVEL` 是枚举，默认 `MEDIUM`，取值从少到多是 `SILENT`、`LOW`、`MEDIUM`、`HIGH`、`DEBUG`。调到 `DEBUG` 会写出几乎所有内部信息，只适合排错：文件可能涨到几百 MB，I/O 本身就会拖慢计算。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "调全局级别，并按需导出力",
            text: `&GLOBAL
  PROJECT h2o
  RUN_TYPE ENERGY
  PRINT_LEVEL MEDIUM
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &PRINT
    &FORCES ON
      FILENAME h2o-1_0.forces
    &END FORCES
  &END PRINT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "每个 print key 都对应输入树里的一个 `&PRINT` 子节点：`&FORCE_EVAL/&PRINT/&FORCES` 写力，`&MOTION/&PRINT/TRAJECTORY` 写轨迹，`&DFT/&SCF/&PRINT/&RESTART` 写波函数。节点名就是开关名，写了 `&FORCES ON` 才输出，`FILENAME` 不给就写进主日志。",
          },
          {
            type: "p",
            text: "这些节点还可以加 `&EACH`，控制「每几步输出一次」。例如轨迹每 5 步写一次：`&EACH` 下写 `MD 5`。默认值因节点而异，写之前先看参考页的 `Default`，不然容易出现「以为关了其实还在写」。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "输出不是越多越好",
            text: "在共享文件系统上，每步都写几百 MB 的轨迹会让整个节点变慢，还可能撑爆配额。先用 `PRINT_LEVEL MEDIUM` 跑通，确认物理合理，再按需打开大输出；不要一上来就 `DEBUG`。",
          },
        ],
      },
      {
        id: "5.5",
        title: "从输出里挖出三个数",
        blocks: [
          {
            type: "p",
            text: "日常只需要三类信息：收敛了吗、能量是多少、花了多久。三条 `grep` 就能拿到，而且可以写进脚本，批量处理几十个任务。",
          },
          {
            type: "code",
            lang: "bash",
            title: "三条命令定位关键行",
            text: `# 总能量（可能有多个，单点通常只有一个）
grep -n "ENERGY|" h2o.out

# SCF 是否收敛
grep -n "SCF run converged" h2o.out

# 各阶段耗时：看 timing 表
grep -nE "^ (CP2K|FORCE_EVAL|SCF)" h2o.out | tail -20

# 出问题时的第一现场
grep -nE "ABORT|ERROR|CPASSERT" h2o.out`,
          },
          {
            type: "p",
            text: "能量单位是 Hartree。做化学的人更习惯 eV 或 kcal/mol，换算时别心算：1 Hartree 约 27.2114 eV，约 627.51 kcal/mol。用下面的换算器点两下，比在纸上推更不容易错。",
          },
          {
            type: "demo",
            id: "units",
            title: "Hartree 换成你熟悉的单位",
            desc: "输入输出里的 Hartree 数值，切换能量单位看换算结果。比较两个异构体的能量差时，0.001 Hartree 已经接近化学精度（约 0.6 kcal/mol），别被小数点位数骗了。",
          },
          {
            type: "p",
            text: "耗时表要看相对比例而不是绝对值。SCF 占九成，说明该调截断能或换算法；初始化占大头，说明基组/格点设置太重；I/O 占比异常，往往是 `PRINT_LEVEL` 开太高或轨迹写太频。",
          },
          {
            type: "callout",
            kind: "info",
            title: "多个 ENERGY| 行是正常的",
            text: "几何优化会给每一步一个能量，MD 会给每一帧一个能量。判断「最终值」时看最后一个，或看 `MOTION` 段里标注为最终结构的那个；不要拿第一行当结果。",
          },
        ],
      },
      {
        id: "5.6",
        title: "restart：中断了怎么接着算",
        blocks: [
          {
            type: "p",
            text: "长任务被墙钟限制杀掉是常态。CP2K 有两套重启机制：一套续波函数（省掉重新做 SCF 初猜的时间），一套续几何与动力学状态（坐标、速度、优化器历史）。两者可以同时用。",
          },
          {
            type: "p",
            text: "波函数重启要求两处配合：`&DFT WFN_RESTART_FILE_NAME` 指向已有的 `.wfn` 文件，`&SCF SCF_GUESS RESTART` 告诉 SCF 用它当初猜。只写前者不写后者，文件会被忽略。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "续波函数 + 同时生成新的波函数文件",
            text: `&DFT
  WFN_RESTART_FILE_NAME h2o-RESTART.wfn
  &SCF
    SCF_GUESS RESTART
    &PRINT
      &RESTART ON
        FILENAME h2o-RESTART
        BACKUP_COPIES 1
      &END RESTART
    &END PRINT
  &END SCF
&END DFT`,
          },
          {
            type: "p",
            text: "`&RESTART` 默认在 SCF 结束时写一次；想更频繁，就在它下面用 `&EACH QS_SCF 5` 每 5 步写一次。注意 `.wfn` 是二进制、与体系规模和 CP2K 版本绑定，换版本或换并行布局后读不进去是正常现象，用同版本重算。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "续几何 / 续 MD 状态",
            text: `&EXT_RESTART
  RESTART_FILE_NAME h2o-1.restart
  RESTART_DEFAULT T
  RESTART_POS T
  RESTART_VEL T
  RESTART_COUNTERS T
&END EXT_RESTART`,
          },
          {
            type: "p",
            text: "`RESTART_DEFAULT` 默认就是 `T`，表示「能从文件里恢复的都恢复」；再用 `RESTART_POS`、`RESTART_VEL`、`RESTART_CELL`、`RESTART_THERMOSTAT` 这些开关逐项覆盖。做 MD 时如果忘了续速度，轨迹会在第一步出现温度跳变，这是最典型的重启事故。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "重启文件名从哪来",
            text: "几何优化与 MD 的 restart 文件由 `&MOTION/&PRINT/&RESTART` 生成，名字默认带项目名与步数，例如 `h2o-1.restart`。项目名来自 `GLOBAL PROJECT`，改项目名等于换了一整套文件名。",
          },
        ],
      },
      {
        id: "5.7",
        title: "批处理：把命令写进作业脚本",
        blocks: [
          {
            type: "p",
            text: "集群上没有人守着终端，一切交给调度器。作业脚本要做四件事：声明资源、加载环境、设好线程数、启动 CP2K。资源声明与并行布局必须一致，否则就是第 5.2 节说的超订。",
          },
          {
            type: "code",
            lang: "bash",
            title: "Slurm 作业脚本模板",
            text: `#!/bin/bash
#SBATCH -J h2o-scf
#SBATCH -N 1
#SBATCH -n 16
#SBATCH -t 02:00:00
#SBATCH --output=h2o-%j.out
#SBATCH --error=h2o-%j.err

module load cp2k/2026.2
export OMP_NUM_THREADS=4

srun cp2k.psmp -i h2o.inp -o h2o.out`,
          },
          {
            type: "p",
            text: "`-n 16` 申请 16 个任务，`OMP_NUM_THREADS=4` 表示每个任务 4 线程，那么 MPI 进程只能是 4 个：`srun -n 4`。如果直接 `srun cp2k.psmp`，Slurm 会按 `-n 16` 起 16 个进程，再乘 4 线程就是 64 线程抢 16 核。",
          },
          {
            type: "p",
            text: "用 `srun` 而不是 `mpirun`，能让 Slurm 正确绑定核心与分发环境变量。只有在调度器不支持 `srun` 的老集群上，才退回 `mpirun`，并手动把 `OMP_NUM_THREADS` 导出。",
          },
          {
            type: "list",
            items: [
              "`-t` 给足墙钟，但不要给到「永远等不完」；被杀一次的时间成本很高",
              "`--output` 与 `--error` 分开写，排错时能快速区分正常日志与报错",
              "内存吃紧时加 `--mem` 或 `--mem-per-cpu`，别让 OOM killer 静默杀进程",
              "多节点时确认 `--ntasks-per-node` 与 CP2K 的并行效率匹配，跨节点通信通常不划算",
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "别把 module load 写进 .bashrc",
            text: "批处理环境是非交互 shell，`.bashrc` 往往不执行，或执行顺序与登录时不同。所有 `module load` 与 `source cp2k_env` 都写进作业脚本本身，脚本才是唯一可信的环境描述。",
          },
        ],
      },
      {
        id: "5.8",
        title: "跑完了吗：三重确认",
        blocks: [
          {
            type: "p",
            text: "「进程结束了」不等于「计算成功了」。CP2K 可能在 SCF 不收敛后继续写能量，也可能被 OOM killer 杀掉只留下半截日志。要同时看三件事：日志末尾、错误关键字、退出码。",
          },
          {
            type: "code",
            lang: "bash",
            title: "一个够用的完成性检查",
            text: `cp2k.psmp -i h2o.inp -o h2o.out
status=$?

echo "exit code: $status"

grep -q "CP2K ENDED" h2o.out && echo "日志正常收尾" || echo "日志没有收尾标记"
grep -nE "ABORT|ERROR|CPASSERT failed" h2o.out || echo "没有致命错误关键字"

# Slurm 上再看调度器记录
# sacct -j $SLURM_JOB_ID --format=JobID,State,Elapsed,MaxRSS`,
          },
          {
            type: "table",
            head: ["检查项", "正常", "异常时先看"],
            rows: [
              ["日志末尾", "`CP2K ENDED` + timing 表", "`tail -50` 找 `ABORT`"],
              ["错误关键字", "没有 `ABORT` / `CPASSERT`", "第一个出现的位置，不是最后一个"],
              ["退出码", "0", "非 0 说明程序或 MPI 层出错"],
              ["Slurm 状态", "`COMPLETED`", "`TIMEOUT` / `OUT_OF_MEMORY` / `NODE_FAIL`"],
              ["物理合理性", "能量合理、SCF 收敛、力不大", "回到输入检查方法与精度"],
            ],
            caption: "前四项过，才算「跑完」；第五项过，才算「算对」。",
          },
          {
            type: "p",
            text: "退出码的坑：某些 MPI 实现即使某个 rank 崩了，`mpirun` 也可能返回 0。所以「退出码 0」是必要不充分条件，必须配合日志检查。反过来，退出码非 0 但日志里有 `CP2K ENDED`，通常是收尾阶段的 I/O 或 MPI finalize 问题，结果往往还能用。",
          },
          {
            type: "p",
            text: "最后一步是物理检查：SCF 收敛步数是否合理（3 到 20 步常见，上百步说明初猜或混合方案有问题）、总能量是否在同类体系的量级、最大力是否随优化下降。数字能跑出来不代表可信，这一步没有工具能替你做。",
          },
          {
            type: "keypoints",
            items: [
              "`-i` 给输入、`-o` 给输出；stderr 不在 `-o` 里，批量任务要合并两个流",
              "进程数 × 线程数 ≤ 核数；小体系多进程，大体系多线程",
              "输出按固定骨架分段，`INPUT|`、`ENERGY|`、`CP2K ENDED` 是三个锚点",
              "`PRINT_LEVEL` 控全局，`&PRINT` 子节点控单项输出与文件名",
              "续波函数要 `WFN_RESTART_FILE_NAME` 加 `SCF_GUESS RESTART`；续几何用 `EXT_RESTART`",
              "判断完成：日志收尾、无致命错误、退出码 0、调度器状态，再加物理合理性",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一站",
            text: "到这里你已经能独立完成「写输入、跑起来、判断结果」的闭环。接下来进入方法层：第 6 章讲 GPW 与格点，解释 `CUTOFF` 到底截断了什么；第 7 章讲基组与赝势，解释为什么必须成对选择。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "用 `-o h2o.out` 时，屏幕上的报错信息为什么不该忽略？",
        options: [
          "因为 `-o` 只写警告",
          "因为 stderr 不进 `-o` 的文件，错误仍打在终端",
          "因为 `-o` 会覆盖已有文件",
          "因为报错一定导致退出码为 0",
        ],
        answer: 1,
        explain: "`-o` 由 CP2K 打开文件写主要日志，stderr 仍指向终端。要一并留存就写 `2>&1` 或用 `| tee`。",
      },
      {
        q: "要从输出里取总能量，最直接的命令是？",
        options: [
          "`grep \"Total\" h2o.out`",
          "`grep \"ENERGY|\" h2o.out`",
          "`grep \"SCF\" h2o.out`",
          "`tail h2o.out`",
        ],
        answer: 1,
        explain: "总能量行以 `ENERGY|` 开头，后面带 `( QS )` 与单位 hartree，数值在行尾。`Total` 会命中一堆无关行。",
      },
      {
        q: "`GLOBAL PRINT_LEVEL` 的默认值是？",
        options: ["SILENT", "LOW", "MEDIUM", "HIGH"],
        answer: 2,
        explain: "默认 MEDIUM，输出量适中。调到 DEBUG 会写出几乎所有内部信息，文件巨大且拖慢 I/O，只适合排错。",
      },
      {
        q: "要接着上次的波函数继续算，输入里必须有哪两处？",
        options: [
          "`&EXT_RESTART` 与 `RESTART_POS`",
          "`&DFT WFN_RESTART_FILE_NAME` 与 `&SCF SCF_GUESS RESTART`",
          "`PRINT_LEVEL DEBUG` 与 `&FORCES ON`",
          "`RUN_TYPE ENERGY` 与 `PROJECT`",
        ],
        answer: 1,
        explain: "前者指明文件，后者告诉 SCF 用它当初猜；只写文件名而 SCF_GUESS 仍是 ATOMIC，文件会被忽略。",
      },
      {
        q: "下面哪组证据最能说明一次计算真的成功了？",
        options: [
          "进程结束、终端回到提示符",
          "退出码为 0",
          "日志末尾有 `CP2K ENDED`、无致命错误、退出码 0，且能量在合理量级",
          "输出文件非空",
        ],
        answer: 2,
        explain: "进程结束可能只是被杀；退出码 0 在部分 MPI 实现下不可靠；文件非空更说明不了什么。要日志收尾、无错误、退出码与物理合理性一起看。",
      },
    ],
    terms: [
      { t: "标准输出", en: "stdout", d: "文件描述符 1，CP2K 的正常日志默认写到这里。" },
      { t: "标准错误", en: "stderr", d: "文件描述符 2，警告与错误走这里；`-o` 不会把它收进文件。" },
      { t: "打印级别", en: "PRINT_LEVEL", d: "GLOBAL 下的枚举，控制整体输出详略，默认 MEDIUM。" },
      { t: "打印开关", en: "print key", d: "输入树里 &PRINT 下的子节点，控制某一类输出的开关、文件名与频率。" },
      { t: "波函数重启文件", en: "wavefunction restart file", d: "`.wfn` 二进制文件，存 SCF 密度/轨道，用于加速后续计算的初猜。" },
      { t: "外部重启", en: "EXT_RESTART", d: "顶层 section，从 restart 文件恢复坐标、速度、晶胞与计数器。" },
      { t: "退出码", en: "exit code", d: "进程结束返回给 shell 的整数，0 表示成功；要配合日志一起判断。" },
    ],
    sources: [
      { t: "Troubleshooting", url: "https://manual.cp2k.org/trunk/getting-started/troubleshooting.html" },
      { t: "Restarting Calculations", url: "https://manual.cp2k.org/trunk/methods/restarting.html" },
      { t: "Print Keys", url: "https://manual.cp2k.org/trunk/development/print-keys.html" },
      { t: "First Calculation", url: "https://manual.cp2k.org/trunk/getting-started/first-calculation.html" },
    ],
  };
})();