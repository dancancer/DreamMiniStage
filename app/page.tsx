/**
 * Main landing page component for DreamMiniStage
 * 
 * This file contains the home page implementation with the following features:
 * - Animated landing page with fantasy-themed UI
 * - Multi-language support
 * - Responsive design with mobile support
 * 
 * Dependencies:
 * - next/link: For client-side navigation
 * - Custom hooks: useLanguage
 */

import { homeMetadata } from "./metadata";
export const metadata = homeMetadata;

import { Suspense } from "react";
import HomeContent from "@/components/HomeContent";

/**
 * Loading component shown while the main content is being loaded
 * Displays an animated loading spinner with fantasy-themed styling
 * 
 * @returns {JSX.Element} The loading screen component
 */
function HomeLoading() {
  return null;
}

/**
 * Root component that wraps the home page content with Suspense
 * Provides fallback loading state while content is being loaded
 * 
 * @returns {JSX.Element} The complete home page with loading state handling
 */
export default function Home() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
