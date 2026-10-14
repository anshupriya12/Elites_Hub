// Warns before leaving a form (link click, Back/Forward, reload, closing the tab) while it has unsaved changes.
// Nothing is ever saved automatically: the browser asks whether to stay (then save) or leave (discard).
// Opt in with <form data-unsaved-guard> and, optionally, an element with id="unsaved-notice".
(() => {
  "use strict";

  const form = document.querySelector("form[data-unsaved-guard]");
  if (!form) return;
  const notice = document.getElementById("unsaved-notice");

  const fieldState = () =>
    Array.from(form.elements)
      .filter((el) => el.name && el.type !== "submit" && el.type !== "button")
      .map((el) => {
        if (el.type === "file") return [el.name, el.files ? el.files.length : 0];
        if (el.type === "checkbox" || el.type === "radio") return [el.name, el.checked];
        return [el.name, el.value];
      });

  const initial = JSON.stringify(fieldState());
  let submitting = false;
  const isDirty = () => !submitting && JSON.stringify(fieldState()) !== initial;
  const refresh = () => {
    if (notice) notice.classList.toggle("d-none", !isDirty());
  };

  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);

  form.addEventListener("submit", (event) => {
    submitting = true;
    // If validation blocks the submit the user is still editing, so protect the form again.
    setTimeout(() => {
      if (event.defaultPrevented) {
        submitting = false;
        refresh();
      }
    }, 0);
  });

  window.addEventListener("beforeunload", (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // Coming back to the page from the browser's back/forward cache.
  window.addEventListener("pageshow", refresh);
})();
