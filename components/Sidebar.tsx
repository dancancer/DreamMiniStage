"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/app/i18n";
import { isUpdateAvailable, fetchLatestRelease } from "@/utils/version-compare";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorageString } from "@/hooks/useLocalStorage";
import PWAInstallButton from "./PWAInstallButton";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Home, 
  Users, 
  LogIn, 
  Github,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Current app version from package.json
const CURRENT_VERSION = "1.1.9";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  openLoginModal: () => void;
  openAccountModal?: () => void;
  openDownloadModal: () => void;
}

export default function Sidebar({ isOpen, toggleSidebar, openLoginModal, openAccountModal, openDownloadModal }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const [isHomeOpen, setIsHomeOpen] = useState(true);
  const [isGameOpen, setIsGameOpen] = useState(true);

  const { t, language, fontClass } = useLanguage();
  const [animationComplete, setAnimationComplete] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<{version: string, url: string} | null>(null);
  const [hasCheckedUpdate, setHasCheckedUpdate] = useState(false);
  const { setValue: setSidebarState } = useLocalStorageString("sidebarState", "open");

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimationComplete(true), 50);
      return () => clearTimeout(timer);
    } else {
      setAnimationComplete(false);
    }
  }, [isOpen]);

  // Check for updates on component mount
  useEffect(() => {
    const checkForUpdates = async () => {
      if (hasCheckedUpdate) return;
      
      try {
        const latestRelease = await fetchLatestRelease();
        if (latestRelease && isUpdateAvailable(CURRENT_VERSION, latestRelease.version)) {
          setUpdateInfo(latestRelease);
        }
      } catch (error) {
        console.warn("Failed to check for updates:", error);
      } finally {
        setHasCheckedUpdate(true);
      }
    };

    // Delay the check to avoid blocking initial render
    const timer = setTimeout(checkForUpdates, 2000);
    return () => clearTimeout(timer);
  }, [hasCheckedUpdate]);

  const handleOpenAccount = () => {
    if (openAccountModal) {
      openAccountModal();
    }
  };

  const isHomeActive = pathname === "/";
  // 游戏区域活动状态：/session（新路由）或 /character（兼容旧路由）
  const isGameAreaActive = pathname.startsWith("/session") || pathname.startsWith("/character");
  const isCreatorAreaActive = pathname.startsWith("/creator-input") || pathname.startsWith("/creator-area");
  const sectionTitleClass = "flex justify-between items-center text-xs text-text-muted uppercase tracking-wider font-medium text-2xs transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap";
  const sectionLabelWrapperClass = "ml-2 transition-all duration-300 ease-in-out overflow-hidden";

  return (
    <div
      className={`h-full  magic-border text-text transition-all duration-300 ease-in-out flex flex-col ${isOpen ? "w-72" : "w-16"} z-50`}
    >
      <div className="flex justify-between items-center h-16 py-3 px-4">
        <div className={`logo-magic-container transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
          <div className="flex items-center h-10">
            <div className={"w-[80px] h-10 flex items-center"}>
              <Image src="/logo-DreamMiniStage.png" alt="DreamMiniStage" width={80} height={20} className="object-contain" />
            </div>
            <span className={"ml-1 text-lg font-cinzel font-bold tracking-wider h-10 flex items-center -translate-x-3 [font-family:var(--font-cinzel)]"}>
              <span className={"  font-cinzel"}>DreamMiniStage</span>
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            toggleSidebar();
            setSidebarState(isOpen ? "closed" : "open");
            document.documentElement.style.setProperty(
              "--app-sidebar-width",
              isOpen ? "4rem" : "-1rem",
            );
          }}
          className="h-8 w-8 text-cream bg-surface border-stroke hover:bg-accent hover:text-accent-foreground hover:border-accent"
          aria-label={isOpen ? (language === "zh" ? "收起侧边栏" : "Collapse Sidebar") : (language === "zh" ? "展开侧边栏" : "Expand Sidebar")}
        >
          {isOpen ? (
            <ChevronLeft size={16} className="transition-transform duration-300" />
          ) : (
            <ChevronRight size={16} className="transition-transform duration-300" />
          )}
        </Button>
      </div>
      <div className="mx-2 my-1 menu-divider"></div>
      <nav className={"mt-3 flex-none px-2"}>
        <ul className="space-y-1">
          <li className="min-h-[10px]">
            <div className="mb-4">
              <div className={`${sectionTitleClass} ${isOpen ? "px-2 py-1 max-w-full opacity-100 w-full" : "px-0 py-0 max-w-0 w-0 opacity-0"}`}>
                <span>{t("sidebar.home")}</span>
                {isOpen && (
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsHomeOpen(!isHomeOpen)}
                    className="h-5 w-5 text-text-muted hover:text-primary-400"
                    aria-label={isHomeOpen ? t("sidebar.collapseHome") : t("sidebar.expandHome")}
                  >
                    <ChevronDown size={12} className={`transition-transform duration-300 ${isHomeOpen ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </div>
              <div className={`overflow-hidden transition-all duration-300 ${isOpen ? (isHomeOpen ? "max-h-20 opacity-100 mb-1" : "max-h-0 opacity-0 mb-0") : "max-h-20 opacity-100 mb-1"} mx-1`}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {!isOpen ? (
                    <Link href="/" className={`menu-item flex justify-center p-2 rounded-md cursor-pointer transition-all duration-300 ${isHomeActive ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}>
                      <div className={`flex items-center justify-center text-cream bg-surface rounded-md border border-stroke  transition-all duration-300 w-8 h-8 ${isHomeActive ? "border-accent text-accent-foreground shadow-[0_0_10px_rgba(0,0,0,0.35)]" : "group-hover:border-accent hover:text-accent-foreground hover:border-accent "}`}>
                        <Home size={16} />
                      </div>
                    </Link>
                  ) : (
                    <Link href="/" className="focus:outline-none group relative overflow-hidden rounded-md w-full transition-all duration-300">
                      <div className={`absolute inset-0 transition-opacity duration-300 ${isHomeActive ? "bg-gradient-to-br from-primary-500/20 via-primary-500/5 to-transparent opacity-100" : "bg-gradient-to-br from-primary-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100"}`}></div>
                      <div className="relative flex items-center p-2 w-full transition-all duration-300 z-10">
                        <div className={`absolute inset-0 w-full h-full bg-stroke transition-opacity duration-300 ${isHomeActive ? "opacity-20" : "opacity-0 group-hover:opacity-10"}`}></div>
                        <div className={`absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-primary-bright to-transparent transition-all duration-500 ${isHomeActive ? "w-full" : "w-0 group-hover:w-full"}`}></div>
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 text-cream bg-surface rounded-md border border-stroke  transition-all duration-300 ${isHomeActive ? "border-primary-500/80 text-primary-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]" : "group-hover:border-stroke-strong group-hover:text-primary-400 group-hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"}`}>
                          <Home size={16} />
                        </div>
                        <div className={`${sectionLabelWrapperClass} ${isOpen ? "opacity-100 delay-[50ms]" : "opacity-0 delay-0"}`}>
                          <span className={`magical-text whitespace-nowrap block text-sm transition-colors duration-300 ${fontClass} ${isHomeActive ? "text-primary-300" : "group-hover:text-primary-400"}`}>
                            {isOpen && t("sidebar.home").split("").map((char, index) => (
                              <span 
                                key={index} 
                                className="inline-block transition-all duration-300" 
                                style={{ 
                                  opacity: animationComplete ? 1 : 0,
                                  transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                                  transitionDelay: `${100 + index * 30}ms`,
                                  width: char === " " ? "0.25em" : "auto",
                                }}
                              >
                                {char}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </li>
          
          <li className="min-h-[15px]">
            <div className="mb-4">
              <div className={`${sectionTitleClass} ${isOpen ? "px-2 py-1 max-w-full opacity-100 w-full" : "px-0 py-0 max-w-0 w-0 opacity-0"}`}>
                <span>{t("sidebar.gameArea")}</span>
                {isOpen && (
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsGameOpen(!isGameOpen)}
                    className="h-5 w-5 text-text-muted hover:text-primary-400"
                    aria-label={isGameOpen ? t("sidebar.collapseCreation") : t("sidebar.expandCreation")}
                  >
                    <ChevronDown size={12} className={`transition-transform duration-300 ${isGameOpen ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${isOpen ? (isGameOpen ? "max-h-20 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0") : "max-h-20 opacity-100 mt-1"} mx-1`}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  {!isOpen ? (
                    <Link href="/character-cards" className={`menu-item flex justify-center p-2 rounded-md cursor-pointer transition-all duration-300 ${isGameAreaActive ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}>
                      <div className={`flex items-center justify-center text-cream bg-surface rounded-md border border-stroke  transition-all duration-300 w-8 h-8 ${isGameAreaActive ? "border-accent text-accent-foreground shadow-[0_0_10px_rgba(0,0,0,0.35)]" : "group-hover:border-accent hover:text-accent-foreground hover:border-accent "}`}>
                        <Users size={16} />
                      </div>
                    </Link>
                  ) : (
                    <Link href="/character-cards" className="focus:outline-none group relative overflow-hidden rounded-md w-full transition-all duration-300">
                      <div className={`absolute inset-0 transition-opacity duration-300 ${isGameAreaActive ? "bg-gradient-to-br from-primary-500/20 via-primary-500/5 to-transparent opacity-100" : "bg-gradient-to-br from-primary-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100"}`}></div>
                      <div className="relative flex items-center p-2 w-full transition-all duration-300 z-10">
                        <div className={`absolute inset-0 w-full h-full bg-stroke transition-opacity duration-300 ${isGameAreaActive ? "opacity-20" : "opacity-0 group-hover:opacity-10"}`}></div>
                        <div className={`absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-primary-bright to-transparent transition-all duration-500 ${isGameAreaActive ? "w-full" : "w-0 group-hover:w-full"}`}></div>
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 text-cream bg-surface rounded-md border border-stroke  transition-all duration-300 ${isGameAreaActive ? "border-primary-500/80 text-primary-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]" : "group-hover:border-stroke-strong group-hover:text-primary-400 group-hover:shadow-[0_0_8px_rgba(251,146,60,0.4)]"}`}>
                          <Users size={16} />
                        </div>
                        <div className={`${sectionLabelWrapperClass} ${isOpen ? "opacity-100 delay-[50ms]" : "opacity-0 delay-0"}`}>
                          <span className={`magical-text whitespace-nowrap block text-sm transition-colors duration-300 ${fontClass} ${isGameAreaActive ? "text-primary-300" : "group-hover:text-primary-400"}`}>
                            {isOpen && t("sidebar.characterCards").split("").map((char, index) => (
                              <span 
                                key={index} 
                                className="inline-block transition-all duration-300" 
                                style={{ 
                                  opacity: animationComplete ? 1 : 0,
                                  transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                                  transitionDelay: `${200 + index * 30}ms`,
                                  width: char === " " ? "0.25em" : "auto",
                                }}
                              >
                                {char}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </li>
        </ul>
      </nav>
      <div className="relative mt-auto pt-4 px-2 mb-3 transition-all duration-300 overflow-hidden group/footer">
        {/* <div className="absolute top-0 left-0 right-0 h-[0.5px] bg-gradient-to-r from-transparent via-primary-bright to-transparent opacity-70"></div>
        <div className="absolute top-0 left-0 right-0 h-[0.5px] bg-gradient-to-r from-transparent via-primary-bright to-transparent opacity-40 blur-[1px] translate-y-[0.5px]"></div>
        <div className="absolute top-[-1px] w-8 h-[2px] bg-gradient-to-r from-transparent via-primary-bright to-transparent opacity-0 group-hover/footer:opacity-80 blur-[1px] transition-all duration-500 ease-in-out left-[-10%] animate-[moveRight_3s_ease-in-out_infinite]"></div>

        <div className="absolute top-0 left-1/4 right-1/4 h-[0.5px] w-[2px] rounded-full bg-primary-bright opacity-0 group-hover/footer:opacity-90 transition-opacity duration-500 delay-100"></div>
        <div className="absolute top-0 left-2/4 h-[2px] w-[2px] rounded-full bg-primary-bright opacity-0 group-hover/footer:opacity-90 transition-opacity duration-500 delay-300"></div>
        <div className="absolute top-0 left-3/4 h-[2px] w-[2px] rounded-full bg-primary-bright opacity-0 group-hover/footer:opacity-90 transition-opacity duration-500 delay-500"></div>
        
        <style jsx>{`
          @keyframes moveRight {
            0% { transform: translateX(0); }
            100% { transform: translateX(calc(100vw)); }
          }
        `}</style> */}
        
        <div className="mb-2">
          {!isAuthenticated ? (
            <Button 
              variant="ghost"
              onClick={openLoginModal}
              data-tour="login-button"
              className={`h-auto group relative overflow-hidden w-full ${!isOpen ? "p-2 justify-center" : "py-1.5 px-2 justify-center"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-layer/0 to-canvas/0 opacity-0 group-hover:opacity-80 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center w-full transition-all duration-300 z-10">
                <div className={`${isOpen ? "w-6 h-6" : "w-8 h-8"} flex items-center justify-center flex-shrink-0 text-primary-bright group-hover:text-highlight transition-colors duration-300`}>
                  <LogIn size={isOpen ? 14 : 16} className="transition-transform duration-300 group-hover:scale-110" />
                </div>
                {isOpen && (
                  <div className={`${sectionLabelWrapperClass} ${isOpen ? "opacity-100 delay-[50ms]" : "opacity-0 delay-0"}`}>
                    <span className={`magical-text whitespace-nowrap block text-xs font-medium  ${fontClass}`}>
                      {isOpen && t("sidebar.nologin").split("").map((char, index) => (
                        <span 
                          key={index} 
                          className="inline-block transition-all duration-300" 
                          style={{ 
                            opacity: animationComplete ? 1 : 0,
                            transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                            transitionDelay: `${250 + index * 30}ms`,
                            width: char === " " ? "0.25em" : "auto",
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 w-full h-full bg-stroke opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-primary-bright to-transparent w-0 group-hover:w-full transition-all duration-500"></div>
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleOpenAccount}
              className={`h-auto group relative overflow-hidden w-full ${!isOpen ? "p-2 justify-center" : "py-1.5 px-2 justify-center"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-layer/0 to-canvas/0 opacity-0 group-hover:opacity-80 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center w-full transition-all duration-300 z-10">
                <div className={`${isOpen ? "w-6 h-6" : "w-8 h-8"} flex items-center justify-center flex-shrink-0 text-primary-bright group-hover:text-highlight transition-colors duration-300 `}>
                  <Users size={isOpen ? 14 : 16} className="transition-transform duration-300 group-hover:scale-110" />
                </div>
                {isOpen && (
                  <div className={`${sectionLabelWrapperClass} ${isOpen ? "opacity-100 delay-[50ms]" : "opacity-0 delay-0"}`}>
                    <div>
                      <span className={`magical-text whitespace-nowrap block text-xs font-medium  ${fontClass}`}>
                        {isOpen && user?.username.split("").map((char, index) => (
                          <span 
                            key={index} 
                            className="inline-block transition-all duration-300" 
                            style={{ 
                              opacity: animationComplete ? 1 : 0,
                              transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                              transitionDelay: `${250 + index * 30}ms`,
                              width: char === " " ? "0.25em" : "auto",
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className={`magical-text whitespace-nowrap block text-xs font-medium  ${fontClass}`}>
                        {isOpen && t("sidebar.openAccount").split("").map((char, index) => (
                          <span 
                            key={index} 
                            className="inline-block transition-all duration-300" 
                            style={{ 
                              opacity: animationComplete ? 1 : 0,
                              transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                              transitionDelay: `${250 + index * 30}ms`,
                              width: char === " " ? "0.25em" : "auto",
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 w-full h-full bg-stroke opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-primary-bright to-transparent w-0 group-hover:w-full transition-all duration-500"></div>
            </Button>
          )}
        </div>

        {/* PWA Install Button */}
        <PWAInstallButton 
          isOpen={isOpen} 
          animationComplete={animationComplete} 
          fontClass={fontClass}
          onOpenDownloadModal={openDownloadModal}
        />

        <div>
          <a 
            href="https://github.com/DreamMiniStage/DreamMiniStage.ai"
            target="_blank"
            rel="noopener noreferrer"
            className={`focus:outline-none group relative overflow-hidden rounded-md w-full transition-all duration-300 ${!isOpen ? "p-2 flex justify-center" : "py-1.5 px-2 flex items-center justify-center"}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-layer/0 to-canvas/0 opacity-0 group-hover:opacity-80 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-center transition-all duration-300 z-10">
              <div className={`${isOpen ? "w-6 h-6" : "w-8 h-8"} flex items-center justify-center flex-shrink-0 text-primary-bright group-hover:text-highlight transition-colors duration-300`}>
                <Github size={isOpen ? 14 : 16} className="transition-transform duration-300 group-hover:scale-110" fill="currentColor" />
              </div>
              {isOpen && (
                <div className={`${sectionLabelWrapperClass} ${isOpen ? "opacity-100 delay-[50ms]" : "opacity-0 delay-0"}`}>
                  <span className={`magical-text whitespace-nowrap block text-xs font-medium  ${fontClass}`}>
                    {isOpen && "Star us on GitHub".split("").map((char, index) => (
                      <span 
                        key={index} 
                        className="inline-block transition-all duration-300" 
                        style={{ 
                          opacity: animationComplete ? 1 : 0,
                          transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                          transitionDelay: `${250 + index * 30}ms`,
                          width: char === " " ? "0.25em" : "auto",
                        }}
                      >
                        {char}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
            <div className="absolute inset-0 w-full h-full bg-stroke opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-primary-bright to-transparent w-0 group-hover:w-full transition-all duration-500"></div>
          </a>
        </div>

        {/* Update notification */}
        {updateInfo && (
          <div className="mt-2">
            <a 
              href={updateInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`focus:outline-none group relative overflow-hidden rounded-md w-full transition-all duration-300 ${!isOpen ? "p-2 flex justify-center" : "py-1.5 px-2 flex items-center justify-center"}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />
              <div className="absolute inset-0 w-full h-full bg-stroke opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-0" />
              <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-green-400 to-transparent w-0 group-hover:w-full transition-all duration-500 z-5" />
              <div className="relative flex items-center justify-center transition-all duration-300 z-10">
                <div className={`${isOpen ? "w-6 h-6" : "w-8 h-8"} flex items-center justify-center flex-shrink-0 text-green-400 group-hover:text-green-300 transition-colors duration-300`}>
                  <Settings size={isOpen ? 14 : 16} className="transition-transform duration-300 group-hover:scale-110" />
                </div>
                {isOpen && (
                  <div className={`${sectionLabelWrapperClass} ${isOpen ? "opacity-100 delay-[50ms]" : "opacity-0 delay-0"}`}>
                    <span className={`magical-text whitespace-nowrap block text-xs font-medium text-green-400 group-hover:text-green-300 transition-colors duration-300 ${fontClass}`}>
                      {isOpen && t("sidebar.goToUpdate").split("").map((char, index) => (
                        <span 
                          key={index} 
                          className="inline-block transition-all duration-300" 
                          style={{ 
                            opacity: animationComplete ? 1 : 0,
                            transform: animationComplete ? "translateY(0)" : "translateY(8px)",
                            transitionDelay: `${250 + index * 30}ms`,
                            width: char === " " ? "0.25em" : "auto",
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
