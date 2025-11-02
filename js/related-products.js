/*
  related-products.js
  - Lightweight client-side renderer for related products.
  - Reads /data/products.json and renders Bootstrap cards into any
    container with class `related-products`.
  - Pages may provide an explicit list via `data-related` attribute:
      data-related='["/products/renoxcell.html","/products/probitrust15.html"]'
    or as a comma-separated string of links/titles.
  - If no `data-related` is provided, the script will auto-select up to 4
    other products (excluding the current page).

  Usage (example in product pages):
    <div class="related-products" data-related='["/products/renoxcell.html"]'></div>

  This centralizes related-product rendering and removes duplicated
  markup across product pages.
*/
(function () {
	const DATA_URL = "/data/products.json";
	const MAX_ITEMS = 4;
	let productsCache = null;

	const SPINNER_HTML =
		'<div class="rp-spinner text-center py-3"><div class="spinner-border" role="status" aria-hidden="true"></div><span class="visually-hidden">Loading related products</span></div>';

	function ensureLiveRegion(container) {
		if (!container) return null;
		let live = container.querySelector(".rp-live");
		if (!live) {
			live = document.createElement("div");
			live.className = "rp-live visually-hidden";
			live.setAttribute("aria-live", "polite");
			live.setAttribute("aria-atomic", "true");
			container.appendChild(live);
		}
		return live;
	}

	function setBusy(container, busy, message) {
		if (!container) return;
		if (busy) container.setAttribute("aria-busy", "true");
		else container.removeAttribute("aria-busy");
		const live = ensureLiveRegion(container);
		if (live) live.textContent = message || "";
	}

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	// Fetch with simple retry/backoff to be resilient to transient network errors
	async function fetchWithRetries(url, attempts = 3, backoff = 300) {
		let lastErr = null;
		for (let i = 0; i < attempts; i++) {
			try {
				const res = await fetch(url, { cache: "no-cache" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return await res.json();
			} catch (err) {
				lastErr = err;
				// exponential-ish backoff
				await new Promise((r) => setTimeout(r, backoff * (i + 1)));
			}
		}
		throw lastErr;
	}

	async function loadProducts() {
		if (productsCache) return productsCache;
		productsCache = await fetchWithRetries(DATA_URL, 3, 300);
		return productsCache;
	}

	function normalizePath(path) {
		try {
			return new URL(path, window.location.href).pathname;
		} catch (e) {
			return path;
		}
	}

	function findProduct(products, key) {
		if (!key) return null;
		const kp = String(key).trim();
		const tryPath = normalizePath(kp);
		return (
			products.find(
				(p) => p.link === kp || p.link === tryPath || p.title === kp
			) || null
		);
	}

	function renderCardHTML(p) {
		const alt = p.alt ? escapeHtml(p.alt) : escapeHtml(p.title);
		const title = escapeHtml(p.title);
		// p.description may contain safe HTML (it comes from our data file), inject as-is
		const desc = p.description || "";
		return `
      <div class="col-md-3">
        <div class="card">
          <img src="${p.image}" loading="lazy" class="card-img-top" alt="${alt}" />
          <div class="card-body">
            <h5 class="card-title">${title}</h5>
            <div class="card-text related-product-card">${desc}</div>
            <a href="${p.link}" class="btn btn-primary">View Details</a>
          </div>
        </div>
      </div>
    `;
	}

	function parseRelatedAttribute(attr) {
		if (!attr) return [];
		attr = attr.trim();
		// Try JSON parse first (prefer JSON array)
		if (
			(attr.startsWith("[") && attr.endsWith("]")) ||
			attr.includes('"')
		) {
			try {
				const parsed = JSON.parse(attr);
				if (Array.isArray(parsed)) return parsed.map(String);
			} catch (e) {
				// fall back to comma-split
			}
		}
		// comma separated
		return attr
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	async function renderRelated(container) {
		// show spinner while loading
		if (container) container.innerHTML = SPINNER_HTML;
		setBusy(container, true, "Loading related products");
		try {
			const products = await loadProducts();
			const attr = container.getAttribute("data-related");
			const keys = parseRelatedAttribute(attr);
			let selected = [];

			if (keys.length > 0) {
				for (const k of keys) {
					const found = findProduct(products, k);
					if (found) selected.push(found);
				}
			} else {
				// Auto-select: pick first N products excluding current
				const current = normalizePath(window.location.pathname || "");
				selected = products.filter(
					(p) => normalizePath(p.link) !== current
				);
			}

			selected = selected.slice(0, MAX_ITEMS);

			// If nothing selected, show a graceful fallback (do not leave empty)
			if (!selected || selected.length === 0) {
				container.innerHTML =
					'<div class="alert alert-secondary">Related products are currently unavailable.</div>';
				return;
			}

			const wrapper = document.createElement("div");
			wrapper.className = "row row-cols-1 row-cols-md-4 g-4";
			wrapper.innerHTML = selected.map(renderCardHTML).join("\n");

			container.innerHTML = ""; // Clear previous content
			container.appendChild(wrapper);
			// announce success for screen readers
			setBusy(
				container,
				false,
				`${selected.length} related products loaded`
			);
		} catch (err) {
			// Log for debugging and show unobtrusive fallback UI
			console.error("related-products:", err);
			container.innerHTML =
				'<div class="alert alert-secondary">Related products are currently unavailable. <button class="btn btn-sm btn-outline-primary rp-retry" type="button">Retry</button></div>';
			setBusy(
				container,
				false,
				"Related products are currently unavailable"
			);
			// attach retry handler
			const btn = container.querySelector(".rp-retry");
			if (btn) {
				btn.addEventListener("click", function () {
					// show spinner and try again
					renderRelated(container);
				});
			}
			// schedule a retry after longer backoff (attempt once more)
			setTimeout(async () => {
				try {
					await renderRelated(container);
				} catch (e) {
					// Last-resort mute
					console.error("related-products retry failed", e);
				}
			}, 5000);
		}
	}

	function initRelatedProducts() {
		const nodes = document.querySelectorAll(".related-products");
		if (!nodes || nodes.length === 0) return;
		nodes.forEach((n) => renderRelated(n));
	}

	// Run immediately if the document is already parsed, otherwise wait for DOMContentLoaded.
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initRelatedProducts);
	} else {
		// script may be injected after DOMContentLoaded (via include.js), so run immediately
		initRelatedProducts();
	}
})();
