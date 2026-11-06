(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch04"] = {
    id: "ch04",
    num: 4,
    part: "上手",
    title: "输入文件解剖：从一棵树读懂一份输入",
    subtitle: "section、关键字、单位与预处理器，一次讲清",
    hours: 1.5,
    level: "入门",
    intro:
      "CP2K 没有图形界面，也没有「参数面板」，所有设置都写在一份纯文本输入里。这份输入不是命令行参数的堆叠，而是一棵有层级的树：每个 `&SECTION` 是一个节点，节点里放关键字和子节点。看懂这棵树，你就能自己改输入，而不是到处抄。",
    goals: [
      "说出 CP2K 输入的树形结构，以及 `&SECTION` 与 `&END` 的配对规则",
      "分清关键字、section parameter、子节三者的位置与写法",
      "正确处理大小写、缩进、单位与默认值这四个高频坑",
      "用 `@SET`、`@INCLUDE`、`@IF` 组织可复用的输入，并会查 CP2K_INPUT 参考页",
    ],
    sections: [
      {
        id: "4.1",
        title: "输入是一棵树，不是一张参数表",
        blocks: [
          {
            type: "p",
            text: "把一份 CP2K 输入想象成文件系统：顶层是若干个大目录，每个目录下有子目录，最底层才是具体的值。CP2K 的顶层 section 一共 14 个，但你日常只会碰其中四个：`GLOBAL`、`FORCE_EVAL`、`MOTION`、`EXT_RESTART`。",
          },
          {
            type: "table",
            head: ["顶层 section", "管什么", "常用度"],
            rows: [
              ["`GLOBAL`", "项目名、运行类型、打印级别", "必写"],
              ["`FORCE_EVAL`", "能量与力：方法、DFT、基组、体系", "必写"],
              ["`MOTION`", "几何优化、MD、振动、NEB 的驱动设置", "做动力学时写"],
              ["`EXT_RESTART`", "从重启文件恢复坐标、速度、波函数", "续算时写"],
              ["`VIBRATIONAL_ANALYSIS`", "声子与振动分析", "按需"],
              ["`ATOM`", "原子级计算（孤立原子、原子轨道）", "少见"],
              ["`SWARM`", "多副本并行（如多条独立轨迹）", "少见"],
              ["`FARMING`", "把多个独立任务打包进一次运行", "少见"],
              ["`MULTIPLE_FORCE_EVALS`", "一次运行里比较多种力场/方法", "少见"],
              ["`NEGF`", "非平衡格林函数输运", "专门用途"],
              ["`OPTIMIZE_BASIS`", "基组优化", "专门用途"],
              ["`OPTIMIZE_INPUT`", "输入参数自动调优", "专门用途"],
              ["`DEBUG`", "调试开关与一致性检查", "排错时"],
              ["`TEST`", "单元测试入口", "开发者"],
            ],
            caption: "先记住前四个，其余用到再查。",
          },
          {
            type: "p",
            text: "为什么是树而不是平表？因为「截断能」只对 `MGRID` 有意义，「泛函」只对 `XC` 有意义。树把作用域写进了结构里：同一个关键字名在不同节点下可以是完全不同的东西。这也解释了为什么 CP2K 的参考手册是按节点分页的——一个节点一页。",
          },
          {
            type: "callout",
            kind: "info",
            title: "层级由 & 决定，不由缩进决定",
            text: "CP2K 解析器只看 `&SECTION` 与 `&END` 的配对，缩进纯粹给人看。缩进乱了程序照样跑，但人会看错层级，把关键字塞进错误的节点。所以缩进不是语法要求，是纪律要求。",
          },
        ],
      },
      {
        id: "4.2",
        title: "&SECTION 与 &END：配对，以及 section parameter",
        blocks: [
          {
            type: "p",
            text: "每个节点以 `&名字` 开头，以 `&END 名字` 结尾（`&END` 后面省略名字也合法，但写全更安全）。节点名后面还可以跟一个值，这叫 **section parameter**：它不是关键字，而是这个节点自己的参数。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "一份完整但精简的输入骨架",
            text: `&GLOBAL
  PROJECT h2o
  RUN_TYPE ENERGY
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
    &SCF
      EPS_SCF 1.0E-6
      MAX_SCF 50
    &END SCF
    &XC
      &XC_FUNCTIONAL PBE
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
  &SUBSYS
    &CELL
      ABC 10.0 10.0 10.0
      PERIODIC NONE
    &END CELL
    &COORD
      O  0.000  0.000  0.000
      H  0.757  0.586  0.000
      H -0.757  0.586  0.000
    &END COORD
    &KIND O
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q6
    &END KIND
    &KIND H
      BASIS_SET DZVP-MOLOPT-GTH
      POTENTIAL GTH-PBE-q1
    &END KIND
  &END SUBSYS
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "看几个 section parameter 的例子：`&KIND O` 里的 `O` 指定这个 KIND 对应氧元素；`&XC_FUNCTIONAL PBE` 里的 `PBE` 指定泛函；`&COORD` 下第一行可以写 `SCALED`，表示坐标用晶胞分数坐标。参数位置写错（比如写成 `O &KIND`）会直接解析失败。",
          },
          {
            type: "p",
            text: "同一类节点可以出现多次：每个元素一个 `&KIND`、每个约束一个 `&COLLECTIVE_VARIABLE`、每个打印项一个 `&EACH` 条目。CP2K 不会合并同名节点，而是按出现顺序各自生效。",
          },
          {
            type: "demo",
            id: "inputbuilder",
            title: "用生成器看骨架怎么长出来",
            desc: "选一个分子、改 RUN_TYPE 与截断能，右侧会实时生成对应的输入。对照上面的骨架，看每改一个选项，树里多出或少掉哪个节点。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "最常见的崩溃：&END 写错名字",
            text: "`&END MGRID` 写成 `&END GRID`，或漏掉某个 `&END`，都会让后续整段被解析进错误的节点。症状往往不是「语法错误」，而是某个关键字「位置不对」或「未知」。改输入时先数一遍 & 和 &END。",
          },
        ],
      },
      {
        id: "4.3",
        title: "大小写、缩进与文件名",
        blocks: [
          {
            type: "p",
            text: "CP2K 的输入**大小写不敏感**：`&global`、`&GLOBAL`、`&Global` 等价，`run_type energy` 也能跑。但有两类东西是敏感的：文件名与字符串值。`BASIS_MOLOPT` 写成 `basis_molopt`，在大小写敏感的文件系统上就找不到文件。",
          },
          {
            type: "p",
            text: "缩进不影响解析，但强烈建议每层两个空格。上万行的输入里，靠缩进一眼看出层级，比靠数 `&END` 快得多。编辑器里给 `&END` 做括号匹配，也能省掉大量低级错误。",
          },
          {
            type: "list",
            items: [
              "注释用 `#`，从 `#` 到行尾全部忽略；不要用 `!` 或 `//`",
              "关键字与值之间用**空格**分隔，不能写 `CUTOFF = 400`",
              "一行一个关键字；不要把两个关键字写在同一行",
              "值里含空格的字符串用引号包起来，例如项目名带空格",
              "空行随便加，解析器会跳过",
            ],
          },
          {
            type: "p",
            text: "关于文件名还有一条实用规则：`BASIS_SET_FILE_NAME` 与 `POTENTIAL_FILE_NAME` 只写文件名时，CP2K 会去 `CP2K_DATA_DIR` 找；写相对路径时相对于**运行目录**而不是输入文件所在目录。所以换目录运行前，先确认这两件事。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "让编辑器帮你",
            text: "VS Code 装一个 CP2K 语法高亮插件，或用 Vim 的 `:set foldmethod=indent`。把 `&` 开头的行折叠起来，一份输入就变成目录树，层级错误一眼可见。",
          },
        ],
      },
      {
        id: "4.4",
        title: "类型、单位与默认值",
        blocks: [
          {
            type: "p",
            text: "每个关键字都有类型。类型不对，CP2K 会在读输入时直接报「expected ... found ...」，而不是等到算到一半才崩。常见类型只有六种：",
          },
          {
            type: "table",
            head: ["类型", "合法写法", "例子"],
            rows: [
              ["logical", "`T` / `F` / `.TRUE.` / `.FALSE.`；打印节用 `ON` / `OFF`", "`UKS T`"],
              ["integer", "纯整数", "`MAX_SCF 50`"],
              ["real", "数字，可带单位", "`CUTOFF 400`、`ABC 10.0 10.0 10.0`"],
              ["enum", "预定义关键字", "`RUN_TYPE ENERGY`"],
              ["string", "原样字符串，含空格时加引号", "`PROJECT h2o`"],
              ["unit", "`[单位]` 形式", "`CUTOFF [eV] 54.4`"],
            ],
          },
          {
            type: "p",
            text: "单位是整个输入里最容易出问题的地方。CP2K 为每个量定义了**默认单位**：`MGRID CUTOFF` 是 Ry，`CELL ABC` 是 angstrom，温度是 K，时间是 fs。不写单位就用默认单位；写了 `[eV]`、`[nm]` 这类方括号，CP2K 会做换算。",
          },
          {
            type: "formula",
            tex: "1\\,\\mathrm{Ry} = 13.6057\\,\\mathrm{eV}",
            caption: "写 `CUTOFF 400` 是 400 Ry；想用 eV 表达同一个截断，就写 `CUTOFF [eV] 5442.3`。",
          },
          {
            type: "p",
            text: "默认值同样重要。没写的关键字不是「不生效」，而是取手册里的默认值。比如 `MGRID CUTOFF` 默认 280 Ry、`REL_CUTOFF` 默认 40 Ry、`SCF EPS_SCF` 默认 1.0E-5、`MAX_SCF` 默认 50、`SCF_GUESS` 默认 `ATOMIC`。这些默认值能跑，但未必适合你的体系。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "默认值不是「随便」，是「有含义」",
            text: "`SCF_GUESS ATOMIC` 表示用原子密度叠加做初猜，简单但收敛慢；续算时要显式改成 `RESTART`。`EPS_SCF 1.0E-5` 对能量够用，对力常数或振动分析往往不够。看到默认值，先问一句「它为什么是这个数」。",
          },
        ],
      },
      {
        id: "4.5",
        title: "变量与预处理：@SET、@INCLUDE、@IF",
        blocks: [
          {
            type: "p",
            text: "CP2K 在真正解析输入之前，会先跑一遍预处理器。它支持定义变量、包含文件、条件包含。这套机制让你把「同一套设置、不同体系」写成一份参数化的模板，而不是复制粘贴十几份输入。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "用 @SET 定义变量",
            text: `@SET project h2o
@SET cutoff 400
@SET xc PBE

&GLOBAL
  PROJECT \${project}
  RUN_TYPE ENERGY
&END GLOBAL

&FORCE_EVAL
  METHOD Quickstep
  &DFT
    &MGRID
      CUTOFF \${cutoff}
    &END MGRID
    &XC
      &XC_FUNCTIONAL \${xc}
      &END XC_FUNCTIONAL
    &END XC
  &END DFT
&END FORCE_EVAL`,
          },
          {
            type: "p",
            text: "`@SET 名字 值` 定义变量，`${名字}` 引用它。指令本身大小写不敏感，变量名区分大小写。`@INCLUDE 'common.inp'` 把另一个文件原样插进来，适合放基组路径、`&KIND` 这类共用块；`@IF` / `@ELSE` / `@ENDIF` 做条件包含，配合 `defined(名字)` 或变量比较。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "条件包含与文件复用",
            text: `@SET debug 1

@INCLUDE 'basis_and_kinds.inp'

&GLOBAL
  PROJECT test
  RUN_TYPE ENERGY
&END GLOBAL

@IF \${debug} == 1
&GLOBAL
  PRINT_LEVEL DEBUG
&END GLOBAL
@ELSE
&GLOBAL
  PRINT_LEVEL LOW
&END GLOBAL
@ENDIF`,
          },
          {
            type: "p",
            text: "注意 `@IF` 分支里重复写 `&GLOBAL` 是合法的：预处理器先决定保留哪一支，再交给解析器。所以最终进入解析器的输入里，`&GLOBAL` 只会出现一次。反过来，如果两支都保留，就会因为重复节点而报错。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "调试预处理结果",
            text: "预处理出错时，先在命令行用 `cpp` 或自己写个小脚本展开一遍，或者把 `@IF` 全换成固定值再跑。CP2K 的报错通常指向展开后的行号，和原文件对不上，容易看晕。",
          },
        ],
      },
      {
        id: "4.6",
        title: "查参考页：一个节点一页",
        blocks: [
          {
            type: "p",
            text: "手册的 Input Reference 是按节点组织的：每个 section 一页，URL 就是节点路径，例如 `https://manual.cp2k.org/trunk/CP2K_INPUT/FORCE_EVAL/DFT/MGRID.html`。页面里通常有四块内容：父节点面包屑、`SECTION_PARAMETERS`、关键字表、子节点列表。",
          },
          {
            type: "code",
            lang: "text",
            title: "参考页长这样（节选，字段顺序与页面一致）",
            text: `MGRID
  Section path: CP2K_INPUT / FORCE_EVAL / DFT / MGRID

  SECTION_PARAMETERS
    (none)

  CUTOFF
    Type: real
    Default: 280 [Ry]
    Usage: CUTOFF 400

  REL_CUTOFF
    Type: real
    Default: 40 [Ry]

  NGRIDS
    Type: integer
    Default: 4

  Subsections
    (none)`,
          },
          {
            type: "p",
            text: "读页面的顺序：先看 `Section path` 确认自己在树的哪一层；再看 `SECTION_PARAMETERS`（这一节名字后面能不能跟值）；然后扫关键字表的 `Default` 列，判断自己需不需要改；最后看 `Subsections`，决定还要不要往下点。",
          },
          {
            type: "p",
            text: "参考页首页还标了它对应的版本（当前是 2026.2 开发版）。不同版本的关键字可能增删，写生产输入时以你实际用的版本为准；源码树的 `tests/` 目录里有大量官方输入，比手册更贴近真实用法。",
          },
          {
            type: "callout",
            kind: "info",
            title: "手册没写清楚的，看测试输入",
            text: "CP2K 源码树的 `tests/` 下每个算例都带输入与参考输出。想知道某个功能「实际怎么配」，搜 `grep -rl \"&DFT\" tests/ | head` 再挑一个最像你体系的读。这比在参考页里逐关键字猜快得多。",
          },
        ],
      },
      {
        id: "4.7",
        title: "读一份输入的顺序",
        blocks: [
          {
            type: "p",
            text: "拿到别人的输入（或三个月前自己写的），不要从头逐行读。按「算什么 → 怎么算 → 算什么体系 → 精度多少」的顺序跳读，五分钟就能建立整体印象。",
          },
          {
            type: "steps",
            items: [
              { t: "先看 &GLOBAL", d: "`PROJECT` 决定输出文件名前缀，`RUN_TYPE` 决定这次是单点、优化还是 MD。这两个词定调。" },
              { t: "再看 &FORCE_EVAL 的 METHOD 与 &DFT", d: "`Quickstep` 是绝大多数情况；`BASIS_SET_FILE_NAME`、`POTENTIAL_FILE_NAME` 决定基组与赝势从哪来。" },
              { t: "然后看 &SUBSYS", d: "`CELL` 给晶胞与周期性，`COORD` 给坐标，`KIND` 给每个元素的基组与赝势。这是「算什么体系」。" },
              { t: "接着看精度三件套", d: "`MGRID CUTOFF`/`REL_CUTOFF`、`SCF EPS_SCF`/`MAX_SCF`、`XC_FUNCTIONAL`。这三处决定结果可不可信。" },
              { t: "最后看 &MOTION 与 &EXT_RESTART", d: "有 `MOTION` 说明在做优化/动力学；有 `EXT_RESTART` 说明这是续算，坐标可能不来自 `&COORD`。" },
            ],
          },
          {
            type: "code",
            lang: "bash",
            title: "快速画出输入的树",
            text: `# 只看 section 行，缩进即层级
grep -nE '^[[:space:]]*&' h2o.inp

# 数一数开合是否平衡（正常应相等）
grep -cE '^[[:space:]]*&[A-Za-z_]' h2o.inp
grep -cE '^[[:space:]]*&END' h2o.inp`,
          },
          {
            type: "p",
            text: "第一条命令输出的是骨架，第二条与第三条的数量对比能立刻发现漏掉的 `&END`。把这份骨架贴在报告或笔记里，比贴整份输入更清楚。",
          },
          {
            type: "keypoints",
            items: [
              "输入是树：`&SECTION` 开、`&END` 合，层级由配对决定而非缩进",
              "`&KIND O`、`&XC_FUNCTIONAL PBE` 里的值是 section parameter，不是关键字",
              "大小写不敏感，但文件名与字符串敏感；关键字与值之间只能用空格",
              "不写单位就用默认单位；不写关键字就取手册默认值",
              "`@SET`/`@INCLUDE`/`@IF` 让一份模板覆盖多个体系",
            ],
          },
        ],
      },
      {
        id: "4.8",
        title: "五个语法错误与它们的真面目",
        blocks: [
          {
            type: "p",
            text: "CP2K 的解析错误信息不算友好，但症状与原因之间的对应关系很稳定。下面五条覆盖了新手九成以上的输入错误。",
          },
          {
            type: "table",
            head: ["现象", "真正的原因", "怎么修"],
            rows: [
              ["`Unknown keyword` 或关键字「不生效」", "拼错，或放进了错误的节点", "对照参考页的 path，确认层级"],
              ["`Section ... not closed` / 读到文件尾报错", "漏了 `&END`，或 `&END` 名字写错", "数 `&` 与 `&END`，检查配对"],
              ["`A real type object was expected`", "值写成了字符串，或带了不该有的单位", "看类型列；数字不要加引号"],
              ["`Could not open file BASIS_MOLOPT`", "数据目录不对，或文件名大小写错", "设 `CP2K_DATA_DIR`，检查文件名"],
              ["结果明显不对但不报错", "关键字落在了错误层级，被静默忽略", "用 `grep -nE '^\\s*&'` 画树核对"],
            ],
            caption: "最后一条最危险：不报错的错误。",
          },
          {
            type: "p",
            text: "为什么「层级错」会静默通过？因为解析器遇到不认识的节点时，有时会把它当成字符串或直接跳过，而不是立刻失败。所以改完输入，别只看「有没有报错」，还要看输出里 `INPUT|` 回显的那一段——它打印的是 CP2K 实际接受的设置。",
          },
          {
            type: "callout",
            kind: "danger",
            title: "改完一定看回显",
            text: "输出文件里以 `INPUT|` 开头的行，是 CP2K 对你输入的最终理解。你写的 `CUTOFF 400` 有没有被接受、`&KIND` 有没有落到正确的元素上，这里一目了然。养成「跑之前先看回显」的习惯，能省掉大量重算。",
          },
          {
            type: "p",
            text: "下一章把这份输入真正跑起来：命令行怎么给、输出怎么分段、能量行在哪、跑完没跑完怎么判断。输入看懂了，运行只是把它送进去。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "CP2K 输入里的层级关系由什么决定？",
        options: [
          "缩进的空格数",
          "`&SECTION` 与 `&END` 的配对",
          "关键字出现的先后顺序",
          "文件名的前缀",
        ],
        answer: 1,
        explain: "解析器只看 `&` 开头与 `&END` 的配对；缩进只影响人阅读。缩进乱但配对对，程序照跑；配对错但缩进漂亮，照样报错。",
      },
      {
        q: "`&KIND O` 里的 `O` 属于什么？",
        options: [
          "一个关键字",
          "这个 section 的参数（section parameter），指定元素",
          "注释",
          "变量名",
        ],
        answer: 1,
        explain: "节点名后面的值是 section parameter，属于该节点自身。`&KIND O` 表示这个 KIND 对应氧；写成 `O &KIND` 会解析失败。",
      },
      {
        q: "写 `CUTOFF 400` 而不写单位，CP2K 按什么单位理解？",
        options: ["eV", "Hartree", "Ry", "angstrom"],
        answer: 2,
        explain: "`MGRID CUTOFF` 的默认单位是 Ry（手册默认值 280 [Ry]）。要用 eV 就写 `CUTOFF [eV] 5442.3`。",
      },
      {
        q: "想让十几份输入共用同一段基组与 KIND 设置，最合适的做法是？",
        options: [
          "每份输入复制粘贴一遍",
          "用 `@INCLUDE 'common.inp'` 引入共用文件",
          "把所有输入合成一个文件",
          "用 `&GLOBAL` 里的 `PROJECT` 指过去",
        ],
        answer: 1,
        explain: "`@INCLUDE` 在预处理阶段把文件原样插入，改一处即全生效。复制粘贴迟早不同步，合成一个文件则无法独立运行。",
      },
      {
        q: "输入里写了 `CUTOFF 400`，而手册默认是 280，运行时用哪个？",
        options: ["280，默认值优先", "400，输入覆盖默认值", "两者相加", "报错，必须删掉默认值"],
        answer: 1,
        explain: "默认值只在关键字缺省时生效。显式写了就以输入为准；反过来，没写的关键字全部取手册默认值，这正是「默认值也要懂」的原因。",
      },
    ],
    terms: [
      { t: "输入树", en: "input tree", d: "由 &SECTION 与 &END 嵌套形成的层级结构，每个节点对应一类设置。" },
      { t: "节点参数", en: "section parameter", d: "写在 section 名后面的值，如 `&KIND O` 的 O，属于该节点自身而非关键字。" },
      { t: "关键字", en: "keyword", d: "节点内的具体设置项，格式为「名字 值」，用空格分隔。" },
      { t: "默认值", en: "default value", d: "关键字缺省时 CP2K 采用的值，写在参考页的 Default 列。" },
      { t: "预处理器", en: "preprocessor", d: "正式解析前处理 @SET/@INCLUDE/@IF 等指令的阶段。" },
      { t: "包含文件", en: "include file", d: "用 @INCLUDE 插入到主输入中的片段，常放基组、赝势与 KIND。" },
      { t: "回显", en: "echoed input", d: "输出文件里以 INPUT| 开头的行，显示 CP2K 实际接受的设置。" },
    ],
    sources: [
      { t: "CP2K Input Reference", url: "https://manual.cp2k.org/trunk/CP2K_INPUT.html" },
      { t: "First Calculation", url: "https://manual.cp2k.org/trunk/getting-started/first-calculation.html" },
      { t: "Units", url: "https://manual.cp2k.org/trunk/units.html" },
    ],
  };
})();