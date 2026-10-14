// Shows the listing's approximate location. If the map library or token is unavailable the map area is simply hidden,
// so the page never throws a console error.
(function () {
  var container = document.getElementById("map");
  if (!container) return;
  var section = container.closest("section") || container;
  var coords = listing && listing.geometry && listing.geometry.coordinates;
  var noWebGL = typeof mapboxgl !== "undefined" && typeof mapboxgl.supported === "function" && !mapboxgl.supported();
  if (typeof mapboxgl === "undefined" || !mapToken || !coords || noWebGL) {
    section.hidden = true;
    return;
  }
  try {
    mapboxgl.accessToken = mapToken;
    var map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: coords,
      zoom: 10,
    });
    var note = listing.isDemo
      ? "Approximate location of a sample listing"
      : "Exact location will be provided after booking";
    var popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(
      (function () {
        var wrap = document.createElement("div");
        var h = document.createElement("h4");
        h.textContent = listing.title;
        var p = document.createElement("p");
        p.textContent = note;
        wrap.appendChild(h);
        wrap.appendChild(p);
        return wrap;
      })()
    );
    new mapboxgl.Marker({ color: "#1d3557" }).setLngLat(coords).setPopup(popup).addTo(map);
  } catch (e) {
    section.hidden = true;
  }
})();
