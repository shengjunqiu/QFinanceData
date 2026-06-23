# QFinanceData 开发技术任务文档

## 1. 文档目的

本文档把 QFinanceData 的开发工作拆成可以一步一步执行的技术任务。每个任务包含目标、依赖、交付物和验收标准，方便按阶段推进、检查进度和交接上下文。

产品范围以 [product-dashboard.md](product-dashboard.md) 为准；技术方案以 [technical-design.md](technical-design.md) 为准；代理执行约定以 [agent.md](../agent.md) 为准。

## 2. 执行原则

- 先打通端到端闭环，再扩展数据类型。
- 先支持日线价格，再支持财务、分红拆股和自动化。
- 前端先用 mock 数据完成工作台体验，再接真实 API。
- 后端先实现稳定任务状态和价格数据，再做更多 yfinance 能力。
- 每个阶段都必须有可运行结果和基本验证方式。
- 真实抓取数据、SQLite 数据库、Parquet 文件、原始响应不提交到版本控制。

## 3. 阶段总览

| 阶段 | 目标 | 关键产出 |
| --- | --- | --- |
| Phase 0 | 项目基础设施 | 目录结构、忽略规则、开发命令、基础文档链接。 |
| Phase 1 | 前端静态看板 | React 工作台、mock 数据、核心页面和图表。 |
| Phase 2 | 后端价格数据 MVP | FastAPI、symbols API、价格抓取任务、SQLite/Parquet。 |
| Phase 3 | 前后端联调 | 前端接真实 API，Dashboard、详情页、Jobs 可用。 |
| Phase 4 | 数据增强 | metadata、fundamentals、actions、数据质量和导出。 |
| Phase 5 | 自动化与维护 | 定时更新、重试策略、数据维护命令、部署准备。 |

## 4. Phase 0: 项目基础设施

### T0.1 建立基础目录

目标：创建项目约定的基础目录，方便后续前后端并行开发。

依赖：无。

交付物：

- `backend/`
- `frontend/`
- `docs/`
- `data/`
- `.gitignore`
- `README.md`

验收标准：

- 根目录结构与技术文档的推荐结构一致。
- `data/` 下运行期文件不会被 Git 跟踪。
- `README.md` 能说明项目用途、文档入口和本地开发入口。

### T0.2 配置版本忽略规则

目标：避免提交本地环境、缓存、数据库和抓取数据。

依赖：T0.1。

交付物：

- `.gitignore`

建议忽略：

```text
.venv/
__pycache__/
.pytest_cache/
node_modules/
dist/
coverage/
data/*.sqlite
data/raw/
data/parquet/
*.parquet
.env
.env.local
```

验收标准：

- `git status --short` 不显示运行期数据和依赖目录。
- 后续执行测试或启动服务不会产生应提交的缓存文件。

### T0.3 建立开发命令说明

目标：统一后续本地启动和验证方式。

依赖：T0.1。

交付物：

- `README.md` 中的开发命令章节。

验收标准：

- 明确后端启动命令。
- 明确前端启动命令。
- 明确测试命令。
- 明确文档入口。

## 5. Phase 1: 前端静态看板

### T1.1 初始化前端工程

目标：建立 React + TypeScript + Vite 前端项目。

依赖：T0.1。

交付物：

- `frontend/package.json`
- `frontend/index.html`
- `frontend/src/app/App.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/styles/`

验收标准：

- `npm install` 成功。
- `npm run dev` 可启动本地前端。
- 浏览器打开后显示 QFinanceData 应用外壳。
- TypeScript 无明显编译错误。

### T1.2 实现应用外壳和全局布局

目标：实现左侧导航、顶部搜索、时间范围和刷新入口。

依赖：T1.1。

交付物：

- `AppShell`
- `SidebarNav`
- `SymbolSearch`
- `TimeRangeControl`
- `RefreshButton`

验收标准：

- 左侧导航包含 Dashboard、Watchlist、Jobs、Settings。
- 顶部包含 ticker 搜索、时间范围和刷新入口。
- 页面在桌面视口下不出现明显遮挡或溢出。
- 当前页面导航状态可见。

### T1.3 准备前端 mock 数据

目标：为静态页面提供稳定的模拟数据。

依赖：T1.1。

交付物：

- `frontend/src/api/mockData.ts`
- mock watchlist
- mock price bars
- mock jobs
- mock data status
- mock fundamentals

验收标准：

- mock 数据覆盖 fresh、stale、missing、failed、partial 状态。
- mock jobs 覆盖 queued、running、success、partial_success、failed。
- 图表数据包含至少 1 年日线样本。

