import { readdirSync } from 'fs';
import { join } from 'path';
import { type } from '../../../design/tokens';
import { fontFamily } from '../src/theme';

// A font family React Native can't find fails silently: Android falls back to Roboto and nothing
// is logged, so the app quietly stops looking like itself (#198). These two tests are the alarm.
const bundled = readdirSync(
  join(__dirname, '../android/app/src/main/assets/fonts'),
)
  .filter(name => name.endsWith('.ttf'))
  .map(name => name.replace(/\.ttf$/, ''));

test('every font the theme asks for is bundled with the Android app', () => {
  const asked = [
    ...new Set(Object.values(type).map(t => fontFamily(t.family, t.weight))),
  ].sort();
  expect(asked.filter(family => !bundled.includes(family))).toEqual([]);
  expect(asked.length).toBeGreaterThan(1);
});

test('every text variant names a font, a size and a line height', () => {
  for (const [variant, t] of Object.entries(type)) {
    expect([variant, typeof fontFamily(t.family, t.weight)]).toEqual([
      variant,
      'string',
    ]);
    expect([variant, t.size > 0 && t.line >= t.size]).toEqual([variant, true]);
  }
});
