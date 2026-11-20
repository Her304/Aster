import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Aster's pages are either dynamic or static shells prerendered at build time
// that never revalidate. The prerendered HTML is served straight from the
// Worker's static assets (deploy copies it there), so nothing needs to be
// provisioned (no R2 bucket or KV namespace) and the cache is read-only.
//
// Do not go back to the "dummy" cache: with it every request for a static page
// (/, /start, /bloom, /bloom/report) re-renders it through Next's response
// cache at runtime, and on Workers most of those requests failed with a 500.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
