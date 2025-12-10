/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                        图片画廊组件                                        ║
 * ║                                                                           ║
 * ║  功能：显示提示词中的图片、支持展开收起、缩略图显示                         ║
 * ║  设计原则：统一处理、无特殊情况、优雅降级                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { Image as ImageIcon, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImageGalleryProps, PromptImage } from "@/types/prompt-viewer";
import { CSS_CLASSES, UI_CONFIG } from "@/lib/prompt-viewer/constants";

/* ═══════════════════════════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════════════════════════ */

export function ImageGallery({
  images,
  isExpanded,
  onToggleExpanded,
}: ImageGalleryProps) {
  // ========== 状态管理 ==========

  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // ========== 计算属性 ==========

  const validImages = useMemo(() => {
    return images.filter(image => image.url && !failedImages.has(image.id));
  }, [images, failedImages]);

  const imageCount = validImages.length;
  const hasImages = imageCount > 0;

  // ========== 事件处理 ==========

  const handleToggleExpanded = useCallback(() => {
    onToggleExpanded();
  }, [onToggleExpanded]);

  const handleImageError = useCallback((imageId: string) => {
    setFailedImages(prev => new Set(prev).add(imageId));
  }, []);

  // ========== 渲染 ==========

  if (!hasImages) {
    return null;
  }

  return (
    <div className={cn(
      CSS_CLASSES.IMAGE_GALLERY,
      "bg-overlay border border-border rounded-md",
    )}>
      {/* 画廊头部 */}
      <GalleryHeader
        imageCount={imageCount}
        isExpanded={isExpanded}
        onToggle={handleToggleExpanded}
      />

      {/* 画廊内容 */}
      {isExpanded && (
        <GalleryContent
          images={validImages}
          onImageError={handleImageError}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   画廊头部组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface GalleryHeaderProps {
  imageCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function GalleryHeader({ imageCount, isExpanded, onToggle }: GalleryHeaderProps) {
  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      className={cn(
        CSS_CLASSES.IMAGE_GALLERY_TOGGLE,
        "w-full justify-start gap-3 p-4",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted-surface/50 transition-colors duration-200",
        "border-0 rounded-none",
      )}
    >
      {/* 展开/收起图标 */}
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0" />
      )}

      {/* 图片图标 */}
      <ImageIcon className="h-4 w-4 shrink-0" />

      {/* 标题文本 */}
      <span className="text-sm font-medium">
        图片画廊 ({imageCount} 张)
      </span>

      {/* 状态指示 */}
      {isExpanded && (
        <span className="ml-auto text-xs text-muted-foreground">
          点击收起
        </span>
      )}
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   画廊内容组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface GalleryContentProps {
  images: readonly PromptImage[];
  onImageError: (imageId: string) => void;
}

function GalleryContent({ images, onImageError }: GalleryContentProps) {
  if (images.length === 0) {
    return (
      <div className="p-4 pt-0">
        <EmptyGallery message="暂无可显示的图片" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-0">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((image) => (
          <ImageThumbnail
            key={image.id}
            image={image}
            onError={() => onImageError(image.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   图片缩略图组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface ImageThumbnailProps {
  image: PromptImage;
  onError: () => void;
}

function ImageThumbnail({ image, onError }: ImageThumbnailProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // ========== 事件处理 ==========

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError();
  }, [onError]);

  const handleClick = useCallback(() => {
    if (!hasError && image.url) {
      // 在新窗口中打开图片
      window.open(image.url, "_blank", "noopener,noreferrer");
    }
  }, [hasError, image.url]);

  // ========== 渲染 ==========

  return (
    <div className={cn(
      CSS_CLASSES.IMAGE_THUMBNAIL,
      "relative aspect-square rounded-md overflow-hidden",
      "bg-muted-surface border border-border",
      "group cursor-pointer transition-all duration-200",
      "hover:border-primary-soft hover:shadow-md",
      hasError && "cursor-not-allowed opacity-50",
    )}>
      {/* 加载状态 */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary-soft border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 错误状态 */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
          <AlertCircle className="h-6 w-6 mb-1" />
          <span className="text-xs">加载失败</span>
        </div>
      )}

      {/* 图片内容 */}
      {!hasError && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={`提示词图片 ${image.id}`}
            className={cn(
              "w-full h-full object-cover transition-all duration-200",
              "group-hover:scale-105",
              isLoading && "opacity-0",
            )}
            style={{ maxHeight: `${UI_CONFIG.MAX_IMAGE_HEIGHT}px` }}
            onLoad={handleLoad}
            onError={handleError}
            onClick={handleClick}
            loading="lazy"
          />

          {/* 悬停遮罩 */}
          <div className={cn(
            "absolute inset-0 bg-black/20 opacity-0",
            "group-hover:opacity-100 transition-opacity duration-200",
            "flex items-center justify-center",
          )}>
            <div className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">
              点击查看
            </div>
          </div>
        </>
      )}

      {/* 图片类型标识 */}
      <div className="absolute top-2 right-2">
        <ImageTypeIndicator type={image.type} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   图片类型指示器
   ═══════════════════════════════════════════════════════════════════════════ */

interface ImageTypeIndicatorProps {
  type: PromptImage["type"];
}

function ImageTypeIndicator({ type }: ImageTypeIndicatorProps) {
  const config = {
    base64: {
      label: "B64",
      className: "bg-blue-500/80 text-white",
    },
    url: {
      label: "URL",
      className: "bg-green-500/80 text-white",
    },
  };

  const { label, className } = config[type];

  return (
    <div className={cn(
      "px-1.5 py-0.5 rounded text-xs font-mono font-medium",
      "backdrop-blur-sm",
      className,
    )}>
      {label}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   空画廊组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface EmptyGalleryProps {
  message: string;
}

function EmptyGallery({ message }: EmptyGalleryProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
      <div className="w-12 h-12 rounded-full bg-muted-surface/50 flex items-center justify-center mb-3">
        <ImageIcon className="h-6 w-6" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   导出
   ═══════════════════════════════════════════════════════════════════════════ */

export default ImageGallery;
