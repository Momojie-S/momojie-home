---
title: DSH skill 目录不出现:一次双实例互踩的排查
category:
  - DeepSeek Harness
  - 排障
date: 2026-08-14
---

StarRail 项目按文档放了 11 个项目级 skill(junction 进 `.dsh/skills/`),然后遇到一组很反直觉的症状:

- 说「用某某 skill」,模型能加载并执行——前提是名字由我点名,比如 AGENTS.md 里提到;
- `/sr-od-dev-pr-review` 斜杠手势也能直接拉起正文;
- 唯独 `<available_skills>` **目录永远不出现**——模型不知道自己有什么,每次都得我说「用哪个」。

工具能用、手势能拉、目录不来。这个组合本身就值得记一笔:它排掉了一大半常规嫌疑(文件没放对、解析失败、注册表没发现——任何一条成立,工具和手势也该一起死)。而挖到底的根因,是那种"每一层都在按设计行事、合起来却把功能干没了"的坑:**两个插件实例,每个 pre-step 互相剥对方刚注入的消息**。

版本基准:DSH `0.1.0-rc.6`,web profile。结论只对这个版本负责。

<!-- more -->

## 先补课:一个 skill 是怎么到模型面前的

排查前先把机制摸清(这部分是调查顺带产出的,比结论更通用)。skill 注册表(`ctx.skills`)是 host + per-scope 的分层结构,本地发现由 `dsh-skill-filesystem` provider 完成,按 rank 扫描目录,小者胜:

| Rank | source | 根目录 |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | 配置的 `customSkillDirs` |
| 400 | `user-dsh` | `<DSH_HOME>/skills`(跳过 `.system`) |
| 500 | `user-agents` | `~/.agents/skills` |
| 600 | `bundled` | `$DSH_BUNDLED_SKILL_DIR` |

两个细节:项目根 = 从会话 cwd 向上找最近的含 `.git` 的祖先;win32 的 junction/symlink 有专门测试覆盖,断链静默跳过——所以 junction 进目录这条路本身是官方支持姿势。

消费方是 `dsh-tool-skill`:它在 `agent/pre-step`(每次模型请求前)把目录注入提示词,只含 `name` + `description`(截断 500 字符)。模型"知道有哪些 skill"全靠这份注入——它不出现,模型就是睁眼瞎。

## 五层排查:四通一堵

顺着链路从下往上逐层排除:

| 层 | 手段 | 结果 |
|---|---|---|
| 文件层 | 逐个验证 junction 目标 + SKILL.md frontmatter | ✅ 11/11 合规 |
| 包层 | 用部署的 rc.6 包直接跑发现逻辑 | ✅ 11/11 全部发现 |
| 配置层 | `dsh web --dump-config` | ⚠️ 发现 patch re-enable 了 host 行(**当时未在意**) |
| 进程层 | 动态 Cordis 插件探针:`skills.snapshot({cwd})` | ✅ 11 个、`complete: true` |
| 注入层 | 子代理实测 + 会话事件扫描 | ❌ 工具可见、快照完整,`catalogEvents: 0` |

注入层的 `catalogEvents: 0` 是全场最硬的证据:**注入过必有事件痕迹,零痕迹就是没注入过**。嫌疑于是收敛到注入唯一的静默门控——`ctx.tools.get('skill', agent) === 本插件注册的工具` 这个严格身份比对。

> 顺带一个沙盒踩坑:动态插件沙盒里经 `ctx.tools.get()` 拿到的工具只剩 `{name, description, parameters}` 的 schema 投影,连自己刚注册的都如此——拿它做身份探测全部失真。**沙盒内做不了"是不是同一个对象"类测量**,别在这上面浪费时间。

## 根因:host 与 preset 双实例互相剥目录

谜底在配置层那个被我忽略的 ⚠️。web-app 的 bundle patch 默认**禁用** host 层的 `skill-filesystem` / `tool-skill`(preset 是 skill 能力的唯一挂载点),而我在 profile patch 里把两者 re-enable 了;preset 层又各自带这两个插件。于是进程里同时活着 **A(host 全局层)和 B(preset 层)两个 `tool-skill` 实例**,各注册一个 `skill` 工具、各挂一个目录监听器。

分层注册表里 B 遮蔽 A。然后每个 pre-step 演出同一出戏:

1. B 身份比对通过 → 注入目录;
2. A(后执行)发现自己被遮蔽 → 按设计走"空目录"分支 → **把 B 刚注入的目录当陈旧列表剥掉**(`tool-skill/src/index.ts:237-241`);
3. 每步"注入→删除"拉锯,目录永远活不到模型请求那一刻。

设计意图本是"被遮蔽实例应静默退场"(连 schema 带指引一起消失),但被遮蔽的实例反过来以空目录视界清除遮蔽者的消息——这是 `tool-skill` 的一个缺陷,不是配置语义。

## 修复:删两行,当场见效

从 profile 的 `cordis.patch.yml` 删掉两个 re-enable override(留注释说明根因)。**纯 config 操作,HMR 热生效,无需重启**——删完当场收到本会话第一份 `<available_skills>`。验证:

```powershell
dsh web --dump-config 2>&1 | Select-String 'id: (skill-filesystem|tool-skill)' -Context 0,2
# 两者应回到 disabled: true
```

最小复现也就一行:preset 会话 + patch 里 `- id: tool-skill / disabled: false` → 目录永久消失,而工具与 `/name` 手势照常——症状能一比一复刻。值得给上游提 issue:被遮蔽实例在身份比对失败后应**完全静默**(不发布也不剥除),目录监听器需要区分"我从未发布过"与"有人发布了但我无权视之"。

## 三条沉淀

1. **preset 自带的插件,不要在 host patch 里再开一份**。分层遮蔽对"同名双消费者"是陷阱;bundle 默认禁用 host 行是有原因的,看着"多此一举"的默认值,先想想它挡的是什么。
2. **注入类问题,事件扫描是最硬的证据**。`source.kind === 'skill-catalog'` 计数为零,直接判死刑,不用猜。
3. **动态 Cordis 探针是问诊活进程的利器**,但要记得沙盒 proxy 会把工具对象投影成 schema——读 service 状态可靠,做对象身份比对不可靠。

## 小结

这次最妙也最气人的地方在于:两个实例、每一步、各自都严格执行了设计——一个尽责注入,一个尽责清理——合谋把功能干没了。

==分层系统的坑,常常不在某一层,而在层与层的交界处==。排查时与其逐层找"哪层错了",不如先找到最硬的证据,把问题钉死在交界线上。

> 📝 系列前作:[在 DSH 里加一个 MCP Server](/posts/deepseek/2026-08-14-dsh-mcp.html) · [给 DSH 写一个插件](/posts/deepseek/2026-08-14-dsh-plugin.html) · [dsh-subagent-model](/posts/deepseek/2026-08-14-dsh-subagent-model.html)
