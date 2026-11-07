(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch15"] = {
    id: "ch15", num: 15, part: "分析与实战",
    title: "发表级工作流",
    subtitle: "收敛证据、误差预算、可复现、并行与写作模板",
    hours: 5.0, level: "高级",
    intro: "这一章讲的不是「怎么算出一个数」，而是「怎么让别人相信这个数」。审稿人不会看你跑了多少机时，只会问三件事：这个参数你验过收敛吗？这个差异大于你的误差吗？这篇结果别人能复现吗？答案要靠一张收敛表、一次有对照的误差预算、一个能重跑的工作目录来给。本章把这些整理成可执行的流程与模板，示例数据来自「庚子计算 CP2K 课程」与 CP2K 官方手册，不虚构任何 benchmark。",
    goals: [
      "为每个关键参数（CUTOFF、REL_CUTOFF、k 点、基组、真空、时间步）设计并记录收敛测试",
      "把「方法差异」与「数值误差」分开，给出可以写进论文的误差预算",
      "建立一个能在一个月后重跑的目录与归档规范，写清版本、数据文件与随机种子",
      "按体系规模选择 MPI 与 OpenMP 的并行布局，避开 I/O 与内存的常见瓶颈",
      "写出审稿人挑不出毛病的计算方法段，并完成提交前的 12 项自检"
    ],
    sections: [
      {
        id: "15.1", title: "收敛证据：把「我算过了」变成「我证明收敛了」",
        blocks: [
          { type: "p", text: "收敛测试的做法是固定的：**固定其他所有参数，只扫一个，看目标量怎么变**。目标是你要报的量（总能量、力、带隙、吸附能、自由能面），不是随便一个中间量。判据要事先写下来——比如「总能变化小于 1e-6 Ry 且力变化小于 1e-3 Ha/Bohr」，测试跑完对着判据勾，而不是看图觉得差不多。" },
          { type: "p", text: "`CUTOFF` 在 CP2K 里控制平面波辅助基组的截断，默认单位是 Ry。官方入门教程给的判据是总能随 CUTOFF 的变化小于 1e-6 Ry；做法是从低到高扫（例如 150、200、250、300、350、400），画「总能 − CUTOFF」曲线，取曲线进入平台后第一个满足判据的点，再往上留一档余量。课程练习里 Au-H2O 用 350、纯水盒子用 280，这是两套体系各自的取值，不能互相当作推荐值。" },
          { type: "p", text: "`REL_CUTOFF` 控制高斯积分的辅助格点划分，`NGRIDS` 控制多重网格层数。三者是配套的：只调 CUTOFF 不动 REL_CUTOFF，能量可能因为积分误差不降反升。测试顺序建议是**先定 REL_CUTOFF 与 NGRIDS（用中等 CUTOFF 固定住），再扫 CUTOFF**，因为前两者的收敛通常更快。" },
          {
            type: "table",
            caption: "收敛证据表模板（每个体系一张，放补充材料）",
            head: ["参数", "扫描范围", "判据", "选定值", "选定值与上一档的差"],
            rows: [
              ["CUTOFF (Ry)", "150 → 400，步长 50", "总能变化 < 1e-6 Ry", "填实测", "填实测"],
              ["REL_CUTOFF (Ry)", "40 → 80，步长 20", "总能变化 < 1e-6 Ry", "填实测", "填实测"],
              ["k 点（金属）", "1×1×1 → 6×6×1", "总能变化 < 1 meV/atom", "填实测", "填实测"],
              ["基组", "SZV → DZVP → TZVP", "目标量变化 < 化学精度", "填实测", "填实测"],
              ["真空层 (Å)", "10 → 25", "功函数/吸附能变化 < 0.01 eV", "填实测", "填实测"],
              ["时间步 (fs)", "0.5 → 2.0", "能量漂移与温度稳定性", "填实测", "填实测"]
            ]
          },
          { type: "callout", kind: "warn", title: "收敛测试里最容易犯的三个错", text: "① 用**总能量**判断一个影响**力**的参数（比如 k 点对力的影响比能量大得多）；② 在**没有弛豫**的结构上测收敛，换到优化后的结构又开始漂；③ 只看一个体系就外推到另一个体系（金属氧化物与分子晶体对 CUTOFF 的敏感度完全不同，每类体系都要单独验）。" },
          {
            type: "code", lang: "bash", title: "批量跑 CUTOFF 扫描：一个模板，sed 换值，循环提交",
            text: `#!/bin/bash
# 模板 cp2k.inp 里写一行: CUTOFF __CUT__
for cut in 250 300 350 400; do
  d=cut_\${cut}
  mkdir -p \$d
  cp coord.inc BASIS_MOLOPT GTH_POTENTIALS \$d/
  sed "s/__CUT__/\${cut}/" cp2k.inp > \$d/cp2k.inp
  ( cd \$d && mpirun -np 16 cp2k.popt cp2k.inp > cp2k.out 2> cp2k.err )
  echo "\$cut \$(grep 'Total energy' \$d/cp2k.out | tail -1)"
done`
          },
          { type: "p", text: "这个循环跑完，你手上就有了「CUTOFF 对总能」的四行数据。把它和判据一起放进补充材料，审稿人再问「截断够不够」，你只需要指那张表。" },
          { type: "demo", id: "scf" },
          { type: "callout", kind: "tip", title: "顺手把 SCF 判据也测一遍", text: "`EPS_SCF` 不是收敛性参数，而是数值精度参数，但它对 MD 的影响比 CUTOFF 还大。课程讲义里的 BOMD 稳定性表就是一个范本：同一条轨迹，`EPS_SCF` 从 1e-8 松到 1e-4，力误差从 5.1e-9 涨到 5.9e-5 Ha/Bohr、能量漂移从 0.0 涨到 50 K/ns。这类表比一句「设置足够严格」有说服力得多。" },
          {
            type: "code", lang: "cp2k", title: "扫描用的模板：固定其余参数，只留 CUTOFF 一行被替换",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &MGRID
      CUTOFF 350
      REL_CUTOFF 60
      NGRIDS 4
    &END MGRID
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 50
      &OT
        MINIMIZER DIIS
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
      &OUTER_SCF
        EPS_SCF 1.0E-5
        MAX_SCF 4
      &END OUTER_SCF
      &MIXING
        METHOD BROYDEN_MIXING
        ALPHA 0.1
        NBROYDEN 8
      &END MIXING
    &END SCF
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "上面这组 `CUTOFF 350 / REL_CUTOFF 60 / NGRIDS 4` 是课程练习里 Cu(100)+水 那套的搭配，作用只是给你一个能跑起来的起点。做扫描时只改 `CUTOFF` 那一行（就是上面那个 bash 循环在做的事），其余逐字不动——这样能量随 CUTOFF 的变化才只反映截断，不掺杂别的东西。" },
        ]
      },
      {
        id: "15.2", title: "误差预算与对照实验",
        blocks: [
          { type: "p", text: "论文里讨论一个能量差（比如吸附能差 0.1 eV、反应能垒差 0.05 eV）时，必须能回答「这个差大于误差吗」。误差至少有四层，从下往上：**数值误差**（截断、k 点、SCF 判据）、**模型误差**（层数、真空、超胞大小）、**方法误差**（泛函、基组、色散校正、+U）、**统计误差**（MD 采样、自由能面的收敛）。前两层靠收敛测试压下去，第三层靠对照，第四层靠重复。" },
          {
            type: "table",
            caption: "误差预算表：把每一项写成「范围 + 依据」",
            head: ["误差来源", "怎么估", "典型量级（依体系而定）", "写在哪"],
            rows: [
              ["截断与网格", "15.1 的收敛表", "总能 < 1e-6 Ry；吸附能常 < 0.01 eV", "补充材料"],
              ["k 点", "加密网格看总能与力", "金属体系可到 meV/atom 级", "补充材料"],
              ["SCF 判据", "对照不同 EPS_SCF 的短轨迹", "力 1e-7 – 1e-5 Ha/Bohr", "方法段一句"],
              ["超胞/层数/真空", "加倍后重算目标量", "吸附能 0.01–0.05 eV", "补充材料"],
              ["泛函与色散", "换泛函或加 D3 重算", "0.05–0.3 eV 量级，需明说", "正文讨论"],
              ["采样", "分两半轨迹各算一次", "自由能面 1–2 kcal/mol 量级", "图注误差棒"]
            ]
          },
          { type: "p", text: "**对照实验**比单点误差更有价值，因为它同时检验了方法的一致性。三种常用对照：① 同一体系换一个可信度更高的设置（更密的 k 点、更大的基组），看结论是否翻转；② 同一体系用另一套代码（VASP、Quantum ESPRESSO）算同一个量，看差多少；③ 同一体系用同一代码的两条不同数值路线（比如 OT 与对角化），既能验证实现，也能暴露容易被忽略的热力学项。" },
          { type: "p", text: "第三种对照有个真实例子：同一个 Cu(100)+水 体系，OT 路线给出 −3101.834603 Ha，对角化路线给出 −3101.838526 Ha，表面差 0.0039 Ha（约 0.11 eV）。如果直接写「两条路线差 0.11 eV」，结论就错了——对角化结果里含展宽带来的电子熵项 −0.004025 Ha，把它加回去得到 −3101.834501 Ha，与 OT 只差约 1e-4 Ha（3 meV）。**对照实验的第一步永远是确认两边在比同一个量**。" },
          { type: "callout", kind: "warn", title: "别把误差预算写成免责声明", text: "「由于计算资源有限，本工作采用了较低的截断……」这种写法只会让审稿人怀疑所有结果。正确写法是给数：截断取 X Ry，从 X−50 到 X+50 总能变化小于 1e-6 Ry；k 点取 N×N×1，加密到 2N 后吸附能变化 4 meV。误差预算的作用是划定结论的可信区间，不是给结论打折。" }
        ]
      },
      {
        id: "15.3", title: "可复现：目录、版本、数据、种子",
        blocks: [
          { type: "p", text: "可复现的最低要求是：**别人拿到你的补充材料，能重跑出同一张图**。这需要五样东西齐全——输入文件、软件版本、数据文件、后处理脚本、随机种子。缺任何一样，一个月后的你自己都跑不出来。" },
          {
            type: "list",
            ordered: true,
            items: [
              "**输入**：`cp2k.inp` 原样保存，不要只留关键片段。所有依赖的坐标文件（`coord.inc`）、基组与赝势文件（`BASIS_MOLOPT`、`GTH_POTENTIALS`）一起放进去，别指望别人机器上有同样的路径。",
              "**版本**：输出文件头里的 CP2K 版本号、编译选项（MPI、OpenMP、数学库）、以及是否用了 GPU。课程练习跑在 cp2k-6.1 上，换到 2024 版同一个输入可能有细微数值差异。",
              "**数据**：轨迹、ener、cube、pdos 至少保留一份压缩归档；分析用的中间数据（g(r) 的 dat、MSD 的 xvg）与生成它们的脚本一起存。",
              "**脚本**：从 xyz 到最终图的每一步都要有脚本，包括「用哪个 bin 宽度」「丢掉前多少帧」这种看似琐碎的选择。",
              "**种子**：MD 的初始速度、元动力学的沉积、某些随机初始化都受种子影响。CP2K 的 MD 初始速度由温度与随机数生成，要固定就得显式给初始速度文件或记录所用的设置。"
            ]
          },
          { type: "p", text: "目录结构建议按「体系 / 任务 / 参数」三层，名字里带参数值，这样一年后不用打开文件就知道哪个目录是什么：" },
          {
            type: "code", lang: "bash", title: "工作目录命名与最小交付集",
            text: `au111_water/
  common/                     # 全体系共用：基组、赝势、坐标
  single_point/cut350/        # 单点，截断 350
  geo_opt/bfgs/               # 优化
  nvt_330k_dt0.5/             # 生产 MD：温度与步长写进名字
    cp2k.inp  cp2k.out  cp2k-1.ener  cp2k-pos-1.xyz
    cp2k-1.restart  md5.txt
  convergence/cut_250/ ... cut_400/
  analysis/                   # 后处理脚本 + 中间数据 + 图

# 每个目录留一份校验和，确认交付的文件没被改过
md5sum cp2k.inp coord.inc > md5.txt`
          },
          { type: "callout", kind: "tip", title: "重启策略也是可复现的一部分", text: "长跑一定会断。做法是让每个任务都能从 `cp2k-1.restart` 续上：`&EXT_RESTART` 指向重启文件，或者直接用 `cp2k.popt -i cp2k-1.restart`。续算时注意 `SCF_GUESS RESTART` 需要配套的 `cp2k-RESTART.wfn`——那个 WARNING「restart file does not exist, continues using ATOMIC GUESS」就是因为它丢了，此时第一步的 SCF 会明显变慢，但不影响结果正确性。" },
          { type: "p", text: "交付时把「能重跑」和「能读懂」分开处理：输入与脚本给完整版（可重跑），分析流程写成一段带命令的说明（能读懂）。不要把几十 GB 的轨迹塞进补充材料——归档到可长期访问的仓库，论文里给 DOI 或链接，并写清文件清单与大小。" }
        ]
      },
      {
        id: "15.4", title: "性能：并行布局、内存与 I/O",
        blocks: [
          { type: "p", text: "CP2K 是 MPI + OpenMP 混合并行。布局的原则只有一条：**总核数 = MPI 进程数 × 每进程线程数，且 MPI 进程数不要超过物理核数**（超线程只对少数内存带宽充裕的场合有帮助，量子化学计算通常不划算）。同一台机器上，MPI 进程越多，每个进程分到的内存越少，而 CP2K 的内存增长主要来自波函数与格点数据。" },
          {
            type: "code", lang: "bash", title: "提交与线程布局（课程作业脚本的写法）",
            text: `# Slurm 集群：一个节点、64 核，纯 MPI
#SBATCH -N 1
#SBATCH -n 64
#SBATCH -p amd_256
#SBATCH -t 100:00:00
module load cp2k/7.1
srun -n 64 cp2k.popt cp2k.inp 1> cp2k.out 2> cp2k.err

# 混合并行：16 进程 × 4 线程 = 64 核
export OMP_NUM_THREADS=4
mpirun -np 16 cp2k.popt cp2k.inp 1> cp2k.out 2> cp2k.err

# PBS 集群的等价写法
#PBS -l nodes=1:ppn=56,walltime=24:00:00
mpirun -n 56 cp2k.popt cp2k.inp 1> cp2k.out 2> cp2k.err`
          },
          { type: "p", text: "可执行文件的选择：`cp2k.popt` 是 MPI + OpenMP 的生产版本，日常都该用它；`cp2k.sopt` 是单进程优化版，只适合小体系与调试。`cp2k.popt -check cp2k.inp` 只解析输入、不开始计算，是提交前抓拼写错误与段名错误最快的一步。" },
          { type: "p", text: "内存的估法：对角化路线要为**全部轨道**（占据 + `ADDED_MOS`）分配矩阵，OT 路线只需要占据轨道。同样是 186 个原子，`ADDED_MOS 500` 的对角化路线轨道数是 948，OT 只有 448——内存差一倍以上。这也解释了为什么大体系倾向 OT：不只是快，是装得下。" },
          { type: "p", text: "I/O 常被忽略。轨迹、cube、pdos 都是文本或半文本格式，写盘量随频率线性增长；meta-qmmm 那个算例的 `cp2k-pos-1.xyz` 已经 262 MB，而它只是 2936 个原子、每 50 步一帧。三条经验：输出频率按分析需求设（`&EACH MD 50` 而不是 1）；cube 只在需要的单点上输出，别在 MD 里开；大规模任务把工作目录放到本地 scratch，算完再拷回网络盘。" },
          { type: "callout", kind: "warn", title: "别用一次跑通来判断并行效率", text: "同一个输入用 16 核和 64 核跑，耗时比通常不是 4:1。判断方法：固定体系，扫 8/16/32/64 核，画「耗时 − 核数」曲线，看拐点在哪。拐点之后继续加核只是分摊内存、不省时间。写论文时如果提到机时，给的是这个测试的结果，不是「用了 64 核」。" }
        ]
      },
      {
        id: "15.5", title: "论文写作：方法段、计算细节与引用",
        blocks: [
          { type: "p", text: "计算方法段的目标是让同行能复现、能判断可信度。顺序建议固定为：代码与版本 → 方法（泛函/基组/赝势/色散/+U）→ 模型（slab 层数、真空、超胞、固定层）→ 数值参数（CUTOFF、k 点、SCF 判据）→ 动力学或采样设置 → 分析工具。每一句都要有具体数值，形容词一律换成数字。" },
          {
            type: "quote",
            who: "方法段骨架（按这个顺序填，一段话讲完）",
            text: "所有计算使用 CP2K（版本 x.y）的 Quickstep 模块完成。交换关联泛函采用 PBE，价电子用 GTH 赝势描述，价电子基组为 DZVP-MOLOPT-SR-GTH，色散校正采用 DFT-D3(BJ)。Au(111) 表面用 6 层（12 × 1）超胞模拟，真空层厚度 20 Å，底部两层固定，其余原子与吸附物自由弛豫。平面波截断取 350 Ry，相对截断 60 Ry，SCF 收敛判据 1.0E-6。布里渊区采样……（金属体系此处写 k 点网格与展宽设置）。结构优化采用 BFGS，力收敛判据 4.5E-4 Ha/Bohr。从头算分子动力学采用 NVT 系综、Nose 恒温器、时间步 0.5 fs，生产段 50 ps。轨迹分析使用 TRAVIS 与本组脚本。"
          },
          { type: "p", text: "这段模板里每个空都要填自己的数，不要照抄别人的 350 Ry。尤其是 k 点与展宽——金属体系不写这两项，审稿人会直接质疑。" },
          { type: "p", text: "引用方面，CP2K 有标准的引用格式：主程序用 2014 年 WIREs 的综述，新版本另有 2020 年的综述文章，具体引哪一篇按期刊惯例与所用功能决定；用到的特定方法（如 DFT-D3、ELPA 求解器、TRAVIS）要各自加引。不要只写一句「calculations were performed with CP2K」而不给版本与引用。" },
          {
            type: "quote",
            who: "CP2K 主引用（2014）",
            text: "J. Hutter, M. Iannuzzi, F. Schiffmann, J. VandeVondele, cp2k: atomistic simulations of condensed matter systems, WIREs Comput. Mol. Sci. 4, 15–25 (2014)."
          },
          { type: "table",
            caption: "方法段自检：这六项有没有具体数值",
            head: ["项", "必须写明", "常见缺失"],
            rows: [
              ["代码", "CP2K + 版本号 + 关键编译选项", "只写 CP2K"],
              ["方法", "泛函、基组、赝势、色散、+U（含 U−J 值）", "写了 PBE 没写基组"],
              ["模型", "层数、超胞、真空厚度、固定层范围", "写了 slab 没写真空"],
              ["数值", "CUTOFF、REL_CUTOFF、k 点、EPS_SCF", "只写 CUTOFF"],
              ["动力学", "系综、恒温器、时间步、总时长、丢前多少", "写了 NVT 没写恒温器"],
              ["分析", "工具与关键参数（bin 宽、拟合区间）", "只写「分析了轨迹」"]
            ]
          },
          { type: "callout", kind: "tip", title: "把「我们注意到」换成「我们验证了」", text: "「我们对截断做了测试，结果对结论不敏感」是弱表述；「截断从 300 加到 400 Ry，吸附能变化 4 meV，小于本文讨论的 0.05 eV 差异」是强表述。审稿人读的是后者。这类句子最好直接放在讨论段的开头，先把误差范围划出来，再讲结论。" }
        ]
      },
      {
        id: "15.6", title: "常见错误速查",
        blocks: [
          {
            type: "table",
            caption: "五类高频故障：现象、原因、处理",
            head: ["现象", "最可能的原因", "处理"],
            rows: [
              ["SCF 不收敛，能量来回振荡", "金属/小带隙没开 SMEAR；mixer 步长过大；初猜太差", "开 SMEAR + ADDED_MOS；ALPHA 降到 0.05–0.1；先做一次对角化单点拿 wfn"],
              ["SCF 收敛但力很大、优化不下降", "CUTOFF/REL_CUTOFF 不足导致格点噪声；结构本身有问题", "补做收敛测试；检查是否有原子重叠"],
              ["启动即 abort：section not found / unknown keyword", "段名拼错或放错层级（如把 &SMEAR 放在 &SCF 外）", "`cp2k.popt -check cp2k.inp` 定位行号"],
              ["找不到基组/赝势/坐标文件", "用了相对路径但工作目录不同；`${DATAPATH}` 没设", "把数据文件拷进目录，或用 `@SET DATAPATH` 绝对路径"],
              ["内存爆（OOM）或进程被 kill", "对角化轨道数过多；单节点核数太多导致每核内存不足", "换 OT；减少 `ADDED_MOS`；增加节点而不是每节点加核"],
              ["MPI 挂起、不报错也不前进", "节点间通信或文件系统问题；某个 rank 在等 I/O", "换本地 scratch；减少输出频率；用 `-np` 逐级缩小复现"]
            ]
          },
          { type: "callout", kind: "warn", title: "先看 out 的头 50 行", text: "CP2K 把版本、编译选项、读到的每个输入段、最终的格点数与内存估计都写在最前面。很多「算得不对」的问题，在头 50 行里就能看出来：比如 `&KIND` 里的基组名拼错会静默回退到默认值，SCF 会照常收敛，只是结果全错。" },
          {
            type: "code", lang: "cp2k", title: "层级对不对：&SMEAR 在 &SCF 内，&MGRID 在 &DFT 内",
            text: `&FORCE_EVAL
  &DFT
    UKS T
    &MGRID
      CUTOFF 350
    &END MGRID
    &SCF
      ADDED_MOS 500
      &SMEAR ON
        METHOD FERMI_DIRAC
        ELECTRONIC_TEMPERATURE [K] 300
      &END SMEAR
    &END SCF
  &END DFT
&END FORCE_EVAL`
          },
          { type: "p", text: "CP2K 的段是严格嵌套的：`&SMEAR` 只能出现在 `&SCF` 里，`&MGRID` 只能出现在 `&DFT` 里，`&COORD`/`&KIND`/`&CELL` 只能在 `&SUBSYS` 里。放错一层，程序不会猜你的意图，直接在解析阶段 abort 并给出出错的行号——这也是为什么 `-check` 值得在每次提交前跑一次。" },
          { type: "p", text: "还有一类错误不会报 abort，只是结果悄悄变了：`&MGRID` 的 CUTOFF 写成 350 但单位被理解成别的；坐标文件被覆盖；固定层编号错位导致该固定的原子在动。判断方法是**看第一步的受力与位移**：如果「固定」的原子上出现非零力、或者第一步的力大到离谱，先回去核对坐标与编号。" },
          {
            type: "steps",
            items: [
              { t: "先跑 -check", d: "`cp2k.popt -check cp2k.inp` 只解析输入，几秒内抓出段名与层级错误。" },
              { t: "跑 2 步的短轨迹", d: "把 STEPS 改成 2 跑一次，确认能正常启动、能量合理、输出文件齐全，再交长任务。" },
              { t: "看头 50 行与尾部", d: "头部确认版本与读入的参数，尾部确认 normal termination 与总机时。" },
              { t: "grep 关键字", d: "`grep -i warn cp2k.out`、`grep -i abort cp2k.out`、`grep Fermi cp2k.out`。" }
            ]
          }
        ]
      },
      {
        id: "15.7", title: "数据管理：体积、压缩与归档",
        blocks: [
          { type: "p", text: "一次像样的 AIMD 会产出以 GB 计的轨迹和以百 MB 计的 cube。管理原则很简单：**原始数据留一份、中间数据可重建、最终图与脚本必须留**。原始轨迹丢了就再也算不回来；中间数据（g(r) 的 dat）只要有轨迹和脚本就能重生成。" },
          { type: "p", text: "体积参考（来自课程练习的真实文件）：2936 原子的 `cp2k-pos-1.xyz` 262 MB；同目录的 `cp2k-COLVAR.metadynLog` 8.3 MB、`cp2k-HILLS.metadynLog` 107 KB；`cuh2o` 目录里单个 `cp2k-MO.cube` 级别的文件 5.7 MB 一个，一次输出十几条轨道就是几十 MB。这些数字说明两件事：**cube 要按需输出**，**轨迹频率不要设成 1**。" },
          { type: "p", text: "压缩：xyz 是纯文本，`gzip` 通常能压到 1/4 左右，`xz` 更小但慢。长期归档建议 `tar` 打包后 `xz`，并保留一个未压缩的坐标首帧（方便别人快速看结构）。cube 文件压缩率更高，但注意很多可视化软件不直接读压缩包，用时先解开。" },
          {
            type: "code", lang: "bash", title: "归档一个算例：打包、校验、写清单",
            text: `# 只归档必要文件：输入、输出、ener、重启、轨迹、分析脚本与结果
tar -cf au_h2o_nvt.tar cp2k.inp cp2k.out cp2k-1.ener \\
    cp2k-pos-1.xyz cp2k-1.restart analysis/
xz -9 au_h2o_nvt.tar

# 生成校验和，交付/上传前后各查一次
sha256sum au_h2o_nvt.tar.xz > SHA256SUMS

# 写一份清单，别人拿到压缩包就知道里面有什么
ls -lh au_h2o_nvt.tar.xz
grep -c "^ *i = " cp2k-pos-1.xyz    # 帧数，配合 time 末帧核对完整性`
          },
          { type: "callout", kind: "tip", title: "给未来的自己写 README", text: "每个归档目录放一个 `README.md`：体系是什么、算什么、关键参数、哪张图对应哪个文件、已知问题。半年后你会感谢现在写这五行字的自己，审稿人索要数据时也用得上。" }
        ]
      },
      {
        id: "15.8", title: "提交前 12 项检查",
        blocks: [
          { type: "p", text: "下面这份清单按「越早发现越省钱」排序。前六项在提交前做，后六项在写论文前做。每一项都应该是能用命令或文件验证的，不是「感觉没问题」。" },
          {
            type: "steps",
            items: [
              { t: "1 输入能解析", d: "`cp2k.popt -check cp2k.inp` 无报错；段名层级正确。" },
              { t: "2 数据文件齐全", d: "基组、赝势、坐标、力场参数文件都在工作目录，路径不含别人机器上的绝对路径。" },
              { t: "3 跑通 2 步", d: "STEPS 改成 2 的短跑能正常结束，输出文件齐全，能量量级合理。" },
              { t: "4 体系物理合理", d: "最短原子间距不异常、slab 真空够厚、固定层编号与物理意图一致。" },
              { t: "5 电子结构设置匹配", d: "金属：UKS + SMEAR + ADDED_MOS；绝缘体：OT 或无展宽对角化；+U 体系：U−J 与投影方式写明。" },
              { t: "6 输出频率与机时匹配", d: "轨迹/重启的频率 × 步数 估出的体积在磁盘配额内；walltime 留有重启余量。" },
              { t: "7 收敛表齐了", d: "CUTOFF、REL_CUTOFF、k 点、基组、真空、时间步，每一项都有扫描数据与判据。" },
              { t: "8 误差预算写了", d: "讨论的每个能量差都能对上误差范围；方法误差单独说明。" },
              { t: "9 对照实验做了", d: "至少一个独立对照（换设置、换代码、换数值路线），并确认比的是同一个量。" },
              { t: "10 可复现材料齐了", d: "输入、版本、数据、脚本、种子五件套；别人按 README 能重跑。" },
              { t: "11 方法段填满", d: "六项（代码/方法/模型/数值/动力学/分析）都有具体数值。" },
              { t: "12 归档与备份", d: "原始数据有压缩归档与校验和，至少两份、不同介质。" }
            ]
          },
          { type: "callout", kind: "key", title: "这份清单的用法", text: "不要等投稿前才过一次。第 1–6 项在**每次提交作业前**过，第 7–9 项在**出结果时**过，第 10–12 项在**写论文时**过。分三次过，每次都能救回几天机时。" },
          {
            type: "keypoints",
            items: [
              "收敛 = 固定其他参数、只扫一个、对着事先写好的判据勾",
              "误差分四层：数值、模型、方法、统计；前两层靠收敛，第三层靠对照，第四层靠重复",
              "对照实验第一步是确认两边在比同一个量（比如电子熵项有没有归一）",
              "可复现五件套：输入、版本、数据、脚本、种子",
              "并行布局：总核数 = MPI × OMP，MPI 不超过物理核数；OT 省内存，对角化吃内存",
              "数据管理：原始数据留、中间数据可重建、cube 按需输出、轨迹频率按分析需求",
              "提交前 12 项分三次过：作业前、出结果时、写论文时"
            ]
          }
        ]
      }
    ],
    quiz: [
      {
        q: "做 CUTOFF 收敛测试时，正确的做法是？",
        options: ["同时调 CUTOFF 和 REL_CUTOFF，一起看总能", "先固定 REL_CUTOFF 与 NGRIDS，再单独扫 CUTOFF 看总能变化", "只看单次计算的耗时是否合理", "用文献里同体系的 CUTOFF 直接照搬"],
        answer: 1,
        explain: "两个参数都会影响能量，同时变就分不清是谁的贡献。通常先定 REL_CUTOFF/NGRIDS（收敛更快），再单独扫 CUTOFF，并以事先写好的总能判据（如 < 1e-6 Ry）判定。"
      },
      {
        q: "同一个体系，OT 给 −3101.834603 Ha，对角化给 −3101.838526 Ha。直接说「两条路线差 0.11 eV」的问题在于？",
        options: ["单位换算错了", "对角化结果含电子熵项 −TS_el，归一后两者只差约 3 meV", "OT 的结果总是偏低", "两个数不能相减"],
        answer: 1,
        explain: "开 SMEAR 后 Total energy 含 −TS_el。把 −0.004025 Ha 加回对角化结果得 −3101.834501 Ha，与 OT 相差约 1e-4 Ha。做对照实验前先确认两边比的是同一个量。"
      },
      {
        q: "论文讨论一个 0.05 eV 的吸附能差异，审稿人最可能追问的是？",
        options: ["你用了多少核", "这个差异是否大于截断、k 点与模型带来的误差", "用的什么可视化软件", "轨迹存了多少帧"],
        answer: 1,
        explain: "讨论量级小于误差时结论不可靠。需要给出误差预算：截断、k 点、超胞、方法各自的贡献，并证明 0.05 eV 大于这些误差之和或至少大于其主要项。"
      },
      {
        q: "关于并行布局，下面哪条是对的？",
        options: ["MPI 进程数越多越快，与物理核数无关", "总核数 = MPI 进程数 × 每进程线程数，且 MPI 进程数不宜超过物理核数", "OMP_NUM_THREADS 设得越大越好", "cp2k.sopt 比 cp2k.popt 更适合生产计算"],
        answer: 1,
        explain: "混合并行要按节点物理核数分配；MPI 进程超过物理核数会争抢资源。cp2k.popt 才是 MPI+OpenMP 的生产版本，sopt 是单进程优化版。"
      },
      {
        q: "SCF 在金属体系上反复振荡不收敛，最先应该检查的是？",
        options: ["把 CUTOFF 从 350 提到 1000", "是否开了 SMEAR 与足够的 ADDED_MOS，以及 mixing 的步长", "把体系原子数减少一半", "换一个可视化软件"],
        answer: 1,
        explain: "金属在费米能级处有部分占据，不开 SMEAR 会让占据数在两步之间跳变；空带不足时展宽无法正确摊电子；mixer 步长过大也会振荡。这三项是首要检查对象。"
      }
    ],
    terms: [
      { t: "收敛测试", en: "convergence test", d: "固定其他参数、只扫描一个参数，观察目标物理量的变化，并对照事先写好的判据确定取值；结论要落成表格而不是一句话。" },
      { t: "误差预算", en: "error budget", d: "把数值误差、模型误差、方法误差与统计误差逐项量化，用来判断所讨论的物理差异是否可信。" },
      { t: "可复现性", en: "reproducibility", d: "他人依据交付的输入、版本、数据、脚本与随机种子能重跑出同样结果的性质，是发表工作的最低要求。" },
      { t: "混合并行", en: "hybrid MPI/OpenMP parallelism", d: "同时使用 MPI 进程与 OpenMP 线程的并行方式，总核数为两者乘积，进程数受物理核数与每核内存限制。" },
      { t: "相对截断", en: "REL_CUTOFF", d: "控制高斯积分辅助格点划分的能量截断，与 CUTOFF、NGRIDS 配套决定格点精度，需一并做收敛测试。" },
      { t: "重启文件", en: "restart file", d: "CP2K 周期性写出的完整输入快照与波函数，用于断电或机时到限后续算；续算后轨迹时间会接着累加而不是从零开始。" }
    ],
    sources: [
      { t: "CP2K 手册：常见问题与排错", url: "https://manual.cp2k.org/trunk/getting-started/troubleshooting.html" },
      { t: "CP2K 手册：本征值求解器与 ELPA", url: "https://manual.cp2k.org/trunk/technologies/eigensolvers/elpa.html" },
      { t: "CP2K 手册：线性标度方法与大规模计算", url: "https://manual.cp2k.org/trunk/methods/dft/linear_scaling.html" },
      { t: "CP2K 手册：&SCF/&OT（轨道变换与预条件）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/SCF/OT.html" },
      { t: "CP2K 手册：&MOTION/&MD（系综、时间步与输出频率）", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD.html" }
    ]
  };
})();