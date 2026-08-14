---
title: 给 DeepSeek Harness 写一个插件
category:
  - DeepSeek Harness
  - 插件开发
date: 2026-08-14
---

上一篇写了怎么在 DSH 里配 MCP。配完之后我冒出个更进一步的念头:DSH 号称「一切能力都是插件」,那我自己能不能写一个?

契机很实际——我在两个 GitHub 账号之间来回切,想让每个项目的目录自动带上自己的 `GH_TOKEN`,官方没有现成的口子。于是照着这个需求写了两个小插件(`dsh-workspace-mcp`、`dsh-workspace-env`),从零把插件开发摸索了一遍。

流程总结成一句话:==先在「创造模式」里把思路跑通,再落成静态插件代码==。这是全文我最想传达的一条。

<!-- more -->

## 插件是什么:一个导出 name 和 apply 的模块

DSH 基于 Cordis 插件框架,所有能力(工具、shell、MCP、UI)都是插件。一个插件的最小形态:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'

export function apply(ctx: Context) {
  console.log('[my-plugin] loaded!')
}
```

框架加载时调用 `apply(ctx)`,你拿 `ctx` 注册能力:工具、事件监听、系统提示……插件卸载时这些注册自动清理。

形态上日常只需要记住一条:**函数写法首选**;只有要向其它插件**提供服务**(比如暴露一个 `ctx.myCap`)时,才用 `class extends Service` 的写法。官方架构里「服务定义 → 服务实现 → 消费者」三层分离,实现层可替换——这就是为什么 DSH 的执行器、工具天生都能被换掉。

## 动手前:先在创造模式验证

DSH 新开会话时可选四个预设:标准、PTC、极简、**创造模式**(cordis 预设)。选创造模式会附加一套自引用的 Cordis 工具集和两个专属 skill,让你**不写文件、不重启**就能验证插件逻辑:

| 工具 | 用途 |
|---|---|
| `cordis_inspect_list` / `cordis_inspect_query` | 查运行时 Service / Event / Tool 的真实契约 |
| `cordis_define` + `cordis_run` | 定义并激活内联动态插件 |
| `cordis_stop` / `cordis_undefine` | 停止 / 删除动态插件 |

我验证「包装 `ctx.shell.spawnSpec` 可行吗」的流程:

```text
1. cordis_inspect_query → 查 shell 服务的真实方法签名
2. cordis_define → 内联一个最小包装插件
3. cordis_run → 激活
4. 跑一条 pwsh 命令 → 看包装是否生效
5. cordis_stop → 清理
```

秒级迭代,全程不碰磁盘。==写代码前先查 inspect 工具,别猜 API==——查到的是运行时真实契约,比翻文档还准。

::: warning 两个边界
1. 动态沙盒里只有 `ctx`、`console` 等少数 builtin,**没有** `readFileSync` 这类 Node 模块。涉及文件 IO 的逻辑验证不了,只能验证服务注入、事件监听、方法包装这类纯 Cordis 交互。
2. 动态插件不是安全沙盒,代码直接跑在真实运行时里,官方明说「等同于 shell 权限」。只在信任的会话里用。
:::

## 静态插件的三块核心知识

思路验证通过,开始写正式的 TypeScript 插件。三块知识够覆盖绝大多数场景。

### 依赖注入

::: code-tabs

@tab 硬依赖 inject

```ts
// 服务没就绪插件就先等着(PENDING),不执行 apply
export const inject = ['shell']

export function apply(ctx: Context) {
  ctx.shell  // 一定就绪
}
```

@tab 可选依赖 ctx.get

```ts
export function apply(ctx: Context) {
  const shell = ctx.get('shell')
  if (shell === undefined) return
  // ...
}
```

:::

选型一句话:功能离开这个服务就没法工作 → `inject`;服务只是锦上添花 → `ctx.get`。

::: warning PENDING 是静默的
`inject` 了没人提供的服务,插件会永远等待,**没有任何报错**。症状是「插件加载了但功能没有」——检查服务名拼没拼对,或遍历 `ctx.registry` 看 fiber 状态。
:::

### 生命周期:每个副作用必须可逆

`ctx` 托管的注册(事件、工具)随插件卸载自动清理;自己开的资源要用 `ctx.effect()` 交出清理函数:

```ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => console.log('tick'), 5000)
    return () => clearInterval(timer)  // 卸载 / HMR 替换时执行
  })
}
```

这条原则在 monkey-patch(包装别人的方法)时是保命的:保存原引用,`ctx.effect` 里恢复。

### 插件配置

导出 schemastery 的 `Config` schema,用户在 patch 行里传参:

```ts
import z from '@deepseek-ai/schemastery'

export interface Config {
  configFile: string
}

export const Config: z<Config> = z.object({
  configFile: z.string().default('.dsh/mcp.servers.yml'),
})

export function apply(ctx: Context, config: Config) {
  // config.configFile:用户值或 schema 默认值
}
```

原则:**凡是不同部署可能取不同值的参数,都必须是配置字段**,不要硬编码。

## 挂上去:patch 一行 + 一个 junction

开发期的加载方式就是上一篇的 patch 机制,`name` 换成 `file://` URL 指向编译产物:

