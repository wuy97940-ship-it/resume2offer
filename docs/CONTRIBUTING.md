# 贡献指南

欢迎补充你熟悉公司的官网招聘入口——这是本项目最有价值的资产。

## 补一条公司数据

1. `data/companies_hangzhou.json` 的 `companies` 数组里加一条（字段见 [schema.md](schema.md)）
2. `careers_url` 必须是**公司自有域名**的招聘页，不要填招聘平台的落地页
3. 提交 PR 前自己在浏览器里点开确认一次（能打开、确实是招聘入口）
4. `verified` 字段不用手填，维护者会跑核验脚本统一回填

## 核验工具（可选）

```bash
python tools/verify_urls.py   # 探测全部 careers_url 可达性，回填 verified
python tools/gen_companies.py # 从问财名单合并生成（维护者用）
```

## 其他欢迎的 PR

- 新城市数据文件（`data/companies_<city>.json` + taxonomy 里加城市码）
- 岗位方向词表补充（`data/taxonomy.json`）
- 匹配算法改进（`lib/matcher.js`，保持可解释性）
- Bug 修复与移动端体验

## 不接受

- 抓取招聘平台数据的代码（平台条款与反爬风险）
- 任何把用户简历/Key 上传到服务器的改动
