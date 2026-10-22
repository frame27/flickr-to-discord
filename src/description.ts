// Turns the HTML description from the Flickr feed into plain text for Discord
// and pulls out credit lines such as "By @frame".

export type ParsedDescription = { text: string; credits: string[] };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });

// a line like "By @frame" or "by frameboost & MatiTheMudkip"
const CREDIT_LINE = /^by\s+\S.{0,100}$/i;

export const parseDescription = (
  html: string | undefined,
): ParsedDescription => {
  if (!html) return { text: "", credits: [] };
  let s = html
    // the "Old To The New posted a photo:" paragraph
    .replace(
      /<p>(?:(?!<\/p>)[\s\S])*posted a photo:(?:(?!<\/p>)[\s\S])*<\/p>/i,
      "",
    )
    // the paragraph with the small preview image
    .replace(/<p>(?:(?!<\/p>)[\s\S])*<img\b(?:(?!<\/p>)[\s\S])*<\/p>/gi, "");

  // links: keep plain URLs as they are, named links as Discord [text](url)
  s = s.replace(
    /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const url = decodeEntities(href);
      const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
      if (!text || text === url || /^https?:\/\//i.test(text)) return url;
      return `[${text}](${url})`;
    },
  );

  s = s
    .replace(/\r/g, "")
    .replace(/\n/g, " ") // raw newlines are just HTML formatting
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);

  const credits: string[] = [];
  const lines: string[] = [];
  for (const raw of s.split("\n")) {
    const line = raw.replace(/[ \t]+/g, " ").trim();
    if (CREDIT_LINE.test(line)) credits.push(line);
    else lines.push(line);
  }
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, credits };
};

// shortens long text at a word boundary
export const shorten = (s: string, max: number): string => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
};
