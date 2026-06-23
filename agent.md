# QFinanceData Agent Guide

## 1. 你的角色

你是在 QFinanceData 项目中工作的编码代理。你的任务不是重新定义产品，而是根据现有产品文档和技术文档，稳健地推进实现、补充测试、维护文档边界，并让这个本地金融数据看板逐步可用。

开始任何较大改动前，先阅读：

- [产品文档](docs/product-dashboard.md)
- [技术文档](docs/technical-design.md)

## 2. 文档边界

产品判断看 `docs/product-dashboard.md`：

- 用户是谁。
- 页面放什么。
- 用户怎么操作。
- MVP 包含什么、不包含什么。
- 产品风险和交互约束是什么。

技术判断看 `docs/technical-design.md`：

- 系统架构。
- 工程目录。
- 技术选型。
- API 设计。
- 数据模型。
- 存储策略。
- yfinance 抓取策略。
- 测试和落地计划。

不要把 API、数据库、技术栈、工程目录、抓取细节写回产品文档。不要把页面草图、用户故事、产品范围膨胀到技术文档里，除非是为了说明实现约束。

## 3. 产品原则

QFinanceData 是面向个人投研、数据研究和量化研究前置数据准备的本地工具。第一版的价值是让用户快速知道：

- 自选标的表现如何。
- 数据更新到哪一天。
- 哪些数据新鲜、过期、缺失或失败。
- 抓取任务是否成功，失败在哪里。
- 单个标的的价格、成交量、关键指标和财务摘要是否可用。

第一版不要做：

- 实时交易下单。
- 完整投资组合记账。
- 高频行情。
- 多用户权限系统。
- 完整回测系统。
- 云端同步。

## 4. 推荐落地顺序

按以下顺序推进，避免一开始做成大而散的平台：

1. 建立前后端工程骨架。
2. 用 mock 数据完成前端 Dashboard、Symbol Detail、Watchlist、Jobs、Settings。
3. 实现后端 symbols API 和价格抓取任务。
4. 落地 SQLite 任务状态和 Parquet 行情数据。
5. 前端接入真实 Dashboard、价格图和 Jobs 状态。
6. 增加 metadata、fundamentals、actions。
7. 增加数据质量检查、失败重试和导出。
8. 最后再考虑定时任务、自动化和部署能力。

## 5. 工程结构约定

优先遵循技术文档中的目录设计：

```text
backend/
  qfinancedata/
    api/
    services/
    fetchers/
    storage/
    schemas/
    quality/
frontend/
  src/
    app/
    api/
    features/
    charts/
    components/
docs/
data/
```

运行期数据放在 `data/`。除非用户明确要求，不要把真实抓取数据、原始响应、SQLite 数据库或 Parquet 文件提交进版本控制。

## 6. 前端实现约定

推荐技术栈：

- React + TypeScript + Vite。
- ECharts 负责价格图、成交量、收益率曲线。
- TanStack Query 负责 API 请求、缓存、轮询和错误状态。
- Zustand 负责轻量 UI 状态。

前端体验要求：

- 第一屏直接是可用工作台，不做营销落地页。
- Dashboard 优先展示市场摘要、自选概览、走势、数据新鲜度和最近任务。
- Symbol Detail 以价格图和成交量为核心，指标和财务摘要辅助展示。
- Jobs 页面必须能看见运行中任务、历史任务、失败原因和重试入口。
- Watchlist 支持添加、删除、分组、批量导入和批量更新入口。
- 数据状态必须显性展示，不能藏在日志里。
- 上涨/下跌颜色要支持美股习惯和 A 股/港股习惯切换。

## 7. 后端实现约定

推荐技术栈：

- FastAPI 提供 HTTP API。
- yfinance 负责数据抓取。
- Pydantic 定义请求、响应和内部 DTO。
- SQLite 存 metadata、watchlist、jobs、data_status。
- Parquet 存 price_bars、fundamental_facts、corporate_actions。
- pandas / pyarrow 处理 yfinance 返回结果和 Parquet 写入。

后端分层要求：

- API Router 只处理 HTTP 输入输出。
- Service 层负责业务编排。
- Fetcher 层封装 yfinance。
- Storage/Repository 层负责 SQLite 和 Parquet。
- Quality 层负责数据校验和状态判断。

