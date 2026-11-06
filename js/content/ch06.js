(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch06"] = {
    id: "ch06",
    num: 6,
    part: "DFT 核心",
    title: "GPW 与网格：CUTOFF 到底在控制什么",
    subtitle: "轨道用高斯算，密度和势用网格算——两套表示怎么接上，参数怎么收敛",
    hours: 2,
    level: "进阶",
    intro:
      "GPW 是 CP2K 的招牌。它的关键取舍是：分子轨道用原子中心高斯展开，电子密度和静电势却搬到规则网格上，用 FFT 解泊松方程。这一章讲清这两套表示怎么衔接，CUTOFF、REL_CUTOFF、NGRIDS 各自管什么，以及怎么用两步扫描把网格参数收敛到你要的精度。",
    goals: [
      "说清 GPW 里 collocation 与 integration 各做什么，以及为什么这样能省掉四中心积分",
      "判断什么体系必须从 GPW 换成 GAPW，并写出对应的 &QS 与 &KIND 设置",
      "解释 CUTOFF 与 REL_CUTOFF 的区别，说出两者的默认值并指出各自控制什么",
      "设计并执行一次两步收敛测试，从 MULTIGRID INFO 里读出高斯被分到了哪一层",
    ],
    sections: [
      {
        id: "6.1",
        title: "为什么不直接算四中心积分",
        blocks: [
          {
            type: "p",
            text: "Kohn–Sham 方程里最贵的是库仑项。电子密度是两个基函数的乘积，而在高斯基组下，四个基函数指标凑成的四中心积分既难算，周期性体系还要对无穷多镜像求和。CP2K 的解法很务实：==不在高斯基下算库仑项==，把密度搬到一张规则网格上，用 FFT 解泊松方程，再把势搬回来。",
          },
          {
            type: "p",
            text: "这两次搬运各有名字。密度从高斯表示转到网格叫 **collocation**（配置）；势从网格表示转成高斯基下的矩阵元叫 **integration**（积分）。中间夹着一次正变换、一次泊松求解、一次逆变换。整个流程是 GPW 的全部秘密，也是后面所有 cutoff 参数的由来。",
          },
          {
            type: "steps",
            items: [
              { t: "Collocate", d: "把电子密度（双中心高斯乘积的叠加）采样到规则实空间网格上" },
              { t: "FFT", d: "网格上的密度做快速傅里叶变换，进入倒空间，变成平面波系数" },
              { t: "Poisson", d: "在倒空间逐点乘以 $1/k^2$ 解泊松方程，得到静电势的平面波表示" },
              { t: "Integrate", d: "逆变换回实空间，再把势与基函数乘积做积分，得到哈密顿量矩阵元" },
            ],
          },
          {
            type: "key",
            items: [
              { k: "collocation", v: "密度 GTO → 网格；精度由网格密度（也就是 CUTOFF）决定", tag: "概念" },
              { k: "integration", v: "势 网格 → GTO 矩阵元；同样受网格密度限制", tag: "概念" },
              { k: "FFT + Poisson", v: "在倒空间逐点求解，成本随网格点数按 N log N 增长", tag: "概念" },
              { k: "GPW", v: "Gaussian and Plane Waves：高斯基 + 平面波辅助网格的混合表示", tag: "概念" },
            ],
          },
          {
            type: "callout",
            kind: "info",
            title: "网格不负责波函数",
            text: "这套表示里，网格只承载**电子密度和势**，轨道本身始终是高斯基下的系数。所以把 CUTOFF 调到很高，并不会让一个 SZV 基组变得准确——基组误差和网格误差是两件独立的事，第 7 章专门处理前者。",
          },
        ],
      },
      {
        id: "6.2",
        title: "GPW 与 GAPW：什么时候必须换",
        blocks: [
          {
            type: "p",
            text: "高斯基组在原子核附近非常尖，密度在核区变化剧烈。要让网格直接表示这种尖峰，就得把最细网格做得极细，代价难以接受。**GAPW**（Gaussian Augmented Plane Waves）的做法是把密度拆成两部分：平滑的那部分照旧放网格上，核附近快速变化的那部分用原子中心函数解析处理。",
          },
          {
            type: "p",
            text: "所以选择很直接：**价电子赝势 + 常规凝聚相计算，用 GPW**；**全电子、core-level 谱、需要小核赝势或磁性细节，才用 GAPW**。GAPW 更贵，也需要更多参数，不要因为它名字里多一个字母就默认更准。",
          },
          {
            type: "compare",
            left: {
              title: "GPW（默认）",
              items: [
                "METHOD 不写就是 GPW",
                "配 GTH 赝势，只显式处理价电子",
                "网格只表示平滑密度，成本低",
                "几何优化、分子动力学、常规性质计算的主力",
              ],
            },
            right: {
              title: "GAPW（全电子/核区）",
              items: [
                "&QS 里写 METHOD GAPW",
                "配全电子基组（后缀 -ae）与 POTENTIAL ALL",
                "核区密度用原子中心函数解析处理",
                "成本更高，参数更多，只在必要时用",
              ],
            },
          },
          {
            type: "code",
            lang: "cp2k",
            title: "GAPW 与全电子 KIND（片段，其余部分同 3 章输入）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT_UZH
    &QS
      METHOD GAPW
    &END QS
  &END DFT
  &SUBSYS
    &KIND O
      BASIS_SET SVP-MOLOPT-GGA-ae
      POTENTIAL ALL
      LEBEDEV_GRID 110
      RADIAL_GRID 80
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "GAPW 的精度由几个容差控制：**EPSFIT** 决定高斯指数怎么分成硬/软两部分，放松它会把更硬的函数塞进平滑密度，通常逼着你提高 CUTOFF；**EPSRHO0** 控制核区补偿密度的范围；**EPSSVD** 是投影矩阵的奇异值阈值。每个 kind 还有自己的原子中心积分网格 LEBEDEV_GRID 与 RADIAL_GRID。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "换 GAPW 后先查电子数",
            text: "全电子计算最容易出的事故是电子数不对：忘记把 POTENTIAL 从 GTH-PBE-q6 改成 ALL，或者基组还是价电子基组。跑完先看输出打印的总电子数是否符合元素的中性原子电子数，再谈能量。",
          },
        ],
      },
      {
        id: "6.3",
        title: "CUTOFF：最细网格的截断能",
        blocks: [
          {
            type: "p",
            text: "网格能表示多细的结构，由截断能决定。**CUTOFF 是最细那一层网格的平面波截断能**，单位是 Ry，控制实空间网格的间距。它对应一个最大波矢 $k_{\\max}$，超过这个波矢的密度起伏会被直接丢掉。",
          },
          {
            type: "formula",
            tex: "E_{\\mathrm{cut}} = \\frac{\\hbar^2 k_{\\max}^2}{2m}",
            caption: "截断能与最大波矢的关系；k_max 越大，网格越密",
          },
          {
            type: "p",
            text: "实空间网格间距大致是 $h \\approx \\pi / k_{\\max}$。因为 $k_{\\max} \\propto \\sqrt{E_{\\mathrm{cut}}}$，==CUTOFF 提高 4 倍，网格间距只缩小 2 倍==，但三维网格点数按 $E_{\\mathrm{cut}}^{3/2}$ 增长。这就是后面成本曲线陡峭的原因。",
          },
          {
            type: "table",
            head: ["参数", "默认值", "管什么"],
            rows: [
              ["CUTOFF", "280 Ry", "最细网格的平面波截断能，决定网格间距"],
              ["REL_CUTOFF", "40 Ry", "参考高斯所需的截断能，决定基函数乘积被分到哪一层"],
              ["NGRIDS", "4", "多级网格的层数"],
              ["PROGRESSION_FACTOR", "3.0", "相邻两层 cutoff 的比例 α"],
            ],
            caption: "&MGRID 里四个参数的分工（默认值以当前手册为准）",
          },
          {
            type: "p",
            text: "注意默认值只是「能跑」。280 Ry 对很多体系够用，但你要报告的吸附能差、相变能差常常在毫电子伏量级，必须针对自己的体系做收敛测试。手册在 CUTOFF 的说明里写得很清楚：提高它改善的是网格表示，==它不能替代收敛高斯基组==。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "先看能量，再看力",
            text: "能量对 CUTOFF 通常比较宽容，力和应力更敏感，因为力的收敛依赖密度梯度。如果只做了能量收敛测试，却要拿去做几何优化或声子，就把判据再收紧一档。",
          },
        ],
      },
      {
        id: "6.4",
        title: "REL_CUTOFF 与多级网格",
        blocks: [
          {
            type: "p",
            text: "不是所有东西都需要最细的网格。宽而平滑的高斯只需粗网格就能表示，尖锐的高斯才需要细网格。CP2K 因此用**多级网格**（multigrid）：建 NGRIDS 层，每层的截断能按固定比例递减。",
          },
          {
            type: "formula",
            tex: "E_{\\mathrm{cut}}^{(i)} = \\frac{E_{\\mathrm{cut}}^{(1)}}{\\alpha^{\\,i-1}}",
            caption: "第 i 层的截断能；α 就是 PROGRESSION_FACTOR，默认 3.0",
          },
          {
            type: "p",
            text: "举个例子：CUTOFF 300 Ry、NGRIDS 4、α=3，四层的截断能依次是 300、100、33、11 Ry。电子密度永远放在最细层；每个基函数乘积则被放到「刚好能容纳它」的最粗一层。层与层之间靠这套分配省下大量 FFT 时间。",
          },
          {
            type: "p",
            text: "**REL_CUTOFF 就是这套分配的判据**。手册的定义是：单位指数高斯（$e^{-|\\mathbf{r}|^2}$）在参考网格上表示所需的平面波截断能。程序把每个高斯放到「覆盖它的网格点数不少于参考网格上单位高斯点数」的最粗一层。指数越大、越尖的高斯，就越需要往细层走。",
          },
          {
            type: "p",
            text: "这就解释了两个参数为什么必须分开调。**CUTOFF 决定最细层有多细，REL_CUTOFF 决定有多少高斯被送上细层**。只加 CUTOFF 而不加 REL_CUTOFF，等于把每一层都变细了一点，但高斯仍然按旧判据留在粗层——有效积分网格并没有跟上。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "最反直觉的坑",
            text: "REL_CUTOFF 设得太低时，所有高斯都挤在最粗那层。此时你把 CUTOFF 从 300 提到 500，总能量几乎不动，于是误以为「已经收敛」。实际上限制精度的是粗层的密度积分。教程里的经验是：多数计算从 REL_CUTOFF 60 起步。",
          },
          {
            type: "demo",
            id: "grid",
            title: "多级网格与 REL_CUTOFF",
            desc: "拖动 cutoff 与 REL_CUTOFF，看四层网格上各有多少高斯，以及能量误差怎么随两者变化。",
          },
        ],
      },
      {
        id: "6.5",
        title: "收敛测试：固定一个，扫另一个",
        blocks: [
          {
            type: "p",
            text: "两个参数不能一起扫，否则你分不清误差来自哪。手册给的标准流程是**两步**：先把 REL_CUTOFF 固定在 60，扫 CUTOFF；再把 CUTOFF 固定在一个够用的值上，扫 REL_CUTOFF。每一步只动一个变量，其余全部冻结。",
          },
          {
            type: "steps",
            items: [
              { t: "固定 REL_CUTOFF", d: "从 60 Ry 起步，先别管它；SCF 与基组也全部固定" },
              { t: "扫 CUTOFF", d: "例如 200、250、300、350、400 Ry，每个值单独建目录跑一遍" },
              { t: "画能量曲线", d: "以 CUTOFF 为横轴、总能量相对最后一个值的差为纵轴，找到进入平台的拐点" },
              { t: "固定 CUTOFF 再扫 REL_CUTOFF", d: "例如 40、50、60、70、80 Ry，同样看平台" },
              { t: "回代验证", d: "用最终选定的组合再跑一次，确认两次单独收敛的结果互不打架" },
            ],
          },
          {
            type: "code",
            lang: "cp2k",
            title: "cutoff_scan.inp",
            text: `&GLOBAL
  PROJECT cutoff_scan
  PRINT_LEVEL MEDIUM
&END GLOBAL
&FORCE_EVAL
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 300
      REL_CUTOFF 60
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
            text: "把上面这份输入存成 cutoff_scan.inp，然后用脚本批量替换 CUTOFF 那一行。为了把行数留给关键参数，这里省略了默认值：METHOD Quickstep、RUN_TYPE ENERGY、NGRIDS 4、SCF_GUESS ATOMIC 都是默认设置。注意 EPS_SCF 要比你想分辨的能量差更紧——判据是 1e-6 Ry 时，SCF 收敛到 1e-5 显然不够。",
          },
          {
            type: "code",
            lang: "bash",
            title: "扫描 CUTOFF 的最小脚本",
            text: `: > energies.dat
for cut in 200 250 300 350 400; do
  mkdir -p cut_$cut
  sed "s/CUTOFF 300/CUTOFF $cut/" cutoff_scan.inp > cut_$cut/cutoff.inp
  ( cd cut_$cut && cp2k.popt -o cutoff.out cutoff.inp > /dev/null )
  echo -n "$cut " >> energies.dat
  grep -m1 "Total energy" cut_$cut/cutoff.out | sed "s/.*Total energy: *//" >> energies.dat
done
cat energies.dat`,
          },
          {
            type: "table",
            head: ["轮次", "固定", "扫描", "看什么"],
            rows: [
              ["第一轮", "REL_CUTOFF 60", "CUTOFF 200 → 400 Ry", "能量进入平台的位置"],
              ["第二轮", "CUTOFF 取第一轮的值", "REL_CUTOFF 40 → 80 Ry", "平台是否随 REL 平移"],
              ["验证", "两者取平台起点", "再各推进一步", "差值是否小于目标精度"],
            ],
            caption: "两步扫描的安排；每轮只动一个参数",
          },
          {
            type: "callout",
            kind: "tip",
            title: "判据写成数字",
            text: "不要凭「曲线看起来平了」下结论。先把目标精度定下来（例如总能收敛到 1e-6 Ry、相对能量到 1e-4 eV），再看相邻两个点的差值有没有小于它。之后所有生产计算都沿用这组参数，并在文章的方法部分写清楚。",
          },
        ],
      },
      {
        id: "6.6",
        title: "成本：为什么 cutoff 是立方级的钱",
        blocks: [
          {
            type: "p",
            text: "三维网格的点数正比于 $k_{\\max}^3$，也就是正比于 $E_{\\mathrm{cut}}^{3/2}$；每步 FFT 还要乘一个 $\\log N$。所以把 CUTOFF 翻倍，最细层的计算量大致涨到 2.8 倍以上，而不是 2 倍。分子动力学里这个差别会被成千上万步放大。",
          },
          {
            type: "p",
            text: "REL_CUTOFF 的代价走另一条路。它不改变最细层的网格，却决定有多少高斯乘积被送到细层上做 collocation 与 integration。REL_CUTOFF 每提高一档，细层上的高斯数增加，这部分成本随之上升，但通常比直接抬 CUTOFF 便宜。",
          },
          {
            type: "p",
            text: "PROGRESSION_FACTOR 是省钱的旋钮：把它从 3 调到 4，粗层更粗，层间落差更大，省时间；但太粗会让平滑密度表示不足，误差以另一种方式回来。手册建议改动后重新做一次 6.5 的收敛测试，而不是照搬别人的数值。",
          },
          {
            type: "code",
            lang: "bash",
            title: "看高斯落在哪一层",
            text: `grep -A8 "MULTIGRID INFO" cutoff.out
grep "count for grid" cutoff.out
grep "Total number of grids" cutoff.out`,
          },
          {
            type: "p",
            text: "输出里的 MULTIGRID INFO 会逐层列出该层的 cutoff（单位是 a.u.，注意 1 Ha = 2 Ry）和分到这一层的高斯乘积数目。教程里还有一个反直觉的观察：只提高 CUTOFF 时，落到最细层的高斯反而变少，因为层间比例固定而 REL_CUTOFF 没动。这正说明两个参数要一起看。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "只看网格分配的小技巧",
            text: "把 MAX_SCF 设成 1，SCF 只做一次迭代就停，几秒钟就能跑完。这时能量没有意义，但 MULTIGRID INFO 已经完整打印。用它快速比较不同 CUTOFF/REL_CUTOFF 下的高斯分配，比等完整自洽快得多。",
          },
        ],
      },
      {
        id: "6.7",
        title: "上手前的检查清单",
        blocks: [
          {
            type: "p",
            text: "网格参数是最容易被继承下来、也最容易被忽略的一组设置。别人输入里的 CUTOFF 400 未必适合你的体系：盒子大小、元素种类、是否有真空层、要不要算力，都会改变答案。下面是交付前应该过一遍的清单。",
          },
          {
            type: "keypoints",
            items: [
              "CUTOFF 只管密度与势的网格表示，不能弥补基组不足；两者要各自收敛",
              "REL_CUTOFF 决定高斯被分配到哪一层，与 CUTOFF 独立；只调一个会卡在假平台上",
              "默认值 CUTOFF 280 Ry、REL_CUTOFF 40 Ry、NGRIDS 4、α=3.0 只是起点",
              "收敛顺序固定：先冻结 REL_CUTOFF 扫 CUTOFF，再冻结 CUTOFF 扫 REL_CUTOFF",
              "能量收敛了不等于力收敛；做优化或动力学时把判据再收紧",
              "全电子与 core-level 计算才需要 GAPW，普通价电子用 GPW",
            ],
          },
          {
            type: "table",
            head: ["症状", "可能原因", "对策"],
            rows: [
              ["CUTOFF 提高 100 Ry，能量几乎不动", "REL_CUTOFF 太低，高斯都留在粗层", "把 REL_CUTOFF 提到 60 以上再扫"],
              ["能量随 CUTOFF 剧烈跳动", "SCF 没收敛，或 EPS_SCF 太松", "收紧 EPS_SCF 后重跑"],
              ["换 GAPW 后电子数不对", "POTENTIAL 仍写 GTH 赝势名，或基组不是 -ae", "改成 POTENTIAL ALL 与全电子基组"],
              ["MD 每一步都很慢", "CUTOFF 或 REL_CUTOFF 按单点精度设得过高", "按目标性质重新收敛，别照搬"],
            ],
            caption: "网格相关的典型症状与处理",
          },
          {
            type: "callout",
            kind: "key",
            title: "一句话记住",
            text: "CUTOFF 决定网格最细能到多细，REL_CUTOFF 决定哪些东西值得用这么细的网格。两个都收敛了，GPW 的辅助表示才不拖后腿。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "把 CUTOFF 从 300 Ry 提高到 600 Ry，直接改善的是什么？",
        options: [
          "高斯基组的完备性",
          "电子密度与静电势在网格上的表示精度",
          "赝势的精度",
          "SCF 的收敛速度一定变快",
        ],
        answer: 1,
        explain:
          "CUTOFF 控制的是 collocation 与 integration 的网格密度，也就是密度和势的表示。轨道仍然由高斯基组展开，基组误差不会因为提高 CUTOFF 而消失。",
      },
      {
        q: "REL_CUTOFF 在多级网格里的作用是？",
        options: [
          "设定最细层网格的截断能",
          "决定网格层数",
          "给出参考高斯所需的截断能，从而决定每个基函数乘积被放到哪一层",
          "控制 SCF 的混合步长",
        ],
        answer: 2,
        explain:
          "REL_CUTOFF 是单位指数高斯在参考网格上所需的截断能。程序据此判断每个高斯乘积「至少要哪一层的网格才够用」，把它放到满足条件的最粗一层。",
      },
      {
        q: "只提高 CUTOFF 而不动 REL_CUTOFF，最可能发生什么？",
        options: [
          "能量迅速收敛到基组极限",
          "高斯仍按旧判据留在粗层，有效积分网格偏粗，能量收敛很慢甚至出现假平台",
          "SCF 一定不收敛",
          "赝势失效",
        ],
        answer: 1,
        explain:
          "层间比例固定时，把最细层变细并不会自动把高斯推上细层；分配判据仍由 REL_CUTOFF 决定。教程里甚至能看到最细层的高斯数随 CUTOFF 增大而减少。",
      },
      {
        q: "手册推荐的两步收敛顺序是？",
        options: [
          "同时扫描 CUTOFF 与 REL_CUTOFF",
          "先固定 REL_CUTOFF 扫 CUTOFF，再固定 CUTOFF 扫 REL_CUTOFF",
          "先固定 CUTOFF 扫 REL_CUTOFF，再固定 REL_CUTOFF 扫 CUTOFF",
          "先扫 NGRIDS，再扫 PROGRESSION_FACTOR",
        ],
        answer: 1,
        explain:
          "一次只动一个变量才能归因。先固定 REL_CUTOFF（例如 60）找到 CUTOFF 的平台，再固定这个 CUTOFF 去扫 REL_CUTOFF，最后回代验证。",
      },
      {
        q: "某计算设 CUTOFF 270 Ry、NGRIDS 4、PROGRESSION_FACTOR 3.0，第二层网格的截断能是多少？",
        options: ["135 Ry", "90 Ry", "30 Ry", "67.5 Ry"],
        answer: 1,
        explain:
          "第 i 层是 $E^{(1)}/\\alpha^{i-1}$。i=2 时为 270/3 = 90 Ry；第三层 30 Ry，第四层 10 Ry。",
      },
    ],
    terms: [
      { t: "GPW", en: "Gaussian and Plane Waves", d: "高斯基组描述轨道、平面波网格描述密度与势的混合方法，是 CP2K Quickstep 的默认框架。" },
      { t: "collocation", en: "collocation", d: "把高斯基下的电子密度采样到规则实空间网格上的步骤，精度由网格密度决定。" },
      { t: "integration", en: "integration", d: "把网格上的势转成高斯基下矩阵元的步骤，与 collocation 互为逆过程。" },
      { t: "CUTOFF", en: "plane-wave cutoff", d: "最细一层网格的平面波截断能，单位 Ry，决定实空间网格间距。" },
      { t: "REL_CUTOFF", en: "relative cutoff", d: "参考高斯（指数为 1）所需的截断能，用来决定每个基函数乘积分配到哪一层网格。" },
      { t: "多级网格", en: "multigrid", d: "按固定比例递减截断能建成的多层网格，平滑函数放粗层、尖锐函数放细层。" },
      { t: "GAPW", en: "Gaussian Augmented Plane Waves", d: "GPW 的扩展，把核区快速变化的密度交给原子中心函数解析处理，用于全电子与小核赝势计算。" },
    ],
    sources: [
      { t: "GPW 方法（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/gpw.html" },
      { t: "GAPW 方法（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/gapw.html" },
      { t: "Cutoff 与多级网格（手册）", url: "https://manual.cp2k.org/trunk/methods/dft/cutoff.html" },
      { t: "&MGRID 输入参考", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/MGRID.html" },
    ],
  };
})();