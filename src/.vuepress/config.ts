import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "莫隅小筑",
  description: "Momojie 的折腾笔记 · 运维 · 自动化 · 大模型",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
