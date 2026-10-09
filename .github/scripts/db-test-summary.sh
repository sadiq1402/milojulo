#!/usr/bin/env bash
# Turns `supabase test db` output into a Markdown table of test files and failed tests.
set -euo pipefail
log="$1"

echo "## Database tests"
echo
echo "| Test file | Result |"
echo "|---|---|"
awk '
  function row() { return "| " file " | " status fails " |" }
  /_test\.sql \.+/ {
    if (file) print row()
    file = $1; sub(/.*\//, "", file)
    status = ($NF == "ok") ? "✅ pass" : "❌ fail"
    fails = ""
    next
  }
  file && /^# (Failed test|Looks like)/ {
    sub(/^# (Failed test [0-9]+: )?/, ""); gsub(/\|/, "\\|")
    fails = fails "<br>" $0
    next
  }
  /^Test Summary Report/ { if (file) print row(); file = "" }
  END { if (file) print row() }
' "$log"
echo
grep -E '^(Files=|Result:)' "$log" | sed 's/^/    /' || true
