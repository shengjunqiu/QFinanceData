# QFinanceData 技术文档

## 1. 文档边界

本文档描述 QFinanceData 的技术架构、工程结构、接口设计、数据模型、存储方案、抓取流程、错误处理、测试策略和迭代落地计划。

产品目标、用户场景、页面草图和功能范围见 [product-dashboard.md](product-dashboard.md)。

## 2. 技术目标

- 用 yfinance 封装稳定、可重试、可观测的数据抓取能力。
- 将行情、基础信息、财务摘要、分红拆股和任务状态标准化保存到本地。
- 为前端看板提供清晰、稳定、低耦合的 HTTP API。
- 支持手动更新、增量更新、失败重试和数据新鲜度判断。
- 第一版保持本地开发和本地运行友好，后续可平滑扩展为服务化部署。

## 3. 总体架构

```text
Browser
  |
  | HTTP / JSON
  v
FastAPI App
  |
  ├── API Routers
  ├── Application Services
  ├── Fetch Job Runner
  ├── yfinance Client Adapter
  ├── Data Normalizers
  └── Storage Repositories
        |
        ├── SQLite: metadata, watchlist, jobs, status
        └── Parquet: price bars, fundamentals, actions
```

## 4. 推荐工程结构

```text
QFinanceData/
├── docs/
│   ├── product-dashboard.md
│   └── technical-design.md
├── backend/
│   ├── pyproject.toml
│   ├── qfinancedata/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── logging.py
│   │   ├── api/
│   │   │   ├── symbols.py
│   │   │   ├── market.py
│   │   │   ├── prices.py
│   │   │   └── jobs.py
│   │   ├── services/
│   │   │   ├── symbols.py
│   │   │   ├── prices.py
│   │   │   ├── fundamentals.py
│   │   │   └── jobs.py
│   │   ├── fetchers/
│   │   │   ├── yf_client.py
│   │   │   ├── prices.py
│   │   │   ├── fundamentals.py
│   │   │   └── actions.py
│   │   ├── storage/
│   │   │   ├── sqlite.py
│   │   │   ├── parquet.py
│   │   │   └── repositories.py
│   │   ├── schemas/
│   │   │   ├── symbols.py
│   │   │   ├── prices.py
│   │   │   └── jobs.py
│   │   └── quality/
│   │       └── validators.py
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── api/
│       ├── charts/
│       └── styles/
└── data/
    ├── qfinancedata.sqlite
    ├── raw/
    └── parquet/
```

## 5. 技术选型

### 5.1 前端

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| 应用框架 | React + TypeScript + Vite | 适合中小型数据看板，开发启动快。 |
| 图表 | ECharts | 支持 K 线、折线、柱状、tooltip 和 data zoom。 |
| 请求状态 | TanStack Query | 支持缓存、轮询、重试和 loading/error 状态。 |
| 本地 UI 状态 | Zustand | 管理当前标的、时间范围、偏好设置等轻量状态。 |
| 样式 | CSS variables 或 Tailwind CSS | 第一版优先可维护和统一设计变量。 |

### 5.2 后端

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| API 框架 | FastAPI | 类型友好，自动生成 OpenAPI。 |
| 数据抓取 | yfinance | 覆盖行情、基础信息、财务、分红拆股等数据。 |
| 数据校验 | Pydantic | 请求、响应和内部 DTO 校验。 |
| 元数据存储 | SQLite | 本地单用户场景足够简单稳定。 |
| 时间序列存储 | Parquet | 适合行情和财务时间序列的列式存储。 |
| 数据处理 | pandas / pyarrow | 与 yfinance 返回结构和 Parquet 写入契合。 |
| 定时任务 | APScheduler | Phase 4 引入。 |

## 6. 配置项

建议使用环境变量和本地配置文件组合。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `QFD_DATA_DIR` | `./data` | 本地数据目录。 |
| `QFD_SQLITE_PATH` | `./data/qfinancedata.sqlite` | SQLite 数据库路径。 |
| `QFD_DEFAULT_START_DATE` | `2015-01-01` | 首次抓取默认起始日期。 |
| `QFD_DEFAULT_INTERVAL` | `1d` | 默认行情周期。 |
| `QFD_STALE_TRADING_DAYS` | `2` | stale 判断阈值。 |
| `QFD_FETCH_CONCURRENCY` | `4` | 单任务 ticker 并发上限。 |
| `QFD_REQUEST_TIMEOUT` | `30` | yfinance 请求超时秒数。 |
| `QFD_LOG_LEVEL` | `INFO` | 后端日志级别。 |

