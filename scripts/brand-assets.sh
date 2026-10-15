#!/usr/bin/env bash
# Generates the app icon, launch screens and in-app logo from design/brand/logo.png (#92).
# Needs ImageMagick 7 (`magick`); uses pngquant to shrink the PNGs when installed.
# Works with the bash 3 on macOS. Run from anywhere: scripts/brand-assets.sh
set -euo pipefail

command -v magick >/dev/null || { echo "ImageMagick 7 (magick) is required" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/design/brand/logo.png"
APP="$ROOT/apps/mobile"
RES="$APP/android/app/src/main/res"
IOS="$APP/ios/MiloJulo/Images.xcassets"
ASSETS="$APP/src/assets/brand"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Dark brand surface: colors.ink in design/tokens.ts, also written to Android's colors.xml.
INK="$(sed -n "s/^[[:space:]]*ink: '\(#[0-9A-Fa-f]\{6\}\)'.*/\1/p" "$ROOT/design/tokens.ts")"
[ -n "$INK" ] || { echo "colors.ink not found in design/tokens.ts" >&2; exit 1; }

# The logo is three bands separated by empty rows: mark, wordmark, tagline. Find them from the
# alpha (50% threshold, which ignores the faint specks around the artwork).
read -r W H <<<"$(magick identify -format '%w %h' "$SRC")"
magick "$SRC" -alpha extract -threshold 50% -scale "1x$H!" -depth 8 txt:- |
  awk -F'[(,)]' 'NR > 1 { print ($3 > 0) }' >"$TMP/rows"
BANDS="$(awk '
  $1 && !on { start = NR - 1; on = 1 }
  !$1 && on { print start, NR - 2; on = 0 }
  END { if (on) print start, NR - 1 }' "$TMP/rows")"
[ "$(echo "$BANDS" | wc -l | tr -d ' ')" = 3 ] || {
  echo "expected mark, wordmark and tagline bands in $SRC, found: $BANDS" >&2
  exit 1
}
read -r _ MARK_END <<<"$(echo "$BANDS" | sed -n 1p)"
read -r _ WORD_END <<<"$(echo "$BANDS" | sed -n 2p)"
read -r TAG_START _ <<<"$(echo "$BANDS" | sed -n 3p)"

# Mark: everything above the wordmark, trimmed to its alpha box.
magick "$SRC" -crop "${W}x$((MARK_END + 1))+0+0" +repage "$TMP/top.png"
BOX="$(magick "$TMP/top.png" -alpha extract -threshold 50% -format '%@' info:)"
MARK="$TMP/mark.png"
magick "$TMP/top.png" -crop "$BOX" +repage "$MARK"
# Logo without the tagline: down to the middle of the gap above the tagline.
LOGO_H=$(((WORD_END + TAG_START) / 2 + 1))
magick "$SRC" -crop "${W}x$LOGO_H+0+0" +repage "$TMP/logo.png"

# Writes a PNG small: 8-bit, no metadata, max zlib; pngquant (when installed) on top.
save() {
  magick "$1" -depth 8 -strip -define png:compression-level=9 -define png:compression-filter=5 "$2"
  if command -v pngquant >/dev/null; then
    pngquant --force --skip-if-larger --quality 85-98 --speed 1 --output "$2" "$2" || true
  fi
}

# mark_on <canvas px> <mark box px> <out> [background]: the mark centred, fitted inside a square box.
mark_on() {
  magick -size "$1x$1" "xc:${4:-none}" \
    \( "$MARK" -filter Lanczos -resize "$2x$2" \) -gravity center -composite "$TMP/out.png"
  save "$TMP/out.png" "$3"
}

px() { awk -v d="$1" -v s="$2" 'BEGIN { printf "%d", d * s + 0.5 }'; }

for spec in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  d="${spec%%:*}"; s="${spec#*:}"
  dir="$RES/mipmap-$d"
  mkdir -p "$dir" "$RES/drawable-$d"

  # Legacy icons (48 dp): rounded square and circle on ink, mark at 32 dp.
  n=$(px 48 "$s"); r=$(px 10 "$s")
  mark_on "$n" "$(px 32 "$s")" "$TMP/legacy.png" "$INK"
  magick "$TMP/legacy.png" \
    \( -size "${n}x$n" xc:none -fill white -draw "roundrectangle 0,0 $((n - 1)),$((n - 1)) $r,$r" \) \
    -alpha off -compose CopyOpacity -composite "$TMP/out.png"
  save "$TMP/out.png" "$dir/ic_launcher.png"
  magick "$TMP/legacy.png" \
    \( -size "${n}x$n" xc:none -fill white -draw "circle $((n / 2)),$((n / 2)) $((n / 2)),0" \) \
    -alpha off -compose CopyOpacity -composite "$TMP/out.png"
  save "$TMP/out.png" "$dir/ic_launcher_round.png"

  # Adaptive foreground (108 dp canvas): mark in a 50 dp box, whose diagonal fits the 66 dp safe-zone circle.
  mark_on "$(px 108 "$s")" "$(px 50 "$s")" "$dir/ic_launcher_foreground.png"

  # Android 12+ splash icon: Android's spec canvas is 288 dp (icon shown inside a 192 dp circle),
  # mark in a 136 dp box so it fits the circle.
  mark_on "$(px 288 "$s")" "$(px 136 "$s")" "$RES/drawable-$d/splash_icon.png"

  # Pre-12 launch background: the mark at 120 dp, centred on ink by drawable/launch_background.xml.
  mark_on "$(px 120 "$s")" "$(px 120 "$s")" "$RES/drawable-$d/launch_mark.png"
done

cat >"$RES/values/colors.xml" <<EOF
<resources>
    <!-- Written by scripts/brand-assets.sh from colors.ink in design/tokens.ts: the dark brand surface. -->
    <color name="brand_ink">$INK</color>
</resources>
EOF

# iOS app icon: opaque 1024 master on ink (iOS refuses alpha), then every size in Contents.json.
APPICON="$IOS/AppIcon.appiconset"
magick -size 1024x1024 "xc:$INK" \( "$MARK" -filter Lanczos -resize 680x680 \) \
  -gravity center -composite -alpha off "$TMP/master.png"
save "$TMP/master.png" "$APPICON/icon-1024.png"
for spec in 20:2 20:3 29:2 29:3 40:2 40:3 60:2 60:3; do
  pt=${spec%:*}; sc=${spec#*:}; n=$((pt * sc))
  magick "$TMP/master.png" -filter Lanczos -resize "${n}x$n" -alpha off "$TMP/out.png"
  save "$TMP/out.png" "$APPICON/icon-${pt}@${sc}x.png"
done

# iOS launch screen mark, 120 pt.
LAUNCH="$IOS/LaunchLogo.imageset"
mkdir -p "$LAUNCH"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  mark_on $((120 * sc)) $((120 * sc)) "$LAUNCH/launch-logo$suffix.png"
done

# In-app logo (BrandLoader and Welcome), 280 pt wide: mark and wordmark, no tagline (founder).
mkdir -p "$ASSETS"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  magick "$TMP/logo.png" -filter Lanczos -resize "$((280 * sc))x" "$TMP/out.png"
  save "$TMP/out.png" "$ASSETS/logo$suffix.png"
done

cat >"$ASSETS/index.ts" <<EOF
// Written by scripts/brand-assets.sh: the in-app logo, mark and wordmark without the tagline.
export const brandLogo = require('./logo.png');
export const logoAspectRatio = $W / $LOGO_H;
EOF

echo "Brand assets written: ink $INK, mark $BOX, logo ${W}x$LOGO_H."
