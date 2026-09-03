import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MEAL_PHOTO_MAX_EDGE,
  MEAL_PHOTO_MAX_INPUT_BYTES,
  compressMealPhoto,
} from "../../lib/server/image-compression";

function pseudoRandomRgb(width: number, height: number) {
  const data = Buffer.alloc(width * height * 3);
  let state = 0x12345678;
  for (let i = 0; i < data.length; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    data[i] = state & 0xff;
  }
  return data;
}

describe("meal photo compression", () => {
  it("normalizes photos to WebP with the longest edge at most 600px", async () => {
    const source = await sharp({
      create: {
        width: 1600,
        height: 900,
        channels: 3,
        background: { r: 230, g: 160, b: 140 },
      },
    })
      .jpeg({ quality: 92 })
      .toBuffer();

    const output = await compressMealPhoto(source, "image/jpeg");
    expect(output.contentType).toBe("image/webp");
    expect(output.extension).toBe("webp");
    expect(Math.max(output.width ?? 0, output.height ?? 0)).toBeLessThanOrEqual(MEAL_PHOTO_MAX_EDGE);
    expect(output.quality).toBe(70);
    expect(output.outputBytes).toBeGreaterThan(0);
  });

  it("progressively lowers quality for complex images but never below 55", async () => {
    const width = 1000;
    const height = 1000;
    const source = await sharp(pseudoRandomRgb(width, height), {
      raw: { width, height, channels: 3 },
    })
      .png()
      .toBuffer();

    const output = await compressMealPhoto(source, "image/png");
    expect([70, 65, 60, 55]).toContain(output.quality);
    expect(output.quality).toBeGreaterThanOrEqual(55);
    expect(output.quality).toBeLessThanOrEqual(70);
    expect(Math.max(output.width ?? 0, output.height ?? 0)).toBeLessThanOrEqual(600);
  });

  it("rejects unsupported types and oversized input before decoding", async () => {
    await expect(compressMealPhoto(Buffer.from("not an image"), "text/plain")).rejects.toMatchObject({
      code: "PHOTO_TYPE_UNSUPPORTED",
    });
    await expect(
      compressMealPhoto(Buffer.alloc(MEAL_PHOTO_MAX_INPUT_BYTES + 1), "image/jpeg"),
    ).rejects.toMatchObject({ code: "PHOTO_TOO_LARGE" });
  });
});
