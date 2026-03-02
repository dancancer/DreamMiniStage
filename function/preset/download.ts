/**
 * @input  function/preset/import, lib/data/roleplay/preset-operation, lib/storage/client-storage, lib/nodeflow/PresetNode/PresetNodeTools
 * @output getAvailableGithubPresets, getPresetDisplayName, getPresetDescription, getCurrentSystemPresetType
 * @pos    预设下载层 - GitHub 预设仓库集成与系统预设管理
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

import { importPresetFromJson } from "@/function/preset/import";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { getJSON, setJSON } from "@/lib/storage/client-storage";
import type { SystemPresetType } from "@/lib/nodeflow/PresetNode/PresetNodeTools";

interface GithubPreset {
  name: string;
  displayName: {
    zh: string;
    en: string;
  };
  description: {
    zh: string;
    en: string;
  };
  filename: string;
}

const GITHUB_API_URL = "https://api.github.com/repos/DreamMiniStage/Preset/contents";
const GITHUB_REPO_URL = "https://raw.githubusercontent.com/DreamMiniStage/Preset/main";

const AVAILABLE_PRESETS: GithubPreset[] = [];

export function getAvailableGithubPresets(): GithubPreset[] {
  return AVAILABLE_PRESETS;
}

export function getPresetDisplayName(presetName: string, language: "zh" | "en" = "zh"): string {
  const preset = AVAILABLE_PRESETS.find(p => p.name === presetName);
  if (!preset) return presetName;
  return preset.displayName[language] || preset.displayName.zh || preset.name;
}

export function getPresetDescription(presetName: string, language: "zh" | "en" = "zh"): string {
  const preset = AVAILABLE_PRESETS.find(p => p.name === presetName);
  if (!preset) return "";
  return preset.description[language] || preset.description.zh || "";
}

// export async function isPresetDownloaded(presetName: string): Promise<boolean> {
//   try {
//     const preset = AVAILABLE_PRESETS.find(p => p.name === presetName);
//     if (!preset) return false;

//     // Handle system presets
//     if (preset.filename === "system_preset") {
//       const downloadedPresets = localStorage.getItem("downloaded_github_presets");
//       if (downloadedPresets) {
//         const presets = JSON.parse(downloadedPresets);
//         return presets.includes(presetName);
//       }
//       return false;
//     }

//     // Handle GitHub presets (original logic)
//     const downloadedPresets = localStorage.getItem("downloaded_github_presets");
//     let isMarkedAsDownloaded = false;
    
//     if (downloadedPresets) {
//       const presets = JSON.parse(downloadedPresets);
//       isMarkedAsDownloaded = presets.includes(presetName);
//     }
    
//     if (isMarkedAsDownloaded) {
//       const exists = await doesPresetExist(presetName);
//       return exists;
//     }
    
//     return false;
//   } catch (error) {
//     console.error("Error checking if preset is downloaded:", error);
//     return false;
//   }
// }

// export async function doesPresetExist(presetName: string): Promise<boolean> {
//   try {
//     const allPresets = await PresetOperations.getAllPresets();
    
//     const presetConfig = AVAILABLE_PRESETS.find(p => p.name === presetName);
//     if (!presetConfig) return false;

//     return allPresets.some(preset => 
//       preset.name === presetConfig.displayName.zh || 
//       preset.name === presetConfig.displayName.en ||
//       preset.name.includes(presetConfig.displayName.zh) ||
//       preset.name.includes(presetConfig.displayName.en),
//     );
//   } catch (error) {
//     console.error("Error checking if preset exists:", error);
//     return false;
//   }
// }

// export async function downloadPresetFromGithub(presetName: string, language: "zh" | "en" = "zh"): Promise<{ success: boolean; message?: string; presetId?: string }> {
//   try {
//     const preset = AVAILABLE_PRESETS.find(p => p.name === presetName);
//     if (!preset) {
//       return { success: false, message: "Preset not found" };
//     }

//     // Handle system presets (built-in presets)
//     if (preset.filename === "system_preset") {
//       try {
//         // Set the system preset type in localStorage
//         let presetType: string;
//         if (presetName === "novel_king") {
//           presetType = "novel_king";
//         } else if (presetName === "professional_heart") {
//           presetType = "professional_heart";
//         } else {
//           presetType = "mirror_realm";
//         }
//         localStorage.setItem("system_preset_type", presetType);
//         localStorage.setItem("system_preset_name", preset.displayName[language]);
        
//         // Mark as downloaded
//         markPresetAsDownloaded(presetName);
        
//         return { 
//           success: true, 
//           presetId: `system_${presetName}`,
//           message: `${preset.displayName[language]} 系统预设已启用`,
//         };
//       } catch (error) {
//         return { success: false, message: `Failed to set system preset: ${error instanceof Error ? error.message : String(error)}` };
//       }
//     }

//     // Handle GitHub presets (original logic)
//     try {
//       const apiResponse = await fetch(GITHUB_API_URL);
//       if (apiResponse.ok) {
//         const files = await apiResponse.json();
//         if (Array.isArray(files)) {
//           const matchingFile = files.find((file: any) =>
//             file.name === preset.filename ||
//             file.name.toLowerCase() === preset.filename.toLowerCase(),
//           );
          
//           if (matchingFile && matchingFile.download_url) {
//             const response = await fetch(matchingFile.download_url);
//             if (!response.ok) {
//               return { success: false, message: `Failed to download preset: ${response.statusText}` };
//             }
            
//             const jsonContent = await response.text();
//             const localizedName = getPresetDisplayName(presetName, language);
//             const result = await importPresetFromJson(jsonContent, localizedName);
            
//             if (result.success && result.presetId) {
//               markPresetAsDownloaded(presetName);
//               return { success: true, presetId: result.presetId };
//             } else {
//               return { success: false, message: result.error || "Failed to import preset" };
//             }
//           }
//         }
//       }
//     } catch (apiError) {
//       console.error("Failed to fetch file list from GitHub API:", apiError);
//     }

//     const encodedFilename = encodeURIComponent(preset.filename);
//     const fileUrl = `${GITHUB_REPO_URL}/${encodedFilename}`;
//     const response = await fetch(fileUrl);
    
//     if (!response.ok) {
//       return { success: false, message: `Failed to download preset: ${response.statusText}` };
//     }
    
//     const jsonContent = await response.text();
//     const localizedName = getPresetDisplayName(presetName, language);
//     const result = await importPresetFromJson(jsonContent, localizedName);
    
//     if (result.success && result.presetId) {
//       markPresetAsDownloaded(presetName);
//       return { success: true, presetId: result.presetId };
//     } else {
//       return { success: false, message: result.error || "Failed to import preset" };
//     }
//   } catch (error) {
//     console.error("Error downloading preset from Github:", error);
//     return { success: false, message: `Error downloading preset: ${error instanceof Error ? error.message : String(error)}` };
//   }
// }

function markPresetAsDownloaded(presetName: string): void {
  try {
    const presets = getJSON<string[]>("downloaded_github_presets", []);

    if (!presets.includes(presetName)) {
      presets.push(presetName);
      setJSON("downloaded_github_presets", presets);
    }
  } catch (error) {
    console.error("Error marking preset as downloaded:", error);
  }
}

export function getCurrentSystemPresetType(): SystemPresetType {
  return "none";
}

// export function getCurrentSystemPresetName(): string | null {
//   try {
//     return localStorage.getItem("system_preset_name");
//   } catch (error) {
//     console.error("Error getting system preset name:", error);
//     return null;
//   }
// }
