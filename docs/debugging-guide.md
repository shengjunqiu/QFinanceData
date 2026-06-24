# QFinanceData 调试教程

## 1. 文档目的

本文档用于指导本地开发和问题排查。它不替代产品文档和技术文档，而是提供一套从现象到根因的调试路径，帮助你快速判断问题发生在前端、API、抓取任务、yfinance、SQLite 还是 Parquet 数据层。

相关文档：

- [产品文档](product-dashboard.md)
- [技术文档](technical-design.md)
- [开发任务文档](development-tasks.md)
- [代理指南](../agent.md)

## 2. 调试前准备

### 2.1 确认本地依赖

后端：

```bash
cd backend
source .venv/bin/activate
python -m pytest
```

前端：

```bash
cd frontend
npm test
npm run build
```

如果这三条命令都通过，说明基础环境可用。后续调试就可以优先从数据、接口或业务逻辑入手。

### 2.2 使用独立调试数据目录

调试真实抓取或破坏性实验时，建议使用单独的数据目录，避免污染日常数据。

```bash
cd backend
QFD_DATA_DIR=/tmp/qfd-debug-data \
QFD_SQLITE_PATH=/tmp/qfd-debug-data/qfinancedata.sqlite \
uvicorn qfinancedata.main:app --reload
```

这会把 SQLite、Parquet 和 raw metadata 都写到 `/tmp/qfd-debug-data`。

### 2.3 打开更详细日志

```bash
cd backend
QFD_LOG_LEVEL=DEBUG uvicorn qfinancedata.main:app --reload
```

日志能帮助确认应用是否读取了正确配置、数据库是否初始化、请求是否进入了对应 API。

## 3. 系统调试地图

QFinanceData 的典型请求链路如下：

```text
Browser
  -> frontend/src/api/*
  -> FastAPI router
  -> service
  -> fetcher / repository
  -> yfinance / SQLite / Parquet
```

排查时不要一开始就跳进实现细节。先判断问题属于哪一层：

| 现象 | 优先检查 |
| --- | --- |
| 页面打不开 | 前端 dev server、构建错误、路由。 |
| 页面有空态 | API 返回、TanStack Query 状态、后端数据是否存在。 |
| API 404/500 | FastAPI router、请求路径、后端日志。 |
| 抓取任务失败 | Jobs item error、yfinance client、网络或返回结构。 |
| Dashboard 数字不对 | Market overview 聚合、DataStatus、价格最新值。 |
| 图表无数据 | `/api/prices/{symbol}`、Parquet price_bars。 |
| fundamentals 缺字段 | yfinance `Ticker.info` 或财报表缺字段，查看 `missing_fields`。 |
| actions 为空 | yfinance dividends/splits 为空，或本地 actions 未抓取。 |
| CSV 下载失败 | 导出 API 是否有数据，前端 download helper 是否收到 404。 |

## 4. 启动与连通性检查

### 4.1 启动后端

```bash
cd backend
source .venv/bin/activate
uvicorn qfinancedata.main:app --reload
```

健康检查：

```bash
curl -s http://127.0.0.1:8000/health
```

期望返回：

```json
{
  "status": "ok",
  "service": "qfinancedata-backend"
}
```

也可以打开 OpenAPI：

```text
http://127.0.0.1:8000/docs
```

### 4.2 启动前端

```bash
cd frontend
npm run dev
```

如果前端和后端端口不同，设置 API 地址：

```bash
cd frontend
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

前端默认通过 `frontend/src/api/client.ts` 构造请求地址。如果页面能打开但数据全部失败，优先检查 `VITE_API_BASE_URL`。

## 5. API 分层排查

### 5.1 先看 Dashboard 聚合接口

```bash
curl -s http://127.0.0.1:8000/api/market/overview
```

重点看：

- `watchlist` 是否有标的。
- `freshness` 是否反映价格状态。
- `freshness_by_type` 是否包含 `prices`、`metadata`、`fundamentals`、`actions`。
- `recent_jobs` 是否出现刚运行过的任务。

如果 Dashboard 异常，但这个接口返回正常，问题大概率在前端 mapper 或页面渲染。

### 5.2 检查 Watchlist

```bash
curl -s http://127.0.0.1:8000/api/symbols
```

添加一个标的：

```bash
curl -s -X POST http://127.0.0.1:8000/api/symbols \
  -H "Content-Type: application/json" \
  --data '{"symbol":"AAPL","group_name":"Core"}'
