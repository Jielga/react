// Deep links into a site's copies, on a host that has one 404 page.
//
// GitHub Pages answers every missing path with the Pages root's `404.html`,
// whatever directory the path was under. A copy's own `404.html` is never
// consulted, so `/react/tmdatagrid/next/docs/testing` arrives at the root's
// 404 page, which belongs to no site at all.
//
// So the root's 404 page runs this script in routing mode and sends such a
// path to the copy that owns it, parking the path in the query -
// `/react/tmdatagrid/next/?/docs/testing` - because that URL is a real file and
// Pages serves it. The same script, running in that copy, puts the path back
// before the router reads it.
//
// Two modes, chosen by the attributes on the script tag:
//
//   data-sites="a b"       the root's 404 page: route the path to its copy.
//                          `data-legacy-site` names the site that used to be
//                          served from the root, and every path that is not
//                          under a site is sent there.
//   data-slug="next"       a copy: put a parked path back.
//
// `data-site-root` is the Pages root in routing mode and the site's own root
// in a copy.
//
// Loaded synchronously in `<head>`: module scripts are deferred, so this runs
// before the application boots and the router sees a settled URL.
//
// Deliberately dependency-free. It runs inside bundles it knows nothing about,
// including ones built long before it existed.
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute("data-site-root")) || "/";
  var sites = script && script.getAttribute("data-sites");
  var legacySite = script && script.getAttribute("data-legacy-site");
  var location = window.location;

  /** The directories a copy can live in. Mirrors the deploy's slugs. */
  var SLUG = /^(next|v\d+\.\d+|b\/[^/]+)\/(.*)$/;

  var parked = location.search.indexOf("?/") === 0;

  if (sites === null || sites === undefined) {
    // A copy. A query that begins with "/" is a path this script parked.
    // Anything the original URL carried beyond it follows, with "&" escaped
    // so the split below cannot cut a real query in half.
    if (!parked) return;
    var parts = location.search.slice(2).split("&");
    var path = parts.shift();
    var query = parts.join("&").replace(/~and~/g, "&");
    history.replaceState(
      null,
      "",
      location.pathname + path + (query ? "?" + query : "") + location.hash,
    );
    return;
  }

  // The root's 404 page. A parked path that still arrived here names a copy
  // that is not deployed; sending it on again would loop.
  if (parked || location.pathname.indexOf(root) !== 0) return;

  var rest = location.pathname.slice(root.length);
  var names = sites.split(/\s+/);
  var site = null;
  for (var i = 0; i < names.length; i++) {
    if (names[i] && rest.indexOf(names[i] + "/") === 0) {
      site = names[i];
      rest = rest.slice(site.length + 1);
      break;
    }
  }
  if (site === null) {
    // A site whose path is missing its trailing slash.
    for (var j = 0; j < names.length; j++) {
      if (names[j] && rest === names[j]) {
        location.replace(root + rest + "/" + location.search + location.hash);
        return;
      }
    }
    if (!legacySite) return;
    site = legacySite;
  }

  var copy = "";
  var owner = SLUG.exec(rest);
  if (owner) {
    copy = owner[1] + "/";
    rest = owner[2];
  }

  var carried = location.search
    ? "&" + location.search.slice(1).replace(/&/g, "~and~")
    : "";
  location.replace(
    root + site + "/" + copy + "?/" + rest + carried + location.hash,
  );
})();
