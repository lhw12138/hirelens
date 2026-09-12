# HireLens 中国香港 ECS 单机演示部署

该方案面向作品集演示：一台 ECS 运行 Web、Worker、RAG、PostgreSQL/pgvector 与 MinIO。它不替代 `deployment-hongkong.md` 中面向真实招聘数据的托管生产架构。

## 1. 网络边界

安全组只开放：

- TCP 22：来源限制为维护人员当前公网 IP；不用 SSH 时关闭。
- TCP 80：允许 `0.0.0.0/0`，供演示网站访问。
- TCP 443：绑定域名和 HTTPS 后再开放。

不要开放 3000、3041、5432、9000 或 9001。数据库、RAG 和文件存储只在 Docker 内部网络通信。

## 2. 安装基础软件

在 ECS Workbench 中执行：

```bash
sudo wget -O /etc/yum.repos.d/docker-ce.repo http://mirrors.cloud.aliyuncs.com/docker-ce/linux/centos/docker-ce.repo
sudo sed -i 's|https://mirrors.aliyun.com|http://mirrors.cloud.aliyuncs.com|g' /etc/yum.repos.d/docker-ce.repo
sudo dnf -y install dnf-plugin-releasever-adapter --repo alinux3-plus
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

## 3. 拉取配置

```bash
sudo mkdir -p /opt/hirelens
sudo chown "$USER":"$USER" /opt/hirelens
git clone https://github.com/lhw12138/hirelens.git /opt/hirelens/app
cd /opt/hirelens/app/deploy
cp ecs.env.example .env.server
chmod 600 .env.server
```

编辑 `.env.server`，替换所有 `replace-with-...` 占位符。密钥必须在服务器本地生成，不要发送到聊天或提交 Git。曾经出现在聊天、截图或日志中的模型密钥不得用于服务器。

```bash
openssl rand -hex 32
```

## 4. 登录 ACR 并启动

从 ACR“访问凭证”页面取得临时登录密码，在 Workbench 中执行登录；不要把密码写入脚本或文档。

```bash
sudo docker login --username=<阿里云账号名> crpi-4fkhws73w191q1aj.cn-hongkong.personal.cr.aliyuncs.com
cd /opt/hirelens/app/deploy
sudo docker compose --env-file .env.server -f ecs-compose.yml pull
sudo docker compose --env-file .env.server -f ecs-compose.yml run --rm worker npm run db:migrate
sudo docker compose --env-file .env.server -f ecs-compose.yml up -d
sudo docker compose --env-file .env.server -f ecs-compose.yml ps
```

如需初始化合成演示数据：

```bash
sudo docker compose --env-file .env.server -f ecs-compose.yml run --rm worker npm run demo:seed
```

## 5. 验收与维护

```bash
curl -fsS http://127.0.0.1/api/live
sudo docker compose --env-file .env.server -f ecs-compose.yml logs --tail=100 web worker embeddings
```

浏览器访问 `http://<ECS 公网 IP>`。绑定域名和 HTTPS 前不要输入真实简历，只使用合成数据。

更新镜像：

```bash
cd /opt/hirelens/app/deploy
git pull --ff-only
sudo docker compose --env-file .env.server -f ecs-compose.yml pull
sudo docker compose --env-file .env.server -f ecs-compose.yml up -d
```

试用结束前应备份必要数据并释放 ECS；仅停止实例不等于释放全部资源。