```

如果添加成功但 name、exchange、currency 为空，通常说明 metadata 抓取失败或 yfinance 没有返回完整字段。继续查：

```bash
curl -s "http://127.0.0.1:8000/api/data-status?symbol=AAPL&data_type=metadata"
```

### 5.3 检查价格数据

触发价格抓取：

```bash
curl -s -X POST http://127.0.0.1:8000/api/fetch/prices \
  -H "Content-Type: application/json" \
  --data '{"symbols":["AAPL"],"interval":"1d","start":"2024-01-01"}'
```

查看任务：

```bash
curl -s http://127.0.0.1:8000/api/jobs
```

查看价格序列：

```bash
curl -s "http://127.0.0.1:8000/api/prices/AAPL?interval=1d&range=1mo"
```

查看最新价格：

```bash
curl -s "http://127.0.0.1:8000/api/prices/AAPL/latest?interval=1d"
```

如果任务成功但价格接口为空，优先检查 Parquet 写入路径和 symbol/interval 是否一致。

### 5.4 检查 fundamentals

触发 fundamentals 抓取：

```bash
curl -s -X POST http://127.0.0.1:8000/api/fetch/fundamentals \
  -H "Content-Type: application/json" \
  --data '{"symbols":["AAPL"]}'
```

查询摘要：

```bash
curl -s http://127.0.0.1:8000/api/fundamentals/AAPL
```

重点看：

- `metrics.market_cap`
- `metrics.trailing_pe`
- `financial_summary.revenue`
- `financial_summary.free_cash_flow`
- `missing_fields`
- `status`

`missing_fields` 不是后端错误，它表示 yfinance 当前响应中没有足够字段，前端应展示为数据质量提示。

### 5.5 检查 corporate actions

触发 actions 抓取：

```bash
curl -s -X POST http://127.0.0.1:8000/api/fetch/actions \
  -H "Content-Type: application/json" \
  --data '{"symbols":["AAPL"]}'
```

查询事件：

```bash
curl -s http://127.0.0.1:8000/api/actions/AAPL
```

如果返回空数组，可能是：

- 本地还没有抓取 actions。
- yfinance 返回的 dividends/splits 为空。
- 标的是指数或资产类型本身没有分红拆股事件。

空数组是合法状态，前端应显示空态，而不是错误态。

## 6. Jobs 调试

### 6.1 看任务整体状态

```bash
curl -s http://127.0.0.1:8000/api/jobs
```

关键字段：

- `job_type`：`prices`、`fundamentals`、`actions`、`metadata`。
- `status`：`success`、`partial_success`、`failed`。
- `progress_total` / `progress_done`。
- `error_summary`。
- `items[].error_type` 和 `items[].error_message`。

### 6.2 判断任务失败来源

| error_type | 常见原因 | 下一步 |
| --- | --- | --- |
| `YFinanceTimeoutError` | yfinance 请求超时。 | 重试、提高 `QFD_REQUEST_TIMEOUT`、检查网络。 |
| `YFinanceRequestError` | yfinance 抛出异常。 | 查看 `error_message`，确认 symbol 和网络。 |
| `YFinanceEmptyResponseError` | yfinance 返回空数据。 | 换 symbol 或缩小数据类型定位。 |
| `YFinanceSchemaError` | 返回结构不符合预期。 | 补测试并更新 normalizer。 |
| `PriceFrameValueError` | 价格数据 OHLC 或 volume 不合理。 | 查看原始响应或对应价格行。 |

### 6.3 检查 DataStatus

查询单个标的所有数据类型：

```bash
curl -s "http://127.0.0.1:8000/api/data-status?symbol=AAPL"
```

查询指定数据类型：

```bash
curl -s "http://127.0.0.1:8000/api/data-status?symbol=AAPL&data_type=prices"
```

状态含义：

| status | 含义 |
| --- | --- |
| `fresh` | 最近抓取成功且数据新鲜。 |
| `stale` | 有数据但超过新鲜度阈值。 |
| `missing` | 没有可用本地数据。 |
| `failed` | 最近抓取失败。 |
| `partial` | 部分标的或字段失败。 |

## 7. 存储层调试

### 7.1 SQLite

默认位置：

```text
data/qfinancedata.sqlite
```

常用查询：

```bash
sqlite3 data/qfinancedata.sqlite "select symbol, name, enabled from symbols order by symbol;"
sqlite3 data/qfinancedata.sqlite "select symbol, data_type, status, last_error from data_status order by symbol, data_type;"
sqlite3 data/qfinancedata.sqlite "select id, job_type, status, progress_done, progress_total from fetch_jobs order by created_at desc limit 10;"
```

如果 API 返回空 watchlist，但 SQLite 有数据，检查 `enabled` 字段。默认 `/api/symbols` 不返回 disabled 标的。

### 7.2 Parquet

默认目录：

```text
data/parquet/
├── price_bars/
├── fundamental_facts/
└── corporate_actions/
```

快速查看 price bars：

```bash
cd backend
python - <<'PY'
from pathlib import Path
import pandas as pd

