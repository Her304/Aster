import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Aster's pages are either dynamic or small static shells that never
// revalidate, so no incremental cache is used: nothing to provision (no R2
// bucket or KV namespace), and no writes to a read-only store.
export default defineCloudflareConfig({
  incrementalCache: "dummy",
});
