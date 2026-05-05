import { describe, expect, it, vi } from "vitest";
import { sha256 } from "../../src/utils/hash.js";
import { asyncHandler } from "../../src/utils/asyncHandler.js";

describe("utils", () => {
  it("hashes values with sha256", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("asyncHandler forwards errors", async () => {
    const error = new Error("boom");
    const handler = asyncHandler(async () => {
      throw error;
    });

    const next = vi.fn();
    handler({} as any, {} as any, next);

    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(error);
  });
});
