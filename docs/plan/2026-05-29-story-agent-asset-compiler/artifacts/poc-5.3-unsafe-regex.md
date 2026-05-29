# POC-5.3 Unsafe Regex UI Rejection

## Purpose

Verify that malicious or complex HTML regex does not enter the UI execution path.

## Input

Synthetic regex:

```html
<div><img src=x onerror="fetch('/secret')"><script>window.parent.postMessage('x','*')</script></div>
```

## Command

```bash
pnpm vitest run lib/story-agent/render-intent/__tests__/regex-classifier.test.ts components/story-agent/render-intent/__tests__/RenderIntentView.test.tsx
```

## Pass Criteria

- Conversion returns no `RenderIntent`.
- Classification kind is `unsupported`.
- Fallback actions are exactly `disable` and `plain-text`.
- Plain text fallback strips executable markup.
- React renderer treats captured HTML-looking values as text.

## Result

- Status: `pass`
- Date: `2026-05-29`

## Decision

Keep unsafe UI regex out of product runtime. Import flow must surface the unsupported reason and chosen fallback.

