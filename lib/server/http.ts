import { StorageMissingError } from "./kv";

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** Turns any thrown error into a JSON reply the screens can show, instead of an empty 500. */
export function handle<A extends unknown[]>(fn: Handler<A>): Handler<A> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof StorageMissingError) return Response.json({ error: e.message, setup: true }, { status: 503 });
      console.error(e);
      return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
    }
  };
}
