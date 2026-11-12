import { execSync } from "child_process";

interface TagInfo {
  tag: string;
  date: string;
  subject: string;
}

interface CodeMetrics {
  prodLines: number;
  testLines: number;
  testFileCount: number;
}

interface ReleaseRow {
  tag: string;
  date: string;
  subject: string;
  prodLines: number;
  testLines: number;
  ratio: string;
  testFileCount: number;
  deltaProd: string;
  deltaTest: string;
}

function getTags(): string[] {
  return execSync('git tag -l "v*" --sort=version:refname', { encoding: "utf-8" })
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}

function getTagInfo(tag: string): TagInfo {
  const date = execSync(`git log -1 --format="%as" "${tag}"`, { encoding: "utf-8" }).trim();
  const rawSubject =
    execSync(`git tag -l --format="%(contents:subject)" "${tag}"`, { encoding: "utf-8" }).trim() ||
    execSync(`git log -1 --format="%s" "${tag}"`, { encoding: "utf-8" }).trim();
  const subject = rawSubject.replace(/^Release [^:]+:\s*/i, "");
  return { tag, date, subject };
}

function countLinesAtTag(tag: string): CodeMetrics {
  const files = execSync(`git ls-tree -r --name-only "${tag}"`, { encoding: "utf-8" })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  const isProd = (f: string) =>
    (f.startsWith("src/") && (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".css"))) ||
    f === "prisma/schema.prisma";

  const isTest = (f: string) => f.startsWith("tests/") && (f.endsWith(".ts") || f.endsWith(".tsx"));

  const prodFiles = files.filter(isProd);
  const testFiles = files.filter(isTest);

  let prodLines = 0;
  for (const f of prodFiles) {
    try {
      const content = execSync(`git show "${tag}":"${f}"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      prodLines += content.split("\n").length;
    } catch {
      // Ignore removed / binary edge cases
    }
  }

  let testLines = 0;
  for (const f of testFiles) {
    try {
      const content = execSync(`git show "${tag}":"${f}"`, {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      testLines += content.split("\n").length;
    } catch {
      // Ignore removed / binary edge cases
    }
  }

  return { prodLines, testLines, testFileCount: testFiles.length };
}

export function generateReleaseStats(): ReleaseRow[] {
  const tags = getTags();
  const rows: ReleaseRow[] = [];
  let prevProd = 0;
  let prevTest = 0;

  for (const tag of tags) {
    const { date, subject } = getTagInfo(tag);
    const { prodLines, testLines, testFileCount } = countLinesAtTag(tag);
    const ratio = prodLines > 0 ? `${((testLines / prodLines) * 100).toFixed(1)}%` : "0.0%";

    const deltaProd =
      prevProd > 0
        ? prodLines - prevProd >= 0
          ? `+${prodLines - prevProd}`
          : `${prodLines - prevProd}`
        : "-";

    const deltaTest =
      prevTest > 0
        ? testLines - prevTest >= 0
          ? `+${testLines - prevTest}`
          : `${testLines - prevTest}`
        : "-";

    prevProd = prodLines;
    prevTest = testLines;

    rows.push({
      tag,
      date,
      subject,
      prodLines,
      testLines,
      ratio,
      testFileCount,
      deltaProd,
      deltaTest,
    });
  }

  return rows;
}

function main() {
  const isJson = process.argv.includes("--json");
  const stats = generateReleaseStats();

  if (isJson) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(
    "\n| Version | Date | Description | Prod LOC | Test LOC | Test / Prod | Suites | Net Delta (Prod/Test) |"
  );
  console.log("|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|");
  for (const r of stats) {
    console.log(
      `| **${r.tag}** | ${r.date} | ${r.subject} | ${r.prodLines.toLocaleString()} | ${r.testLines.toLocaleString()} | **${r.ratio}** | ${r.testFileCount} | \`${r.deltaProd} / ${r.deltaTest}\` |`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