### T1.4 实现 Dashboard 页面

目标：完成总览页静态 UI。

依赖：T1.2、T1.3。

交付物：

- `frontend/src/features/dashboard/`
- 市场摘要卡片。
- 自选标的概览。
- 自选走势或收益率图。
- 涨跌排行。
- 数据新鲜度摘要。
- 最近任务摘要。

验收标准：

- 第一屏能回答“市场怎样、自选怎样、数据是否异常”。
- 点击自选标的能进入详情页。
- 点击失败任务能进入 Jobs 页面。
- 空状态和错误状态有占位 UI。

### T1.5 实现 Symbol Detail 页面

目标：完成单个标的详情页静态 UI。

依赖：T1.2、T1.3。

交付物：

- `frontend/src/features/symbol-detail/`
- 标题区。
- 价格图。
- 成交量图。
- 关键指标。
- 财务摘要。
- 分红拆股事件列表或标记。
- 数据状态区。

验收标准：

- 从 Dashboard 和 Watchlist 可跳转到详情页。
- 时间范围变化能影响图表展示。
- 缺失财务数据时显示明确空状态。
- 图表 tooltip 展示价格和成交量信息。

### T1.6 实现 Watchlist 页面

目标：完成自选标的管理静态 UI。

依赖：T1.2、T1.3。

交付物：

- `frontend/src/features/watchlist/`
- 添加 ticker 输入。
- 分组筛选。
- 标的表格。
- 批量选择。
- 批量更新入口。

验收标准：

- 表格展示 symbol、name、type、currency、last update、status。
- 支持按分组筛选。
- 添加和删除可先使用本地 mock 状态。
- 点击行进入详情页。

### T1.7 实现 Jobs 页面

目标：完成任务队列和历史任务静态 UI。

依赖：T1.2、T1.3。

交付物：

- `frontend/src/features/jobs/`
- 手动更新按钮。
- 当前队列。
- 进度条。
- 历史记录表格。
- 错误详情面板。
- 重试入口。

验收标准：

- running 任务显示进度。
- failed 和 partial_success 任务显示错误摘要。
- 点击任务行显示失败标的和错误消息。
- 重试按钮存在但可先不调用真实 API。

### T1.8 实现 Settings 页面

目标：完成基础显示和更新偏好设置 UI。

依赖：T1.2。

交付物：

- `frontend/src/features/settings/`
- 默认时间范围。
- 默认更新起点。
- 涨跌颜色习惯。
- 数据过期阈值。
- 默认价格口径。

验收标准：

- 设置项与产品文档一致。
- 设置变更至少能影响前端本地展示状态。
- 不引入后端依赖。

### T1.9 前端基础测试

目标：覆盖核心 UI 状态和数据转换逻辑。

依赖：T1.4、T1.5、T1.6、T1.7。

交付物：

- 前端测试框架配置。
- StatusBadge 测试。
- TimeRangeControl 测试。
- mock 数据转换测试。

验收标准：

- `npm test` 或等价命令可运行。
- fresh、stale、missing、failed、partial 均有状态展示测试。

## 6. Phase 2: 后端价格数据 MVP

### T2.1 初始化后端工程

目标：建立 FastAPI 后端项目。

依赖：T0.1。

交付物：

- `backend/pyproject.toml`
- `backend/qfinancedata/main.py`
- `backend/qfinancedata/config.py`
- `backend/qfinancedata/logging.py`
- `backend/tests/`

验收标准：

- 可以安装后端开发依赖。
- `uvicorn qfinancedata.main:app --reload` 可启动。
- `GET /health` 返回服务状态。

### T2.2 实现配置系统

目标：实现本地开发所需配置项。

依赖：T2.1。

交付物：

- `QFD_DATA_DIR`
- `QFD_SQLITE_PATH`
- `QFD_DEFAULT_START_DATE`
- `QFD_DEFAULT_INTERVAL`
- `QFD_STALE_TRADING_DAYS`
- `QFD_FETCH_CONCURRENCY`
- `QFD_REQUEST_TIMEOUT`

验收标准：

- 配置有默认值。
- 环境变量可覆盖默认值。
- 数据目录不存在时可自动创建。

### T2.3 初始化 SQLite 存储

目标：创建 watchlist、任务和数据状态表。

依赖：T2.1、T2.2。

交付物：

- `storage/sqlite.py`
- migration 或初始化脚本。
- `symbols`
- `fetch_jobs`
- `fetch_job_items`
- `data_status`

验收标准：

- 首次启动可创建 SQLite 文件和表。
- 重复启动不会破坏已有表。
- 有基础 repository 测试。

