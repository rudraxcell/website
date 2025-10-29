async function loadHTML(selector, file) {
	const container = document.querySelector(selector);
	if (!container) return;

	try {
		const response = await fetch(file);
		if (!response.ok) throw new Error(`Failed to load ${file}`);
		const html = await response.text();
		container.innerHTML = html;

		// After loading navbar, highlight active link
		if (selector === "nav") {
			setActiveNavLink();
		}
	} catch (err) {
		console.error(err);
	}
}

function setActiveNavLink() {
	// Normalize current path to a filename; treat "/" as index.html
	const currentPath = window.location.pathname || "/";
	const currentFile =
		currentPath === "/" || currentPath === ""
			? "index.html"
			: currentPath.split("/").pop();

	const links = document.querySelectorAll("nav .nav-link");
	links.forEach((link) => {
		// get raw href from markup (preserve relative/absolute as written)
		const rawHref = link.getAttribute("href") || "";

		// Build absolute pathname for the link using the current page as base,
		// this handles relative paths, "./index.html", "../foo/index.html", etc.
		let linkPathname;
		try {
			// new URL(relativeOrAbsolute, base) resolves to an absolute URL
			linkPathname = new URL(rawHref, window.location.href).pathname;
		} catch (e) {
			// fallback: if URL constructor fails, compare the raw href directly
			linkPathname = rawHref;
		}

		// convert empty pathname ("/") to index.html for comparison
		const linkFile =
			linkPathname === "/" || linkPathname === ""
				? "index.html"
				: linkPathname.split("/").pop();

		// Mark active if filenames match OR full pathnames match
		// Special-case: if the nav link points to the products index page,
		// Generalized section matching:
		// If a nav link points to '/section.html' or '/section/index.html',
		// treat any URL under '/section/' as active as well (e.g. '/section/item.html').
		var linkFileName = linkFile || "";
		var sectionPrefix = linkPathname;
		// remove trailing slash
		if (sectionPrefix.endsWith("/"))
			sectionPrefix = sectionPrefix.slice(0, -1);
		// if link ends with .html, strip the extension to get the section base
		if (sectionPrefix.endsWith(".html")) {
			sectionPrefix = sectionPrefix.replace(/\.html$/, "");
		}
		// normalize root to '/'
		if (sectionPrefix === "") sectionPrefix = "/";

		var isInSection =
			sectionPrefix !== "/" &&
			currentPath.startsWith(sectionPrefix + "/");

		if (
			linkFileName === currentFile ||
			linkPathname === currentPath ||
			isInSection
		) {
			link.classList.add("active");
			// optional: set aria-current for accessibility
			link.setAttribute("aria-current", "page");
		} else {
			link.classList.remove("active");
			link.removeAttribute("aria-current");
		}
	});
}

// Load shared components on DOM ready
document.addEventListener("DOMContentLoaded", () => {
	loadHTML("nav", "/partials/nav.html");
	loadHTML("footer", "/partials/footer.html");
});
