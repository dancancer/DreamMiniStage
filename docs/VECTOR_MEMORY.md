# Vector Memory (Session-Scoped) FAQ

## Overview
- Purpose: provide semantic recall for each dialogue session without inflating prompts.
- Storage: IndexedDB first, memory fallback; no SQLite dependency in the browser bundle.
- Scope: sessionId/dialogueKey only (per-session isolation).

## Storage & Runtime
- Client-side IndexedDB via `lib/vectors/storage` (`createStorage`); auto-fallback to in-memory if unavailable.
- Writes are async and non-blocking; failures do not block chat.

## Providers
- Default: OpenAI-compatible embeddings when `VECTOR_MEMORY_API_KEY` / `OPENAI_API_KEY` / `NEXT_PUBLIC_OPENAI_API_KEY` exists; otherwise回落到本地 bag-of-words。注意：项目常用的 `NEXT_PUBLIC_API_KEY` 不会被向量模块读取，如需复用请复制到上述变量之一。
- Override with env:
  - `VECTOR_MEMORY_PROVIDER` = `openai` | `local` | `none`
  - `VECTOR_MEMORY_API_KEY`, `VECTOR_MEMORY_MODEL`, `VECTOR_MEMORY_API_URL` (any OpenAI-compatible embedding endpoint)
- Disable entirely with `VECTOR_MEMORY_ENABLED=false` or `NEXT_PUBLIC_VECTOR_MEMORY_ENABLED=false`.

## Ingestion
- User and assistant turns are ingested after message commit.
- World Info matches are ingested with deterministic IDs (prefix `wi_before_` / `wi_after_`) to avoid duplication.
- Records: `{sessionId, role, source, content, createdAt}` with generated embeddings.

## Retrieval
- During prompt build, top-K (default 5) results scoped to the active session are fetched and injected as a `system` message tagged `identifier: 3_vectors`.
- Ordering: similarity desc, tie-break by recency.
- Output text is trimmed to a max context budget (default 1500 chars).

## Configuration Quick Reference
- `VECTOR_MEMORY_ENABLED` / `NEXT_PUBLIC_VECTOR_MEMORY_ENABLED`
- `VECTOR_MEMORY_PROVIDER` (`openai` | `local` | `none`)
- `VECTOR_MEMORY_TOPK` (default 5)
- `VECTOR_MEMORY_API_KEY`, `VECTOR_MEMORY_MODEL`, `VECTOR_MEMORY_API_URL`（未设置时会尝试 `OPENAI_API_KEY` / `NEXT_PUBLIC_OPENAI_API_KEY`）

## Testing
- Unit: `pnpm vitest run lib/vector-memory/__tests__/manager.test.ts`
- Warnings from provider failures are expected in the “provider fails” case; assertions still pass.
