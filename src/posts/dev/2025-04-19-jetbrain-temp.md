---
title: 震惊！JetBrains全家桶竟偷吃C盘几十G？3步教你彻底解决空间危机 | 开发者必看
category:
  - JetBrains
  - 开发环境
  - 系统优化
keywords:
  - JetBrains空间占用
  - C盘清理
  - IDE优化
  - 开发环境配置
  - JetBrains设置迁移

---

最近发现C盘空间神秘消失，认真分析一番竟然发现——**JetBrains全家桶竟偷偷吃掉了数十G宝贵空间！**


<!-- more -->


## 📂 空间杀手藏在这里

每个JetBrains IDE都会在以下路径创建"空间黑洞"：
```
C:\Users\<用户名>\AppData\Local\JetBrains
```

### 这些文件夹里有什么？(实测单个IDE可达5-10G！)
| 文件夹类型 | 内容 |
|------------|------|
| 配置文件夹 | 快捷键、主题、插件设置等个性化配置 |
| 缓存仓库 | 项目索引、语法分析缓存(加速项目打开) |
| 日志档案 | 运行日志、错误报告 |
| 插件基地 | 所有插件配置和缓存数据 |


## 🛠️ 3步永久解决方案（附详细配置）

### 步骤1：找到IDE的"命门文件"
1. 打开任意JetBrains IDE
2. 点击顶部菜单 `Help` -> `Edit Custom Properties`

### 步骤2：添加这些"空间转移咒语"

```properties
# 将以下路径改为你的非C盘目标位置
# 以下例子为放到了WebStorm安装目录下的runtime-files文件夹
idea.config.path=D:/WebStorm/runtime-files/config
idea.system.path=D:/WebStorm/runtime-files/system 
idea.plugins.path=D:/WebStorm/runtime-files/plugins
idea.log.path=D:/WebStorm/runtime-files/logs
```

### 步骤3：配置迁移

**复制文件夹**：将原路径中的`config`、`system`、`plugins`、`logs`四个文件夹完整复制到新位置

### 步骤4：重启与清理
1. **完全重启**：关闭所有JetBrains产品后重新启动
2. **功能验证**：验证你的IDE是否正常。
3. **安全清理**：确认IDE运行正常后，再删除C盘原文件夹


## 结语

至此，我们又给宝贵的C盘腾出了更多的空间，撒花~