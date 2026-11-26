# 数据 Schema

`data/companies_hangzhou.json` 顶层结构：

```json
{
  "version": "0.2.0",
  "city": "杭州",
  "updated": "2026-11-27",
  "source": "同花顺问财（注册地杭州A股）+ 人工策划",
  "companies": [ ... ]
}
```

## Company 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | ✅ | 公司名（含上市主体时写「XX集团(含XX智联)」这类括注） |
| `district` | string | ✅ | 注册地所在区：滨江区/萧山区/西湖区/余杭区/拱墅区/上城区/临平区/钱塘区/富阳区/临安区/桐庐县/淳安县/建德市 |
| `industry` | string | ✅ | 行业描述，建议「一级/细分」如 `计算机/网络安全` |
| `careers_url` | string\|null | 推荐 | 官网招聘入口直达 URL；null 时前端回退为「公司名 官网 招聘」搜索 |
| `search_tip` | string | 可选 | 入口页内的操作提示，如「官网顶部『加入我们』」 |
| `keywords` | string[] | ✅ | 匹配用关键词（岗位类别词+公司特有词），与 `data/taxonomy.json` 的方向词表同语言 |
| `verified` | bool | 自动 | 由 `tools/verify_urls.py` 探测回填（仅状态检查，不抓业务数据） |
| `note` | string | 可选 | 一句话备注：上市代码、行业地位、园区等 |

## keywords 语义

keywords 同时参与两个匹配：
1. 与用户勾选的「岗位方向」词表求交集 → 方向命中
2. 与用户简历全文求交集 → 简历命中

写法上用通用岗位词（开发/审计/销售/算法…）+ 该公司真实会招的岗位词，不要堆行业名词。
