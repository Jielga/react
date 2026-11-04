// The version switcher for documentation copies built before the header had
// one.
//
// The root of the site serves the newest release, and that release can
// predate this feature: without this script the page everyone links to would be
// the one page with no way to reach the other versions. The deploy injects a
// tag for this file into any build made from a ref whose header cannot switch
// versions on its own, and never into a build that can.
//
// Deliberately dependency-free and defensive. It runs inside bundles it knows
// nothing about, so it touches nothing but its own element and fails silent.
(function () {
  var script = document.currentScript;
  var root = (script && script.getAttribute("data-site-root")) || "/";
  var slug = (script && script.getAttribute("data-slug")) || "root";

  function href(entry, pathname) {
    var directory = entry.latest ? "" : entry.path + "/";
    return root + directory + pathname.replace(/^\//, "");
  }

  function appPath() {
    var path = window.location.pathname;
    var base = slug === "root" ? root : root + slug + "/";
    return path.indexOf(base) === 0 ? "/" + path.slice(base.length) : "/";
  }

  /**
   * The version badge these builds ship, beside the wordmark and linked to the
   * registry. It names what npm serves today, which on a frozen copy is some
   * other version than the one being read.
   *
   * Matched by its registry href rather than by a class, because the class
   * names in these bundles are hashed and not ours to depend on.
   */
  function staleBadge() {
    return document.querySelector(
      'header a[href^="https://www.npmjs.com/package/"]',
    );
  }

  /**
   * In the header, standing where that badge stood. Floating it over the corner
   * put it on top of the controls already there, and left the page carrying two
   * version indicators that disagreed.
   *
   * The badge is hidden rather than removed, and the control is appended rather
   * than swapped in: the header is React's, and it re-renders when its own
   * registry fetch lands. Hiding a node it keeps and adding one it never had
   * survives that; replacing one does not.
   */
  function mount(box) {
    var badge = staleBadge();
    if (badge && badge.parentNode) {
      badge.style.display = "none";
      box.style.cssText += ";display:inline-flex;align-items:center";
      badge.parentNode.appendChild(box);
      return;
    }
    // A header shaped some other way: the corner is all that is left.
    box.style.cssText +=
      ";position:fixed;top:10px;right:12px;z-index:2147483647";
    document.body.appendChild(box);
  }

  function render(entries) {
    var here = null;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var mine = slug === "root" ? entry.latest === true : entry.path === slug;
      if (mine) here = entry;
    }

    var box = document.createElement("div");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Documentation version");
    box.style.cssText = "font:500 12px/1.4 system-ui,sans-serif";

    var select = document.createElement("select");
    select.setAttribute("aria-label", "Documentation version");
    select.style.cssText =
      "padding:4px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.45);" +
      "background:Canvas;color:CanvasText;font:inherit;cursor:pointer";

    var path = appPath();
    for (var j = 0; j < entries.length; j++) {
      var option = document.createElement("option");
      option.value = href(entries[j], path);
      option.textContent = entries[j].label;
      if (entries[j] === here) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener("change", function () {
      window.location.href = select.value;
    });

    box.appendChild(select);
    mount(box);
  }

  function start() {
    fetch(root + "versions.json")
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (manifest) {
        var entries = manifest && manifest.entries;
        if (!entries || !entries.length) return;
        var listed = [];
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].kind !== "preview") listed.push(entries[i]);
        }
        if (listed.length > 1) render(listed);
      })
      .catch(function () {
        // Offline, or no manifest yet. One control fewer is the whole cost.
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
