(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch06"] = {
    id: "ch06",
    num: 6,
    part: "输入与体系",
    title: "GPW 网格与 CUTOFF",
    subtitle: "高斯基组配平面波网格：CUTOFF、REL_CUTOFF 的物理含义与收敛测试",
    hours: 2.5,
    level: "进阶",
    intro:
      "GPW 的聪明之处在于「该用高斯的地方用高斯，该用平面波的地方用平面波」：轨道用原子中心高斯展开，密度与势却被搬到规则网格上用 FFT 处理。网格的疏密由两个数控制——CUTOFF 管最细一层，REL_CUTOFF 管每个高斯被派到哪一层。这一章讲清它们各自管什么，并给出一套照着做就能完成的收敛测试流程。",
    goals: [
      "说清 GPW 在 Gaussian 与平面波两种表示之间来回切换的流程，以及为什么这样更快",
      "解释 CUTOFF、REL_CUTOFF、NGRIDS、PROGRESSION_FACTOR 各自控制什么",
      "读懂 MULTIGRID INFO，判断某个高斯被放到了哪一层、网格是否够细",
      "独立完成两轮收敛测试（先扫 CUTOFF 再扫 REL_CUTOFF），并给出可复现的取值",
    ],
    sections: [
      {
        id: "6.1",
        title: "GPW：两套表示，各干各的活",
        blocks: [
          {
            type: "p",
            text: "纯平面波方法把轨道也写成平面波，好处是完备、无 BSSE、FFT 快；坏处是真空区和原子间隙都要铺满波，代价高，而且芯电子附近的陡峭变化需要极高截断。纯高斯基组反过来：原子附近描述得好、真空区几乎不花代价，但泊松方程与库仑项在 Gaussian 基下要算大量四中心积分。GPW 把两者的优点拼起来。",
          },
          {
            type: "p",
            text: "流程是固定的四步：电子密度用高斯乘积表示 → **collocate**，把密度映射到规则实空间网格 → FFT 到倒空间，用平面波解泊松方程得到势 → FFT 回来，再 **integrate**，把网格上的势投影回高斯函数。整个过程里，轨道始终是高斯的，网格只承担「密度与势的中转站」。",
          },
          {
            type: "formula",
            tex: "\\rho(\\mathbf{r}) = \\sum_{\\mu\\nu} P_{\\mu\\nu}\\, \\phi_{\\mu}(\\mathbf{r})\\,\\phi_{\\nu}(\\mathbf{r})",
            caption: "密度是高斯乘积的叠加；每个乘积函数的宽度决定它该被放到哪一层网格",
          },
          {
            type: "p",
            text: "关键在第 1 步：高斯的乘积仍是高斯，宽度由两个函数的指数相加决定。芯区函数指数大、乘积很窄，需要细网格才能采样；弥散函数指数小、乘积很宽，粗网格就够。多级网格正是利用这个分布——**宽的函数放粗网格，窄的函数放细网格**，电子密度本身则永远放在最细一层。",
          },
          {
            type: "callout",
            kind: "key",
            title: "GPW 的误差有两个来源",
            text: "一是基组不完备（轨道空间不够大），二是网格不够细（密度与势的表示有误差）。前者靠换基组，后者靠 CUTOFF / REL_CUTOFF。两者互不替代，必须分别收敛。",
          },
          {
            type: "keypoints",
            items: [
              "GPW = 高斯轨道 + 平面波辅助网格；只在密度与势上做 FFT。",
              "collocate 是「高斯→网格」，integrate 是「网格→高斯」，一对互逆操作。",
              "误差分两摊：基组不完备与网格不细，各管各的。",
            ],
          },
        ],
      },
      {
        id: "6.2",
        title: "多级网格：宽函数为什么能放粗网格",
        blocks: [
          {
            type: "p",
            text: "`&MGRID` 里最重要的是三个数：`CUTOFF` 是最细一层的平面波截断能（默认单位 Ry），`NGRIDS` 是网格层数（默认 4），`PROGRESSION_FACTOR` 决定相邻层之间疏密差多少（默认 3.0）。层与层的关系是一条等比数列：",
          },
          {
            type: "formula",
            tex: "E_{\\mathrm{cut}}^{i} = E_{\\mathrm{cut}}^{1} / \\alpha^{i-1}",
            caption: "i 从最细层（1）数到最粗层（NGRIDS）；α 由 PROGRESSION_FACTOR 给出，默认 3.0，即每降一层截断能除以 3",
          },
          {
            type: "p",
            text: "把 CUTOFF 从 300 Ry 提到 400 Ry，**所有层都跟着变细**，因为层间比例固定。NGRIDS 加大则是在最粗端多接几层更粗的网格，让更多宽函数离开最细层——所以它通常让计算更快，代价是这些函数的积分略糙。课程里提到 `NGRIDS 5` 对带弥散函数的基组更快，原因就在这里：弥散函数的乘积很宽，本来就该待在粗层。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "mgrid.inp（网格设置的全部关键项）",
            text: `    &MGRID
      CUTOFF 400           # 最细层截断能，单位 Ry
      REL_CUTOFF 60        # 参考高斯的截断能，决定高斯去哪层
      NGRIDS 4             # 网格层数
      PROGRESSION_FACTOR 3.0
      COMMENSURATE F       # T 会强制各层网格可公度，覆盖上面的比例
    &END MGRID`,
          },
          {
            type: "p",
            text: "`COMMENSURATE` 打开后，程序会调整子网格使它们与最细网格可公度（便于某些 FFT 操作），代价是你设的 `PROGRESSION_FACTOR` 与各层截断被覆盖。除非有明确理由，保持关闭、用默认比例即可。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "层数不是越多越好",
            text: "每多一层就多一套 FFT 网格与一套索引结构，内存和准备时间都涨。默认 4 层对绝大多数体系够用；只有在弥散函数很多、或者体系很大且网格操作占主导时，加到 5 层才划算。改完要重新做收敛测试。",
          },
          {
            type: "keypoints",
            items: [
              "CUTOFF 是最细层，其他层按 1/α^(i-1) 自动推出。",
              "NGRIDS 增加层数，把宽函数往更粗的网格上赶，通常更快。",
              "PROGRESSION_FACTOR 改变层间比例；COMMENSURATE 会覆盖它。",
            ],
          },
        ],
      },
      {
        id: "6.3",
        title: "REL_CUTOFF：决定每个高斯去哪一层",
        blocks: [
          {
            type: "p",
            text: "CUTOFF 只说了「最细的网格有多细」，没说「哪些函数必须进最细网格」。这件事由 `REL_CUTOFF` 决定：它定义「单位标准差高斯（e^{-|r|²}）在参考网格上被平面波覆盖所需的截断能」。程序对每个高斯乘积算一个「覆盖它需要多少平面波」，然后把它放进**能覆盖它的最粗那一层**。",
          },
          {
            type: "p",
            text: "于是有两种典型误配。**REL_CUTOFF 太低**：所有高斯都被判定为「粗网格就够」，全塞进最粗一层，就算 CUTOFF 提到 800 Ry，真正参与积分的有效网格仍然很粗——能量看起来不收敛，你会误以为是 CUTOFF 不够。**REL_CUTOFF 太高**：大量中等宽度的函数被赶进细网格，计算变慢，精度却早已饱和。",
          },
          {
            type: "table",
            head: ["参数", "控制什么", "默认值", "调大的后果"],
            rows: [
              ["CUTOFF", "最细层网格的平面波截断能", "280 Ry", "所有层都更细，成本上升"],
              ["REL_CUTOFF", "每个高斯被分配到哪一层", "40 Ry", "更多函数进细网格，更准也更贵"],
              ["NGRIDS", "网格层数", "4", "更多宽函数离开细网格，通常更快"],
              ["PROGRESSION_FACTOR", "相邻层截断能之比", "3.0", "层间疏密差变大或变小"],
            ],
            caption: "四个参数默认值来自 MGRID 输入参考；单位均为 Ry",
          },
          {
            type: "p",
            text: "课程与手册给出的起点很一致：`REL_CUTOFF` 常用 50–60 Ry，表面与液体体系取 60 比较稳妥；`CUTOFF` 则要看元素——轻元素 300–400 Ry 常见，含 Na、O、F、Fe、Ni、Zn、Ga 等元素的体系，课程建议直接上到 800 Ry 量级再往下收敛。手册默认 280 Ry 只是「能跑」的起点，不是收敛值。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "CUTOFF 与 VASP 的 ENCUT 不可比",
            text: "CP2K 的 CUTOFF 作用于辅助网格上的高斯乘积，不是轨道本身的平面波展开；数值上与 VASP 的 ENCUT 没有换算关系。照搬文献里的 ENCUT 到 CP2K，通常会得到明显偏低的网格精度。",
          },
          {
            type: "keypoints",
            items: [
              "CUTOFF 管「最细多细」，REL_CUTOFF 管「谁进细网格」。",
              "REL_CUTOFF 太低会让提高 CUTOFF 失效，是最容易被误诊的坑。",
              "默认 280 / 40 Ry 是起点；生产计算按体系重新收敛。",
            ],
          },
        ],
      },
      {
        id: "6.4",
        title: "读懂 MULTIGRID INFO：高斯到底去了哪层",
        blocks: [
          {
            type: "p",
            text: "把 `PRINT_LEVEL` 提到 `MEDIUM`，输出里会出现一段 `MULTIGRID INFO`，逐层列出被分配到这个网格的高斯乘积个数与该层的截断能。这是判断「网格配置是否合理」最直接的证据，比盯着总能量猜要可靠。",
          },
          {
            type: "code",
            lang: "bash",
            title: "read_grid.sh（抽网格分配与层数）",
            text: `# 网格层数与每层截断能（a.u.，1 Ha = 2 Ry）
grep -A6 "MULTIGRID INFO" h2o.out | head -12

# 更稳的写法：只留 count / cutoff 两列的信息行
grep -E "count for grid|cutoff \\[a.u.\\]" h2o.out

# 体系一共用了几层网格
grep -E "Number of grid levels" h2o.out`,
          },
          {
            type: "p",
            text: "每行的格式大致是 `count for grid 1: 2720 cutoff [a.u.] 50.00`：层号、这一层上的函数个数、该层截断能（原子单位）。注意截断能是 **a.u.**，与输入里的 Ry 差 2 倍，别直接对比数值。要看的模式是：最细层是否真的被用上（count 不为 0），以及绝大部分函数是否落在较粗的层上。",
          },
          {
            type: "p",
            text: "一个很有用的诊断：把 CUTOFF 从 300 提到 400，如果最细层的 count 反而**变少**、能量变化也很小，说明 REL_CUTOFF 已经把该进细网格的函数送上去了，提高 CUTOFF 只是在细化一个几乎没人用的网格——这时该同步提高 REL_CUTOFF，而不是继续加 CUTOFF。",
          },
          {
            type: "demo",
            id: "grid",
            title: "多级网格与 REL_CUTOFF",
            desc: "拖动 CUTOFF 与 REL_CUTOFF，看高斯如何在不同层之间重新分配，以及最细层什么时候才真正被用上。",
          },
          {
            type: "callout",
            kind: "info",
            title: "别只看总能量",
            text: "总能量对网格误差不敏感（尤其对平滑体系），力、应力、振动频率敏感得多。做网格收敛时，如果目标性质是力或频率，就要拿那个量来收敛，而不是拿能量。",
          },
          {
            type: "keypoints",
            items: [
              "MULTIGRID INFO 给每层的函数数与截断能（a.u.）。",
              "最细层 count 为 0 = CUTOFF 白加了，该提 REL_CUTOFF。",
              "能量收敛不代表力收敛；按目标性质选判据。",
            ],
          },
        ],
      },
      {
        id: "6.5",
        title: "收敛测试：先扫 CUTOFF，再扫 REL_CUTOFF",
        blocks: [
          {
            type: "p",
            text: "两轮扫描，顺序不能反。第一轮固定 `REL_CUTOFF`（官方教程取 60 Ry，并说明这对多数计算通常足够），把 `CUTOFF` 从低到高扫一遍，看总能量什么时候不再变化。第二轮固定一个已经够大的 `CUTOFF`（教程取 250 Ry），再扫 `REL_CUTOFF`。反过来的话，第一轮里 REL_CUTOFF 可能是瓶颈，你会在错误的 CUTOFF 上收敛。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "grid_test.inp（水分子上的网格测试模板，可直接跑）",
            text: `&GLOBAL
  PROJECT grid_test
  RUN_TYPE ENERGY
  PRINT_LEVEL MEDIUM
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 300
      REL_CUTOFF 60
      NGRIDS 4
    &END MGRID
    &QS
      EPS_DEFAULT 1.0E-10
    &END QS
    &SCF
      SCF_GUESS ATOMIC
      EPS_SCF 1.0E-6
      MAX_SCF 1
      IGNORE_CONVERGENCE_FAILURE TRUE
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
    &POISSON
      PERIODIC NONE
      PSOLVER MT
    &END POISSON
  &END DFT
  &SUBSYS
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
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`MAX_SCF 1` 是这套模板的核心：只做一次迭代，不做自洽，密度基本停在初猜上。这样每次运行只花几秒，而网格对能量泛函的影响仍然能被测出来——因为能量是在给定密度上按不同网格积分的。RUN_TYPE 用 `ENERGY`，连力都不算，最省。",
          },
          {
            type: "p",
            text: "与之配套的 `IGNORE_CONVERGENCE_FAILURE TRUE` 看着刺眼：它让程序在 SCF 未收敛时继续而不是中止（见第 4 章的警告）。**只有在这种「故意只迭代一次」的网格测试里才应当这么写**——这里根本不存在收敛的电子态，我们要的就是同一初猜下不同网格的积分差异。它的存在也提醒你：从 2024.1 起，不收敛默认中止，官方教程这份模板必须加这一行才能跑完。",
          },
          {
            type: "p",
            text: "注意两个细节：&COORD 里出现的每个元素都必须有对应的 KIND（这份模板里是 H 与 O，漏一个就在启动阶段报错），而且 q 值要对上——H 是 q1、O 是 q6。网格测试虽然只关心能量，但基组与赝势一旦配错，测出来的「收敛曲线」反映的就是别人的体系。",
          },
          {
            type: "code",
            lang: "bash",
            title: "scan_cutoff.sh（扫 CUTOFF；REL_CUTOFF 固定 60）",
            text: `#!/bin/bash
# 用法：先确认当前目录有 BASIS_MOLOPT 与 GTH_POTENTIALS
export OMP_NUM_THREADS=1
for c in 200 250 300 350 400 500; do
  mkdir -p cut_$c
  sed "s/CUTOFF 300/CUTOFF $c/" grid_test.inp > cut_$c/grid.inp
  cp BASIS_MOLOPT GTH_POTENTIALS cut_$c/
  ( cd cut_$c && cp2k.ssmp -i grid.inp -o grid.out )
  printf "CUTOFF=%s  " "$c"
  grep -E "Total energy:|ENERGY\\| Total FORCE_EVAL" cut_$c/grid.out | tail -1
done`,
          },
          {
            type: "p",
            text: "把能量抄成两列表格，算相邻两档的差值。判据不是「差值小于某个魔法数」，而是「差值小于你目标性质的精度」：做能量差到 meV 量级，总能量就要收敛到 1e-6 Ha 量级；只做趋势研究，1e-4 Ha 可能就够。手册教程在它自己的 Si 体系上得到的是 CUTOFF 250 Ry 配 REL_CUTOFF 60 Ry 足以达到 1e-6 Ry 的精度，并且 REL_CUTOFF 超过 60 后能量误差已经极小——**这是那个体系的结论，你的体系必须自己扫**。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "三个必须遵守的纪律",
            text: "一，两轮扫描之间不要同时改基组或泛函；二，所有点用同一个 `MAX_SCF` 与初猜，否则差异里混进了 SCF 噪声；三，能量差要看到「平台」再停，只在两三个点上比较容易把偶然当收敛。",
          },
          {
            type: "keypoints",
            items: [
              "先固定 REL 扫 CUTOFF，再固定 CUTOFF 扫 REL；顺序反了会误判。",
              "MAX_SCF 1 + RUN_TYPE ENERGY 让每次扫描只花几秒。",
              "判据由目标精度决定；文献数值只对自己的体系成立。",
            ],
          },
        ],
      },
      {
        id: "6.6",
        title: "成本、振荡与经验起点",
        blocks: [
          {
            type: "p",
            text: "网格变细，成本主要涨在三处：FFT 的规模（随网格点数按 N log N 增长）、collocate/integrate 的映射量（随函数数 × 网格点数），以及内存（要同时存几层网格与谱系数）。所以**CUTOFF 与 REL_CUTOFF 一起涨时**成本上升最快；只涨 CUTOFF 而 REL 不变时，很多函数还留在粗层，成本涨得慢，但精度也上不去。",
          },
          {
            type: "table",
            head: ["现象", "可能原因", "处理"],
            rows: [
              ["能量随 CUTOFF 单调下降且始终不平台", "REL_CUTOFF 太低，函数都被压在粗层", "同步提高 REL_CUTOFF 再扫"],
              ["能量在两档之间来回跳", "SCF 未完全收敛；或 MAX_SCF 设得太小", "固定更严的 EPS_SCF，确认每点都收敛"],
              ["力/应力噪声大，能量却已平台", "网格对导数更敏感", "按力收敛，必要时提 REL_CUTOFF"],
              ["内存爆掉", "NGRIDS 多 + 体系大 + CUTOFF 高", "降 NGRIDS 到 4，或分块/换节点"],
              ["算得比预期慢很多", "CUTOFF 远超所需；或用了 SR 基组却配了很大的网格", "先做收敛测试再定值"],
            ],
            caption: "先分清「没收敛」与「不收敛」，两者的处理方向相反",
          },
          {
            type: "p",
            text: "经验起点：CUTOFF 从 350–400 Ry 试起（课程里表面与水的 AIMD 就用 350 Ry），REL_CUTOFF 取 50–60 Ry。如果体系含 Na、O、F、Ne、Fe、Ni、Zn、Ga 这类被课程点名「默认值远远不够」的元素，直接先试 800 Ry 量级再往下收敛。手册的 280 Ry 默认值只保证程序能跑起来，不保证你的性质收敛。",
          },
          {
            type: "p",
            text: "还有一个容易忽略的成本项：`&QS` 的 `EPS_DEFAULT`（默认 1e-10）控制所有积分阈值。把它放松到 1e-8 能省一点时间，但会引入另一层误差，与网格误差混在一起就分不清了。做收敛测试时保持它固定且偏严。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "把收敛结果写进项目笔记",
            text: "「本体系 CUTOFF 400 / REL_CUTOFF 60，能量对网格的残差 < 1e-6 Ha」——这句话比任何参数都值钱。下次同族体系直接从这里起步，只需验证一两个点，而不是重跑整轮。",
          },
          {
            type: "keypoints",
            items: [
              "成本由网格点数与映射量决定；CUTOFF 与 REL_CUTOFF 同涨最贵。",
              "能量平台但力噪声大，说明该按力收敛。",
              "经验起点只是起点，最终值必须来自自己的收敛曲线。",
            ],
          },
        ],
      },
      {
        id: "6.7",
        title: "什么时候需要 GAPW",
        blocks: [
          {
            type: "p",
            text: "GPW 的软肋在核附近：赝势把芯电子抹平了，所以密度平缓；一旦要显式处理芯电子（全电子计算），密度在原子核处急剧变化，网格再细也很难积分准。GAPW（Gaussian and Augmented Plane Waves）就是为此设计的：平滑的那部分密度仍走 GPW 的多级网格，核附近快速变化的部分改由原子中心的小网格精确积分。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "gapw.inp（全电子氧的 GAPW 片段）",
            text: `  &DFT
    &QS
      METHOD GAPW
    &END QS
    &SUBSYS
      &KIND O
        BASIS_SET SVP-MOLOPT-GGA-ae
        POTENTIAL ALL
        LEBEDEV_GRID 110
        RADIAL_GRID 80
      &END KIND
    &END SUBSYS
  &END DFT`,
          },
          {
            type: "p",
            text: "三个开关要一起给：`&QS METHOD GAPW` 切换方法，`POTENTIAL ALL` 声明不用赝势，基组换成 `-ae` 的全电子基组。每个 KIND 还可以单独设 `LEBEDEV_GRID`（角度方向点数）与 `RADIAL_GRID`（径向点数），这两个数决定原子中心积分的精度。",
          },
          {
            type: "p",
            text: "GAPW 还有一组控制「hard / soft 如何切分」的参数：`EPSFIT` 决定高斯指数怎么分到硬、软两部分（调小会把更硬的函数放进软密度，通常要配更大的 CUTOFF），`EPSRHO0` 控制硬补偿密度的范围，`EPSSVD` 是投影矩阵奇异值分解的阈值。它们与原子网格一起决定 GAPW 的精度，默认值能跑但未必够。",
          },
          {
            type: "p",
            text: "什么时候值得付这个代价？全电子计算、core-level 谱（XPS/XAS 的芯能级）、需要准确描述核附近磁性的体系，以及某些小核赝势。**普通的价电子赝势 DFT 用 GPW 更简单也更快**，不要因为「GAPW 更准」就默认打开——它准在芯区，而多数问题根本不需要芯区。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "GAPW 的体检项",
            text: "SCF 收敛后先看输出里打印的电子数是否等于体系应有值，再看能量对 `EPSFIT` / 原子网格是否敏感。这两项都稳了，再谈物理结论；GAPW 的默认参数在重元素上经常需要收紧。",
          },
          {
            type: "keypoints",
            items: [
              "GAPW = GPW 的平滑部分 + 原子中心的精确积分，专治核附近陡峭密度。",
              "启用三件套：METHOD GAPW、POTENTIAL ALL、ae 基组。",
              "只有全电子、core 谱、芯区磁性等场景才值得；常规赝势计算留在 GPW。",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "`REL_CUTOFF` 控制的是什么？",
        options: [
          "最细一层网格的平面波截断能",
          "每个高斯乘积被分配到哪一层网格",
          "相邻两层网格的疏密比例",
          "SCF 迭代的收敛阈值",
        ],
        answer: 1,
        explain: "REL_CUTOFF 定义「单位标准差高斯在参考网格上所需的截断能」，程序据此判断每个高斯乘积能被哪一层网格覆盖，并把它放进能满足条件的最粗一层。最细层截断能由 CUTOFF 控制。",
      },
      {
        q: "把 CUTOFF 从 300 Ry 提到 500 Ry，但 REL_CUTOFF 只有 20 Ry，最可能发生什么？",
        options: [
          "能量迅速收敛，因为最细层变细了",
          "大部分高斯仍留在粗层，有效网格精度几乎没变",
          "程序直接报错退出",
          "SCF 迭代次数减少一半",
        ],
        answer: 1,
        explain: "REL_CUTOFF 太低时，所有高斯都被判定为「粗网格足够」，即使最细层很细也没有函数被放进去。这正是「提高 CUTOFF 却不收敛」的典型原因，应同步提高 REL_CUTOFF。",
      },
      {
        q: "网格收敛测试的正确顺序是？",
        options: [
          "先扫 REL_CUTOFF，再扫 CUTOFF",
          "固定 REL_CUTOFF 扫 CUTOFF，再固定 CUTOFF 扫 REL_CUTOFF",
          "两个参数一起扫，画二维图",
          "只扫 CUTOFF，REL_CUTOFF 用默认值",
        ],
        answer: 1,
        explain: "先固定 REL 扫 CUTOFF，保证第一轮里网格层分配不是瓶颈；再固定一个够大的 CUTOFF 扫 REL。顺序反了会把 REL 的限制误判成 CUTOFF 不足。",
      },
      {
        q: "收敛测试模板里为什么常用 `MAX_SCF 1`？",
        options: [
          "让 SCF 更快收敛到基态",
          "跳过自洽，只保留一次迭代，从而单独观察网格对能量的影响",
          "关闭赝势",
          "强制使用 OT 方法",
        ],
        answer: 1,
        explain: "MAX_SCF 1 让密度基本停在初猜上，不做自洽循环，这样每次运行只花几秒，而不同网格设置下的能量差仍然反映网格积分误差。配合 RUN_TYPE ENERGY 最省。",
      },
      {
        q: "什么情况下应该从 GPW 切换到 GAPW？",
        options: [
          "体系很大、想省内存时",
          "需要全电子计算或 core-level 谱，核附近密度变化剧烈时",
          "使用 GTH 赝势做常规表面吸附时",
          "想加快 SCF 收敛时",
        ],
        answer: 1,
        explain: "GAPW 用原子中心积分精确处理核附近的快速变化密度，代价更高。常规价电子赝势计算用 GPW 更快，GAPW 只在全电子、芯能级谱、芯区磁性等场景才必要。",
      },
    ],
    terms: [
      { t: "GPW", en: "Gaussian and Plane Waves", d: "用高斯基组展开轨道、用平面波辅助网格处理密度与势的混合方法。" },
      { t: "collocate", en: "collocation", d: "把高斯表示的密度映射到规则实空间网格上的操作，是 FFT 前的准备。" },
      { t: "多级网格", en: "multigrid", d: "按函数宽度把高斯乘积分配到疏密不同的多层网格，宽函数用粗网格、窄函数用细网格。" },
      { t: "截断能", en: "cutoff energy", d: "平面波表示的截断动能，决定网格能分辨的最小尺度；CP2K 中默认单位 Ry。" },
      { t: "参考截断", en: "relative cutoff", d: "判断每个高斯乘积需要多细网格的参考能量尺度，决定其被分配到哪一层。" },
      { t: "网格层数", en: "number of grids", d: "&MGRID 的 NGRIDS，多级网格的层数，默认 4。" },
      { t: "GAPW", en: "Gaussian and Augmented Plane Waves", d: "在 GPW 基础上增加原子中心精确积分的方案，用于全电子与芯区敏感计算。" },
    ],
    sources: [
      { t: "GPW — Gaussian and Plane Waves", url: "https://manual.cp2k.org/trunk/methods/dft/gpw.html" },
      { t: "Cutoff and Relative Cutoff", url: "https://manual.cp2k.org/trunk/methods/dft/cutoff.html" },
      { t: "Input Reference: MGRID", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/MGRID.html" },
      { t: "Input Reference: QS", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/QS.html" },
    ],
  };
})();