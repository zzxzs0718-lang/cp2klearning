(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch20"] = {
    id: "ch20",
    num: 20,
    part: "进阶与工程",
    title: "排错手册：按症状定位，不靠猜",
    subtitle: "从报错关键词到最小复现的完整诊断树",
    hours: 6.0,
    level: "高级",
    intro:
      "CP2K 的报错大多不直观：真正的错误常常只在第一个 MPI rank 上打印，或者被一堆警告淹没。这一章按「症状」组织：先教你收集证据（输出、日志、restart、trace），再给每一类故障的诊断树——症状、可能原因、怎么验证、怎么修，并附上能在输出里搜索的原文关键词。",
    goals: [
      "按「解析 → 几何 → SCF → 力/优化 → 并行/资源」的顺序缩小故障范围",
      "在输出与副本日志里找到真正的报错行，并判断它属于哪一类",
      "用诊断树处理 SCF 不收敛、优化震荡、OOM、周期性冲突与 MPI 崩溃",
      "把一个故障整理成可复现、可提交的最小输入与证据清单",
    ],
    sections: [
      {
        id: "20.1",
        title: "排错次序：先定位阶段，再看具体报错",
        blocks: [
          {
            type: "p",
            text: "CP2K 的执行是一条流水线：解析输入 → 建几何与邻居表 → 初始化波函数 → SCF → 算力 → （优化/MD）→ 写输出。**报错出现的阶段，比报错文本更能提示根因**。例如同样一句 `CPASSERT failed`，出现在邻居表构建阶段多半是几何问题，出现在对角化阶段则可能是并行库或内存问题。",
          },
          {
            type: "steps",
            items: [
              { t: "确认进程死在哪一步", d: "看输出最后一行是 `CELL`、`COORD`、`SCF WAVEFUNCTION OPTIMIZATION` 还是 `GEOMETRY OPTIMIZATION`；restart 文件写到哪一步也是证据。" },
              { t: "在第一个 rank 上找报错", d: "并行任务的警告常常只在 rank 0 打印；副本日志（振动、NEB、swarm、farming）要逐个看，别只盯主日志。" },
              { t: "区分「输入错」与「数值错」", d: "解析错误带 File/Line/Column；数值错误带 NaN/Inf、not converged、abnormal value；断言失败通常是内部一致性被破坏。" },
              { t: "做最小复现", d: "砍到只保留出错的那一步（单点、单帧、单个 k 点），换小基组、少 rank，确认错误仍出现再上报。" },
            ],
          },
          {
            type: "code",
            lang: "bash",
            title: "第一轮证据收集",
            text: `# 1) 找出所有可疑行（保留行号，便于回看上下文）
grep -n -E "ABORT|ERROR|CPASSERT|NaN|Inf|not converged|GEOMETRY wrong|LSD|not found" project.out | head -40

# 2) 看结尾，确认进程是正常结束还是被杀
tail -40 project.out

# 3) 如果是被调度器杀掉，看作业日志而不是 CP2K 输出
#    Slurm: sacct -j <jobid> --format=JobID,State,ExitCode,MaxRSS
#    关键字：OOM、Killed、segfault、exit code 137`,
          },
          {
            type: "callout",
            kind: "key",
            title: "三个最常见的假线索",
            text: "`************` 是定宽格式放不下数字，不是数值爆炸；`NaN` 往往来自几何重叠而不是泛函；`CPASSERT failed` 是内部断言，不代表你的输入一定错。**先看它前面 20 行**，真正的原因通常在那里。",
          },
        ],
      },
      {
        id: "20.2",
        title: "输入与格式错误：解析器已经把答案写出来了",
        blocks: [
          {
            type: "p",
            text: "CP2K 的解析错误格式非常固定：`A (integer|floating point|string) type object was expected, found (end of line|<something>), File: <filename>, Line: <line>, Column: <col>`。它精确告诉你哪一行、哪一列、期望什么类型。看到这句就不要猜，直接去那一行。",
          },
          {
            type: "table",
            head: ["症状 / 关键词", "可能原因", "怎么验证", "怎么修"],
            rows: [
              ["`type object was expected, found ...`", "关键字拼错、缺参数、多写了单位", "按 File/Line/Column 打开输入对照手册", "补参数或删掉多余字段；数值不要带引号"],
              ["读 XYZ 报原子数或行数错", "文件其实是 CIF/PDB，或首行不是原子数", "`head -5 file.xyz`：第一行原子数、第二行注释、其后 `元素 x y z`", "转换格式或改用对应 `COORD_FILE_FORMAT`"],
              ["输出出现 `************`", "Fortran 定宽字段放不下（坐标/能量太大）", "看该列对应的量是否真的异常", "修几何或单位；格式本身不是根因"],
              ["`... is an abnormal value (NaN/Inf)`", "坐标重叠、SCF 发散、除零", "查最近一步的几何与 SCF 收敛", "修结构/换初猜，别只调输出格式"],
              ["`CPASSERT failed`", "内部断言：维度、类型或必需数据不满足", "看消息右下角的源码位置与前面上下文", "多为输入触发的边界情况；能最小复现就报 issue"],
            ],
            caption: "解析类错误几乎都能靠「行号 + 手册」解决，不要用改格式来掩盖。",
          },
          {
            type: "p",
            text: "定宽格式是 CP2K 的老传统：PDB、cube 这类格式字段宽度固定，原子数一多、坐标一大就会挤出星号。XYZ 宽松得多，所以调试阶段优先用 XYZ 输出；但要注意**原版 XYZ 不携带晶胞**，扩展 XYZ 注释行里的晶胞信息也不是所有可视化器都认。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "不要在报错行上做「删掉就好」的修复",
            text: "把 `&KIND` 里不认识的参数删掉、把坐标截断、把 `&END` 名字改掉，可能让解析通过，却让物理模型悄悄变了。解析错误要按语义修，不是按语法修。",
          },
        ],
      },
      {
        id: "20.3",
        title: "SCF 不收敛：先分清「难收敛」与「模型错」",
        blocks: [
          {
            type: "p",
            text: "从 2024.1 起，SCF 达到 `MAX_SCF`（默认 50）仍未达到 `EPS_SCF` 会**默认中止**，报：`SCF run NOT converged. To continue the calculation regardless, please set the keyword IGNORE_CONVERGENCE_FAILURE.` 设了 `IGNORE_CONVERGENCE_FAILURE` 只会降级成警告 `*** WARNING in qs_scf.F:700 :: SCF run NOT converged ***`，然后带着错误的占据与力继续跑——**结果不可信，只能当最后手段**。",
          },
          {
            type: "p",
            text: "诊断顺序：① `CHARGE` 与 `MULTIPLICITY` 是否与体系一致；② 开壳层是否用了 `UKS`（等价 `LSD`）；③ 初始结构是否有重叠原子或错误配位；④ 金属/小带隙是否该开 `&SMEAR`；⑤ 换 `SCF_GUESS` 或从便宜计算续算；⑥ 最后才动混合参数与精度。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "对角化路线：混合 + 展宽",
            text: `&DFT
  UKS
  MULTIPLICITY 3
  &SCF
    SCF_GUESS ATOMIC
    EPS_SCF 1.0E-6
    MAX_SCF 50
    &DIAGONALIZATION
      ALGORITHM STANDARD
    &END DIAGONALIZATION
    &MIXING
      METHOD BROYDEN_MIXING
      ALPHA 0.4
      BETA 0.5
      NBUFFER 8
    &END MIXING
    &SMEAR ON
      METHOD FERMI_DIRAC
      ELECTRONIC_TEMPERATURE 300
    &END SMEAR
  &END SCF
&END DFT`,
          },
          {
            type: "p",
            text: "`&SMEAR` 用电子温度把占据抹平，帮助金属与小带隙体系收敛；算完要把 `ELECTRONIC_TEMPERATURE` 外推到 0 报告。绝缘体不要随手开展宽，它会污染带隙。OT 路线则是另一套：减小内层 `MAX_SCF`、增加 `&OUTER_SCF` 次数，让预条件更频繁更新。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "OT 路线：外层 SCF 管收敛",
            text: `&SCF
  SCF_GUESS RESTART
  EPS_SCF 1.0E-7
  MAX_SCF 32
  &OT ON
    MINIMIZER DIIS
    PRECONDITIONER FULL_SINGLE_INVERSE
    ENERGY_GAP 0.05
  &END OT
  &OUTER_SCF ON
    MAX_SCF 16
    EPS_SCF 1.0E-7
  &END OUTER_SCF
&END SCF`,
          },
          {
            type: "p",
            text: "如果错误涉及自旋，先搜 `Use the LSD option for an odd number of electrons` 与 `LSD: try to use a different multiplicity`。前者说明电子数是奇数却没开 LSD/UKS；后者说明当前多重度不自洽。闭壳层体系突然报这两句，八成是几何坏了（缺氢、重氢、原子重叠），而不是磁性设置问题。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "用 IGNORE_CONVERGENCE_FAILURE 换来的「跑完」",
            text: "未收敛的波函数会给出错误的占据、错误的力与错误的带结构；在 MD 里表现为原子乱飞、温度失控，在优化里表现为「收敛」到非物理结构。**先修收敛，再谈结果**。",
          },
          {
            type: "demo",
            id: "scf",
            title: "动手：观察不同混合参数下的收敛曲线",
            desc: "用同一结构切换 Broyden/Pulay 与 ALPHA，比较 SCF 残差随步数的下降形态。",
          },
        ],
      },
      {
        id: "20.4",
        title: "几何优化震荡或不收敛：多半是力有噪声",
        blocks: [
          {
            type: "p",
            text: "优化的收敛判据是**力与位移**，不是总能量。中间步能量上升是正常的；但如果力在符号之间来回跳、步长被压到很小仍不收敛，先怀疑力的质量：SCF 太松、网格太粗、基组/赝势不匹配，都会让力带上噪声，线搜索自然失败。",
          },
          {
            type: "table",
            head: ["症状", "可能原因", "怎么验证", "怎么修"],
            rows: [
              ["能量振荡、步长反复缩小", "力有噪声；SCF 未收敛", "看每步 SCF 是否都达到 EPS_SCF", "收紧 EPS_SCF/EPS_DEFAULT，或先修 SCF"],
              ["第一步就飞出去", "初始结构有重叠/错误配位", "可视化最短原子间距", "先做低精度预优化或手工修结构"],
              ["BFGS 步太大", "初始 Hessian 差、trust radius 过大", "看 OPT 表的 Step size/Trust radius", "减小 `&BFGS TRUST_RADIUS`"],
              ["LBFGS 很早宣布收敛", "它有自己的判据，可能先满足", "检查 MAX_FORCE/RMS_FORCE 是否真的达标", "改用 BFGS 或收紧判据"],
              ["CELL_OPT 压力不收敛", "真空方向在弛豫、变胞改变格点", "看晶胞轨迹与压力分量", "约束真空方向，设 `CELL_REF` 固定格点数"],
            ],
          },
          {
            type: "code",
            lang: "cp2k",
            title: "稳一点的优化设置",
            text: `&MOTION
  &GEO_OPT
    TYPE MINIMIZATION
    OPTIMIZER BFGS
    MAX_ITER 300
    MAX_FORCE 4.5E-04
    RMS_FORCE 3.0E-04
    MAX_DR 3.0E-03
    RMS_DR 1.5E-03
    &BFGS
      TRUST_RADIUS 0.10
    &END BFGS
  &END GEO_OPT
  &CONSTRAINT
    &FIXED_ATOMS
      COMPONENTS_TO_FIX XYZ
      LIST 1 2 3 4
    &END FIXED_ATOMS
  &END CONSTRAINT
&END MOTION`,
          },
          {
            type: "p",
            text: "优化每步都要做 SCF，所以**优化的电子结构设置至少要和生产单点一样严**。另一个隐蔽问题是外推：变胞或邻居表重建时，`USE_PREV_P`、`LINEAR_P` 之类的初猜会失效，输出里会出现 `*** WARNING in qs_wf_history_methods.F:849 :: Change in cell ***` 或 `*** neighborlist: might affect quality of initial guess ***`。看到就换 `GEXT_PROJ` 或 `USE_GUESS`。",
          },
          {
            type: "p",
            text: "如果优化「跑完了」但结果可疑，做两件事：把最终结构拿去做一次单点，确认 SCF 干净；再做振动分析查虚频。0 K 优化不含零点能与热校正，别把电子能量直接当自由能。",
          },
          {
            type: "keypoints",
            items: [
              "优化看力/位移判据，不看总能量曲线是否单调",
              "震荡先查 SCF 收敛与网格，再调 trust radius 或换 CG",
              "LBFGS 可能因自己的判据提前「收敛」，报结果前核对力",
              "变胞/变邻居表会让密度矩阵外推失效，警告出现就换初猜策略",
            ],
          },
        ],
      },
      {
        id: "20.5",
        title: "内存爆掉与进程被杀：分清 OOM、超时与段错误",
        blocks: [
          {
            type: "p",
            text: "「算着算着没了」有三种完全不同的死法：被系统 OOM killer 杀（退出码 137）、被调度器因超时/超内存终止、以及段错误（segfault，退出码 139）。先看作业日志的退出码与 `MaxRSS`，再决定是减内存还是查 bug。",
          },
          {
            type: "steps",
            items: [
              { t: "确认死法", d: "退出码 137 且 MaxRSS 接近节点内存 → OOM；139 → 段错误；超时则是调度器状态 TIMEOUT。" },
              { t: "定位内存高峰", d: "在单节点用 `ps aux --sort=-rss` 或 `/usr/bin/time -v` 记录峰值；对照 CP2K 输出里的内存报告。" },
              { t: "按 rank 算账", d: "HFX 的 `MAX_MEMORY` 是**每 MPI 进程**的预算；rank 翻倍，总内存也翻倍，不是分摊。" },
              { t: "降内存", d: "减少 rank、改用 psmp 混合并行（线程共享内存）、把 ERI 落盘、换更小的基组或 k 点。" },
            ],
          },
          {
            type: "p",
            text: "混合泛函最典型的 OOM 来自四中心积分。`&DFT/&XC/&HF/&MEMORY` 的 `MAX_MEMORY` 默认只有 512 MiB，大体系必须显式调大；`MAX_DISK_SPACE` 大于 0 时可以把压缩积分写到 `STORAGE_LOCATION`。注意第一个 SCF 周期要首次计算这些积分，会明显变慢，**内存没爆就不要杀进程**。",
          },
          {
            type: "code",
            lang: "bash",
            title: "现场取证：内存与进程",
            text: `# 峰值内存（单机调试）
/usr/bin/time -v mpirun -np 4 cp2k.psmp -i test.inp -o test.out 2> time.log
grep -E "Maximum resident set size|Exit status" time.log

# 运行中观察
ps aux --sort=-rss | head -5
free -h

# 作业结束后看调度器记录
# sacct -j <jobid> --format=JobID,State,ExitCode,MaxRSS,Elapsed`,
          },
          {
            type: "callout",
            kind: "info",
            title: "段错误不一定是内存不够",
            text: "退出码 139 也可能来自 MPI 库版本混用、GPU 驱动不匹配、或数组越界。先用 `gdb --args cp2k.psmp -i project.inp` 复跑拿栈回溯，再判断是资源问题还是软件缺陷。",
          },
        ],
      },
      {
        id: "20.6",
        title: "文件找不到、周期性冲突与 &KIND 不匹配",
        blocks: [
          {
            type: "p",
            text: "这三类问题看起来无关，本质都是**「输入说的」与「运行环境给的」不一致**。相对路径是相对**进程的工作目录**，不是输入文件所在目录；从别的目录提交作业时，`BASIS_SET_FILE_NAME`、`POTENTIAL_FILE_NAME`、`dftd3.dat`、坐标文件全部可能找不到。",
          },
          {
            type: "table",
            head: ["症状 / 关键词", "可能原因", "怎么验证", "怎么修"],
            rows: [
              ["`not found`、打开文件失败", "相对路径按工作目录解析；文件没随作业传上去", "在运行目录 `ls` 输入里提到的每个文件", "改绝对路径，或提交前把数据文件一起同步"],
              ["`GEOMETRY wrong or EMAX_SPLINE too small`", "原子过近/重叠；邻居表构建失败", "可视化结构，量最短原子间距", "修几何；检查格式转换是否丢原子/加重复原子"],
              ["周期性明明设了却像孤立分子", "XYZ 不携带晶胞；`PERIODIC` 写成 NONE", "看输出里的 CELL 与 PERIODIC", "显式写 `&CELL` 与 `PERIODIC XYZ/XY`"],
              ["slab 真空方向被算成周期", "用了 XYZ 全周期", "看压力张量与晶胞输出", "改 `PERIODIC XY`，真空层做收敛测试"],
              ["`KIND` 报错或元素没有基组", "元素符号大小写/拼写不一致；基组文件里没有该元素", "`grep` 基组文件中的元素名", "统一元素符号，换覆盖该元素的基组/赝势"],
              ["切共价键后能量离谱", "QM/MM 边界或电荷错了", "查 QM 总电荷与 link 原子", "重分配电荷，确认 &LINK 两端原子编号"],
            ],
          },
          {
            type: "code",
            lang: "cp2k",
            title: "slab 的晶胞与 KIND",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &SUBSYS
    &CELL
      ABC 10.0 10.0 25.0
      ALPHA_BETA_GAMMA 90.0 90.0 90.0
      PERIODIC XY
    &END CELL
    &COORD
      Pt 0.0 0.0 12.0
      Pt 2.5 2.5 12.0
      C  0.0 0.0 14.0
      O  0.0 0.0 15.2
    &END COORD
    &KIND Pt
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q10
    &END KIND
    &KIND C
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q4
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`GEOMETRY wrong or EMAX_SPLINE too small` 是邻居表在抱怨「有原子靠得太近」。它不一定来自力场：QM 也要建邻居表。常见根因是格式转换丢周期性、建 slab/超胞时忘记去重对称等价原子、晶体学无序位点的占位没处理。**先可视化，再改参数**；把 `EMAX_SPLINE` 调大只会掩盖重叠。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "真空层不是「留一点就行」",
            text: "slab 的真空层厚度必须做收敛测试：把真空从 10 Å 加到 15、20 Å，看吸附能与功函数是否稳定。真空不够时，周期镜像之间的偶极相互作用会污染结果，而且这种误差不会报错。",
          },
        ],
      },
      {
        id: "20.7",
        title: "MPI 崩溃、license 与编译问题",
        blocks: [
          {
            type: "p",
            text: "并行相关的崩溃有个共同特征：**单 rank 能跑、多 rank 崩**。先排除启动方式，再怀疑库。最常见的是 `mpirun` 与 `cp2k.psmp` 链接了不同 MPI：输出里每个 rank 都打印 `MPI: Number of processes 1`，`PROGRAM STARTED AT` 重复交错。",
          },
          {
            type: "table",
            head: ["症状 / 关键词", "可能原因", "怎么验证", "怎么修"],
            rows: [
              ["每个 rank 都显示 1 个进程", "MPI 启动器与可执行文件不匹配", "`which mpirun`；`ldd cp2k.psmp | grep -i mpi`", "source 工具链的 cp2k_env，清掉 ~/.bashrc 里的旧路径"],
              ["跑几步后 MPI_ABORT", "某个 rank 先出错，其他被连带终止", "搜第一个 rank 的报错与 trace", "修根因；用 `TRACE` 看崩溃前最后进入的例程"],
              ["segfault（139）", "库版本混用、GPU 驱动、数组越界", "`gdb --args` 复跑取 `bt`", "统一 MPI/数学库/编译器版本；最小复现后报 issue"],
              ["license 相关退出", "license 服务器不可达、并发数满、环境变量缺失", "在同一节点用厂商工具查许可状态", "修网络/环境变量；换有许可的队列"],
              ["编译报找不到 ELPA/LibXC", "依赖路径或开关不匹配", "看 CMake 的 `CMakeCache.txt` 与构建日志", "按手册开关重配；ELPA 无 GPU 支持时关 `CP2K_ENABLE_ELPA_GPU`"],
            ],
          },
          {
            type: "code",
            lang: "text",
            title: "段错误取证（gdb）",
            text: `gdb --args cp2k.psmp -i project.inp -o project.out
(gdb) run
# 崩溃后
(gdb) bt
(gdb) thread apply all bt
(gdb) quit

# 说明：多 rank 崩溃时，先确认哪个 rank 先死，
# 再用相同 rank 数与绑定方式复跑，栈才有可比性。`,
          },
          {
            type: "p",
            text: "编译问题九成出在「依赖版本组合」而不是 CP2K 本身：MPI 与编译器不配套、ELPA 用 OpenMP 编译但没开对应开关、LibTorch 版本超出 ML 势支持范围、GPU 架构号与卡不符。保留 `CMakeCache.txt` 与完整构建日志，是定位这类问题的唯一可靠办法。",
          },
          {
            type: "p",
            text: "向开发者报 issue 前，准备四样东西：CP2K 版本与构建信息（输出开头的 banner）、最小输入与坐标、完整输出（至少出错前 50 行）、以及「单 rank 是否复现」。缺任何一项，问题通常会被要求补交，来回一轮就是一周。",
          },
        ],
      },
      {
        id: "20.8",
        title: "一页速查：症状到修法",
        blocks: [
          {
            type: "table",
            head: ["症状", "先查什么", "常见修法"],
            rows: [
              ["SCF 不收敛", "CHARGE/MULTIPLICITY、LSD、几何", "修自旋与结构；混合/展宽；换 SCF_GUESS"],
              ["优化震荡", "每步 SCF 是否收敛、力是否平滑", "收紧精度；减 trust radius；换 CG"],
              ["OOM / 137", "每 rank 内存与 rank 数", "减 rank；psmp；调 MAX_MEMORY；ERI 落盘"],
              ["原子飞散", "初始结构、时间步、SCF", "先优化再 MD；减时间步；修 SCF"],
              ["找不到文件", "工作目录与相对路径", "绝对路径；同步数据文件"],
              ["GEOMETRY wrong", "最短原子间距、周期设置", "修几何；去重；检查格式转换"],
              ["MPI 异常", "mpirun 与可执行文件是否同源", "source 环境；统一 MPI 版本"],
              ["结果不可复现", "版本、k 点、展宽、restart", "固定输入与版本；记录完整参数"],
            ],
          },
          {
            type: "p",
            text: "把这张表当成入口，不要当结论。每条症状背后都可能有三个不同根因；**诊断树的价值在于让你用一次实验排除一层**，而不是一次猜中。每次只改一个变量，并把改动记在输入文件的注释里。",
          },
          {
            type: "keypoints",
            items: [
              "报错阶段比报错文本更能提示根因：解析、几何、SCF、力、资源",
              "真正的错误常只在 rank 0 或副本日志里；先 grep 关键词再读上下文",
              "SCF 不收敛先查自旋与几何，别用 IGNORE_CONVERGENCE_FAILURE 掩盖",
              "优化震荡多半是力有噪声：先收紧电子结构，再调优化器",
              "OOM、段错误、超时是三种死法，退出码与 MaxRSS 能区分",
              "最小复现 + 版本 + 完整输出，是求助与报 bug 的最低配置",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "SCF 达到 MAX_SCF 仍未收敛，CP2K 2024.1 之后的默认行为是？",
        options: [
          "打印警告并继续",
          "中止运行，并提示可设 IGNORE_CONVERGENCE_FAILURE",
          "自动把 EPS_SCF 放宽十倍",
          "自动切换到时变 DFT",
        ],
        answer: 1,
        explain: "默认中止，避免把未收敛的结果带进后续计算。IGNORE_CONVERGENCE_FAILURE 只降级为警告，结果仍不可信。",
      },
      {
        q: "优化过程中能量小幅上升，最合理的判断是？",
        options: [
          "优化器坏了，立刻换一个",
          "正常现象：收敛由力/位移判据决定，中间步能量可以上升",
          "说明 SCF 一定没收敛",
          "说明基组太小",
        ],
        answer: 1,
        explain: "优化不是能量单调下降的过程；BFGS/CG 在满足力与位移判据时收敛。只有力长期不降或步长被压死才需要干预。",
      },
      {
        q: "看到 `GEOMETRY wrong or EMAX_SPLINE too small`，第一步应该？",
        options: [
          "把 EMAX_SPLINE 调大",
          "可视化结构，检查是否有原子重叠或周期性丢失",
          "换更小的基组",
          "增加 MPI rank",
        ],
        answer: 1,
        explain: "该报错表示邻居表发现原子过近。调大 EMAX_SPLINE 只是掩盖问题；应先确认几何与周期设置，常见根因是格式转换或建胞时出错。",
      },
      {
        q: "作业退出码 137，最可能的原因是？",
        options: [
          "输入语法错误",
          "被 OOM killer 或调度器因超内存杀死",
          "SCF 不收敛",
          "MPI 版本不匹配",
        ],
        answer: 1,
        explain: "137 = 128 + 9（SIGKILL），常见于 OOM 或调度器强制终止。应结合 MaxRSS 与节点内存判断，再决定减 rank 或调内存预算。",
      },
      {
        q: "关于并行崩溃的排查，下面哪句最准确？",
        options: [
          "只要能跑完，rank 数多少无所谓",
          "单 rank 能跑、多 rank 崩，应先确认 mpirun 与可执行文件来自同一套 MPI",
          "MPI 崩溃一定是 CP2K 的 bug",
          "增加 rank 总能绕过段错误",
        ],
        answer: 1,
        explain: "MPI 启动器与库不匹配是最常见的多 rank 故障源；输出里每个 rank 都显示 1 个进程就是典型证据。排除后再查库版本与代码缺陷。",
      },
    ],
    terms: [
      { t: "诊断树", en: "diagnostic tree", d: "按症状与阶段逐层排除故障的结构化流程，每层用一个实验区分根因。" },
      { t: "最小复现", en: "minimal reproducible example", d: "删到只保留触发错误所需的最少输入与步骤，便于定位与上报。" },
      { t: "OOM killer", en: "out-of-memory killer", d: "内核在内存耗尽时杀死进程的机制，通常表现为退出码 137。" },
      { t: "CPASSERT", en: "CP2K assertion", d: "CP2K 内部一致性断言；失败说明某处假设被破坏，不一定是用户输入错。" },
      { t: "副本日志", en: "replica log", d: "振动、NEB、swarm 等多副本任务为每个副本写的独立输出，错误常只出现在其中一个。" },
      { t: "邻居表", en: "neighbor list", d: "记录截断半径内原子对的列表；原子重叠时构建失败并报 GEOMETRY wrong。" },
      { t: "退出码", en: "exit code", d: "进程结束状态；137 多为 SIGKILL/OOM，139 为段错误，能快速区分死法。" },
    ],
    sources: [
      { t: "Troubleshooting", url: "https://manual.cp2k.org/trunk/getting-started/troubleshooting.html" },
      { t: "SCF Convergence", url: "https://manual.cp2k.org/trunk/methods/dft/convergence.html" },
      { t: "Error Handling", url: "https://manual.cp2k.org/trunk/development/error-handling.html" },
    ],
  };
})();