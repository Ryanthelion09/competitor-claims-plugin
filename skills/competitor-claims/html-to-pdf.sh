#!/bin/bash
# Convert an HTML file to PDF using whatever converter is available.
# Usage: html-to-pdf.sh input.html output.pdf
set -u
IN="$1"; OUT="$2"
ABS_IN="$(cd "$(dirname "$IN")" && pwd)/$(basename "$IN")"

for APP in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"; do
  if [ -x "$APP" ]; then
    if "$APP" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$OUT" "file://$ABS_IN" >/dev/null 2>&1 && [ -s "$OUT" ]; then
      echo "converted with: $(basename "$APP") headless"; exit 0
    fi
  fi
done

if command -v wkhtmltopdf >/dev/null 2>&1; then
  if wkhtmltopdf "$ABS_IN" "$OUT" >/dev/null 2>&1 && [ -s "$OUT" ]; then echo "converted with: wkhtmltopdf"; exit 0; fi
fi

if command -v pandoc >/dev/null 2>&1; then
  if pandoc "$ABS_IN" -o "$OUT" >/dev/null 2>&1 && [ -s "$OUT" ]; then echo "converted with: pandoc"; exit 0; fi
fi

if python3 -c "import weasyprint" >/dev/null 2>&1; then
  if python3 -c "import sys, weasyprint; weasyprint.HTML(sys.argv[1]).write_pdf(sys.argv[2])" "$ABS_IN" "$OUT" >/dev/null 2>&1 && [ -s "$OUT" ]; then
    echo "converted with: weasyprint"; exit 0
  fi
fi

echo "ERROR: no HTML-to-PDF converter available (tried Chrome/Chromium/Edge/Brave headless, wkhtmltopdf, pandoc, weasyprint)" >&2
exit 1
