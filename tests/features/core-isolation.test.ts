import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Core Domain Isolation Invariant", () => {
  it("ensures quizService.ts does not import from vision, storage, or external integration libs", () => {
    const serviceContent = fs.readFileSync(
      path.join(process.cwd(), "src/services/quizService.ts"),
      "utf8"
    );
    expect(serviceContent).not.toMatch(/from\s+['"].*visionService['"]/);
    expect(serviceContent).not.toMatch(/from\s+['"].*@vercel\/blob['"]/);
    expect(serviceContent).not.toMatch(/from\s+['"].*@google\/generative-ai['"]/);
  });
});
