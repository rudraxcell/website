import json
import re
from pathlib import Path
from textwrap import shorten

# === CONFIG ===
json_path = Path("data/distributors.json")
html_path = Path("distributors.html")
output_path = html_path  # overwrite in place

# === LOAD JSON ===
try:
    data = json.loads(json_path.read_text(encoding="utf-8"))
except Exception as e:
    raise SystemExit(f"❌ Failed to read JSON file: {e}")

states = data.get("states", [])

# === BUILD JSON-LD GRAPH ===
graph = []
summary = []

for state in states:
    state_name = state.get("name", "Unknown")
    distributors = state.get("distributors", [])
    summary.append((state_name, len(distributors)))

    for d in distributors:
        graph.append(
            {
                "@type": "LocalBusiness",
                "name": d.get("name"),
                "telephone": d.get("phone"),
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": d.get("address"),
                    "addressLocality": d.get("city"),
                    "addressRegion": state_name,
                },
                "areaServed": state_name,
            }
        )

schema = {"@context": "https://schema.org", "@graph": graph}

# === READ HTML FILE ===
try:
    html = html_path.read_text(encoding="utf-8")
except Exception as e:
    raise SystemExit(f"❌ Failed to read HTML file: {e}")

# === PREPARE NEW JSON-LD BLOCK ===
new_jsonld_block = (
    '<script id="distributors-jsonld" type="application/ld+json">\n'
    + json.dumps(schema, indent=4)
    + "\n</script>"
)

# === REPLACE EXISTING BLOCK ===
pattern = r'<script\s+id="distributors-jsonld"[^>]*?>.*?</script>'
html_updated, count = re.subn(
    pattern, new_jsonld_block, html, flags=re.DOTALL | re.IGNORECASE
)

if count == 0:
    print("⚠️ No existing JSON-LD block found — inserting new block before </head>.")
    html_updated = re.sub(
        r"</head>", f"{new_jsonld_block}\n</head>", html, flags=re.IGNORECASE
    )

# === WRITE UPDATED HTML ===
output_path.write_text(html_updated, encoding="utf-8")

# === PRINT SUMMARY TABLE ===
print("\n✅ JSON-LD updated successfully!\n")
print(f"📦 Total distributors: {len(graph)} across {len(states)} states.\n")
print("📊 Summary by state:")
print("-" * 45)
for state_name, count in summary:
    print(f"{state_name:<25} {count:>3} distributors")
print("-" * 45)
print()

# Show a short preview of JSON-LD (first distributor)
if graph:
    first = graph[0]
    preview = json.dumps(first, indent=4)
    print("🧾 Sample entry:\n" + shorten(preview, width=400, placeholder=" ... }"))
