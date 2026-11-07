(function () {
  window.CONTENT = window.CONTENT || {};
  window.CONTENT["ch03"] = {
    id: "ch03",
    num: 3,
    part: "起步",
    title: "安装与运行：从预编译包到集群作业",
    subtitle: "先把二进制跑起来，再谈优化与并行",
    hours: 3.0,
    level: "入门",
    intro:
      "安装 CP2K 的难点不在解压，而在依赖链：编译器、MPI、BLAS/LAPACK、FFTW、libxc、libint、ELPA 必须彼此匹配，运行时的 mpirun 还必须和编译时链接的是同一套 MPI。这一章按「最省事 → 最可控」排路线，最后给出验证与排错清单。",
    goals: [
      "根据操作系统、权限、网络与模块系统选一条安装路线",
      "用预编译 ssmp 包在单节点跑通，并说清它为什么不能跨节点",
      "用 toolchain 或 CMake 从源码构建 popt/psmp，并解释 arch/preset 的作用",
      "写出 Slurm/PBS 提交脚本，正确排布 MPI 进程与 OpenMP 线程",
      "用 H2O 单点与 PROGRAM ENDED AT 验证安装，并定位五类常见错误",
    ],
    sections: [
      {
        id: "3.1",
        title: "动手之前：五个判断决定路线",
        blocks: [
          {
            type: "p",
            text: "CP2K 手册的安装页默认你在 **Linux** 上工作，因为大多数编译与回归测试都在 Linux 发行版上跑。macOS（Apple Silicon）有 Spack、Homebrew 与容器三条路；Windows 建议用 WSL 或虚拟机提供一个 Linux 环境，而不是硬编译。",
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
              ["节点类型", "登录节点与计算节点不同", "编译环境要在计算节点复现，或写进作业脚本"],
              ["GPU", "有专业卡（双精度好）", "可考虑 CUDA/HIP 构建；CPU-only 也能跑"],
            ],
            caption: "前四个判断基本决定了你该走哪条路线；后两个决定编译出来的东西能不能在计算节点上跑。",
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
        id: "3.2",
        title: "最省事：预编译 ssmp 与发行版包",
        blocks: [
          {
            type: "p",
            text: "如果只是想尽快跑通一个计算，先用预编译包。课程演示的是 GitHub Releases 里的 `cp2k-6.1-Linux-x86_64.ssmp`：下载后加执行权限即可用、不需要 MPI，适合单节点。",
          },
          {
            type: "code",
            lang: "bash",
            title: "预编译 ssmp：下载、加权限、跑起来",
            text: `# 从 GitHub Releases 下载对应版本后（文件名以实际发布为准）
chmod +x cp2k-6.1-Linux-x86_64.ssmp

# 课程示例：28 核节点，用满 28 个 OpenMP 线程
export OMP_NUM_THREADS=28

# 位置参数写法：输入文件直接跟在后面，stdout/stderr 分开重定向
./cp2k-6.1-Linux-x86_64.ssmp cp2k.inp 1>cp2k.out 2>cp2k.err

# 也可以显式指定输入输出
./cp2k-6.1-Linux-x86_64.ssmp -i cp2k.inp -o cp2k.out`,
          },
          {
            type: "p",
            text: "ssmp 的 `s` 指 SMP，也就是只用 OpenMP、不用 MPI。它**只能在一个节点内跑**，不能跨节点；课程实测，它的效率比针对机器正常编译的版本低约 30%–50%。优点是零依赖、几分钟就能开始，适合验证输入与教学。",
          },
          {
            type: "table",
            head: ["路线", "命令", "相对耗时（正常编译=1）", "能否跨节点", "适合"],
            rows: [
              ["预编译 ssmp", "下载 + `chmod +x`", "约 1.3–1.5（慢 30%–50%）", "否", "单节点、快速验证"],
              ["发行版包", "`apt-get install cp2k`", "约 1.1", "能", "不想折腾、能接受保守编译"],
              ["conda", "`conda create -n cp2k_env conda-forge::cp2k`", "接近发行版", "能", "无 root、需要独立环境"],
              ["源码 + toolchain", "见 3.3", "1（基准）", "能", "要插件、要性能"],
              ["Spack", "`spack install cp2k`", "取决于 spec", "能", "可复现、多版本共存"],
            ],
            caption: "「相对效率」来自课程对比，不是绝对性能；不同机器与输入会变。",
          },
          {
            type: "code",
            lang: "bash",
            title: "发行版、conda 与容器：三条一分钟路线",
            text: `# Debian / Ubuntu
sudo apt-get install cp2k

# Fedora
sudo dnf install cp2k

# Arch
sudo pacman -S cp2k

# conda：装进独立环境，避免依赖冲突
conda create -n cp2k_env conda-forge::cp2k
conda activate cp2k_env
cp2k -h -v

# 容器：不污染宿主机，适合 macOS 与共享集群
podman pull docker.io/cp2k/cp2k:latest
podman run --rm -v "$PWD":/work -w /work docker.io/cp2k/cp2k:latest cp2k.psmp -i h2o.inp -o h2o.out`,
          },
          {
            type: "callout",
            kind: "warn",
            title: "发行版包的编译策略偏保守",
            text: "为了在尽可能多的机器上运行，发行版通常不会开 `-march=native`，也不一定带 ELPA、libint、libxc 的全部功能。先用它跑通流程可以，做生产前用 `cp2k.psmp -v` 看清 `cp2kflags`，确认你要的功能真的编进去了。",
          },
        ],
      },
      {
        id: "3.3",
        title: "源码编译（课程路线）：toolchain 一把梭",
        blocks: [
          {
            type: "p",
            text: "课程录制时的稳定版是 7.1，构建方式是 GNU Make + ARCH 文件。下面这条路线会先把依赖装进 `tools/toolchain/install`，再编 CP2K 本身。它不需要 root，也不会动系统库。",
          },
          {
            type: "code",
            lang: "bash",
            title: "从 clone 到 make：7.1 的完整流程",
            text: `# 1) 取源码；7.1 及更早版本必须带 submodule（DBCSR）
git clone -b support/v7.1 --recursive https://github.com/cp2k/cp2k.git cp2k
cd cp2k
git submodule update --init --recursive

# 2) 准备编译器：GNU >= 5（课程用过 7.3 / 7.5 / 8.3 / 9.3）
gcc --version
gfortran --version

# 3) 构建依赖。MKL 可免费使用，不需要 Intel 编译器
cd tools/toolchain
./install_cp2k_toolchain.sh -h
./install_cp2k_toolchain.sh \\
  --with-openmpi=install \\
  --math-mode=mkl \\
  --with-scalapack=no

# 4) 把生成的 arch 文件放回源码树，并加载环境
cp install/arch/* ../../arch/
cd ../..
source tools/toolchain/install/setup

# 5) 编 popt 与 psmp；-j 按登录节点核数填
make -j 16 ARCH=local VERSION="popt psmp"

# 6) 跑回归测试（可选，但建议至少跑一遍）
make -j 16 ARCH=local VERSION="popt psmp" test`,
          },
          {
            type: "p",
            text: "`install_cp2k_toolchain.sh` 的选项很多，课程常用的三个是：`--with-openmpi=install`（自己装 MPI，避免与系统 MPI 混用）、`--math-mode=mkl`（用 MKL 的 BLAS/LAPACK/FFT）、`--with-scalapack=no`（先关掉 ScaLAPACK，减少依赖）。其余依赖按需打开：`--with-libxc=install`（泛函库）、`--with-libint=install`（杂化的 HFX 积分）、`--with-libxsmm=install`（小矩阵乘）、`--with-elpa=install`（本征求解器）。每多一个库，就多一个版本匹配问题，只装真正要用的。",
          },
          {
            type: "p",
            text: "编译完成后，`arch/` 下会多出 `local.popt`、`local.psmp` 等文件，`exe/` 下是对应二进制。`ARCH=local` 就是告诉 make 用 `arch/local.*`；`VERSION` 写成「popt psmp」表示两个并行版本都编。",
          },
          {
            type: "callout",
            kind: "info",
            title: "回归测试里的 WRONG 不一定是错",
            text: "课程提到，regtest 报 WRONG 有时只是参考值容差设得比实际误差还小（例如容差 1e-13、误差 4.27e-10）。先看差的是能量、力还是几何，再判断是否影响你的体系；SCF 一般收敛到 1e-8 就足够。",
          },
        ],
      },
      {
        id: "3.4",
        title: "现代构建：CMake、Spack 与容器",
        blocks: [
          {
            type: "p",
            text: "如果你现在从官网拉的是 2026.x，**不要照抄 3.3 的 `make ARCH=...`**。手册明确写了：2025 年及以前的版本用 GNU Make + ARCH；2026.1 是第一个完全改用 CMake 的版本；2026.2 起提供 `build_cp2k.sh` 与 `make_cp2k.sh` 两个脚本。",
          },
          {
            type: "code",
            lang: "bash",
            title: "2026.2+：toolchain + CMake 构建",
            text: `# 取 release tarball（不要用 GitHub 自动生成的 Source code 包）
tar -xjf cp2k-2026.2.tar.bz2
cd cp2k-2026.2

# 先装依赖；默认装到 tools/toolchain/install
cd tools/toolchain
./install_cp2k_toolchain.sh

# 再用脚本配置并编译；--preset 由工具链建议
./build_cp2k.sh -j 16 --preset native-gnu-x86_64

# 每次运行前加载环境（作业脚本里也要写）
source install/cp2k_env
cp2k.psmp -v`,
          },
          {
            type: "p",
            text: "`build_cp2k.sh` 是把 CMake 的配置、编译、安装串起来的封装；`--prefix` 可以装到源码树外。关键变化是：不再手改 `arch` 文件，而是用 **CMake preset** 描述编译器、MPI、数学库与可选功能。旧教程里的 `ARCH=local` 在新版本里没有对应物。",
          },
          {
            type: "p",
            text: "Spack 适合「多版本共存 + 可复现」。它把 CP2K 与依赖都当成包，用 spec 描述变体；装完 `spack load cp2k` 就能用。代价是首次安装要从源码编依赖，时间较长。",
          },
          {
            type: "code",
            lang: "bash",
            title: "Spack：装一个带 libint/libxc 的 CP2K",
            text: `# 首次使用先让 Spack 找到编译器
spack compiler find

# 最小安装
spack install cp2k

# 带杂化与泛函库；Spack 会自动选兼容版本
spack install cp2k +libint +libxc

# 指定版本与更多变体
spack install cp2k@2023.2 +libint +libxc

# 使用
spack load cp2k
cp2k.psmp -v

# 只装依赖，自己编 CP2K（开发流程）
spack install --only=dependencies cp2k@2023.2
spack build-env cp2k@2023.2 -- bash`,
          },
          {
            type: "table",
            head: ["方式", "适合", "优点", "代价"],
            rows: [
              ["toolchain + Make（≤2025.2）", "课程环境、旧集群", "脚本成熟，ARCH 可控", "手动解决库冲突；新版已弃用"],
              ["toolchain + CMake（2026.2+）", "当前稳定版", "官方推荐，preset 可复用", "旧教程不能照抄"],
              ["Spack", "多版本、可复现、无 root", "依赖自动匹配，环境隔离", "首次编译时间长"],
              ["容器", "macOS、教学、快速验证", "环境一致，零安装", "GPU/MPI 直通需额外配置"],
            ],
            caption: "路线没有优劣，只有「你的集群支持哪一种」。先问管理员，再动手。",
          },
        ],
      },
      {
        id: "3.5",
        title: "ssmp、popt、psmp 与 arch 文件：到底在选什么",
        blocks: [
          {
            type: "p",
            text: "三个后缀不是版本，而是并行模型。选错会让「加了核反而更慢」，原因通常是进程/线程与内存的配比不对。",
          },
          {
            type: "table",
            head: ["二进制", "并行模型", "内存", "适用", "不要用来"],
            rows: [
              ["ssmp", "OpenMP only", "单进程，共享内存", "单节点、快速验证", "跨节点；超多核扩展"],
              ["popt", "MPI only", "每进程一份数据，内存高", "跨节点、纯 MPI 集群", "单节点多核（线程没用上）"],
              ["psmp", "MPI + OpenMP", "每节点一份/每进程一份，介于两者", "正式生产、跨节点 + 多线程", "线程数超过物理核"],
            ],
            caption: "课程的经验：popt 与 psmp 的速度基本一样，但 psmp 的内存效率更高，所以生产优先 psmp。",
          },
          {
            type: "p",
            text: "在 Make 时代，这些差异写在 `arch` 文件里。一个 `local.psmp` 的骨架大致如下（变量名随版本略有差异，以你生成的模板为准）：",
          },
          {
            type: "code",
            lang: "text",
            title: "arch/local.psmp 的关键变量",
            text: `CC       = gcc
FC       = gfortran
LD       = gfortran
AR       = ar -r

# 优化与 OpenMP；-march=native 只在本机编译时用
FCFLAGS  = -O2 -fopenmp -march=native -ffast-math -funroll-loops
LDFLAGS  = -fopenmp

# 并行与库；psmp 必须开 MPI，通常也开 ScaLAPACK
DFLAGS   = -D__FFTW3 -D__parallel -D__SCALAPACK -D__MPI_VERSION=3

# 具体库名取决于 toolchain/MKL 的安装位置
LIBS     = -lscalapack -lopenblas -lfftw3 -lfftw3_omp`,
          },
          {
            type: "p",
            text: "`DFLAGS` 里的 `-D__parallel` 打开 MPI 并行，`-D__SCALAPACK` 启用分布式本征求解，`-D__FFTW3` 用 FFTW 做网格变换。少一个，编出来的二进制可能在运行时才报「未知并行环境」或直接串行跑。`-march=native` 能让编译器针对本机指令集优化，但**跨节点编译**时要确认计算节点 CPU 支持同一指令集，否则会在计算节点上 illegal instruction。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "登录节点编译，计算节点运行",
            text: "如果登录节点与计算节点 CPU 不同，`-march=native` 编出来的程序可能在计算节点上崩溃。要么在计算节点上编译，要么用 `-march=x86-64-v3` 这类保守目标，或者直接用集群提供的模块。",
          },
        ],
      },
      {
        id: "3.6",
        title: "提交作业：Slurm、PBS 与进程×线程布局",
        blocks: [
          {
            type: "p",
            text: "集群上不要直接 `mpirun`，而是写提交脚本。核心只有两个数：**总 MPI 进程数**与**每进程 OpenMP 线程数**，两者相乘不能超过分到的核数。",
          },
          {
            type: "code",
            lang: "bash",
            title: "Slurm：2 节点 × 32 进程 × 2 线程",
            text: `#!/bin/bash
#SBATCH --job-name=cp2k
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=32
#SBATCH --cpus-per-task=2
#SBATCH --time=24:00:00
#SBATCH --partition=cpu
#SBATCH --output=cp2k-%j.out
#SBATCH --error=cp2k-%j.err
#SBATCH --mem=0

# 每个 MPI 进程 2 个 OpenMP 线程
export OMP_NUM_THREADS=\${SLURM_CPUS_PER_TASK}
export OMP_PLACES=cores
export OMP_PROC_BIND=close

# 总进程数 = 节点数 × 每节点任务数 = 64；总核数 = 64 × 2 = 128
srun --ntasks=\$((SLURM_NNODES * SLURM_NTASKS_PER_NODE)) \\
     --cpus-per-task=\${SLURM_CPUS_PER_TASK} \\
     cp2k.psmp -i h2o.inp -o h2o.out`,
          },
          {
            type: "p",
            text: "`--mem=0` 在 Slurm 里表示「占用节点全部内存」，适合 CP2K 这种内存需求随体系增长的程序；如果集群按内存计费，改成实测值更划算。`OMP_PLACES=cores` 与 `OMP_PROC_BIND=close` 让线程贴着物理核，减少跨 NUMA 访问；不设也能跑，但性能可能差一截。",
          },
          {
            type: "code",
            lang: "bash",
            title: "PBS：同一件事的另一种写法",
            text: `#!/bin/bash
#PBS -N cp2k
#PBS -l nodes=2:ppn=64
#PBS -l walltime=24:00:00
#PBS -j oe

cd "\$PBS_O_WORKDIR"
export OMP_NUM_THREADS=2
export OMP_PLACES=cores

# PBS 下通常直接用 mpirun；-x 把环境变量传给子进程
mpirun -np 64 -x OMP_NUM_THREADS \\
       cp2k.psmp -i h2o.inp -o h2o.out`,
          },
          {
            type: "p",
            text: "核数怎么估？先看节点规格：课程示例是 28 核节点，预编译 ssmp 就直接 `OMP_NUM_THREADS=28`。做 MPI+OpenMP 时，常见起点是**每进程 1–4 线程**：进程多、内存够，SCF 并行好；线程多、进程少，内存省，但扩展性受限于单进程内的并行度。没有万能配比，用 10 步短算例测三组（如 64×1、32×2、16×4），看每步耗时与内存峰值再定。",
          },
          {
            type: "p",
            text: "内存估算不要拍脑袋。先跑一个 10 步的短算例，读输出里的内存统计与 `/usr/bin/time -v` 的峰值，再按原子数、基组与是否杂化外推。杂化（HFX）会额外存大量积分，内存随 MPI 进程数变化，是最容易 OOM 的场景。",
          },
          {
            type: "callout",
            kind: "tip",
            title: "先测再提交长任务",
            text: "任何超过几小时的作业，先用同样的输入跑 10–20 步，记录每步耗时、SCF 迭代数与内存峰值，再乘上总步数。直接提交 5000 步，最常见的结局是跑到一半 OOM 或被墙钟杀掉。",
          },
        ],
      },
      {
        id: "3.7",
        title: "验证安装：水分子单点与 PROGRAM ENDED AT",
        blocks: [
          {
            type: "p",
            text: "装完不要立刻上生产。用一个水分子的单点能验证三件事：二进制能启动、数据文件能找到、SCF 能收敛。下面这份输入只依赖 `BASIS_MOLOPT` 与 `GTH_POTENTIALS`，是检验安装的最小闭环。",
          },
          {
            type: "code",
            lang: "cp2k",
            title: "h2o.inp：安装验证用单点",
            text: `&GLOBAL
  PROJECT h2o
  RUN_TYPE ENERGY
  PRINT_LEVEL MEDIUM
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
      SCF_GUESS ATOMIC
      EPS_SCF 1.0E-6
      MAX_SCF 50
      &OT
        MINIMIZER DIIS
        PRECONDITIONER FULL_SINGLE_INVERSE
      &END OT
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
      O   0.0000   0.0000   0.0000
      H   0.7570   0.5860   0.0000
      H  -0.7570   0.5860   0.0000
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
            type: "code",
            lang: "bash",
            title: "四个检查，缺一不可",
            text: `# 1) 版本与编译选项
cp2k.psmp -v

# 2) 跑起来
cp2k.psmp -i h2o.inp -o h2o.out 2> h2o.err

# 3) 正常结束
grep -n "PROGRAM ENDED AT" h2o.out

# 4) 能量是有限值，且 SCF 收敛
grep -nE "Total energy|SCF run converged|SCF run NOT converged" h2o.out | tail -10`,
          },
          {
            type: "p",
            text: "看到 `PROGRAM ENDED AT` 只说明程序走完了流程，不说明结果正确。还要确认：`Total energy` 不是 `NaN`/`Inf` 或一串星号；SCF 是 `converged` 而不是达到 `MAX_SCF` 后退出；`h2o.err` 里没有 `ABORT`、`CPASSERT failed`。三者都过，才算安装验证通过。",
          },
          {
            type: "p",
            text: "再做一次冒烟测试：把 `RUN_TYPE` 改成 `MD`，加 10 步 NVT。它能同时验证 MD 驱动、恒温器与轨迹输出。下面的交互演示可以帮助理解温度、步长与能量漂移的关系，但真正的验收仍以输出文件为准。",
          },
          {
            type: "demo",
            id: "md",
            title: "安装后的冒烟测试：温度与能量",
            desc: "调整时间步与温度，观察 NVE 能量漂移和 NVT 温度涨落，理解为什么验证不能只看「程序没报错」。",
          },
          {
            type: "callout",
            kind: "info",
            title: "数据文件找不到时",
            text: "`BASIS_MOLOPT`、`GTH_POTENTIALS` 默认从 CP2K 的 `data/` 目录找。源码构建时通常在 `$CP2K_ROOT/data`；换机器或只拷二进制时，需要 `export CP2K_DATA_DIR=/path/to/cp2k/data`，或在输入里写绝对路径。",
          },
        ],
      },
      {
        id: "3.8",
        title: "常见错误：先定位，再改参数",
        blocks: [
          {
            type: "p",
            text: "CP2K 的报错有时只给一行，但线索通常在更早的输出里。先收集四样东西：`which mpirun`、`ldd` 链接结果、`CP2K_DATA_DIR`、以及输出里第一个 `ERROR`/`ABORT` 前后的上下文。",
          },
          {
            type: "code",
            lang: "bash",
            title: "出问题先跑这五条",
            text: `# 1) 用的是哪个 mpirun，和二进制链接的是不是同一套 MPI
which mpirun
ldd "$(command -v cp2k.psmp)" | grep -i mpi

# 2) 数据文件路径
echo "\$CP2K_DATA_DIR"
ls "\${CP2K_DATA_DIR:-.}/BASIS_MOLOPT" 2>/dev/null

# 3) 进程与线程有没有超订
nproc
echo "OMP_NUM_THREADS=\$OMP_NUM_THREADS"

# 4) 内存是否够（看 available，不要只看 free）
free -h

# 5) 作业是不是还在跑
ps -u "\$USER" -o pid,etime,rss,cmd | grep -E "cp2k|mpirun" | grep -v grep`,
          },
          {
            type: "table",
            head: ["症状", "最可能的原因", "处理"],
            rows: [
              ["输出里同一行重复 N 次，`DBCSR| MPI: Number of processes` 却是 1", "`mpirun` 与二进制链接的 MPI 不是同一套，实际起了 N 个独立进程", "统一模块/环境；按 3.8 的 `which mpirun` + `ldd` 排查；源码构建记得 source `setup`/`cp2k_env`"],
              ["启动即报找不到 `BASIS_MOLOPT`/`GTH_POTENTIALS`", "`CP2K_DATA_DIR` 未设或路径错", "设环境变量，或在输入里写绝对路径"],
              ["`OMP_NUM_THREADS` 大于分到的核数，速度反而下降", "线程超订，线程互相抢核", "令 `OMP_NUM_THREADS × MPI 进程数 ≤ 分到的核数`；Slurm 用 `--cpus-per-task` 对齐"],
              ["`error while loading shared libraries: libxc.so...`", "运行时找不到 libxc，或版本与编译时不一致", "`ldd` 看缺哪个；source 对应环境；必要时重编并固定 libxc 版本"],
              ["`CPASSERT failed`", "触发了代码内部断言，可能是输入组合未覆盖", "保留完整输出与输入，查 issue；不要靠改关键词绕过"],
              ["`GEOMETRY wrong or EMAX_SPLINE too small`", "原子距离过近/重叠，建邻接表失败", "用 VMD 检查结构；修掉重叠原子或错误的晶胞"],
              ["`SCF run NOT converged`", "初猜差、`CUTOFF` 不足、体系金属性、OT 不适用", "换 `SCF_GUESS`、加 `MAX_SCF`、改对角化/展宽；见第 8 章"],
              ["能量出现 `NaN`、`Inf` 或 `********`", "数值失稳：坏几何、坏赝势、步长过大", "先固定结构做单点；再查赝势/基组匹配与 `CUTOFF`"],
              ["进程被系统杀掉，无报错", "OOM 或墙钟超时", "看 `dmesg`/调度器记录；减少 MPI 进程、改 psmp、加内存或缩短任务"],
              ["杂化计算第一步极慢或 OOM", "HFX 积分与存储开销大", "减少进程数、设 `MAX_MEMORY`、用 ADMM/RI；先小体系验证"],
            ],
            caption: "排错顺序：环境 → 输入/结构 → 方法设置 → 资源。不要一上来就调物理参数。",
          },
          {
            type: "p",
            text: "还有一个容易被忽略的点：**正常结束不等于结果可信**。手册在排错页开头就提醒，`PROGRAM ENDED AT` 只代表流程走完；能量是否收敛、结构是否合理、方法是否适用，仍要单独验证。安装验证只回答「能不能跑」，不回答「算得对不对」。",
          },
          {
            type: "callout",
            kind: "warn",
            title: "ELPA 相关异常",
            text: "如果编译时带了 ELPA，它通常是默认对角化库。遇到难以解释的崩溃或结果异常，可以在 `&GLOBAL` 里设 `PREFERRED_DIAG_LIBRARY SCALAPACK` 做一次对照；如果换了库就正常，问题在 ELPA 与当前构建/硬件的组合，而不是你的输入。",
          },
          {
            type: "keypoints",
            items: [
              "预编译 ssmp 只能单节点，效率比正常编译低约 30%–50%，适合验证不适合生产",
              "≤2025.2 用 Make + ARCH，2026.1 起用 CMake；两套命令不能混用",
              "psmp = MPI + OpenMP，生产优先；总线程数不能超过分到的核数",
              "验证安装的四件事：版本、PROGRAM ENDED AT、有限能量、SCF 收敛",
              "排错先查环境（mpirun/ldd/数据路径/内存），再查输入与方法",
            ],
          },
          {
            type: "p",
            text: "装好并验证之后，第 4 章开始写真正的输入：输入树的层级、坐标与晶胞、基组赝势的匹配，以及一个计算从初始化到输出的完整流程。那时你会反复回到这一章的 `PROGRAM ENDED AT` 与排错表——它们是最省时间的两个工具。",
          },
        ],
      },
    ],
    quiz: [
      {
        q: "预编译的 `cp2k-6.1-Linux-x86_64.ssmp` 最关键的限制是什么？",
        options: [
          "只能算非周期体系",
          "只能在一个节点内用 OpenMP，不能跨节点",
          "只能算 DFT，不能算 MD",
          "只能读 6.1 版本的输入",
        ],
        answer: 1,
        explain: "ssmp 是纯 OpenMP 构建，没有 MPI，因此不能跨节点；体系类型与 RUN_TYPE 不受这个后缀限制。",
      },
      {
        q: "在 7.1 的源码构建里，`make ARCH=local VERSION=\"popt psmp\"` 中的 `ARCH=local` 指什么？",
        options: [
          "安装到本地目录",
          "使用 `arch/local.popt`、`arch/local.psmp` 等编译配置",
          "只编译本地 CPU 支持的指令",
          "使用本地 MPI",
        ],
        answer: 1,
        explain: "ARCH 选择 `arch/` 下的配置文件，里面写了编译器、编译选项与库；VERSION 决定编哪几个并行版本。",
      },
      {
        q: "Slurm 脚本里 `--ntasks-per-node=32`、`--cpus-per-task=2`，每个节点实际分到多少核？",
        options: ["32", "64", "16", "128"],
        answer: 1,
        explain: "32 个任务 × 每任务 2 个 CPU = 64 核/节点。若节点只有 28 核，这个设置就是超订。",
      },
      {
        q: "输出里同一行重复出现多次，且 `DBCSR| MPI: Number of processes` 显示为 1，最可能是什么问题？",
        options: [
          "CP2K 版本太旧",
          "mpirun 与二进制链接的 MPI 不是同一套，实际起了多个独立进程",
          "输入文件里 STEPS 设错了",
          "没有设置 OMP_NUM_THREADS",
        ],
        answer: 1,
        explain: "每个进程都认为自己是唯一的 MPI 进程，说明 MPI 环境没有真正联通；用 which mpirun 与 ldd 对照。",
      },
      {
        q: "看到 `PROGRAM ENDED AT` 之后，下面哪项仍需要单独确认？",
        options: [
          "程序是否真的退出",
          "SCF 是否收敛、能量是否为有限值",
          "输出文件是否存在",
          "作业是否占用了 CPU",
        ],
        answer: 1,
        explain: "PROGRAM ENDED AT 只表示流程走完；SCF 可能在 MAX_SCF 后退出，能量也可能是 NaN/Inf，必须单独检查。",
      },
    ],
    terms: [
      { t: "ssmp", en: "serial/SMP build", d: "仅用 OpenMP、不带 MPI 的 CP2K 构建，只能单节点运行，适合快速验证。" },
      { t: "popt", en: "MPI-only build", d: "仅用 MPI 的构建，可跨节点；每进程内存开销较大。" },
      { t: "psmp", en: "MPI + OpenMP build", d: "MPI 与 OpenMP 混合构建，生产常用；需正确设置进程数与线程数。" },
      { t: "ARCH 文件", en: "architecture file", d: "Make 时代描述编译器、编译选项与库的配置文件；2026.1 起被 CMake preset 取代。" },
      { t: "toolchain", en: "CP2K toolchain", d: "`tools/toolchain` 下自动构建依赖并生成构建配置的脚本集合。" },
      { t: "CP2K_DATA_DIR", en: "CP2K data directory", d: "基组、赝势等数据文件的搜索路径；换机器或只拷二进制时必须设置。" },
      { t: "OMP_NUM_THREADS", en: "OpenMP thread count", d: "每个 MPI 进程使用的 OpenMP 线程数；与进程数相乘不能超过分到的核数。" },
    ],
    sources: [
      { t: "Installation（路线与前提判断）", url: "https://manual.cp2k.org/trunk/getting-started/installation.html" },
      { t: "Build from Source（CMake、toolchain、依赖）", url: "https://manual.cp2k.org/trunk/getting-started/build-from-source.html" },
      { t: "Build with Spack", url: "https://manual.cp2k.org/trunk/getting-started/build-with-spack.html" },
      { t: "Install from Distribution", url: "https://manual.cp2k.org/trunk/getting-started/distributions.html" },
      { t: "Troubleshooting（输出、MPI、OOM、解析错误）", url: "https://manual.cp2k.org/trunk/getting-started/troubleshooting.html" },
      { t: "Run a First Calculation", url: "https://manual.cp2k.org/trunk/getting-started/first-calculation.html" },
    ],
  };
})();