## 7. 后端模块设计

### 7.1 API Routers

- `symbols`: Watchlist 增删改查。
- `market`: 总览页聚合数据。
- `prices`: 单标的行情查询。
- `fundamentals`: 单标的财务摘要查询。
- `actions`: 分红拆股查询。
- `jobs`: 更新任务创建、查询和重试。

### 7.2 Services

Service 层负责业务编排，不直接依赖 HTTP 请求对象。

- `SymbolService`: ticker 校验、分组管理、启停更新。
- `PriceService`: 查询价格、计算涨跌幅、判断数据新鲜度。
- `FundamentalService`: 查询财务摘要并做字段兜底。
- `JobService`: 创建任务、更新进度、重试失败 ticker。

### 7.3 Fetchers

Fetcher 层只处理外部数据源调用和原始响应转换。

- `YFinanceClient`: 统一封装 yfinance 调用、超时、重试和错误类型。
- `PriceFetcher`: 批量拉取 OHLCV。
- `MetadataFetcher`: 拉取基础信息。
- `FundamentalFetcher`: 拉取财务报表和财务摘要。
- `CorporateActionFetcher`: 拉取分红、拆股事件。

### 7.4 Storage

Repository 层负责读写 SQLite 和 Parquet，不向上暴露存储细节。

- `SymbolRepository`
- `JobRepository`
- `DataStatusRepository`
- `PriceBarRepository`
- `FundamentalRepository`
- `CorporateActionRepository`

## 8. 数据模型

### 8.1 SQLite 表

#### `symbols`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | text primary key | yfinance ticker，例如 `AAPL`、`0700.HK`。 |
| `name` | text | 公司、基金或指数名称。 |
| `exchange` | text | 交易所。 |
| `asset_type` | text | `equity`、`etf`、`index` 等。 |
| `currency` | text | 交易币种。 |
| `group_name` | text | 用户分组。 |
| `enabled` | integer | 是否启用更新。 |
| `created_at` | text | ISO datetime。 |
| `updated_at` | text | ISO datetime。 |

#### `fetch_jobs`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text primary key | 任务 ID。 |
| `job_type` | text | `prices`、`fundamentals`、`actions`、`metadata`。 |
| `status` | text | `queued`、`running`、`success`、`partial_success`、`failed`、`cancelled`。 |
| `params_json` | text | 任务参数 JSON。 |
| `progress_total` | integer | 总标的数量。 |
| `progress_done` | integer | 已完成标的数量。 |
| `error_summary` | text | 错误摘要。 |
| `created_at` | text | 创建时间。 |
| `started_at` | text | 开始时间。 |
| `finished_at` | text | 结束时间。 |

#### `fetch_job_items`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text primary key | 任务明细 ID。 |
| `job_id` | text | 任务 ID。 |
| `symbol` | text | ticker。 |
| `status` | text | 单标的执行状态。 |
| `error_type` | text | 错误类型。 |
| `error_message` | text | 错误消息。 |
| `started_at` | text | 开始时间。 |
| `finished_at` | text | 结束时间。 |

#### `data_status`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | text | ticker。 |
| `data_type` | text | `prices`、`metadata`、`fundamentals`、`actions`。 |
| `status` | text | `fresh`、`stale`、`missing`、`failed`、`partial`。 |
| `last_data_at` | text | 数据最新日期。 |
| `last_fetch_at` | text | 最近抓取时间。 |
| `last_success_at` | text | 最近成功时间。 |
| `last_error` | text | 最近错误摘要。 |

### 8.2 Parquet 数据集

#### `price_bars`

路径建议：

