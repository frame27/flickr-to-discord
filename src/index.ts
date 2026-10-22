import { fetchFeed } from "./flickr.ts";
import { postPhotos } from "./discord.ts";
import { createStore } from "./store.ts";

const KEEP_IDS = 300; // remembered photo IDs per Flickr user
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const env = (name: string) => (Deno.env.get(name) ?? "").trim();

const flickrIds = env("FLICKR_IDS").split(",").map((s) => s.trim()).filter(
  Boolean,
);
const webhookUrl = env("DISCORD_WEBHOOK_URL");
const dryRun = env("DRY_RUN") === "true";
const postOnFirstRun = env("POST_ON_FIRST_RUN") === "true";
const color = parseInt(env("EMBED_COLOR").replace(/^#/, "") || "920000", 16);
// photos found in the same run are posted together as one grid post
// (GROUP_SIZE=1 posts every photo separately instead)
const grouping = env("GROUP_SIZE") !== "1";

if (flickrIds.length === 0) throw new Error("FLICKR_IDS is not set");
if (!webhookUrl && !dryRun) throw new Error("DISCORD_WEBHOOK_URL is not set");

const store = createStore();
const state = await store.load();
let failed = false;

for (const flickrId of flickrIds) {
  let feed;
  try {
    feed = await fetchFeed(flickrId);
  } catch (e) {
    // Flickr hiccups are skipped quietly; the next run tries again
    console.log(`::warning::Could not read Flickr feed for ${flickrId}: ${e}`);
    continue;
  }

  if (!state[flickrId] && !postOnFirstRun) {
    state[flickrId] = feed.photos.map((p) => p.id).reverse();
    await store.save(state);
    console.log(
      `${flickrId}: first run, remembered ${feed.photos.length} existing photos without posting them`,
    );
    continue;
  }

  const handled = (state[flickrId] ??= []);
  const known = new Set(handled);
  const fresh = feed.photos
    .filter((p) => !known.has(p.id))
    .reverse() // oldest first
    .sort((a, b) => a.published.getTime() - b.published.getTime());

  console.log(`${flickrId}: ${fresh.length} new photo(s)`);

  const groups = grouping && fresh.length > 0 ? [fresh] : fresh.map((p) => [p]);
  for (const group of groups) {
    const names = group.map((p) => p.title).join(" | ");
    if (dryRun) {
      console.log(`[dry run] would post: ${names}`);
    } else {
      try {
        await postPhotos(webhookUrl, feed, group, color);
      } catch (e) {
        console.log(`::error::Posting "${names}" failed: ${e}`);
        failed = true;
        break; // keep them unmarked so the next run tries again
      }
      console.log(`posted: ${names}`);
    }
    handled.push(...group.map((p) => p.id));
    if (handled.length > KEEP_IDS) handled.splice(0, handled.length - KEEP_IDS);
    await store.save(state);
    if (!dryRun) await sleep(1000);
  }
}

if (failed) Deno.exit(1);
