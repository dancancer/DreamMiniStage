/**
 * @input  next
 * @output homeMetadata
 * @pos    SEO 配置 - 首页元数据定义
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { Metadata } from "next";

export const homeMetadata: Metadata = {
  title: "DreamMiniStage - Welcome to Interactive Storytelling",
  description: "Welcome to DreamMiniStage, where stories come alive. Experience the magic of interactive storytelling in our fantasy-themed platform. Start your creative journey today.",
  alternates: {
    languages: {
      "en-US": "/en",
      "zh-CN": "/zh",
    },
  },
}; 
