/* resume2offer - resume.js
 * 简历结构化模型 + 引导问题 + Markdown 导出 + LLM 改写提示词
 */
(function () {
  'use strict';

  const R2O = (window.R2O = window.R2O || {});

  // 每段经历的引导问题（「问一些问题」的核心）
  const GUIDE_QUESTIONS = [
    { id: 'org', label: '公司 / 项目名', hint: '不确定对外展示就写「某公司」「某项目」' },
    { id: 'role', label: '你的角色（主导/参与/支持）', hint: '一句话，如「风控尽调负责人」「参与开发」' },
    { id: 'what', label: '做了什么', hint: '2-3 句话：负责什么项目/业务，具体动作' },
    { id: 'metrics', label: '有没有数字？（规模/金额/比例/频次）', hint: '如「35+单尽调」「年营收2700亿的公司」「转化率提升12%」，没有可空' },
    { id: 'insight', label: '过程中的难点与你的判断', hint: '如「识破一个隐蔽风险点并拦下」，没有可空' },
    { id: 'result', label: '结果如何？', hint: '带来的改变，如「零退回」「准点交付」「晋升」' }
  ];

  // LLM 改写的系统提示词（内置去 AI 味三条规则）
  const REWRITE_SYSTEM =
    '你是资深简历顾问。改写用户给的简历片段，遵守：' +
    '1) STAR 结构（情境-任务-行动-结果）；' +
    '2) 必须有可量化数字，没有数字就给「[待补数字]」占位并提示用户补；' +
    '3) 只用用户给的事实，不编造；' +
    '4) 去AI味：不写「赋能/抓手/闭环/助力」，用短句、动词开头；' +
    '5) 输出 JSON：{"rewritten": "改写后的要点(可多行, 用 \\n 分隔)", "questions": ["如果信息不够，给1-3个追问"]}';

  function emptyProfile() {
    return {
      name: '',
      years: '',
      degree: '',
      school: '',
      targetCity: '杭州',
      districts: [],
      categories: [],
      experiences: [],
      skills: [],
      certs: [],
      resumeText: ''
    };
  }

  function emptyExperience() {
    return { org: '', role: '', what: '', metrics: '', insight: '', result: '' };
  }

  R2O.resume = {
    emptyProfile,
    emptyExperience,
    GUIDE_QUESTIONS,
    REWRITE_SYSTEM,

    /** 组装为结构化简历数据（供预览/导出） */
    build(profile) {
      const p = profile;
      const head = {
        name: p.name || '（未填姓名）',
        line1: [p.years ? p.years + '年经验' : '', p.degree, p.school].filter(Boolean).join(' · ')
      };
      const experiences = (p.experiences || [])
        .filter((e) => e.org || e.what)
        .map((e) => {
          const bullets = [];
          if (e.what) bullets.push(e.what + (e.metrics ? '（' + e.metrics + '）' : '')); 
          if (e.insight) bullets.push(e.insight);
          if (e.result) bullets.push('结果：' + e.result);
          return { org: e.org || '（未填）', role: e.role || '', bullets };
        });
      return { head, experiences, skills: p.skills || [], certs: p.certs || [] };
    },

    /** 导出 Markdown */
    toMarkdown(profile) {
      const r = R2O.resume.build(profile);
      const lines = [];
      lines.push('# ' + r.head.name);
      if (r.head.line1) lines.push('> ' + r.head.line1);
      r.experiences.forEach((e) => {
        lines.push('');
        lines.push('## ' + e.org + (e.role ? ' · ' + e.role : ''));
        e.bullets.forEach((b) => lines.push('- ' + b));
      });
      if (r.skills.length) {
        lines.push('');
        lines.push('## 技能');
        lines.push(r.skills.join('、'));
      }
      if (r.certs.length) {
        lines.push('');
        lines.push('## 证书');
        lines.push(r.certs.join('、'));
      }
      return lines.join('\n');
    },

    /** 粘贴全文 → 简历全文（用于匹配；预览优先用结构化表单） */
    pasteTextToProfile(profile, text) {
      profile.resumeText = text;
      return profile;
    }
  };
})();
