---
title: dsh-workspace-mcp:让每个项目自带自己的 MCP 配置
category:
  - DeepSeek Harness
  - MCP
date: 2026-08-14
---

前面两篇讲了 DeepSeek Harness(下称 DSH)怎么配 MCP、怎么写插件。但全局 MCP 用了一阵,我开始难受:**配置是机器级的,而需求是项目级的**。

这篇介绍我写的第一个插件 `dsh-workspace-mcp`:让 MCP 配置变成项目文件——进目录自动挂载,切走自动卸载,git clone 下来就自带。仓库在 [Momojie-S/dsh-workspace-mcp](https://github.com/Momojie-S/dsh-workspace-mcp)。

<!-- more -->

## 全局 MCP 的三个痛点

DSH 配 MCP 的原生姿势是写进 `~/.dsh/cordis.patch.yml`(或 profile 级 patch),效果是**全局生效**:每个会话、每个项目都背着同一套 MCP。

工具不多时没感觉,配到七八个 server 后问题就来了:

1. **工具列表膨胀**。每个 MCP server 注册几个到几十个工具,全部塞进每个会话的系统提示。模型选工具时被一堆当前项目用不上的项干扰,上下文也在悄悄变贵。
2. **项目专属 server 被广播**。我有个 MCP server 只服务一个游戏自动化仓库,配了全局,等于给写博客的会话也塞了一堆游戏工具。
3. **配置不可迁移**。换台机器、或者别人 clone 你的项目,MCP 怎么配得靠口头传授。

反过来看,这些问题的解法在传统工具链里早就有了:`.editorconfig`、`.vscode/settings.json`、`package.json`——**项目级的配置进仓库,跟着代码走**。MCP 配置凭什么例外?

## 心智模型

```text
全局 patch(~/...)            ← 跨项目通用的 MCP,照旧配
项目 .dsh/mcp.servers.yml    ← 只属于这个项目的 MCP,进仓库
                              两条路叠加,互不干扰
```

插件做的事:**读 session 工作目录下的 `.dsh/mcp.servers.yml#,把里面的 MCP server 注册到当前 agent;目录里没这个文件,就什么都不加载**。

会话开在项目 A,A 的 MCP 就位;切到项目 B 开新会话,B 自己的(或者没有)——互不可见。

## 用法

项目根放一个 `.dsh/mcp.servers.yml`:

```yaml
servers:
  my-server:                 # serverName = 工具名前缀 mcp__my-server__*
    transport: stdio
    command: npx
    args: ['-y', 'some-mcp-server@latest']
    env:                     # stdio server 的认证,裸值直传
      API_KEY: 'sk-xxx'
  remote:
    transport: streamable-http
    url: https://example.com/mcp
    headers:
      Authorization: 'Bearer <token>'
```

字段与官方 `@deepseek-ai/dsh-mcp-client` 对齐(`transport` / `command` / `args` / `env` / `url` / `headers` / `toolCallTimeoutMs`),会配全局 MCP就会配这个。

行为细节:

| 特性 | 说明 |
|---|---|
| 注册时机 | agent 创建即连接注册,**首个模型请求就带这些工具** |
| 卸载 | 工具注册在 agent 作用域,会话结束自动回收,不留残骸 |
| 热重载 | chokidar 监听配置文件,保存即重连 |
| 同名遮蔽 | 与全局 MCP 同 `serverName` 时**项目级赢**——把全局 server 指到本地 dev 实例调试,是刻意的正规用法 |
| 隔离 | 无此文件的目录不加载任何 MCP |

## 安装

插件做成了 DSH 组合包,一条命令:

```bash
dsh plugin --profile web add github:Momojie-S/dsh-workspace-mcp
```

重启 DSH 验证层就位:

```bash
dsh web --dump-config | Select-String workspace-mcp
```

然后随便找个项目丢个 `.dsh/mcp.servers.yml` 进去(可以先用 MCP 官方的 `server-everything` 练手),开会话让 agent 列工具——看到 `mcp__<serverName>__*` 就成了;切到没配置的目录,这些工具消失,隔离生效。

## 它是怎么做到的

一段话版本(写插件的全过程见[上一篇](/posts/deepseek/2026-08-14-dsh-plugin.html)):DSH 的每个会话是一个 agent,插件在 `agent/created` 时机拿到这个 agent 的引用,读 cwd 的配置文件,把每个 server 连接后**注册到 agent 作用域**——作用域跟着 agent 生灭,天然做到「进来自动挂、走了自动收」,不需要任何手动清理逻辑。

这也解释了为什么遮蔽语义是「项目赢」:DSH 的工具注册表里,agent 作用域的工具按名字遮蔽全局作用域的同名工具,逐工具比较。

::: warning 已知边界
headless 模式「create 后立刻发消息」的竞速场景,第一步请求可能赶不上注册(第二步必有);另外本插件目前只挂在 web profile,headless/tui 用 `--patch` 临时指一下即可。
:::

## 小结

写完这个插件,我的全局 patch 里只剩两个真正跨项目的 MCP,其它的都沉到各自仓库里了——每个会话的工具列表回到「刚好够用」的状态。

一句话总结这套思路:==MCP 配置是项目的一部分,不是机器的一部分==。工具跟着需求走,配置跟着仓库走。

> 📝 系列前作:[在 DSH 里加一个 MCP Server](/posts/deepseek/2026-08-14-dsh-mcp.html) · [给 DSH 写一个插件](/posts/deepseek/2026-08-14-dsh-plugin.html) · 姊妹篇 [dsh-workspace-env](/posts/deepseek/2026-08-14-dsh-workspace-env.html)
