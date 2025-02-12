import { navbar } from "vuepress-theme-hope";

export default navbar([
  "/",
  {
    text: "博文",
    icon: "pen-to-square",
    prefix: "/posts/",
    children: [
      {
        text: "大模型应用",
        icon: "pen-to-square",
        prefix: "llm/",
        children: [
          { text: "国内免费的Deepseek", icon: "pen-to-square", link: "tools/2025-02-11" },
        ],
      }
    ],
  },
]);
