import React, { useState } from "react";
import { Loader2, Palette, Plus, Save } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { SketchPicker } from "react-color";
import { useSymbolColorStore } from "@/contexts/SymbolColorStore";
import { toast } from "@/lib/store/toast-store";
import { Button } from "@/components/ui/button";

interface SymbolColor {
  symbol: string;
  color: string;
}

interface TagColorEditorProps {
  onSave: (colors: SymbolColor[]) => void;
  onViewSwitch?: () => void;
}

const DEFAULT_SYMBOLS_PREDEFINED = [
  "\"...\"",
  "*...*",
  "**...**",
  "[...]",
  "```...```",
  ">...",
  "[...](...)",
];

export const TagColorEditor: React.FC<TagColorEditorProps> = ({ onSave, onViewSwitch }) => {
  const { t, fontClass, serifFontClass } = useLanguage();
  const { symbolColors, updateSymbolColors, getPredefinedColors, addCustomTag } = useSymbolColorStore();
  const [newSymbol, setNewSymbol] = useState("");
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddSymbol = () => {
    const trimmedSymbol = newSymbol.trim();
    if (trimmedSymbol) {
      addCustomTag(trimmedSymbol);
      setNewSymbol("");
    }
  };

  const handleColorChange = (symbol: string, color: string) => {
    const newSymbolColors = symbolColors.map(sc => 
      sc.symbol === symbol ? { ...sc, color } : sc,
    );
    updateSymbolColors(newSymbolColors);
    if (onViewSwitch) {
      onViewSwitch();
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(symbolColors);
      toast.success(t("characterChat.saveSuccess") || "Settings saved successfully");
      if (onViewSwitch) {
        onViewSwitch();
      }
    } catch (error) {
      console.error("Failed to save color settings:", error);
      toast.error(t("characterChat.saveFailed") || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSymbol = (symbolToDelete: string) => {
    if (DEFAULT_SYMBOLS_PREDEFINED.includes(symbolToDelete)) return;
    updateSymbolColors(symbolColors.filter(sc => sc.symbol !== symbolToDelete));
  };

  const handlePredefinedColorSelect = (symbol: string, color: string) => {
    handleColorChange(symbol, color);
    setActiveColorPicker(null);
  };

  return (
    <div className={`p-2 sm:p-4 ${fontClass} relative`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-primary-500/10 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md bg-gradient-to-br from-primary-500/20 to-primary-600/30 flex items-center justify-center border border-primary-500/30  ">
            <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-400" />
          </div>
          <h3 className={"text-base sm:text-lg font-semibold  "}>
            {t("characterChat.tagColorEditor")}
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder={t("characterChat.enterSymbol")}
              className="relative z-10 w-full px-3 py-2 bg-gradient-to-br from-deep via-muted-surface to-deep text-cream-soft rounded-md border border-border/60 focus:border-primary-500/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-300 hover:border-border backdrop-blur-sm  text-sm sm:text-base"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleAddSymbol}
            className="h-auto relative group px-3 sm:px-4 py-2 bg-gradient-to-r from-ember to-coal hover:from-muted-surface hover:to-ember text-primary-soft hover:text-primary-soft text-xs sm:text-sm font-medium border-border"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="relative z-10 flex items-center space-x-1.5 sm:space-x-2">
              <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform duration-300 group-hover:scale-110" />
              <span>{t("characterChat.add")}</span>
            </span>
          </Button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {symbolColors.map(({ symbol, color }) => (
            <div 
              key={symbol} 
              className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 ${
                activeColorPicker === symbol ? "z-[999]" : "z-0"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 mb-2 sm:mb-0">
                <span className={" text-base sm:text-lg text-cream-soft"}>{symbol}</span>
              </div>
              <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                <div className="flex gap-1.5 sm:gap-2">
                  {getPredefinedColors(symbol).map((predefinedColor: string) => (
                    <Button
                      key={predefinedColor}
                      variant="ghost"
                      size="icon"
                      className="relative group/color h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-white/20 hover:scale-110 p-0"
                      style={{ backgroundColor: predefinedColor }}
                      onClick={() => handlePredefinedColorSelect(symbol, predefinedColor)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full opacity-0 group-hover/color:opacity-100 transition-opacity duration-300"></div>
                    </Button>
                  ))}
                </div>

                <div className="relative">
                  <div
                    className="relative group/color w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer border border-white/20 hover:scale-110 transition-transform  "
                    style={{ backgroundColor: color }}
                    onClick={() => setActiveColorPicker(activeColorPicker === symbol ? null : symbol)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded opacity-0 group-hover/color:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  {activeColorPicker === symbol && (
                    <div className="absolute right-0 top-full mt-2 z-50">
                      <div className="fixed inset-0" onClick={() => setActiveColorPicker(null)} />
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent rounded-md blur-xl"></div>
                        <div className="scale-75 sm:scale-100 origin-top-right">
                          <SketchPicker
                            color={color}
                            onChange={(colorResult) => handleColorChange(symbol, colorResult.hex)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!DEFAULT_SYMBOLS_PREDEFINED.includes(symbol) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteSymbol(symbol)}
                    className="relative group/delete h-auto w-auto p-1 text-red-400 hover:text-red-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent rounded opacity-0 group-hover/delete:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10 text-base sm:text-lg">×</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={handleSave}
          disabled={isSaving}
          className={`h-auto relative group mt-4 sm:mt-6 w-full px-3 sm:px-4 py-2 bg-gradient-to-r from-ember to-coal hover:from-muted-surface hover:to-ember text-primary-soft hover:text-primary-soft text-xs sm:text-sm font-medium border-border ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <span className="relative z-10 flex items-center justify-center space-x-1.5 sm:space-x-2">
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin sm:h-4 sm:w-4 text-primary-soft" />
            ) : (
              <Save className="h-3 w-3 transition-transform duration-300 group-hover:scale-110 sm:h-3.5 sm:w-3.5" />
            )}
            <span>{isSaving ? t("characterChat.saving") : t("characterChat.saveChanges")}</span>
          </span>
        </Button>
      </div>
    </div>
  );
};
