"use client";

import Link from "next/link";
import { Star, Circle } from "lucide-react";
import { useLanguage } from "./i18n";

export default function NotFound() {
  const { t, fontClass, titleFontClass, serifFontClass } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="absolute inset-0 z-0 opacity-35  " />

      <div className="absolute inset-0 z-1 opacity-45 mix-blend-multiply" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 opacity-5">
          <Star size={24} fill="var(--color-primary-bright)" color="var(--color-primary-bright)" />
        </div>
        <div className="absolute top-20 right-20 opacity-5">
          <Star size={20} fill="var(--color-primary-bright)" color="var(--color-primary-bright)" />
        </div>
        <div className="absolute bottom-20 left-1/4 opacity-5">
          <Circle size={16} color="var(--color-sky)" />
        </div>
        <div className="absolute bottom-10 right-1/4 opacity-5">
          <Circle size={24} color="var(--color-ink-soft)" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-2xl px-6 py-12 text-center">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 relative">
            <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-border opacity-20"></div>
              <div className="absolute inset-4 rounded-full border-2 border-border opacity-30"></div>
              <div className="absolute inset-8 rounded-full border-2 border-border opacity-40"></div>
              <span className={`text-5xl font-bold text-primary-soft ${titleFontClass}`}>404</span>
            </div>
          </div>

          <h1 className={"text-3xl mb-3 text-primary tracking-wide "}>
            {t("notFound.title")}
          </h1>
          <h2 className={"text-xl mb-6 text-muted-foreground "}>
            {t("notFound.subtitle")}
          </h2>

          <p className={`mb-10 text-muted-foreground ${fontClass}`}>
            {t("notFound.message")}
          </p>

          <div className="flex items-center justify-center space-x-4">
            <Link href="/">
              <div
                className={`text-primary hover:text-foreground px-4 py-2 text-sm border border-border rounded-md cursor-pointer transition-all duration-150 hover:bg-muted hover:scale-105 ${fontClass}`}
              >
                {t("notFound.backToHome")}
              </div>
            </Link>
            <span className="mx-1 text-ink">•</span>
            <div className={`text-xs text-muted-foreground ${fontClass}`}>
              {t("notFound.exploreMore")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
