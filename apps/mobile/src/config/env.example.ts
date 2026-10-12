// Copy to env.ts (gitignored; `npm install` does it for you) and fill in.
// Local stack: values from `npx supabase status` at the repo root. An Android emulator reaches
// the host at 10.0.2.2, a USB device needs `adb reverse tcp:54321 tcp:54321` and 127.0.0.1.
export const env = {
  supabaseUrl: 'http://10.0.2.2:54321',
  supabaseAnonKey: '',
};
