---
title: 拆开 Claude Code WebFetch 的三层失败链
category:
  - Claude Code
  - 运维
date: 2026-08-04
---

用 Claude Code 的时候,想让 它帮我查个文档,结果 WebFetch 一直报一个很迷的错:

```
Error: Unable to verify if domain github.com is safe to fetch.
This may be due to network restrictions or enterprise security
policies blocking claude.ai.
```

换什么域名都一样——github、reddit、官方 docs,全挂。第一反应是「代理没开好」,开全局代理、开 Clash TUN,照样报错。折腾一圈才发现:**WebFetch 根本不是一次 fetch,里面是三步串行的调用链,在国内 + 第三方模型中转的环境下,每一步都能挂。** 这篇按调用链逐层拆开,每层都附官方文档依据。

<!-- more -->

## 调用链总览

你调一句 `WebFetch("https://example.com")`,内部实际是这样的:

```
你调 WebFetch("https://example.com")
        │
        ▼
① 预检   ── 先回连 api.anthropic.com / claude.ai
        │   问一句:"example.com 安全吗?"
        │   ↳ 国内被墙 → "Unable to verify domain"   ← 第一层挂点
        ▼
② 抓取   ── Node fetch 直连 example.com
        │   ↳ 没配代理 → ECONNREFUSED                ← 第二层挂点
        ▼
③ 小模型  ── 用 Haiku 把网页读一遍、提炼答案
        │   ↳ 中转没有 Haiku → 返回空 / 报错         ← 第三层挂点
        ▼
   返回结果
```

三层里**任何一层挂,整个 WebFetch 就废**。下面逐层拆。

## ① 预检:它先回连了 Anthropic

