(function () {
	"use strict";

	// ----------------------------
	// Create Bootstrap Product Card
	// ----------------------------
	function createProductCard(product) {
		const col = document.createElement("div");
		col.className = "col-sm-10 col-md-6 col-lg-4";

		col.innerHTML = `
			<div class="card h-100 shadow-sm">
				<div class="card-img-wrapper">
					<img
						src="${product.image}"
						loading="lazy"
						class="card-img-top"
						alt="${product.alt || product.title}" />
				</div>
				<div class="card-body d-flex flex-column">
					<h5 class="card-title">${product.title}</h5>
					<p class="card-text">${product.description}</p>
					<a href="${product.link}" class="btn btn-primary mt-auto">Learn More</a>
				</div>
			</div>
		`;
		return col;
	}

	// ----------------------------
	// JSON-LD Generator for SEO
	// ----------------------------
	function toJsonLd(products) {
		const graph = products.map((p) => ({
			"@type": "Product",
			name: p.title,
			image: p.image,
			description: p.description,
			url: p.link,
			brand: {
				"@type": "Organization",
				name: "RudraXcell Lifecare Pvt Ltd",
			},
		}));

		return {
			"@context": "https://schema.org",
			"@graph": graph,
		};
	}

	// ----------------------------
	// Render Products
	// ----------------------------
	function render(products) {
		const container = document.getElementById("product-list");
		if (!container) return;

		container.innerHTML = "";
		const fragment = document.createDocumentFragment();
		products.forEach((p) => fragment.appendChild(createProductCard(p)));
		container.appendChild(fragment);

		// Inject JSON-LD for crawlers that execute JS
		try {
			const ld = toJsonLd(products);
			const ldScriptId = "products-jsonld";
			const existing = document.getElementById(ldScriptId);
			if (existing) {
				existing.text = JSON.stringify(ld);
			} else {
				const script = document.createElement("script");
				script.type = "application/ld+json";
				script.id = ldScriptId;
				script.text = JSON.stringify(ld);
				document.head.appendChild(script);
			}
		} catch (e) {
			console.warn("Failed to inject or update JSON-LD", e);
		}
	}

	// ----------------------------
	// UI Helpers
	// ----------------------------
	function showLoading(container) {
		container.innerHTML = "";
		const wrap = document.createElement("div");
		wrap.className = "text-center py-5";

		const spinner = document.createElement("div");
		spinner.className = "spinner-border text-primary";
		spinner.setAttribute("role", "status");

		const sr = document.createElement("span");
		sr.className = "visually-hidden";
		sr.textContent = "Loading...";
		spinner.appendChild(sr);

		wrap.appendChild(spinner);

		const label = document.createElement("div");
		label.className = "mt-2";
		label.textContent = "Loading products...";
		wrap.appendChild(label);

		container.appendChild(wrap);
	}

	function showError(container, message, retryFn) {
		container.innerHTML = "";

		const alert = document.createElement("div");
		alert.className =
			"alert alert-danger text-center align-items-center justify-content-center d-flex mx-5";
		alert.setAttribute("role", "alert");
		alert.textContent = message;
		alert.style.height = "350px";

		const actions = document.createElement("div");
		actions.className = "mt-2 centered-actions";

		const retryBtn = document.createElement("button");
		retryBtn.className = "btn btn-sm btn-secondary mb-2";
		retryBtn.textContent = "Retry";
		retryBtn.type = "button";
		retryBtn.addEventListener("click", retryFn);

		const contact = document.createElement("button");
		contact.className = "btn btn-sm btn-outline-secondary mb-2";
		contact.type = "button";
		contact.textContent = "Contact us";
		contact.addEventListener("click", () => {
			window.location.href = "/about.html#contact";
		});

		actions.appendChild(retryBtn);
		actions.appendChild(contact);

		container.appendChild(alert);
		container.appendChild(actions);
	}

	// ----------------------------
	// Initialization
	// ----------------------------
	document.addEventListener("DOMContentLoaded", function () {
		const url = "/data/products.json";
		const container = document.getElementById("product-list");
		if (!container) return;

		function doFetch() {
			showLoading(container);
			fetch(url, { cache: "no-cache" })
				.then((res) => {
					if (!res.ok) throw new Error("Network response was not ok");
					return res.json();
				})
				.then((data) => {
					if (Array.isArray(data)) {
						render(data);
					} else {
						throw new Error("Invalid products.json format");
					}
				})
				.catch((err) => {
					console.warn("Could not load products.json", err);
					showError(
						container,
						"Could not load product data. Please try again.",
						doFetch
					);
				});
		}

		doFetch();
	});
})();
