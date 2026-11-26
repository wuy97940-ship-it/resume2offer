/* resume2offer - app.js
 * 主应用：三步流程（选方向 → 填简历 → 看结果），纯前端零依赖。
 * 数据在本地：草稿与 AI 设置存 localStorage，永不上传。
 */
(function () {
  'use strict';

  const R2O = window.R2O;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const state = {
    step: 1,
    loading: true,
    loadError: '',
    taxonomy: null,
    companies: [],
    profile: R2O.resume.emptyProfile(),
    results: [],
    rewritten: {}, // 经历下标 -> {rewritten, questions}
    aiBusy: false
  };

  const DRAFT_KEY = 'r2o_profile_draft';

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state.profile));
    } catch (e) { /* 忽略 */ }
  }

  function loadDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  /* ---------------- 步骤导航 ---------------- */

  function goStep(n) {
    state.step = n;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- Step 1 ---------------- */

  function toggleArrayItem(arr, v) {
    const i = arr.indexOf(v);
    if (i === -1) arr.push(v);
    else arr.splice(i, 1);
  }

  function renderStep1() {
    const t = state.taxonomy;
    const citySel = $('#city-select');
    citySel.innerHTML = Object.keys(t.cities)
      .map((c) => '<option value="' + c + '">' + c + '</option>')
      .join('');
    citySel.value = state.profile.targetCity;

    $('#district-chips').innerHTML = t.cities['杭州'].districts
      .map((d) => chip('district', d, state.profile.districts.includes(d)))
      .join('');
    $('#category-chips').innerHTML = t.job_categories
      .map((c) => chip('cat', c.label, state.profile.categories.includes(c.id), c.id))
      .join('');
  }

  function chip(cls, label, active, val) {
    return (
      '<button type="button" class="chip ' + cls + (active ? ' active' : '') + '" data-v="' + (val !== undefined ? val : label) + '">' +
      label +
      '</button>'
    );
  }

  /* ---------------- Step 2 ---------------- */

  function renderStep2() {
    const p = state.profile;
    $('#basic-name').value = p.name || '';
    $('#basic-years').value = p.years || '';
    $('#basic-degree').value = p.degree || '';
    $('#basic-school').value = p.school || '';

    if (!p.experiences.length) p.experiences.push(R2O.resume.emptyExperience());

    const box = $('#exp-box');
    box.innerHTML = p.experiences
      .map((e, i) => {
        const fields = R2O.resume.GUIDE_QUESTIONS.map((q) => {
          const v = e[q.id] || '';
          const isArea = q.id === 'what' || q.id === 'insight';
          return (
            '<label class="exp-field"><span>' + q.label + '</span>' +
            (isArea
              ? '<textarea data-exp="' + i + '" data-f="' + q.id + '" placeholder="' + q.hint + '">' + escHtml(v) + '</textarea>'
              : '<input data-exp="' + i + '" data-f="' + q.id + '" placeholder="' + q.hint + '" value="' + escHtml(v) + '">') +
            '</label>'
          );
        }).join('');
        return (
          '<div class="exp-card" data-idx="' + i + '">' +
          '<div class="exp-head"><b>经历 ' + (i + 1) + '</b>' +
          (p.experiences.length > 1 ? '<button type="button" class="link danger" data-del-exp="' + i + '">删除</button>' : '') +
          '</div>' + fields + '</div>'
        );
      })
      .join('');

    $('#skill-chips').innerHTML = state.taxonomy.skills
      .map((s) => chip('kw', s, p.skills.includes(s)))
      .join('');
    $('#cert-chips').innerHTML = state.taxonomy.certificates
      .map((s) => chip('kw', s, p.certs.includes(s))
      ).join('');

    $('#paste-text').value = p.resumeText || '';
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------------- Step 3: 简历预览 ---------------- */

  function renderStep3() {
    renderResume();
    renderResults();
  }

  function renderResume() {
    const r = R2O.resume.build(state.profile);
    const settings = R2O.llm.loadSettings();
    const aiBar =
      '<div class="ai-bar">' +
      (settings
        ? '<span>已配置 AI（' + escHtml(settings.label || '自定义端点') + '）</span>'
        : '<span>未配置 AI：仅可用结构化模板与匹配；<button type="button" class="link" id="open-settings-2">填写 API Key 解锁 AI 改写</button></span>') +
      '</div>';
    $('#ai-bar-slot').innerHTML = aiBar;

    $('#resume-paper').innerHTML =
      '<div class="resume-head"><h1>' + escHtml(r.head.name) + '</h1><p>' + escHtml(r.head.line1) + '</p></div>' +
      r.experiences
        .map((e, i) => {
          const rw = state.rewritten[i];
          const bullets = rw
            ? rw.rewritten.split('\n').filter(Boolean).map((b) => '<li>' + escHtml(b.replace(/^[-•]\s*/, '')) + '</li>').join('')
            : e.bullets.filter(Boolean).map((b) => '<li>' + escHtml(b) + '</li>').join('');
          return (
            '<section class="resume-exp">' +
            '<div class="exp-title"><h2>' + escHtml(e.org) + '</h2><span>' + escHtml(e.role) + '</span></div>' +
            '<ul>' + (bullets || '<li>（待填写）</li>') + '</ul>' +
            (rw
              ? '<div class="rw-questions">' + rw.questions.map((q) => '<p>追问：' + escHtml(q) + '</p>').join('') + '</div>'
              : '') +
            '</section>'
          );
        })
        .join('') +
      ((r.skills.length || r.certs.length)
        ? '<section class="resume-skills"><h2>技能与证书</h2><p>' +
          escHtml(r.skills.concat(r.certs).join(' · ')) +
          '</p></section>'
        : '');

    // 每段经历下的 AI 改写按钮（不进打印）
    const btns = r.experiences
      .map((e, i) => {
        const done = state.rewritten[i];
        return (
          '<div class="rewrite-row" data-rewrite-row="' + i + '">' +
          '<button type="button" class="btn ghost sm" data-rewrite="' + i + '">' +
          (done ? '重新 AI 改写经历 ' + (i + 1) : 'AI 改写经历 ' + (i + 1)) +
          '</button>' +
          (done ? '<span class="ok">已改写</span>' : '') +
          '</div>'
        );
      })
      .join('');
    $('#rewrite-rows').innerHTML = btns;
    $('#resume-actions').innerHTML =
      '<button type="button" class="btn ghost" data-act="copy-md">复制 Markdown</button>' +
      '<button type="button" class="btn ghost" data-act="print">打印 / 存 PDF</button>' +
      '<button type="button" class="btn ghost" data-act="back2">重新调整</button>';
  }

  /* ---------------- Step 3: 推荐公司 ---------------- */

  function renderResults() {
    const list = state.results;
    if (!list.length) {
      $('#company-list').innerHTML =
        '<p class="empty">没有匹配到公司：试试多勾几个岗位方向，或在简历里多写具体业务关键词。</p>';
      return;
    }
    $('#company-list').innerHTML = list
      .map((item, rank) => {
        const c = item.company;
        const badge = c.verified
          ? '<span class="badge ok">官网已核验</span>'
          : '<span class="badge warn">入口待核验</span>';
        return (
          '<div class="company-card">' +
          '<div class="cc-head"><b>' + (rank + 1) + '. ' + escHtml(c.name) + '</b>' + badge + '</div>' +
          '<div class="cc-meta">' + escHtml(c.district) + ' · ' + escHtml(c.industry) + (c.note ? ' · ' + escHtml(c.note) : '') + '</div>' +
          '<div class="cc-reasons">' + item.reasons.map((r) => '<span class="reason">' + escHtml(r) + '</span>').join('') + '</div>' +
          '<div class="cc-actions">' +
          '<a class="btn primary" href="' + R2O.deeplink.careers(c) + '" target="_blank" rel="noopener">官网投递 ↗</a>' +
          '<a class="btn ghost" href="' + R2O.deeplink.boss(c) + '" target="_blank" rel="noopener">BOSS</a>' +
          '<a class="btn ghost" href="' + R2O.deeplink.liepin(c.name) + '" target="_blank" rel="noopener">猎聘</a>' +
          '</div>' +
          (c.search_tip ? '<div class="cc-tip">提示：' + escHtml(c.search_tip) + '</div>' : '') +
          '</div>'
        );
      })
      .join('');

    // 顶部按首选方向给一条交叉搜索
    const firstCat = state.profile.categories[0];
    const catObj = firstCat && state.taxonomy.job_categories.find((c) => c.id === firstCat);
    $('#cross-search').innerHTML = catObj
      ? '按方向交叉搜索：<a target="_blank" rel="noopener" href="' + R2O.deeplink.bossKeyword(catObj.label, state.profile.targetCity) + '">BOSS「' + escHtml(catObj.label) + '·杭州」</a> · ' +
        '<a target="_blank" rel="noopener" href="' + R2O.deeplink.liepinKeyword(catObj.label) + '">猎聘「' + escHtml(catObj.label) + '」</a>'
      : '';
  }

  /* ---------------- 生成 ---------------- */

  function generate() {
    const p = state.profile;
    // 粘贴模式：全文作为匹配文本；结构化模式：拼接表单内容
    const structured = p.experiences
      .map((e) => [e.org, e.role, e.what, e.metrics, e.insight, e.result].join(' '))
      .join(' ');
    const pasted = ($('#paste-text').value || '').trim();
    p.resumeText = pasted || structured;

    if (!p.resumeText && !p.categories.length) {
      alert('先选至少一个岗位方向，或填写一点简历内容');
      return;
    }

    state.results = R2O.matcher.rank(p, state.companies, state.taxonomy);
    saveDraft();
    goStep(3);
  }

  /* ---------------- AI 改写 ---------------- */

  async function rewriteExperience(idx) {
    const p = state.profile;
    const e = p.experiences[idx];
    if (!e) return;
    const settings = R2O.llm.loadSettings();
    if (!settings || !settings.apiKey) {
      openSettings();
      return;
    }
    state.aiBusy = true;
    setAiBusy(true);
    const userMsg =
      '简历片段：\n' +
      '公司/项目：' + (e.org || '（未填）') + '\n' +
      '角色：' + (e.role || '（未填）') + '\n' +
      '做了什么：' + (e.what || '（未填）') + '\n' +
      '数字：' + (e.metrics || '（未提供）') + '\n' +
      '难点与判断：' + (e.insight || '（未提供）') + '\n' +
      '结果：' + (e.result || '（未提供）');
    try {
      const raw = await R2O.llm.chat(settings, [
        { role: 'system', content: R2O.resume.REWRITE_SYSTEM },
        { role: 'user', content: userMsg }
      ]);
      const out = R2O.llm.parseJSON(raw);
      state.rewritten[idx] = {
        rewritten: String(out.rewritten || ''),
        questions: Array.isArray(out.questions) ? out.questions.map(String) : []
      };
      renderResume();
    } catch (err) {
      alert(R2O.llm.friendlyError(err));
    } finally {
      state.aiBusy = false;
      setAiBusy(false);
    }
  }

  function setAiBusy(b) {
    $$('[data-rewrite]').forEach((btn) => (btn.disabled = b));
    const bar = $('.ai-bar');
    if (bar) bar.classList.toggle('busy', b);
  }

  /* ---------------- AI 设置弹窗 ---------------- */

  function openSettings() {
    const s = R2O.llm.loadSettings() || { preset: 'deepseek', baseUrl: '', apiKey: '', model: '', proxyUrl: '' };
    $('#preset-select').innerHTML = Object.keys(R2O.llm.PRESETS)
      .map((k) => '<option value="' + k + '">' + R2O.llm.PRESETS[k].label + '</option>')
      .join('');
    applyPreset(s.preset || 'deepseek');
    if (s.preset === 'custom') {
      $('#llm-base').value = s.baseUrl || '';
      $('#llm-model').value = s.model || '';
    }
    $('#llm-key').value = s.apiKey || '';
    $('#llm-proxy').value = s.proxyUrl || '';
    $('#settings-modal').classList.add('open');
  }

  function applyPreset(k) {
    const p = R2O.llm.PRESETS[k];
    if (!p) return;
    $('#preset-select').value = k;
    $('#llm-base').value = p.baseUrl;
    $('#llm-model').value = p.model;
    $('#llm-keyurl').href = p.keyUrl || '#';
    $('#llm-keyurl').style.display = p.keyUrl ? '' : 'none';
  }

  function saveSettings() {
    const preset = $('#preset-select').value;
    const s = {
      preset,
      label: R2O.llm.PRESETS[preset].label,
      baseUrl: $('#llm-base').value.trim() || R2O.llm.PRESETS[preset].baseUrl,
      model: $('#llm-model').value.trim() || R2O.llm.PRESETS[preset].model,
      apiKey: $('#llm-key').value.trim(),
      proxyUrl: $('#llm-proxy').value.trim()
    };
    R2O.llm.saveSettings(s);
    closeModal();
    renderResume(); // 刷新 AI 状态条
  }

  function closeModal() {
    $('#settings-modal').classList.remove('open');
  }

  /* ---------------- 导出 ---------------- */

  function copyMd() {
    const md = R2O.resume.toMarkdown(state.profile);
    navigator.clipboard.writeText(md).then(
      () => toast('已复制 Markdown'),
      () => {
        // 兜底：老浏览器 / 非安全上下文
        const ta = document.createElement('textarea');
        ta.value = md;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        toast('已复制 Markdown');
      }
    );
  }

  function downloadMd() {
    const blob = new Blob([R2O.resume.toMarkdown(state.profile)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.profile.name || 'resume') + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    // chips（事件委托）
    document.addEventListener('click', (ev) => {
      const chipEl = ev.target.closest('.chip');
      if (chipEl) {
        const cls = chipEl.classList.contains('district') ? 'districts' : chipEl.classList.contains('cat') ? 'categories' : null;
        if (cls === 'districts') toggleArrayItem(state.profile.districts, chipEl.dataset.v);
        if (cls === 'categories') toggleArrayItem(state.profile.categories, chipEl.dataset.v);
        if (chipEl.classList.contains('kw')) {
          const v = chipEl.dataset.v;
          const inSkills = state.taxonomy.skills.includes(v);
          const inCerts = state.taxonomy.certificates.includes(v);
          if (inSkills) toggleArrayItem(state.profile.skills, v);
          if (inCerts) toggleArrayItem(state.profile.certs, v);
          // 词表重叠时两边都试（同名互斥不存在）
        }
        chipEl.classList.toggle('active');
        saveDraft();
        return;
      }

      const del = ev.target.closest('[data-del-exp]');
      if (del) {
        state.profile.experiences.splice(Number(del.dataset.delExp), 1);
        state.rewritten = {};
        renderStep2();
        saveDraft();
        return;
      }

      const addBtn = ev.target.closest('#add-exp');
      if (addBtn) {
        state.profile.experiences.push(R2O.resume.emptyExperience());
        renderStep2();
        saveDraft();
        return;
      }

      const rw = ev.target.closest('[data-rewrite]');
      if (rw) {
        rewriteExperience(Number(rw.dataset.rewrite));
        return;
      }

      const act = ev.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'copy-md') copyMd();
        if (a === 'print') window.print();
        if (a === 'download-md') downloadMd();
        if (a === 'back2') goStep(2);
        return;
      }

      if (ev.target.closest('#open-settings') || ev.target.closest('#open-settings-2')) openSettings();
      if (ev.target.closest('#settings-close') || ev.target.closest('#modal-mask')) closeModal();
      if (ev.target.closest('#settings-save')) saveSettings();
    });

    // 表单输入
    document.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.id === 'basic-name') state.profile.name = t.value;
      else if (t.id === 'basic-years') state.profile.years = t.value;
      else if (t.id === 'basic-degree') state.profile.degree = t.value;
      else if (t.id === 'basic-school') state.profile.school = t.value;
      else if (t.dataset.exp !== undefined && t.dataset.f) {
        const i = Number(t.dataset.exp);
        const f = t.dataset.f;
        if (state.profile.experiences[i]) state.profile.experiences[i][f] = t.value;
      } else if (t.id === 'paste-text') {
        state.profile.resumeText = t.value;
      }
      saveDraft();
    });

    // AI 设置：preset 切换
    document.addEventListener('change', (ev) => {
      if (ev.target.id === 'preset-select') applyPreset(ev.target.value);
      if (ev.target.id === 'city-select') state.profile.targetCity = ev.target.value;
    });

    document.addEventListener('click', (ev) => {
      if (ev.target.closest('#btn-next1')) goStep(2);
      if (ev.target.closest('#btn-generate') || ev.target.closest('#btn-generate-paste')) generate();
      if (ev.target.closest('#btn-back1') || ev.target.closest('#btn-back1-paste')) goStep(1);

      // 填写模式切换
      const modeTab = ev.target.closest('.mode-tab');
      if (modeTab) {
        const mode = modeTab.dataset.mode;
        $$('.mode-tab').forEach((b) => b.classList.toggle('active', b === modeTab));
        $('#mode-guide').hidden = mode !== 'guide';
        $('#mode-paste').hidden = mode !== 'paste';
        return;
      }

      // 结果页 tab 切换
      const resTab = ev.target.closest('.result-tab');
      if (resTab) {
        const tab = resTab.dataset.tab;
        $$('.result-tab').forEach((b) => b.classList.toggle('active', b === resTab));
        $('#tab-resume').hidden = tab !== 'resume';
        $('#tab-jobs').hidden = tab !== 'jobs';
        return;
      }

      if (ev.target.closest('#btn-restart')) {
        if (confirm('清空当前草稿重新开始？')) {
          state.profile = R2O.resume.emptyProfile();
          state.rewritten = {};
          state.results = [];
          localStorage.removeItem(DRAFT_KEY);
          goStep(1);
        }
      }
    });

    // 打印时只打简历页
    window.addEventListener('beforeprint', () => {
      document.body.classList.add('printing');
    });
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing');
    });
  }

  /* ---------------- 渲染调度 ---------------- */

  function render() {
    $$('.step-section').forEach((s) => (s.hidden = true));
    const sec = $('#step' + state.step);
    if (sec) sec.hidden = false;

    // 步骤条
    $$('#steps-bar .step-dot').forEach((d, i) => {
      d.classList.toggle('on', i + 1 <= state.step);
    });

    if (state.step === 1) renderStep1();
    if (state.step === 2) renderStep2();
    if (state.step === 3) renderStep3();
  }

  /* ---------------- 启动 ---------------- */

  /** 兼容旧草稿：把存的中文方向标签归一成 id */
  function normalizeDraft(p, taxonomy) {
    if (!taxonomy || !p) return p;
    const labelToId = {};
    taxonomy.job_categories.forEach((c) => (labelToId[c.label] = c.id));
    p.categories = (p.categories || []).map((v) => labelToId[v] || v);
    return p;
  }

  async function init() {
    bind();
    const draft = loadDraft();
    if (draft) state.profile = Object.assign(R2O.resume.emptyProfile(), draft);
    try {
      const [tax, comps] = await Promise.all([
        fetch('data/taxonomy.json').then((r) => r.json()),
        fetch('data/companies_hangzhou.json').then((r) => r.json())
      ]);
      state.taxonomy = tax;
      state.companies = comps.companies || [];
      normalizeDraft(state.profile, state.taxonomy);
      state.loading = false;
      render();
    } catch (e) {
      state.loading = false;
      state.loadError =
        '数据加载失败（如果你是直接双击打开的 index.html，请改用本地服务器：python -m http.server，然后访问 http://127.0.0.1:8000）';
      $('#load-error').textContent = state.loadError;
      $('#load-error').hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
