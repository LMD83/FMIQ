/* ============================================================================
   VerifIQ — verifiq-atelier.js
   The issued set's shared behaviours: sheet chrome (favicon, title block,
   mobile sheet drawer, RECEIVED stamp), drafting gestures (revision clouds,
   count-ups, scroll reveal, stamp press), the hero live-review animation, the
   case-study register filter, and the request-the-brief dialog.

   No dependencies. Every behaviour is opt-in via markup and fails silently if
   its markup is absent. Respects prefers-reduced-motion throughout.

   Loaded by every marketing page with: <script src="verifiq-atelier.js" defer>
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── The drawing index — sheet codes for the set ─────────────────────────── */
  var SHEETS = [
    { href: "index.html", code: "A-001", title: "Index of sheets" },
    { href: "first-read.html", code: "F-001", title: "First Read · €29" },
    { href: "three-products.html", code: "A-002", title: "Three products" },
    { href: "about.html", code: "A-003", title: "The reviewer" },
    { href: "hunt.html", code: "H-001", title: "Hunt · variation exposure" },
    { href: "case-study-01.html", code: "CS-01", title: "Findings register" },
    { href: "cad-library.html", code: "DS-01", title: "Component library" },
    { href: "legal.html", code: "L-001", title: "Legal notice" },
  ];

  /* ── Favicon — a brass V on bone, drawn inline ───────────────────────────── */
  function favicon() {
    if (document.querySelector("link[rel='icon']")) return;
    var svg =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' fill='%23F5F1EB'/>" +
      "<rect x='3' y='3' width='58' height='58' fill='none' stroke='%231A1A1F' stroke-width='2'/>" +
      "<text x='32' y='45' text-anchor='middle' font-family='Georgia,serif' font-size='38' fill='%23A07C35'>V</text></svg>";
    var link = document.createElement("link");
    link.rel = "icon";
    link.href = "data:image/svg+xml," + svg;
    document.head.appendChild(link);
  }

  /* ── Mobile sheet drawer — the drawing index, below 860px ────────────────── */
  function sheetDrawer() {
    var nav = document.querySelector(".top-nav");
    var inner = nav && nav.querySelector(".inner");
    if (!nav || !inner || nav.querySelector(".nav-toggle")) return;

    var toggle = document.createElement("button");
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open the sheet index");
    toggle.textContent = "Index";

    var drawer = document.createElement("div");
    drawer.className = "sheet-drawer";
    var head = document.createElement("div");
    head.className = "sd-head";
    head.textContent = "— Sheet index · this issue";
    drawer.appendChild(head);
    SHEETS.forEach(function (s) {
      var a = document.createElement("a");
      a.href = s.href;
      var code = document.createElement("span");
      code.className = "sd-code";
      code.textContent = s.code;
      a.appendChild(code);
      a.appendChild(document.createTextNode(s.title));
      drawer.appendChild(a);
    });

    // The toggle sits where the desktop links are hidden; drawer under the bar.
    var cta = inner.querySelector(".site-cta, a[href^='mailto']");
    inner.insertBefore(toggle, cta);
    nav.appendChild(drawer);

    toggle.addEventListener("click", function () {
      var open = drawer.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Index";
    });
  }

  /* ── Title block — injected before the footer, from body data attributes ── */
  function titleBlock() {
    var body = document.body;
    var sheet = body.getAttribute("data-sheet");
    if (!sheet) return;
    var footer = document.querySelector("footer, .site-footer");
    if (!footer) return;

    var wrap = document.createElement("div");
    wrap.className = "title-block";
    var rows = [
      ["Rev", body.getAttribute("data-rev") || "P2"],
      ["Date", body.getAttribute("data-date") || "2026-06"],
      ["Drawn", "Council"],
      ["Checked", "LD"],
      ["Scale", "NTS"],
      ["Status", "Issued for information"],
    ];
    var tb = document.createElement("div");
    tb.className = "tb";
    var proj = document.createElement("div");
    proj.className = "tb-proj";
    proj.innerHTML =
      "<span>VerifIQ — the atelier</span><span class='tb-sheetno'></span>";
    proj.querySelector(".tb-sheetno").textContent = sheet;
    tb.appendChild(proj);
    var title = body.getAttribute("data-sheet-title");
    if (title) rows.unshift(["Title", title]);
    rows.forEach(function (r) {
      var k = document.createElement("div");
      k.textContent = r[0];
      var v = document.createElement("div");
      v.textContent = r[1];
      tb.appendChild(k);
      tb.appendChild(v);
    });
    wrap.appendChild(tb);
    footer.parentNode.insertBefore(wrap, footer);
  }

  /* ── RECEIVED stamp in the footer ────────────────────────────────────────── */
  function receivedStamp() {
    var footer = document.querySelector("footer, .site-footer");
    if (!footer || footer.querySelector(".received-stamp")) return;
    var s = document.createElement("div");
    s.className = "received-stamp";
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = "Received<br>Dublin · MMXXVI";
    footer.appendChild(s);
  }

  /* ── Stamp press on the primary CTAs ─────────────────────────────────────── */
  function stampables() {
    document
      .querySelectorAll(".btn-sheet-tag, .site-cta, .bd-send")
      .forEach(function (el) {
        el.classList.add("stampable");
      });
  }

  /* ── Count-up numbers (.count-up[data-target][data-suffix]) ──────────────── */
  function countUps() {
    var els = document.querySelectorAll(".count-up");
    if (!els.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) return; // markup already shows the final value
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var el = entry.target;
          var target = parseFloat(el.getAttribute("data-target") || el.textContent);
          if (isNaN(target)) return;
          var suffix = el.getAttribute("data-suffix") || "";
          var t0 = null;
          var DUR = 900;
          function tick(t) {
            if (!t0) t0 = t;
            var p = Math.min((t - t0) / DUR, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ── Scroll reveal — armed only by JS so content never hides without it ──── */
  function reveals() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length || REDUCED || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach(function (el) {
      el.classList.add("reveal-armed");
      io.observe(el);
    });
  }

  /* ── Revision cloud — a checker's cloud drawn round .rev-cloud elements ──── */
  function revisionClouds() {
    document.querySelectorAll(".rev-cloud").forEach(function (el) {
      var draw = function () {
        var old = el.querySelector("svg.cloud");
        if (old) old.remove();
        var w = el.offsetWidth;
        var h = el.offsetHeight;
        if (!w || !h) return;
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "cloud");
        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("aria-hidden", "true");
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // Walk the perimeter in ~26px scallops, each bulging outward ~7px,
        // with a small deterministic wobble so it reads hand-drawn.
        var step = 26, bulge = 7, inset = 2;
        var pts = [];
        var x, y;
        for (x = inset; x < w - inset; x += step) pts.push([x, inset, 0, -1]);
        for (y = inset; y < h - inset; y += step) pts.push([w - inset, y, 1, 0]);
        for (x = w - inset; x > inset; x -= step) pts.push([x, h - inset, 0, 1]);
        for (y = h - inset; y > inset; y -= step) pts.push([inset, y, -1, 0]);
        var wob = function (i) { return Math.sin(i * 12.9898) * 1.8; };
        var d = "M " + pts[0][0] + " " + pts[0][1];
        for (var i = 1; i <= pts.length; i++) {
          var p = pts[i % pts.length];
          var prev = pts[i - 1];
          var mx = (prev[0] + p[0]) / 2 + (prev[2] + p[2]) * 0.5 * (bulge + wob(i));
          var my = (prev[1] + p[1]) / 2 + (prev[3] + p[3]) * 0.5 * (bulge + wob(i));
          d += " Q " + mx.toFixed(1) + " " + my.toFixed(1) + " " + p[0].toFixed(1) + " " + p[1].toFixed(1);
        }
        path.setAttribute("d", d);
        svg.appendChild(path);
        el.appendChild(svg);

        // Draw the cloud in when it first scrolls into view.
        if (!REDUCED && "IntersectionObserver" in window) {
          var len = path.getTotalLength();
          path.style.strokeDasharray = String(len);
          path.style.strokeDashoffset = String(len);
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
              if (!e.isIntersecting) return;
              io.disconnect();
              path.style.transition = "stroke-dashoffset 1.1s ease";
              requestAnimationFrame(function () {
                path.style.strokeDashoffset = "0";
              });
            });
          }, { threshold: 0.6 });
          io.observe(el);
        }
      };
      draw();
      var t;
      window.addEventListener("resize", function () {
        clearTimeout(t);
        t = setTimeout(draw, 180);
      });
    });
  }

  /* ── Hero live review — the review happens in front of the visitor ───────── */
  function heroReview() {
    var frag = document.getElementById("hero-review");
    if (!frag) return;
    var blank = frag.querySelector(".df-blank");
    var scan = frag.querySelector(".df-scan");
    var tag = frag.querySelector(".df-tag");
    var finding = frag.querySelector(".df-finding");
    var svg = frag.querySelector("svg.df-leader");
    var replay = frag.querySelector(".df-replay");
    if (!blank || !tag || !finding) return;

    var LINE =
      "C-03 · CRITICAL — Date for Substantial Completion left blank. " +
      "Liquidated damages per PW-CF5 Clause 9.5 unenforceable as drawn.";

    function finalState() {
      frag.classList.add("df-found");
      tag.classList.add("stamped");
      finding.textContent = LINE;
      drawLeader(false);
    }

    function drawLeader(animate) {
      if (!svg) return;
      svg.innerHTML = "";
      var fr = frag.getBoundingClientRect();
      var br = blank.getBoundingClientRect();
      var tr = tag.getBoundingClientRect();
      // from the middle of the blank, elbow out, to the tag's left edge
      var x1 = br.left - fr.left + br.width / 2;
      var y1 = br.bottom - fr.top + 2;
      var x2 = tr.left - fr.left - 8;
      var y2 = tr.top - fr.top + tr.height / 2;
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        "M " + x1 + " " + y1 + " L " + x1 + " " + (y1 + 14) + " L " + x2 + " " + y2
      );
      var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", x1);
      dot.setAttribute("cy", y1);
      dot.setAttribute("r", "2.4");
      svg.appendChild(dot);
      svg.appendChild(path);
      if (animate) {
        var len = path.getTotalLength();
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        path.style.transition = "stroke-dashoffset 0.5s ease";
        requestAnimationFrame(function () {
          path.style.strokeDashoffset = "0";
        });
      }
    }

    function typeLine(done) {
      finding.textContent = "";
      var text = document.createTextNode("");
      var cursor = document.createElement("span");
      cursor.className = "df-cursor";
      finding.appendChild(text);
      finding.appendChild(cursor);
      var i = 0;
      (function step() {
        if (i <= LINE.length) {
          text.textContent = LINE.slice(0, i);
          i += 2;
          setTimeout(step, 18);
        } else {
          cursor.remove();
          finding.textContent = LINE;
          if (done) done();
        }
      })();
    }

    function play() {
      frag.classList.remove("df-found");
      tag.classList.remove("stamped");
      finding.textContent = "";
      if (svg) svg.innerHTML = "";
      if (REDUCED) return finalState();

      // 1 · the scan bar sweeps the fragment
      var body = frag.querySelector(".df-body");
      var sweep = body ? body.offsetHeight - 30 : 60;
      frag.classList.add("df-scanning");
      if (scan) {
        scan.style.transition = "none";
        scan.style.top = "0px";
        requestAnimationFrame(function () {
          scan.style.transition = "top 1.5s linear";
          scan.style.top = sweep + "px";
        });
      }
      // 2 · the blank is found
      setTimeout(function () {
        frag.classList.remove("df-scanning");
        frag.classList.add("df-found");
      }, 1550);
      // 3 · leader line draws out to the tag, which stamps in
      setTimeout(function () {
        tag.classList.add("stamped");
        drawLeader(true);
      }, 1950);
      // 4 · the register line types itself
      setTimeout(function () {
        typeLine();
      }, 2500);
    }

    if (replay)
      replay.addEventListener("click", function () {
        play();
      });

    if (!("IntersectionObserver" in window)) return finalState();
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          io.disconnect();
          setTimeout(play, 350);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(frag);

    window.addEventListener("resize", function () {
      if (tag.classList.contains("stamped")) drawLeader(false);
    });
  }

  /* ── Findings register filter (case study) ───────────────────────────────── */
  function registerFilter() {
    var controls = document.getElementById("reg-controls");
    if (!controls) return;
    var findings = Array.prototype.slice.call(document.querySelectorAll(".finding[data-severity]"));
    var sections = Array.prototype.slice.call(document.querySelectorAll("[data-reg-section]"));
    var countEl = controls.querySelector("[data-reg-count]");

    function apply(filter) {
      var shown = 0;
      findings.forEach(function (f) {
        var hit = filter === "all" || f.getAttribute("data-severity") === filter;
        f.classList.toggle("reg-hidden", !hit);
        if (hit) shown++;
      });
      sections.forEach(function (s) {
        var any = s.querySelector(".finding[data-severity]:not(.reg-hidden)");
        s.style.display = any ? "" : "none";
      });
      if (countEl) countEl.textContent = shown + " of " + findings.length + " shown";
      controls.querySelectorAll("button.sev").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-filter") === filter);
        b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === filter));
      });
    }

    controls.addEventListener("click", function (e) {
      var btn = e.target.closest("button.sev");
      if (btn) apply(btn.getAttribute("data-filter"));
    });
    apply("all");
  }

  /* ── Request-the-brief dialog ────────────────────────────────────────────────
     Intercepts every "request the brief" mailto. Posts to a configured
     endpoint (window.VERIFIQ_BRIEF_ENDPOINT) when one exists; otherwise it
     composes the same mail, with the form's text in the body. */
  function briefDialog() {
    var links = Array.prototype.slice.call(
      document.querySelectorAll("a[href^='mailto:liam@goviq.ie']")
    ).filter(function (a) {
      return /brief/i.test(a.getAttribute("href"));
    });
    if (!links.length || typeof HTMLDialogElement === "undefined") return;

    var dlg = document.createElement("dialog");
    dlg.className = "brief-dialog";
    dlg.innerHTML =
      '<div class="bd-head"><span class="t-eyebrow">— Request the brief</span>' +
      '<button class="bd-close" aria-label="Close">✕ Close</button></div>' +
      "<form method='dialog'>" +
      '<label>Name<input name="name" required autocomplete="name"></label>' +
      '<label>Practice / organisation<input name="org" autocomplete="organization"></label>' +
      '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
      '<label>What should we read?<textarea name="pack" placeholder="e.g. Stage 2C tender pack, ~90 documents, five disciplines, releasing in three weeks."></textarea></label>' +
      '<button class="bd-send" type="submit">Stamp &amp; send →</button>' +
      '<span class="bd-note">Goes to liam@goviq.ie · no list, no tracking</span>' +
      "</form>";
    document.body.appendChild(dlg);

    var mailHref = links[0].getAttribute("href");
    dlg.querySelector(".bd-close").addEventListener("click", function () {
      dlg.close();
    });
    dlg.querySelector("form").addEventListener("submit", function (e) {
      var f = e.target;
      var data = {
        name: f.name.value,
        org: f.org.value,
        email: f.email.value,
        pack: f.pack.value,
        page: location.pathname,
      };
      var endpoint = window.VERIFIQ_BRIEF_ENDPOINT;
      if (endpoint) {
        e.preventDefault();
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
          .then(function () {
            dlg.close();
          })
          .catch(function () {
            location.href = composeMail(data);
          });
      } else {
        location.href = composeMail(data);
      }
    });

    function composeMail(d) {
      var subject = decodeURIComponent((mailHref.split("subject=")[1] || "VerifIQ — request the brief"));
      var body =
        "Name: " + d.name + "\nPractice: " + d.org + "\nEmail: " + d.email + "\n\nWhat to read:\n" + d.pack;
      return (
        "mailto:liam@goviq.ie?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body)
      );
    }

    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        dlg.showModal();
      });
    });
  }

  /* ── boot ────────────────────────────────────────────────────────────────── */
  function boot() {
    favicon();
    sheetDrawer();
    titleBlock();
    receivedStamp();
    stampables();
    countUps();
    reveals();
    revisionClouds();
    heroReview();
    registerFilter();
    briefDialog();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
