# Mia's Cruises Customer Insights Daily Logs

这个文件夹替代原来的 `HANDOFF.md`，用于按日期保存 Mia's Cruises Customer Intelligence Platform 的项目日志。

主项目文件夹是：

`/Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code`

## 项目总览

项目是一个面向 Mia's Cruises passenger ferry 场景的 Customer Intelligence / Voice of Customer 平台原型。它帮助 Marketing、CX 和 Customer Insights stakeholder 从公开客户反馈中理解品牌口碑、路线问题、App 体验、竞品表现和可执行的营销建议。

当前范围只覆盖 passenger ferry customer signals。Freight 和 logistics 不在本阶段范围内。

## 当前核心能力

- 前端 dashboard：Overview、Customer Voice、App Reviews、Competitors、Recommendations、Survey CSV、Update Log、Data Basis、IT Data Flow。
- 公开数据快照：Trustpilot、Google Play、Apple App Store、Google Reviews、Reddit、未来 Survey CSV 占位。
- 路线视角：All signals、Dover-Calais、Newhaven-Dieppe、Newcastle-IJmuiden、Jersey。
- 竞品对标：Mia's Cruises 加 11 家 passenger ferry 竞品或区域对标品牌。
- Chat assistant：从本页上下文、公开证据、PostgreSQL + pgvector Evidence Knowledge Base、项目记忆和短期对话历史中检索，再调用 DeepSeek 生成回答。
- 验证体系：100 条平台 QA 用于产品复盘；50 条 RAG validation set 用于人工评分和 RAG 调优；内部 Review Console 和 validation harness 用于监督 agent 输出。

## 文件索引

- `2026-07-16.md`：基础 dashboard scope、路线过滤、竞品说明和视觉方向确定。
- `2026-07-17.md`：数据源扩展、Google Reviews、Firecrawl 竞品补齐、页面总结和 100 QA 测试表。
- `2026-07-18.md`：报告化视觉、floating chat assistant、本地 RAG-like retrieval、双语回答和 PRD 知识架构。
- `2026-07-20.md`：DeepSeek 后端、PostgreSQL + pgvector、Memory RAG、证据卡和 50 条 RAG 人工验证集。
- `2026-07-21.md`：Mia small talk / weather guard、Quick read 文案刷新、以及 internal review console 的规划。
- `2026-07-22.md`：规则型 validation agent、PG review persistence helper、以及 `/api/review-runs/validate-chat`。
- `2026-07-23.md`：Mia user-facing answer cleanup、expandable chat drawer、Enter-to-send、多语言检测和 acknowledgement small-talk routing。
- `2026-07-28.md`：IT Data Flow 页面、平台共用 memory architecture、Mia 上下文和日志同步更新。
- `2026-08-10.md`：GDPR 与 EU AI Act 的官方来源、Mia 边界映射和本地 CSV 参考登记。
- `2026-08-11.md`：Mia 三张 LangGraph 的本机验收、状态边界收紧、触发器/重试/人审指标闭环，以及剩余 PostgreSQL、Langfuse 和生产治理环境门槛。

## 维护规则

后续每次改产品时，先更新 `app/data/update-log.mjs` 的 `supervisorLogs`，再把当天变化总结到对应日期文件。若当天文件不存在，新建 `YYYY-MM-DD.md`。

每个日期文件保持同一结构：

- 项目背景
- 当天目标
- 行动总结
- 实现内容
- 测试数据与验证
- 后续注意点

## EU 法规参考

`data/compliance/eu_gdpr_ai_act_mia_boundaries.csv` 是 MIA 的 GDPR 与 EU AI Act 边界登记册。它不是法律意见；任何新数据类型、个人层面决策、跨境传输或可能的 high-risk AI 用例都必须由 Legal 和 DPO 复核。
