import { FlickrFeed, FlickrPhoto } from "./flickr.ts";
import { shorten } from "./description.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DESCRIPTION_MAX = 300;

// One Discord message for any number of photos. Several photos become one
// image grid: Discord merges embeds with the same url into a gallery, but shows
// at most 4 images, so the title counts all of them.
const MAX_IMAGES = 4;

const buildMessage = (
  feed: FlickrFeed,
  photos: FlickrPhoto[],
  color: number,
) => {
  const first = photos[0];
  const grouped = photos.length > 1;
  const title = grouped
    ? `${shorten(first.title, 230)} (+${photos.length - 1} more)`
    : shorten(first.title, 256);
  // a grid links to the photostream, a single photo to its own page
  const url = grouped ? feed.profileUrl : first.link;
  const credits = [...new Set(photos.flatMap((p) => p.credits))];
  const footer = credits.length ? shorten(credits.join(", "), 2000) : "Flickr";

  const embeds = photos.slice(0, MAX_IMAGES).map((p, i) =>
    i === 0
      ? {
        title,
        url,
        color,
        description: first.description
          ? shorten(first.description, DESCRIPTION_MAX)
          : undefined,
        image: { url: p.imageUrl },
        timestamp: p.published.toISOString(),
        author: { name: shorten(feed.userName, 256), url: feed.profileUrl },
        footer: { text: footer },
      }
      : { url, image: { url: p.imageUrl } }
  );
  // no username/avatar here: Discord uses the name and picture set on the webhook
  return { allowed_mentions: { parse: [] }, embeds };
};

export const postPhotos = async (
  webhookUrl: string,
  feed: FlickrFeed,
  photos: FlickrPhoto[],
  color: number,
): Promise<void> => {
  const body = JSON.stringify(buildMessage(feed, photos, color));
  const url = webhookUrl + (webhookUrl.includes("?") ? "&" : "?") + "wait=true";

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) {
      await res.body?.cancel();
      return;
    }
    const text = await res.text();
    if (res.status === 429) {
      // rate limited: Discord says how many seconds to wait
      let wait = 2;
      try {
        wait = Number(JSON.parse(text).retry_after) || 2;
      } catch { /* keep default */ }
      console.log(`Discord rate limit, waiting ${wait}s`);
      await sleep(wait * 1000 + 250);
      continue;
    }
    if (res.status >= 500) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`Discord webhook returned HTTP ${res.status}: ${text}`);
  }
  throw new Error("Discord webhook kept failing after 5 attempts");
};