### T2.4 实现 Symbols API

目标：支持 Watchlist 的增删改查。

依赖：T2.3。

交付物：

- `api/symbols.py`
- `services/symbols.py`
- `schemas/symbols.py`
- `SymbolRepository`

接口：

```text
GET    /api/symbols
POST   /api/symbols
PATCH  /api/symbols/{symbol}
DELETE /api/symbols/{symbol}
```

验收标准：

- 可新增、查询、更新、删除 symbol。
- 删除只移出 Watchlist，不删除历史数据。
- 重复新增同一 symbol 有明确响应。
- API 测试覆盖主流程。

### T2.5 封装 yfinance Client

目标：统一处理 yfinance 调用、重试、超时和错误归类。

依赖：T2.1、T2.2。

交付物：

- `fetchers/yf_client.py`
- 错误类型定义。
- mockable client 接口。

验收标准：

- 支持批量下载价格。
- 空响应、超时、字段变化能转成内部错误类型。
- 单元测试不依赖真实网络。

### T2.6 实现价格 normalizer

目标：把 yfinance 返回的价格数据转换为标准 PriceBar。

依赖：T2.5。

交付物：

- `fetchers/prices.py`
- `schemas/prices.py`
- 价格字段标准化逻辑。

验收标准：

- 支持单 ticker 和多 ticker 返回结构。
- 输出字段包含 symbol、interval、timestamp、open、high、low、close、adj_close、volume、source、fetched_at。
- 缺列、空数据、重复 timestamp 有明确处理。
- 单元测试覆盖多层 columns。

### T2.7 实现 Parquet 价格存储

目标：将标准化价格数据写入本地 Parquet。

依赖：T2.6。

交付物：

- `storage/parquet.py`
- `PriceBarRepository`
- `data/parquet/price_bars/` 分区约定。

验收标准：

- 按 symbol、interval 查询价格。
- 写入时按 symbol + interval + timestamp 去重或覆盖。
- 测试覆盖写入、读取、重复数据。

### T2.8 实现价格抓取任务

目标：支持创建、执行和记录价格抓取任务。

依赖：T2.3、T2.5、T2.6、T2.7。

交付物：

