# 阿里云 SAE 部署

当前测试环境选择中国香港（`cn-hongkong`）。完整的控制台创建顺序、环境变量和验收方法见 [deployment-hongkong.md](deployment-hongkong.md)。

## 推荐拓扑

- SAE 应用 1：Web，公开 HTTPS，按请求扩缩。
- SAE 应用 2：Worker，不开放公网入口，处理解析、向量和评测。
- RDS PostgreSQL 16：启用 `vector` 扩展和 HNSW；仅 VPC 访问。
- OSS 私有 Bucket：原文件与导出底稿；SAE 通过 RAM 角色访问。
- 百炼：对话/面试/评审模型分开配置；Embedding `text-embedding-v4`，Rerank `qwen3-rerank`。

## 发布步骤

1. 构建并推送容器镜像到 ACR；不要把 `.env` 或简历打入镜像。
2. 在 RDS 执行迁移并验证 `CREATE EXTENSION vector`。
3. 创建私有 OSS Bucket、服务端加密、生命周期策略和 SAE RAM 角色。
4. 给 Web/Worker 注入数据库、对象存储、模型、登录和 `SETTINGS_ENCRYPTION_KEY`。该加密密钥必须稳定保存，轮换前需先迁移已保存的邮箱配置。
5. 先发布 Worker，再发布 Web；健康检查 `/api/health`。
6. 用合成数据走完端到端流程，检查日志无 PII 后再邀请 HR 试用。

生产环境必须使用强 `AUTH_SECRET` 和 `SETTINGS_ENCRYPTION_KEY`，关闭默认演示账号，限制上传大小，配置 WAF/速率限制与备份。出站网络需允许连接用户配置的 SMTP 465/587 端口；不要把邮箱授权码写入环境变量、日志或 Trace。Langfuse 为可选项，启用前先做 Trace 脱敏。
