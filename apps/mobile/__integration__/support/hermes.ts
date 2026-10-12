// The app runs on Hermes, which has no TextDecoder; remove Node's so tests fail the way the phone would.
delete (globalThis as { TextDecoder?: unknown }).TextDecoder;
