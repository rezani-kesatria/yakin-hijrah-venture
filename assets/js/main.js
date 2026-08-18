/* =========================================================================
   YAKIN HIJRAH VENTURES — interaction layer
   Progressive enhancement only: every page reads and works without this.
   ========================================================================= */

(function () {
  "use strict";

  /* ---- Mobile navigation ------------------------------------------------ */

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
      document.body.style.overflow = !open ? "hidden" : "";
    });

    // Close when a destination is chosen, or on Escape.
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        closeNav();
        toggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1020 && nav.classList.contains("is-open")) closeNav();
    });
  }

  function closeNav() {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  /* ---- Header hairline appears once the page has moved ------------------ */

  var header = document.querySelector(".header");

  if (header) {
    var ticking = false;
    var setStuck = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(setStuck);
          ticking = true;
        }
      },
      { passive: true }
    );
    setStuck();
  }

  /* ---- Motion ------------------------------------------------------------ */
  /* Three tiers, in order of preference:
       1. GSAP + ScrollTrigger — choreographed entrance, batched reveals,
          scroll-linked motion the CSS layer cannot express.
       2. IntersectionObserver + CSS transitions — the original fallback.
       3. Reduced motion, or no JS at all — everything simply visible.
     A timed failsafe in each page's <head> covers this file never loading. */

  var revealables = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]")
  );

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hasGsap =
    typeof window.gsap !== "undefined" &&
    typeof window.ScrollTrigger !== "undefined";

  function revealAll() {
    revealables.forEach(function (el) { el.classList.add("is-visible"); });
  }

  if (!revealables.length) {
    /* nothing to animate */
  } else if (reduceMotion) {
    revealAll();
  } else if (hasGsap) {
    initGsapMotion();
  } else {
    initObserverReveals();
  }

  /* ---- Tier 1: GSAP ------------------------------------------------------ */

  function initGsapMotion() {
    // The inline failsafe would flip everything visible at 2.6s and destroy
    // the scroll reveals. GSAP owns visibility from here.
    window.clearTimeout(window.__yhvRevealFailsafe);

    document.documentElement.classList.add("gsap");
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: "power3.out" });

    var hero = document.querySelector(".hero");

    /* Hero entrance. The blocks grow up from the shared baseline, which is
       what makes the staggered skyline read as deliberate. */
    if (hero) {
      gsap.set(hero.querySelectorAll("[data-reveal]"), { opacity: 1 });

      var heroTl = gsap.timeline({ delay: 0.15 })
        .from(".hero__title .t-lead, .hero__title .t-pay", {
          y: 38, opacity: 0, duration: 1, stagger: 0.1
        })
        .from(".hero__sub", { y: 22, opacity: 0, duration: 0.85 }, "-=0.62")
        .from(".hero__actions", { y: 16, opacity: 0, duration: 0.7 }, "-=0.55")
        .from(".cast__block", {
          scaleY: 0,
          transformOrigin: "bottom center",
          duration: 1.1,
          stagger: 0.075
        }, "-=0.4")
        // One group photograph now, brought in after the blocks have finished
        // rising rather than alongside them — no offset, so it starts when the
        // last pillar lands. Scales from its base so nobody's feet dip below
        // the shared baseline mid-animation.
        .from(".cast__group", {
          opacity: 0,
          scale: 0.965,
          y: 14,
          transformOrigin: "bottom center",
          duration: 0.85
        });

      /* Safety net. The inline failsafe stands down once GSAP is in charge, so
         if the ticker is ever starved — a background tab that never gets
         focused, rAF throttled — the hero would sit invisible. Jump the
         timeline to its end rather than leave a blank page. */
      window.setTimeout(function () {
        if (heroTl.progress() < 1) heroTl.progress(1);
      }, 6000);
    }

    /* Word-by-word masked reveal for anything marked [data-words]. Each word is
       wrapped so it can rise out of a hidden overflow — the effect SplitText
       would give, done by hand since only the core plugin is loaded. */
    gsap.utils.toArray("[data-words]").forEach(function (el) {
      var words = splitIntoWords(el);
      if (!words.length) return;

      // CSS keeps the block hidden until now; show the block and animate the
      // words, so there is no flash of un-split text.
      gsap.set(el, { opacity: 1 });
      gsap.set(words, { yPercent: 118 });

      gsap.to(words, {
        yPercent: 0,
        duration: 0.95,
        stagger: 0.035,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      });
    });

    /* Everything below the hero reveals on scroll, batched so neighbours
       cascade together instead of firing one trigger each. Elements handled by
       the word reveal above are excluded, or they would animate twice. */
    var rest = revealables.filter(function (el) {
      if (hero && hero.contains(el)) return false;
      return !el.hasAttribute("data-words");
    });

    if (rest.length) {
      gsap.set(rest, { opacity: 0, y: 32 });

      ScrollTrigger.batch(rest, {
        start: "top 88%",
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09 });
        }
      });
    }

    /* Scroll-linked: each chapter image drifts vertically inside its frame.
       The image is inset -6%, so this never exposes an edge. */
    gsap.utils.toArray(".chapter__media img").forEach(function (img) {
      gsap.fromTo(img,
        { yPercent: -3.5 },
        {
          yPercent: 3.5,
          ease: "none",
          scrollTrigger: {
            trigger: img.closest(".chapter__media"),
            start: "top bottom",
            end: "bottom top",
            scrub: 0.5
          }
        }
      );
    });

    /* Trainer deck: scrolls sideways as the page scrolls down. CSS sticky does
       the pinning; this only drives the horizontal translate and sets the
       section height that gives the pin something to travel through. */
    gsap.utils.toArray(".trainers").forEach(function (section) {
      var track = section.querySelector(".trainers__track");
      if (!track) return;

      var distance = 0;

      /* Must match the max-width: 760px rule in the stylesheet, which refuses
         to pin on a phone (a 100vh frame eats the whole screen there). If the
         two disagree, JS inflates the section height for a pin that CSS never
         applies, and the section gains a screenful of dead space. */
      var tooNarrowToPin = window.matchMedia("(max-width: 760px)");

      function measure() {
        // Release the native scroller first, or scrollWidth is clamped to the
        // visible width and the travel comes out as zero.
        section.classList.add("is-scrolling");

        // Guard against a degenerate viewport. Some embedded/preview contexts
        // report innerWidth 0 before layout settles, which previously produced
        // a nonsense travel and a 40px-tall section.
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        if (vw < 320 || vh < 240 || tooNarrowToPin.matches) {
          distance = 0;
        } else {
          distance = Math.max(0, track.scrollWidth - vw);
          // Too little overhang to be worth hijacking the scroll for.
          if (distance < 80) distance = 0;
        }

        if (!distance) {
          // Fall back to the plain native scroller.
          section.classList.remove("is-scrolling");
          section.style.height = "";
          return 0;
        }

        // Section height = one screen (the sticky frame) plus the travel.
        section.style.height = vh + distance + "px";
        return distance;
      }

      measure();

      /* Never bail out permanently. An early measurement can land before layout
         settles — or with a zero-width viewport in embedded contexts — and a
         hard `return` here left the deck dead for the life of the page: no
         listeners, no tween, no way to recover once the real size was known.
         The tween is always created; its values read the live measurement, so
         when there is no travel it simply resolves to zero and does nothing. */
      gsap.to(track, {
        x: function () { return -distance; },
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          // A zero-length range is invalid, so floor it.
          end: function () { return "+=" + (distance || 1); },
          scrub: 0.6,
          invalidateOnRefresh: true
        }
      });

      // Card widths are viewport-relative, so the travel changes on resize.
      ScrollTrigger.addEventListener("refreshInit", measure);

      // Fonts and late layout can shift the track after first paint.
      window.addEventListener("load", function () {
        measure();
        ScrollTrigger.refresh();
      });
    });

    /* Institution strip: a continuous marquee rather than a scroll-linked
       drift. Four identical sets, translated by exactly -25% — one whole set —
       so the repeat is seamless. Duration is derived from the track width so
       the speed stays constant as the type scale changes with the viewport. */
    gsap.utils.toArray(".marks__track").forEach(function (track) {
      var PX_PER_SEC = 55;
      var cycleDuration = function () {
        // A cycle covers one quarter of the track.
        return track.scrollWidth / 4 / PX_PER_SEC;
      };

      var loop = gsap.to(track, {
        xPercent: -25,
        ease: "none",
        repeat: -1,
        duration: cycleDuration()
      });

      // The track width changes with the fluid type scale, so re-time on resize
      // or the marquee speeds up and slows down between breakpoints.
      var resizeTimer;
      window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
          loop.duration(cycleDuration());
        }, 200);
      });
    });

    /* Scroll-linked: each pillar chapter's rule fills as you move through it,
       giving the list a sense of position. */
    gsap.utils.toArray(".chapter").forEach(function (chapter) {
      var bar = chapter.querySelector(".chapter__bar");
      if (!bar) return;

      gsap.to(bar, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: chapter,
          start: "top 65%",
          end: "bottom 85%",
          scrub: 0.4
        }
      });
    });

    /* The ring motif used to rotate on scroll. Now that its accent arcs are
       gone it is perfectly radially symmetric, so rotating it produced no
       visible change — the tween and its ScrollTrigger were pure cost. Removed.
       Reinstate it only if asymmetry is added back to the artwork. */

    // Triggers are measured before webfonts settle, which shifts layout.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  /* Wraps every word in <span class="word"><span class="word__inner">…</span></span>.
     Real spaces are kept as text nodes between wrappers so the line still wraps
     naturally and the text stays selectable and readable to screen readers. */
  function splitIntoWords(el) {
    var words = el.textContent.replace(/\s+/g, " ").trim().split(" ");
    if (!words[0]) return [];

    var frag = document.createDocumentFragment();

    words.forEach(function (word, i) {
      var outer = document.createElement("span");
      outer.className = "word";
      var inner = document.createElement("span");
      inner.className = "word__inner";
      inner.textContent = word;
      outer.appendChild(inner);
      frag.appendChild(outer);
      if (i < words.length - 1) frag.appendChild(document.createTextNode(" "));
    });

    el.textContent = "";
    el.appendChild(frag);
    return el.querySelectorAll(".word__inner");
  }

  /* ---- Tier 2: IntersectionObserver ------------------------------------- */

  function initObserverReveals() {
    if (!("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealables.forEach(function (el, i) {
      // Stagger siblings so groups cascade rather than snapping in together.
      var group = el.closest("[data-reveal-group]");
      if (group) {
        var peers = Array.prototype.slice.call(
          group.querySelectorAll("[data-reveal]")
        );
        el.style.setProperty("--delay", peers.indexOf(el) * 70 + "ms");
      } else if (el.dataset.reveal === "stagger") {
        el.style.setProperty("--delay", i * 70 + "ms");
      }
      observer.observe(el);
    });
  }

  /* ---- Enquiry form ------------------------------------------------------ */
  /* Mockup only — no endpoint is wired up yet. Confirms to the visitor
     instead of silently doing nothing. */

  var form = document.querySelector("[data-mock-form]");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var status = form.querySelector(".form__status");
      var name = (form.querySelector("#name") || {}).value || "";
      var firstName = name.trim().split(/\s+/)[0];

      if (status) {
        status.hidden = false;
        status.textContent = firstName
          ? "Thank you, " + firstName + ". This is a demonstration form — no message has been sent. Connecting it to a live inbox is a one-line change."
          : "Thank you. This is a demonstration form — no message has been sent.";
        status.setAttribute("role", "status");
        status.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      form.reset();
    });
  }

  /* ---- Footer year ------------------------------------------------------- */

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
