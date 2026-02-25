# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal homepage/blog built with VuePress 2.x and the vuepress-theme-hope theme. The site is deployed at https://momojie.online and uses pnpm as the package manager.

## Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm docs:dev

# Start dev server with clean cache (use when having cache issues)
pnpm docs:clean-dev

# Build for production
pnpm docs:build

# Update VuePress and theme packages
pnpm docs:update-package
```

## Architecture

### Directory Structure

- `src/` - All source content
  - `.vuepress/` - VuePress configuration
    - `config.ts` - Main VuePress config (base, lang, title, description)
    - `theme.ts` - Theme configuration (navbar, sidebar, blog settings, plugins)
    - `navbar.ts` - Navigation bar configuration
    - `sidebar.ts` - Sidebar configuration using `children: "structure"` for auto-generation
    - `styles/` - Custom SCSS styles (palette.scss, config.scss, index.scss)
    - `public/` - Static assets (favicon, logo, avatar)
  - `posts/` - Blog posts organized by category (llm/, dev/, vuepress/)
  - `index.md` - Homepage (BlogHome layout)

### Key Configuration Files

- **config.ts**: Base site config - language (zh-CN), title, base path
- **theme.ts**: Theme settings including:
  - Blog configuration with social media links
  - Markdown extensions (GFM, code tabs, img lazyload, etc.)
  - Plugin configuration (blog, components, icons)
  - Icon prefix: `fa6-solid:` (Font Awesome 6 Solid)

### Blog Post Format

Posts use YAML frontmatter:
```yaml
---
title: Post Title
category:
  - CategoryName
---
```

Use `<!-- more -->` to define the excerpt shown on the blog listing page.

### Sidebar Auto-Generation

The sidebar uses `children: "structure"` to automatically generate navigation based on the file system structure in `src/posts/`.

## 工具说明

### Bash

- 需要临时运行后台服务时，使用 Bash 工具原生的 `run_in_background` 参数，而不是在命令中增加 `nohup` 或者后缀 `&`

### chrome-devtools-mcp

用于调试和测试博客页面。使用前需先启动 Chrome 调试实例：

```bash
chromium --headless --remote-debugging-port=21101 --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage >/dev/null 2>&1
```

使用流程：
1. 启动开发服务器：`pnpm docs:dev`（运行在 http://localhost:21102）
2. 启动 Chrome 调试实例（端口 21101）
3. 使用 chrome-devtools MCP 打开并调试博客页面
