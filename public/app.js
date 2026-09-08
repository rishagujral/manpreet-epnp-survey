document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("surveyForm");
  const thankYou = document.getElementById("thankYou");

  if (!form) return;

  const steps = Array.from(form.querySelectorAll(".step"));
  let currentIndex = 0;

  function stepIdAt(index) {
    return steps[index] ? steps[index].dataset.step : null;
  }

  function currentStepId() {
    return stepIdAt(currentIndex);
  }

  function showStep(stepId) {
    const idx = steps.findIndex((s) => s.dataset.step === stepId);
    if (idx === -1) return;
    steps.forEach((s) => s.classList.toggle("active-step", s.dataset.step === stepId));
    currentIndex = idx;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSubBlock(block, show) {
    if (!block) return;
    block.classList.toggle("hidden", !show);
    block.querySelectorAll("input, textarea").forEach((el) => {
      el.disabled = !show;
      if (!show) {
        if (el.type === "radio") el.checked = false;
        if (el.tagName === "TEXTAREA") el.value = "";
      }
    });
  }

  function updateGateVisibility(key) {
    const gateChecked = form.querySelector(`input[name="${key}_gate"]:checked`);
    const value = gateChecked ? gateChecked.value : null;
    const followUpBlock = form.querySelector(`.sl-followup-block[data-slkey="${key}"]`);
    const recognitionBlock = form.querySelector(`.sl-recognition-block[data-slkey="${key}"]`);
    toggleSubBlock(followUpBlock, value === "Neutral" || value === "Dissatisfied");
    // Recognition appears as soon as any satisfaction answer is given for this line:
    // immediately under the gate when Satisfied, or after the follow-up questions
    // when Neutral/Dissatisfied.
    toggleSubBlock(recognitionBlock, value !== null);
  }

  function syncServiceLineBlocks() {
    const checkboxes = form.querySelectorAll(".sl-checkbox");
    checkboxes.forEach((cb) => {
      const key = cb.dataset.slkey;
      const block = form.querySelector(`.sl-block[data-slkey="${key}"]`);
      if (!block) return;
      if (cb.checked) {
        block.classList.remove("hidden");
        block.querySelectorAll("input, textarea").forEach((el) => (el.disabled = false));
        // Re-apply gate-driven visibility so neutral/dissatisfied sub-blocks
        // stay hidden/disabled until the gate question is actually answered.
        updateGateVisibility(key);
      } else {
        block.classList.add("hidden");
        block.querySelectorAll("input, textarea").forEach((el) => {
          el.disabled = true;
          if (el.type === "radio") el.checked = false;
          if (el.tagName === "TEXTAREA") el.value = "";
        });
      }
    });
  }

  form.addEventListener("change", (e) => {
    const name = e.target.name || "";
    if (name.endsWith("_gate")) {
      const key = name.slice(0, -"_gate".length);
      updateGateVisibility(key);
    }
    if (e.target.classList.contains("sl-checkbox")) {
      syncServiceLineBlocks();
    }
  });

  function goNext() {
    const id = currentStepId();

    if (id === "landing") {
      const email = form.querySelector("#email");
      if (!email.checkValidity()) {
        email.reportValidity();
        return;
      }
      showStep("servicelines");
      return;
    }

    if (id === "servicelines") {
      const checkedBoxes = Array.from(form.querySelectorAll(".sl-checkbox:checked"));
      if (!checkedBoxes.length) {
        alert("Please select at least one service line.");
        return;
      }
      syncServiceLineBlocks();
      showStep("details");
      return;
    }
  }

  function goBack() {
    const id = currentStepId();

    if (id === "servicelines") {
      showStep("landing");
    } else if (id === "details") {
      showStep("servicelines");
    }
  }

  form.querySelectorAll(".btn-next").forEach((btn) => btn.addEventListener("click", goNext));
  form.querySelectorAll(".btn-back").forEach((btn) => btn.addEventListener("click", goBack));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const checkedKeys = Array.from(form.querySelectorAll(".sl-checkbox:checked")).map(
      (cb) => cb.dataset.slkey
    );
    const missing = checkedKeys.find(
      (key) => !form.querySelector(`input[name="${key}_gate"]:checked`)
    );
    if (missing) {
      alert("Please answer the satisfaction question for each selected service line.");
      return;
    }

    const formData = new FormData(form);

    const payload = {
      email: formData.get("email"),
      serviceLines: formData.getAll("serviceLines"),
      serviceLineResponses: {}
    };

    checkedKeys.forEach((key) => {
      payload.serviceLineResponses[key] = {};
    });

    for (const [name, value] of formData.entries()) {
      const match = checkedKeys.find((key) => name.startsWith(key + "_"));
      if (match) {
        const qid = name.slice(match.length + 1);
        payload.serviceLineResponses[match][qid] = value;
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

  showStep("landing");
});
