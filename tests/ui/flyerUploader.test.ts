import { describe, it, expect } from "vitest";
import fs from "fs";

describe("FlyerUploader Drag & Drop and Paste Support", () => {
  it("implements onDrop and onDragOver event handlers", () => {
    const code = fs.readFileSync("src/components/FlyerUploader.tsx", "utf-8");
    expect(code).toContain("onDrop");
    expect(code).toContain("onDragOver");
  });

  it("implements clipboard paste event handler for screenshots", () => {
    const code = fs.readFileSync("src/components/FlyerUploader.tsx", "utf-8");
    expect(code).toContain("paste");
  });
});
