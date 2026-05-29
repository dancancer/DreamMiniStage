# SAC-Phase 5 Unsupported UI Regex Fallback

## Decision

Unsupported UI regex must be visible to the user. The converter returns `UnsupportedRegexFallback` with:

- `scriptId`
- `scriptName`
- `reason`
- `rawSummary`
- `allowedActions`
- `plainText`

Allowed actions are intentionally narrow:

| Action | Meaning |
| --- | --- |
| `disable` | Do not apply the UI regex in the new runtime. |
| `plain-text` | Strip markup and expose only non-executable text. |

There is no raw HTML execution action.

## Unsafe HTML Rules

The classifier rejects HTML widgets that include:

- `<script`
- `<iframe`
- inline event handlers such as `onerror=`
- direct DOM access markers such as `window.parent` or `document.`

These rules are deterministic and do not depend on LLM judgment.

## Product Requirement

The import UI must show unsupported UI regex as semantic loss, not as a success toast. Minimum display:

- script name
- reason
- short raw rule summary
- selected fallback action

## Verification

`POC-5.3` covers a synthetic malicious HTML regex and asserts that no `RenderIntent` is produced.

