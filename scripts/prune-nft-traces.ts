import fs from "fs";
import path from "path";
import nextConfig from "../next.config";

export function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexStr = escaped.replace(/\*\*/g, ".*").replace(/(?<!\.)\*/g, "[^/]*");
  return new RegExp(regexStr);
}

export function pruneInstrumentationTrace(): void {
  const nftPath = path.resolve(process.cwd(), ".next/server/instrumentation.js.nft.json");
  if (!fs.existsSync(nftPath)) return;

  const nftDir = path.dirname(nftPath);
  const data = JSON.parse(fs.readFileSync(nftPath, "utf8")) as { files: string[] };
  const rawExcludes = nextConfig.outputFileTracingExcludes?.["*"] || [];
  if (rawExcludes.length === 0) return;

  const matchers = rawExcludes.map((exc: string) => globToRegex(exc));
  const initialCount = data.files.length;

  data.files = data.files.filter((f) => {
    const absPath = path.resolve(nftDir, f).replace(/\\/g, "/");
    return !matchers.some((matcher) => matcher.test(absPath));
  });

  fs.writeFileSync(nftPath, JSON.stringify(data, null, 2));
  console.log(
    `[prune-nft] Pruned instrumentation.js.nft.json: ${initialCount} -> ${data.files.length} files.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  pruneInstrumentationTrace();
}
