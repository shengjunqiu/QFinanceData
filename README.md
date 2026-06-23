# QFinanceData

QFinanceData 是一个面向个人投研和数据研究的本地金融数据抓取与前端看板工具。项目计划使用 yfinance 抓取行情、基础信息、财务摘要和分红拆股数据，并通过前端工作台展示自选标的、价格走势、数据新鲜度和更新任务状态。

第一版聚焦本地研究和数据准备，不定位为实时交易终端，也不提供交易下单能力。

## 文档入口

- [产品文档](docs/product-dashboard.md)：产品目标、用户场景、信息架构、页面草图和 MVP 范围。
- [技术文档](docs/technical-design.md)：系统架构、工程结构、API、数据模型、存储和测试策略。
- [开发任务文档](docs/development-tasks.md)：按阶段拆分的可执行开发任务。
- [代理指南](agent.md)：后续编码代理的工作约定和实现边界。

## 项目结构

```text
QFinanceData/
├── agent.md
├── backend/
├── data/
├── docs/
│   ├── development-tasks.md
│   ├── product-dashboard.md
│   └── technical-design.md
├── frontend/
└── README.md
```

## 本地开发

当前处于 Phase 0，项目只建立基础目录、文档和忽略规则。下面命令会在后续阶段完成对应工程初始化后可用。

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn qfinancedata.main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 测试

```bash
cd backend
pytest
```

```bash
cd frontend
npm test
```

## 数据目录

运行期数据默认放在 `data/`：

```text
data/
├── qfinancedata.sqlite
├── raw/
└── parquet/
```

SQLite、Parquet、原始响应和本地缓存不会提交到版本控制。

## 数据源说明

yfinance 不是 Yahoo 官方 API。QFinanceData 第一版默认面向个人研究和本地使用；使用 Yahoo Finance 数据时需要遵守相关数据源条款。

