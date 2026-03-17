import { beforeEach, describe, expect, it } from "vitest";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import { PersonaDescriptionPosition } from "@/lib/models/persona-model";
import { usePersonaStore } from "@/lib/store/persona-store";
import { getPersonaDescriptionForDialogue } from "@/hooks/useCurrentPersona";

function resetPersonaStore(): void {
  usePersonaStore.setState({
    personas: {},
    connections: [],
    defaultPersonaId: null,
    chatLocks: {},
    activePersonaId: null,
    isTemporary: false,
  });
}

describe("phase4 persona macro baseline", () => {
  beforeEach(() => {
    resetPersonaStore();
  });

  it("uses resolved persona description in {{persona}} macros", () => {
    const store = usePersonaStore.getState();
    const resolvedPersonaId = store.addPersona({
      name: "Investigator",
      avatarPath: "",
      description: "冷静的调查员",
      position: PersonaDescriptionPosition.IN_PROMPT,
      depth: 4,
      role: "system",
    });
    const temporaryPersonaId = store.addPersona({
      name: "Temporary",
      avatarPath: "",
      description: "冲动的临时身份",
      position: PersonaDescriptionPosition.IN_PROMPT,
      depth: 4,
      role: "system",
    });

    store.connectToCharacter(resolvedPersonaId, "char-1");
    store.setActivePersona(temporaryPersonaId, true);

    const evaluator = new STMacroEvaluator();
    const personaDescription = getPersonaDescriptionForDialogue(
      "dialogue-1",
      "char-1",
    );
    const rendered = evaluator.evaluate("{{persona}}", {
      persona: personaDescription,
    });

    expect(rendered).toBe("冷静的调查员");
  });
});
