---
name: publish
description: 发布博客文章到 blog.momojie.online。当用户说"发布""publish""上线""发出去""推送文章"时使用。
---

# 发布博文

发布 = `push main` → GitHub Actions 自动 `pnpm docs:build` → 部署 Pages → blog.momojie.online 更新。整个发布只动 git,不碰服务器。

> 所有命令在**项目根目录**(本仓库根)运行。CC 在本项目工作时 cwd 即项目根;若不在,先 cd 到仓库根,或用 `$CLAUDE_PROJECT_DIR`。

## ① 发布前检查(必做)

**脱敏扫描**(公开 repo,泄露=永久):
```bash
git diff HEAD | grep -niE "ghp_[A-Za-z0-9]{36}|github_pat_|sk-ant-|BEGIN (RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY|BEGIN CERTIFICATE-----"
```
有命中 → 处理掉再发(无命中才继续)。

同时确认每篇新文章:
- frontmatter 齐:`title` + `category` + `date`
- 有 `<!-- more -->` 摘要分割
- 目录名和 `category` 对应(theme-hope 按目录生成分类页)

## ② 本地预览(可选,新文章建议)

```bash
pnpm docs:dev    # http://localhost:21102
```
浏览器看排版 / 新分类页 / 代码块对齐 / 图片。看完 Ctrl+C 关。

## ③ 提交 + 推送

```bash
git add -A
git commit -m "<简短中文标题>"
git push
```
push 到 `main` 即触发 `.github/workflows/deploy.yml`(远程用仓库自带的 origin,不用记 URL)。

## ④ 验证

1. **Actions 跑完**(几十秒):仓库 → Actions 标签页,绿了才算发布成功
2. **线上通**:`curl -sI https://blog.momojie.online` → 应 `200 OK`、`Server: Tengine`(阿里云 CDN)
3. **新文章**:`https://blog.momojie.online/posts/<分类>/<slug>.html`

## 回滚

`git revert <commit>` 或删文件再 push,Actions 自动重新部署覆盖线上。

## 常见坑

- **push 后线上没更新**:看 Actions 是否红了。常见 build 失败:Node 版本(CI 锁 22)、frontmatter YAML 语法、`category` 与目录不匹配。
- **文章没进列表**:frontmatter 缺 `title` / `category`,或漏了 `<!-- more -->`。
- **分类页 404**:目录名和 `category` 不一致(structure 模式按目录)。
- **改了 theme.ts / config.ts 样式没变**:`pnpm docs:clean-dev` 清缓存再预览。
