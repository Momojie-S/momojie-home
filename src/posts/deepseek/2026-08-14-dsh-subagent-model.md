---
title: dsh-subagent-model:委派子代理时按次指定模型
category:
  - DeepSeek Harness
  - 插件
date: 2026-08-14
---

这篇介绍我的第三个 DSH 插件 `dsh-subagent-model`。它解决的问题一句话能说清:**委派子代理的时候,模型没得挑**。

内置的 `subagent` 工具只有三个参数——任务描述、提示词、要不要后台。子代理跑在哪个模型上,是插件加载时就定死的,继承父会话。可我的 Models 页里明明配了好几条路由:主会话跑在强模型上,并行 fan-out 五个调研任务,每个子代理都烧同一个贵模型;反过来,想让一个更强的模型做交叉验证,也没法指定。**路由就在那里,就是递不到模型手上。**

仓库在 [Momojie-S/dsh-subagent-model](https://github.com/Momojie-S/dsh-subagent-model)。

<!-- more -->

## 读源码发现:能力本来就在

按[系列前作](/posts/deepseek/2026-08-14-dsh-plugin.html)的方法论,先在创造模式里用 `cordis_inspect_query` 查运行时契约,再翻官方包源码。结果在 `dsh-subagent` 的 `child-agent.ts` 里看到这么一行:

```ts
agentOptions: resolveChildAgentOptions(parent, request.agentOptions, childDepth),
```

`SubagentStartRequest` 本来就带一个请求级的 `agentOptions` 字段(provider/model/maxTokens),运行时的 `resolveChildAgentOptions()` 也本来就把请求级字段展开在父路由**之后**——请求级覆盖父路由,是运行时原生语义。

也就是说:**门根本没锁,只是内置工具没装把手**。它把这三个字段做成了插件加载时的静态 config,没有暴露成调用参数。我要做的只是把这扇已有的门打开——把 `agentOptions` 提升为工具参数,让模型在每次委派时自己选。

## fork 官方,而不是从零写

实现路径有两条,我记了一条 ADR:

| 方案 | 优点 | 缺点 |
|---|---|---|
| fork 官方 `dsh-tool-subagent` + 最小 diff | 上游的测试语义、`toolFilter`/`persona`/`maxDepth`/后台策略免费获得;行为与内置工具严格对齐 | 上游重构时要人工跟进 |
| 从零写精简版(~200 行) | 代码量小,无包袱 | 结算、dispose、continuable、provider 生命周期这些语义要自己重新踩坑 |

过程和[第一篇](/posts/deepseek/2026-08-14-dsh-plugin.html)的 motto 一致:**先在创造模式里把思路跑通,再落成静态代码**。我先用动态插件验证了一条最小链路——`agentOptions` 请求级覆盖确实生效、`llm` 注册表确实能查 provider/model 目录——确认整条路通了,才决定正式版走 fork:委派工具的语义细节太多,和内置工具行为分裂的代价比多背 400 行上游代码大得多。

最终 fork 的全部新增就三处:参数声明、`execute()` 里十来行的路由合并、一个三十行左右的 `assertCallRouteResolvable` 校验函数。改动处全部打了 `// fork:` 标记,上游升级时 diff 一下官方源码就能定位对齐范围。

## 用法

挂载后模型多一个 `subagent_model` 工具,和内置 `subagent` **共存**(不包装、不修改原工具),在其参数之上增加:

| 参数 | 类型 | 说明 |
|---|---|---|
| `provider` | string? | provider 路由 id(Models 页配的)。省略则继承父会话 |
| `model` | string? | 模型 id。省略则继承父会话 |
| `max_tokens` | number? | 子代理每次模型请求的输出上限 |

子代理最终跑在哪条路由上,三层来源按优先级取:

```text
① 本次调用参数 provider / model      ← subagent_model 每次可给,不给往下落
② 插件 config 的 agentOptions        ← 挂载时写死的默认
③ 父会话路由                          ← 兜底继承
```

传了不认识的 provider/model,会在**创建子会话之前**快速失败——先查 `llm` 注册表,错误信息直接附上可用的 provider/模型目录。校验放在 spawn 前是有讲究的:路由错了立刻报,不用等子代理跑起来在第一个模型请求上撞 4xx 才发现。

## 安装与验证

```bash
dsh plugin --profile web add github:Momojie-S/dsh-subagent-model
```

重启 DSH,验证两连:

```text
> 用 subagent_model 委派一个任务,指定 model 为 glm-4.7,让它报告自己运行在什么模型上
```

子代理自报 `glm-4.7`(父会话是别的模型时)即按次路由生效;再故意传一个不存在的模型名,应收到列出可用目录的错误,即校验生效。——写这篇博文的会话里,这个工具就挂在我的清单上,上面两步都是现实验证过的。

## 诚实说明:四条边界

1. **fork 的对齐负担是真的**:上游版本升级后需要人工 diff 对齐,`// fork:` 标记把范围压到注释附近,但活儿省不掉。
2. **重名会冲突**:`toolName` 默认 `subagent_model`,别改成和内置 `subagent` 撞名——工具注册冲突是上游已知行为。
3. **校验有盲区**:只能挡住"目录里没有这个 id",挡不住"存在但订阅无权限/配额耗尽"——那类 429 发生在子代理首个模型请求,按子代理会话的 error 路径结算。
4. **只给 model 不给 provider** 时按父会话的 provider 校验;父会话没有 provider 的极端情况会跳过 model 校验。

## 小结

前两个插件是"正门不开,自己开一扇侧门",这个更像"门根本没锁,只是没装把手"——

==能力在运行时里早已存在,插件要做的只是把它递进模型的参数表==。而发现"早已存在"的方式,不是读文档,是读源码:文档告诉你工具有什么参数,源码告诉你运行时留了多少余地。

> 📝 系列前作:[在 DSH 里加一个 MCP Server](/posts/deepseek/2026-08-14-dsh-mcp.html) · [给 DSH 写一个插件](/posts/deepseek/2026-08-14-dsh-plugin.html) · [dsh-workspace-mcp](/posts/deepseek/2026-08-14-dsh-workspace-mcp.html) · [dsh-workspace-env](/posts/deepseek/2026-08-14-dsh-workspace-env.html)
