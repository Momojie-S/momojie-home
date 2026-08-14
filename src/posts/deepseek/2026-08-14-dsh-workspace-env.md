---
title: dsh-workspace-env:让 DSH 的每条命令自动读项目的 .env
category:
  - DeepSeek Harness
  - 插件
date: 2026-08-14
---

这篇介绍我的第二个 DSH 插件 `dsh-workspace-env`。它解决一个很小但很疼的问题:**同一条 CLI,在不同项目里应该用不同的身份/凭据**。

典型场景:双 GitHub 账号。`gh` 的身份跟着 `GH_TOKEN` 走,我一半仓库在 A 账号、一半在 B 账号——在 B 的仓库里跑 `gh pr create`,如果环境里是 A 的 token,它不会报错,只会**静默地用 A 的身份干活**,直到你在错误的账号下看到那个 PR。

仓库在 [Momojie-S/dsh-workspace-env](https://github.com/Momojie-S/dsh-workspace-env)。

<!-- more -->

## DSH 原生 .env 的坑

DSH 其实支持 `.env#:进程环境、cwd 的 `.env`、`~/.dsh/.env` 三层。但读文档+实测下来,它的定位是**给 harness 自己用的**——值进启动时的环境快照,不注入 `process.env`,而且快照启动即冻结,之后改文件不生效。

可我要的是给 agent 跑的命令用的:在哪个项目目录跑命令,哪里的 `.env` 就该生效,而且**改完立即生效,不想重启**。

官方扩展点查了一圈(过程见[上一篇](/posts/deepseek/2026-08-14-dsh-plugin.html)):`shellEnv` 只收 `DSH_` 前缀,工具层也不给插件留传 env 的口子。正门不开,那就自己开一扇。

## 用法

workspace 根目录(session cwd)放一个 `.env`:

```bash
GH_TOKEN=gho_xxx             # 这个项目的 gh 身份
QUOTED="value with spaces"   # 成对单/双引号自动去除
PATH=D:\mytools;${PATH}      # ${VAR} 引用父环境,PATH 前置追加
# # 开头是注释;空行、无 = 的行跳过
```

就这些。之后 agent 跑的每条 pwsh 命令,子进程环境里自动带上这些变量;切到别的目录,自动换那边的 `.env`——**agent 无感知,一行提示词都不用改**。

行为细节:

| 特性 | 说明 |
|---|---|
| 读取时机 | 每次命令调用现读文件,**改完立即生效,无需重启** |
| 优先级 | 同 key 时 workspace `.env` 赢过系统环境变量和 DSH 注入的同名变量 |
| `${VAR}` 插值 | 展开自父环境 + 同文件中更早定义的变量;未定义展开为空串 |
| 保留字 | `DSH_*` 前缀一律忽略(DSH 管理变量有自己的通道) |

## 安装与验证

```bash
dsh plugin --profile web add github:Momojie-S/dsh-workspace-env
```

重启 DSH,然后在 workspace 放个探针:

```bash
# .env
WS_ENV_TEST=hello
```

让 agent 跑 `echo $env:WS_ENV_TEST`,输出 `hello` 即生效;切到无 `.env` 的目录同命令输出空,隔离生效。

双账号场景下我的用法:A 账号的仓库放 A 的 `GH_TOKEN`,B 的放 B 的,每个目录各管各的。不确定当前身份时让 agent 跑一句 `gh api user --jq .login` 确认——这句我写进了全局指令,串号问题从此绝迹。

## 诚实说明:这是个逃生舱

实现上,插件包装了 shell 服务的 `spawnSpec` 内部方法(生成子进程规格那一步,把 workspace 变量并进去),`ctx.effect` 保证卸载时恢复原方法。

两个如实的提醒:

1. `spawnSpec` 在官方 `.d.ts` 里是 `private`——**非契约方法**,DSH 大版本升级后可能位移。所以我留了探针自检的习惯:怀疑失效就 `echo $env:探针名`,一行命令验明正身。
2. 目前覆盖 Windows pwsh 链路(bash 未覆盖,我日常用不到);官方哪天放开 `shellEnv` 的前缀限制,这插件就该光荣退休。

把它们写进 README 而不是藏起来,是因为逃生舱的前提是**知道自己在舱里**。

## 小结

两个插件是一对:`workspace-mcp` 管项目级的**工具**,`workspace-env` 管项目级的**凭据**。合起来一句话:

==环境跟着 workspace 走,agent 一行都不用改==。

> 📝 系列前作:[在 DSH 里加一个 MCP Server](/posts/deepseek/2026-08-14-dsh-mcp.html) · [给 DSH 写一个插件](/posts/deepseek/2026-08-14-dsh-plugin.html) · 姊妹篇 [dsh-workspace-mcp](/posts/deepseek/2026-08-14-dsh-workspace-mcp.html)
