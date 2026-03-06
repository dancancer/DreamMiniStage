/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Switch Naming Utilities                        ║
 * ║                                                                           ║
 * ║  统一 /char 切换后的会话命名策略，避免命名漂移                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

function formatTimestamp(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function normalizeName(name: string | undefined): string {
  return (name ?? "").trim();
}

export function buildTemporarySessionName(
  characterName: string,
  now: Date = new Date(),
): string {
  const name = normalizeName(characterName) || "unknown";
  return `${name} - ${formatTimestamp(now)} [temp]`;
}

export function buildSwitchedSessionName(
  toCharacterName: string,
  fromCharacterName?: string,
  now: Date = new Date(),
): string {
  const toName = normalizeName(toCharacterName) || "unknown";
  const fromName = normalizeName(fromCharacterName);
  const timestamp = formatTimestamp(now);

  if (!fromName || fromName.toLowerCase() === toName.toLowerCase()) {
    return `${toName} - ${timestamp}`;
  }

  return `${toName} - ${timestamp} [from ${fromName}]`;
}
