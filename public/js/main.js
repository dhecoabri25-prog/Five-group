(function () {
  "use strict";

  /* ---------------- Configuration ---------------- */
  // Ganti dengan nomor WhatsApp bisnis (format: kode negara tanpa "+" atau "0" di depan)
  var WHATSAPP_NUMBER = "628217690485";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function formatRupiah(n) {
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  /* ---------------- Footer year ---------------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Floating WhatsApp button ---------------- */
  var waFloat = document.getElementById("waFloat");
  if (waFloat) {
    var genericMsg = encodeURIComponent("Halo Five Group, saya ingin bertanya tentang produk.");
    waFloat.href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + genericMsg;
  }

  /* ---------------- Mobile nav toggle ---------------- */
  var navToggle = document.getElementById("navToggle");
  var mainNav = document.getElementById("mainNav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mainNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mainNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------- Scroll progress rail ---------------- */
  var progressFill = document.getElementById("progressFill");
  function updateProgress() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressFill) progressFill.style.width = pct + "%";
  }
  document.addEventListener("scroll", updateProgress, { passive: true });
  updateProgress();

  /* ---------------- Active nav link on scroll ---------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
  var navTargets = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      var el = document.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && navTargets.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var match = navTargets.find(function (t) { return t.el === entry.target; });
          if (!match) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) { l.classList.remove("active"); });
            match.link.classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    navTargets.forEach(function (t) { navObserver.observe(t.el); });
  }

  /* ---------------- Scroll reveal (restrained, per section group) ---------------- */
  var revealSelectors = [
    ".section-head",
    ".col-content",
    ".value-item",
    ".future-row",
    ".timeline-item"
  ];
  function applyReveal(el) { el.classList.add("reveal"); }
  document.querySelectorAll(revealSelectors.join(",")).forEach(applyReveal);

  var revealObserver = null;
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------------- Animated counters ---------------- */
  var counters = document.querySelectorAll(".stat-number[data-count]");
  function animateCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduceMotion) {
      el.textContent = target;
      return;
    }
    var duration = 1100;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var counterObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(animateCounter);
  }

  /* ---------------- Timeline scroll-linked draw ---------------- */
  var timeline = document.getElementById("timeline");
  var timelineDraw = document.getElementById("timelineDraw");
  if (timeline && timelineDraw && !reduceMotion) {
    var TOTAL_LENGTH = 800;
    timelineDraw.style.strokeDasharray = TOTAL_LENGTH;

    function updateTimelineDraw() {
      var rect = timeline.getBoundingClientRect();
      var vh = window.innerHeight;
      var start = vh * 0.85;
      var end = -rect.height * 0.3;
      var raw = (start - rect.top) / (start - end);
      var pct = Math.max(0, Math.min(1, raw));
      timelineDraw.style.strokeDashoffset = TOTAL_LENGTH * (1 - pct);
    }
    document.addEventListener("scroll", updateTimelineDraw, { passive: true });
    window.addEventListener("resize", updateTimelineDraw);
    updateTimelineDraw();
  } else if (timelineDraw) {
    timelineDraw.style.strokeDasharray = 800;
    timelineDraw.style.strokeDashoffset = 0;
  }

  /* ---------------- Product catalog (from database) ---------------- */
  var productGrid = document.getElementById("productGrid");
  var productLoading = document.getElementById("productLoading");
  var currentProducts = [];

  function renderProducts(products) {
    if (!productGrid) return;
    if (!products.length) {
      productGrid.innerHTML = '<p class="product-loading">Belum ada produk yang tersedia saat ini.</p>';
      return;
    }
    productGrid.innerHTML = products
      .map(function (p) {
        var imageBlock = p.image_url
          ? '<div class="product-image"><img src="' + escapeHtml(p.image_url) + '" alt="' + escapeHtml(p.name) + '" loading="lazy"></div>'
          : '<div class="product-image product-image-placeholder" aria-hidden="true"><span>' + escapeHtml((p.name || "?").charAt(0)) + "</span></div>";
        return (
          '<article class="product-card reveal">' +
          imageBlock +
          '<div class="product-card-body">' +
          '<span class="product-category">' + escapeHtml(p.category || "Produk") + "</span>" +
          "<h3>" + escapeHtml(p.name) + "</h3>" +
          "<p>" + escapeHtml(p.description || "") + "</p>" +
          '<span class="product-price">' + formatRupiah(p.price) + "</span>" +
          '<div class="product-actions">' +
          '<button type="button" class="btn btn-primary" data-order-id="' + p.id + '">Pesan sekarang</button>' +
          '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + waProductLink(p) + '">Chat WhatsApp</a>' +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    if (revealObserver) {
      productGrid.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });
    } else {
      productGrid.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    }

    productGrid.querySelectorAll("[data-order-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = parseInt(btn.getAttribute("data-order-id"), 10);
        var product = currentProducts.find(function (p) { return p.id === id; });
        if (product) openOrderModal(product);
      });
    });
  }

  function waProductLink(p) {
    var msg = encodeURIComponent(
      "Halo Five Group, saya ingin memesan " + p.name + " (" + formatRupiah(p.price) + ")."
    );
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + msg;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  if (productGrid) {
    fetch("/api/products")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        currentProducts = data.products || [];
        renderProducts(currentProducts);
      })
      .catch(function () {
        if (productLoading) {
          productLoading.textContent = "Tidak dapat memuat produk. Coba muat ulang halaman.";
        }
      });
  }

  /* ---------------- Team / coordinator profiles (from database) ---------------- */
  var teamGrid = document.getElementById("teamGrid");
  var teamLoading = document.getElementById("teamLoading");

  function initials(name) {
    return (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); })
      .join("");
  }

  function renderTeam(team) {
    if (!teamGrid) return;
    if (!team.length) {
      teamGrid.innerHTML = '<p class="team-loading">Profil koordinator akan segera ditambahkan.</p>';
      return;
    }
    teamGrid.innerHTML = team
      .map(function (m) {
        var photoHtml = m.photo
          ? '<img class="team-photo" src="' + m.photo + '" alt="Foto ' + escapeHtml(m.name) + '">'
          : '<div class="team-photo-fallback">' + escapeHtml(initials(m.name)) + "</div>";
        return (
          '<article class="team-card reveal">' +
          photoHtml +
          "<h3>" + escapeHtml(m.name) + "</h3>" +
          '<span class="team-position">' + escapeHtml(m.position) + "</span>" +
          "<p>" + escapeHtml(m.description || "") + "</p>" +
          "</article>"
        );
      })
      .join("");

    if (revealObserver) {
      teamGrid.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });
    } else {
      teamGrid.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
    }
  }

  if (teamGrid) {
    fetch("/api/team")
      .then(function (res) { return res.json(); })
      .then(function (data) { renderTeam(data.team || []); })
      .catch(function () {
        if (teamLoading) teamLoading.textContent = "Tidak dapat memuat profil tim. Coba muat ulang halaman.";
      });
  }

  /* ---------------- Order modal ---------------- */
  var orderModalBackdrop = document.getElementById("orderModalBackdrop");
  var orderModalClose = document.getElementById("orderModalClose");
  var orderProductName = document.getElementById("orderProductName");
  var orderProductPrice = document.getElementById("orderProductPrice");
  var orderQty = document.getElementById("orderQty");
  var orderTotal = document.getElementById("orderTotal");
  var orderForm = document.getElementById("orderForm");
  var orderStatus = document.getElementById("orderStatus");
  var orderSubmitBtn = document.getElementById("orderSubmitBtn");
  var activeProduct = null;

  function updateOrderTotal() {
    if (!activeProduct || !orderTotal) return;
    var qty = Math.max(1, parseInt(orderQty.value, 10) || 1);
    orderTotal.textContent = "Total: " + formatRupiah(activeProduct.price * qty);
  }

  function openOrderModal(product) {
    activeProduct = product;
    if (orderProductName) orderProductName.textContent = product.name;
    if (orderProductPrice) orderProductPrice.textContent = formatRupiah(product.price) + " / porsi";
    if (orderQty) orderQty.value = 1;
    if (orderStatus) { orderStatus.textContent = ""; orderStatus.className = "form-status"; }
    updateOrderTotal();
    if (orderModalBackdrop) {
      orderModalBackdrop.hidden = false;
      document.body.style.overflow = "hidden";
    }
    var firstField = document.getElementById("orderQty");
    if (firstField) firstField.focus();
  }

  function closeOrderModal() {
    if (orderModalBackdrop) {
      orderModalBackdrop.hidden = true;
      document.body.style.overflow = "";
    }
    activeProduct = null;
  }

  if (orderModalClose) orderModalClose.addEventListener("click", closeOrderModal);
  if (orderModalBackdrop) {
    orderModalBackdrop.addEventListener("click", function (e) {
      if (e.target === orderModalBackdrop) closeOrderModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && orderModalBackdrop && !orderModalBackdrop.hidden) closeOrderModal();
  });
  if (orderQty) orderQty.addEventListener("input", updateOrderTotal);

  if (orderForm) {
    orderForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!activeProduct) return;

      var qty = Math.max(1, parseInt(orderQty.value, 10) || 1);
      var customerName = document.getElementById("orderName").value.trim();
      var phone = document.getElementById("orderPhone").value.trim();
      var note = document.getElementById("orderNote").value.trim();

      if (!customerName || !phone) {
        setOrderStatus("Mohon lengkapi nama dan nomor WhatsApp.", "err");
        return;
      }

      orderSubmitBtn.disabled = true;
      orderSubmitBtn.textContent = "Mengirim...";
      setOrderStatus("", "");

      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: activeProduct.id,
          qty: qty,
          customerName: customerName,
          phone: phone,
          note: note
        })
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (result.ok) {
            setOrderStatus("Pesanan diterima! Kami akan segera menghubungi Anda.", "ok");
            var confirmMsg = encodeURIComponent(
              "Halo Five Group, saya baru saja memesan " +
                result.data.qty + "x " + result.data.productName +
                " (Total " + formatRupiah(result.data.total) + "). Atas nama " + customerName + "."
            );
            var waLink = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + confirmMsg;
            var link = document.createElement("a");
            link.href = waLink;
            link.target = "_blank";
            link.rel = "noopener";
            link.className = "btn btn-wa";
            link.style.marginTop = "10px";
            link.style.display = "inline-block";
            link.textContent = "Konfirmasi lewat WhatsApp";
            orderStatus.after(link);
            orderForm.reset();
          } else {
            setOrderStatus(result.data.error || "Terjadi kesalahan, coba lagi.", "err");
          }
        })
        .catch(function () {
          setOrderStatus("Tidak dapat terhubung ke server. Coba lagi nanti.", "err");
        })
        .finally(function () {
          orderSubmitBtn.disabled = false;
          orderSubmitBtn.textContent = "Kirim pesanan";
        });
    });
  }

  function setOrderStatus(text, kind) {
    if (!orderStatus) return;
    orderStatus.textContent = text;
    orderStatus.className = "form-status" + (kind ? " " + kind : "");
    var existingLink = orderStatus.parentElement.querySelector("a.btn-wa");
    if (existingLink && text === "") existingLink.remove();
  }

  /* ---------------- Contact form ---------------- */
  var form = document.getElementById("contactForm");
  var statusEl = document.getElementById("formStatus");
  var submitBtn = document.getElementById("submitBtn");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("name").value.trim();
      var email = document.getElementById("email").value.trim();
      var message = document.getElementById("message").value.trim();

      if (!name || !email || !message) {
        setStatus("Mohon lengkapi semua kolom.", "err");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Mengirim...";
      setStatus("", "");

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, email: email, message: message })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            setStatus("Terima kasih, pesan Anda sudah kami terima.", "ok");
            form.reset();
          } else {
            setStatus(result.data.error || "Terjadi kesalahan, coba lagi.", "err");
          }
        })
        .catch(function () {
          setStatus("Tidak dapat terhubung ke server. Coba lagi nanti.", "err");
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Kirim pesan";
        });
    });
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = "form-status" + (kind ? " " + kind : "");
  }

  /* ---------------- Visitor counter ---------------- */
  var visitEl = document.getElementById("visitCount");
  if (visitEl) {
    fetch("/api/visits", { method: "POST" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (typeof data.total === "number") {
          visitEl.textContent = data.total.toLocaleString("id-ID") + " pengunjung tercatat";
        }
      })
      .catch(function () {
        /* silently ignore — backend may not be running */
      });
  }
})();
