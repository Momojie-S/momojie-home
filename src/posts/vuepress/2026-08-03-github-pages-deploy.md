---
title: 博客复活记：从阿里云迁到 GitHub Pages 自动部署
category:
  - VuePress
  - 运维
date: 2026-08-03
---

博客荒废了一年多，最近终于把它救活了。这篇记一下整个过程——不是教程，是真实排查 + 决策 + 踩坑的流水。

<!-- more -->

## 先诊断：为什么荒废

我的博客 `momojie-home`（VuePress2 + theme-hope），最后一篇停在 2025-04。一开始以为是"没时间写"，深挖下去发现根因是两个：

1. **线上根本没了**。`blog.momojie.online` 原本指向阿里云服务器，但服务器上的 nginx 配置和静态文件都被别的项目（OneDragon/OpenClaw）挤掉了，只剩 nginx 默认欢迎页，HTTPS 也不通。**写完文章根本发不出去**——这种"写了像没写"的无力感，是最强的劝退。
2. **没有自动部署**。repo 里没有任何 CI/部署脚本，每次发文章要手动 build + 传文件，门槛太高。

## 方案选择：GitHub Pages 还是阿里云

诊断清楚后，核心诉求变成：**把"push 即上线"的部署链路搭起来**。

两个候选：

- **阿里云 + CI**：国内访问快，但要运维 nginx/SSL/deploy key，动生产服务器。
- **GitHub Pages + 自定义域名**：零服务器、零密钥、CI 极简，但国内访问偏慢（GitHub 被限速）。

我选了 **GitHub Pages**。理由：受众主要是技术圈/自己存档，省心比访问速度更重要；而且 CI 自动化后，日常发文章两者一样简单（都是 `git push`），区别只在一次性搭建。GitHub Pages 把"运维负担"彻底消除，这对"坚持下来"是决定性的。

> 备案不用担心：GitHub 是境外接入，个人博客没人查，页面保留备案号也无妨。

## 实施

### 1. CI：GitHub Actions 自动 build + deploy

核心是一个 workflow（`.github/workflows/deploy.yml`），push 到 main 就自动 build 并部署到 Pages：

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4   # 自动读 packageManager 字段
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: src/.vuepress/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

Source 设为 "GitHub Actions"（不是传统的 gh-pages 分支），更干净。

### 2. 自定义域名

`blog.momojie.online` 要指向 GitHub。两步：

- **DNS**：阿里云把 `blog` 记录从 `A`（原服务器公网 IP）改成 `CNAME Momojie-S.github.io.`（末尾那个点别漏）。
- **CNAME 文件**：repo 里放 `src/.vuepress/public/CNAME`，内容 `blog.momojie.online`。它会被 build 进产物根，GitHub 据此识别自定义域名，每次 deploy 自动保住绑定。

另外把 `theme.ts` 的 `hostname` 改成 `https://blog.momojie.online`——theme-hope 用它生成 canonical URL 和 sitemap，不改会导致 SEO 指向错误域名。

## 踩的坑

1. **pnpm 11 要求 Node ≥22**。本地是 Node 24 没事，CI 一开始写 `node-version: 20` 直接挂（`pnpm requires at least Node.js v22.13`）。改成 22 解决。顺带一提，GitHub Actions runner 上的 Node 20 已经 deprecated，迟早要升。
2. **pnpm 11 默认不跑依赖的 build script**。esbuild 的 postinstall 被忽略，Vite build 必挂。而且 pnpm 11 **不再读 `package.json` 的 `pnpm` 字段**了，得在 `pnpm-workspace.yaml` 里写：

    ```yaml
    allowBuilds:
      esbuild: true
    ```

3. **HTTPS 证书要等**。DNS 刚切完，`curl https` 不通，GitHub API 报 `The certificate does not exist yet`。GitHub 要几分钟自动签 Let's Encrypt 证书，签好才能开 "Enforce HTTPS"。急不得。

## 结果

现在 `push to main` → Actions 自动 build → 几十秒后线上更新。发文章的门槛归零，剩下的就是写。

至于"为什么以前没坚持下来"——这次想明白了：**不是缺毅力，是缺一条不费力的发布链路**。链路通了，坚持就容易多了。