报错里那句 `blocking claude.ai` 不是修辞,是字面事实。WebFetch 在抓目标站**之前**,会先回连 Anthropic 的服务做一次域名安全校验。社区抓包([v2code](https://www.v2code.ai/post/claude-code-webfetch-unable-to-verify-domain))看到的请求长这样:

```
https://claude.ai/api/web/domain_info?domain=<目标域名>
```

国内 `claude.ai` / `api.anthropic.com` 被墙,这一步发不出去——**不管目标站本身能不能访问,WebFetch 直接拒绝**。这就是为什么换什么域名都报同一个错。

官方 [Enterprise network configuration](https://code.claude.com/docs/en/network-config) 文档里也确认了这一步的存在,并给出了开关:

> The WebFetch tool still calls `api.anthropic.com` for its domain safety check **unless you set `skipWebFetchPreflight: true`** in settings.

**「开全局代理 / TUN 还是报错」也在这层**——代理转发了你对目标站的请求,却没放行对 `claude.ai` 的预检请求;而且 Claude Code 认的是 `HTTPS_PROXY` 环境变量,不是系统代理设置(见第②层)。

**解法**:在 `~/.claude/settings.json` 里关掉预检——

```json
{
  "skipWebFetchPreflight": true
}
```

(理论上的另一条路是给代理放行 `api.anthropic.com`,但国内基本走不通,除非你的机场解锁了 Anthropic。)

## ② 抓取:Node fetch 不认你的系统代理

关掉预检后,报错变了——从 "Unable to verify domain" 变成:

```
connect ECONNREFUSED 128.242.245.93:443
```

进步了:预检那步过了,现在卡在实际抓取。`128.242.245.93` 是目标站的 IP,`ECONNREFUSED` 说明 WebFetch 在**直连**目标站,没走代理,被墙站直接拒绝。

根因:Claude Code 的 WebFetch 用的是 Node 的 fetch,它只认 `HTTPS_PROXY` / `HTTP_PROXY` 这类**环境变量**,不读系统代理设置。你的 Clash 开了系统代理或 TUN,Node fetch 一概不看。官方文档原话:

> Claude Code respects standard proxy environment variables. ... Claude Code uses the first one that's set in the order `https_proxy`, `HTTPS_PROXY`, `http_proxy`, `HTTP_PROXY`.

**解法**:在 settings.json 的 `env` 块里把代理塞进去,同时用 `NO_PROXY` 把模型 API 的域名排除掉(否则 API 请求也绕去代理国外,可能更慢甚至出错):

```json
{
  "env": {
    "HTTPS_PROXY": "http://127.0.0.1:7890",
    "HTTP_PROXY": "http://127.0.0.1:7890",
    "NO_PROXY": "open.bigmodel.cn,localhost,127.0.0.1,::1"
  }
}
```

`7890` 换成你自己 Clash 的端口(`netstat -ano | findstr LISTENING | findstr 127.0.0.1:` 能查到)。`NO_PROXY` 里写你的模型 API 域名,我走智谱官方兼容端点所以是 `open.bigmodel.cn`。

## ③ 小模型:网页抓到了,没人读

前两层过了之后还可能踩第三个坑:WebFetch 抓到网页后,**不用你的主模型去读**,而是调一个「小模型」(官方走 Haiku)把网页内容提炼成答案。第三方模型中转一般没有 `claude-haiku-*`,这一步就失败——表现为返回空内容,或一句"页面内容为空"。

**解法**:把小模型显式指定成中转支持的模型。两种等价写法,任选其一或都写(我是都写了,双保险):

```json
{
  "env": {
    "ANTHROPIC_SMALL_FAST_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air"
  }
}
```

`glm-4.5-air` 是智谱的快速档,对应 Haiku 的定位。换成你中转支持的轻量模型即可。

> 小提示:如果你走的是智谱官方兼容端点(`open.bigmodel.cn/api/anthropic`),按智谱文档配 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 通常就够了——它把 Claude Code 的 haiku 档位映射到 GLM 模型。`ANTHROPIC_SMALL_FAST_MODEL` 是另一条等价路径,不同版本 Claude Code 认的 env 不一样,都指向同一个模型就不会冲突。

## 配齐:完整 settings.json

三层都治好,改动汇总(都在 `~/.claude/settings.json`,**改完重启 Claude Code 生效**):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_SMALL_FAST_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "HTTPS_PROXY": "http://127.0.0.1:7890",
    "HTTP_PROXY": "http://127.0.0.1:7890",
    "NO_PROXY": "open.bigmodel.cn,localhost,127.0.0.1,::1"
  },
  "skipWebFetchPreflight": true
}
```

(省略了 token / 主模型映射等其他字段,按你自己的来。**token 别提交进 git。**)

验证:让它抓一个之前必失败的被墙站点,比如官方文档——

```
WebFetch https://code.claude.com/docs/en/scheduled-tasks
```

能返回正文,三层就全通了。

## 安全权衡:你到底关掉了什么

`skipWebFetchPreflight: true` 关掉的是 **Anthropic 对目标域名的安全校验**——之后 agent 理论上可以自主访问任意域名,包括恶意链接,不再有 Anthropic 那边的拦截。

- **手动查文档**:风险极低,你知道自己在抓什么,放心关。
- **长时间 autonomous 任务**(让 agent 自己决定抓哪些页面):建议补别的防护——限制可访问域名、在隔离环境里跑。

是否开,按使用场景权衡。我的选择是开着(我主要手动用),autonomous 场景另外加约束。

## 备选:不想动配置就绕开

WebFetch 的三层坑只卡 WebFetch 自己,别的抓取通道不经过预检。偶尔查文档,零配置绕开也行:

- **`WebSearch`**:搜索引擎,拿摘要和链接,多数查资料场景够用。
- **`mcp__web_reader__webReader`**(或类似的 web reader MCP):走独立通道抓**指定 URL** 全文,功能上最接近 WebFetch 的替代品,且不经过任何预检。

我排查这个问题的时候就全程用的这两个——一边查官方文档一边定位,反而比 WebFetch 顺手。代价是 agent 自主决定用 WebFetch 时仍然会卡,所以如果你重度依赖 agent 自主查文档,还是建议把上面三层配齐。

## 小结

WebFetch 的设计隐含两个假设:**你能直连 Anthropic 服务(做预检)**、**你有 Haiku(读网页)**。这两个假设在国内 + 第三方中转环境里都不成立,外加 Node fetch 不走系统代理,叠出三层失败链。

三层都得治,WebFetch 才通。记住调用链那张图,以后报错看在哪层,对症下药就行——

- `Unable to verify domain` → 第①层,加 `skipWebFetchPreflight`
- `ECONNREFUSED` → 第②层,配 `HTTPS_PROXY`
- 抓到了但内容空 → 第③层,配 `ANTHROPIC_SMALL_FAST_MODEL`
