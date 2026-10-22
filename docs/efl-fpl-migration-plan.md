# EFL / FPL 双模块迁移评估

实施更新：双模块入口、切换、FPL 官方采集、球员表、图表导出、个人画像、逐场历史、球队统计、FDR、定位球、转会热度及构建接入已完成。下文保留初次评估记录；预测与自动组队仍为后续阶段。

初次核查日期：2026-10-17（北京时间）。以下为当时的评估记录；当前实施状态以上文及更新核查报告为准。

## 结论

可以在同一 GitHub Pages 网站左上角切换 EFL / FPL。保留现有 EFL 地址和功能，新增 FPL 入口；共用图表、表格、个人画像与导出工具，数据采集、指标配置和计分分别实现。无需另买域名或先迁移托管平台。

展示和统计工具有较高复用价值；比赛规则、推荐模型和阵容约束复用较少。不宜给出未经实施测量的代码复用百分比：dashboard.tsx 的展示、指标与 EFL 业务目前混在一起，组件抽取本身也有工作量。

## 现有功能逐项映射

| 现有功能 | 复用判断 | FPL 处理方式 | 代码位置 |
| --- | --- | --- | --- |
| 搜索、排序、分页、位置/分钟筛选 | 框架可复用 | 增加价格区间；FPL 不显示英冠/英甲/英乙组合 | app/dashboard.tsx、components/ui/filter-select.tsx、lib/league-selection.ts |
| 自选横纵轴散点图、悬停和触屏选点 | 抽取后可复用 | 指标及来源链接按系统配置；增加价格、xA、xGI、BPS 等轴 | app/dashboard.tsx 的 OpportunityChart、lib/chart-scale.ts |
| PNG 导出、图片降级、缩略图缓存 | 工具可复用 | 标题、来源、文件名及资产路径区分系统 | lib/export-chart.ts、scripts/cache-chart-assets.mjs |
| 场均表与同位置着色 | 算法可复用，字段需适配 | 价格、bonus、BPS、防守贡献采用 FPL 字段；缺失不填零 | app/dashboard.tsx 的 StatsTable、lib/player-profile.ts |
| 个人画像、百分位和排名 | 排名算法可复用，指标配置需拆分 | 使用 FPL 同位置参照组；不与 EFL 混排；保留分钟门槛 | app/personal-data.tsx、lib/player-profile.ts |
| 最近 N 场与历史 GW | UI 和归档方式可复用，采集需适配 | 用 fixture ID 区分同轮双赛；按逐场分钟过滤出场；区分赛后修正与赛前快照 | lib/chart-history.ts、scripts/build-chart-history.mjs、scripts/build-round-views.mjs |
| 赛程矩阵、主客场、空轮/双赛展示 | 展示可复用 | 官方 fixtures.event 可以为空；待定赛程独立展示；用官方 FDR 起步 | app/round-fixtures.tsx、lib/fixture-difficulty.ts |
| 自建进攻/防守赛程难度 | 方法可迁移，数据和参数需验证 | 需球队逐场 xG/xGA；官方球队强度与 FDR 可先用，不能冒充自建 xG 模型 | lib/fixture-difficulty.ts |
| 球队场均表、近五场 W/D/L | 足球统计可复用 | 从完赛赛程重算进失球、胜平负；去掉 EFL 球队 Fantasy 得分 | app/team-stats-table.tsx、lib/dashboard-data.ts |
| 球员推荐、预期得分、低持有率榜 | 展示可复用，计分和预测重做 | 独立 FPL 模型，含分钟、进球助攻、零封、扑救、bonus、防守贡献；先做描述统计 | lib/dashboard-data.ts、app/dashboard.tsx |
| 七人推荐阵容、选球队得分 | 不直接迁移 | FPL 若做组队，需独立预算/15人名单/11人首发/俱乐部人数限制/队长替补规则 | lib/dashboard-data.ts 的 startingSeven、lib/fixture-difficulty.ts 的 expectedTeamPoints |
| 定位球名单 | 表格结构可复用 | 官方提供点球、角球/间接任意球、直接任意球顺位；不等同确定主罚或出场 | app/set-piece-table.tsx |
| 中文新闻和风险提示 | 处理流程可复用，来源和规则需重做 | 官方 news/status 先展示；中文摘要与原始事实分开，替换 EFL 姓名和文章规则 | scripts/enrich-news.mjs |
| 每日抓取与 GitHub Pages 发布 | 托管和流程可复用 | EFL/FPL 各自验证、缓存和更新时间；在现有定时任务中增加 FPL | .github/workflows/pages.yml、pages.vite.config.ts |

