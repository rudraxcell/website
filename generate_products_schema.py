import json
import re
from pathlib import Path

# ==== CONFIG ====
SITE_URL = "https://www.rudraxcell.com"
PRODUCTS_JSON = Path("data/products.json")
HTML_FILE = Path("products.html")

# ==== LOAD PRODUCTS ====
try:
    with open(PRODUCTS_JSON, "r", encoding="utf-8") as f:
        products = json.load(f)
except Exception as e:
    raise SystemExit(f"❌ Failed to read {PRODUCTS_JSON}: {e}")


def clean_html(text: str) -> str:
    """Replace <br> tags and collapse multiple spaces for clean JSON-LD text."""
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


# ==== BUILD PRODUCT SCHEMA ====
valid_products = []
for i, p in enumerate(products, start=1):
    title = p.get("title")
    if not title:
        print(f"⚠️  Warning: Product #{i} is missing 'title' — skipping.")
        continue

    image = p.get("image", "")
    alt = p.get("alt", title)
    raw_description = p.get("description", "")
    description = clean_html(raw_description)
    link = p.get("link", "#")

    full_image_url = (
        image if image.startswith("http") else f"{SITE_URL}/{image.lstrip('/')}"
    )
    full_product_url = (
        link if link.startswith("http") else f"{SITE_URL}/{link.lstrip('/')}"
    )

    valid_products.append(
        {
            "@type": "ListItem",
            "position": len(valid_products) + 1,
            "item": {
                "@type": "Product",
                "name": title,
                "image": full_image_url if image else None,
                "description": description,
                "url": full_product_url,
                "brand": {
                    "@type": "Brand",
                    "name": "RudraXcell Lifecare Pvt. Ltd.",
                },
                "offers": {
                    "@type": "Offer",
                    "url": full_product_url,
                    "availability": "https://schema.org/InStock",
                    "priceCurrency": "INR",
                },
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
json_ld_script = (
    f"{marker_start}\n"
    f'<script id="products-jsonld" type="application/ld+json">\n{json_ld}\n</script>\n'
    f"{marker_end}"
)

# ==== READ HTML ====
html = HTML_FILE.read_text(encoding="utf-8")

# ==== REPLACE OR INSERT ONLY THE PRODUCT SCHEMA BLOCK ====
if marker_start in html and marker_end in html:
    new_html = re.sub(
        rf"{re.escape(marker_start)}.*?{re.escape(marker_end)}",
        json_ld_script,
        html,
        flags=re.DOTALL,
    )
else:
    new_html = re.sub(
        r"</head>", json_ld_script + "\n</head>", html, flags=re.IGNORECASE
    )

# ==== WRITE UPDATED HTML ====
HTML_FILE.write_text(new_html, encoding="utf-8")

print(
    f"✅ Injected product JSON-LD for {len(valid_products)} products into {HTML_FILE}!"
)
