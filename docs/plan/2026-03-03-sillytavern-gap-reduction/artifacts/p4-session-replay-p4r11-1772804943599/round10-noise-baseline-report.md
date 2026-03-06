# P4 Session Replay Noise Baseline Report

- baseline: docs/plan/2026-03-03-sillytavern-gap-reduction/p4-session-replay-noise-baseline.json
- baselineVersion: 1
- hasNewNoise: false
- unknownSignatureCount: 0

## Console Candidates
- total: 20

### Console Known Signatures

- console-llm-method-failed (expected-failfast) x 2
- console-llm-openai-error (expected-failfast) x 2
- console-missing-node-tools (known-noise) x 8
- console-resource-401 (expected-failfast) x 2
- console-resource-404 (known-noise) x 4
- console-stream-no-response (expected-failfast) x 2

### Console New Signatures

- (none)

## Network Candidates
- total: 32

### Network Known Signatures

- network-background-404 (known-noise) x 4
- network-ga-request-aborted (known-noise) x 23
- network-openai-mock-401 (expected-failfast) x 2
- network-openai-response-401 (expected-failfast) x 2
- network-session-rsc-aborted (known-noise) x 1

### Network New Signatures

- (none)

## Rule Audit

### Console Rules

- totalRules: 6
- matchedRuleCount: 6
- unusedRuleCount: 0

### Network Rules

- totalRules: 5
- matchedRuleCount: 5
- unusedRuleCount: 0