path = Path("../data/parquet/price_bars/interval=1d/symbol=AAPL/part-00000.parquet")
print(pd.read_parquet(path).tail())
PY
```

快速查看 fundamentals：

```bash
cd backend
python - <<'PY'
from pathlib import Path
import pandas as pd

path = Path("../data/parquet/fundamental_facts/symbol=AAPL/part-00000.parquet")
print(pd.read_parquet(path).sort_values(["period_end", "field"]).tail(20))
PY
```

快速查看 actions：

```bash
cd backend
python - <<'PY'
from pathlib import Path
import pandas as pd

path = Path("../data/parquet/corporate_actions/symbol=AAPL/part-00000.parquet")
print(pd.read_parquet(path).sort_values("ex_date", ascending=False).head(20))
PY
```

如果文件不存在，说明还没有写入对应数据类型，或者 symbol/interval 不匹配。

## 8. 前端调试

### 8.1 看网络请求

打开浏览器开发者工具的 Network 面板，重点看：

- 请求 URL 是否指向正确后端。
- 响应状态码是否为 200。
- JSON 字段是否符合前端 mapper 预期。
- CSV 下载是否返回 `text/csv`。

### 8.2 TanStack Query 状态

前端 API 查询主要在：

```text
frontend/src/api/
├── actions.ts
├── fundamentals.ts
├── jobs.ts
├── market.ts
├── prices.ts
└── symbols.ts
```

如果 API 响应正常但页面不显示，优先看 mapper：

- `mapMarketOverview`
- `mapSymbol`
- `mapPriceSeries`
- `mapFundamentalSnapshot`
- `mapCorporateAction`
- `mapFetchJob`

对应测试在：

```text
frontend/src/api/mappers.test.ts
```

运行单个测试文件：

```bash
cd frontend
npm test -- src/api/mappers.test.ts
```

### 8.3 常见前端问题

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| Dashboard 一直 loading | 某个 query 未返回。 | 看 Network 和 Console。 |
| Dashboard 显示空 watchlist | `/api/market/overview` 返回空。 | 添加 symbol 或检查 SQLite。 |
| 详情页图表空 | `/api/prices/{symbol}` 返回空 bars。 | 运行 price fetch job。 |
| fundamentals 全是 `-` | 本地 facts 为空或字段缺失。 | 运行 fundamentals job，查看 `missing_fields`。 |
| actions 显示 No events | 本地 actions 为空。 | 运行 actions job，确认 yfinance 是否有数据。 |
| Export 失败 | 当前范围无数据或导出 API 404。 | 切换 range 或先抓取价格。 |

## 9. 导出功能调试

### 9.1 价格 CSV

```bash
curl -i "http://127.0.0.1:8000/api/prices/AAPL/export?interval=1d&range=all"
```

期望：

- 状态码 200。
- `content-type` 包含 `text/csv`。
- `content-disposition` 包含文件名。
- CSV 第一行为：

```text
symbol,interval,timestamp,open,high,low,close,adj_close,volume
```

如果返回 404，说明当前 symbol/range 没有可导出的价格数据。

### 9.2 Watchlist CSV

```bash
curl -i "http://127.0.0.1:8000/api/symbols/export?include_disabled=true"
```

期望 CSV 第一行为：

```text
symbol,name,exchange,asset_type,currency,group_name,enabled,status,last_data_at,last_fetch_at,created_at,updated_at
```

如果返回 404，说明当前筛选条件下没有可导出的 symbol。

## 10. 测试定位

### 10.1 后端测试

全量：

```bash
cd backend
python -m pytest
```

按关键字：

```bash
cd backend
python -m pytest -k prices
python -m pytest -k fundamentals
python -m pytest -k actions
python -m pytest -k jobs
```

单文件：

```bash
cd backend
python -m pytest tests/test_prices_api.py
```

### 10.2 前端测试

全量：

```bash
cd frontend
npm test
```

单文件：

```bash
cd frontend
npm test -- src/api/mappers.test.ts
```

构建检查：

```bash
cd frontend
npm run build
```

构建错误通常比单元测试更容易暴露 TypeScript 类型不一致，例如后端新增字段但 mock 数据或 mapper 没同步。

## 11. yfinance 调试建议

yfinance 不是官方 API，返回结构可能变化。调试时遵循两条原则：

1. 真实网络问题先用 job item error 定位，不要直接假设 normalizer 错。
2. 返回结构变化必须补测试，再改 fetcher 或 normalizer。

推荐调试顺序：

```text
1. 看 /api/jobs 的 item error。
2. 看 /api/data-status 的 last_error。
3. 用单个 symbol 复现。
4. 写或调整 fake yfinance 测试。
5. 更新 normalizer。
6. 跑 backend 全量测试。
```

对应测试文件：

```text
backend/tests/test_yf_client.py
backend/tests/test_price_normalizer.py
backend/tests/test_fundamental_fetcher.py
backend/tests/test_actions_fetcher.py
```

## 12. 常见问题速查

| 问题 | 快速命令 | 判断 |
| --- | --- | --- |
| 后端是否活着 | `curl -s /health` | 不通则先修服务启动。 |
| Watchlist 是否有标的 | `curl -s /api/symbols` | 空则先添加 symbol。 |
| Dashboard 数据是否正常 | `curl -s /api/market/overview` | 正常则查前端。 |
| 价格任务是否失败 | `curl -s /api/jobs` | 看 item error。 |
| 价格状态是否新鲜 | `curl -s /api/data-status?symbol=AAPL&data_type=prices` | 看 status 和 last_error。 |
| 图表为何空 | `curl -s /api/prices/AAPL?range=1mo` | bars 为空则查 Parquet/抓取。 |
| fundamentals 为何缺字段 | `curl -s /api/fundamentals/AAPL` | 看 `missing_fields`。 |
| actions 为何无事件 | `curl -s /api/actions/AAPL` | 空数组是合法空态。 |
| 导出为何失败 | `curl -i /api/prices/AAPL/export` | 404 表示无可导出数据。 |

## 13. 调试完成后的收尾

调试完成后建议做三件事：

1. 运行后端测试：

```bash
cd backend
python -m pytest
```

2. 运行前端测试和构建：

```bash
cd frontend
npm test
npm run build
```

3. 检查 Git 状态，确认没有把运行期数据加入提交：

```bash
git status --short
```

正常情况下，不应提交以下内容：

```text
data/qfinancedata.sqlite
data/raw/
data/parquet/
backend/.venv/
frontend/node_modules/
frontend/dist/
```
