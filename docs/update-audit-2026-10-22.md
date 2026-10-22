# 2026-10-22 更新与缺失数据核查

审计日期：2026-10-22（北京时间），各源成功时间及最终审计时间记录在 JSON。统计基于本次构建的官方已结算数据，原始逐人清单见 [coverage-audit.json](../data/coverage-audit.json)。可用 `node scripts/audit-missing-data.mjs` 重新生成清单。

## 合并与发布内容

以远端 `8af29fb` 为基础合并本地 FPL：保留最新 Grand Prix GW10 积分、Statz 抓取状态诊断、可选源回退和图表缺失说明。原本的四份本地 10 月 17 日快照没有覆盖远端 10 月 22 日快照；随后本机成功刷新了公开源数据。

FPL 首页 `fpl.html`、个人页 `fpl-personal.html`、两边首页及个人页的 EFL/FPL 切换、官方采集、缓存和每日发布已经接通。FPL 页面单独请求约 1 MB 的 JSON，不载入 EFL 的数据包。

## EFL 修复结果

样本为 1,684 名有官方已结算记录的球员。下表比较本次首次重建与最终修复，变化同时包含新源快照及匹配修复，不能全部归因于姓名规则。

| 指标 | 首次重建可用 | 修复后可用 | 修复后缺失 |
| --- | ---: | ---: | ---: |
| Statz xG/90 | 1,580 | 1,659 | 25 |
| 对齐官方出场数的 Statz 进阶画像 | 1,580 | 1,659 | 25 |
| FotMob xA | 1,633 | 1,656 | 28 |

831 名至少 450 分钟的球员中，xG 和进阶画像均只剩 2 人缺失，FotMob xA 缺失为 0。英乙中场至少 450 分钟的 88 人，xG 图由 85 人可绘制提高到 88 人，缺失为 0。

修复包括：

- 统一 Milton Keynes Dons / MK Dons，恢复整队因球队名称不同而无法对齐的 xG。
- 处理 `ß/ss`、`ð/d`、`ø/o`、`ł/l` 等字形；例如 Max Weiß / Max Weiss、Andri Guðjohnsen / Andri Gudjohnsen。
- 允许同联赛、同球队中全名首词与姓氏相同、中间名不同的双向唯一匹配，例如 Pelly Ruddock Mpanzu、Christy James Pym、Mads Juel Andersen。源端或官方端存在多个候选时拒绝匹配。
- 对已核对的全名、常用名和复姓变体使用精确映射，如 Géza Dávid Turi / Géza Turi、Matthew Max Dibley-Dias / Matt Dibley-Dias、Ben Brereton Díaz / Ben Brereton、Taty / Valentín Castellanos。没有引入姓氏模糊匹配。
- 重复的规范化姓名不取第一条；保留缺失。xG 与进阶画像仍必须通过出场数一致及同源分钟检查。
- 对转会球员按官方逐场 playerId / squadId 还原新旧俱乐部，再匹配同联赛、同俱乐部的第三方记录。每段均须双向唯一且出场数一致，才合计该来源的累计分子与分钟。若当前队名下已是完整赛季总计，则只使用该行，避免重复加旧队。恢复 19 份进阶记录；对应 xG 同时用于图表和既有推荐计算。

姓名核对参考包括：[Grimsby 官方 Turi 报道](https://gtfc.co.uk/geza-turi-called-up-by-faroe-islands/)、[Fulham 球员页](https://www.fulhamfc.com/players/under-21s/matt-dibley-dias/)、[Opta Brereton 球员资料](https://theanalyst.com/players/4267/ben-brereton)、[West Ham 官方 Castellanos 球员页](https://cdn.whufc.com/en/teams/mens-team/valentin-castellanos)、[Bolton 官方 Forino 报道](https://www.bwfc.co.uk/news/vote-chris-forino-pfa-league-one-community-champion)，以及本次两源的同队球员名单。

## 仍然缺失的原因

逐场核对发现，最初至少 450 分钟样本中 9 个“出场数不同”项目，有 8 个实际来自转会前后分队统计，已经可靠补齐：

| 球员 | 官方赛季出场 | Statz 新旧队分段 |
| --- | ---: | ---: |
| Emil Riis | 7 | Bristol City 1 + Leicester 6 |
| Hamza Choudhury | 9 | Leicester 2 + Sheffield United 7 |
| Oliver Skipp | 9 | Leicester 2 + Charlton 7 |
| Brendan Wiredu | 12 | Plymouth 1 + Salford 11 |
| Filip Marschall | 7 | Stevenage 3 + Millwall 4 |
| Jayden Wareham | 9 | Exeter 2 + Wycombe 7 |
| Stanley Mills | 8 | Oxford 1 + Preston 7 |
| George Nevett | 6 | Peterborough 1 + Tranmere 5 |

仍缺失的高分钟样本只有 Joseph Opoku 和 Toti Gomes。Joseph Opoku 的官方 10 场均属于 Swansea，Statz 仅 1 场，无法通过其他球队记录补齐；可确认覆盖不一致，但无法仅凭累计页断言是漏记、滞后还是源站定义不同。未补造缺少比赛。

Toti Gomes：Statz 的同队名单没有可安全确认的对应记录。Rodrigo Gomes 是另一名球员，未以相同姓氏合并。FotMob 有 Toti 本人的独立记录，仍可用于其同源进攻指标。

全量 xG/进阶画像缺失 25 人：2 人出场数不同、23 人身份未安全匹配。另一个出场数不同者为 Gerard Garner，官方 7 场、Statz 8 场。其余低分钟未匹配名单及逐人原因均在 JSON 中。FotMob xA 缺失 28 人：27 人未安全匹配，另 1 人 Mason Melia（18 分钟）有对应记录但源端 xA 为空，保留缺失。

## FPL 数据完整性

本次成功快照：2026-10-22（具体时间见 JSON），2026-27 赛季，668 名球员、20 队、3,077 条已完赛记录。449 人有实际出场；其余 219 人没有本快照中的已完赛出场样本，不显示虚构场均或百分位。

已出场非门将记录的 xG、xA、xGI、CBI、抢断、回收球权和防守贡献均无空字段。门将不适用的防守贡献等指标显示空值。历史未归档的价格、持有率、伤停不回填；超出官方 `ep_this/ep_next` 范围的未来得分不生成预测。

## 自动更新限制与验证

本机普通公开请求成功，GitHub Actions 对 Statz 仍可能遭 Cloudflare 验证拦截。发布流程会标明源状态并保留同赛季成功快照；这次更新了被保留的快照及缓存键，但没有改变源站访问权限。持续解决需要源站提供获准 API 或允许该执行环境访问。

已验证：EFL 轮次、历史图表、数据分母、进阶画像、定位球、赛程评分、Grand Prix；FPL 字段映射、真实零值与缺失、双赛、分钟分母、防守贡献门槛、官方得分和 60 张本地图片。新增转会回归测试覆盖两联赛、逐队对齐、同源分母、已合并赛季记录不重复累加、缺少旧队及未结算比赛。浏览器检查 FPL 首页、GW7 实际分/GW8 官方预期、个人页搜索及刷新直达、PNG 导出，未发现控制台错误或损坏图片。补齐 React 类型声明并将 FPL 类型检查加入 CI。Vite 升级至同主版本的 8.3.5，依赖审计为 0 个漏洞。
