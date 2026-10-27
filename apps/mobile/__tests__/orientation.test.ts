import { readFileSync } from 'fs';
import path from 'path';

// The screens are designed for an upright phone only (docs/05), so the app never turns sideways.
const read = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Android keeps the app upright', () => {
  expect(read('android/app/src/main/AndroidManifest.xml')).toMatch(
    /android:name="\.MainActivity"[^>]*android:screenOrientation="portrait"/s,
  );
});

test('iOS keeps the app upright on iPhone and iPad', () => {
  const plist = read('ios/MiloJulo/Info.plist');
  for (const key of [
    'UISupportedInterfaceOrientations',
    'UISupportedInterfaceOrientations~ipad',
  ]) {
    const list = plist.match(
      new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`),
    )![1];
    expect(list.match(/<string>[^<]+<\/string>/g)).toEqual([
      '<string>UIInterfaceOrientationPortrait</string>',
    ]);
  }
  // An iPad app that can't rotate must opt out of multitasking, or the App Store refuses it.
  expect(plist).toMatch(/<key>UIRequiresFullScreen<\/key>\s*<true\/>/);
});
