#!/usr/bin/env bash
# Generates the app icon, launch screen and in-app logo images from design/brand/logo.png (#92).
# Needs ImageMagick 7 (`magick`). Run from anywhere: scripts/brand-assets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/design/brand/logo.png"
APP="$ROOT/apps/mobile"
RES="$APP/android/app/src/main/res"
IOS="$APP/ios/MiloJulo/Images.xcassets"
ASSETS="$APP/src/assets/brand"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Dark brand surface: colors.ink in design/tokens.ts.
INK="$(grep -oP "^\s*ink: '\K#[0-9A-Fa-f]{6}" "$ROOT/design/tokens.ts")"

# The mark (two figures and the heart) ends at row 859 of the source; the wordmark starts at row 873.
# Its alpha bounding box (threshold 50%, which drops the faint specks) is 868x802+231+58.
MARK="$TMP/mark.png"
magick "$SRC" -crop 868x802+231+58 +repage "$MARK"

# mark_on <canvas px> <mark box px> <out> [background]: the mark centred, fitted inside a square box.
mark_on() {
  magick -size "$1x$1" "xc:${4:-none}" \
    \( "$MARK" -filter Lanczos -resize "$2x$2" \) -gravity center -composite \
    -strip "$3"
}

declare -A DENSITY=([mdpi]=1 [hdpi]=1.5 [xhdpi]=2 [xxhdpi]=3 [xxxhdpi]=4)
px() { awk -v d="$1" -v s="$2" 'BEGIN { printf "%d", d * s + 0.5 }'; }

for d in "${!DENSITY[@]}"; do
  s="${DENSITY[$d]}"
  dir="$RES/mipmap-$d"
  mkdir -p "$dir" "$RES/drawable-$d"

  # Legacy icons (48 dp): rounded square and circle on ink, mark at 68%.
  n=$(px 48 "$s"); m=$(px 32 "$s"); r=$(px 10 "$s")
  mark_on "$n" "$m" "$TMP/legacy.png" "$INK"
  magick "$TMP/legacy.png" \
    \( -size "${n}x$n" xc:none -fill white -draw "roundrectangle 0,0 $((n - 1)),$((n - 1)) $r,$r" \) \
    -alpha off -compose CopyOpacity -composite -strip "$dir/ic_launcher.png"
  magick "$TMP/legacy.png" \
    \( -size "${n}x$n" xc:none -fill white -draw "circle $((n / 2)),$((n / 2)) $((n / 2)),0" \) \
    -alpha off -compose CopyOpacity -composite -strip "$dir/ic_launcher_round.png"

  # Adaptive foreground (108 dp canvas): mark in a 50 dp box, whose diagonal fits the 66 dp safe-zone circle.
  mark_on "$(px 108 "$s")" "$(px 50 "$s")" "$dir/ic_launcher_foreground.png"

  # Android 12+ splash icon (288 dp canvas, shown inside a 192 dp circle): mark in a 136 dp box (fits the circle).
  mark_on "$(px 288 "$s")" "$(px 136 "$s")" "$RES/drawable-$d/splash_icon.png"

  # Pre-12 launch background: the mark at 120 dp, centred on ink by drawable/launch_background.xml.
  mark_on "$(px 120 "$s")" "$(px 120 "$s")" "$RES/drawable-$d/launch_mark.png"
done

# iOS app icon: opaque 1024 master on ink (iOS refuses alpha), then every size in Contents.json.
APPICON="$IOS/AppIcon.appiconset"
mark_on 1024 680 "$TMP/master.png" "$INK"
magick "$TMP/master.png" -alpha off -strip "$APPICON/icon-1024.png"
for spec in 20:2 20:3 29:2 29:3 40:2 40:3 60:2 60:3; do
  pt=${spec%:*}; sc=${spec#*:}; n=$((pt * sc))
  magick "$APPICON/icon-1024.png" -filter Lanczos -resize "${n}x$n" -strip "$APPICON/icon-${pt}@${sc}x.png"
done

# iOS launch screen mark, 120 pt.
LAUNCH="$IOS/LaunchLogo.imageset"
mkdir -p "$LAUNCH"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  mark_on $((120 * sc)) $((120 * sc)) "$LAUNCH/launch-logo$suffix.png"
done

# In-app logo (BrandLoader and Welcome), 280 pt wide: the mark and wordmark without the tagline
# (founder, 2026-10-15). The wordmark ends at row 1104 and the tagline starts at row 1118, so keep
# rows 0-1110.
mkdir -p "$ASSETS"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  magick "$SRC" -crop 1316x1111+0+0 +repage -filter Lanczos -resize "$((280 * sc))x" -strip "$ASSETS/logo$suffix.png"
done

echo "Brand assets written (ink $INK)."
