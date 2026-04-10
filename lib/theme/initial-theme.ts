export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "DreamMiniStage-theme";

export function resolveThemeMode(
  preset?: string | null,
  stored?: string | null,
  prefersDark: boolean = false,
): ThemeMode {
  if (preset === "light" || preset === "dark") {
    return preset;
  }

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return prefersDark ? "dark" : "light";
}

export function createThemeInitScript(storageKey: string = THEME_STORAGE_KEY): string {
  const key = JSON.stringify(storageKey);

  return `
    (function () {
      try {
        var root = document.documentElement;
        var preset = root.dataset.theme;
        var stored = null;

        try {
          stored = localStorage.getItem(${key});
        } catch (_error) {
          stored = null;
        }

        var prefersDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        var mode = preset === "light" || preset === "dark"
          ? preset
          : stored === "light" || stored === "dark"
            ? stored
            : prefersDark
              ? "dark"
              : "light";

        root.dataset.theme = mode;
        root.classList.toggle("dark", mode === "dark");
        root.style.colorScheme = mode;
      } catch (_error) {
        // 启动脚本只允许静默失败，不能阻断首屏渲染。
      }
    })();
  `.trim();
}
