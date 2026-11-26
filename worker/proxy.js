/**
 * resume2offer - 可选的 Cloudflare Worker CORS 代理模板
 *
 * 用途：当你的浏览器直连 LLM API 被跨域（CORS）拦截时，把这个 Worker 部署到
 * 你自己的 Cloudflare 账号（免费额度即可），然后把 Worker 地址填进「AI 设置」。
 *
 * 部署步骤（约5分钟）：
 *   1. 注册/登录 https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. 把本文件全部内容粘贴进编辑器，替换默认代码，Deploy
 *   3. 假设你的 Worker 域名是 https://resume2offer-proxy.<你的子域>.workers.dev
 *   4. 回到 resume2offer「AI 设置」，在「代理地址(可选)」填：
 *      https://resume2offer-proxy.<你的子域>.workers.dev
 *      （target 参数由页面自动拼接为完整上游地址）
 *
 * 安全设计：
 *   - 只允许代理 OpenAI 兼容的 chat/completions 端点
 *   - 目标主机白名单硬编码（DeepSeek/智谱/Kimi/OpenAI），可自行增删
 *   - 不缓存、不落日志，API Key 只出现在请求头里透传，不存储
 *
 * 免责声明：部署在你自己的账号下，流量与配额归你所有。
 */

const ALLOWED_TARGETS = new Set([
  "api.deepseek.com",
  "open.bigmodel.cn",
  "api.moonshot.cn",
  "api.openai.com",
  "dashscope.aliyuncs.com",
]);

export default {
  async fetch(request) {
    // 处理浏览器预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const targetParam = url.searchParams.get("target");
    if (!targetParam) {
      return textResponse(400, "missing ?target= parameter", corsHeaders());
    }

    let target;
    try {
      target = new URL(targetParam);
    } catch (e) {
      return textResponse(400, "invalid target url", corsHeaders());
    }

    if (target.protocol !== "https:") {
      return textResponse(400, "target must be https", corsHeaders());
    }
    if (!ALLOWED_TARGETS.has(target.hostname)) {
      return textResponse(403, "target host not in allowlist: " + target.hostname, corsHeaders());
    }

    // target 参数 = 完整上游地址（含 path），例如 https://api.deepseek.com/chat/completions
    const upstream = target.origin + target.pathname + target.search;

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    const auth = request.headers.get("Authorization");
    if (auth) headers.set("Authorization", auth);

    let body;
    if (request.method === "POST") {
      body = await request.text();
    }

    let resp;
    try {
      resp = await fetch(upstream, {
        method: request.method,
        headers: headers,
        body: body,
      });
    } catch (e) {
      return textResponse(502, "upstream fetch failed: " + e.message, corsHeaders());
    }

    const out = new Headers(resp.headers);
    out.set("Access-Control-Allow-Origin", "*");
    out.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    out.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    return new Response(resp.body, { status: resp.status, headers: out });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function textResponse(status, message, extra) {
  return new Response(JSON.stringify({ error: { message } }), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json" }, extra),
  });
}
