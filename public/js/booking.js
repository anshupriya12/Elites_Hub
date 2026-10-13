(() => {
  "use strict";

  const form = document.getElementById("booking-form");
  if (!form) return;

  const checkIn = document.getElementById("checkIn");
  const checkOut = document.getElementById("checkOut");
  const guests = document.getElementById("guests");
  const estimate = document.getElementById("estimate");
  const errorBox = document.getElementById("booking-error");
  const payBtn = document.getElementById("pay-btn");
  const listingId = form.dataset.listingId;
  const price = Number(form.dataset.price);

  const today = new Date().toISOString().slice(0, 10);
  checkIn.min = today;
  checkOut.min = today;

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.classList.remove("d-none");
  };
  const clearError = () => errorBox.classList.add("d-none");

  const nightsBetween = () => {
    if (!checkIn.value || !checkOut.value) return 0;
    return Math.round((new Date(checkOut.value) - new Date(checkIn.value)) / 86400000);
  };

  // Display-only estimate; the server recalculates the real amount.
  const updateEstimate = () => {
    const nights = nightsBetween();
    if (checkIn.value) checkOut.min = checkIn.value;
    estimate.textContent =
      nights > 0
        ? `₹${(nights * price).toLocaleString("en-IN")} for ${nights} night${nights > 1 ? "s" : ""}`
        : "—";
  };
  checkIn.addEventListener("change", updateEstimate);
  checkOut.addEventListener("change", updateEstimate);

  const post = async (url, data) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data),
    });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      // Non-JSON response (for example an error page)
    }
    return { ok: res.ok, status: res.status, body };
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    if (!form.checkValidity()) {
      showError("Please fill in the check-in date, check-out date and number of guests.");
      return;
    }
    payBtn.disabled = true;
    payBtn.textContent = "Starting payment...";

    try {
      const created = await post(`/listings/${listingId}/bookings`, {
        "booking[checkIn]": checkIn.value,
        "booking[checkOut]": checkOut.value,
        "booking[guests]": guests.value,
      });
      if (!created.ok || !created.body) {
        showError(
          (created.body && created.body.error) ||
            "Could not start the payment. Please log in again and retry."
        );
        return resetButton();
      }
      const order = created.body;

      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Elites Hub",
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#1d3557" },
        handler: async (response) => {
          payBtn.textContent = "Confirming payment...";
          const verified = await post(`/bookings/${order.bookingId}/verify`, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (verified.body && verified.body.redirect) {
            window.location.href = verified.body.redirect;
          } else {
            showError("We could not confirm your payment. Please contact support with your booking ID.");
            resetButton();
          }
        },
        modal: { ondismiss: resetButton },
      });
      checkout.on("payment.failed", async (response) => {
        const reason = response && response.error && response.error.description;
        await post(`/bookings/${order.bookingId}/failed`, { reason: reason || "Payment failed" });
        showError(reason || "The payment failed. You can try again.");
        resetButton();
      });
      checkout.open();
    } catch (e) {
      showError("Something went wrong. Please try again.");
      resetButton();
    }
  });

  function resetButton() {
    payBtn.disabled = false;
    payBtn.textContent = "Pay with Razorpay";
  }
})();
