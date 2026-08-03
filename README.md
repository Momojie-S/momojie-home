# 莫隅小筑 · 个人博客

线上：<https://blog.momojie.online>

基于 [VuePress 2](https://vuepress.vuejs.org/zh/) + [vuepress-theme-hope](https://theme-hope.vuejs.press/)。

## 写文章

文章是 `src/posts/<分类>/YYYY-MM-DD-slug.md`。放进去后侧边栏按目录结构自动生成（`sidebar: structure`）。

1. 在 `src/posts/<分类>/` 新建 `YYYY-MM-DD-slug.md`，开头 frontmatter 至少写 `title` + `category`，正文用 `<!-- more -->` 分割摘要。
2. `git add && git commit && git push`。
3. GitHub Actions 自动 build + 部署，几十秒后 <https://blog.momojie.online> 更新。

本地预览：`pnpm docs:dev`（端口 21102）。

## 本地环境

- Node ≥ 22（pnpm 11 要求；CI 用 node 22，本地 24 也能 build）
- pnpm：`corepack enable pnpm`
- 首次：`pnpm install`

> ⚠️ pnpm 11 默认不跑依赖的 build script。esbuild 的 postinstall 已在 `pnpm-workspace.yaml` 的 `allowBuilds` 里放行，别删。

## 部署

GitHub Pages + 自定义域名 `blog.momojie.online`，Source = GitHub Actions。

- push `main` → [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自动 `pnpm docs:build` → 部署 Pages。
- 自定义域名靠 `src/.vuepress/public/CNAME`（内容 `blog.momojie.online`），每次 deploy 自动带上。
- DNS：`blog.momojie.online` CNAME → `Momojie-S.github.io.`（阿里云）。

部署全过程见博文：<https://blog.momojie.online/posts/vuepress/2026-08-03-github-pages-deploy.html>

## 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm docs:dev` | 本地预览（端口 21102） |
| `pnpm docs:build` | 生产构建（输出 `src/.vuepress/dist`） |
| `pnpm docs:update-package` | 升级 VuePress / theme-hope |

[图标](https://fontawesome.com/search?o=r&m=free)
