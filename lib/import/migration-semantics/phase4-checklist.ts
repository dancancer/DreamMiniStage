import type { MigrationChecklist } from "./types";

export const PHASE4_MIGRATION_CHECKLIST: MigrationChecklist = {
  persona: {
    label: "Persona",
    fields: {
      name: {
        status: "retained",
        runtimeNote: "Resolved persona name remains the display-name source.",
        userNote: "Persona names are preserved for active runtime selection.",
      },
      description: {
        status: "retained",
        runtimeNote: "Persona description feeds the {{persona}} macro environment.",
        userNote: "Imported persona text still drives prompt macros.",
      },
      avatar: {
        status: "ignored",
        runtimeNote: "Persona import focuses on prompt semantics, not avatar media.",
        userNote: "Avatar-specific upstream fields are skipped during Phase 4.",
      },
      lorebookBindings: {
        status: "manual-review",
        runtimeNote: "Cross-material bindings need explicit product mapping before import.",
        userNote: "Review linked upstream persona bindings manually.",
      },
    },
    notes: [
      "Persona semantics center on stable macro resolution rather than visual metadata.",
    ],
  },
  worldbook: {
    label: "WorldBook",
    fields: {
      keys: {
        status: "retained",
        runtimeNote: "Primary keys continue to drive matching.",
        userNote: "WorldBook trigger keys are preserved.",
      },
      secondary_keys: {
        status: "retained",
        runtimeNote: "Secondary keys keep existing matching semantics.",
        userNote: "Secondary keyword logic is kept when supported.",
      },
      probability: {
        status: "retained",
        runtimeNote: "Probability remains part of matching when enabled.",
        userNote: "Probability values still participate in matching.",
      },
      useProbability: {
        status: "retained",
        runtimeNote: "useProbability still gates probability application.",
        userNote: "Probability enablement remains explicit after import.",
      },
      depth: {
        status: "retained",
        runtimeNote: "Depth survives import and continues to affect injection order.",
        userNote: "Depth-based injection is preserved.",
      },
      group: {
        status: "retained",
        runtimeNote: "Group names still participate in inclusion-group selection.",
        userNote: "WorldBook grouping remains active after import.",
      },
      groupWeight: {
        status: "retained",
        runtimeNote: "Group weight remains part of selection scoring.",
        userNote: "Group weight semantics are preserved.",
      },
      personaBindings: {
        status: "manual-review",
        runtimeNote: "Persona-specific upstream bindings do not have a direct runtime path.",
        userNote: "Review persona-linked WorldBook behavior manually.",
      },
      selectiveLogicAliases: {
        status: "downgraded",
        runtimeNote: "Only supported selective logic aliases are normalized into the local model.",
        userNote: "Some upstream selective logic variants are reduced to supported local semantics.",
      },
    },
    notes: [
      "Phase 4 treats matching and injection semantics as the source of truth.",
    ],
  },
  regex: {
    label: "Regex",
    fields: {
      findRegex: {
        status: "retained",
        runtimeNote: "Find patterns stay in the runtime script pipeline.",
        userNote: "Regex matching rules are preserved.",
      },
      replaceString: {
        status: "retained",
        runtimeNote: "Replacement text remains part of the script effect.",
        userNote: "Regex replacements are preserved.",
      },
      placement: {
        status: "retained",
        runtimeNote: "USER_INPUT runs before WorldBook matching; AI_OUTPUT runs after model output.",
        userNote: "Regex placement keeps its runtime stage ordering.",
      },
      slashHooks: {
        status: "downgraded",
        runtimeNote: "Only runtime placements backed by the local pipeline are preserved.",
        userNote: "Some upstream hook points are downgraded to supported placements.",
      },
      nestedScriptDependencies: {
        status: "manual-review",
        runtimeNote: "Inter-script dependencies require manual inspection before claiming equivalence.",
        userNote: "Review chained or dependent regex scripts manually.",
      },
    },
    notes: [
      "Phase 4 focuses on placement order and runtime effect, not editor-only metadata.",
    ],
  },
};
