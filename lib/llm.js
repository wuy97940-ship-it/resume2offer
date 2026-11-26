/* resume2offer - llm.js
 * BYO key LLM 客户端：OpenAI 兼容端点，key 只存 localStorage，永不上传。
 * CORS 被拦时给出可执行的指引（自部署 worker/proxy.js）。
 */
(function () {
  'use strict';

  const R2O = (window.R2O = window.R2O || {});

  const PRESETS = {
    deepseek: {
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      keyUrl: 'https://platform.deepseek.com/api_keys'
    },
    zhipu: {
      label: '智谱GLM',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4-flash',
      keyUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys'
    },
    kimi: {
      label: 'Kimi',
      baseUrl: 'https://api.moonshot.cn/v1',
      model: 'moonshot-v1-8k',
      keyUrl: 'https://platform.moonshot.cn/console/api-keys'
    },
    custom: {
      label: '自定义 OpenAI 兼容端点',
      baseUrl: '',
      model: '',
      keyUrl: ''
    }
  };

  const STORE_KEY = 'r2o_llm_settings';

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || null;
    } catch (e) {
      return null;
    }
  }

  function saveSettings(s) {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  function clearSettings() {
    localStorage.removeItem(STORE_KEY);
  }

  async function chat(settings, messages) {
    if (!settings || !settings.apiKey) {
      throw new Error('NO_KEY');
    }
    const base = (settings.baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new Error('NO_BASE');
    let requestUrl = base + '/chat/completions';
    if (settings.proxyUrl) {
      requestUrl = settings.proxyUrl.replace(/\/+$/, '') + '?target=' + encodeURIComponent(requestUrl);
    }
    let resp;
    try {
      resp = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + settings.apiKey
        },
        body: JSON.stringify({
          model: settings.model,
          messages: messages,
          temperature: 0.3,
          stream: false
        })
      });
    } catch (err) {
      // fetch 抛 TypeError 基本就是 CORS 或网络不通
      const e = new Error('CORS_OR_NETWORK');
      e.cause = err;
      throw e;
    }
    if (!resp.ok) {
      let msg = 'HTTP ' + resp.status;
      try {
        const j = await resp.json();
        if (j.error && j.error.message) msg += ' ' + j.error.message;
      } catch (e) {
        /* ignore */
      }
      const e2 = new Error('HTTP_' + msg);
      e2.status = resp.status;
      throw e2;
    }
    const data = await resp.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('EMPTY_RESPONSE');
    return text;
  }

  function friendlyError(err) {
    const msg = err && err.message ? err.message : '';
    if (msg.indexOf('401') !== -1) {
      return 'API Key 无效或已欠费，请到服务商控制台检查。';
    }
    switch (msg) {
      case 'NO_KEY':
        return '还没有填 API Key。点右上角「AI 设置」填写，key 只保存在你自己的浏览器里。';
      case 'NO_BASE':
        return 'API 地址为空。';
      case 'CORS_OR_NETWORK':
        return '请求被浏览器跨域拦截或网络不通。DeepSeek/Kimi 可直连；其他服务商请部署仓库 worker/ 目录的免费代理模板，再把代理地址填进「AI 设置」。';
      default:
        return '调用失败：' + (msg || '未知错误');
    }
  }

  R2O.llm = {
    PRESETS,
    loadSettings,
    saveSettings,
    clearSettings,
    chat,
    friendlyError,

    /** 解析模型输出 JSON（容错：剥 ```json 围栏） */
    parseJSON(text) {
      let t = (text || '').trim();
      const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) t = fence[1].trim();
      const start = t.indexOf('{');
      const end = t.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('模型没有返回 JSON：' + t.slice(0, 80));
      return JSON.parse(t.slice(start, end + 1));
    }
  };
})();