```yaml
- insert:
    - id: my-plugin
      name: file:///D:/abs/path/to/my-plugin/lib/index.js
```

(还是 `- insert:` 直接跟条目、别在 insert 同层写 `id` 的老规矩,踩过 `not a group` 的回看上一篇。正式分发则做成 npm 包,`dsh plugin add` 安装。)

**这里还有个文档不会告诉你的坑**:插件 `import '@deepseek-ai/cordis'` 时,Node 从插件目录往上找 `node_modules`——找不到,因为 DSH 装在别的地方。解法是建 junction 指过去:

```powershell
$target = "<DSH 安装目录>\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai"
New-Item -ItemType Directory -Force "$pluginDir\node_modules\@deepseek-ai"
cmd /c mklink /J "$pluginDir\node_modules\@deepseek-ai\cordis" "$target\cordis"
```

junction 指进 DSH 的模块树后,传递依赖自动解析,而且和 DSH 运行时用的是**同一份模块**,没有双实例问题。

工程上再加一条:核心纯函数抽出来,写 `test-*.mjs` 从编译产物导入,`node test-xxx.mjs` 直接跑,不依赖 Cordis 环境。我的 `parseDotEnv` 就是这么测的,16 个用例几秒跑完。

## 最大的坑:改了代码不生效

这是我踩得最疼的一个。现象:改 `lib/index.js` → 动一下 patch 触发热加载 → 行为纹丝不动。

| 操作 | 热生效? | 说明 |
|---|---|---|
| patch 加行 / 删行 / 改 config | ✅ | 可靠,上一篇文章就是证据 |
| 改 `lib/index.js` 后只动 patch | ❌ | Node ESM loadCache 缓存模块,`import()` 永远拿旧代码 |
| 改代码 + patch URL 加 `?v=N` | ⚠️ | 能绕缓存,但多次 HMR 循环后 service 实例可能重建,包装类插件握着旧实例**静默失效**(实测踩坑) |
| 重启 DSH | ✅ | 唯一可靠 |

原因是 web profile 的 HMR 以空根运行,不监视模块文件;patch 热加载走的导入路径直接查 loadCache。

所以标准流程就一句:**改代码 → 编译 → 重启 DSH 验证**。也正因为重启这么贵,「先在创造模式验证」才值钱——思路错了在动态阶段就发现,静态版争取一次写对。

::: info 失败速查
- patch 改了没反应 → insert 同层写了 id(`not a group`)
- `name mismatch, skipping` → patch **不能**通过 override 换掉官方插件的 `name`,想替换功能只能独立 insert 新行 + 运行时包装
- 插件加载了但功能没有 → `inject` 的服务名不存在,PENDING 静默等待
- `import` 找不到 `@deepseek-ai/*` → 建上面的 junction
:::

## 逃生舱案例:注入任意环境变量

最后放一个完整案例,也是我写第二个插件的真实动机。需求:每个项目目录自动注入自己的 `.env`(比如各自的 `GH_TOKEN`),避免 gh 命令串账号。

查了一圈扩展点,结论很干脆:

- 官方通道 `ctx.shellEnv.register()` **只收 `DSH_` 前缀**的变量;
- `ShellExecRequest.env` 只有直接调 `ctx.shell.run()` 的调用方能传,工具层不给插件留口子。

正门都关着,只能走逃生舱:**包装 shell 服务的 `spawnSpec` 方法**——它在官方 `.d.ts` 里是 `private`,但运行时它就在那:

```ts
export const inject = ['shell']

export function apply(ctx: any) {
  const shell = ctx.shell
  const original = shell.spawnSpec.bind(shell)
  shell.spawnSpec = function (spec, ...rest) {
    const result = original(spec, ...rest)
    const env = parseDotEnv(join(spec.workdir, '.env'))
    if (Object.keys(env).length > 0) {
      result.env = { ...result.env, ...env }
    }
    return result
  }
  ctx.effect(() => () => { shell.spawnSpec = original })  // 必须可逆
}
```

::: warning 这是逃生舱,不是正规军
monkey-patch 对 service 实例身份敏感——HMR 重建实例后包装会**静默失效**(命令照跑,env 没注入)。我的自检办法是在 `.env` 里放个探针变量,怀疑失效就 `echo $env:探针名`。官方哪天放开了 `shellEnv` 的前缀限制,这种插件就该迁过去。
:::

这个插件从「包装可行吗」到「dispose 恢复正确吗」,都是先在创造模式里用真实 shell 跑通了才落成静态代码——方法论闭环。

## 小结

DSH 的插件体系给我的感觉是:**接口面不大,但每一层都真的可编程**。工具、事件、系统提示、shell 执行,全都有挂载点;挂载点覆盖不到的,还有创造模式让你先验证逃生舱值不值得走。

一句经验收尾:==在创造模式里试错是免费的,在静态插件里试错是以重启计费的==——先把免费的花完,再花计费的。

> 📝 **完整开发指南**(扩展点速查表、工程结构模板、失败速查全表)见 [deepseek-harness-101/docs/usage/dsh-plugin-development.md](https://github.com/Momojie-S/deepseek-harness-101/blob/main/docs/usage/dsh-plugin-development.md),持续更新。
