# resume2offer · 简历到官网投递，一站直达

> 把粗略简历变成结构化简历 + 推荐公司清单，**落脚点永远是官网投递入口**。
> 纯前端、零依赖、数据不出本地。v1 深耕杭州（250 家公司数据库）。

![License](https://img.shields.io/badge/license-MIT-green) ![python](https://img.shields.io/badge/前端-纯静态-blue) ![data](https://img.shields.io/badge/公司数据-250家-orange)

## 为什么做这个

投岗位的最后一步，永远卡在「找不到官网投递入口」：招聘平台信息很全，但落脚点是平台本身；上市公司官网入口分散，一家家找非常费时。

resume2offer 把这条链路接通：**简历 → 岗位方向 → 推荐公司 → 官网投递入口**。招聘平台（BOSS/猎聘）只作为带关键词的交叉搜索跳转，不抓取任何平台数据。

## 三步用法

1. **选方向**：城市 + 优先区域（滨江/萧山/西湖…）+ 岗位方向
2. **填简历**：引导式问答（做了什么/角色/数字/难点/结果）或直接粘贴全文
3. **看结果**：结构化简历（可打印 PDF）+ 匹配公司清单，每家带「官网投递 ↗」按钮

不填 API Key 也能用完整流程（结构化模板 + 可解释的规则匹配）；填 Key 解锁 AI 逐段改写。

## 在线使用 / 本地运行

- **在线版**：见 GitHub 仓库描述页置顶链接（ZCode Sites 免费托管，纯静态）
- **本地运行**：

```bash
git clone https://github.com/wuy97940-ship-it/resume2offer.git
cd resume2offer
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000
```

（直接双击 index.html 会因浏览器安全策略加载不了数据文件，请务必用本地服务器。）

## AI 增强（可选，BYO Key）

key 只存你自己的浏览器 localStorage，无任何服务器经手。

| 服务商 | 浏览器直连 | 说明 |
|---|---|---|
| DeepSeek | ✅ 实测可用 | `deepseek-chat` |
| Kimi(月之暗面) | ✅ 实测可用 | `moonshot-v1-8k` |
| 智谱GLM | ⚠️ 需代理 | 部署下方 Worker 代理即可 |
| OpenAI 兼容端点 | 自测 | 设置里选「自定义」 |

被 CORS 拦截的服务商：部署 `worker/proxy.js`（Cloudflare Worker 免费额度，5 分钟），目标主机白名单硬编码，详见文件头注释。

## 数据库（项目核心资产）

`data/companies_hangzhou.json`：**250 家杭州公司**（来源：同花顺问财「注册地杭州 A 股上市公司」+ 人工策划的非上市龙头），43 家已核验官网招聘入口，按区分布：滨江 52 / 萧山 30 / 西湖 28 / 余杭 27 / 拱墅 23 / 上城 23 / 临平 21 / 钱塘 18 / 其他 28。

字段结构与贡献方式见 [docs/schema.md](docs/schema.md) 与 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)。

## 设计边界（刻意不做）

- **不抓取招聘平台数据**：反爬与平台条款风险，且时效性差；官网入口由社区维护更可靠
- **不做账号与服务端存储**：简历和 key 全程本地
- **不代投**：只把你送到官网投递入口，提交动作永远是你自己的

## 目录结构

```
├── index.html / app.js / style.css    # 单页应用，无构建工具
├── lib/                               # matcher(规则匹配) deeplink(跳转) resume(简历模型) llm(BYO key)
├── data/companies_hangzhou.json       # 核心资产：公司→官网招聘入口
├── data/taxonomy.json                 # 岗位方向/技能/证书词表
├── worker/proxy.js                    # 可选 Cloudflare Worker CORS 代理模板
└── docs/                              # 数据 schema 与贡献指南
```

## License

MIT
