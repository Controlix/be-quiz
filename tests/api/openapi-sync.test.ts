import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("OpenAPI Synchronization", () => {
  const openApiContent = fs.readFileSync(
    path.join(process.cwd(), "docs/api/openapi.yaml"),
    "utf8"
  );

  it("documents /auth/join and /auth/logout", () => {
    expect(openApiContent).toContain("/auth/join:");
    expect(openApiContent).toContain("/auth/logout:");
  });

  it("documents /api/quizzes/{id}/calendar.ics with 200, 404, and 501 responses", () => {
    expect(openApiContent).toContain("/api/quizzes/{id}/calendar.ics:");
    expect(openApiContent).toContain('"501":');
  });

  it("documents /api/quizzes/extract with 200, 400, 500, and 501 responses", () => {
    expect(openApiContent).toContain("/api/quizzes/extract:");
    expect(openApiContent).toContain('"501":');
  });

  it("ensures every route handler in src/app/api and src/app/auth is present in openapi.yaml", () => {
    const routeDirs = [
      path.join(process.cwd(), "src/app/api"),
      path.join(process.cwd(), "src/app/auth"),
    ];

    const walk = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(filePath));
        } else if (file === "route.ts") {
          results.push(filePath);
        }
      }
      return results;
    };

    const routes = routeDirs.flatMap((dir) => walk(dir));
    for (const routePath of routes) {
      const relative = routePath
        .replace(path.join(process.cwd(), "src/app"), "")
        .replace("/route.ts", "")
        .replace(/\[(\w+)\]/g, "{$1}");
      expect(openApiContent).toContain(`${relative}:`);
    }
  });
});