- `services/jobs.py`
- `services/prices.py`
- `api/jobs.py`
- `POST /api/fetch/prices`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`

验收标准：

- 创建任务后返回 job_id。
- 任务状态从 queued 到 running 到 success/partial_success/failed。
- 每个 ticker 有 item 级状态。
- 失败 ticker 记录错误类型和错误消息。
- 任务进度可查询。

### T2.9 实现价格查询 API

目标：为详情页和 Dashboard 提供价格数据。

依赖：T2.7、T2.8。

交付物：

- `api/prices.py`
- `GET /api/prices/{symbol}`
- `GET /api/prices/{symbol}/latest`

验收标准：

- 可按 symbol、interval、range 查询。
- latest 返回最新价、涨跌额、涨跌幅、成交量和最新数据日期。
- 本地无数据时返回明确空状态。

### T2.10 实现数据状态计算

目标：根据本地数据和任务结果生成用户可见数据状态。

依赖：T2.3、T2.8、T2.9。

交付物：

- `quality/validators.py`
- `DataStatusRepository`
- `GET /api/data-status`

验收标准：

- 支持 fresh、stale、missing、failed、partial。
- 可按 symbol 和 data_type 查询。
- 价格任务完成后更新 data_status。

### T2.11 后端基础测试

目标：建立后端 MVP 的自动化测试。

依赖：T2.4、T2.8、T2.9、T2.10。

交付物：

- repository 测试。
- normalizer 测试。
- jobs service 测试。
- API 测试。

验收标准：

- 测试默认不访问真实网络。
- 可以在本地一次性运行。
- 覆盖成功、空响应、部分失败、全部失败。

## 7. Phase 3: 前后端联调

### T3.1 建立前端 API Client

目标：替换 mock 调用的基础设施。

依赖：T1.1、T2.4、T2.9。

交付物：

- `frontend/src/api/client.ts`
- `symbols.ts`
- `market.ts`
- `prices.ts`
- `jobs.ts`

验收标准：

- API base URL 可配置。
- 请求错误能统一转换成前端错误状态。
- TanStack Query 能管理 loading、error、success。

### T3.2 Dashboard 接入真实数据

目标：让 Dashboard 使用真实 API 展示自选标的和数据状态。

依赖：T3.1、T2.9、T2.10。

交付物：

- Dashboard 查询真实 symbols、latest prices、data status、jobs。

验收标准：

- 无数据时显示引导添加 ticker。
- 有数据时显示最新价格、涨跌幅、数据状态。
- API 错误时显示可理解错误信息。

### T3.3 Symbol Detail 接入真实价格

目标：详情页价格图和成交量图使用真实 API。

依赖：T3.1、T2.9。

交付物：

- 价格图真实数据绑定。
- 成交量图真实数据绑定。
- latest header 真实数据绑定。

验收标准：

- 切换 symbol 能重新加载数据。
- 切换 range 能更新图表。
- 无价格数据时展示空状态和更新入口。

### T3.4 Watchlist 接入真实 Symbols API

目标：Watchlist 支持真实增删改查。

依赖：T3.1、T2.4。

交付物：

- 添加 ticker。
- 删除 ticker。
- 修改分组或 enabled 状态。
- 查询 watchlist 表格。

验收标准：

- 操作成功后列表自动刷新。
- 重复 ticker 和无效输入有提示。
- 删除时不误导用户认为历史数据被删除。

### T3.5 Jobs 接入真实任务 API

目标：前端可以创建价格更新任务并轮询进度。

依赖：T3.1、T2.8。

交付物：

- 创建价格更新任务。
- 任务列表。
- 任务详情。
- 运行中任务轮询。

验收标准：

- 点击 Update Prices 后出现 running/queued 任务。
- 任务结束后停止轮询。
- 任务成功后刷新 Dashboard 和详情页查询。
- 失败任务显示错误 ticker 和错误消息。

### T3.6 实现 Market Overview API

目标：减少 Dashboard 的多接口拼装压力。

依赖：T2.4、T2.9、T2.10。

交付物：

- `GET /api/market/overview`

验收标准：

- 返回 indices、watchlist、top_gainers、top_losers、freshness、recent_jobs。
- Dashboard 可切换为单接口聚合数据。
- 数据为空时结构稳定，前端无需特殊猜测字段。

### T3.7 端到端手动验证

目标：确认用户核心路径可走通。

依赖：T3.2、T3.3、T3.4、T3.5。

验证脚本：

```text
1. 启动后端。
2. 启动前端。
3. 添加 AAPL、MSFT、SPY。
4. 触发价格更新。
5. 在 Jobs 查看进度。
6. 在 Dashboard 查看最新价格和状态。
7. 进入 AAPL 详情页查看图表。
8. 删除一个 Watchlist 标的。
```

验收标准：

- 核心路径无阻塞错误。
- 空状态、运行状态、成功状态和失败状态可见。
- 手动验证结果记录在开发日志或 PR 描述中。

## 8. Phase 4: 数据增强

### T4.1 实现 Metadata 抓取

目标：补充 symbol 名称、交易所、类型、币种等基础信息。

依赖：T2.5、T2.4。

交付物：

- `MetadataFetcher`
- metadata 标准化逻辑。
- symbols 表字段更新。

验收标准：

- 添加 ticker 后可尝试补全名称、交易所、类型、币种。
- 字段缺失时允许 null。
- 原始响应可选保存到 `data/raw/metadata/`。

### T4.2 实现 Fundamentals 抓取和查询

目标：支持详情页财务摘要。

依赖：T2.5、T2.7、T2.8。

交付物：

- `FundamentalFetcher`
- `fundamental_facts` Parquet 存储。
- `GET /api/fundamentals/{symbol}`
- 财务摘要派生逻辑。

验收标准：

- 返回 market_cap、trailing_pe、price_to_book、dividend_yield 等指标。
- 返回 revenue、net_income、free_cash_flow、debt_ratio 等摘要字段。
- 字段缺失时返回 null，不伪造数据。

### T4.3 实现 Corporate Actions 抓取和查询

目标：支持分红拆股数据展示。

依赖：T2.5、T2.7、T2.8。

交付物：

- `CorporateActionFetcher`
- `corporate_actions` Parquet 存储。
- `GET /api/actions/{symbol}`

验收标准：

- 支持 dividends 和 splits。
- 详情页能展示事件列表或图表标记。
- 增量更新能覆盖最近一段事件数据。

### T4.4 数据质量增强

目标：提高异常数据可见性。

依赖：T2.10、T4.2、T4.3。

交付物：

- 价格校验增强。
- 财务字段缺失提示。
- action 数据空状态。
- data_status 按 data_type 完整更新。

验收标准：

- Dashboard 能看到不同数据类型的异常汇总。
- Symbol Detail 能看到价格、基本面、公司行动分别是否新鲜。

### T4.5 导出功能

目标：支持用户把本地数据导出用于分析。

依赖：T2.9、T4.2、T4.3。

交付物：

- 价格 CSV 导出。
- Watchlist CSV 导出。
- 前端 Export 入口。

验收标准：

- 详情页可导出当前 symbol 价格数据。
- Watchlist 页可导出当前列表。
- 导出无数据时有明确提示。

## 9. Phase 5: 自动化与维护

### T5.1 定时任务

目标：支持按配置自动更新数据。

依赖：T2.8、T3.5。

交付物：

- APScheduler 集成。
- 定时更新配置。
- 自动任务记录到 Jobs。

验收标准：

- 可启用或关闭定时更新。
- 自动任务和手动任务状态展示一致。
- 不会与正在运行的同类任务冲突。

### T5.2 失败重试策略

目标：提升批量抓取稳定性。

依赖：T2.8、T3.5。

交付物：

- `POST /api/jobs/{job_id}/retry`
- 只重试失败 item。
- 重试任务关联原任务参数。

验收标准：

- partial_success 任务可重试失败标的。
- failed 任务可按原参数重试。
- 重试结果有新的 job_id。

### T5.3 数据维护命令

目标：维护本地数据目录健康。

依赖：T2.7、T4.2、T4.3。

交付物：

- Parquet compact 命令。
- 数据状态重算命令。
- 清理旧 raw 响应命令。

验收标准：

- 命令有 dry-run 模式。
- 不会默认删除用户数据。
- 操作结果有日志摘要。

### T5.4 部署准备

目标：为后续本地或服务器部署做准备。

依赖：T3.7。

交付物：

- 生产构建命令。
- 环境变量说明。
- 可选 Dockerfile 或 Docker Compose。

验收标准：

- 前端可构建静态产物。
- 后端可用生产模式启动。
- 文档说明数据目录如何挂载和备份。

## 10. 横切任务

### X1 文档同步

触发条件：

- 用户可见流程变化。
- API 变化。
- 数据模型变化。
- 工程目录变化。
- 新增或推迟 MVP 功能。

验收标准：

- 产品变化更新 `product-dashboard.md`。
- 技术变化更新 `technical-design.md`。
- 执行顺序变化更新本文档。
- 代理约定变化更新 `agent.md`。

### X2 错误处理一致性

目标：统一前后端错误展示。

要求：

- 后端错误响应包含 code、message、details。
- 前端错误展示提供用户可操作建议。
- ticker 级错误必须能在 Jobs 详情中定位。

### X3 数据安全和合规提示

目标：避免误用 yfinance 数据。

要求：

- README 和相关 UI 提醒 yfinance 不是 Yahoo 官方 API。
- 默认定位为个人研究和本地使用。
- 不提供交易下单能力。

### X4 可观测性

目标：让抓取问题容易定位。

要求：

- 日志包含 job_id、symbol、data_type、status、error_type。
- 不输出大段原始行情数据。
- 任务历史能保留失败摘要。

## 11. 推荐执行切片

如果按小步开发，建议每次只领取一个切片：

1. `T0.1 + T0.2 + T0.3`: 项目基础。
2. `T1.1 + T1.2 + T1.3`: 前端外壳和 mock。
3. `T1.4 + T1.5`: Dashboard 和详情页。
4. `T1.6 + T1.7 + T1.8`: Watchlist、Jobs、Settings。
5. `T2.1 + T2.2 + T2.3`: 后端基础和 SQLite。
6. `T2.4`: Symbols API。
7. `T2.5 + T2.6 + T2.7`: 价格抓取、标准化和存储。
8. `T2.8 + T2.9 + T2.10`: 任务、查询和数据状态。
9. `T3.1 + T3.2 + T3.3`: 前端接真实 Dashboard 和详情页。
10. `T3.4 + T3.5 + T3.6 + T3.7`: Watchlist、Jobs 和端到端验证。
11. `T4.1 + T4.2 + T4.3`: 数据增强。
12. `T4.4 + T4.5`: 数据质量和导出。
13. `T5.1 + T5.2 + T5.3 + T5.4`: 自动化和部署准备。

## 12. 第一版完成定义

第一版完成时，应满足：

- 用户可以添加自选 ticker。
- 用户可以手动更新日线价格。
- 用户可以查看更新任务进度和失败原因。
- Dashboard 展示真实自选标的价格、涨跌幅和数据状态。
- Symbol Detail 展示真实价格图和成交量图。
- Watchlist 可管理标的。
- Jobs 可查看历史任务和失败详情。
- 无数据、加载中、错误、部分失败都有明确 UI。
- 后端测试覆盖 symbols、prices、jobs 主流程。
- 前端测试覆盖关键状态组件和基础数据转换。
- README、产品文档、技术文档和本文档保持一致。

