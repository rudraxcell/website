(function () {
	"use strict";

	function createTableForState(state) {
		var table = document.createElement("table");
		table.className = "table table-striped table-hover distributor-table";

		var thead = document.createElement("thead");
		var tr = document.createElement("tr");

		var th1 = document.createElement("th");
		th1.className = "w-25";
		th1.textContent = "Distributor";
		var th2 = document.createElement("th");
		th2.className = "w-35";
		th2.textContent = "Address";
		var th3 = document.createElement("th");
		th3.className = "w-20";
		th3.textContent = "City";
		var th4 = document.createElement("th");
		th4.className = "w-20";
		th4.textContent = "Phone";

		tr.appendChild(th1);
		tr.appendChild(th2);
		tr.appendChild(th3);
		tr.appendChild(th4);
		thead.appendChild(tr);
		table.appendChild(thead);

		var tbody = document.createElement("tbody");
		state.distributors.forEach(function (d) {
			var row = document.createElement("tr");
			var c1 = document.createElement("td");
			c1.textContent = d.name;
			var c2 = document.createElement("td");
			c2.textContent = d.address;
			var c3 = document.createElement("td");
			c3.textContent = d.city;
			var c4 = document.createElement("td");
			c4.textContent = d.phone;
			row.appendChild(c1);
			row.appendChild(c2);
			row.appendChild(c3);
			row.appendChild(c4);
			tbody.appendChild(row);
		});
		table.appendChild(tbody);
		return table;
	}

	function createCardForState(state) {
		var card = document.createElement("div");
		card.className = "card mb-4 w-100 distributor-card";

		var header = document.createElement("div");
		header.className = "card-header bg-primary text-white";
		var h3 = document.createElement("h3");
		h3.className = "h5 mb-0";
		h3.textContent = state.name;
		header.appendChild(h3);

		var body = document.createElement("div");
		body.className = "card-body";
		var wrap = document.createElement("div");
		wrap.className = "table-responsive";
		var table = createTableForState(state);
		wrap.appendChild(table);
		body.appendChild(wrap);

		card.appendChild(header);
		card.appendChild(body);
		return card;
	}

	function toJsonLd(states) {
		var graph = [];
		states.forEach(function (s) {
			s.distributors.forEach(function (d) {
				graph.push({
					"@type": "LocalBusiness",
					name: d.name,
					telephone: d.phone,
					address: {
						"@type": "PostalAddress",
						streetAddress: d.address || "",
						addressLocality: d.city || "",
						addressRegion: s.name || "",
					},
					areaServed: s.name,
				});
			});
		});
		return { "@context": "https://schema.org", "@graph": graph };
	}

	function render(states) {
		var container = document.getElementById("distributor-list");
		if (!container) return;

		// Replace content with dynamically generated cards
		var fragment = document.createDocumentFragment();
		states.forEach(function (s) {
			fragment.appendChild(createCardForState(s));
		});

		// Clear and append
		container.innerHTML = "";
		container.appendChild(fragment);

		// Inject JSON-LD for SEO (search engines that execute JS will pick this up)
		try {
			var ld = toJsonLd(states);
			var ldScriptId = "distributors-jsonld";
			var existing = document.getElementById(ldScriptId);
			if (existing) {
				// Update static JSON-LD previously embedded server-side
				existing.text = JSON.stringify(ld);
			} else {
				var script = document.createElement("script");
				script.type = "application/ld+json";
				script.id = ldScriptId;
				script.text = JSON.stringify(ld);
				document.head.appendChild(script);
			}
		} catch (e) {
			// non-fatal
			console.warn("Failed to inject or update JSON-LD", e);
		}
	}

	// Helper UI functions
	function showLoading(container) {
		container.innerHTML = "";
		let wrap = document.createElement("div");
		wrap.className = "text-center py-5";
		let spinner = document.createElement("div");
		spinner.className = "spinner-border text-primary";
		spinner.setAttribute("role", "status");
		let sr = document.createElement("span");
		sr.className = "visually-hidden";
		sr.textContent = "Loading...";
		spinner.appendChild(sr);
		wrap.appendChild(spinner);
		let label = document.createElement("div");
		label.className = "mt-2";
		label.textContent = "Loading distributors...";
		wrap.appendChild(label);
		container.appendChild(wrap);
	}

	function showError(container, message, retryFn) {
		container.innerHTML = "";
		let alert = document.createElement("div");
		alert.className =
			"alert alert-danger text-center align-items-center justify-content-center d-flex mx-5";
		alert.setAttribute("role", "alert");
		alert.textContent = message;
		alert.style.height = "350px";

		let actions = document.createElement("div");
		actions.className = "mt-2 centered-actions";

		let retryBtn = document.createElement("button");
		retryBtn.className = "btn btn-sm btn-secondary mb-2";
		retryBtn.textContent = "Retry";
		retryBtn.type = "button";
		retryBtn.addEventListener("click", function () {
			retryFn();
		});

		let contact = document.createElement("button");
		contact.className = "btn btn-sm btn-outline-secondary mb-2";
		contact.type = "button";
		contact.addEventListener("click", function () {
			window.location.href = "/about.html#contact";
		});
		contact.textContent = "Contact us";

		actions.appendChild(retryBtn);
		actions.appendChild(contact);
		container.appendChild(alert);
		container.appendChild(actions);
	}

	document.addEventListener("DOMContentLoaded", function () {
		const url = "data/distributors.json";
		let container = document.getElementById("distributor-list");
		if (!container) return;

		function doFetch() {
			showLoading(container);
			fetch(url, { cache: "no-cache" })
				.then(function (res) {
					if (!res.ok) throw new Error("Network response was not ok");
					return res.json();
				})
				.then(function (data) {
					if (data && Array.isArray(data.states)) {
						render(data.states);
					} else {
						throw new Error("Invalid data format");
					}
				})
				.catch(function (err) {
					console.warn("Could not load distributors.json.", err);
					showError(
						container,
						"Could not load distributor data. Please try again.",
						doFetch
					);
				});
		}

		doFetch();
	});
})();
