#!/usr/bin/env bash
# Generates the app icon, launch screens and in-app images from design/brand/logo.png and logo-orchid.png.
# Needs ImageMagick 7 (`magick`); uses pngquant to shrink the PNGs when installed.
# Works with the bash 3 on macOS. Run from anywhere: scripts/brand-assets.sh
set -euo pipefail

command -v magick >/dev/null || { echo "ImageMagick 7 (magick) is required" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/design/brand/logo.png"
ORCHID_SRC="$ROOT/design/brand/logo-orchid.png"
APP="$ROOT/apps/mobile"
RES="$APP/android/app/src/main/res"
IOS="$APP/ios/MiloJulo/Images.xcassets"
ASSETS="$APP/src/assets/brand"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# token <name>: a colour from design/tokens.ts.
token() {
  local v
  v="$(sed -n "s/^[[:space:]]*$1: '\(#[0-9A-Fa-f]\{6\}\)'.*/\1/p" "$ROOT/design/tokens.ts")"
  [ -n "$v" ] || { echo "colors.$1 not found in design/tokens.ts" >&2; exit 1; }
  echo "$v"
}
# Dark surface behind the app icon; light surface behind the launch screens (founder, 2026-10-15).
INK="$(token ink)"
GROUND="$(token ground)"

# crop_logo <src> <name> <gap> [clean]: a logo is three bands, mark, wordmark and tagline, split by rows whose
# coverage (0-255) is at most <gap>: 0 for logo.png; 12 (about 5%) for logo-orchid.png, whose M
# touches the J of the wordmark, so no row there is empty.
# Finds them from the alpha (50% threshold, which ignores faint specks) and writes $TMP/<name>-mark.png
# (above the wordmark, trimmed to its alpha box), $TMP/<name>-word.png (the wordmark band, trimmed
# the same way) and $TMP/<name>-logo.png (mark and wordmark, cut in
# the middle of the gap above the tagline). Sets CROP to "<width> <logo height> <mark box>".
# With <clean> set, alpha islands under 150 px are dropped from the source (stray specks) and under
# 2000 px from the cropped mark and wordmark (slivers of the J or the M across the cut).
crop_logo() {
  local src="$1" name="$2" w h bands mark_end word_start word_end tag_start logo_h box
  if [ -n "${4:-}" ]; then
    despeckle "$src" "$TMP/$name-src.png" 150
    src="$TMP/$name-src.png"
  fi
  read -r w h <<<"$(magick identify -format '%w %h' "$src")"
  magick "$src" -alpha extract -threshold 50% -scale "1x$h!" -depth 8 txt:- |
    awk -v gap="$3" -F'[(,)]' 'NR > 1 { print ($3 > gap) }' >"$TMP/rows"
  bands="$(awk '
    $1 && !on { start = NR - 1; on = 1 }
    !$1 && on { print start, NR - 2; on = 0 }
    END { if (on) print start, NR - 1 }' "$TMP/rows")"
  [ "$(echo "$bands" | wc -l | tr -d ' ')" = 3 ] || {
    echo "expected mark, wordmark and tagline bands in $src, found: $bands" >&2
    exit 1
  }
  read -r _ mark_end <<<"$(echo "$bands" | sed -n 1p)"
  read -r word_start word_end <<<"$(echo "$bands" | sed -n 2p)"
  read -r tag_start _ <<<"$(echo "$bands" | sed -n 3p)"
  magick "$src" -crop "${w}x$((mark_end + 1))+0+0" +repage "$TMP/top.png"
  [ -z "${4:-}" ] || despeckle "$TMP/top.png" "$TMP/top.png" 2000
  box="$(magick "$TMP/top.png" -alpha extract -threshold 50% -format '%@' info:)"
  magick "$TMP/top.png" -crop "$box" +repage "$TMP/$name-mark.png"
  # The wordmark alone, trimmed to its alpha box, with the same sliver cleanup as the mark.
  magick "$src" -crop "${w}x$((word_end - word_start + 1))+0+$word_start" +repage "$TMP/word.png"
  [ -z "${4:-}" ] || despeckle "$TMP/word.png" "$TMP/word.png" 2000
  magick "$TMP/word.png" -crop "$(magick "$TMP/word.png" -alpha extract -threshold 50% -format '%@' info:)" \
    +repage "$TMP/$name-word.png"
  logo_h=$(((word_end + tag_start) / 2 + 1))
  magick "$src" -crop "${w}x$logo_h+0+0" +repage "$TMP/$name-logo.png"
  CROP="$w $logo_h $box"
}

# despeckle <in> <out> <px>: clears the alpha of opaque islands under <px> pixels.
despeckle() {
  magick "$1" -alpha extract -threshold 50% -define connected-components:area-threshold="$3" \
    -define connected-components:mean-color=true -connected-components 8 "$TMP/keep.png"
  magick "$1" \( +clone -alpha extract "$TMP/keep.png" -compose multiply -composite \) \
    -alpha off -compose CopyOpacity -composite "$2"
}

# The original logo (white "Milo", for dark surfaces) gives the app icon and Welcome's mark; the
# orchid logo (dark "Milo", for light surfaces) gives the launch screens and the loader's logo.
crop_logo "$SRC" orig 0
read -r _ _ BOX <<<"$CROP"
MARK="$TMP/orig-mark.png"
crop_logo "$ORCHID_SRC" orchid 12 clean
read -r W LOGO_H ORCHID_BOX <<<"$CROP"
ORCHID_MARK="$TMP/orchid-mark.png"

# Writes a PNG small: 8-bit, no metadata, max zlib; pngquant (when installed) on top.
save() {
  magick "$1" -depth 8 -strip -define png:compression-level=9 -define png:compression-filter=5 "$2"
  if command -v pngquant >/dev/null; then
    pngquant --force --skip-if-larger --quality 85-98 --speed 1 --output "$2" "$2" || true
  fi
}

# mark_on <canvas px> <mark box px> <out> [background] [mark file]: a mark centred, fitted inside a square box.
mark_on() {
  magick -size "$1x$1" "xc:${4:-none}" \
    \( "${5:-$MARK}" -filter Lanczos -resize "$2x$2" \) -gravity center -composite "$TMP/out.png"
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
  # the orchid mark in a 96 dp box.
  mark_on "$(px 288 "$s")" "$(px 96 "$s")" "$RES/drawable-$d/splash_icon.png" none "$ORCHID_MARK"

  # Pre-12 launch background: the orchid mark at 88 dp, centred on ground by drawable/launch_background.xml.
  mark_on "$(px 88 "$s")" "$(px 88 "$s")" "$RES/drawable-$d/launch_mark.png" none "$ORCHID_MARK"
done

cat >"$RES/values/colors.xml" <<EOF
<resources>
    <!-- Written by scripts/brand-assets.sh from design/tokens.ts: ink behind the app icon, ground behind the launch screens. -->
    <color name="brand_ink">$INK</color>
    <color name="brand_ground">$GROUND</color>
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

# iOS launch screen: the orchid mark at 88 pt (LaunchScreen.storyboard sizes it, on ground).
LAUNCH="$IOS/LaunchLogo.imageset"
mkdir -p "$LAUNCH"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  mark_on $((88 * sc)) $((88 * sc)) "$LAUNCH/launch-logo$suffix.png" none "$ORCHID_MARK"
done

# In-app logo (BrandLoader, on the light surface), 280 pt wide: the orchid mark and wordmark, no tagline.
mkdir -p "$ASSETS"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  magick "$TMP/orchid-logo.png" -filter Lanczos -resize "$((280 * sc))x" "$TMP/out.png"
  save "$TMP/out.png" "$ASSETS/logo$suffix.png"
done

# In-app mark (Welcome, above the text name), 72 pt wide: two figures and the heart only.
read -r MW MH <<<"$(magick identify -format '%w %h' "$MARK")"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  magick "$MARK" -filter Lanczos -resize "$((72 * sc))x" "$TMP/out.png"
  save "$TMP/out.png" "$ASSETS/mark$suffix.png"
done

# In-app wordmark (Discover's header, on the light surface), 32 pt high: the orchid logo's "MiloJulo" alone.
read -r WW WH <<<"$(magick identify -format '%w %h' "$TMP/orchid-word.png")"
for sc in 1 2 3; do
  suffix=$([ "$sc" = 1 ] && echo "" || echo "@${sc}x")
  magick "$TMP/orchid-word.png" -filter Lanczos -resize "x$((32 * sc))" "$TMP/out.png"
  save "$TMP/out.png" "$ASSETS/wordmark$suffix.png"
done

cat >"$ASSETS/index.ts" <<EOF
// Written by scripts/brand-assets.sh: the in-app logo (mark and wordmark, no tagline), the mark alone and the wordmark alone.
export const brandLogo = require('./logo.png');
export const logoAspectRatio = $W / $LOGO_H;
export const brandMark = require('./mark.png');
export const markAspectRatio = $MW / $MH;
export const brandWordmark = require('./wordmark.png');
export const wordmarkAspectRatio = $WW / $WH;
EOF

echo "Brand assets written: ink $INK, ground $GROUND, mark $BOX, orchid mark $ORCHID_BOX, logo ${W}x$LOGO_H."
