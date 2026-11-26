/* resume2offer - matcher.js
 * 免 key 规则匹配引擎：关键词命中即可解释，不依赖任何 LLM。
 * 评分维度：岗位方向命中（公司词表×方向词表）+ 简历文本命中 + 区域偏好
 */
(function () {
  'use strict';

  const R2O = (window.R2O = window.R2O || {});

  function overlap(arrA, arrB) {
    const setB = new Set(arrB);
    return arrA.filter((k) => setB.has(k));
  }

  function textHas(text, kw) {
    return text && text.indexOf(kw) !== -1;
  }

  R2O.matcher = {
    /**
     * @param {Object} profile 选型结果
     *   { districts: string[], categories: string[], resumeText: string, skills: string[], certs: string[] }
     * @param {Array} companies 公司数据库
     * @param {Object} taxonomy 词表
     * @returns {Array<{company, score, reasons: string[]}>} 按分排序，最多 30 家
     */
    rank(profile, companies, taxonomy) {
      const catMap = {};
      taxonomy.job_categories.forEach((c) => (catMap[c.id] = c));
      const districtSet = new Set(profile.districts || []);
      const resumeText = (profile.resumeText || '') + ' ' + (profile.skills || []).join(' ') + ' ' + (profile.certs || []).join(' ');

      const scored = companies.map((company) => {
        let score = 0;
        const reasons = [];

        // 1) 岗位方向命中：公司词表 ∩ 方向词表
        (profile.categories || []).forEach((cid) => {
          const cat = catMap[cid];
          if (!cat) return;
          const hit = overlap(cat.keywords, company.keywords || []);
          if (hit.length) {
            score += 2 * hit.length;
            reasons.push('方向「' + cat.label + '」命中：' + hit.slice(0, 4).join('、'));
          }
        });

        // 2) 简历文本命中：简历里出现的关键词 ∩ 公司词表
        const myKws = [];
        (profile.categories || []).forEach((cid) => {
          const cat = catMap[cid];
          if (cat) myKws.push(...cat.keywords);
        });
        myKws.push(...(profile.skills || []));
        myKws.push(...(profile.certs || []));
        const resumeHits = overlap(Array.from(new Set(myKws)), (company.keywords || [])).filter((k) =>
          textHas(resumeText, k)
        );
        if (resumeHits.length) {
          score += 1.5 * resumeHits.length;
          reasons.push('简历命中：' + resumeHits.slice(0, 4).join('、'));
        }

        // 3) 区域偏好
        if (districtSet.size > 0) {
          if (districtSet.has(company.district)) {
            score += 3;
            reasons.push(company.district + ' · 优先区域');
          } else {
            score -= 1;
          }
        }

        // 4) 官网入口已核验的小加分（信息更可用）
        if (company.verified) score += 0.5;

        return { company, score, reasons };
      });

      const positive = scored.filter((s) => s.score > 0);
      positive.sort((a, b) => b.score - a.score);
      return positive.slice(0, 30);
    }
  };
})();
