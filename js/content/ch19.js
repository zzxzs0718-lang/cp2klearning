(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch19"] = {
    id: "ch19",
    num: 19,
    part: "进阶与工程",
    title: "性能与并行：把机时花在刀刃上",
    subtitle: "从「能跑」到「跑得快、还不炸」",
    hours: 5.5,
    level: "高级",
    intro:
      "CP2K 慢，通常不是机器不够，而是并行配置、算法路线和内存设置三者没对齐。这一章先教你看懂计时表，再决定加 rank、加线程、换对角化库还是开 GPU；最后用弱/强扩展测试给出可写进论文的数字，而不是「感觉快了不少」。",
    goals: [
      "根据计时表判断瓶颈在 SCF、网格还是稀疏矩阵乘，而不是盲目加核",
      "为 popt/psmp 选择合理的 MPI×OpenMP 配比，并验证并行真的生效",
      "正确启用 ELPA 与 GPU 后端，知道哪些开关会拖慢小体系",
      "设计并执行弱扩展/强扩展测试，报告加速比与并行效率",
    ],
    sections: [
      {
        id: "19.1",
        title: "先建性能模型：时间花在哪三类操作上",
        blocks: [
          {
            type: "p",
            text: "一次 Quickstep 单点能，时间基本分给三块：**SCF 迭代**（对角化或 OT、密度矩阵构建）、**网格操作**（高斯乘积的 collocate/integrate、FFT）、**稀疏矩阵乘**（DBCSR）。优化之前先确认哪一块占大头，否则调参就是碰运气。",
          },
          {
            type: "table",
            head: ["计时表里的名字", "对应操作", "常见调优手段"],
            rows: [
              ["`qs_scf`、`scf_work`", "SCF 迭代与密度矩阵", "换 OT/对角化、改混合、收紧 EPS_SCF"],
              ["`grid_collocate`、`grid_integrate`", "高斯到网格的映射", "调 CUTOFF/REL_CUTOFF、NGRIDS"],
              ["`dbcsr_mm`", "稀疏矩阵乘", "改进程网格、开 GPU DBM"],
              ["`fft`、`pw_transfer`", "倒空间与网格间变换", "改进程分布、检查 FFT 库"],
              ["`mp_wait`、`mp_allreduce`", "通信与同步", "减少 rank、改混合并行、查负载均衡"],
            ],
          },
          {
            type: "p",
            text: "一个经验法则：**对角化路线**在中小体系、能带数多时被稠密矩阵对角化卡住；**OT 路线**把成本转移到稀疏矩阵乘，对 rank 数与 GPU 更友好。混合泛函还会额外加上四中心积分（HFX），它的内存与通信模式与纯 GGA 完全不同。",
          },
          {
            type: "demo",
            id: "grid",
            title: "动手：看进程网格怎么切",
            desc: "调整进程数，观察二维进程网格与每个 rank 负责的块；网格越扁，通信越不均衡。",
          },
          {
            type: "callout",
            kind: "key",
            title: "先测量，再优化",
            text: "不要凭「感觉」判断瓶颈。打开计时表（下一节），看 **SELF TIME** 排前三的例程；如果前三名加起来不到 50%，说明时间散在通信与 I/O 上，加 CPU 没用。",
          },
        ],
      },
      {
        id: "19.2",
        title: "四个可执行文件与 MPI×OMP 配比",
        blocks: [
          {
            type: "p",
            text: "CP2K 构建产物按并行方式分四种：`cp2k.sopt`（串行）、`cp2k.ssmp`（OpenMP）、`cp2k.popt`（MPI）、`cp2k.psmp`（MPI + OpenMP）。名字里的 `p` 是 MPI，`smp` 是共享内存。跑大体系优先 `psmp`：rank 少一点、每 rank 多几个线程，总内存和通信量都会下降。",
          },
          {
            type: "code",
            lang: "bash",
            title: "一次规范的 psmp 运行",
            text: `# 8 个 MPI rank × 2 个 OpenMP 线程 = 16 核
export OMP_NUM_THREADS=2
export OMP_PLACES=cores
export OMP_PROC_BIND=close
mpirun -np 8 -x OMP_NUM_THREADS=2 \\
  cp2k.psmp -i project.inp -o project.out

# 确认并行真的生效：输出里应出现
# DBCSR| MPI: Number of processes      8
# DBCSR| OMP: Current number of threads 2
grep -E "DBCSR\\| (MPI|OMP)" project.out`,
          },
          {
            type: "p",
            text: "如果输出里出现 8 份 `MPI: Number of processes 1`，说明 **MPI 根本没启动**：`mpirun` 与 `cp2k.psmp` 链接的不是同一套 MPI。用 `which mpirun`、`ldd cp2k.psmp | grep mpi` 对比，再 source 工具链生成的 `cp2k_env`，而不是靠 `~/.bashrc` 里残留的路径。",
          },
          {
            type: "key",
            items: [
              { k: "rank × threads = 物理核数", v: "不要超过物理核；超线程对 DGEMM 通常无益", tag: "配比" },
              { k: "每 rank 至少 1–2 GB", v: "内存吃紧时减少 rank、增加线程，而不是反过来", tag: "内存" },
              { k: "OMP_PROC_BIND=close", v: "把线程绑在相邻核上，减少跨 NUMA 访问", tag: "绑定" },
              { k: "小体系用 ssmp", v: "rank 多到每个只分几百个原子时，通信开销吃掉收益", tag: "规模" },
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "别在同一节点上叠两个作业",
            text: "调度器给你 32 核，就只用 32 核。两个各要 32 核的作业挤在一起，会让计时表里的通信时间暴涨，还会让「加速比」测试彻底失真。",
          },
        ],
      },
      {
        id: "19.3",
        title: "读计时表：AVERAGE 与 MAXIMUM 的差就是答案",
        blocks: [
          {
            type: "p",
            text: "CP2K 默认只打印占总时间 2% 以上的例程。把阈值调低、按 SELF TIME 排序，你能看到更细的分布。计时表里有 CALLS、ASD（平均调用栈深度）、SELF TIME 与 TOTAL TIME，各自都有 AVERAGE 与 MAXIMUM 两列。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "打开细粒度计时",
            text: `&GLOBAL
  PROJECT_NAME perf_test
  RUN_TYPE ENERGY
  PRINT_LEVEL MEDIUM
  &TIMINGS ON
    THRESHOLD 0.005
    SORT_BY_SELF_TIME T
    REPORT_MAXLOC T
  &END TIMINGS
&END GLOBAL`,
          },
          {
            type: "p",
            text: "**AVERAGE 与 MAXIMUM 差距大 = 负载不均衡或同步等待**。如果 `dbcsr_mm` 的平均 12 s、最大 40 s，说明有的 rank 在等别的 rank；如果 `mp_wait` 本身排进前三，说明通信在拖后腿。相反，两者接近且都很大，才是真正的计算热点，加核或换算法才有意义。",
          },
          {
            type: "p",
            text: "需要更硬的证据时，用 `CALLGRAPH` 生成调用图（配合 kcachegrind 看），或用 `TRACE` 生成逐事件时间线。trace 会记录 rank、调用栈深度、例程名、起止时间与进程内存；程序崩溃时，trace 往往停在出错子程序附近，比猜快得多。",
          },
          {
            type: "table",
            head: ["观察", "含义", "下一步"],
            rows: [
              ["SELF TIME 高度集中在 `dbcsr_mm`", "稀疏矩阵乘是热点", "改进程网格、开 DBM GPU、减少虚轨道"],
              ["`mp_wait` 占比高", "通信/同步成为瓶颈", "减少 rank、改 psmp、检查网络与绑定"],
              ["AVERAGE 远小于 MAXIMUM", "负载不均", "看是否 k 点/原子分布不均，改用更多 rank 或重划分"],
              ["第一个 SCF 周期特别慢", "HFX 首次计算四中心积分", "确认内存没爆，别急着杀进程"],
            ],
          },
        ],
      },
      {
        id: "19.4",
        title: "ELPA 与对角化库：只在瓶颈处换引擎",
        blocks: [
          {
            type: "p",
            text: "对角化路线下，稠密矩阵的对称/厄米本征分解可能占掉一半以上时间。CP2K 可以链接多种库：ScaLAPACK（MPI 下的**强制依赖**）、ELPA、cuSOLVERMp、DLA-Future。ELPA 是高效、可扩展的直接求解器；编译了 ELPA 之后，它通常是默认选择。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "显式指定对角化库",
            text: `&GLOBAL
  PROJECT_NAME diag_test
  RUN_TYPE ENERGY
  PREFERRED_DIAG_LIBRARY ELPA
  PRINT_LEVEL MEDIUM
&END GLOBAL`,
          },
          {
            type: "p",
            text: "`PREFERRED_DIAG_LIBRARY` 可取值 `ELPA`、`SCALAPACK`、`SL`、`CUSOLVER`、`DLAF`。库不可用时 CP2K 回退到 ScaLAPACK。注意一个容易踩的细节：**复数（k 点）矩阵只有在显式请求时才用 ELPA**，默认并不会自动切过去。",
          },
          {
            type: "p",
            text: "什么时候换库值得？当中小体系的对角化占比高、rank 数又多时，ELPA 的并行可扩展性通常更好；反过来，体系很小、每个 rank 分到的矩阵块很薄，ELPA 的通信开销可能盖过收益。**换库前后各跑一次同输入，只比较总时间与对角化项**，不要凭传闻。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "ELPA 出 bug 时的逃生通道",
            text: "如果怀疑 ELPA 导致结果异常或崩溃，用 `PREFERRED_DIAG_LIBRARY SCALAPACK` 复跑同一输入。能复现 → 大概率是 ELPA 路径；不能复现 → 回去查输入与内存。手册的排错页就是用这个办法定位已知 issue 的。",
          },
        ],
      },
      {
        id: "19.5",
        title: "GPU：编译开关、后端与「什么时候不该用」",
        blocks: [
          {
            type: "p",
            text: "CP2K 支持 CUDA（NVIDIA）、HIP/ROCm（AMD）与 OpenCL 三类加速器。CUDA 构建用 `-DCP2K_USE_ACCEL=CUDA`，并用 `-DCMAKE_CUDA_ARCHITECTURES` 指定目标算力；链接的 BLAS/ScaLAPACK 必须能加速大 DGEMM，否则 GPU 上算完还要回 CPU 重算。",
          },
          {
            type: "code",
            lang: "bash",
            title: "CUDA 构建的关键开关",
            text: `cmake -S . -B build-gpu \\
  -DCP2K_USE_ACCEL=CUDA \\
  -DCMAKE_CUDA_ARCHITECTURES=90 \\
  -DCP2K_USE_ELPA=ON \\
  -DCP2K_ENABLE_ELPA_GPU=ON \\
  -DCP2K_WITH_GPU_PROFILING=ON
cmake --build build-gpu -j 16`,
          },
          {
            type: "p",
            text: "后端可以逐个关掉：`CP2K_ENABLE_GRID_GPU`（网格库）、`CP2K_ENABLE_DBM_GPU`（稀疏张量）、`CP2K_ENABLE_PW_GPU`（FFT 与 gather/scatter）、`CP2K_ENABLE_LIBXC_GPU`。小体系上网格太小，kernel 启动与数据传输的开销可能大于收益，关掉反而快；大体系才值得全开。",
          },
          {
            type: "p",
            text: "LibXC 的 GPU 后端是**运行时**选择：`&XC LIBXC_GPU_BACKEND DEVICE` 才会用 GPU，默认是 `HOST`。如果构建里没有 device 路径、或节点上没有可用 GPU，请求 `DEVICE` 会直接 abort；`HOST` 永远能跑。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "消费级 GPU 的双精度陷阱",
            text: "科学计算吃双精度。消费级显卡的双精度吞吐往往只有单精度的几十分之一，跑 CP2K 可能比 CPU 还慢。选卡时看 FP64 指标，不要只看显存与游戏帧数；双精度弱的卡只适合做单精度试点。",
          },
          {
            type: "p",
            text: "判断 GPU 是否真的在工作，不能只看「任务没报错」。打开 `-DCP2K_WITH_GPU_PROFILING=ON` 后用 `nsys profile --trace=cuda,nvtx` 抓一次，看时间线上有没有 kernel 与 NVTX 区间；没有的话，多半是后端没编进去，或该体系规模没触发 offload。",
          },
        ],
      },
      {
        id: "19.6",
        title: "内存与 I/O：最容易「算到一半死掉」的地方",
        blocks: [
          {
            type: "p",
            text: "内存问题通常不是总量不够，而是**每个 rank 都要一份**。混合泛函的四中心积分、in-core 存储、大基组的密度矩阵，都会随 rank 数成倍增长。`&DFT/&XC/&HF/&MEMORY` 的 `MAX_MEMORY` 单位是 MiB，默认 512，指的是**单个 MPI 进程**可用的上限。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "给 HFX 设内存与磁盘预算",
            text: `&DFT
  &XC
    &XC_FUNCTIONAL PBE0
    &END XC_FUNCTIONAL
    &HF
      &MEMORY
        MAX_MEMORY 2048
        MAX_DISK_SPACE 8192
        STORAGE_LOCATION /scratch/eri
      &END MEMORY
    &END HF
  &END XC
&END DFT`,
          },
          {
            type: "p",
            text: "`MAX_DISK_SPACE` 大于 0 时，压缩后的四中心积分会落盘；`STORAGE_LOCATION` 要指向**本地盘或高速并行文件系统**，不要放在挂载缓慢的家目录。混合泛函的第一个 SCF 周期要首次计算 ERI，慢是正常的；只要内存没爆，别因为「看起来卡住」就杀掉。",
          },
          {
            type: "p",
            text: "I/O 侧的三个常见浪费：每步都写轨迹（`&MOTION/&PRINT/&TRAJECTORY` 的频率）、restart 写得太稀（崩了重跑几小时）、输出打在网络盘上。生产任务把 restart 频率设成「重跑成本 ≤ 30 分钟」，轨迹按分析需要降频，日志重定向到本地再汇总。",
          },
          {
            type: "keypoints",
            items: [
              "内存上限按 rank 计：加 rank 不等于加总内存，常常相反",
              "HFX 的 MAX_MEMORY 与 MAX_DISK_SPACE 要一起设，别让它默认 512 MiB 硬撑",
              "I/O 不要打在慢速网络盘；restart 频率按「重跑成本」定",
              "OOM 时先减 rank、改 psmp 混合，再考虑加内存",
            ],
          },
        ],
      },
      {
        id: "19.7",
        title: "弱扩展与强扩展：把「快」变成可报告的数字",
        blocks: [
          {
            type: "p",
            text: "**强扩展**固定体系大小，增加核数，看同样的问题算得多快：加速比 $S(N)=T(1)/T(N)$，并行效率 $E=S/N$。**弱扩展**让每个 rank 的原子数保持不变、体系随核数一起变大，看能否「加多少核算多大体系而单步时间不变」：效率 $E=T(1)/T(N)$（每 rank 工作量相同）。",
          },
          {
            type: "code",
            lang: "bash",
            title: "强扩展测试脚本（固定输入）",
            text: `#!/usr/bin/env bash
set -euo pipefail
INP=water64.inp
for np in 1 2 4 8 16 32; do
  export OMP_NUM_THREADS=1
  /usr/bin/time -f "%e" -o time_\${np}.txt \\
    mpirun -np \${np} cp2k.psmp -i \${INP} \\
    -o out_\${np}.log > /dev/null
  echo "\${np} \$(cat time_\${np}.txt)"
done | tee strong_scaling.dat`,
          },
          {
            type: "p",
            text: "脚本本身不值钱，值钱的是**控制变量**：同一个输入、同一批节点、同样的绑定方式、同样的编译产物；每个点先预热一次再计时；至少重复三次取中位数；报告时写清体系（原子数、基组、泛函、CUTOFF、k 点）、硬件（CPU 型号、核数、内存、互联）与 CP2K 版本。缺任何一项，数字都不可复现。",
          },
          {
            type: "table",
            head: ["现象", "诊断", "处理"],
            rows: [
              ["加到 16 核后时间反升", "通信/同步超过计算收益", "减少 rank、增加每 rank 原子数、检查绑定"],
              ["效率随核数陡降但单 rank 正常", "进程网格太扁或负载不均", "改用方阵进程网格、检查 k 点分布"],
              ["弱扩展效率接近 1", "算法与并行都健康", "可以按此配置扩大生产体系"],
              ["重复运行方差很大", "节点争用、I/O 抖动、频率漂移", "独占节点、预热、固定频率、多次取中位数"],
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "报告加速比时，别只给最好看的那一个点",
            text: "审稿人关心的是**在什么规模、什么配置下**达到多少效率。给出 1→N 的完整曲线，标注偏离线性的位置，并解释原因（通信、负载、内存带宽），比单点「32 核加速 25 倍」可信得多。",
          },
        ],
      },
      {
        id: "19.8",
        title: "常见性能坑清单",
        blocks: [
          {
            type: "table",
            head: ["症状", "最可能的原因", "验证 / 修法"],
            rows: [
              ["4 个 rank 各打印 `MPI: Number of processes 1`", "mpirun 与可执行文件的 MPI 不匹配", "`ldd cp2k.psmp` 对比 `mpirun --version`，source cp2k_env"],
              ["CPU 占用只有 100%", "OMP_NUM_THREADS 没生效或用了 sopt", "检查环境变量与可执行文件名"],
              ["GPU 利用率 0%", "后端未编译 / 规模太小 / LIBXC 仍 HOST", "看构建日志与 nsys 时间线"],
              ["SCF 每步越来越慢", "内存换页、ERI 落盘、轨迹写太频", "监控 swap 与 I/O，降轨迹频率"],
              ["同样输入换节点慢一倍", "NUMA/绑定/频率或互联差异", "固定绑定与频率，记录节点型号"],
              ["加速比在 8 核后饱和", "体系太小，通信占比高", "换 ssmp、减少 rank、或扩大体系"],
            ],
          },
          {
            type: "p",
            text: "还有一个不写在计时表里的坑：**在对数节点上跑生产**。登录节点通常有 CPU 限额与共享 I/O，计时结果既慢又不稳；所有扩展性测试都应在计算节点、独占资源下做。",
          },
          {
            type: "keypoints",
            items: [
              "先看计时表定位瓶颈，再决定加 rank、加线程、换库还是开 GPU",
              "psmp 的 rank×threads 要等于物理核；内存紧就减 rank 加线程",
              "ELPA 默认可用，k 点复数矩阵要显式请求；出问题先回退 ScaLAPACK",
              "GPU 看 FP64 与后端开关，小体系关掉网格/DBM 后端可能更快",
              "扩展性数字必须带体系、硬件、版本与完整曲线，否则不可复现",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "计时表里某例程 AVERAGE 12 s、MAXIMUM 40 s，最合理的解释是？",
        options: [
          "该例程是计算热点，应该加核",
          "存在负载不均衡或同步等待，部分 rank 在等",
          "计时器坏了",
          "GPU 没有启用",
        ],
        answer: 1,
        explain: "平均值远小于最大值，说明最慢的 rank 拖住了整体，典型原因是任务划分不均或同步点。应先查进程网格与原子/k 点分布，而不是直接加核。",
      },
      {
        q: "输出里出现 8 份 `DBCSR| MPI: Number of processes 1`，说明？",
        options: [
          "MPI 并行正常，只是打印重复",
          "MPI 没有真正启动，mpirun 与可执行文件不匹配",
          "需要设置 OMP_NUM_THREADS=8",
          "DBCSR 库损坏",
        ],
        answer: 1,
        explain: "每个 rank 都认为自己是唯一进程，说明可执行文件不是用同一个 MPI 启动的。检查 which mpirun 与 ldd cp2k.psmp，并 source 工具链环境。",
      },
      {
        q: "关于 ELPA，下面哪句正确？",
        options: [
          "没编译 ELPA 也能用 PREFERRED_DIAG_LIBRARY ELPA",
          "编译了 ELPA 后它通常是默认对角化库；k 点复数矩阵需显式请求才用 ELPA",
          "ELPA 只能用于 OT 方法",
          "ELPA 会替代 ScaLAPACK，所以 MPI 下不再需要 ScaLAPACK",
        ],
        answer: 1,
        explain: "ELPA 编译后通常成为默认；库不可用时回退 ScaLAPACK，而 ScaLAPACK 在 MPI 构建中是强制依赖。复数矩阵只有显式请求才走 ELPA。",
      },
      {
        q: "弱扩展测试的正确做法是？",
        options: [
          "固定体系，增加核数",
          "保持每个 rank 的原子数不变，体系随核数一起变大",
          "固定核数，改变 CUTOFF",
          "只测单核与 32 核两个点",
        ],
        answer: 1,
        explain: "弱扩展衡量「加核能否算更大的体系而单步时间不变」；固定体系加核是强扩展。两者效率公式不同，报告时要写清楚。",
      },
      {
        q: "混合泛函任务 OOM，最不该先做的是？",
        options: [
          "减少 MPI rank、改用 psmp 混合并行",
          "调大 &HF/&MEMORY 的 MAX_MEMORY 并设置磁盘缓存",
          "直接设 IGNORE_CONVERGENCE_FAILURE 继续算",
          "检查是否每个 rank 都分配了完整 ERI 缓冲",
        ],
        answer: 2,
        explain: "IGNORE_CONVERGENCE_FAILURE 只压制 SCF 不收敛的报错，不解决内存问题，还会让后续结果不可信。应先降 rank、调内存预算或落盘。",
      },
    ],
    terms: [
      { t: "强扩展", en: "strong scaling", d: "固定问题规模、增加并行资源，衡量同一任务算得更快的能力。" },
      { t: "弱扩展", en: "weak scaling", d: "保持每 rank 工作量不变、问题规模随资源增长，衡量能否维持单步时间。" },
      { t: "并行效率", en: "parallel efficiency", d: "加速比除以并行资源数；强扩展为 S/N，弱扩展为 T(1)/T(N)。" },
      { t: "DBCSR", en: "distributed block compressed sparse row", d: "CP2K 的分布式稀疏矩阵库，负责稀疏矩阵乘与张量运算。" },
      { t: "进程网格", en: "process grid", d: "把 MPI 进程排成二维网格来分块矩阵；越接近方阵，通信越均衡。" },
      { t: "ELPA", en: "eigenvalue solvers for petascale applications", d: "可扩展的对称/厄米矩阵直接本征求解库，常用于对角化路线。" },
      { t: "负载均衡", en: "load balancing", d: "让各 rank 的计算量接近；不均衡会表现为 AVERAGE 与 MAXIMUM 的巨大差距。" },
    ],
    sources: [
      { t: "Eigensolvers", url: "https://manual.cp2k.org/trunk/technologies/eigensolvers/index.html" },
      { t: "Accelerators: CUDA", url: "https://manual.cp2k.org/trunk/technologies/accelerators/cuda.html" },
      { t: "Profiling", url: "https://manual.cp2k.org/trunk/development/profiling.html" },
      { t: "Troubleshooting", url: "https://manual.cp2k.org/trunk/getting-started/troubleshooting.html" },
    ],
  };
})();