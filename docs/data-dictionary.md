# 数据字典

| 实体 | 作用 | 关键约束 |
|---|---|---|
| Job / Competency | 岗位与已确认能力模型 | 权重和版本可追溯 |
| SkillPack | 业务策略包 | Prompt、Rubric、工具白名单版本化 |
| Candidate / Application | 候选人与岗位申请 | 作用域隔离 |
| ResumeDocument / DocumentChunk | 文件与检索片段 | 页码、字符范围、脱敏状态 |
| EvidenceCitation | 结论引用 | claim、quote、source span 必填 |
| EmailSettings | 每个工作台账号的发信配置 | 以账号隔离；SMTP 授权码认证加密且不回显 |
| InterviewNotice | 面试时间、地址、预览与发送状态 | 候选人邮箱加密；内容幂等；发送结果不等同送达或已读 |
| InterviewRecord | HR 导入的面试记录 | 与候选人及岗位隔离；确认后才进入综合评估 |
| Assessment | AI 草稿与最终分 | 未经人工不可 confirmed |
| HumanReviewRevision | 人工修改 | 前后分数和理由必填 |
| EvalDataset / Case / Run | 评测版本和结果 | 合成标识、模型/Prompt 版本 |
| ModelTrace / AuditEvent | 可观测与审计 | 只保留脱敏摘要 |