## 官方 FPL 数据实际核查

本次实际请求成功：bootstrap-static、fixtures、一个有出场球员的 element-summary，以及已核实 GW1 的 live（包含 stats 和按 fixture 拆分的 explain）。bootstrap 返回 20 队、667 名球员、38 个 GW；fixtures 返回 380 场。这些是本次接口快照数量，不是永久常量。球员逐场字段只抽查了一个球员，并非全量覆盖和数据质量验收。

官方来源：

- [bootstrap-static](https://fantasy.premierleague.com/api/bootstrap-static/)：球员、球队、GW、阵容约束与计分配置。
- [fixtures](https://fantasy.premierleague.com/api/fixtures/)：逐场赛程、比分、GW 归属、主客场难度。
- `https://fantasy.premierleague.com/api/element-summary/{player_id}/`：逐场历史、后续赛程、过去赛季汇总。
- `https://fantasy.premierleague.com/api/event/{gw}/live/`：stats/explain 用于轮次统计与得分拆分；本次抽查 GW1 请求成功，实施时还需验证双赛等边界。
- [当季官方计分说明](https://www.premierleague.com/en/news/2174909/)；规则应按赛季保存，并考虑 event overrides，不能永久写死。

这些公开 JSON 端点应视为可能变化的数据结构：保留原始快照、校验字段和类型，不把现有响应当永久 API 合约。由构建任务抓取，再向浏览器提供本站 JSON；无需让浏览器全量请求官方接口。

### 官方即可支撑

分钟、首发、进球、助攻、零封、扑救、总分、bonus、BPS、xG、xA、xGI、球员在场 xGC、价格、当前持有率、转入转出、状态和新闻、定位球顺位，以及部分防守统计。金额用 now_cost / ui_currency_multiplier 展示，保留原始整数用于计算。

逐场数据可计算最近 N 场、出场场均、每90分钟、首发率、防守贡献达标率等。出场场均的分母取分钟大于零的场次；每90分钟用同一来源的分子与分钟。GW 双赛不能算一次出场。官方 points_per_game、form 的定义不能与本站自定义最近 N 场统计混称。

### 还需补充或重新定义

- 射门、射正、传中、成功过人、关键传球和部分对抗/传球指标不在本次核查的基础及逐场字段中。需要验证其他数据源，缺失时隐藏或留空。
- clearances_blocks_interceptions 是合并数据，不能拆成独立解围、封堵、拦截。防守贡献次数、达标场次和得到的 Fantasy 分必须分别命名。
- 不可把所有球员 expected_goals_conceded 相加当球队 xGA；球员在场时间重叠。球队 xG/xGA 应使用经验证的球队/比赛级数据源。
- 官方球员 xA 与第三方 xA 不保证同定义；Fantasy 助攻与模型预期助攻也不是同一统计。图表要标来源。
- 当前 selected_by_percent 是全体持有率，不是 top10k 持有率或有效持有率 EO。
- 官方 ep_next/ep_this 可作为标注清楚的官方参考字段；不能称为本站预测或把缺失当零。
- 历史球员比赛结果通常可追溯，但赛前价格、持有率、状态、名单归属和预测要单独归档。过去 GW 不用今天的数据补成当时已知数据。

## 双模块结构

建议首版继续采用现有 Vite 多入口：

| 地址（相对于现有站点根目录） | 页面 |
| --- | --- |
| index.html | 现有 EFL 首页，地址不变 |
| personal.html | 现有 EFL 球员页，地址不变 |
| fpl.html | FPL 首页 |
| fpl-personal.html | FPL 球员页 |

左上角共用 GameSwitcher，显示 EFL / FPL 及当前选中项。个人页切换到另一系统个人页，但清除不相干的 player ID；GW 默认回到目标系统当前轮，不能假设两边 GW 编号表示同一个日期。各模块保存自己的筛选状态；直接打开、刷新、前进后退均由 URL 确定系统。保留现有 /fantasy-efl-dashboard/ 部署前缀。

建议新增文件（实施时再创建）：

- app/game-switcher.tsx：首页与个人页共用切换。
- app/fpl-dashboard.tsx、pages/fpl.html、pages/fpl.tsx：独立入口。
- pages/fpl-personal.html、pages/fpl-personal.tsx：个人页入口。
- lib/fantasy-types.ts：提取通用数据类型，避免前端类型依赖含 cloudflare:workers 与 EFL 计算的文件。
- lib/fpl/adapter.ts、lib/fpl/metrics.ts、lib/fpl/scoring.ts：FPL 数据映射、指标和当季计分。
- scripts/generate-fpl-data.mjs：采集、验证和输出。
- data/fpl/、public/fpl/：按系统及赛季隔离快照与历史资产。

需要渐进修改 app/dashboard.tsx、app/personal-data.tsx、lib/player-profile.ts 等，把图表/表格和指标配置分开；pages.vite.config.ts 增加入口，构建命令和工作流接入新生成脚本。不要直接复制整份 dashboard.tsx 后长期维护两套。

通用层保留 player/team/fixture、league/season、source、capturedAt、metrics；原始 EFL/FPL ID 在各系统内使用，缓存与本地存储键加 game + season，防止同号串数据。不用 EFL 的 competitionId=10/11/12 冒充 FPL 联赛。可用指标按 capabilities 控制，缺失用 null，不为通过现有 Record<StatKey, number> 类型而填零。

## 实施顺序

1. 双入口和左上角切换；FPL 官方采集与字段验证；接通球员场均表、散点图、个人画像、官方赛程矩阵。增加价格、xG/xA/xGI、持有率和定位球信息。此阶段即可在一个网站分析两个系统。
2. 逐场历史、近 N 场、GW 回顾、价格/持有率快照和转会趋势；补充所需第三方动作数据与球队 xG。当前转入转出可直接展示，变化趋势需从现在开始留存。
3. 独立开发并回测 FPL 预期得分、队长榜、预算阵容；进一步做个人阵容和转会规划时再引入 entry ID 和用户状态。

推荐第一阶段先完成可用分析。预测质量、自动选队与转会优化是额外工作，不能用 EFL 现有分数替换标签后上线。

## 验收与发布边界

- 保留 EFL 现有测试；新增验证 FPL 字段映射、零值/缺失、逐场场均与每90分钟分母、空轮/双赛、延期赛程和结算状态。
- 有计分拆分时，用官方已核实比赛的 explain/total_points 对照，包含防守贡献门槛、bonus、零封及分钟规则。
- 同一数字 player ID 在两系统不能相互打开档案；GW、筛选和缓存不能串用。
- 手机与桌面验证切换、深链刷新、搜索分页、图表交互和 PNG 导出；浏览器只下载当前模块的数据。
- 每个来源保留实际抓取时间和失败提示。FPL 抓取失败只允许使用同赛季、已验证的旧快照；首次失败应明确不可用。工作流应明确是否发布旧 FPL 数据，不能静默生成空列表或连带清空 EFL 数据。
- 每日快照可以继续用于研究；若未来要求临近截止或比赛中更新，再调整采集频率或增加服务端。当前架构不能承诺实时。

本次只新增此评估文档，未修改现有业务代码、数据、发布配置，也未提交或部署。
