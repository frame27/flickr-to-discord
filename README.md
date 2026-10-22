# flickr-to-discord

A Deno script, run by GitHub Actions every 15 minutes, that posts new public
Flickr photos to a Discord channel through a webhook.

* One post per photo: title, link to the photo on Flickr, large image and
  upload time.
* Several new photos are posted oldest first.
* On the very first run it only remembers the photos already on Flickr, so the
  channel does not get flooded. Only later uploads are posted.
* Remembers every posted photo, so nothing is posted twice, even after big
  uploads or deleted photos.
* A photo is only marked as posted after Discord accepted it; rate limits are
  waited out and retried.
* Supports multiple Flickr users.
* Keeps its GitHub schedule from being paused after 60 days without commits.

The post's name and picture come from the Discord webhook settings.

## Settings

Repository → Settings → Secrets and variables → Actions:

| Name                       | Type     | Value                                                  |
| -------------------------- | -------- | ------------------------------------------------------ |
| `FLICKR_IDS`               | Variable | Flickr user IDs (e.g. `204751995@N03`), comma-separated |
| `UPSTASH_REDIS_REST_URL`   | Variable | Upstash Redis REST URL                                 |
| `DISCORD_WEBHOOK_URL`      | Secret   | Discord webhook URL                                    |
| `UPSTASH_REDIS_REST_TOKEN` | Secret   | Upstash Redis REST token                               |
| `EMBED_COLOR`              | Variable | Optional. Side bar color as hex, default `920000`      |
| `POST_ON_FIRST_RUN`        | Variable | Optional. `true` to also post existing photos once     |

## Run locally

```sh
deno run --allow-net --allow-env ./src/index.ts
```

Set `DRY_RUN=true` to only print what would be posted, and `STORE_FILE=state.json`
(plus `--allow-read --allow-write`) to use a local file instead of Upstash.
