import { Redis } from "./deps.ts";

// Flickr user ID -> IDs of photos already handled (oldest first)
export type State = Record<string, string[]>;

export interface Store {
  load(): Promise<State>;
  save(state: State): Promise<void>;
}

const KEY = "flickr-to-discord:posted";

class RedisStore implements Store {
  private redis: Redis;
  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }
  async load(): Promise<State> {
    return (await this.redis.get<State>(KEY)) ?? {};
  }
  async save(state: State): Promise<void> {
    await this.redis.set(KEY, state);
  }
}

// Only for local testing (STORE_FILE=path)
class FileStore implements Store {
  constructor(private path: string) {}
  async load(): Promise<State> {
    try {
      return JSON.parse(await Deno.readTextFile(this.path));
    } catch {
      return {};
    }
  }
  async save(state: State): Promise<void> {
    await Deno.writeTextFile(this.path, JSON.stringify(state, null, 2));
  }
}

export const createStore = (): Store => {
  const file = Deno.env.get("STORE_FILE");
  if (file) return new FileStore(file);
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set",
    );
  }
  return new RedisStore(url, token);
};
