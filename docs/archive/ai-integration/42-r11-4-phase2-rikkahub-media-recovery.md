# R11.4 Phase 2 — RikkaHub Media Recovery

Date: 2026-09-06

## Production evidence that motivated this phase

R11.4 phase 1 correctly rejected a meal mutation when the user required the original image but the MCP call contained neither OpenAI `file` metadata nor generic `media.data_base64`. The user-visible RikkaHub test confirmed that the chat UI can display the selected image while the remote MCP tool still receives no bindable image bytes.

This means the remaining problem is a client transport boundary, not Supabase Storage or meal-photo compression.

## RikkaHub compatibility findings

RikkaHub supports multimodal chat input and MCP, but current public behavior does not guarantee that a local chat attachment is projected into arbitrary remote MCP tool arguments. Public RikkaHub issues also show that MCP image/tool-result handling remains provider- and client-sensitive.

Therefore the AI Access Core must not assume that every MCP client can synthesize `file`, base64, or a remotely fetchable image URL from a local attachment.

## Phase 2 design

Keep the direct paths from phase 1:

1. OpenAI / ChatGPT `file` binding.
2. Generic inline `media.data_base64` + `mime_type`.

Add a client-independent recovery path when the user explicitly requires the original image but the client does not transmit it:

```text
life_mutate attachPhoto=true
  + no file/media bytes
→ MEDIA_ATTACHMENT_REQUIRED
→ retryable=false
→ mutationExecuted=false
→ recovery.type=browser_upload
→ recovery.uploadUrl=<opaque short-lived URL>
```

The model must not repeat create/update after this response. It should give the upload URL to the user once.

The URL contains an AES-GCM encrypted, short-lived payload bound to:

- authenticated actor (`cat` / `fish`)
- original normalized mutation arguments
- original user text
- stable operation id / tool call id
- 10-minute expiry

The browser fallback accepts only an image, enforces the existing maximum input size, reuses the existing meal-photo compression policy, and resumes the original `life_mutate` through the canonical Life Agent executor.

Reusing the stable operation id means re-submitting the same recovery link remains protected by the existing mutation idempotency layer.

## Security boundaries

- No arbitrary remote `imageUrl` fetch is introduced, avoiding an SSRF surface.
- The recovery token is encrypted; meal contents and actor are not exposed as readable URL JSON.
- Recovery expires after 10 minutes.
- Recovery can only replay the signed operation; the upload page cannot choose another actor or arbitrary mutation payload.
- The canonical executor still owns permissions, normalization, idempotency, photo compression, and persistence.

## Recognition vs original-file persistence

These are separate capabilities.

A vision-capable chat/attachment-recognition model can identify food contents and provide structured meal items. A text-only model such as DeepSeek without successful attachment recognition cannot infer food contents merely because the browser fallback can persist the original image.

Therefore the practical RikkaHub path is:

```text
vision-capable model / attachment-recognition model
→ recognizes food
→ life_mutate with structured items + attachPhoto=true
→ if RikkaHub cannot pass original bytes, Core returns browser_upload URL
→ user selects the same image once
→ canonical mutation completes with stored photo
```

A future RikkaHub version that passes attachment bytes or a compatible file reference can skip the browser fallback and use the direct MCP media path automatically.

## Status

- Implementation branch: `feat/r11-4-phase2-media-recovery`
- Production deployment: NOT authorized / NOT performed in this phase yet.
