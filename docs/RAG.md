# 混合 RAG：实现与边界

## 当前链路

HR 确认脱敏文本 → 对证据片段生成本地向量 → PostgreSQL/pgvector 保存 → 按评分维度分别进行关键词与语义召回 → RRF 融合、MMR 多样性排序 → 模型仅读取选中证据并附引用 → HR 复核。

向量模型为 multilingual-e5-small 的量化 ONNX 版本，384 维，在本机 CPU 运行。初筛每项最多取 8 条简历证据；综合评估分别取最多 4 条简历与 4 条面试证据。检索相近不代表证据支持结论，评分与人工核验仍需独立进行。

## 启动

1. 安装依赖并运行数据库迁移 `npm run db:migrate`。
2. 运行 `npm run dev`。该命令会同时启动网页、本地向量服务和后台评分 Worker；终端出现 `Ready`、`HireLens scoring worker started` 和 `Local embeddings ready` 即可开始使用。
3. `npm run dev:web` 只用于单独调试网页，不会处理评分任务。`npm run rag:serve` 与 `npm run scoring:worker` 仍可用于分别排查服务，但日常使用无需打开多个终端。
4. Docker 配置也提供 embeddings 服务及模型缓存卷；不要同时启动占用 3041 端口的本地与容器服务。容器配置已提供，不等于完成云部署验收。

首次启动从 ModelScope 的 Xenova 模型仓库下载权重到 `.cache/e5`（已忽略提交），后续复用。下载仅请求模型文件，不上传简历。缓存完整后可设置 `RAG_OFFLINE=true` 禁止下载。评分模型仍会接收用户确认后的脱敏证据。

`RAG_LOCAL_URL` 默认 http://127.0.0.1:3041；`RAG_LOCAL_TOKEN` 是独立服务口令，不使用 DeepSeek 密钥。部署时替换默认口令并限制内网访问。`RAG_MODE=keyword` 仅用于显式基线对照；默认 hybrid，服务故障时评分明确失败，不静默回退。旧 EMBEDDING_MODEL/RERANK_MODEL 环境项不控制这条本地检索链路。

## 隔离与一致性

- 所有检索限定任务、候选人、内容快照、模型文件指纹、证据类型；不跨候选人检索。
- 修改确认稿后生成新快照，不复用旧内容向量；模型文件改变也会形成新命名空间。
- 索引事务提交，失败不保存半成品评分；原有招聘资料保留。
- 当前候选人片段规模小，使用限定范围的精确余弦检索，没有声称启用 HNSW。
- 长片段按重叠窗口向量化并归一化聚合，引用仍对应原确认稿。这不是逐页 PDF 版面定位，对长段落的精度需后续评测。
- 结果保存实际检索模式、文件指纹、算法、候选证据 ID、耗时和缓存命中，不在检索记录中重复存放原文。
- 旧评分不自动改写为 RAG；进入面试前可主动重新评分，保留旧版历史。

## 已验证与尚未证明

合成测试覆盖真实本地向量、数据库检索、缓存复用、内容变更失效、候选人隔离、两类证据、服务故障不回退、关键词基线及真实模型初筛。运行 `node --env-file=.env --conditions=react-server --import tsx scripts/verify-rag.ts`，会创建合成任务并产生少量评分模型用量。

RRF/MMR 是融合与多样性算法，不是 qwen3-rerank 等交叉编码器。功能测试通过不代表准确率提高。下一步应对同一组人工标注资料比较引用支持率、证据覆盖、无依据结论和耗时；不得把模型自评或合成演示当作真实招聘效果。

## 参考

- [模型与 Transformers.js 示例](https://huggingface.co/Xenova/multilingual-e5-small)
- [pgvector 的余弦距离与检索](https://github.com/pgvector/pgvector)
