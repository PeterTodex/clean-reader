#!/usr/bin/env bash
set -e

# ==============================================================================
# 清阅 (CleanReader) 一键生产部署脚本
# 适用系统: Ubuntu 20+/Debian 11+/CentOS 8+/AlmaLinux/RockyLinux
# 特别针对 1C1G 等小配置云服务器优化（自动配置 Swap、控制构建内存）
# ==============================================================================

PORT="${PORT:-9527}"
APP_NAME="clean-reader"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$PATH:/usr/local/bin:~/.local/bin"
# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo -e "${GREEN}"
echo "======================================================"
echo "    清阅 (CleanReader) 一键部署脚本 (Port: ${PORT})     "
echo "======================================================"
echo -e "${NC}"

# 1. 权限检查
if [ "$EUID" -ne 0 ]; then
    warn "当前非 root 用户，后续安装系统软件或配置 Swap 可能需要输入 sudo 密码。"
    SUDO="sudo"
else
    SUDO=""
fi

cd "$APP_DIR" || error "无法进入项目目录 $APP_DIR"

# 2. 检查与自动配置 Swap（针对 1C1G 服务器至关重要，防止编译打包被 OOM 杀进程）
setup_swap() {
    local swap_total
    swap_total=$(free -m | awk '/^Swap:/ {print $2}')
    if [ -z "$swap_total" ]; then
        swap_total=0
    fi

    if [ "$swap_total" -lt 1024 ]; then
        info "检测到系统 Swap 交换空间不足 1GB（当前: ${swap_total}MB），正在为 1C1G 环境自动配置 2GB Swap..."
        if [ -f "/swapfile" ]; then
            $SUDO swapoff /swapfile 2>/dev/null || true
            $SUDO rm -f /swapfile
        fi
        $SUDO fallocate -l 2G /swapfile || $SUDO dd if=/dev/zero of=/swapfile bs=1M count=2048
        $SUDO chmod 600 /swapfile
        $SUDO mkswap /swapfile
        $SUDO swapon /swapfile
        if ! grep -q "/swapfile" /etc/fstab; then
            echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
        fi
        success "2GB Swap 配置完成，当前可用 Swap: $(free -m | awk '/^Swap:/ {print $2}')MB"
    else
        info "系统已有足够 Swap (${swap_total}MB)，跳过 Swap 配置。"
    fi
}
setup_swap

# 3. 检查并安装 Node.js (要求 >= 22.5.0)
check_and_install_node() {
    local need_install=0
    if command -v node >/dev/null 2>&1; then
        local current_version
        current_version=$(node -v | sed 's/v//')
        local major minor
        major=$(echo "$current_version" | cut -d. -f1)
        minor=$(echo "$current_version" | cut -d. -f2)
        if [ "$major" -gt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -ge 5 ]; }; then
            info "检测到合规的 Node.js 版本: v${current_version}"
        else
            warn "当前 Node.js 版本 v${current_version} 低于要求的 22.5.0，需要升级。"
            need_install=1
        fi
    else
        info "未检测到 Node.js，准备安装 Node.js 22 LTS..."
        need_install=1
    fi

    if [ "$need_install" -eq 1 ]; then
        info "正在安装 Node.js 22 LTS..."
        if command -v apt-get >/dev/null 2>&1; then
            $SUDO apt-get update -y
            $SUDO apt-get install -y curl ca-certificates gnupg
            if [ -n "$SUDO" ]; then
                curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
            else
                curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            fi
            $SUDO apt-get install -y nodejs
        elif command -v dnf >/dev/null 2>&1; then
            if [ -n "$SUDO" ]; then
                curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
            else
                curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            fi
            $SUDO dnf install -y nodejs
        elif command -v yum >/dev/null 2>&1; then
            if [ -n "$SUDO" ]; then
                curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
            else
                curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            fi
            $SUDO yum install -y nodejs
        else
            error "未能识别的 Linux 发行版包管理器，请手动安装 Node.js >= 22.5.0 后重新运行本脚本。"
        fi
        hash -r 2>/dev/null || true
        success "Node.js 安装完成: $(node -v)"
    fi
}
check_and_install_node

# 4. 检查并安装 pnpm 与 pm2
check_and_install_tools() {
    if ! command -v pnpm >/dev/null 2>&1; then
        info "正在全局安装 pnpm..."
        $SUDO npm install -g pnpm
    else
        info "pnpm 已安装: $(pnpm -v)"
    fi

    if ! command -v pm2 >/dev/null 2>&1; then
        info "正在全局安装 pm2 进程守护工具..."
        $SUDO npm install -g pm2
    else
        info "pm2 已安装: $(pm2 -v)"
    fi
}
check_and_install_tools

# 5. 准备缓存数据库目录
mkdir -p "$APP_DIR/.cache"

# 6. 安装项目依赖
info "正在安装项目依赖..."
pnpm install --frozen-lockfile || pnpm install
success "依赖安装成功"

# 7. 编译 Next.js 项目
info "正在执行生产环境编译打包 (NODE_OPTIONS='--max-old-space-size=768')..."
export NODE_OPTIONS="--max-old-space-size=768"
pnpm build
success "项目构建完成"

# 8. 使用 PM2 启动或重启服务
info "正在配置并启动 PM2 服务（端口: ${PORT}）..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    info "检测到已有进程 ${APP_NAME}，正在平滑重启..."
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi

# 启动新实例 (直接通过 Node 运行 Next.js 二进制文件，避免 pnpm 传递参数多出 '--' 导致 Next.js 误把 -p 当作目录)
pm2 start node_modules/next/dist/bin/next --name "$APP_NAME" --cwd "$APP_DIR" -- start -p "$PORT"
pm2 save

# 尝试配置开机自启
if [ "$EUID" -eq 0 ]; then
    pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
fi
success "PM2 服务启动完成"

# 9. 尝试自动放行本机防火墙（若开启了 ufw 或 firewalld）
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    info "检测到 UFW 防火墙处于开启状态，自动放行 ${PORT}/tcp 端口..."
    $SUDO ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    info "检测到 firewalld 防火墙处于开启状态，自动放行 ${PORT}/tcp 端口..."
    $SUDO firewall-cmd --zone=public --add-port="${PORT}/tcp" --permanent >/dev/null 2>&1 || true
    $SUDO firewall-cmd --reload >/dev/null 2>&1 || true
fi

# 10. 获取服务器 IP 并输出部署信息
SERVER_IP=$(curl -s4 --max-time 3 ifconfig.me || curl -s4 --max-time 3 ip.sb || echo "你的服务器IP")

echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}           🎉 清阅 (CleanReader) 部署成功！            ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e " 访问地址: ${BLUE}http://${SERVER_IP}:${PORT}${NC}"
echo -e " 运行状态: 可使用 ${YELLOW}pm2 status${NC} 查看进程"
echo -e " 实时日志: 可使用 ${YELLOW}pm2 logs ${APP_NAME}${NC} 查看日志"
echo -e " 重启服务: 可使用 ${YELLOW}pm2 restart ${APP_NAME}${NC}"
echo -e " 停止服务: 可使用 ${YELLOW}pm2 stop ${APP_NAME}${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "${YELLOW}重要提示：${NC}如果浏览器无法访问，请前往【云厂商控制台】（腾讯云/阿里云/AWS等）"
echo -e "在【安全组 / 防火墙】规则中添加规则，放行 TCP 端口: ${YELLOW}${PORT}${NC}！"
echo ""
