import { fetchFeed } from "./flickr.ts";
import { postPhoto } from "./discord.ts";
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

  for (const photo of fresh) {
    if (dryRun) {
      console.log(`[dry run] would post: ${photo.title} ${photo.imageUrl}`);
    } else {
      try {
        await postPhoto(webhookUrl, feed, photo, color);
      } catch (e) {
        console.log(`::error::Posting "${photo.title}" failed: ${e}`);
        failed = true;
        break; // keep it unmarked so the next run tries again
      }
      console.log(`posted: ${photo.title}`);
    }
    handled.push(photo.id);
    if (handled.length > KEEP_IDS) handled.splice(0, handled.length - KEEP_IDS);
    await store.save(state);
    if (!dryRun) await sleep(1000);
  }
}

if (failed) Deno.exit(1);
