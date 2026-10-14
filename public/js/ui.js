// Small shared UI behaviour.
// Forms marked data-loading-form show a spinner on their submit button (the one with data-loading-text) once the
// browser has accepted the submission, and block double submits. Restored if the page comes back from the
// back/forward cache.
(() => {
  "use strict";

  const forms = document.querySelectorAll("form[data-loading-form]");

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      // Wait for validation handlers to run; if they blocked the submit there is nothing to show.
      setTimeout(() => {
        if (event.defaultPrevented) return;
        const btn = form.querySelector('button[type="submit"][data-loading-text]');
        if (!btn || btn.disabled) return;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>' + btn.dataset.loadingText;
      }, 0);
    });
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    document.querySelectorAll("button[data-original-html]").forEach((btn) => {
      btn.innerHTML = btn.dataset.originalHtml;
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    });
  });
})();
