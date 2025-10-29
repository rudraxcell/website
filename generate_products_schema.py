import json
import re
from pathlib import Path

# ==== CONFIG ====
SITE_URL = "https://www.rudraxcell.com"
PRODUCTS_JSON = Path("data/products.json")
HTML_FILE = Path("products.html")

# ==== LOAD PRODUCTS ====
with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
    products = json.load(f)

# ==== BUILD PRODUCT SCHEMA ====
valid_products = []
for i, p in enumerate(products, start=1):
    title = p.get("title")
    if not title:
        print(f"⚠️  Warning: Product #{i} is missing 'title' — skipping.")
        continue
    image = p.get("image", "")
    alt = p.get("alt", "")
    description = p.get("description", "")
    link = p.get("link", "#")

    valid_products.append(
        {
            "@type": "ListItem",
            "position": len(valid_products) + 1,
            "item": {
                "@type": "Product",
                "name": title,
                "image": SITE_URL + image if image else None,
                "description": description,
                "url": SITE_URL + link,
                "brand": {"@type": "Brand", "name": "RudraXcell Lifecare Pvt. Ltd."},
                "additionalProperty": [
                    {"@type": "PropertyValue", "name": "Alt Text", "value": alt}
                ],
            },
        }
    )

if not valid_products:
    raise ValueError("❌ No valid products found in products.json!")

schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "RudraXcell Lifecare Product Range",
    "url": f"{SITE_URL}/products.html",
    "numberOfItems": len(valid_products),
    "itemListElement": valid_products,
}

# ==== CREATE JSON-LD BLOCK ====
json_ld = json.dumps(schema, indent=2, ensure_ascii=False)
marker_start = "<!-- PRODUCT-SCHEMA-START -->"
marker_end = "<!-- PRODUCT-SCHEMA-END -->"
json_ld_script = f'{marker_start}\n<script type="application/ld+json">\n{json_ld}\n</script>\n{marker_end}'

# ==== READ HTML ====
html = HTML_FILE.read_text(encoding="utf-8")

# ==== REPLACE OR INSERT ONLY THE PRODUCT SCHEMA BLOCK ====
if marker_start in html and marker_end in html:
    # Replace only the section between our custom markers
    new_html = re.sub(
        rf"{marker_start}.*?{marker_end}",
        json_ld_script,
        html,
        flags=re.DOTALL,
    )
else:
    # Insert before </head> without touching other JSON-LD
    new_html = re.sub(
        r"</head>", json_ld_script + "\n</head>", html, flags=re.IGNORECASE
    )

# ==== WRITE UPDATED HTML ====
HTML_FILE.write_text(new_html, encoding="utf-8")

print(
    f"✅ Injected product JSON-LD for {len(valid_products)} products without overwriting other scripts!"
)