```text
data/parquet/price_bars/interval=1d/symbol=AAPL/part-*.parquet
```

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | string | ticker。 |
| `interval` | string | `1d`、`1wk`、`1mo`。 |
| `timestamp` | timestamp | K 线时间。 |
| `open` | double | 开盘价。 |
| `high` | double | 最高价。 |
| `low` | double | 最低价。 |
| `close` | double | 收盘价。 |
| `adj_close` | double | 复权收盘价。 |
| `volume` | int64 | 成交量。 |
| `source` | string | 默认 `yfinance`。 |
| `fetched_at` | timestamp | 抓取时间。 |

#### `fundamental_facts`

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | string | ticker。 |
| `statement_type` | string | `income`、`balance_sheet`、`cashflow`。 |
| `period_type` | string | `annual`、`quarterly`。 |
| `period_end` | date | 报告期结束日。 |
| `field` | string | 指标名。 |
| `value` | double | 指标值。 |
| `currency` | string | 币种。 |
| `fetched_at` | timestamp | 抓取时间。 |

#### `corporate_actions`

字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | string | ticker。 |
| `action_type` | string | `dividend`、`split`。 |
| `ex_date` | date | 除权除息日。 |
| `value` | double | 分红金额或拆股比例。 |
| `fetched_at` | timestamp | 抓取时间。 |

## 9. API 设计

### 9.1 通用约定

- 响应使用 JSON。
- 时间字段使用 ISO 8601 字符串。
- 错误响应包含 `code`、`message`、`details`。
- 分页参数统一使用 `limit` 和 `offset`。
- 前端轮询任务状态时建议间隔 1 到 3 秒。

### 9.2 Symbols API

```text
GET    /api/symbols
POST   /api/symbols
PATCH  /api/symbols/{symbol}
DELETE /api/symbols/{symbol}
POST   /api/symbols/import
GET    /api/symbols/export
```

#### `POST /api/symbols`

请求：

```json
{
  "symbol": "AAPL",
  "group_name": "US Stocks",
  "enabled": true
}
```

响应：

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "exchange": "NMS",
  "asset_type": "equity",
  "currency": "USD",
  "group_name": "US Stocks",
  "enabled": true,
  "status": "missing"
}
```

### 9.3 Market API

```text
GET /api/market/overview
GET /api/data-status
```

`GET /api/market/overview` 返回 Dashboard 所需聚合数据：

```json
{
  "last_update_at": "2026-06-23T16:30:00+08:00",
  "indices": [],
  "watchlist": [],
  "top_gainers": [],
  "top_losers": [],
  "freshness": {
    "fresh": 21,
    "stale": 3,
    "missing": 0,
    "failed": 1
  },
  "freshness_by_type": {
    "prices": {
      "fresh": 21,
      "stale": 3,
      "missing": 0,
      "failed": 1,
      "partial": 0
    },
    "metadata": {
      "fresh": 20,
      "stale": 0,
      "missing": 4,
      "failed": 1,
      "partial": 0
    },
    "fundamentals": {
      "fresh": 18,
      "stale": 2,
      "missing": 4,
      "failed": 1,
      "partial": 0
    },
    "actions": {
      "fresh": 23,
      "stale": 0,
      "missing": 1,
      "failed": 1,
      "partial": 0
    }
  },
  "recent_jobs": []
}
```

### 9.4 Prices API

```text
GET /api/prices/{symbol}?interval=1d&range=1y
GET /api/prices/{symbol}/latest
GET /api/prices/{symbol}/export?interval=1d&range=all
```

响应：

```json
{
  "symbol": "AAPL",
  "interval": "1d",
  "range": "1y",
  "bars": [
    {
      "timestamp": "2026-06-22T00:00:00-04:00",
      "open": 210.0,
      "high": 214.2,
      "low": 209.5,
      "close": 213.4,
      "adj_close": 213.4,
      "volume": 61230000
    }
  ]
}
```

### 9.5 Fundamentals API

```text
GET /api/fundamentals/{symbol}
```

响应返回前端详情页需要的摘要字段：

```json
{
  "symbol": "AAPL",
  "currency": "USD",
  "metrics": {
    "market_cap": 3200000000000,
    "trailing_pe": 32.1,
    "price_to_book": 45.2,
    "dividend_yield": 0.0045
  },
  "financial_summary": {
    "revenue": 391000000000,
    "net_income": 93736000000,
    "free_cash_flow": 108800000000,
    "debt_ratio": 0.31
  },
  "missing_fields": [],
  "last_fetch_at": "2026-06-23T16:30:00+08:00"
}
```

### 9.6 Corporate Actions API

```text
GET /api/actions/{symbol}
```

### 9.7 Jobs API

```text
POST /api/fetch/prices
POST /api/fetch/fundamentals
POST /api/fetch/actions
GET  /api/jobs
GET  /api/jobs/{job_id}
POST /api/jobs/{job_id}/retry
POST /api/jobs/{job_id}/cancel
```

`POST /api/fetch/prices` 请求：

```json
{
  "symbols": ["AAPL", "MSFT", "0700.HK"],
  "interval": "1d",
  "start": "2015-01-01",
  "end": null,
  "mode": "incremental"
}
```

响应：

```json
{
  "job_id": "job_20260623_163000_prices",
  "status": "queued"
}
```

## 10. yfinance 抓取策略

### 10.1 价格数据

- 批量价格优先使用 `yfinance.download()`。
- 首次抓取使用用户配置的 start date。
- 增量抓取读取本地最新交易日，从 `last_date - 5 days` 重新拉取并覆盖，降低复权和公司行动修正带来的偏差。
- 日线第一版支持 `1d`，后续增加 `1wk`、`1mo`。
- 分钟级数据后置，因为历史范围和稳定性限制更明显。

### 10.2 基础信息

- 优先使用轻量字段构建详情页摘要。
- 字段缺失时返回 `null`，不在后端伪造数据。
- 保存原始响应到 `data/raw/metadata/` 便于排查字段变化。

### 10.3 财务数据

- 财务报表标准化为长表。
- 前端摘要字段由后端从长表或 metadata 中派生。
- 每次抓取记录 `fetched_at`，保留原始快照，便于比较历史变化。

### 10.4 分红拆股

- 分红和拆股独立存储。
- 价格图表通过事件标记展示公司行动。
- 增量更新时重新拉取最近一段，避免漏掉延迟修正。

## 11. 任务执行流程

### 11.1 创建任务

```text
API request
  -> validate params
  -> create fetch_jobs row
  -> create fetch_job_items rows
  -> enqueue job
  -> return job_id
