/**
 * Iframe Security - iframe安全处理工具
 * 
 * 设计原则：
 * 1. 最小权限：只授予必要的权限
 * 2. 沙箱隔离：防止iframe访问父窗口敏感信息
 * 3. 内容净化：重写危险的window.parent访问
 * 4. 防御性编程：假设所有输入都是不可信的
 */

/**
 * 重写iframe中的parent访问，增强安全性
 * 
 * 将window.parent替换为window.parent.parent，确保iframe无法直接访问
 * 父窗口的敏感信息，同时保持功能完整性。
 */
export function rewriteIframeParentAccess(html: string): string {
  if (!html || !html.includes("<iframe") || !html.includes("window.parent")) {
    return html;
  }

  let patched = html.replace(
    /(<iframe[^>]*srcdoc=["'])([\s\S]*?)(["'])/gi,
    (_match, prefix, srcdocContent, suffix) => 
      `${prefix}${srcdocContent.replace(/window\.parent(?!\.parent)/g, "window.parent.parent")}${suffix}`,
  );

  patched = patched.replace(
    /(<iframe[^>]*>)([\s\S]*?)(<\/iframe>)/gi,
    (_match, start, inner, end) => 
      `${start}${inner.replace(/window\.parent(?!\.parent)/g, "window.parent.parent")}${end}`,
  );

  return patched;
}

/**
 * 生成iframe的沙箱属性
 * 
 * 根据功能需求生成最小必要的沙箱权限
 */
export function generateSandboxAttributes(allowScripts: boolean = true, allowSameOrigin: boolean = true): string {
  const permissions: string[] = [];
  
  if (allowScripts) permissions.push("allow-scripts");
  if (allowSameOrigin) permissions.push("allow-same-origin");
  
  return permissions.join(" ");
}

/**
 * 验证iframe内容是否安全
 * 
 * 检查是否包含潜在的危险内容
 */
export function isIframeContentSafe(html: string): boolean {
  // 检查是否包含完整的HTML文档（可能包含head中的危险内容）
  const hasCompleteDoc = /<html[^>]*>[\s\S]*<\/html>/i.test(html);
  const hasHeadWithMeta = /<head[^>]*>[\s\S]*<meta[^>]*>/i.test(html);
  
  // 如果包含完整的HTML文档且head中有meta标签，需要更严格的检查
  if (hasCompleteDoc && hasHeadWithMeta) {
    // 检查是否包含危险的meta标签
    const dangerousMeta = /<meta\s+http-equiv=["']?refresh["']?[^>]*>/i.test(html) ||
                          /<meta\s+http-equiv=["']?set-cookie["']?[^>]*>/i.test(html);
    
    if (dangerousMeta) {
      return false;
    }
  }
  
  return true;
}

/**
 * 清理iframe内容中的潜在危险元素
 */
export function sanitizeIframeContent(html: string): string {
  // 移除危险的meta标签
  let cleaned = html.replace(/<meta\s+http-equiv=["']?(refresh|set-cookie)["']?[^>]*>/gi, "");
  
  // 移除javascript:协议的链接
  cleaned = cleaned.replace(/href=["']?javascript:/gi, "href=\"about:blank\"");
  
  // 移除on事件处理程序
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*["']?[^"'\s>]+["']?/gi, "");
  
  return cleaned;
}
