/* Applies the reader's stored theme before the first paint.

   Loaded synchronously in <head> (not deferred), or the page would flash in the
   system theme before switching. Sets data-theme="light"|"dark" on <html>;
   absent means "follow the system" (prefers-color-scheme). The button that
   changes it lives in app.js. Mirrors the sibling `cronicon` site. */
(function () {
  "use strict";
  try {
    var theme = localStorage.getItem("llinatges-theme");
    if (theme === "light" || theme === "dark")
      document.documentElement.setAttribute("data-theme", theme);
  } catch (e) { /* storage blocked: follow the system */ }
})();
