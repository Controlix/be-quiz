import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

async function main() {
  console.log("Starting uploads cleanup...");

  // 1. Fetch active database references
  const quizzes = await prisma.quiz.findMany({
    where: { flyerImageUrl: { not: null } },
    select: { flyerImageUrl: true },
  });

  const feedback = await prisma.feedback.findMany({
    where: { screenshot: { not: null } },
    select: { screenshot: true },
  });

  const protectedFiles = new Set<string>();

  for (const q of quizzes) {
    if (q.flyerImageUrl) {
      protectedFiles.add(path.basename(q.flyerImageUrl));
    }
  }

  for (const f of feedback) {
    if (f.screenshot) {
      protectedFiles.add(path.basename(f.screenshot));
    }
  }

  console.log(`Found ${protectedFiles.size} protected file(s) referenced in the database.`);

  // 2. Scan directory
  const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
  const allFiles = entries.filter((e) => e.isFile()).map((e) => e.name);

  console.log(`Found ${allFiles.length} file(s) on disk in ${UPLOADS_DIR}.`);

  let deletedCount = 0;
  let reclaimedBytes = 0;

  for (const fileName of allFiles) {
    if (!protectedFiles.has(fileName)) {
      const filePath = path.join(UPLOADS_DIR, fileName);
      const stat = await fs.stat(filePath);
      reclaimedBytes += stat.size;
      await fs.unlink(filePath);
      deletedCount++;
      console.log(`  [DELETED] ${fileName} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  [KEPT]     ${fileName} (referenced in DB)`);
    }
  }

  console.log("\nCleanup Summary:");
  console.log(`- Files deleted: ${deletedCount}`);
  console.log(`- Files retained: ${allFiles.length - deletedCount}`);
  console.log(`- Space reclaimed: ${(reclaimedBytes / 1024).toFixed(1)} KB (~${(reclaimedBytes / (1024 * 1024)).toFixed(2)} MB)`);
}

main()
  .catch((err) => {
    console.error("Prune error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
