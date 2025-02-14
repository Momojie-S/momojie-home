---
title: Vuepress部署Github Page
category:
  - Vuepress
---

简单记录如何将 Vuepress 部署到 Github Page 上遇到的问题。

<!-- more -->

## 整体流程

1. 提交代码仅包含源码部分
2. 创建Github Workflow进行build，并将结果push到另一个分支
3. Github Repo 上设置 Page 使用另一个分支

### Workflow

参考 [Vuepree官网](https://vuepress.vuejs.org/zh/guide/deployment.html#github-pages)

<details>
<summary>问题1 设置 pnpm 步骤错误</summary>

默认的workflow配置使用了 [pnpm/action-setup](https://github.com/pnpm/action-setup)，但没有声明 version，如果你的 package.json 没有定义 packageManager 就会报错。

你也可以加入 version

```yml
      - uses: pnpm/action-setup@v4
        with:
          version: 10
```

</details>

<details>
<summary>问题2 部署到 GitHub Pages 步骤错误</summary>

workflow的最后需要将build之后的结果推送到 gh-pages 分支，有可能出现没有权限的情况，中需要设置权限。

你的Repo -> Settings -> Actions -> General -> Workflow permissions -> Read and write permissions

</details>


### Github Page 域名

参考 [官网](https://pages.github.com/)

- 如果你的项目名称是 {user_name}.github.io (organization同样)则最终域名就是 {user_name}.github.io
- 否则域名就是 {user_name}.github.io/{repo_name}