function track(event, detail) {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: event,
        page: window.location.pathname,
        detail: detail || "",
      }),
    });
  } catch (e) {
    // ignore tracking errors, never break the page for the user
  }
}

// track every page load automatically
track("page_view");

// track when someone is about to leave
window.addEventListener("beforeunload", function () {
  navigator.sendBeacon &&
    navigator.sendBeacon(
      "/api/track",
      new Blob(
        [JSON.stringify({ event: "page_leave", page: window.location.pathname })],
        { type: "application/json" }
      )
    );
});
