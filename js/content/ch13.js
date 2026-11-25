(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch13"] = {
    id: "ch13",
    num: 13,
    part: "后处理",
    title: "轨迹后处理：从 xyz 到曲线",
    subtitle: "把 cp2k-pos-1.xyz 变成 RDF、MSD、扩散系数和密度剖面",
    hours: 3.0,
    level: "高级",
    intro: "一次 AIMD 跑完，目录里最占地方的是 cp2k-pos-1.xyz，而它本身只是一堆坐标。这一章把这些坐标变成 RDF、MSD、扩散系数、振动谱和密度剖面——判断体系对不对，靠的就是这几条曲线。电子结构交给第 14 章，振动、热化学与自由能交给第 15 章。",
    goals: [
      "打开 &MOTION%&PRINT 里的轨迹、速度与 restart 三个开关，并算清一条轨迹要吃掉多少磁盘。",
      "在 VMD 里设盒子、wrap、建多帧表示，量键长键角，并知道 RDF 与 MSD 对 pbc 的顺序要求正好相反。",
      "从轨迹算出 RDF 与配位数、多参考帧 MSD 与扩散系数、VACF 与振动谱。",
      "沿 z 做密度剖面看懂固液界面，并说出每一步顺序搞错会得到什么假结果。"
    ],
    sections: [
      {
        id: "13.1",
        title: "这一章在整门课里的位置",
        blocks: [
          {
            type: "p",
            text: "一次水盒子的 AIMD 跑完，工作目录里最有价值的是两个文件：`cp2k-1.ener` 记能量与温度，`cp2k-pos-1.xyz` 记每一帧的坐标。前者几百 KB，后者几十到几百 MB。本章从后一个文件出发，把结构信息变成四类曲线：径向分布函数、均方位移与扩散系数、振动谱、密度剖面。"
          },
          {
            type: "table",
            head: ["产物", "典型文件", "常用工具", "去哪一章"],
            rows: [
              ["轨迹与速度", "cp2k-pos-1.xyz、cp2k-vel-1.xyz", "VMD、TRAVIS、自己的脚本", "第 13 章（本章）"],
              ["能量与温度的时间序列", "cp2k-1.ener", "grep 提取后 Origin 作图", "第 13 章"],
              ["电荷密度、DOS、能带", "cube 文件、cp2k.out 里的 pdos 段", "VMD、Multiwfn", "第 14 章"],
              ["频率、热化学、自由能面", "cp2k.out、HILLS 与 COLVAR", "molden、VMD、Origin", "第 15 章"]
            ]
          },
          {
            type: "p",
            text: "本章的写法统一：先给出能直接贴进终端的命令或输入，再解释每个参数在改什么。所有 shell 命令在 pwsh 与 bash 下通用，只有路径分隔符要按系统改。VMD 那几行属于 VMD 的 Tk Console（菜单 Extensions → Tk Console），不能粘到系统终端里。"
          },
          {
            type: "p",
            text: "后处理的前提是采样足够。MD 给出的是一条轨迹，你要的却是系综平均：时间上取够长，条件允许时再取几个独立副本。一条几皮秒的轨迹只落在一个局部构型上，偶尔还会碰上小概率事件，直接读出来的数就不能当结论。所以本章每一条曲线都带一个前提——先确认轨迹平衡了，再谈统计。"
          },
          {
            type: "list",
            items: [
              "学会从 &MOTION%&PRINT 精确控制输出什么、每隔几步输出一次。",
              "学会在 VMD 里把盒子设对、把分子贴回盒内、把多帧叠在一张图上。",
              "学会用一条轨迹算出 RDF、配位数、MSD、扩散系数、VACF 和密度剖面。",
              "学会判断一条轨迹到底平衡了没有，以及每一步顺序错了会出什么假峰。"
            ]
          },
          {
            type: "callout",
            kind: "info",
            title: "先把环境备齐",
            text: "本章会用到 VMD（免费，需注册下载）、TRAVIS（可选，Linux 下编译）、Python 的 numpy。TRAVIS 不是必需品：RDF、MSD、VACF 都能用 numpy 自己算，本章给出的脚本就是第三条路。"
          }
        ]
      },
      {
        id: "13.2",
        title: "轨迹从哪里来：三个开关",
        blocks: [
          {
            type: "p",
            text: "CP2K 默认就会写 `cp2k-pos-1.xyz`，格式是 XMOL，也就是最常见的 xyz：第一行原子数、第二行注释、之后每行一个原子。它**不带晶胞信息**，所以 VMD 打开后看到的是散落的分子，需要你手动告诉它盒子多大。这一点在 13.3 会变成一条硬规则。"
          },
          { type: "h3", text: "一个能跑的水盒子" },
          {
            type: "p",
            text: "上半是电子结构，写法与第 11 章完全一致，差别只在 `RUN_TYPE MD`。起始结构从 `start.xyz` 读：16 个水分子放进边长 7.82 Å 的立方盒，每个分子摊到约 30 Å³，对应密度 1 g/cm³ 左右。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_md.inp（上半：电子结构）",
            text: `&GLOBAL
  PROJECT h2o_md
  RUN_TYPE MD
  PRINT_LEVEL LOW
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &MGRID
      CUTOFF 400
    &END MGRID
    &SCF
      SCF_GUESS ATOMIC
      EPS_SCF 1.0E-6
      MAX_SCF 30
      &OT
        MINIMIZER DIIS
      &END OT
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 7.82 7.82 7.82
    &END CELL
    &TOPOLOGY
      COORD_FILE_NAME start.xyz
      COORD_FILE_FORMAT XYZ
    &END TOPOLOGY
    &KIND H
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
    &KIND O
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`
          },
          {
            type: "p",
            text: "下半是运动部分。NVT 加 Nosé–Hoover 是 AIMD 里用得最多的一种组合；`TIMECON` 是热浴与体系交换能量的时间常数，单位写 `[wavenumber_t]`，数值越大耦合越弱。步长 0.5 fs 的来历是：水 O–H 伸缩在 3300–3600 cm⁻¹，周期约 10 fs，取周期的 1/20。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o_md.inp（下半：&MOTION）",
            text: `&MOTION
  &MD
    ENSEMBLE NVT
    TIMESTEP 0.5
    STEPS 40000
    TEMPERATURE 330.0
    &THERMOSTAT
      TYPE NOSE
      &NOSE
        TIMECON 1000
      &END NOSE
    &END THERMOSTAT
  &END MD
  &PRINT
    &TRAJECTORY
      &EACH
        MD 5
      &END EACH
    &END TRAJECTORY
  &END PRINT
&END MOTION`
          },
          { type: "h3", text: "打印开关与磁盘预算" },
          {
            type: "p",
            text: "`&EACH MD 5` 的意思是每 5 个 MD 步写一帧。步长 0.5 fs 时一帧 2.5 fs，上面那个 40000 步的输入正好 8000 帧、20 ps。想要自带晶胞的格式，把 FORMAT 换成 PDB，VMD 直接读得懂；想要 ASE、OVITO 认的格式用 EXTXYZ，手册对它的说明是 including cell information。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "&MOTION%&PRINT：轨迹、速度、restart 一起开",
            text: `&MOTION
  &PRINT
    &TRAJECTORY
      FORMAT EXTXYZ
      FILENAME h2o_traj
      &EACH
        MD 5
      &END EACH
    &END TRAJECTORY
    &VELOCITIES
      FORMAT XYZ
      &EACH
        MD 5
      &END EACH
    &END VELOCITIES
    &RESTART_HISTORY
      &EACH
        MD 500
      &END EACH
    &END RESTART_HISTORY
  &END PRINT
&END MOTION`
          },
          {
            type: "table",
            head: ["文件名", "内容", "什么时候看它"],
            rows: [
              ["cp2k-pos-1.xyz", "每帧坐标，默认 XMOL 格式", "RDF、MSD、VMD 看动画"],
              ["cp2k-vel-1.xyz", "每帧速度", "VACF、动能分解"],
              ["cp2k-1.ener", "每步的 Kin.、Temp、Pot.、Cons Qty", "判断平衡、检查能量漂移"],
              ["cp2k-1.restart", "最新一次续算文件", "中断后接着跑"],
              ["cp2k-1_****.restart", "按 RESTART_HISTORY 间隔存的快照", "回头改参数重跑"]
            ]
          },
          {
            type: "callout",
            kind: "tip",
            title: "磁盘预算怎么算",
            text: "练习里 Au-H2O 那条 10 万步、0.5 fs 的轨迹，cp2k-pos-1.xyz 实际是 55836100 字节，五十多 MB。&EACH MD 从 1 改成 5，文件直接掉到五分之一；改成 10 再掉一半。另一大块是波函数：在 &DFT%&PRINT 里加 &RESTART OFF，能省掉每个 MD 步的波函数快照。"
          },
          {
            type: "p",
            text: "`&MOTION%&MD%&REFTRAJ` 是另一条路：它不写轨迹文件，而是每步拿当前结构与一个参考轨迹逐帧比对，直接给出能量、力或均方位移。写的时候 `LAST_SNAPSHOT` 必须显式给出，否则运行到最后会报 Unexpected EOF；`WRAP` 默认 NONE，需要缠绕时明确写 POSITIVE 或 CENTRAL。"
          },
          {
            type: "code",
            lang: "cp2k",
            title: "边跑边算：&REFTRAJ",
            text: `&MOTION
  &MD
    &REFTRAJ
      EVAL ENERGY
      TRAJ_FILE_NAME h2o_traj.xyz
      CELL_FILE_NAME h2o_traj.cell
      WRAP CENTRAL
      STRIDE 1
      FIRST_SNAPSHOT 1
      LAST_SNAPSHOT 4000
    &END REFTRAJ
  &END MD
&END MOTION`
          },
          {
            type: "demo",
            id: "md",
            title: "动手：采样间隔与时间步",
            desc: "在 MD 演示里改 TIMESTEP 与 &EACH 的间隔，看总仿真时间、帧数与磁盘占用三者的取舍；再体会步长取到振动周期的 1/5 会怎样。"
          }
        ]
      },
      {
        id: "13.3",
        title: "VMD：先把盒子设对",
        blocks: [
          {
            type: "p",
            text: "打开轨迹的第一件事不是看分子，而是告诉 VMD 盒子有多大。xyz 里没有晶胞信息，VMD 默认按 1 Å 的盒子处理，于是分子被无数个周期镜像包围，RDF 立刻就错。三行命令的顺序决定后面所有分析对不对。"
          },
          {
            type: "code",
            lang: "bash",
            title: "VMD 的 Tk Console（Extensions → Tk Console）",
            text: `pbc set {7.82 7.82 7.82} -all
pbc box
pbc wrap -all
display depthcue off
color Display Background white
display rendermode GLSL`
          },
          {
            type: "p",
            text: "把盒子的三个边长照抄 &CELL 里的 ABC，三斜或六方体系还要给出角度。`pbc box` 应该画出与轨迹一致的框。`pbc wrap -all` 把跨边界的分子贴回盒内：不 wrap 时你会看到水分子一半在盒子这边、一半在那边，动画像被刀切开，而且 RDF 里会出现假的小峰。如果轨迹是 13.2 里那种 EXTXYZ 或 PDB，盒子已经写在文件里，VMD 读入时会自己带上，这三行可以省；默认的 XMOL 没有盒子，就必须手动设。"
          },
          {
            type: "steps",
            items: [
              "File → New Molecule 打开 cp2k-pos-1.xyz，格式选 XMOL。",
              "Tk Console 里 pbc set {a b c} -all，再 pbc box 确认盒子与轨迹一致。",
              "pbc wrap -all，把跨边界的分子贴回盒内。",
              "Create Rep 建一个图层，Selected Atoms 写 element O 或 name H1 挑原子。",
              "Graphics → Representations 里选画法，Trajectory 页勾 Draw Multiple Frames 叠多帧。"
            ]
          },
          {
            type: "callout",
            kind: "warn",
            title: "两条顺序正好相反",
            text: "RDF 要求先 pbc set，否则它按 1 Å 的默认盒子算镜像，第一个峰的位置就偏了。MSD 与 RMSD 反过来要求不要 wrap：wrap 会把真实的大位移折叠回盒内，位移被抹掉，扩散系数直接算小。讲义对这两条都有明确提醒，照着做能省掉一整轮重算。"
          },
          {
            type: "p",
            text: "Selected Atoms 的写法值得背下来：`all`、`none`、`noh`（除氢之外）、`element O`、`name H1`、`index 0`（从 0 数）、`serial 1`（从 1 数）。量键长键角用鼠标在两个原子上各点一下（Graphics → Labels 里勾 bonds / angles），标记会留在图上，直接在 Graphics → Labels 里检阅并截图。"
          },
          {
            type: "p",
            text: "多帧叠加是讲义里最实用的一招：Create Rep 新建图层，在 Trajectory 页勾 Draw Multiple Frames，帧范围写成 `0:50:1000`，含义是起始 0、间隔 50、终止 1000。这样一次就能看出一千帧里结构是怎么演化的，比逐帧播放高效得多。"
          },
          {
            type: "callout",
            kind: "tip",
            title: "出图与录屏",
            text: "出图走 File → Render，选 Tachyon (internal, in-memory rendering)，分辨率写 2000×1500 左右就够。Windows 上录动画直接用 Win+G 录屏，比 VMD 自带的 movie maker 省事。"
          }
        ]
      },
      {
        id: "13.4",
        title: "RDF 与配位数",
        blocks: [
          {
            type: "p",
            text: "径向分布函数 g(r) 回答一个问题：以 A 类原子为中心、半径 r 的球壳里，找到 B 类原子的概率，比理想气体高多少倍。它的第一峰位置就是最可几的键长或接触距离。"
          },
          {
            type: "formula",
            tex: "g_{AB}(r) = \\frac{V}{N_A N_B}\\cdot\\frac{1}{4\\pi r^2}\\sum_{i,j}\\delta(r_{ij}-r)",
            caption: "除以 4πr² 是归一化到球壳体积；理想气体给 g(r)=1，第一峰位置就是最可几接触距离"
          },
          {
            type: "p",
            text: "VMD 里在 Extensions → Analysis → Radial Pair Distribution Function g(r) 打开插件，选两个元素、给最大距离和 bin 宽度、框住第 1 到最后一帧，就能出图。这个插件有个硬限制：只处理正交晶胞。"
          },
          {
            type: "callout",
            kind: "warn",
            title: "非正交盒子先转正交",
            text: "六方、三斜体系要先用 Build → symmetry → Redefine lattice 转成正交超胞，例如石墨就是讲义里的例子。不转的话 g(r) 的第一个峰位置会整体偏，而且偏得看不出来——峰还在，只是距离不对。TRAVIS 支持多种盒型，可以拿它交叉验证一次。"
          },
          {
            type: "p",
            text: "TRAVIS 的用法是交互式的：一条命令进去，它逐个问题问你，方括号里是默认值，回车即接受。`-p` 后面跟轨迹，结果写在当前目录，日志固定叫 travis.log，同名文件不会被覆盖而是改名为 #1#output.txt。"
          },
          {
            type: "code",
            lang: "bash",
            title: "用 TRAVIS 算 RDF",
            text: `mkdir rdf && cd rdf
travis -p ../cp2k-pos-1.xyz
# 依次回答：RDF → 元素对 O O → 帧范围 1:1:4000 → 最大距离 8.0
# 输出一组 CSV（分号分隔，文件名以 TRAVIS 实际写的为准），直接画
xmgrace -block rdf_O-O.csv -bxy 1:2`
          },
          {
            type: "table",
            head: ["量", "讲义里的数值", "含义"],
            rows: [
              ["水的 O–H 第一峰", "约 0.99 Å", "同一个分子内的共价 O–H 键"],
              ["水的 O–H 第二峰", "约 1.73 Å", "邻近分子给出的氢键 H"],
              ["第一配位层 H", "约 2.00 个", "每个 O 周围最近的 H 数目"],
              ["第二配位层 H", "约 3.97 个", "对应每个 O 形成两个氢键"]
            ]
          },
          {
            type: "p",
            text: "配位数是把 g(r) 乘上体相数密度与球壳面积，从 0 积分到第一极小。水的 O–O g(r) 第一峰在 2.8 Å 附近（参考值，会随泛函、温压、势能面变动），积分到 2.8–3.0 Å 得到 4 左右，说明四配位网络是对的。如果得到 6 或 2，先查盒子设没设对。"
          },
          {
            type: "p",
            text: "g(r) 还能看化学键有没有形成：讲义里 Au 在完美 TiO₂ 表面上的 Ti–Au 曲线没有峰，换成有缺陷的表面，Au 团簇坍塌贴上去就出现键。同一套操作，换个元素对就是一次成键判断。"
          }
        ]
      },
      {
        id: "13.5",
        title: "MSD 与扩散系数",
        blocks: [
          {
            type: "p",
            text: "均方位移 MSD 度量的是「过了 t 之后，原子平均挪了多远」，取的是位移平方的平均。它和扩散系数之间是 Einstein 关系：长时间极限下 MSD 对时间是一条直线，斜率除以 6 就是三维扩散系数。"
          },
          {
            type: "formula",
            tex: "\\mathrm{MSD}(t) = \\frac{1}{N}\\sum_{i=1}^{N}|r_i(t)-r_i(0)|^2, \\  D = \\frac{1}{6}\\cdot\\frac{\\Delta MSD}{\\Delta t}",
            caption: "6 是三维的来历：每个方向 MSD = 2Dt，三个方向加起来 6Dt"
          },
          {
            type: "p",
            text: "直接用第 0 帧当参考，曲线会抖得上翘不干净：AIMD 通常跑不到 100 ps，统计量太小。讲义的解法是取多帧当参考再平均——0、500、1000、1500、2000 帧各算一遍 MSD，加起来除以参考帧数。全帧平均太慢，还会把 VMD 卡死。"
          },
          {
            type: "code",
            lang: "python",
            title: "msd.py：多参考帧平均",
            text: `import sys
import numpy as np

def read_xyz(path):
    frames = []
    with open(path) as f:
        while True:
            head = f.readline()
            if not head.strip():
                break
            n = int(head.split()[0])
            f.readline()                              # 注释行
            frames.append([[float(v) for v in f.readline().split()[1:4]]
                           for _ in range(n)])
    return np.array(frames)

frames = read_xyz(sys.argv[1])
dt = float(sys.argv[2])                # 每帧间隔，单位 ps
nf, nat, _ = frames.shape

refs = range(0, nf - 1, 500)           # 每 500 帧取一个参考帧
msd = np.zeros(nf)
cnt = np.zeros(nf)
for r in refs:
    d = frames[r:] - frames[r]
    msd[:nf - r] += np.sum(d * d, axis=(1, 2)) / nat
    cnt[:nf - r] += 1                  # 每个时刻实际有几个参考帧参与平均

msd /= cnt
for i in range(nf):
    print("%.4f %.6f" % (i * dt, msd[i]))`
          },
          {
            type: "p",
            text: "用法是 `python msd.py cp2k-pos-1.xyz 0.0025`。第二个参数是每帧的时间间隔：&EACH MD 5、步长 0.5 fs，一帧就是 2.5 fs，换成 ps 是 0.0025。输出的两列是时间与 MSD，拿去 Origin 里线性拟合后半段，斜率就是 dMSD/dt。单位换算是 1 Å²/ps = 1e-4 cm²/s，扩散系数习惯写 cm²/s。"
          },
          {
            type: "table",
            head: ["T / K", "1000/T", "MSD 斜率 Å²/ps", "斜率/6 Å²/ps", "D cm²/s", "log(D)"],
            rows: [
              ["600", "1.6667", "0.44461", "0.0741017", "7.41017e-06", "-5.13017"],
              ["800", "1.2500", "1.03847", "0.1730783", "1.73078e-05", "-4.76176"],
              ["1000", "1.0000", "2.18712", "0.36452", "3.64520e-05", "-4.43828"],
              ["1200", "0.8333", "3.61754", "0.6029233", "6.02923e-05", "-4.21974"],
              ["1400", "0.7143", "4.36990", "0.7283167", "7.28317e-05", "-4.13768"]
            ]
          },
          {
            type: "p",
            text: "上表是讲义里的完整例子：Li₁₀GeP₂S₁₂ 在 600–1400 K 的五个温度点，每条模拟 80 ps，只用最后 60 ps 拟合。把 log(D) 对 1000/T 作直线，斜率等于 −Ea/(2303 kB)。分母里的 2303 不是笔误：横轴是 1000/T，比 1/T 多了一个 1000，而 2.303 又是 ln 与 log10 的换算，两个因子乘在一起。讲义这组数据的斜率是 −1.07871、截距 −3.35865，取 kB = 8.6173×10⁻⁵ eV/K，解出 Ea = 0.2141 eV。"
          },
          {
            type: "formula",
            tex: "\\log_{10} D = -\\frac{E_a}{2303\\,k_B}\\cdot\\frac{1000}{T} + C",
            caption: "2303 = 2.303 × 1000：2.303 把 ln 换成 log10，1000 来自横轴用 1000/T"
          },
          {
            type: "callout",
            kind: "warn",
            title: "算 MSD 之前不要 wrap",
            text: "pbc wrap 会把越过边界的真实位移折叠回盒内，位移被抹掉，MSD 曲线会先平后上冲，扩散系数偏小。用 VMD 的 RMSD Trajectory Tool 也要注意勾上忽略前 N 帧，把预平衡那段丢掉——否则参考帧本身还在升温，曲线一开头就是假的大斜率。"
          }
        ]
      },
      {
        id: "13.6",
        title: "VACF 与振动谱",
        blocks: [
          {
            type: "p",
            text: "速度自相关函数 VACF 记录的是「t 时刻的速度还记得 0 时刻多少」。它随时间衰减，衰减快慢反映环境的阻尼：振得越慢，曲线越平缓。对所有帧做参考平均，才能把它平均干净。"
          },
          {
            type: "formula",
            tex: "C(t) = \\frac{1}{N}\\sum_{i=1}^{N}v_i(0)\\cdot v_i(t)",
            caption: "参考帧取遍整条轨迹再平均，单帧的 VACF 抖得看不出峰"
          },
          {
            type: "p",
            text: "对 VACF 做傅里叶变换得到振动态密度 vDOS，它近似红外谱：峰的位置对应振动频率，峰的相对高低近似强度。这条路的好处是不用做有限差分 Hessian，一条 MD 轨迹就够；代价是经典核动力学没有零点能，峰位与实验 IR 会差一截。"
          },
          {
            type: "code",
            lang: "bash",
            title: "两条路：TRAVIS 或现成脚本",
            text: `# 路一：TRAVIS，用速度轨迹直接出振动谱
travis -p ../cp2k-vel-1.xyz
# 回答 IR 谱 / 元素对 / 帧范围，输出一组 CSV，直接画

# 路二：郑奇靖的 vacf.py，末尾改成你要的元素对
python vacf.py
# 输出 pcf.png（RDF）、pdos.png（IR）、vacf.png（VACF）`
          },
          {
            type: "compare",
            left: {
              title: "用现成工具",
              items: [
                "VMD 插件与 vacf.py：图形界面或改两行就能跑，出图快。",
                "TRAVIS：输出规范，CSV/AGR/CUBE 都有，能直接进论文。",
                "代价是速度：长轨迹上全帧平均会把 VMD 拖死。"
              ]
            },
            right: {
              title: "自己写 numpy",
              items: [
                "参考帧策略、PBC 处理、单位换算全部可控。",
                "想算分元素的 VACF、去掉质心平动，几行就改完。",
                "代价是要自己验证一遍，别把单位写错。"
              ]
            }
          },
          {
            type: "callout",
            kind: "info",
            title: "峰位对不上是常态",
            text: "vDOS 的峰位与实验 IR 差几十到上百 cm⁻¹ 很常见：经典核动力学没有零点能，谐振近似也不管非谐。要比峰位就统一乘一个经验标度因子，别逐个峰硬调——那样等于把误差拟合进参数里。300 K 水的红外计算与实验对比，讲义里有现成的图可以参照。"
          },
          {
            type: "p",
            text: "VASP 那条路要绕一下：它不输出速度，只能用相邻帧坐标差除以时间步反推速度，再用 xdat2vdat.pl 转成速度轨迹。CP2K 省了这一步，&MOTION%&PRINT%&VELOCITIES 直接写 cp2k-vel-1.xyz，格式与坐标轨迹同构。"
          }
        ]
      },
      {
        id: "13.7",
        title: "密度剖面与界面",
        blocks: [
          {
            type: "p",
            text: "密度剖面是把所有帧、所有目标原子的一个坐标分量收集起来做直方图。它能回答两个问题：液体在固体表面是分层还是乱堆，以及吸附层离表面多远。做法比 RDF 简单，前提是方向选对——板层法向是 z。"
          },
          {
            type: "code",
            lang: "bash",
            title: "zdistr.py：抽出每帧每个原子的 z",
            text: `# 用法：python zdistr.py 轨迹 元素名
python zdistr.py cp2k-pos-1.xyz H
python zdistr.py cp2k-pos-1.xyz O
# 分别写出 distance-H.xyz 与 distance-O.xyz，每行一个 z 坐标`
          },
          {
            type: "p",
            text: "这个脚本本身只做抽取：逐帧读 xyz，把元素名匹配的原子那一行的 z 值（第 4 列）全部追加到 `distance-元素.xyz`。剩下的直方图化交给 numpy，四行就出剖面：存成 profile.py，跑 `python profile.py`，得到第一列 z / Å、第二列计数的两列数据。"
          },
          {
            type: "code",
            lang: "python",
            title: "profile.py：把 z 清单变成密度剖面",
            text: `import numpy as np

d = np.loadtxt('distance-H.xyz')
h, e = np.histogram(d, bins=200, range=(0.0, 27.28))
np.savetxt('profile_H.dat', np.c_[0.5 * (e[1:] + e[:-1]), h])`
          },
          {
            type: "p",
            text: "z 的上限照抄盒子的第三个边长（上面这块板层模型是 27.28 Å）。计数除以总帧数就得到每个 bin 的平均原子数，再除以 bin 体积（面积 × 宽度）才是真正的数密度。这一步很容易漏，漏了就只能比较形状、不能比较绝对高度。"
          },
          {
            type: "table",
            head: ["图形特征", "说明", "怎么核对"],
            rows: [
              ["体相区一条水平平台", "密度等于体相值", "与 1 g/cm³ 对应的高度比对"],
              ["界面处一段斜坡", "从液体密度衰减到零", "斜坡中点近似界面位置"],
              ["紧贴表面的尖峰", "吸附层或第一水层", "峰到表面的距离就是吸附距离"],
              ["峰与峰之间的谷", "分层结构，水的双层", "谷深说明层间交换快慢"]
            ]
          },
          {
            type: "callout",
            kind: "tip",
            title: "先丢掉预平衡",
            text: "统计从第 500 帧之后开始，把升温与平衡那段丢掉再算。讲义在 Au-H₂O 与 Au-TiO₂ 的密度剖面里都是这么处理的。忘了丢，表面那层的峰会因为初始构型没松弛而偏高。"
          },
          {
            type: "p",
            text: "质心分布是同一类分析的另一半：`python masscenter-TiO2.py newpos.xyz` 把每帧的质心坐标写出来，看的是整块水膜有没有漂、有没有塌。它与密度剖面配合，一个看分布形状，一个看整体位置。"
          }
        ]
      },
      {
        id: "13.8",
        title: "一条流水线与排错",
        blocks: [
          {
            type: "p",
            text: "把前面几节串起来，一条轨迹从产出到出图的顺序是固定的。顺序错一步，后面的曲线会错得很难看出来——峰还在，位置和高度不对。照着下面六步走一遍。"
          },
          {
            type: "steps",
            items: [
              "确认 cp2k-pos-1.xyz 存在，并且 cp2k-1.ener 最后一行是正常结束而不是报错中断。",
              "从 cp2k.out 里抄出 &CELL 的 ABC，记下步长与 &EACH 的间隔，算出每帧多少 fs。",
              "VMD 里 pbc set，pbc box 确认盒子，再进行后续分析：RDF 要 pbc set，MSD 不要 wrap。",
              "能量与温度先画一遍，确认势能在平台区内震荡，把前几 ps 标成预平衡。",
              "RDF 与配位数交叉验证第一峰与积分值；MSD 多参考帧平均后取后半段斜率。",
              "需要振动谱再算 VACF；界面体系加做密度剖面与质心分布。"
            ]
          },
          {
            type: "table",
            head: ["症状", "常见原因", "怎么处理"],
            rows: [
              ["RDF 第一峰位置整体偏小", "没 pbc set，VMD 按 1 Å 默认盒子算镜像", "先 pbc set {a b c} -all 再算"],
              ["MSD 一开头就线性上冲", "wrap 过，或参考帧取自未平衡段", "不 wrap；忽略前 N 帧"],
              ["扩散系数大了一个数量级", "忘记除 6，或单位没换成 cm²/s", "D = 斜率/6，Å²/ps × 1e-4"],
              ["密度剖面看不到界面", "直方图 bin 太粗，或 z 上限写错", "bins 取 200 以上，上限照抄盒长"],
              ["VMD 卡死", "选了全帧平均的 MSD", "按 500 帧间隔取参考帧"],
              ["振动谱峰位整体偏移", "经典动力学没有零点能", "统一乘经验标度因子再比"]
            ]
          },
          {
            type: "callout",
            kind: "danger",
            title: "判成功的两条",
            text: "一是 cp2k.out 末尾出现 PROGRAM ENDED AT，说明这次 MD 正常走完；二是 cp2k-1.ener 里 Cons Qty 一列在整个采样段里基本水平，说明能量没有系统性漂移。两条都满足，再做后处理才有意义。"
          },
          {
            type: "keypoints",
            items: [
              "轨迹默认是 XMOL 格式、不带晶胞，VMD 里必须 pbc set，RDF 才可信。",
              "RDF 要 pbc set 之后再算，MSD 与 RMSD 反过来不能 wrap，顺序搞反就得到假曲线。",
              "MSD 用多参考帧平均，长时间极限下斜率除 6 得扩散系数，Å²/ps 乘 1e-4 得 cm²/s。",
              "log(D) 对 1000/T 的斜率等于 −Ea/(2303 kB)，讲义那组数据给出 Ea = 0.2141 eV。",
              "密度剖面就是把某元素的 z 坐标做成直方图，先丢掉预平衡的帧。"
            ]
          }
        ]
      }
    ],
    quiz: [
      {
        q: "CP2K 默认写出的 cp2k-pos-1.xyz 是什么格式，缺了什么信息？",
        options: [
          "PDB 格式，缺了速度",
          "XMOL（普通 xyz）格式，缺了晶胞信息",
          "EXTXYZ 格式，什么都有",
          "DCD 格式，缺了原子名"
        ],
        answer: 1,
        explain: "默认 FORMAT 是 XMOL，就是最常见的 xyz：原子数、注释行、每行一个原子坐标。晶胞不在里面，所以 VMD 里必须先 pbc set。想要带晶胞可以在 &TRAJECTORY 里把 FORMAT 改成 PDB 或 EXTXYZ。"
      },
      {
        q: "RDF 与 MSD 对 pbc 的要求为什么相反？",
        options: [
          "RDF 要周期性镜像，MSD 要真实位移不被折叠",
          "RDF 要真实位移，MSD 要周期性镜像",
          "两者都要求先 wrap",
          "两者都不允许 pbc set"
        ],
        answer: 0,
        explain: "RDF 统计的是周围有谁，必须有周期镜像才是体相；MSD 统计的是原子到底挪了多远，wrap 会把跨边界的真实位移折叠回盒内，位移被抹掉，扩散系数就偏小。讲义的提醒顺序就是：RDF 先 pbc set，MSD 不要 wrap。"
      },
      {
        q: "三维体系里 D = 斜率/6，这个 6 从哪来？",
        options: [
          "拟合时取的窗宽",
          "因为每个方向有正负两个半轴",
          "Einstein 关系 MSD = 6Dt 在三维下的系数",
          "盒子有三条边"
        ],
        answer: 2,
        explain: "三维随机行走里每个方向的 MSD 是 2Dt，三个方向加起来 6Dt，所以 dMSD/dt = 6D，D 等于斜率除以 6。二维是 4，一维是 2。"
      },
      {
        q: "log(D) 对 1000/T 作图的斜率是 −1.07871，kB = 8.6173×10⁻⁵ eV/K，活化能是多少？",
        options: ["0.093 eV", "0.214 eV", "2.14 eV", "21.4 eV"],
        answer: 1,
        explain: "斜率 = −Ea/(2303 kB)，所以 Ea = 1.07871 × 2303 × 8.6173×10⁻⁵ eV ≈ 0.2141 eV。2303 里含着两项：2.303 把 ln 换成 log10，1000 来自横轴用 1000/T 而不是 1/T。"
      },
      {
        q: "密度剖面统计时为什么要丢掉前面几百帧？",
        options: [
          "前面的帧文件没写完",
          "那一段还在升温与平衡，构型不代表平衡态",
          "丢掉帧能让直方图更平滑",
          "CP2K 从第 500 帧才开始写坐标"
        ],
        answer: 1,
        explain: "MD 开始时体系还没平衡，表面吸附层与水的排列都还在松弛。讲义的做法是从第 500 帧之后开始统计，丢掉预平衡段，否则贴近表面的峰会偏高、位置也会漂。"
      }
    ],
    terms: [
      { t: "轨迹", en: "trajectory", d: "把每一帧的原子坐标按时间顺序写成的文件，CP2K 默认叫 cp2k-pos-1.xyz，格式是 XMOL。" },
      { t: "径向分布函数", en: "radial distribution function", d: "g(r)，距离 r 的球壳里找到某类原子的概率相对理想气体的倍数，第一峰位置就是最可几的接触距离。" },
      { t: "配位数", en: "coordination number", d: "把 g(r) 乘以球壳体积并积分到第一极小得到的原子数目，水在室温下 O–O 第一层约 4。" },
      { t: "均方位移", en: "mean squared displacement", d: "MSD(t)，原子相对参考帧位移平方的系综平均；AIMD 里要用多参考帧平均才干净。" },
      { t: "扩散系数", en: "diffusion coefficient", d: "D，三维里等于 MSD 长时间斜率除以 6，单位常用 cm²/s，1 Å²/ps = 1e-4 cm²/s。" },
      { t: "速度自相关函数", en: "velocity autocorrelation function", d: "VACF，0 时刻与 t 时刻速度点乘的系综平均；做傅里叶变换得到振动态密度，近似红外谱。" },
      { t: "密度剖面", en: "density profile", d: "沿某一方向（界面体系取 z）统计原子坐标的直方图，用来看液体在固体表面是否分层。" },
      { t: "周期性缠绕", en: "pbc wrap", d: "把越过盒子边界的分子贴回盒内的操作。RDF 需要它配合 pbc set，MSD 则不能先做。" }
    ],
    sources: [
      { t: "CP2K_INPUT / MOTION / PRINT / TRAJECTORY", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/PRINT/TRAJECTORY.html" },
      { t: "CP2K_INPUT / MOTION / MD", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD.html" },
      { t: "CP2K_INPUT / MOTION / MD / REFTRAJ", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/MOTION/MD/REFTRAJ.html" },
      { t: "Molecular dynamics", url: "https://manual.cp2k.org/trunk/methods/sampling/molecular_dynamics.html" }
    ]
  };
})();