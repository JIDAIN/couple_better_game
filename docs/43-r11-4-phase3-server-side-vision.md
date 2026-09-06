# R11.4 Phase 3 — Server-side Vision Recognition

## Goal

Do not depend on RikkaHub or the chat model being able to see the image. Once the recovery upload page receives the real image bytes, the server itself should attempt food recognition, save the photo, and enrich the same meal record.

## Flow

```text
RikkaHub image request
→ life_mutate attachPhoto=true
→ MEDIA_ATTACHMENT_REQUIRED
→ signed browser upload
→ compress image
→ server-side vision recognition
→ merge reliable recognized foods into the signed meal operation
→ canonical life_mutate
→ Supabase Storage + meal record
```

## Vision provider

Server-only environment variables:

- `LIFE_VISION_API_KEY` — preferred dedicated key
- fallback: `OPENAI_API_KEY`
- `LIFE_VISION_MODEL` — default `gpt-5.6-luna`
- `LIFE_VISION_BASE_URL` — default `https://api.openai.com/v1`

The implementation calls the OpenAI Responses API with the compressed WebP as a data URL. The provider is isolated behind `lib/server/life-meal-vision.ts` so the adapter can be replaced later without changing the AI Access Core business contract.

## Safety / semantics

- Only food items with confidence >= 0.60 are used.
- Do not estimate calories, grams, macros, or ingredients that are not visibly reliable.
- Existing user-provided items are preserved; recognized items are appended only when their normalized food name is not already present.
- Recognition failure does not roll back a successful photo save.
- If the vision provider is not configured, the image is still saved and the page clearly says recognition was not available.
- The success page no longer exposes raw database JSON, IDs, `photoPath`, `partnerKey`, or timestamps.

## Acceptance before Production

1. Unit tests for vision normalization.
2. Source contract test for upload → recognition → mutation.
3. Full Test / Lint / Build CI.
4. Production deployment still requires one explicit user authorization.
5. Real acceptance must use an uploaded food photo and verify both:
   - the same meal record has a photo;
   - recognized foods are added to that same record.
