import { FlickrFeed, FlickrPhoto } from "./flickr.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const postPhoto = async (
  webhookUrl: string,
  feed: FlickrFeed,
  photo: FlickrPhoto,
  color: number,
): Promise<void> => {
  const body = {
    // no username/avatar here: Discord uses the name and picture set on the webhook
    allowed_mentions: { parse: [] },
    embeds: [{
      title: photo.title.slice(0, 256),
      url: photo.link,
      color,
      image: { url: photo.imageUrl },
      timestamp: photo.published.toISOString(),
      author: { name: feed.userName.slice(0, 256), url: feed.profileUrl },
      footer: { text: "Flickr" },
    }],
  };
  const url = webhookUrl + (webhookUrl.includes("?") ? "&" : "?") + "wait=true";

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
