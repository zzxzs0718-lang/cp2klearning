(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch02"] = {
    id: "ch02",
    num: 2,
    part: "准备",
    title: "安装与运行环境：把它装到能跑",
    subtitle: "从发行版包到源码编译，选一条适合你机器的路线",
    hours: 1.5,
    level: "入门",
    intro:
      "安装 CP2K 的难点不在点下一步，而在依赖：MPI、BLAS/LAPACK、FFTW、libwignernj，还要保证运行时的 mpirun 和编译时链接的 MPI 是同一个。这一章按「最省事 → 最可控」排三条路线，最后给出验证安装与排查常见问题的清单。",
    goals: [
      "根据操作系统、权限、网络与模块系统，选一条合适的安装路线",
      "用发行版包、conda 或 Spack 得到一个可运行的 cp2k.psmp",
      "用 toolchain 从源码编译，并说清 CP2K_DATA_DIR 与四个二进制的区别",
      "用 MPI × OpenMP 正确启动，并通过版本信息与示例输出验证安装",
    ],
    sections: [
      {
        id: "2.1",
        title: "动手之前：先做四个判断",
        blocks: [
          {
            type: "p",
            text: "CP2K 的安装文档默认你在 **Linux** 上工作，因为大多数编译与回归测试都在 Linux 发行版上跑。macOS（Apple Silicon）有 Spack、Homebrew 与容器三条路；Windows 建议用 WSL 或虚拟机提供一个 Linux 环境，而不是硬编译。",
          },
          {
            type: "table",
            head: ["判断", "如果是", "建议路线"],
            rows: [
              ["操作系统", "Linux", "发行版包 / conda / Spack / 源码"],
              ["", "macOS Apple Silicon", "Homebrew、Spack，或 Podman 容器"],
              ["", "Windows", "WSL 或虚拟机里的 Linux"],
              ["root / sudo", "没有", "完全可以在自己的目录里装（conda、Spack、toolchain）"],
              ["网络", "受限或离线", "先在别处下载，校验 sha256 后拷入"],
              ["模块系统", "有 LMod / Environment Modules", "`module avail`、`module show` 先看现有依赖"],
              ["GPU", "有专业卡（双精度好）", "可考虑 CUDA/HIP 构建；CPU-only 也能跑"],
            ],
            caption: "前四个判断基本决定了你该走哪条路线。",
          },
          {
            type: "p",
            text: "不需要 root 是一个常见误解的反面：CP2K 完全可以装在普通用户有读写权限的目录里。只有在用系统包管理器（`apt`、`dnf`、`pacman`）时才需要 sudo。",
          },
          {
            type: "callout",
            kind: "info",
            title: "模块系统先看，不要先装",
            text: "HPC 上通常已经有一套编译器、MPI 和数学库。先 `module avail` 看有什么、`module show` 看它会改哪些环境变量，再决定是复用还是自己编。复用现成模块能省几个小时，也能避免 MPI 版本冲突。",
          },
        ],
      },
      {
        id: "2.2",
        title: "最省事：发行版包与 conda",
        blocks: [
          {
            type: "p",
            text: "如果只是想尽快跑通一个计算，先用发行版或 conda 的预编译包。它们通常几分钟就能装好，缺点是编译策略偏保守，性能可能不如针对你机器优化的源码构建。",
          },
          {
            type: "code",
            lang: "bash",
            title: "三条一分钟路线",
            text: `# Debian / Ubuntu
sudo apt-get install cp2k

# Fedora
sudo dnf install cp2k

# Arch
sudo pacman -S cp2k

# conda（推荐装进独立环境，避免依赖冲突）
conda create -n cp2k_env conda-forge::cp2k
conda activate cp2k_env
cp2k -h -v`,
          },
          {
            type: "p",
            text: "conda 的包名是 `conda-forge::cp2k`，可以先 `conda search conda-forge::cp2k` 看有哪些版本。装完用 `cp2k -h -v` 同时打印帮助与版本信息；如果这条命令能出来版本号，说明基本可用。",
          },
          {
            type: "p",
            text: "macOS 上还可以 `brew install cp2k`，NixOS 用 `nix-shell -p cp2k`，FreeBSD 用 `pkg install cp2k`。容器路线则是 `podman pull docker.io/cp2k/cp2k:latest`，适合不想动主机环境的人。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "预编译包的性能天花板",
            text: "发行版为了兼容尽可能多的机器，通常采用保守的编译选项，可能没有针对你的 CPU 指令集优化，也未必链接最好的 BLAS。做生产计算前，用同一个 benchmark 比较一下预编译包与源码构建的耗时，差距常常值得那半小时编译。",
          },
        ],
      },
      {
        id: "2.3",
        title: "Spack：HPC 上的可复现路线",
        blocks: [
          {
            type: "p",
            text: "Spack 是面向 HPC 的包管理器，能在同一台机器上并存多个版本与配置。它把「编译器 + MPI + 数学库 + CP2K」整条依赖链固定下来，适合集群和需要复现的环境。",
          },
          {
            type: "code",
            lang: "bash",
            title: "Spack 安装与加载",
            text: `# 第一次使用 Spack 时注册编译器
spack compiler find

# 最简安装（会连同依赖一起编译，第一次比较久）
spack install cp2k
spack load cp2k
cp2k.psmp -v

# 带 libint / libxc 的常用配置
spack install cp2k +libint +libxc

# 固定版本与更多功能
spack install cp2k@2023.2 +libint +libxc +dlaf +sirius +cosma +spglib lmax=6`,
          },
          {
            type: "p",
            text: "`+VARIANT` 打开布尔选项，`~VARIANT` 关闭，`VARIANT=VALUE` 设非布尔值（如 `lmax=6`）。依赖用 `^` 指定，例如 `spack install cp2k ^intel-oneapi-mkl +cluster` 会选用 MKL 并打开它的集群支持。",
          },
          {
            type: "p",
            text: "GPU 构建用 `+cuda cuda_arch=80` 或 `+rocm amdgpu_target=gfx90a`。注意当同一台机器上装了多个 CP2K 变体时，`spack load cp2k` 可能不再唯一，需要写全 spec，例如 `spack load cp2k +cuda`。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "开发流程：只装依赖",
            text: "如果你要改 CP2K 源码，用 `spack install --only=dependencies CP2K_SPEC` 只装依赖，再用 `spack build-env CP2K_SPEC -- bash` 进入一个依赖齐全的 shell，在里面手动编译。这样迭代最快。",
          },
        ],
      },
      {
        id: "2.4",
        title: "源码编译（一）：toolchain 一条龙",
        blocks: [
          {
            type: "p",
            text: "从 2026.2 起，CP2K 只用 CMake 构建；更早的 2025 及以前版本用 GNU Make + ARCH 文件，已经弃用。源码树里自带两套自动化脚本：`tools/toolchain` 下的 toolchain 构建，和根目录的 `make_cp2k.sh`（Spack + CMake）。先讲 toolchain，因为它对离线环境最友好。",
          },
          {
            type: "p",
            text: "最低要求是一个符合 F2008 的 Fortran 编译器和一个符合 C2011 的 C 编译器；此外还需要 DBCSR、BLAS、LAPACK、FFTW、libwignernj（0.8 或更新）。MPI 构建还要 MPI 与 ScaLAPACK。toolchain 会把这些依赖编进 `tools/toolchain/install`。",
          },
          {
            type: "code",
            lang: "bash",
            title: "从源码到 cp2k.psmp",
            text: `# 取得源码（release tarball 最稳）
tar -xjf cp2k-2026.2.tar.bz2
cd cp2k-2026.2

# 编译依赖，再编译 CP2K
cd tools/toolchain
./install_cp2k_toolchain.sh
./build_cp2k.sh -j 8 --preset native-gnu-x86_64

# 每次运行前加载环境
source install/cp2k_env
cp2k.psmp -v`,
          },
          {
            type: "p",
            text: "`--preset native-gnu-x86_64` 会加 `-march=native`，为当前机器生成最优指令集。代价是这份二进制换到别的 CPU 上可能直接 `Illegal instruction`；要在集群的异构节点间共享，改用 `--preset none` 更稳。",
          },
          {
            type: "code",
            lang: "text",
            title: "cp2k.psmp -v 应该看到什么（节选）",
            text: ` CP2K version 2026.2
 Source code revision git:c92cc08
 cp2kflags: omp libint fftw3 libxc elpa parallel scalapack mpi_f08 cosma libxs spglib openblas
 compiler: GCC version 14.3.1 20251022 (Red Hat 14.3.1-4)
 compiler target: cpuid   1002 (x86_avx2)`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "别忘了 source cp2k_env",
            text: "toolchain 装出来的二进制依赖它自己那套库。登录节点编好、计算节点直接跑，常常因为没加载环境而报「找不到 libxxx」或「MPI 版本不匹配」。把 `source .../cp2k_env` 写进作业脚本，而不是只写进 `.bashrc`。",
          },
        ],
      },
      {
        id: "2.5",
        title: "源码编译（二）：CMake 与 make_cp2k.sh",
        blocks: [
          {
            type: "p",
            text: "如果你想自己控制依赖，或者需要 toolchain 不覆盖的功能（DLA-Future、PEXSI、SIRIUS 的 NLCG、更完整的 GPU 支持），走 Spack + CMake。源码根目录的 `make_cp2k.sh` 把这两步包在一起。",
          },
          {
            type: "code",
            lang: "bash",
            title: "make_cp2k.sh 与裸 CMake",
            text: `# 全功能构建（首次会编译大量依赖）
./make_cp2k.sh

# 最小构建
./make_cp2k.sh -bd -df all

# 按需打开功能
./make_cp2k.sh -bd -df all -ef libint2 -ef libxc -ef spglib

# 构建后跑回归测试
./make_cp2k.sh --test "--maxtasks 16"

# 不想用脚本时，直接 CMake（必须在源码树外构建）
cmake -S. -B build -DCMAKE_BUILD_TYPE=Release \\
  -DCP2K_USE_MPI=ON -DCP2K_USE_LIBXC=ON -DCP2K_USE_LIBINT2=ON
cmake --build build -j 8`,
          },
          {
            type: "p",
            text: "几个必须记住的 CMake 选项：`-DCMAKE_BUILD_TYPE=Release` 是生产默认；改成 `Debug` 会生成 `pdbg`/`sdbg` 而不是 `psmp`/`ssmp`。`-DCP2K_DATA_DIR` 必须是**绝对路径**，默认是安装前缀下的 `share/cp2k/data`；它决定运行时去哪找 `BASIS_MOLOPT` 与 `GTH_POTENTIALS`。",
          },
          {
            type: "table",
            head: ["选项", "作用", "常见取值"],
            rows: [
              ["`-DCMAKE_BUILD_TYPE`", "优化级别与调试符号", "`Release`、`Debug`"],
              ["`-DCP2K_USE_MPI`", "是否构建 MPI 版本", "`ON` / `OFF`"],
              ["`-DCP2K_USE_LIBXC`", "泛函库", "`ON`（绝大多数情况）"],
              ["`-DCP2K_USE_LIBINT2`", "杂化泛函的积分", "`ON`（用 HFX 时）"],
              ["`-DCP2K_DATA_DIR`", "基组与赝势数据目录", "绝对路径"],
              ["`-DCP2K_USE_ACCEL`", "GPU 后端", "`CUDA` / `HIP` / `OFF`"],
            ],
          },
          {
            type: "callout",
            kind: "warn",
            title: "两条硬规则",
            text: "第一，**禁止在源码目录内构建**：`-B` 必须指向一个独立目录，否则 CMake 会直接报错。第二，`CP2K_DATA_DIR` 不接受相对路径；写错不会在编译时报错，而是在第一次运行时以「找不到基组文件」的形式出现。",
          },
        ],
      },
      {
        id: "2.6",
        title: "macOS 与容器：不改主机也能跑",
        blocks: [
          {
            type: "p",
            text: "Apple Silicon 上推荐两条路：Homebrew 原生安装，或用 Podman 跑官方 Linux 容器。容器与集群环境一致，适合先在本地验证输入，再拿到 Linux 集群上跑。",
          },
          {
            type: "code",
            lang: "bash",
            title: "macOS + Podman 跑 CP2K",
            text: `brew install podman

# 创建并启动 Linux 虚拟机（资源在建机时定死）
podman machine init --cpus 8 --memory 12288 --disk-size 100
podman machine start

# 拉取 aarch64 的 psmp 镜像
podman pull docker.io/cp2k/cp2k:2026.2_mpich_aarch64_psmp

# 4 个 MPI 进程 × 每进程 2 个 OpenMP 线程
podman run --rm --shm-size=1g -v "$PWD:/mnt" \\
  docker.io/cp2k/cp2k:2026.2_mpich_aarch64_psmp \\
  mpiexec -n 4 -genv OMP_NUM_THREADS=2 cp2k -i h2o.inp -o h2o.out`,
          },
          {
            type: "p",
            text: "Podman 只共享 `/Users`：输入文件必须放在主目录下，外接磁盘上的 `/Volumes` 默认看不到。`--shm-size=1g` 给 MPI 共享内存；容器退出码 137 表示虚拟机内存不够，先用 `podman machine set --memory` 加内存，或减少 MPI 进程。",
          },
          {
            type: "p",
            text: "Apple Silicon 有性能核与能效核，并行时所有人等最慢的那个。所以「用满所有核」常常不比「只用性能核」快。选镜像时只认带 `aarch64` 的 tag，否则会在 Rosetta 或 QEMU 模拟下慢得离谱。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "Homebrew 还是容器",
            text: "只想算几个小体系：`brew install cp2k` 最省事。要复现集群结果、或需要特定 MPI/库组合：用容器。两者可以并存，互不干扰。",
          },
        ],
      },
      {
        id: "2.7",
        title: "四个二进制与启动布局",
        blocks: [
          {
            type: "p",
            text: "编译会产出四个可执行文件，名字里的字母不是随意的：`p` 是并行（MPI），`s` 是串行，`smp` 是共享内存并行（OpenMP），`dbg` 是调试版。选错二进制，轻则跑不满核，重则直接报 MPI 错误。",
          },
          {
            type: "table",
            head: ["二进制", "并行方式", "什么时候用"],
            rows: [
              ["`cp2k.psmp`", "MPI + OpenMP", "生产计算默认；单节点也能用"],
              ["`cp2k.ssmp`", "仅 OpenMP（串行）", "笔记本、调试、没有 MPI 的环境"],
              ["`cp2k.pdbg`", "MPI + OpenMP + 调试", "定位崩溃、配合 `gdb`"],
              ["`cp2k.sdbg`", "串行 + 调试", "复现只在串行出现的问题"],
            ],
          },
          {
            type: "p",
            text: "并行布局的原则只有一条：**MPI 进程数 × 每进程 OpenMP 线程数 ≤ 可用核数**。超过这个数就是超订，线程互相抢核，通常更慢。小体系用「多进程、每进程 1 线程」往往更划算；大体系、内存吃紧时用「少进程、多线程」降低副本开销。",
          },
          {
            type: "code",
            lang: "bash",
            title: "两种典型布局",
            text: `# 4 个 MPI 进程，每进程 1 个线程（小体系常用）
mpirun -np 4 -x OMP_NUM_THREADS=1 cp2k.psmp -i h2o.inp -o h2o.out

# 4 个 MPI 进程 × 4 个 OpenMP 线程 = 16 核
mpirun -np 4 -x OMP_NUM_THREADS=4 cp2k.psmp -i h2o.inp -o h2o.out

# 没有 MPI 的环境：串行 + OpenMP
export OMP_NUM_THREADS=8
cp2k.ssmp -i h2o.inp -o h2o.out`,
          },
          {
            type: "p",
            text: "`-x` 是 Open MPI 的写法，把环境变量导出给各进程；MPICH 对应的是 `-genv`。如果直接用 `export OMP_NUM_THREADS=4` 再 `mpirun`，在 Open MPI 下通常也能继承，但显式写出来更不容易出错。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "超订比你想的更常见",
            text: "节点有 32 核，提交脚本申请 16 核，却写了 `mpirun -np 16` 加 `OMP_NUM_THREADS=4`——这是 64 个线程抢 16 核。程序不会报错，只会变慢，还可能在 Slurm 里被 cgroup 限制到卡死。申请多少核，就按多少核算乘数。",
          },
        ],
      },
      {
        id: "2.8",
        title: "验证安装：三步与一张排错表",
        blocks: [
          {
            type: "p",
            text: "装完不要直接上生产。先做三步检查：版本、数据文件、冒烟测试。三步都过，才说明这份二进制在你的环境里真的可用。",
          },
          {
            type: "steps",
            items: [
              { t: "看版本与编译选项", d: "`cp2k.psmp -v`：确认 version、cp2kflags、compiler target 符合预期。" },
              { t: "确认数据目录", d: "`ls $CP2K_DATA_DIR/BASIS_MOLOPT` 能列出文件；没有就查 CMake 的 `CP2K_DATA_DIR` 或环境变量。" },
              { t: "跑一个最小例子", d: "用第 3 章的水分子输入跑一遍，确认输出以 `CP2K ENDED` 结束。" },
            ],
          },
          {
            type: "code",
            lang: "bash",
            title: "三步验证",
            text: `cp2k.psmp -v
ls "$CP2K_DATA_DIR/BASIS_MOLOPT" "$CP2K_DATA_DIR/GTH_POTENTIALS"

cp2k.psmp -i h2o.inp -o h2o.out
grep -n "CP2K ENDED" h2o.out`,
          },
          {
            type: "table",
            head: ["症状", "原因", "修法"],
            rows: [
              ["`Could not open file BASIS_MOLOPT`", "运行时找不到数据目录", "设 `CP2K_DATA_DIR`，或在输入里写绝对路径"],
              ["日志逐行重复，`DBCSR` 显示 1 个进程", "`mpirun` 与 CP2K 链接的 MPI 不是同一个", "`which mpirun` 对比 `ldd cp2k.psmp`；source `cp2k_env`"],
              ["CMake 找不到 `libwignernj` / FFTW", "依赖缺失或版本过旧", "用 toolchain/Spack 装；`libwignernj` 需 ≥0.8"],
              ["容器退出码 137", "Podman 虚拟机内存不足", "`podman machine set --memory`，或减少 MPI 进程"],
              ["`Illegal instruction`", "`-march=native` 的二进制换了 CPU", "用 `--preset none` 重编，或换匹配的包"],
            ],
            caption: "前两条占了新手问题的大半；先查这两条，再怀疑代码。",
          },
          {
            type: "keypoints",
            items: [
              "Linux 是默认平台；macOS 走 Homebrew/Spack/容器，Windows 用 WSL",
              "不需要 root：conda、Spack、toolchain 都能装在用户目录",
              "源码构建从 2026.2 起统一用 CMake；`CP2K_DATA_DIR` 必须是绝对路径",
              "`psmp` 用于生产，`ssmp` 用于无 MPI 环境；进程数 × 线程数不要超过核数",
              "验证安装：`-v`、数据文件、水分子冒烟测试，三步缺一不可",
            ],
          },
          {
            type: "callout",
            kind: "tip",
            title: "下一步",
            text: "环境就绪后直接进第 3 章：写一份 40 行的水分子输入，把它跑通。安装过程中遇到的路径、模块、MPI 问题，都会在那次运行里得到最终检验。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "没有 root 权限，还能在本机安装 CP2K 吗？",
        options: [
          "不能，必须 sudo",
          "能：conda、Spack、toolchain 都可以装在用户目录",
          "只能用 Docker，且必须 root",
          "只能让管理员装",
        ],
        answer: 1,
        explain: "CP2K 不要求 root。conda 环境、Spack、源码 toolchain 都装在用户有写权限的目录里；只有系统包管理器（apt/dnf/pacman）需要 sudo。",
      },
      {
        q: "`cp2k.psmp` 与 `cp2k.ssmp` 的核心区别是？",
        options: [
          "前者是调试版，后者是发布版",
          "前者支持 MPI + OpenMP，后者只支持 OpenMP（串行）",
          "前者只能算周期体系",
          "后者不支持 GTH 赝势",
        ],
        answer: 1,
        explain: "p = parallel（MPI），s = serial；smp 表示共享内存并行（OpenMP）。名字以 dbg 结尾的才是调试版。",
      },
      {
        q: "用 CMake 指定 `CP2K_DATA_DIR` 时，下面哪种写法符合要求？",
        options: [
          "相对路径 `./data`",
          "绝对路径 `/opt/cp2k/share/cp2k/data`",
          "只写目录名 `data`",
          "留空，让它运行时再找",
        ],
        answer: 1,
        explain: "手册明确要求 `CP2K_DATA_DIR` 是绝对路径。默认值是安装前缀下的 `share/cp2k/data`；写错不会在编译期报错，而是在运行时找不到基组文件。",
      },
      {
        q: "输出日志里每一行都重复出现，且 `DBCSR` 显示 1 个进程，最可能的原因是？",
        options: [
          "CP2K 版本太旧",
          "`mpirun` 与 CP2K 链接的 MPI 不是同一个",
          "基组文件缺失",
          "内存不足",
        ],
        answer: 1,
        explain: "这是多个独立进程同时往一个日志里写的典型表现。用 `which mpirun` 对比 `ldd cp2k.psmp` 的 MPI 库，检查 module、conda 与 `cp2k_env` 是否冲突。",
      },
      {
        q: "在 macOS 的 Podman 容器里，CP2K 被杀死并返回 137，首先应该？",
        options: [
          "重装 CP2K",
          "给 Podman 虚拟机加内存，或减少 MPI 进程",
          "把 `OMP_NUM_THREADS` 设成 0",
          "换一个不带 aarch64 的镜像",
        ],
        answer: 1,
        explain: "137 = 128 + 9，表示被 SIGKILL 杀死，容器场景里通常是虚拟机内存耗尽。用 `podman machine set --memory` 扩容，或降低并行度。",
      },
    ],
    terms: [
      { t: "工具链", en: "toolchain", d: "CP2K 自带的一套脚本，自动编译并安装 MPI、数学库、FFTW 等依赖。" },
      { t: "psmp", en: "parallel shared-memory parallel", d: "CP2K 的 MPI + OpenMP 生产版二进制，也是最常用的一个。" },
      { t: "CP2K_DATA_DIR", en: "CP2K data directory", d: "存放 BASIS_MOLOPT、GTH_POTENTIALS 等数据文件的目录，编译时写入、运行时也可覆盖。" },
      { t: "MPI", en: "Message Passing Interface", d: "跨进程通信标准；`mpirun` 启动多个进程，每个进程有独立内存。" },
      { t: "OpenMP", en: "OpenMP", d: "单进程内的多线程并行；用 `OMP_NUM_THREADS` 控制线程数。" },
      { t: "Spack", en: "Spack", d: "面向 HPC 的包管理器，可并存多个版本与编译配置，依赖用 spec 描述。" },
      { t: "容器", en: "container", d: "把程序与依赖打包进隔离环境；macOS 上由 Podman 虚拟机运行 Linux 容器。" },
    ],
    sources: [
      { t: "Installation", url: "https://manual.cp2k.org/trunk/getting-started/installation.html" },
      { t: "Install from Distribution", url: "https://manual.cp2k.org/trunk/getting-started/distributions.html" },
      { t: "Build from Source", url: "https://manual.cp2k.org/trunk/getting-started/build-from-source.html" },
      { t: "Build with Spack", url: "https://manual.cp2k.org/trunk/getting-started/build-with-spack.html" },
    ],
  };
})();