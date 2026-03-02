/**
 * @input  (none)
 * @output initGA, pageview, gtagEvent, trackButtonClick, trackFormSubmit, GA_MEASUREMENT_ID
 * @pos    埋点工具层 - 封装 Google Analytics 事件追踪与页面访问统计
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

export const GA_MEASUREMENT_ID = "G-KDEPSL9CJG";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export const initGA = () => {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;

  if (window.dataLayer) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
    anonymize_ip: true,
  });
};

export const pageview = (url: string) => {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

export const gtagEvent = (eventName: string, params: Record<string, any>) => {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
};

export const trackButtonClick = (buttonId: string, buttonName: string) => {
  gtagEvent("button_click", {
    button_id: buttonId,
    button_name: buttonName,
    context: "UserInteraction",
  });
};

export const trackFormSubmit = (formId: string, formName: string) => {
  gtagEvent("form_submit", {
    form_id: formId,
    form_name: formName,
    context: "UserInteraction",
  });
};
