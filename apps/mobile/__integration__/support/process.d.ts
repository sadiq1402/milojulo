// Integration tests run in Node; this is the only part of its API they use.
declare const process: { env: Record<string, string | undefined> };
