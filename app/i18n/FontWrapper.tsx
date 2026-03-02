/**
 * @input  react, app/i18n/index
 * @output FontWrapper, TitleFontWrapper
 * @pos    字体包装组件 - 为子组件注入语言对应的字体类名
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import { ReactNode } from "react";
import { useLanguage } from "./index";

interface FontWrapperProps {
  children: ReactNode;
}

export function FontWrapper({ children }: FontWrapperProps) {
  const { fontClass } = useLanguage();
  
  return (
    <div className={fontClass}>
      {children}
    </div>
  );
}

export function TitleFontWrapper({ children }: FontWrapperProps) {
  const { titleFontClass } = useLanguage();
  
  return (
    <div className={titleFontClass}>
      {children}
    </div>
  );
}
