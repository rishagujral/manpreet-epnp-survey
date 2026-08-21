document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("surveyForm");
  const thankYou = document.getElementById("thankYou");

  if (!form) return;

  const steps = Array.from(form.querySelectorAll(".step"));
  let currentIndex = 0;
  let branchToDetails = false;

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

  function getOverallAnswer() {
    const checked = form.querySelector('input[name="overall_s2p"]:checked');
    return checked ? checked.value : null;
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

  function goNext() {
    const id = currentStepId();

    if (id === "landing") {
      const email = form.querySelector("#email");
      if (!email.checkValidity()) {
        email.reportValidity();
        return;
      }
      showStep("general");
      return;
    }

    if (id === "general") {
      const answer = getOverallAnswer();
      if (!answer) {
        alert("Please select an option.");
        return;
      }
      if (answer === "Dissatisfied" || answer === "Very Dissatisfied") {
        branchToDetails = true;
        showStep("servicelines");
      } else {
        branchToDetails = false;
        showStep("recognition");
      }
      return;
    }

    if (id === "servicelines") {
      const anyChecked = form.querySelectorAll(".sl-checkbox:checked").length > 0;
      if (!anyChecked) {
        alert("Please select at least one service line.");
        return;
      }
      syncServiceLineBlocks();
      showStep("details");
      return;
    }

    if (id === "details") {
      showStep("recognition");
      return;
    }
  }

  function goBack() {
    const id = currentStepId();

    if (id === "general") {
      showStep("landing");
    } else if (id === "servicelines") {
      showStep("general");
    } else if (id === "details") {
      showStep("servicelines");
    } else if (id === "recognition") {
      showStep(branchToDetails ? "details" : "general");
    }
  }

  form.querySelectorAll(".btn-next").forEach((btn) => btn.addEventListener("click", goNext));
  form.querySelectorAll(".btn-back").forEach((btn) => btn.addEventListener("click", goBack));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const payload = {
      email: formData.get("email"),
      overallSatisfaction: formData.get("overall_s2p"),
      branch: branchToDetails ? "detailed" : "quick",
      serviceLines: branchToDetails ? formData.getAll("serviceLines") : [],
      serviceLineResponses: {},
      recognition: (formData.get("recognition") || "").trim()
    };

    if (branchToDetails) {
      const checkedKeys = Array.from(form.querySelectorAll(".sl-checkbox:checked")).map(
        (cb) => cb.dataset.slkey
      );
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
