document.querySelectorAll(".reveal").forEach(el => el.classList.add("show"));
document.addEventListener("DOMContentLoaded", () => {
  // Clean old querystring if user previously submitted
  if (location.search) history.replaceState({}, "", location.pathname);

  const form = document.getElementById("contactForm");
  if (!form) return;

  const CONTACT_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbw6NR5zBfyPDRRfMzMJGbsBncM_kiqaebb5DGFuIwej8H0zM6c8MadRUuIWT-A-cHTtTA/exec";

  const btn = document.getElementById("submitBtn");
  const toastEl = document.getElementById("globalStatus");

  function toast(msg, isError = false) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = "globalStatus show " + (isError ? "error" : "success");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 4000);
  }

  function disableBtn(disabled) {
    if (!btn) return;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? "0.7" : "1";
    btn.style.cursor = disabled ? "not-allowed" : "pointer";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("CONTACT FORM submit handler fired");

    // Honeypot
    const hp = (document.getElementById("company")?.value || "").trim();
    if (hp) {
      toast("Submitted.");
      form.reset();
      return;
    }

    const payload = {
      firstName: (form.firstName?.value || "").trim(),
      lastName: (form.lastName?.value || "").trim(),
      email: (form.email?.value || "").trim(),
      subject: (form.subject?.value || "").trim(),
      message: (form.message?.value || "").trim(),
      page: location.href,
      ts: new Date().toISOString(),
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.subject || !payload.message) {
      toast("Please fill all required fields.", true);
      return;
    }

    toast("Sending…");
    disableBtn(true);

    try {
      const params = new URLSearchParams(payload);

      const res = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      body: params, // form-urlencoded (NO headers)
      });

      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}
           if (!res.ok || data.ok !== true) {
               throw new Error(data.error || text || "Submit failed");
      }


      form.reset();
      toast("Message sent. Check your email for confirmation.");
    } catch (err) {
      console.error(err);
      toast("Failed to send. Please try again later.", true);
    } finally {
      disableBtn(false);
    }
  });
});
