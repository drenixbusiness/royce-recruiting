import fs from "fs/promises";
import path from "path";

/**
 * Tiny key-value store the board is kept in.
 * - Upstash Redis (REST) when UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN are set — Vercel Marketplace "Upstash for Redis".
 * - Any Redis server when REDIS_URL is set.
 * - Otherwise plain files under data/kv, for running on your own computer or server.
 * Vercel has no writable disk, so there one of the Redis options is required.
 */
export interface KV {
  kind: "upstash" | "redis" | "file";
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  /** sets only if the key does not exist yet; true when it was set */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  incr(key: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, ...fields: string[]): Promise<void>;
}

export class StorageMissingError extends Error {
  constructor() {
    super(
      "No database is connected. In Vercel open the project → Storage → add “Upstash for Redis” (or any Redis) and connect it to this project, then redeploy.",
    );
  }
}

export const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

const g = globalThis as unknown as { __royceKv?: Promise<KV> };

export function getKV(): Promise<KV> {
  g.__royceKv ??= create().catch((e) => {
    g.__royceKv = undefined;
    throw e;
  });
  return g.__royceKv;
}

/** true when several short-lived server copies may run at once (Vercel), so in-memory change events can't be shared */
export const isServerless = !!process.env.VERCEL;

async function create(): Promise<KV> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return upstash(url, token);
  if (process.env.REDIS_URL) return tcpRedis(process.env.REDIS_URL);
  if (isServerless) throw new StorageMissingError();
  return fileKV(path.join(DATA_DIR, "kv"));
}

async function upstash(url: string, token: string): Promise<KV> {
  const { Redis } = await import("@upstash/redis");
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    kind: "upstash",
    get: (k) => r.get<string>(k),
    set: async (k, v) => void (await r.set(k, v)),
    setIfAbsent: async (k, v) => (await r.set(k, v, { nx: true })) === "OK",
    del: async (...k) => void (k.length && (await r.del(...k))),
    incr: (k) => r.incr(k),
    hgetall: async (k) => ((await r.hgetall<Record<string, string>>(k)) ?? {}),
    hset: async (k, f, v) => void (await r.hset(k, { [f]: v })),
    hdel: async (k, ...f) => void (f.length && (await r.hdel(k, ...f))),
  };
}

async function tcpRedis(url: string): Promise<KV> {
  const { createClient } = await import("redis");
  const c = createClient({ url });
  c.on("error", (e) => console.error("Redis error", e));
  await c.connect();
  // raw commands keep this independent of client-library API changes
  const cmd = <T>(args: string[]) => c.sendCommand(args) as Promise<T>;
  return {
    kind: "redis",
    get: (k) => cmd<string | null>(["GET", k]),
    set: async (k, v) => void (await cmd(["SET", k, v])),
    setIfAbsent: async (k, v) => (await cmd<string | null>(["SET", k, v, "NX"])) === "OK",
    del: async (...k) => void (k.length && (await cmd(["DEL", ...k]))),
    incr: (k) => cmd<number>(["INCR", k]),
    hgetall: async (k) => {
      const raw = await cmd<string[] | Record<string, string>>(["HGETALL", k]);
      if (!Array.isArray(raw)) return raw ?? {};
      const out: Record<string, string> = {};
      for (let i = 0; i < raw.length; i += 2) out[raw[i]] = raw[i + 1];
      return out;
    },
    hset: async (k, f, v) => void (await cmd(["HSET", k, f, v])),
    hdel: async (k, ...f) => void (f.length && (await cmd(["HDEL", k, ...f]))),
  };
}

async function fileKV(dir: string): Promise<KV> {
  await fs.mkdir(dir, { recursive: true });
  const file = (k: string) => path.join(dir, encodeURIComponent(k));
  const read = async (k: string) => {
    try {
      return await fs.readFile(file(k), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  };
  const write = async (k: string, v: string) => {
    await fs.mkdir(dir, { recursive: true }); // survives the folder being removed while running
    const tmp = `${file(k)}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, v, "utf8");
    await fs.rename(tmp, file(k));
  };
  // one process owns these files, so a promise chain is enough to keep read-modify-write steps atomic
  let lock: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => {
    const run = lock.then(fn, fn);
    lock = run.catch(() => undefined);
    return run;
  };
  const readHash = async (k: string) => JSON.parse((await read(k)) ?? "{}") as Record<string, string>;
  return {
    kind: "file",
    get: read,
    set: (k, v) => serial(() => write(k, v)),
    setIfAbsent: (k, v) => serial(async () => ((await read(k)) === null ? (await write(k, v), true) : false)),
    del: (...k) => serial(async () => void (await Promise.all(k.map((x) => fs.rm(file(x), { force: true }))))),
    incr: (k) =>
      serial(async () => {
        const n = Number((await read(k)) ?? 0) + 1;
        await write(k, String(n));
        return n;
      }),
    hgetall: readHash,
    hset: (k, f, v) => serial(async () => write(k, JSON.stringify({ ...(await readHash(k)), [f]: v }))),
    hdel: (k, ...f) =>
      serial(async () => {
        const h = await readHash(k);
        f.forEach((x) => delete h[x]);
        await write(k, JSON.stringify(h));
      }),
  };
}