```

### 11.2 执行任务

```text
load job
  -> mark running
  -> split symbols into batches
  -> fetch batch
  -> normalize response
  -> validate data
  -> write storage
  -> update item status
  -> update job progress
  -> mark success / partial_success / failed
```

### 11.3 重试任务

```text
load failed items
  -> create retry job with failed symbols only
  -> copy original params
  -> execute retry job
```

## 12. 数据质量校验

### 12.1 价格校验

- 必须包含 `timestamp`、`open`、`high`、`low`、`close`、`volume`。
- 同一 `symbol + interval + timestamp` 不允许重复。
- `high >= low`。
- `volume >= 0`。
- 空返回需要记录为 `missing` 或 `failed`，不能静默成功。

### 12.2 状态判断

```text
if no local data:
  missing
elif last fetch failed:
  failed
elif latest data date older than stale threshold:
  stale
else:
  fresh
```

### 12.3 错误类型

| 错误类型 | 说明 |
| --- | --- |
| `invalid_symbol` | ticker 无效或没有匹配数据。 |
| `empty_response` | 数据源返回空结果。 |
| `timeout` | 请求超时。 |
| `rate_limited` | 疑似频率限制。 |
| `schema_changed` | 返回字段结构不符合预期。 |
| `storage_error` | 本地写入失败。 |
| `unknown` | 未分类异常。 |

## 13. 前端数据流

### 13.1 Dashboard

```text
load /api/market/overview
  -> render market cards
  -> render watchlist table
  -> render trend chart
  -> render freshness summary
  -> render recent jobs
```

### 13.2 Symbol Detail

```text
load /api/prices/{symbol}
load /api/fundamentals/{symbol}
load /api/actions/{symbol}
  -> render header metrics
  -> render price chart
  -> render volume chart
  -> render financial summary
  -> render corporate action markers
```

### 13.3 Jobs

```text
create fetch job
  -> receive job_id
  -> poll /api/jobs/{job_id}
  -> update progress
  -> refresh related queries after terminal status
