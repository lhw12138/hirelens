# MeritTrace 当前服务器交接

## 已确认

- 域名 merittrace.cyou 已解析到香港 ECS，HTTPS 健康检查曾返回 200。
- 线上由独立容器 `merittrace-caddy` 提供 443，Compose 中的 Web 仍占用 80。
- Worker v0.1.0 已通过只读挂载 tsconfig.json 恢复路径别名解析。
- 管理员登录读取环境变量，不依赖合成演示数据初始化。

## 更新注意

仓库最新配置包含 Compose 管理的 Caddy。独立 Caddy 仍运行时，不要直接执行全量 `docker compose up -d`，否则两个容器会争用 443。正式切换前需要复用既有证书卷、准备回滚，并检查 HTTP 跳转；当前 HTTPS 已可用于登录。

## 修复旧镜像的合成数据初始化

在服务器拉取最新代码之后，先做文件检查，再使用明确的只读挂载运行新版脚本。无需重建镜像，也无需启动 Compose Caddy：

```bash
cd /opt/hirelens/app/deploy
git pull --ff-only
test -f ../data/eval-dataset-v1.json && test -f ../scripts/seed-synthetic-demo.ts
docker compose --env-file .env.server -f ecs-compose.yml run --rm --no-deps \
  -v /opt/hirelens/app/scripts/seed-synthetic-demo.ts:/app/scripts/seed-synthetic-demo.ts:ro \
  worker node --conditions=react-server --import tsx scripts/seed-synthetic-demo.ts
```

新版脚本在任何写入之前读取评测集，并使用事务锁避免并发初始化。发现演示组织已存在时跳过，不重置人工评分和审核记录。旧版缺文件异常会回滚数据库事务，但可能留下合成对象文件；新版使用相同对象键，因此无需清空存储。

该脚本初始化的是旧版关系表演示内容，不等同于新版任务工作台的完整招聘任务。登录后可通过工作台的合成体验入口创建任务，不应将初始化成功描述为线上全流程验收完成。

## 尚待验收

- 管理员 HTTPS 登录与系统健康页。
- 创建岗位、确认维度、合成简历评分与后台任务恢复。
- 面试记录综合评分及人工确认。
- 正式 Caddy 切换、HTTP 自动跳转、证书卷复用。
- 页面品牌更名需要构建新 Web 镜像后发布。

## 候选人自测发布（尚未部署）

候选人匹配功能需要先运行 `0008_candidate_self_service.sql` 数据库迁移，并在现有 `deploy/.env.server` 中增加至少 16 位的 `CANDIDATE_ACCESS_CODE`。注册保持邀请制。

上传接口不保存原文件。联系信息在解析时脱敏，并在调用已配置模型前再次强制脱敏。报告与 HR 招聘任务物理分表，只按候选人账号读取，候选人可以删除自己的报告。

发布前需要构建新的 Web 镜像、执行一次数据库迁移、更新现有环境文件，然后只重建 Web 容器。首次冒烟测试使用合成材料，不使用真实简历。

不要重跑配置生成脚本或复制本地 .env 到服务器；现有数据库密码、邮箱加密密钥必须保持稳定。
