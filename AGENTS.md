# momojie-home · 个人博客

> 莫隅小筑。线上 **https://blog.momojie.online**(VuePress 2 + theme-hope,GitHub Pages + 阿里云 CDN)。
> 这是博客源码仓库:**写文章 → push main → GitHub Actions 自动 build → 几十秒后线上更新。**

## 写文章

说「写一篇博文」(或点名 `write-post` skill)走起草工作流。**写作方法论见下方「写作方法论」**——本文件是方法论的唯一事实源,skill 只做触发和工作流。

## 发布

说「发布/上线」(或点名 `publish` skill)走发布流程(脱敏 → 预览 → commit → push → 验证)。

push `main` → `.github/workflows/deploy.yml` 自动 `pnpm docs:build` → 部署 Pages → blog.momojie.online 更新。

## 写作方法论

> 写/改博文遵循。换电脑、重装照这个来,不靠记忆。

### 风格基调:低调谦虚
技术判断可以坚定,但**不居高临下、不自夸权威**。不写"门儿清/精通/最懂"这种高调话,改"玩过一阵/略懂/有些了解";陈述事实(如"通关最高难度")可以,但不包装成"我是专家"。读者要的是干货 + 真实,不是自吹。

### 选题(值不值得写)
同时满足两条:
- **有过程**:真实踩坑 / debug / 选型决策(不是"查一下告诉你")
- **有增量**:读者照着能少走弯路;官方文档已有的不算增量

### 三套结构模板(先定骨架)
| 模板 | 适用 | 骨架 |
|---|---|---|
| 拆解型 | 工具/机制怎么工作 | 总览图 → 逐层拆 → 配置 → 权衡 → 速查表 |
| 日记型 | debug 一个问题 | 现象 → 误区 → 根因 → 解法 → 验证 → 金句 |
| 决策型 | 技术/方案选型 | 诊断 → 方案对比(带权衡)→ 实施 → 结果金句 |

### momojie-home 约定
- 路径:`src/posts/<分类>/YYYY-MM-DD-slug.md`(分类即子目录)
- frontmatter:`title` + `category`(数组)+ `date`
- `<!-- more -->` 分摘要(列表页只显示摘要)
- 中文、第一人称、口语化

### 质量自检(写完念一遍)
- [ ] 一张总览图 / 心智模型(文章的魂)
- [ ] 关键论点引官方/权威原文
- [ ] 可执行的命令 / 配置(具体到值)
- [ ] 第一人称 + 口语(有"我"的判断)
- [ ] 结尾一句金句 / 观点
- [ ] 脱敏(token / 私钥不进 git)

### 避坑
- 别纯搬运官方文档(没增量)
- 别通篇客观陈述、没"我"的判断(= AI 八股)
- 别堆术语不解释
- 别过长没重点(每节开头一句话点题)

## 技术栈

- VuePress 2 + vuepress-theme-hope,pnpm,Node ≥22(pnpm 11 硬要求)
- ⚠️ pnpm 11 默认不跑依赖 build script;esbuild 已在 `pnpm-workspace.yaml` 的 `allowBuilds` 放行,**别删**
- 本地预览:`pnpm docs:dev`(端口 **21102**)
- 生产构建:`pnpm docs:build`(输出 `src/.vuepress/dist`)
- 缓存问题:`pnpm docs:clean-dev`
- 升级框架:`pnpm docs:update-package`

## 目录结构

- `src/posts/<分类>/` — 文章,按分类建子目录(`vuepress/`、`claude-code/`、`llm/`、`dev/`…)
- `skills/` — agent skills(`write-post`、`publish`),入库;本地经 junction 联入 `.agents/skills/` 供 DSH 加载(link 不入库)
- `src/.vuepress/`
  - `config.ts` — 站点配置(base / lang / title / description)
  - `theme.ts` — 主题(navbar / sidebar / blog / plugins,`hostname` = `https://blog.momojie.online`,用于 canonical/sitemap)
  - `navbar.ts` / `sidebar.ts` — sidebar 用 `children: "structure"` 按文件系统自动生成
  - `public/CNAME` — 内容 `blog.momojie.online`(GitHub 据此识别自定义域名)
  - `styles/` — 自定义 SCSS(palette / config / index)
- 更详细的架构和本地环境见 [README.md](README.md)

## 工具

- **后台命令**:用工具原生 `run_in_background` 参数,别加 `nohup` 或后缀 `&`
- **chrome-devtools-mcp**(调试博客页面):
  1. `pnpm docs:dev` → http://localhost:21102
  2. 启调试实例:`chromium --headless --remote-debugging-port=21101 --no-sandbox --disable-gpu --disable-software-rasterizer --disable-devm-usage >/dev/null 2>&1`
  3. chrome-devtools MCP 连 21101 调试(DSH 未配此 MCP;要用时按全局 `~/.dsh/AGENTS.md` 的模板加 patch)

## 约定

- **公开 repo**。token / 私钥 / 个人凭据**绝不进 git**。文章里写配置示例要脱敏(域名/端口/模型名可写,密钥值不写)。
- `.gitignore` 已排除:`.agents/`(skill junction,本地 link)、`.env`(workspace-env 凭据)、`.debug/`、`.claude/`(CC 已弃用,防残留)、`node_modules/`、`src/.vuepress/{.cache,.temp,dist}`
- skills(`skills/`)**入库**(可重建、换电脑直接用),本地 junction 联入 `.agents/skills/` 供 DSH 加载;CC 配置(`.claude/`、commit trailer hook)已随弃用移除
- commit message 用简短中文
