/* TrailKit — Shopify Theme App Extension map block */
(function () {
  'use strict';

  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  function loadLeaflet(cb) {
    if (window.L) { cb(); return; }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    var s = document.createElement('script');
    s.src = LEAFLET_JS;
    s.onload = cb;
    document.head.appendChild(s);
  }

  function initBlock(el) {
    var guideId   = el.getAttribute('data-guide-id');
    var proxyBase = el.getAttribute('data-proxy-base') || '/apps/trailkit';

    if (!guideId) {
      el.innerHTML = placeholder('Set a Guide ID in the block settings to show a trail map.');
      return;
    }

    el.innerHTML = placeholder('Loading map…');

    fetch(proxyBase + '/guide/' + encodeURIComponent(guideId))
      .then(function (r) { return r.json(); })
      .then(function (guide) {
        if (!guide || guide.error) throw new Error('not found');
        renderMap(el, guide);
      })
      .catch(function () {
        el.innerHTML = placeholder('Trail guide not found. Check the Guide ID in block settings.');
      });
  }

  function renderMap(container, guide) {
    container.innerHTML = '';

    var lat  = parseFloat(guide.center_lat)   || 10;
    var lng  = parseFloat(guide.center_lng)   || -66;
    var zoom = parseInt(guide.zoom_level, 10) || 12;

    var map = L.map(container, {
      center: [lat, lng],
      zoom: zoom,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on('focus', function () { map.scrollWheelZoom.enable(); });
    map.on('blur',  function () { map.scrollWheelZoom.disable(); });

    var allBounds = [];

    (guide.routes || []).forEach(function (route) {
      var coords = route.route_coords;
      if (!Array.isArray(coords) || !coords.length) return;
      L.polyline(coords, {
        color:   route.color || '#ef4444',
        weight:  3.5,
        opacity: 0.9,
      }).addTo(map).bindPopup('<strong>' + esc(route.name) + '</strong>');
      allBounds = allBounds.concat(coords);
    });

    (guide.pois || []).forEach(function (poi) {
      var plat = parseFloat(poi.lat), plng = parseFloat(poi.lng);
      if (isNaN(plat) || isNaN(plng)) return;
      var icon = L.divIcon({
        className: 'tk-map-pin',
        html: '<span></span>',
        iconSize:   [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([plat, plng], { icon: icon }).addTo(map).bindPopup(
        '<strong>' + esc(poi.name) + '</strong>' +
        (poi.description ? '<br>' + esc(poi.description) : '')
      );
      allBounds.push([plat, plng]);
    });

    if (allBounds.length) {
      try { map.fitBounds(L.latLngBounds(allBounds), { padding: [32, 32] }); } catch (_) {}
    }
  }

  function placeholder(msg) {
    return '<div style="height:100%;display:flex;align-items:center;justify-content:center;' +
           'color:#888;font-family:sans-serif;font-size:14px;padding:24px;text-align:center;">' +
           msg + '</div>';
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initAll() {
    document.querySelectorAll('[data-tk-map]').forEach(function (el) {
      initBlock(el);
    });
  }

  function boot() {
    if (!document.querySelectorAll('[data-tk-map]').length) return;
    loadLeaflet(initAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
