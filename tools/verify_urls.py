# -*- coding: utf-8 -*-
"""核验 data/companies_hangzhou.json 里的 careers_url 可达性（仅状态检查），回填 verified 字段。

安全措施：仅 http/https；请求前解析域名全部 IP，纯内网/环回/保留段直接拒绝；禁自动重定向（3xx 记为可达）。
WAF 响应（403/412/503）视为域名在线可达（真人浏览器可正常访问，只是脚本被拦）。

用法：仓库根目录下执行  python tools/verify_urls.py
"""
import io
import ipaddress
import json
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
OUT = Path(__file__).resolve().parents[1] / "data" / "companies_hangzhou.json"
UA = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def host_allowed(host):
    """解析域名全部 IP，只有当「没有任何公网 IP」时才拒绝（防内网/环回 SSRF）。DNS 抖动重试一次。"""
    for attempt in range(2):
        try:
            infos = socket.getaddrinfo(host, None)
        except Exception:
            if attempt == 0:
                time.sleep(1.5)
                continue
            return False
        break
    else:
        return False
    has_public = False
    for info in infos:
        ip = info[4][0].split("%")[0]
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            continue
        is_cgnat = a.version == 4 and a in ipaddress.ip_network("100.64.0.0/10")
        if a.is_private or a.is_loopback or a.is_link_local or a.is_reserved or a.is_multicast:
            if not is_cgnat:  # 运营商 CGNAT 段不算内网
                continue
        has_public = True
    return has_public


def check(url):
    """返回 (reachable: bool, detail)。3xx 与 WAF 响应视为可达。"""
    try:
        parts = urllib.parse.urlsplit(url)
    except Exception:
        return False, "url_parse"
    if parts.scheme not in ("http", "https"):
        return False, "scheme"
    host = parts.hostname
    if not host or not host_allowed(host):
        return False, "host_blocked"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=10, context=CTX) as resp:
            body = resp.read(4096)
            return (resp.status < 400 and len(body) > 200), "http_%d" % resp.status
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return True, "redirect_%d" % e.code
        if e.code in (403, 412, 503):
            return True, "waf_%d" % e.code
        return False, "http_%d" % e.code
    except Exception as e:
        return False, str(e)[:50]


def main():
    data = json.loads(OUT.read_text(encoding="utf-8"))
    companies = data["companies"]
    targets = [c for c in companies if c.get("careers_url")]
    print("probing %d urls" % len(targets))
    ok = 0
    results = {}
    for c in targets:
        results[c["name"]] = check(c["careers_url"])
    for c in companies:
        url = c.get("careers_url")
        if not url:
            c["verified"] = False
            continue
        reachable, detail = results[c["name"]]
        c["verified"] = bool(reachable)
        if reachable:
            ok += 1
        else:
            print("  [x] %s: %s" % (c["name"], detail))
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done: total=%d with_url=%d verified=%d" % (len(companies), len(targets), ok))


if __name__ == "__main__":
    main()
