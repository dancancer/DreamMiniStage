// qa-repair —— 导入期 QA-repair 编排器。
// 把"调 LLM 取 typed patch"放在 QaModelPort 接缝后：prod adapter 走 model-gateway，
// 测试用 fake 返回 fixture。编排器只负责：组装输入 -> 校验 -> 按确定性 risk 分流
// （low 自动应用，medium/high 留待用户确认）。risk 由 repair-patch 的 path map 决定，
// LLM 不能自评（见 ADR-0004）。
import type { ImportedAssetBundle, ImportDiagnostic } from "./bundle-types";
import { diagnoseImportedAssetBundle } from "./bundle-diagnostics";
import {
  applyAutoRepairPatch,
  isRepairablePath,
  validateRepairOutput,
  type LlmQaInput,
  type ValidatedRepairPatch,
} from "./repair-patch";

/** QA 模型端口：输入受控 LlmQaInput，返回待校验的原始 patch 输出。 */
export type QaModelPort = (input: LlmQaInput) => Promise<unknown>;

export interface QaRepairOutcome {
  /** 自动应用 low-risk patch 后的 bundle（原 bundle 不被修改）。 */
  bundle: ImportedAssetBundle;
  /** 已自动应用的 low-risk patch。 */
  autoApplied: ValidatedRepairPatch[];
  /** medium/high patch，需用户确认后才能应用。 */
  pendingConfirmation: ValidatedRepairPatch[];
}

export async function runImportQaRepair(
  bundle: ImportedAssetBundle,
  qaModel: QaModelPort,
): Promise<QaRepairOutcome> {
  const diagnostics = diagnoseImportedAssetBundle(bundle);
  const input: LlmQaInput = {
    bundleId: bundle.bundleId,
    schemaVersion: bundle.schemaVersion,
    diagnostics,
    repairablePaths: collectRepairablePaths(diagnostics),
  };

  const validated = validateRepairOutput(await qaModel(input));

  const autoApplied: ValidatedRepairPatch[] = [];
  const pendingConfirmation: ValidatedRepairPatch[] = [];
  let repaired = bundle;

  for (const entry of validated) {
    if (entry.autoApply) {
      repaired = applyAutoRepairPatch(repaired, entry);
      autoApplied.push(entry);
    } else {
      pendingConfirmation.push(entry);
    }
  }

  return { bundle: repaired, autoApplied, pendingConfirmation };
}

// repairablePaths 必须是模型可直接用作 patch targetPath 的合法 JSON Pointer。
// 诊断的 targetPath 是 dot-path（且数组/ID 路径与 bundle 结构的下标制式不一致），
// 当前只可靠转换扁平的 character.* 字段；worldbook/preset 等含数组/ID 的路径需按 bundle
// 结构推导，留作后续（届时 1.2b 的未知约定推断也需要更完整的 patchable 路径集）。
function collectRepairablePaths(diagnostics: ImportDiagnostic[]): string[] {
  const pointers = diagnostics
    .map((diagnostic) => diagnostic.targetPath)
    .filter((path): path is string => Boolean(path))
    .map(toCharacterPointer)
    .filter((pointer): pointer is string => pointer !== undefined && isRepairablePath(pointer));
  return [...new Set(pointers)];
}

function toCharacterPointer(dotPath: string): string | undefined {
  const segments = dotPath.split(".");
  if (segments[0] !== "character" || segments.length !== 2) return undefined;
  return `/${segments[0]}/${segments[1]}`;
}
