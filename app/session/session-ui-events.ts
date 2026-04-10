export const SESSION_OPEN_BRANCHES_EVENT = "DreamMiniStage:open-branches";
export const SESSION_OPEN_USER_NAME_MODAL_EVENT = "DreamMiniStage:open-user-name-modal";
export const SESSION_OPEN_SCRIPT_DEBUG_EVENT = "DreamMiniStage:open-script-debug";
export const SESSION_EXPORT_JSONL_EVENT = "DreamMiniStage:export-jsonl";
export const SESSION_IMPORT_JSONL_EVENT = "DreamMiniStage:import-jsonl";

export function dispatchOpenBranchesEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_OPEN_BRANCHES_EVENT));
}

export function dispatchOpenUserNameModalEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_OPEN_USER_NAME_MODAL_EVENT));
}

export function dispatchOpenScriptDebugEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_OPEN_SCRIPT_DEBUG_EVENT));
}

export function dispatchExportJsonlEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SESSION_EXPORT_JSONL_EVENT));
}

export function dispatchImportJsonlEvent(file: File) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<File>(SESSION_IMPORT_JSONL_EVENT, { detail: file }));
}
