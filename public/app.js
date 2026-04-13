document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("surveyForm");
  const thankYou = document.getElementById("thankYou");

  if (!form) return;

  const checkboxes = form.querySelectorAll(".sl-checkbox");

  function syncRatingGroups() {
    checkboxes.forEach((cb) => {
      const key = cb.dataset.slkey;
      const group = form.querySelector(`.rating-group[data-slkey="${key}"]`);
      if (!group) return;

      const radios = group.querySelectorAll('input[type="radio"]');
      if (cb.checked) {
        group.classList.remove("disabled-group");
        radios.forEach((r) => (r.disabled = false));
      } else {
        group.classList.add("disabled-group");
        radios.forEach((r) => {
          r.disabled = true;
          r.checked = false;
        });
      }
    });
  }

  checkboxes.forEach((cb) => cb.addEventListener("change", syncRatingGroups));
  syncRatingGroups();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = {
      email: formData.get("email"),
      serviceLines: formData.getAll("serviceLines"),
      satisfaction: {},
      overallSatisfaction: formData.get("overall_satisfaction"),
      improvement: (formData.get("improvement") || "").trim(),
      recognition: (formData.get("recognition") || "").trim()
    };

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("satisfaction_")) {
        const slKey = key.replace("satisfaction_", "");
        payload.satisfaction[slKey] = value;
      }
    }

    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      alert("There was an error submitting the survey.");
      return;
    }

    form.classList.add("hidden");
    thankYou.classList.remove("hidden");
  });
});