不要让前端直接调用 yfinance。不要把 yfinance 返回结构直接暴露给前端。

## 8. 数据和任务约定

用户可见的数据状态：

- `fresh`: 数据在阈值内更新。
- `stale`: 数据超过阈值未更新。
- `missing`: 本地没有该类数据。
- `failed`: 最近一次更新失败。
- `partial`: 部分标的或部分数据类型更新失败。

任务状态：

- `queued`
- `running`
- `success`
- `partial_success`
- `failed`
- `cancelled`

价格增量更新策略：

- 首次抓取使用默认起点。
- 后续从本地最新交易日往前回退一小段重新抓取。
- 写入时按 `symbol + interval + timestamp` 去重或覆盖。
- 空响应、字段缺失、超时和疑似限流都要记录到任务明细。

## 9. yfinance 使用约束

yfinance 不是 Yahoo 官方 API。实现时要默认它可能出现：

- 请求超时。
- 空返回。
- 字段缺失。
- 字段结构变化。
- 部分 ticker 成功、部分 ticker 失败。
- 批量请求不稳定。

因此必须提供：

- 超时控制。
- 有界重试。
- 并发限制。
- 原始响应留存能力。
- 标准化和数据校验。
- 用户可见的失败状态和错误摘要。

## 10. API 设计约定

优先实现技术文档中的 API：

```text
GET    /api/symbols
POST   /api/symbols
PATCH  /api/symbols/{symbol}
DELETE /api/symbols/{symbol}

GET /api/market/overview
GET /api/data-status
GET /api/prices/{symbol}
GET /api/prices/{symbol}/latest
GET /api/fundamentals/{symbol}
GET /api/actions/{symbol}

POST /api/fetch/prices
POST /api/fetch/fundamentals
POST /api/fetch/actions
GET  /api/jobs
GET  /api/jobs/{job_id}
POST /api/jobs/{job_id}/retry
```

接口响应要面向前端看板，不要让前端理解存储分区、yfinance 多层 columns 或内部任务实现细节。

## 11. 测试要求

后端优先覆盖：

- yfinance client 的 mock 响应。
- normalizer 对空数据、字段缺失、多 ticker 的处理。
- storage 的 upsert、重复数据和 Parquet 读写。
- symbols、prices、jobs 的 API 主流程。

前端优先覆盖：

- 状态徽标。
- 时间范围控件。
- ticker 搜索。
- Dashboard 加载、空状态、错误状态。
- Jobs 轮询、进度更新和失败重试入口。

真实 yfinance 网络抓取测试不要放进普通单元测试。需要真实网络时，提供单独的手动验证命令。

## 12. 开发工作流

每次实现功能时：

1. 先确认产品文档是否已经定义该功能的用户价值和页面位置。
2. 再确认技术文档是否已有架构、接口或数据模型约定。
3. 如果缺少产品定义，先补产品文档。
4. 如果缺少实现约定，先补技术文档。
5. 再写代码。
6. 添加与风险匹配的测试。
7. 运行能覆盖改动面的检查。
8. 在回复中说明改了什么、验证了什么、还有什么风险。

## 13. 代码风格和质量

- 保持实现小步推进，不做无关重构。
- 优先使用清晰的函数和模块边界。
- 不要把抓取、清洗、存储和 HTTP 响应混在同一个函数里。
- 类型定义要贴近 API 和存储模型。
- 错误信息要能帮助用户重试或定位失败 ticker。
- 日志要记录任务、ticker、数据类型和错误摘要。
- 不要在日志中输出大量原始金融数据。

## 14. 变更前检查清单

动手前确认：

- 这是不是 MVP 范围内的功能？
- 它属于产品文档还是技术文档？
- 是否会改变用户可见流程？
- 是否会改变 API、数据模型或存储格式？
- 是否需要迁移或兼容旧数据？
- 是否需要前后端同时修改？

## 15. 完成标准

一项功能完成时，至少满足：

- 用户路径能走通。
- 错误状态能显示。
- 空状态能显示。
- 数据状态不会误导用户。
- 后端任务失败不会静默吞掉。
- 有基本测试或明确说明无法自动测试的原因。
- 文档边界仍然清楚。