```

## 14. 前端组件拆分

```text
src/
├── app/
│   ├── App.tsx
│   └── router.tsx
├── api/
│   ├── client.ts
│   ├── symbols.ts
│   ├── market.ts
│   ├── prices.ts
│   └── jobs.ts
├── features/
│   ├── dashboard/
│   ├── symbol-detail/
│   ├── watchlist/
│   ├── jobs/
│   └── settings/
├── charts/
│   ├── PriceChart.tsx
│   ├── VolumeChart.tsx
│   └── ReturnChart.tsx
└── components/
    ├── AppShell.tsx
    ├── StatusBadge.tsx
    ├── SymbolSearch.tsx
    └── TimeRangeControl.tsx
```

## 15. 测试策略

### 15.1 后端测试

- yfinance client 使用 mock 响应做单元测试。
- normalizer 测试字段缺失、空数据、多 ticker、多层 columns。
- storage 测试 upsert、重复数据、Parquet 读写。
- API 测试 symbols、prices、jobs 主流程。

### 15.2 前端测试

- 组件测试覆盖 StatusBadge、TimeRangeControl、SymbolSearch。
- 页面测试覆盖 Dashboard 加载、空状态、错误状态。
- Jobs 测试轮询、进度更新、失败重试入口。
- 图表测试重点验证数据转换，不追求像素级快照。

### 15.3 集成测试

- 使用固定 ticker 小集合，例如 `AAPL`、`MSFT`、`SPY`。
- 网络抓取测试默认不在普通单元测试中执行。
- 提供手动验证命令用于真实 yfinance 抓取。

## 16. 本地开发流程

### 16.1 后端

```text
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn qfinancedata.main:app --reload
```

### 16.2 前端

```text
cd frontend
npm install
npm run dev
```

### 16.3 数据目录

默认数据目录：

```text
data/
├── qfinancedata.sqlite
├── raw/
└── parquet/
```

## 17. 安全与合规注意

- yfinance 不是 Yahoo 官方 API。
- 数据使用需要遵守 Yahoo Finance 相关条款。
- 第一版仅面向个人研究和本地使用。
- 不在日志中记录敏感本地路径以外的个人信息。
- 后续如果部署为网络服务，需要增加鉴权、访问控制和速率限制。

## 18. 技术风险与应对

| 风险 | 影响 | 技术应对 |
| --- | --- | --- |
| yfinance 返回字段变化 | normalizer 失败 | 版本锁定、字段兜底、原始响应留存。 |
| 批量抓取超时 | 任务失败 | 分批抓取、重试、并发控制。 |
| Parquet 小文件过多 | 查询变慢 | 按 symbol/interval 分区，后续增加 compact。 |
| SQLite 并发写入限制 | 多任务冲突 | 第一版串行任务写入，后续引入队列。 |
| 时区不一致 | 图表和 fresh 判断错误 | 存储层统一 timestamp，展示层按市场格式化。 |
| 财务字段缺失 | 前端空白 | 响应允许 null，前端展示缺失状态。 |

## 19. 落地里程碑

### Phase 1: 工程骨架

- 创建 `backend/` 和 `frontend/`。
- 建立后端配置、日志、API skeleton。
- 建立前端 app shell、路由、mock API。

### Phase 2: 价格数据 MVP

- 实现 symbols API。
- 实现 prices fetch job。
- 实现 SQLite job 状态和 Parquet price_bars。
- 前端 Dashboard 和 Symbol Detail 接真实价格。

### Phase 3: 任务系统

- 实现任务进度、失败明细、重试。
- Jobs 页面接真实接口。
- 增加数据状态计算。

### Phase 4: 数据扩展

- 实现 metadata、fundamentals、actions。
- 完成详情页财务摘要和公司行动标记。
- 增加导出 API。

### Phase 5: 自动化

- 引入定时任务。
- 增加增量更新策略配置。
- 增加数据 compact 和维护命令。

## 20. 待确认技术问题

- 前端是否确定使用 React，还是偏好 Vue？
- 第一版是否需要 Docker Compose？
- 是否接受 `backend/` 和 `frontend/` 分目录，还是希望单项目根目录管理？
- Parquet 是否作为第一版必须项，还是先使用 SQLite 完成端到端闭环？
- 是否需要从第一版开始支持港股交易日历？
