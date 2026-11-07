(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch05"] = {
    id: "ch05",
    num: 5,
    part: "输入与体系",
    title: "基组、赝势与体系建模",
    subtitle: "把真实体系放进 &SUBSYS：基组赝势配对、坐标晶胞、slab 与溶液盒",
    hours: 3,
    level: "入门",
    intro:
      "网格决定积分有多准，基组决定轨道能展开到什么程度，赝势决定哪些电子被显式处理。三者里只有基组和赝势是「跟着原子走」的——选错了，换再大的 CUTOFF 也救不回来。这一章先讲清 DZVP 与 GTH-PBE-q6 这类名字的含义，再回到 &SUBSYS 里把坐标、晶胞、周期性和约束一次性配好，最后处理 slab 与溶液盒这两种真实模型。",
    goals: [
      "读懂 SZV / DZVP / TZVP / TZV2P 与 -SR、-q6 的含义，并按精度与成本选基组",
      "为每种元素配上与泛函、价电子数一致的 GTH 赝势，并会查库验证",
      "用 &COORD、&CELL、&TOPOLOGY 正确描述分子、晶体、表面与溶液盒",
      "搭出 slab 与混合溶液模型，并知道 BSSE、ghost 原子与单位错误怎么影响结果",
    ],
    sections: [
      {
        id: "5.1",
        title: "基组：把轨道展开到什么程度",
        blocks: [
          {
            type: "p",
            text: "GPW 里，Kohn–Sham 轨道由原子中心的高斯函数线性组合而成，系数就是待求的「波函数」。基组就是这组高斯的清单：每个原子配几个、什么宽度、有没有极化函数。基组越大，变分空间越大，能量越低——但每增大一档，矩阵维数和计算量都跟着涨。",
          },
          {
            type: "p",
            text: "名字里的三组信息要分开读。第一组是**劈裂层数**：`SZV` 是单 ζ（每个价轨道一套函数），`DZVP` 是双 ζ 价极化（每个价轨道两套 + 一套极化函数），`TZVP`、`TZV2P` 依次更细。第二组是**用途**：带 `MOLOPT` 的是为分子与凝聚相优化的 MOLOPT 系列，这也是配 GPW 最常用的一族。第三组是**后缀**：`-SR` 是短程变体，`-q6` 表示配合 6 价电子赝势。",
          },
          {
            type: "table",
            head: ["名字", "含义", "典型用途", "相对成本"],
            rows: [
              ["SZV-MOLOPT-GTH", "单 ζ 价层", "大体系粗筛、初猜", "最低"],
              ["DZVP-MOLOPT-GTH", "双 ζ + 极化", "凝聚相常规生产计算", "低"],
              ["TZVP-MOLOPT-GTH", "三 ζ + 极化", "能量差、较敏感的性质", "中"],
              ["TZV2P-MOLOPT-GTH", "三 ζ 双极化", "高精度单点、响应性质", "高"],
              ["DZVP-MOLOPT-SR-GTH", "短程版双 ζ", "大盒子液体、表面", "比非 SR 更低"],
            ],
            caption: "MOLOPT 系列常见档位；实际可用项以本地 BASIS_MOLOPT 文件为准",
          },
          {
            type: "p",
            text: "想找参照物建立直觉，可以对照 Pople 系列：SZV 大致相当于 STO-3G，DZVP 相当于 6-31G*，TZVP 相当于 6-311G*，TZV2P 相当于 6-311G(2df,2pd)。这只是量级上的类比——MOLOPT 是为 GPW 与凝聚相优化的，不能当成 Pople 基组的等价替换。另有一条纪律：**不要用 SZV 做生产计算**，它只适合粗筛、初猜和大体系的预收敛。",
          },
          {
            type: "p",
            text: "`-SR` 值得单独说：它砍掉了部分弥散（长尾）函数，波函数在空间上更「紧」。代价是描述阴离子、极化率、弱相互作用时精度下降，收益是同样的体系算得更快、重叠矩阵更不容易病态。课程里的实测是 SR 版速度提升约两到三倍，BSSE 大约增大一半——所以**材料、表面、致密液体常用 SR，阴离子与弱相互作用不要用**。",
          },
          {
            type: "callout",
            kind: "key",
            title: "基组不能靠 CUTOFF 弥补",
            text: "CUTOFF 只改善密度与势在辅助网格上的表示，管不到「轨道本身能不能展开」。基组不够，能量会系统性地偏高（变分原理），而且这个误差不会随 CUTOFF 收敛掉。两者要各自收敛。",
          },
          {
            type: "keypoints",
            items: [
              "基组决定轨道空间；CUTOFF 决定网格精度，两者独立收敛。",
              "DZVP 起步、TZVP 提精度；SR 换速度、牺牲弥散。",
              "后缀 qN 必须与赝势一致，否则电子数直接错。",
            ],
          },
        ],
      },
      {
        id: "5.2",
        title: "赝势：GTH、价电子数与泛函族",
        blocks: [
          {
            type: "p",
            text: "全电子计算要把核附近剧烈变化的 1s 密度也展开，需要极细网格和极大基组。GTH 赝势（Goedecker–Teter–Hutter）把这部分换成解析的有效势，只显式处理价电子：O 留 6 个、H 留 1 个、C 留 4 个。名字里的 `-q6` 就是这个数字，它同时决定了体系的总电子数和基组该配哪一档。",
          },
          {
            type: "p",
            text: "名字的第二段是**泛函族**：`GTH-PBE-q6` 是针对 PBE 优化的，`GTH-BLYP-q6` 针对 BLYP，`GTH-PADE-q4` 对应 LDA（PADE 是 LDA 相关能的实现）。手册的建议很直接：**用与计算相同泛函族的赝势**。混用在探索性工作里能跑，但那不是系统达到高精度的路线。SCAN、HSE 这类没有专门 GTH 的泛函，实践中沿用 PBE 赝势。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "kind_block.inp（从水到金属表面：四种元素的 KIND）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SUBSYS
      &KIND H
        BASIS_SET DZVP-MOLOPT-SR-GTH
        POTENTIAL GTH-PBE-q1
      &END KIND
      &KIND O
        BASIS_SET DZVP-MOLOPT-SR-GTH
        POTENTIAL GTH-PBE-q6
      &END KIND
      &KIND C
        BASIS_SET DZVP-MOLOPT-SR-GTH
        POTENTIAL GTH-PBE-q4
      &END KIND
      &KIND Cu
        BASIS_SET DZVP-MOLOPT-SR-GTH
        POTENTIAL GTH-PBE-q11
      &END KIND
    &END SUBSYS
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "注意两点。第一，`BASIS_SET` 和 `POTENTIAL` 写的是**库里的名字**，文件位置由 FORCE_EVAL/DFT 下的 `BASIS_SET_FILE_NAME`、`POTENTIAL_FILE_NAME` 决定；文件名可以省略（CP2K 会去自己的 data 目录找），但一旦省略而本地没有，报错会出现在启动阶段。第二，短写 `BASIS_SET DZVP-MOLOPT-GTH` 等价于 `BASIS_SET ORB DZVP-MOLOPT-GTH`，`ORB` 表示这是给轨道用的；同一元素还可以挂 `AUX_FIT`、`RI_AUX`、`LRI` 等辅助基组。",
          },
          {
            type: "h3",
            text: "查库：名字对不对，grep 一下就知道",
          },
          {
            type: "code",
            lang: "bash",
            title: "check_lib.sh（确认基组与赝势真的存在且配对）",
            text: `# 1) 这个元素有哪些基组（每行一个基组名）
grep -E "^[A-Z][a-z]? +DZVP" BASIS_MOLOPT | head

# 2) 精确查某种元素的 MOLOPT 档位
grep -n "O .*MOLOPT" BASIS_MOLOPT

# 3) 赝势库里的 q 值；q 必须与基组后缀、体系电子数一致
grep -n "GTH-PBE-q" GTH_POTENTIALS | grep -E " O | H | Cu "

# 4) 库文件默认位置（找不到时优先看这里）
ls $CP2K_DATA_DIR/BASIS_MOLOPT $CP2K_DATA_DIR/GTH_POTENTIALS`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "q 值不匹配的两种表现",
            text: "轻则启动时报「basis set not found」（因为库里没有 `-q6` 那一档），重则能跑但电子数错、能量整体偏移、磁矩不对。用 `Number of electrons:` 与「各元素 q 值之和 + CHARGE」核对，是最快的体检。",
          },
          {
            type: "keypoints",
            items: [
              "GTH 赝势只显式处理价电子；q 值 = 价电子数，必须与基组后缀一致。",
              "赝势的泛函族要与 &XC 的选择一致，PBE 计算就用 GTH-PBE-qN。",
              "文件名在 &DFT 里给，具体名字在 &KIND 里给；grep 库是最可靠的确认方式。",
            ],
          },
        ],
      },
      {
        id: "5.3",
        title: "&KIND 的完整写法：元素、质量、ghost",
        blocks: [
          {
            type: "p",
            text: "`&KIND` 是「一种原子的全部身份信息」。它的名字是 &COORD 第一列的标签，但**真正决定化学元素的是 `ELEMENT` 关键词**。不写 `ELEMENT` 时程序按标签猜；标签叫 `O` 没问题，叫 `Ow`（水的氧）、`Fe_2`（二价铁）就必须显式写出元素。",
          },
          {
            type: "key",
            items: [
              { k: "ELEMENT", v: "该标签对应的真实元素；省略时按标签名推断", tag: "必知" },
              { k: "MASS", v: "原子质量（amu）；同位素或虚拟原子时手动指定", tag: "常用" },
              { k: "GHOST", v: "T 时只保留基组、去掉核与赝势电荷，用于 BSSE 与基组叠加", tag: "进阶" },
              { k: "BASIS_SET", v: "轨道基组名（可带 ORB / AUX_FIT 等角色前缀）", tag: "必填" },
              { k: "POTENTIAL", v: "赝势名；全电子计算写 ALL", tag: "必填" },
              { k: "MAGNETIZATION", v: "该种原子的初始磁矩（μB），开壳层体系用它给初猜", tag: "场景" },
            ],
          },
          {
            type: "p",
            text: "同一个元素需要两套参数时，就起两个标签：`&KIND Fe_2` 与 `&KIND Fe_3`，各自写 `ELEMENT Fe`，配不同的基组或初始磁矩。坐标里第一列用哪个标签，就自动套用哪一套。这是处理混合价态、表面不同位点的标准做法。体系的总电荷不写在 KIND 里，而是用 &DFT 的 CHARGE。",
          },
          {
            type: "p",
            text: "`GHOST` 值得单独记：把某个原子设成 ghost，等于在原地放一套基组、但去掉原子核与它的电子。做 BSSE 的 counterpoise 校正时，正是靠它算出「只用对方基组时片段自身的能量」。**ghost 原子不贡献电子数**，所以设多了会让体系总电子数变化，务必在输出里核对。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "标签统一，省掉一半排错时间",
            text: "建模软件导出的结构常把水里的氧写成 `OW`、`HW1`，直接喂给 CP2K 会得到一堆 unknown element。养成习惯：导入后统一改成元素符号，或者在 &KIND 里用 `ELEMENT` 显式映射，别让标签名成为隐藏变量。",
          },
          {
            type: "keypoints",
            items: [
              "标签只是代号，ELEMENT 才是化学元素；自定义标签必须配 ELEMENT。",
              "同元素多套参数 = 多个 KIND 标签，各写各的基组与设置。",
              "GHOST 只留基组不留核，是 BSSE 校正的工具，不是省钱的开关。",
            ],
          },
        ],
      },
      {
        id: "5.4",
        title: "坐标与晶胞：&COORD、&CELL、&TOPOLOGY",
        blocks: [
          {
            type: "p",
            text: "`&COORD` 每行是「标签 x y z」，默认笛卡尔、单位 Å。要写分数坐标就加 `SCALED .TRUE.`，此时 x y z 是相对晶胞矢量的比例。行末还可以跟一个分子名（MOLNAME），一般留空；分子动力学里需要区分分子时才用。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "water_box.inp（&SUBSYS 完整骨架：晶胞 + 坐标 + KIND）",
            text: `  &SUBSYS
    &CELL
      ABC 12.42 12.42 12.42
      ALPHA_BETA_GAMMA 90.0 90.0 90.0
      PERIODIC XYZ
    &END CELL
    &COORD
      O   0.0000   0.0000   0.0000  W1
      H   0.7570   0.5860   0.0000  W1
      H  -0.7570   0.5860   0.0000  W1
      O   6.2100   6.2100   6.2100  W2
      H   6.9670   6.7960   6.2100  W2
      H   5.4530   6.7960   6.2100  W2
    &END COORD
    &KIND H
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
    &KIND O
      BASIS_SET DZVP-MOLOPT-SR-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
  &END SUBSYS`,
          },
          {
            type: "p",
            text: "晶胞有两种等价写法：`A` / `B` / `C` 三个矢量（每行三个数），或 `ABC` 加 `ALPHA_BETA_GAMMA`（边长 + 三个夹角）。前者对非正交晶胞更直观，后者对立方/六方更省事。默认单位都是 Å，想用 nm 就在行末加方括号。`PERIODIC` 默认 `XYZ`；分子计算要显式写 `PERIODIC NONE`，否则分子会与自己的镜像作用。",
          },
          {
            type: "p",
            text: "坐标放在外部文件里更常见。`&TOPOLOGY` 下的 `COORD_FILE_NAME` 给路径、`COORD_FILE_FORMAT` 给格式（XYZ、PDB、CIF 等），CP2K 会自己读结构；也可以用 `@INCLUDE 'coord.inc'` 把纯坐标文本插进 &COORD，适合脚本批量生成的结构。前者能带晶胞信息，后者最灵活。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "from_file.inp（从文件读结构，而不是粘坐标）",
            text: `  &SUBSYS
    &TOPOLOGY
      COORD_FILE_NAME ./water.cif
      COORD_FILE_FORMAT CIF
    &END TOPOLOGY
    &CELL
      CELL_FILE_NAME ./water.cif
      CELL_FILE_FORMAT CIF
    &END CELL
  &END SUBSYS`,
          },
          {
            type: "p",
            text: "`CONN_FILE_NAME` 与 `CONN_FILE_FORMAT` 用来从 PDB/PSF 这类文件读入成键与连接信息，默认 `CONN_FILE_FORMAT` 是 `GENERATE`，即由几何距离自动生成。纯 DFT 的成键由电子密度决定，通常不需要手工给键；只有力场或 QM/MM 部分才关心连接表。用 CIF 读晶胞时，`&CELL` 也可以直接从同一个文件取，避免「坐标是一套、晶胞是另一套」的错位。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "读文件时最容易错的两件事",
            text: "一是单位：CIF 与 XYZ 都是 Å，但某些建模软件导出的是 nm 或 Bohr，坐标数值差十倍。二是周期性：从分子文件读进来忘了改 `PERIODIC`，程序仍按 XYZ 处理，结果是一个被周期镜像包围的「分子」。",
          },
          {
            type: "keypoints",
            items: [
              "&COORD 默认笛卡尔 Å；分数坐标要 SCALED T。",
              "&CELL 可用 ABC + 夹角，也可用三个矢量；分子体系记得 PERIODIC NONE。",
              "结构可来自 &TOPOLOGY 的文件或 @INCLUDE 的文本；两种都要核对单位与周期性。",
            ],
          },
        ],
      },
      {
        id: "5.5",
        title: "建模（一）：slab 表面",
        blocks: [
          {
            type: "p",
            text: "表面计算的第一步不是算，而是想清楚三件事：**切哪个面、有几层、真空留多厚**。切面决定终端（Al-terminated 还是 O-terminated），层数决定体内行为能否被正确重现，真空厚度决定周期镜像之间会不会互相作用。",
          },
          {
            type: "p",
            text: "经验做法：至少 3–5 个金属层，真空层与 slab 厚度同量级（十几 Å 起），并且**固定最下面一两层**模仿体相。表面上下两个面都要处理——要么两侧都暴露同一终端，要么用对称 slab 让两侧等价。悬挂键用 -OH 或 -H 饱和，否则表面态会污染能带与吸附能。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "slab.inp（Cu(100) slab 的体系与约束）",
            text: `&FORCE_EVAL
  METHOD Quickstep
  &DFT
    BASIS_SET_FILE_NAME BASIS_MOLOPT
    POTENTIAL_FILE_NAME GTH_POTENTIALS
    &SUBSYS
      &CELL
        ABC 10.2425 10.2425 31.0
        ALPHA_BETA_GAMMA 90.0 90.0 90.0
        PERIODIC XYZ
      &END CELL
      &TOPOLOGY
        COORD_FILE_NAME ./cu100.xyz
        COORD_FILE_FORMAT XYZ
      &END TOPOLOGY
      &KIND Cu
        BASIS_SET DZVP-MOLOPT-SR-GTH
        POTENTIAL GTH-PBE-q11
      &END KIND
    &END SUBSYS
  &END DFT
&END FORCE_EVAL

&MOTION
  &CONSTRAINT
    &FIXED_ATOMS
      LIST 1..36
      COMPONENTS_TO_FIX XYZ
    &END FIXED_ATOMS
  &END CONSTRAINT
&END MOTION`,
          },
          {
            type: "p",
            text: "`&FIXED_ATOMS` 的 `LIST` 支持 `1..36` 这种区间写法，`COMPONENTS_TO_FIX` 可以只锁 z 方向（`XY` 表示允许 x y 动、固定 z，具体方向按手册定义确认）。固定底层是为了让 slab 保持体相晶格；如果连表面层也锁死，吸附质引起的弛豫就被人为抹掉了，吸附能会系统性偏。",
          },
          {
            type: "p",
            text: "斜切面要用 Wood 记法描述超胞，例如 (2×2)R45°；异质结则要分别建好两层再拼接，注意晶格失配与界面间距。纯手工拼容易在 z 方向留下重叠原子，务必先用可视化软件检查最小原子间距。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "固定层数写进脚本，别写死在输入里",
            text: "slab 层数经常要调。把 `LIST 1..36` 里的 36 做成 `@SET NFIX 36` 再引用，比每次手改安全；同时记录「总原子数 − 固定数 = 可动数」，改完顺手核对，能避免锁定范围写错却没发现。",
          },
          {
            type: "keypoints",
            items: [
              "表面三要素：终端、层数、真空；三者决定结果是否有物理意义。",
              "固定最下面一两层，别把整个 slab 锁死。",
              "上下两个表面都要处理，悬挂键用 -OH / -H 饱和。",
            ],
          },
        ],
      },
      {
        id: "5.6",
        title: "建模（二）：溶液盒与混合体系",
        blocks: [
          {
            type: "p",
            text: "液体模型的核心是**密度**。水在常温常压下约 1 g/cm³，反过来算：1000 个水分子、盒子边长 40 Å 时密度是多少？这种估算必须在建模阶段做，因为 CP2K 不会替你检查盒子是不是太挤或太空。",
          },
          {
            type: "code",
            lang: "bash",
            title: "density.sh（用 awk 估盒子密度，纯液相建模必做）",
            text: `# 1000 个水，盒子 40 A：18 g/mol * 1000 / N_A / V
awk 'BEGIN{
  n=1000; mw=18.015; na=6.02214076e23; L=40.0;
  vol=L*L*L*1e-24;              # A^3 -> cm^3
  rho=n*mw/na/vol;
  printf "N=%d  L=%.2f A  rho=%.3f g/cm3\\n", n, L, rho
}'`,
          },
          {
            type: "p",
            text: "纯液体用 Packmol 最省事：给它几个 `.pdb` 分子文件、各自的分子数和摆放区域，它按最小间距把分子塞进去。下面这份是课程里「水 + 尿素」的混合体系输入，两个 `structure` 块共用同一个 40 Å 立方盒子。",
          },
          {
            type: "code",
            lang: "bash",
            title: "mixture.inp（Packmol 输入；tolerance 单位 Å）",
            text: `tolerance 2.0
filetype pdb
output mixture.pdb

structure water.pdb
  number 1000
  inside box 0. 0. 0. 40. 40. 40.
end structure

structure urea.pdb
  number 400
  inside box 0. 0. 0. 40. 40. 40.
end structure`,
          },
          {
            type: "p",
            text: "输出是 PDB，坐标在 Å、无晶胞，所以 CP2K 侧要自己写 `&CELL`（边长 40 Å），并在 `&KIND` 里给 H/O/C/N 配好基组赝势。液体的密度就是由「分子数 ÷ 盒子体积」决定的，所以盒子边长必须和 Packmol 的 `inside box` 一致——这两处对不上，密度就错了。",
          },
          {
            type: "p",
            text: "给 slab 加水则是另一类问题：水不能穿进金属里，也不能在真空层里乱飘。课程的做法是用 Materials Studio 的 Amorphous Cell 在 slab 上方按 1 g/cm³ 填水，盒子取 Cu(100) 的 10.2425 Å 面内尺寸、z 方向留出真空；Packmol 更擅长纯液相，对固体表面的「只允许在上方填充」约束不好表达。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "靠近表面的水不再是 1 g/cm³",
            text: "把体相密度直接套到界面附近会高估覆盖度。界面第一层水的密度由相互作用决定，通常要单独平衡（AIMD 跑一段 NVT）再统计。起始结构只要「不重叠、不穿模」，密度在平衡中会自己调整。",
          },
          {
            type: "keypoints",
            items: [
              "液体建模先算密度：分子数、盒子边长、摩尔质量三者互相约束。",
              "Packmol 的三个坐标必须与 CP2K 的 &CELL 一致，且它不输出晶胞。",
              "slab + 水用 Amorphous Cell 之类工具按区域填充，界面密度要靠平衡得到。",
            ],
          },
        ],
      },
      {
        id: "5.7",
        title: "BSSE 与基组/赝势选择策略",
        blocks: [
          {
            type: "p",
            text: "BSSE（basis set superposition error）来自「基组跟着原子走」这件事：算 A+B 复合物时，B 的基组也在帮 A 展开，A 的能量被额外压低；两个片段分开算时没有这份帮助。于是吸附能、结合能被系统性高估（更负）。基组越小，这个效应越大。",
          },
          {
            type: "formula",
            tex: "E_{\\mathrm{int}}^{\\mathrm{CP}} = E_{AB} - (E_{A}^{AB} + E_{B}^{AB})",
            caption: "counterpoise 校正：两个片段的能量都在复合物的完整基组下计算（用 ghost 原子实现）",
          },
          {
            type: "p",
            text: "课程给出的量级是：DZVP 的 BSSE 约 5 kcal/mol（≈0.22 eV），对化学吸附的几十到上百 kcal/mol 不算致命，但对物理吸附、弱相互作用就是同一量级。SR 版把弥散函数砍掉后 BSSE 还会增大一半左右。这意味着**弱相互作用体系要么用更大的基组，要么显式做 counterpoise 校正**。",
          },
          {
            type: "table",
            head: ["场景", "基组选择", "理由"],
            rows: [
              ["大体系粗筛、长时间 AIMD", "DZVP-MOLOPT-SR-GTH", "速度优先，材料性质对弥散不敏感"],
              ["常规表面吸附、反应能", "DZVP-MOLOPT-GTH 或 TZVP", "能量差要稳，BSSE 需可控"],
              ["弱相互作用、阴离子、极化率", "TZV2P 或带弥散基组", "弥散函数直接决定结合能"],
              ["高精度单点、响应性质", "TZV2P / QZVPP 级别", "变分极限方向"],
              ["全电子 / core 谱（GAPW）", "SVP-MOLOPT-GGA-ae 等 ae 基组", "不能用赝势"],
            ],
            caption: "先定精度需求，再定 SR 与非 SR，最后核对赝势 q 值",
          },
          {
            type: "p",
            text: "配对纪律总结成三句：**基组与赝势必须在文件里都存在、q 值一致、泛函族一致**。再加一句工程上的：同一批计算里所有能量都用同一套基组赝势，否则能量差里混进了基组误差。真要换档，用阶梯式（先小基组收敛结构，再大基组算单点）并在文中说明。",
          },
          {
            type: "callout",
            kind: "key",
            title: "BSSE 的三种应对",
            text: "一，用大基组把它压到可忽略；二，做 counterpoise（ghost 原子）显式扣除；三，只报告「同一基组下的相对趋势」，不跨基组比较绝对值。三者选一个并写清楚，比默默忽略要诚实得多。",
          },
          {
            type: "keypoints",
            items: [
              "BSSE 让结合能偏负，基组越小越严重，SR 版更严重。",
              "吸附能/弱相互作用必须考虑 BSSE；大体系趋势研究可以接受它。",
              "基组、赝势、泛函三者要成套一致；换档要说明并保持可比。",
            ],
          },
        ],
      },
      {
        id: "5.8",
        title: "三类高频坑：不匹配、ghost、单位",
        blocks: [
          {
            type: "p",
            text: "这一节的三个坑有个共同点：**程序不会替你检查物理合理性**。它们要么在启动时给出晦涩的「找不到某名字」，要么一路算完给出一个看似正常的错数。",
          },
          {
            type: "table",
            head: ["症状", "根因", "检查动作"],
            rows: [
              ["启动报 basis/potential not found", "名字带错 q 后缀；或元素根本没有该档基组", "grep 库文件，确认全名逐字一致"],
              ["电子数不对、磁矩为零", "赝势 q 值与预期价电子数不符（如 Cu 用 q18）", "加总各元素 q × 个数，与输出 Number of electrons 对比"],
              ["吸附能异常偏负", "BSSE；或 ghost 原子忘了删", "同一基组下重算片段；检查 KIND 里有没有 GHOST T"],
              ["结构塌陷 / 原子重叠", "坐标单位错（nm 当 Å）；或盒子太小", "看最小原子间距；核对 &CELL 与坐标来源"],
              ["镜像相互作用", "分子体系没写 PERIODIC NONE", "检查 &CELL 的 PERIODIC"],
            ],
            caption: "先看症状再看根因，比逐行读输入快得多",
          },
          {
            type: "h3",
            text: "单位：最隐蔽的一类错误",
          },
          {
            type: "p",
            text: "CP2K 默认长度 Å、能量 Hartree；但建模软件可能输出 nm、Bohr 或分数坐标，基组文件里的指数又是 Bohr⁻²。同一个「0.529」在不同地方含义完全不同。养成习惯：每个数值块前面想一次「这里默认什么单位」，必要时显式加方括号。",
          },
          {
            type: "demo",
            id: "units",
            title: "单位换算器",
            desc: "Å / nm / Bohr、Hartree / eV / kcal·mol⁻¹ 随手换算；把「差 10 倍」「差 27 倍」这类错误在建模阶段就拦住。",
          },
          {
            type: "p",
            text: "ghost 原子的排查更简单：在输入里搜 `GHOST`，确认每一处都是有意为之；再看输出里的电子数有没有因为 ghost 而变小。做 counterpoise 时通常要跑三次（复合物、片段 A 在 AB 基组下、片段 B 在 AB 基组下），三次的 KIND 设置必须只差 ghost 标记。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "不要用「算完了」当验收",
            text: "上面五类症状里只有第一类会中止。任何新体系第一次跑完，都要做三件事：核对电子数、看最小原子间距、比较能量量级是否合理（每原子几个 Hartree 的量级，而不是几十或零点几）。",
          },
          {
            type: "keypoints",
            items: [
              "名字、q 值、泛函族三项一致，基组赝势才算配对正确。",
              "ghost 只留基组不留核，用于 BSSE；忘删会让电子数异常。",
              "单位与周期性是「能跑但算错」的典型来源，建模后先自查。",
            ],
          },
        ],
      },
    ],
    quiz: [
      {
        q: "`DZVP-MOLOPT-SR-GTH` 里的 `SR` 表示什么？",
        options: ["单参考（single reference）", "短程变体，减少了弥散函数", "自旋限制（spin restricted）", "标量相对论校正"],
        answer: 1,
        explain: "SR 是 short-range 的缩写，砍掉了部分长尾弥散函数：算得更快、重叠矩阵更稳，但描述阴离子、极化率和弱相互作用时精度下降，BSSE 也会变大。",
      },
      {
        q: "氧用 `GTH-PBE-q6` 赝势时，基组应该配哪一档？",
        options: ["任意 DZVP 基组都可以", "后缀同样为 q6 的基组，如 DZVP-MOLOPT-GTH-q6", "后缀为 q4 的基组", "必须用全电子 ae 基组"],
        answer: 1,
        explain: "q 值表示显式处理的价电子数，赝势与基组必须描述同一价电子构型。配错会出现「库里找不到该基组」，或能跑但电子数与预期不符。",
      },
      {
        q: "想让分子体系不与自己的周期镜像作用，应该？",
        options: ["把 CUTOFF 调大", "在 &CELL 里写 PERIODIC NONE", "给 &KIND 加 GHOST T", "把 RUN_TYPE 改成 ENERGY"],
        answer: 1,
        explain: "PERIODIC 默认是 XYZ，分子计算必须显式关掉周期性；把盒子放大只是减小相互作用，并没有真正去掉镜像。配合足够大的盒子和 &POISSON PERIODIC NONE 才干净。",
      },
      {
        q: "&COORD 第一列写的是 `Ow`，但只定义了 `&KIND O`，会发生什么？",
        options: ["自动按 O 处理", "启动时报未知元素或找不到对应 KIND", "程序把 Ow 当 ghost", "只警告，结果不变"],
        answer: 1,
        explain: "标签必须能对应到一个 &KIND。要么把标签改成 O，要么新增 &KIND Ow 并在里面写 ELEMENT O 显式映射，否则元素无法确定。",
      },
      {
        q: "做 BSSE 的 counterpoise 校正时，`GHOST T` 的作用是？",
        options: [
          "删除该原子的电子，使体系带电",
          "保留该位置的基组函数，但去掉原子核与它的电子",
          "把该原子固定不动",
          "提高该原子的积分精度",
        ],
        answer: 1,
        explain: "ghost 原子只提供基组、不提供核电荷与电子，因此可以用对方的基组计算片段自身能量，从而扣掉「借用基组」带来的额外稳定化。",
      },
    ],
    terms: [
      { t: "基组", en: "basis set", d: "展开 Kohn–Sham 轨道的一组原子中心高斯函数；劈裂层数与极化函数决定其精度。" },
      { t: "赝势", en: "pseudopotential", d: "用有效势替代芯电子，只显式处理价电子；GTH 是 CP2K 中最常用的一族。" },
      { t: "价电子数", en: "valence charge (q)", d: "赝势显式处理的电子数，写在名字后缀如 -q6，必须与基组和体系一致。" },
      { t: "ghost 原子", en: "ghost atom", d: "只保留基组、去掉核与电子的原子，用于 BSSE 校正等场景。" },
      { t: "BSSE", en: "basis set superposition error", d: "复合物中片段借用对方基组导致的额外稳定化，使结合能偏负。" },
      { t: "slab", en: "slab model", d: "用有限层数加真空层模拟表面，需处理终端、层数与固定底层。" },
      { t: "分数坐标", en: "scaled coordinates", d: "以晶胞矢量为基的坐标，&COORD 中需显式 SCALED T 才按此解释。" },
    ],
    sources: [
      { t: "Basis Sets", url: "https://manual.cp2k.org/trunk/methods/dft/basis_sets.html" },
      { t: "Pseudopotentials", url: "https://manual.cp2k.org/trunk/methods/dft/pseudopotentials.html" },
      { t: "Input Reference: KIND", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/SUBSYS/KIND.html" },
      { t: "Input Reference: COORD", url: "https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/SUBSYS/COORD.html" },
    ],
  };
})();