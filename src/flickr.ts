export type FlickrPhoto = {
  id: string;
  title: string;
  link: string;
  imageUrl: string;
  published: Date;
};

export type FlickrFeed = {
  userName: string;
  profileUrl: string;
  photos: FlickrPhoto[]; // newest first, as Flickr returns them
};

const DEFAULT_FEED_URL =
  "https://www.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&lang=en-us&id=";

type RawItem = {
  title?: string;
  link?: string;
  media?: { m?: string };
  published?: string;
};

const parseItem = (item: RawItem): FlickrPhoto | null => {
  const link = item.link ?? "";
  const id = link.match(/\/photos\/[^/]+\/(\d+)/)?.[1];
  const small = item.media?.m;
  if (!id || !small) return null;
  return {
    id,
    title: item.title?.trim() || "Untitled",
    link,
    // "_m" is the 240 px version; "_b" is the 1024 px one
    imageUrl: small.replace(/_m\.(jpg|jpeg|png|gif)$/i, "_b.$1"),
    published: new Date(item.published ?? Date.now()),
  };
};

export const fetchFeed = async (flickrId: string): Promise<FlickrFeed> => {
  const base = Deno.env.get("FLICKR_FEED_URL") || DEFAULT_FEED_URL;
  const res = await fetch(base + flickrId);
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Flickr feed returned HTTP ${res.status}`);
  }
  // Flickr escapes apostrophes as \' which is not valid JSON
  const text = (await res.text()).replace(/\\'/g, "'");
  const data = JSON.parse(text);
  if (!Array.isArray(data.items)) {
    throw new Error("Flickr feed has no items list");
  }
  const photos = (data.items as RawItem[])
    .map(parseItem)
    .filter((p): p is FlickrPhoto => p !== null);
  return {
    userName: String(data.title ?? "").replace(/^Uploads from /, "") ||
      flickrId,
    profileUrl: String(
      data.link ?? `https://www.flickr.com/photos/${flickrId}/`,
    ),
    photos,
  };
};
