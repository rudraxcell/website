(function () {
	const DETAILS_SELECTOR = ".product-toc-details";
	const WRAPPER_SELECTOR = "#toc-list-wrapper";
	const BREAKPOINT = 577; // px; >= this is desktop

	function animateOpen(wrapper) {
		if (!wrapper) return;
		// mark visible for assistive tech immediately
		wrapper.setAttribute("aria-hidden", "false");
		// set maxHeight to scrollHeight to trigger transition
		wrapper.style.maxHeight = wrapper.scrollHeight + "px";
		// after transition, remove inline maxHeight so it can grow/shrink naturally
		const onEnd = function (e) {
			if (e.target !== wrapper) return;
			wrapper.style.maxHeight = "";
			wrapper.removeEventListener("transitionend", onEnd);
		};
		wrapper.addEventListener("transitionend", onEnd);
	}

	function animateClose(wrapper) {
		if (!wrapper) return;
		// ensure starting point is the current height
		wrapper.style.maxHeight = wrapper.scrollHeight + "px";
		// force reflow so the change to 0 is animated
		// eslint-disable-next-line no-unused-expressions
		wrapper.offsetHeight;
		const onEnd = function (e) {
			if (e.target !== wrapper) return;
			// hide for assistive tech after collapse
			wrapper.setAttribute("aria-hidden", "true");
			wrapper.removeEventListener("transitionend", onEnd);
		};
		wrapper.addEventListener("transitionend", onEnd);
		// start collapse
		wrapper.style.maxHeight = "0px";
	}

	function setOpenState(detailsEl, open, instant) {
		if (!detailsEl) return;
		const wrapper = detailsEl.querySelector(WRAPPER_SELECTOR);
		const summary = detailsEl.querySelector("summary.toc-summary");
		// update details open state and aria-expanded
		detailsEl.open = open;
		if (summary)
			summary.setAttribute("aria-expanded", open ? "true" : "false");

		if (!wrapper) return;
		if (instant) {
			// apply without animation
			if (open) {
				wrapper.style.maxHeight = "";
				wrapper.setAttribute("aria-hidden", "false");
			} else {
				wrapper.style.maxHeight = "0px";
				wrapper.setAttribute("aria-hidden", "true");
			}
			return;
		}

		if (open) animateOpen(wrapper);
		else animateClose(wrapper);
	}

	function updateTOCOnResize(instant = true) {
		const details = document.querySelector(DETAILS_SELECTOR);
		if (!details) return;
		const isDesktop = window.innerWidth >= BREAKPOINT;
		// New behaviour: keep TOC collapsed by default, but on desktop show a
		// small visual preview. On mobile keep it collapsed with no preview.
		setOpenState(details, false, instant);
		setPreview(details, isDesktop);
	}

	// Height used for the desktop preview (shows a short strip of the TOC)
	const PREVIEW_HEIGHT = "5rem";

	function setPreview(detailsEl, enable) {
		if (!detailsEl) return;
		const wrapper = detailsEl.querySelector(WRAPPER_SELECTOR);
		if (!wrapper) return;
		if (enable) {
			wrapper.setAttribute("data-preview", "true");
			wrapper.style.overflow = "hidden";
			wrapper.style.maxHeight = PREVIEW_HEIGHT;
			// visually clipped preview is still considered collapsed for a11y
			wrapper.setAttribute("aria-hidden", "true");
		} else {
			wrapper.removeAttribute("data-preview");
			wrapper.style.overflow = "";
			// remove any preview maxHeight so JS can manage it when animating
			if (!detailsEl.open) wrapper.style.maxHeight = "0px";
			wrapper.setAttribute(
				"aria-hidden",
				detailsEl.open ? "false" : "true"
			);
		}
	}

	let _tocObserver = null;

	function setupActiveObserver() {
		// Tear down existing observer
		if (_tocObserver) {
			_tocObserver.disconnect();
			_tocObserver = null;
		}
		const anchors = Array.from(document.querySelectorAll("#toc-list a"));
		if (!anchors.length) return;
		const idToAnchor = new Map();
		anchors.forEach((a) => {
			const href = a.getAttribute("href") || "";
			if (href.charAt(0) === "#") idToAnchor.set(href.slice(1), a);
		});

		const options = {
			root: null,
			rootMargin: "-40% 0px -55% 0px",
			threshold: 0.1,
		};

		_tocObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const id = entry.target.id;
				const anchor = idToAnchor.get(id);
				if (!anchor) return;
				if (entry.isIntersecting) {
					anchor.classList.add("is-active");
				} else {
					anchor.classList.remove("is-active");
				}
			});
		}, options);

		// Observe all headings (same selection as buildTOC uses)
		const targets = Array.from(
			document.querySelectorAll(".main-container h2, .main-container h3")
		).filter(
			(h) =>
				!!h &&
				!h.closest(".related-products") &&
				!(h.id || "").toLowerCase().startsWith("related-products")
		);
		targets.forEach((t) => _tocObserver.observe(t));
	}

	// Observe changes to .main-container so the TOC rebuilds if content is injected
	let _domObserver = null;

	function setupDomObserver() {
		// disconnect previous observer
		if (_domObserver) {
			_domObserver.disconnect();
			_domObserver = null;
		}
		const main = document.querySelector(".main-container");
		if (!main) return;
		let tid = null;
		_domObserver = new MutationObserver((mutations) => {
			// debounce
			clearTimeout(tid);
			tid = setTimeout(() => {
				// rebuild TOC and observers when content changes
				buildTOC();
				setupActiveObserver();
				// reapply preview state according to viewport
				updateTOCOnResize(true);
			}, 150);
		});
		_domObserver.observe(main, { childList: true, subtree: true });
	}

	function slugify(text) {
		return text
			.toString()
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9\-_:]/g, "")
			.replace(/\-+/g, "-");
	}

	function buildTOC() {
		const tocList = document.getElementById("toc-list");
		const details = document.querySelector(DETAILS_SELECTOR);
		if (!tocList || !details) return;

		// Find headings inside the main product content. This is intentionally
		// broad to work across product pages: use .main-container (product pages)
		const selector = ".main-container h2, .main-container h3";
		const headingsAll = Array.from(document.querySelectorAll(selector));
		// Filter out headings that live inside the related-products container
		// or are the related-products heading itself.
		const headings = headingsAll.filter((h) => {
			if (!h) return false;
			if (h.closest(".related-products")) return false;
			const id = (h.id || "").toLowerCase();
			if (id && id.indexOf("related-products") === 0) return false;
			const txt = (h.textContent || "").trim().toLowerCase();
			if (txt === "related products" || txt === "related products:")
				return false;
			return true;
		});

		if (!headings.length) {
			// nothing to show — hide the TOC entirely
			details.style.display = "none";
			return;
		}

		// Clear existing items
		tocList.innerHTML = "";

		headings.forEach(function (h) {
			let id = h.id;
			if (!id) {
				const base = slugify(h.textContent || h.innerText || "section");
				let uniq = base;
				let i = 1;
				while (document.getElementById(uniq)) {
					uniq = base + "-" + i++;
				}
				id = uniq;
				h.id = id;
			}

			const li = document.createElement("li");
			li.className = "list-inline-item";
			const a = document.createElement("a");
			a.href = "#" + id;
			a.textContent = h.textContent.trim();
			// Smooth scroll while accounting for fixed nav offset
			a.addEventListener("click", function (ev) {
				ev.preventDefault();
				const el = document.getElementById(id);
				if (!el) return;
				const navOffsetRaw =
					getComputedStyle(document.documentElement).getPropertyValue(
						"--nav-offset"
					) || "0px";
				const navOffset = parseInt(navOffsetRaw, 10) || 0;
				const top =
					el.getBoundingClientRect().top +
					window.pageYOffset -
					navOffset -
					8; // small breathing room
				window.scrollTo({ top: top, behavior: "smooth" });
				// update focus for accessibility
				el.setAttribute("tabindex", "-1");
				el.focus({ preventScroll: true });
				// if the TOC is currently in preview mode (desktop clipped), expand it
				const detailsEl = document.querySelector(DETAILS_SELECTOR);
				if (detailsEl) {
					setPreview(detailsEl, false);
					// animate open so the user sees the full list (non-instant)
					setOpenState(detailsEl, true);
				}
			});
			li.appendChild(a);
			tocList.appendChild(li);
		});

		// announce count on the live region when expanded
		const live = document.getElementById("toc-live");
		if (live) {
			live.dataset.count = headings.length;
		}
	}

	function init() {
		const details = document.querySelector(DETAILS_SELECTOR);
		if (!details) return;
		const wrapper = details.querySelector(WRAPPER_SELECTOR);
		const live = document.getElementById("toc-live");

		// Ensure proper aria attributes are present
		const summary = details.querySelector("summary.toc-summary");
		if (summary) {
			summary.setAttribute("aria-controls", "toc-list");
			summary.setAttribute("tabindex", "0");
		}

		// Build the TOC from headings on the page
		buildTOC();
		// Setup the observer that keeps the TOC links in sync with scroll
		setupActiveObserver();

		// Initialize open/closed based on viewport (no animation on init)
		updateTOCOnResize(true);

		// Watch for DOM changes (partials, dynamic content) so TOC remains correct
		setupDomObserver();

		// When user toggles manually, animate wrapper smoothly, update aria and announce
		details.addEventListener("toggle", function () {
			// small timeout to let DOM update wrapper.scrollHeight
			requestAnimationFrame(function () {
				const isOpen = details.open;
				// If user opened the TOC manually, remove preview clipping and animate open
				if (isOpen) {
					setPreview(details, false);
				} else {
					// if user collapsed the TOC on desktop, restore the preview
					if (window.innerWidth >= BREAKPOINT)
						setPreview(details, true);
				}
				setOpenState(details, isOpen);
				if (live) {
					const count = live.dataset.count
						? parseInt(live.dataset.count, 10)
						: 0;
					live.textContent = isOpen
						? `Table of contents expanded. ${count} sections available.`
						: "Table of contents collapsed";
				}
				// rebuild observer in case headings changed
				setupActiveObserver();
			});
		});

		// Resize: debounce — apply instant (no animation) on resize
		let tid = null;
		window.addEventListener("resize", function () {
			clearTimeout(tid);
			tid = setTimeout(function () {
				updateTOCOnResize(true);
				// rebuild and rewire observers when layout changes
				buildTOC();
				setupActiveObserver();
			}, 150);
		});

		// Ensure when images/fonts load the wrapper height recalculates if open
		window.addEventListener("load", function () {
			// rebuild toc in case DOM changed during load
			buildTOC();
			if (details.open && wrapper) {
				wrapper.style.maxHeight = wrapper.scrollHeight + "px";
			}
		});
	}

	// DOM ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
