/**
 * Creator Area Banner Component
 * 
 * A header banner component for the creator area interface.
 * Features:
 * - Integrated header within the normal document flow (like CharacterChatHeader)
 * - Fantasy-themed design with magical elements
 * - Responsive layout for mobile and desktop
 * - Session title and objective display
 * - Back navigation button
 * - Elegant background and border effects
 * 
 * Dependencies:
 * - lucide-react: For icons
 * - ResearchSession: From agent model definitions
 */

"use client";

import React from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ResearchSession } from "@/lib/models/agent-model";
import { Button } from "@/components/ui/button";

interface CreatorAreaBannerProps {
  session: ResearchSession | null;
  onBack: () => void;
  fontClass: string;
  serifFontClass: string;
}

/**
 * Header banner component for creator area
 * 
 * @param session - Current research session data
 * @param onBack - Callback function for back navigation
 * @param fontClass - Font class for regular text
 * @param serifFontClass - Font class for serif text (titles)
 * @returns {JSX.Element} The header banner component
 */
export default function CreatorAreaBanner({ 
  session, 
  onBack, 
  fontClass, 
  serifFontClass, 
}: CreatorAreaBannerProps) {
  return (
    <div className="border-b border-border p-4 flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 flex-1">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center space-x-3">
            <h2 className={"text-lg md:text-xl text-cream-soft magical-text  truncate max-w-[200px] md:max-w-[300px]"}>
              {session?.title || "创作工坊"}
            </h2>
            <div className="p-1.5 rounded-md bg-gradient-to-r from-primary-500/20 to-orange-400/20 border border-primary-500/30 flex-shrink-0">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary-400 fantasy-glow" />
            </div>
          </div>
        </div>

        {session?.research_state?.main_objective && (
          <div className="flex-1 min-w-0">
            <p className={`text-primary-soft/80 text-xs md:text-sm leading-relaxed line-clamp-1 ${fontClass}`}>
              {session.research_state.main_objective}
            </p>
          </div>
        )}
      </div>

      {/* Right side - Optional status indicator */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        <div className="hidden sm:flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
          <span className={`text-xs text-primary-soft/70 ${fontClass}`}>
            Active
          </span>
        </div>
      </div>
    </div>
  );
} 
