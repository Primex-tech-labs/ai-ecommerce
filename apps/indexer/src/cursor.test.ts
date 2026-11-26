import { afterAll, describe, expect, it } from "vitest";
import {
  closeCursorStore,
  cursorBackend,
  loadIndexerCursor,
  saveIndexerCursor,
} from "./cursor";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite("indexer cursor persistence (postgres)", () => {
  afterAll(async () => {
    await closeCursorStore();
  });

  it("uses the postgres backend when configured", () => {
    expect(cursorBackend()).toBe("postgres");
  });

  it("persists the cursor across loads", async () => {
    await saveIndexerCursor(424242);
    await expect(loadIndexerCursor()).resolves.toBe(424242);
    await saveIndexerCursor(424243);
    await expect(loadIndexerCursor()).resolves.toBe(424243);
  });
});
