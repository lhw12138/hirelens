# HireLens 阿里云香港测试环境部署

目标地域固定为 **中国香港（`cn-hongkong`）**。ACR、SAE、RDS、OSS、VPC 和交换机必须保持同地域，避免公网传输候选人资料。

## 上线拓扑

- `hirelens-web`：SAE Web 应用，公开 3000 端口；存活检查 `/api/live`。
- `hirelens-worker`：SAE 常驻应用，不开放公网；同时处理招聘评分与模型评测。
- `hirelens-rag`：SAE 内网应用，监听 3041；只允许持有 `RAG_LOCAL_TOKEN` 的服务访问。
- RDS PostgreSQL 16：业务数据与 384 维检索向量。
- OSS 私有 Bucket：简历和面试记录原文件。
- 公网 NAT：供 Web/Worker 调用模型 API、供 RAG 首次下载模型、供 Web 连接用户 SMTP。

## 你需要在控制台创建的资源

1. [专有网络 VPC](https://vpc.console.aliyun.com/)：地域选择中国香港，新建一个 VPC 和交换机，并记下交换机网段。
2. [容器镜像服务 ACR](https://cr.console.aliyun.com/)：创建个人版实例、命名空间和三个私有仓库：`hirelens-web`、`hirelens-worker`、`hirelens-rag`。
3. [RDS PostgreSQL](https://rdsnext.console.aliyun.com/)：PostgreSQL 16、按量付费、最低可用测试规格；放入同一 VPC。数据库名 `hirelens`，创建独立低权限账号，不使用高权限账号运行应用。
4. [OSS](https://oss.console.aliyun.com/)：创建中国香港私有 Bucket，开启服务端加密；禁止公共读写，不需要浏览器 CORS。
5. [公网 NAT 网关](https://vpc.console.aliyun.com/nat)：为 SAE 使用的交换机配置 SNAT，否则模型 API、模型下载和 SMTP 无法访问。
6. [Serverless 应用引擎 SAE](https://sae.console.aliyun.com/)：创建上述三个应用，镜像均选择同账号、同地域 ACR 私有镜像。

创建付费资源前先在费用中心设置月度预算提醒。测试完成若不再使用，应分别删除 SAE、RDS、NAT/EIP 和 OSS；删除 SAE 不会自动删除其他资源。

## 镜像构建与推送

先在 ACR 的“访问凭证”页面完成一次 `docker login`，不要把仓库密码写入脚本。然后在项目根目录运行：

```powershell
.\deploy\build-and-push.ps1 -Registry <ACR公网地址> -Namespace <命名空间> -Tag v0.1.0
```

三个镜像使用同一版本号，发生问题时在 SAE 版本列表回滚到上一个标签。

## 配置顺序

1. 先部署 RAG，并取得 SAE 默认私网地址。
2. 按 `deploy/sae-worker.env.example` 配置 Worker；启动命令使用镜像默认命令。
3. 用 Worker 镜像创建一次性 SAE Job，覆盖启动命令为 `npm run db:migrate`，成功后停止该 Job。
4. 按 `deploy/sae-web.env.example` 配置 Web，端口 3000，存活和就绪检查均设为 `/api/live`。
5. Web 上线后登录 `/health`，确认七项服务状态。

环境变量中的密钥必须在本地密码管理器生成并直接填入 SAE，不提交 Git。`AUTH_SECRET`、`CANDIDATE_LINK_SECRET`、`SETTINGS_ENCRYPTION_KEY` 和 `RAG_LOCAL_TOKEN` 至少 32 个随机字符；其中 `SETTINGS_ENCRYPTION_KEY` 不能随意更换，否则已保存的邮箱授权码无法解密。

此前在聊天或本地测试中使用过的模型密钥不得直接用于生产，应在模型供应商后台重新生成。

## 数据库初始化

迁移 Job 成功后，在 RDS 管理终端确认：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extversion FROM pg_extension WHERE extname = 'vector';
SELECT count(*) FROM __drizzle_migrations;
```

只允许 SAE 所在交换机网段访问 RDS 5432；不要开放 `0.0.0.0/0`。

## 上线验收

1. 在 PowerShell 执行 `$env:HIRELENS_BASE_URL="https://<SAE公网地址>"`，再执行 `npm run deploy:verify`。
2. 登录后打开 `/health`，确认数据库、OSS、RAG、两个 Worker 和模型均正常。
3. 用合成数据完成：创建岗位、导入四份简历、后台评分、上传面试记录、综合评估。
4. 配置测试邮箱，只向自己的另一个邮箱发送一次通知。
5. 在 SAE 日志中搜索 `operational_error`，确认没有简历正文、邮箱、电话或模型输入。

## 回滚

- 代码异常：SAE 回滚 Web/Worker/RAG 到上一镜像标签。
- 评分异常：停止 Worker，不影响已保存资料；修复后重新部署并由 HR 重试失败任务。
- 数据库迁移异常：停止 Web 与 Worker，恢复 RDS 自动备份；不要在生产库直接删除迁移记录。
- 密钥泄露：在对应服务立即吊销并重新生成；更新 SAE 加密环境变量后重新部署。

## 常见阻塞

- `failed to fetch anonymous token` 或访问 `auth.docker.io` 超时：这是 Docker Hub 基础镜像下载网络问题。先在 Docker Desktop 配置可用的合规镜像源或更换网络，再重新执行构建；不要为了绕过问题关闭 TLS 校验。
- RAG 启动时间较长：首次启动需要下载模型。先确认 NAT 出口可用，并将 SAE 启动探针的初始等待时间设为至少 180 秒。
- 系统状态显示 Worker 无心跳：确认迁移 Job 已成功创建 `service_heartbeats` 表，并核对 Worker 使用的 `DATABASE_URL`。
- 模型或邮箱不可用：确认 NAT 的 SNAT 覆盖 SAE 所在交换机；不要直接给应用绑定不受控的公网 IP。
