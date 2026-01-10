const fs = require("fs");
const path = require("path");

const CONCURRENCY = 20;
const API_URL = "http://localhost:8787/api/v1/bookmarks";
const BOOKMARKS_FILE = path.join(__dirname, "../bookmarks_1_2_26.html");
const ERROR_LOG = path.join(__dirname, "../ingestion_errors.log");
const SUCCESS_LOG = path.join(__dirname, "../ingestion_success.log");

fs.writeFileSync(ERROR_LOG, "");
fs.writeFileSync(SUCCESS_LOG, "");

async function parseBookmarks(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const regex = /href="([^"]*)"/gi;
  const urls = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function ingestUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (response.ok) {
      return { success: true, status: response.status, data };
    } else {
      return { success: false, status: response.status, error: data };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`Reading bookmarks from ${BOOKMARKS_FILE}...`);
  if (!fs.existsSync(BOOKMARKS_FILE)) {
    console.error(`File not found: ${BOOKMARKS_FILE}`);
    process.exit(1);
  }

  const urls = await parseBookmarks(BOOKMARKS_FILE);
  console.log(`Found ${urls.length} bookmarks.`);
  console.log(`Starting parallel ingestion (Concurrency: ${CONCURRENCY})...\n`);

  let processed = 0;
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  const total = urls.length;
  const queue = [...urls];

  const worker = async (id) => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      const result = await ingestUrl(url);
      processed++;

      if (processed % 10 === 0 || processed === total) {
        process.stdout.write(
          `\rProgress: ${processed}/${total} | ✅ ${successCount} | ⏭️ ${skipCount} | ❌ ${failCount}`
        );
      }

      if (result.success) {
        fs.appendFileSync(SUCCESS_LOG, `${url}\n`);
        successCount++;
      } else {
        if (result.status === 409) {
          skipCount++;
        } else {
          const errorMsg = result.error
            ? JSON.stringify(result.error)
            : result.error;
          fs.appendFileSync(
            ERROR_LOG,
            `${new Date().toISOString()} - ${url} - ${errorMsg}\n`
          );
          failCount++;
        }
      }
    }
  };

  const workers = Array(CONCURRENCY)
    .fill(null)
    .map((_, i) => worker(i));
  await Promise.all(workers);

  console.log("\n\n--- Ingestion Complete ---");
  console.log(`Total: ${total}`);
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skipCount} (Already exists)`);
  console.log(`Failed: ${failCount}`);
  console.log(`Errors logged to: ${ERROR_LOG}`);
}

main().catch(console.error);
