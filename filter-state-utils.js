(function () {
  "use strict";

  const ENABLED_PATTERN = /^(\s*[^=]+\s*=\s*)([01])(?=\s*(?:,|;|$))/;

  function getFilterEnabled(filterToken) {
    const match = String(filterToken || "").match(ENABLED_PATTERN);
    return match ? match[2] === "1" : null;
  }

  function setFilterEnabled(filterToken, enabled) {
    const token = String(filterToken || "");
    if (!ENABLED_PATTERN.test(token)) return token;
    return token.replace(ENABLED_PATTERN, (_match, prefix) => `${prefix}${enabled ? 1 : 0}`);
  }

  function toggleFilterEnabled(filterToken) {
    const enabled = getFilterEnabled(filterToken);
    return enabled === null ? String(filterToken || "") : setFilterEnabled(filterToken, !enabled);
  }

  window.FilterStateUtils = { getFilterEnabled, setFilterEnabled, toggleFilterEnabled };
})();
