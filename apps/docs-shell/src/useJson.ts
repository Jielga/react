import { useEffect, useState } from "react";

/**
 * One JSON endpoint, read once, or given up on quietly.
 *
 * Shared by the npm registry read in `packageStatus.ts`, the deployed versions
 * manifest in `docsVersions.ts` and the published site list in `sites.ts`.
 * Each is optional: offline, an ad blocker, or a manifest that is not there
 * yet each cost the page one badge or fall back to what the build knows, so
 * nothing is retried and no error is surfaced.
 *
 * `parse` is called with `unknown` rather than trusted, because it is parsing a
 * response from somewhere else. It must be defined at module scope: it is an
 * effect dependency, and a new identity each render would refetch forever.
 */
export function useJson<T>(
  url: string,
  parse: (value: unknown) => T | null,
  accept?: string,
): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(url, {
      signal: controller.signal,
      headers: accept ? { Accept: accept } : undefined,
    })
      .then((response): Promise<unknown> | null =>
        response.ok ? response.json() : null,
      )
      .then((value) => {
        if (value != null) setData(parse(value));
      })
      .catch(() => {
        // Includes the abort on unmount, which is not worth distinguishing.
      });

    return () => controller.abort();
  }, [url, parse, accept]);

  return data;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
