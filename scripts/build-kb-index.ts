import { buildIndex } from "../src/services/kb/KbIndexBuilder";

const stats = buildIndex();
console.log("=== KB Index Build Results ===");
console.log("Total entries:", stats.totalEntries);
console.log("Size:", stats.sizeKB, "KB");
console.log("Build time:", stats.buildTimeMs, "ms");
console.log("Categories:", JSON.stringify(stats.categories, null, 2));
