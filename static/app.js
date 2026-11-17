const colors = {
  ink: "#274b3a",
  green: "#75ad87",
  pale: "#cbded0",
  peach: "#d79a77",
  muted: "#829188",
  grid: "#edf1ee",
};

const plotConfig = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
};

let dashboardData = null;
const renderedPanels = new Set();

function baseLayout(extra = {}) {
  return {
    margin: { t: 12, r: 12, b: 42, l: 43 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { family: "DM Sans, sans-serif", size: 10, color: colors.muted },
    xaxis: { gridcolor: colors.grid, zerolinecolor: colors.grid, linecolor: colors.grid, fixedrange: false },
    yaxis: { gridcolor: colors.grid, zerolinecolor: colors.grid, linecolor: colors.grid, fixedrange: false },
    legend: { orientation: "h", y: -0.22, font: { size: 9 } },
    hoverlabel: { bgcolor: "#19362e", bordercolor: "#19362e", font: { color: "#fff", size: 10 } },
    ...extra,
  };
}

function draw(id, traces, layout) {
  const element = document.getElementById(id);
  if (element && window.Plotly) {
    Plotly.newPlot(element, traces, baseLayout(layout), plotConfig);
  }
}

function addChartCard(container, id, index, title, description, explanation) {
  const card = document.createElement("article");
  card.className = "chart-card";
  card.innerHTML = `
    <div class="chart-heading">
      <div><span class="chart-index">${index}</span><h4>${title}</h4></div>
      <p>${description}</p>
    </div>
    <div class="chart-plot" id="${id}"></div>
    <div class="chart-explanation"><strong>What to notice</strong><span>${explanation}</span></div>`;
  container.appendChild(card);
  return id;
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US").format(number);
}

function renderSummary(summary) {
  const stats = [
    [formatNumber(summary.records), "People in the dataset"],
    [formatNumber(summary.diabetes), "Positive records"],
    [`${summary.diabetesRate}%`, "Across all records"],
    [formatNumber(summary.duplicates), "Found in the dataset"],
  ];
  document.querySelectorAll("#summary-stats .stat-card").forEach((card, index) => {
    card.querySelector("strong").textContent = stats[index][0];
    card.querySelector("small").textContent = stats[index][1];
  });
  document.querySelector(".dataset-chip").innerHTML =
    `<span></span> ${formatNumber(summary.records)} records`;
}

function renderSnapshot(data) {
  const summary = data.summary;
  const highlights = [
    ["Diabetes cases", summary.modelScopeDiabetes, `${formatNumber(summary.diabetesByGender.Female)} women · ${formatNumber(summary.diabetesByGender.Male)} men`],
    ["Heart disease", summary.heartDiseaseByGender.Female + summary.heartDiseaseByGender.Male, `${formatNumber(summary.heartDiseaseByGender.Female)} women · ${formatNumber(summary.heartDiseaseByGender.Male)} men`],
    ["Hypertension", summary.hypertensionByGender.Female + summary.hypertensionByGender.Male, `${formatNumber(summary.hypertensionByGender.Female)} women · ${formatNumber(summary.hypertensionByGender.Male)} men`],
    ["Diabetes + heart disease", summary.diabetesWithHeartDisease, "records in both groups"],
  ];
  const highlightRoot = document.getElementById("notebook-highlights");
  highlightRoot.replaceChildren();
  for (const [label, value, note] of highlights) {
    const item = document.createElement("div");
    item.className = "highlight-item";
    item.innerHTML = `<span>${label}</span><strong>${formatNumber(value)}</strong><small>${note}</small>`;
    highlightRoot.appendChild(item);
  }

  draw("chart-target", [
    {
      type: "pie",
      labels: ["No diabetes", "Diabetes"],
      values: data.targetCounts,
      hole: 0.66,
      sort: false,
      marker: { colors: [colors.pale, colors.green], line: { color: "#fff", width: 4 } },
      textinfo: "label+percent",
      textposition: "outside",
      textfont: { size: 10 },
      hovertemplate: "%{label}<br>%{value:,} records (%{percent})<extra></extra>",
    },
  ], {
    height: 300,
    showlegend: false,
    margin: { t: 17, r: 44, b: 19, l: 44 },
    annotations: [{
      text: `<b>${summary.diabetesRate}%</b><br><span style="font-size:9px;color:${colors.muted}">diabetes</span>`,
      showarrow: false,
      font: { family: "Manrope, sans-serif", size: 18, color: colors.ink },
    }],
  });

  draw("chart-smoking", [
    { type: "bar", name: "No diabetes", x: data.smokingDiabetes.labels, y: data.smokingDiabetes.noDiabetes, marker: { color: colors.pale }, hovertemplate: "%{x}<br>No diabetes: %{y:.1%}<extra></extra>" },
    { type: "bar", name: "Diabetes", x: data.smokingDiabetes.labels, y: data.smokingDiabetes.diabetes, marker: { color: colors.green }, hovertemplate: "%{x}<br>Diabetes: %{y:.1%}<extra></extra>" },
  ], {
    barmode: "stack",
    height: 300,
    yaxis: { title: "Share within group", tickformat: ".0%", range: [0, 1], gridcolor: colors.grid },
    xaxis: { tickangle: -13, gridcolor: colors.grid },
  });

  draw("chart-smoking-counts", [{
    type: "bar",
    x: data.smokingCounts.labels,
    y: data.smokingCounts.values,
    marker: { color: data.smokingCounts.labels.map((_, i) => i === 1 ? "#d9b6a1" : colors.green), cornerradius: 4 },
    hovertemplate: "%{x}<br>%{y:,} records<extra></extra>",
  }], {
    height: 300,
    showlegend: false,
    xaxis: { tickangle: -13, gridcolor: colors.grid },
    yaxis: { title: "Records", tickformat: ",d", gridcolor: colors.grid },
  });

  const metrics = [
    ["Recall", summary.modelMetrics.recall],
    ["ROC-AUC", summary.modelMetrics.rocAuc],
    ["PR-AUC", summary.modelMetrics.prAuc],
    ["F1 score", summary.modelMetrics.f1],
    ["Precision", summary.modelMetrics.precision],
    ["Accuracy", summary.modelMetrics.accuracy],
  ];
  const metricsRoot = document.getElementById("chart-model-metrics");
  metricsRoot.replaceChildren();
  for (const [label, value] of metrics) {
    const row = document.createElement("div");
    row.className = "metric-row";
    row.innerHTML = `<span>${label}</span><div class="metric-track"><div class="metric-fill" style="width:${value}%"></div></div><span class="metric-value">${value.toFixed(1)}%</span>`;
    metricsRoot.appendChild(row);
  }
  const metricCard = metricsRoot.closest(".chart-card");
  metricCard.querySelector(".chart-heading p").textContent =
    `Notebook test-set scores · ${formatNumber(summary.modelScopeRecords)} records after excluding “No Info”.`;
}

function renderClinical(data) {
  const root = document.getElementById("clinical-charts");
  root.replaceChildren();
  const fields = [
    { key: "age", title: "Age", unit: "years", note: "The dataset covers ages from early life through 80; the plotted distributions compare diabetes groups." },
    { key: "bmi", title: "Body mass index (BMI)", unit: "BMI", note: "The wider spread among positive cases is descriptive only and does not establish cause." },
    { key: "HbA1c_level", title: "HbA1c level", unit: "HbA1c", note: "HbA1c reflects average blood sugar over time; clinical interpretation belongs with a clinician." },
    { key: "blood_glucose_level", title: "Blood glucose", unit: "mg/dL", note: "The sample includes a wide range of glucose values and both diabetes outcomes." },
  ];

  fields.forEach((field, index) => {
    const id = addChartCard(root, `hist-${field.key}`, `0${index + 1}`, `${field.title} distribution`,
      "Full dataset · frequency by measured value.",
      "Compare the shapes of the two groups; overlapping ranges show why one measurement alone is not a personal diagnosis.");
    const distribution = data.distributions[field.key];
    draw(id, [
      { type: "bar", name: "No diabetes", x: distribution.labels, y: distribution.noDiabetes, marker: { color: colors.pale }, opacity: 0.76, hovertemplate: `%{x}<br>No diabetes: %{y:,}<extra></extra>` },
      { type: "bar", name: "Diabetes", x: distribution.labels, y: distribution.diabetes, marker: { color: colors.green }, opacity: 0.72, hovertemplate: `%{x}<br>Diabetes: %{y:,}<extra></extra>` },
    ], { barmode: "overlay", height: 250, xaxis: { title: field.unit, gridcolor: colors.grid }, yaxis: { title: "People", gridcolor: colors.grid } });
  });

  fields.forEach((field, index) => {
    const id = addChartCard(root, `box-${field.key}`, `0${index + 5}`, `${field.title} spread`,
      "Box plots compare the median, quartiles, and outliers by outcome.",
      field.note);
    const values = data.groupedValues[field.key];
    draw(id, [
      { type: "box", name: "No diabetes", y: values["0"], marker: { color: colors.pale }, line: { color: "#a7c7ae" }, fillcolor: "#e5eee7", boxpoints: false },
      { type: "box", name: "Diabetes", y: values["1"], marker: { color: colors.green }, line: { color: colors.green }, fillcolor: "#d7e9da", boxpoints: false },
    ], { height: 250, yaxis: { title: field.unit, gridcolor: colors.grid }, xaxis: { gridcolor: colors.grid } });
  });

  fields.forEach((field, index) => {
    const id = addChartCard(root, `violin-${field.key}`, `0${index + 9}`, `${field.title} by diabetes status`,
      "Violin plots reveal density and spread in a readable sample.",
      "Wider sections show where sampled values cluster. Distributions are not diagnostic cutoffs.");
    const values = data.groupedValues[field.key];
    draw(id, [
      { type: "violin", name: "No diabetes", y: values["0"], points: false, box: { visible: true }, meanline: { visible: true }, line: { color: "#a7c7ae" }, fillcolor: "#e5eee7", opacity: 0.78 },
      { type: "violin", name: "Diabetes", y: values["1"], points: false, box: { visible: true }, meanline: { visible: true }, line: { color: colors.green }, fillcolor: "#b8d7bd", opacity: 0.72 },
    ], { height: 250, violinmode: "group", yaxis: { title: field.unit, gridcolor: colors.grid } });
  });

  const smokingId = addChartCard(root, "smoking-count-chart", "13", "Smoking-history categories",
    "A count of each category in the full dataset.",
    "“No Info” is the largest group. The notebook excludes it before fitting and evaluating the selected model.");
  draw(smokingId, [{
    type: "bar", x: data.smokingCounts.labels, y: data.smokingCounts.values,
    marker: { color: data.smokingCounts.labels.map((_, i) => i === 1 ? "#d9b6a1" : colors.green) },
    hovertemplate: "%{x}<br>%{y:,} people<extra></extra>",
  }], { height: 250, showlegend: false, xaxis: { tickangle: -12 }, yaxis: { title: "People", tickformat: ",d" } });
}

function renderRelationships(data) {
  const root = document.getElementById("relationship-charts");
  root.replaceChildren();
  const scatterSpecs = [
    ["bmiAge", "BMI and age", "BMI", "Age (years)", "Values are sampled for readability; color separates diabetes outcomes."],
    ["glucoseHba1c", "Blood glucose and HbA1c", "Blood glucose (mg/dL)", "HbA1c level", "The model uses both measures. Their relationship is visible here, but neither result is a diagnosis by itself."],
    ["ageGlucose", "Age and blood glucose", "Age (years)", "Blood glucose (mg/dL)", "Color indicates the recorded outcome; this is a descriptive view, not a clinical boundary."],
  ];
  scatterSpecs.forEach(([key, title, xTitle, yTitle, note], index) => {
    const id = addChartCard(root, `scatter-${key}`, `0${index + 1}`, title,
      "A sampled view of the full dataset.", note);
    const points = data.scatter[key];
    const groups = [0, 1].map((target) => {
      const indices = points.target.flatMap((value, i) => value === target ? [i] : []);
      return {
        type: "scattergl",
        mode: "markers",
        name: target === 1 ? "Diabetes" : "No diabetes",
        x: indices.map((i) => points.x[i]),
        y: indices.map((i) => points.y[i]),
        marker: { size: 6, opacity: target === 1 ? 0.64 : 0.34, color: target === 1 ? colors.green : "#b7c9bc" },
        hovertemplate: `${xTitle}: %{x}<br>${yTitle}: %{y}<extra></extra>`,
      };
    });
    draw(id, groups, { height: 260, xaxis: { title: xTitle }, yaxis: { title: yTitle } });
  });

  const heatmapId = addChartCard(root, "correlation-chart", "04", "Numeric feature correlations",
    "Pearson correlation across numeric dataset columns.",
    "Correlation describes how two numeric variables vary together; it does not prove that one causes the other.");
  draw(heatmapId, [{
    type: "heatmap",
    x: data.correlation.labels.map((label) => label.replaceAll("_", " ")),
    y: data.correlation.labels.map((label) => label.replaceAll("_", " ")),
    z: data.correlation.values,
    zmin: -1,
    zmax: 1,
    colorscale: [[0, "#d99478"], [0.5, "#f7f8f6"], [1, "#69a987"]],
    text: data.correlation.values.map((row) => row.map((value) => value.toFixed(2))),
    texttemplate: "%{text}",
    textfont: { size: 9 },
    hovertemplate: "%{y} × %{x}<br>Correlation: %{z:.2f}<extra></extra>",
    colorbar: { thickness: 10, tickfont: { size: 8 } },
  }], {
    height: 370,
    margin: { t: 8, r: 15, b: 105, l: 110 },
    xaxis: { tickangle: -38, side: "bottom", gridcolor: "transparent" },
    yaxis: { autorange: "reversed", gridcolor: "transparent" },
  });

  const pairId = addChartCard(root, "pairplot-chart", "05", "Feature pairplot",
    "A sample of numeric features; select a point to explore it.",
    "The notebook’s pairplot compares numeric features. This interactive sample uses a smaller set so it stays responsive.");
  const pair = data.pairPlot;
  const pairTraces = [0, 1].map((target) => {
    const indices = pair.target.flatMap((value, i) => value === target ? [i] : []);
    return {
      type: "splom",
      name: target === 1 ? "Diabetes" : "No diabetes",
      dimensions: pair.dimensions.map((dimension) => ({
        label: dimension.label,
        values: indices.map((i) => dimension.values[i]),
      })),
      marker: { color: target === 1 ? colors.green : "#bdcec1", size: 4, opacity: 0.56, line: { width: 0 } },
      diagonal: { visible: false },
      showupperhalf: true,
      showlowerhalf: true,
      hovertemplate: "%{xaxis.title.text}: %{x}<br>%{yaxis.title.text}: %{y}<extra></extra>",
    };
  });
  draw(pairId, pairTraces, {
    height: 620,
    margin: { t: 14, r: 10, b: 36, l: 45 },
    showlegend: true,
    xaxis: { gridcolor: colors.grid },
    yaxis: { gridcolor: colors.grid },
  });
}

function renderPanel(name) {
  if (!dashboardData || renderedPanels.has(name)) return;
  if (name === "clinical") renderClinical(dashboardData);
  if (name === "relationships") renderRelationships(dashboardData);
  renderedPanels.add(name);
}

function resizeActiveCharts() {
  if (!window.Plotly) return;
  document.querySelectorAll(".chart-panel.active .chart-plot").forEach((plot) => {
    Plotly.relayout(plot, { width: plot.clientWidth, autosize: true });
  });
}

async function loadDashboard() {
  try {
    const response = await fetch("/api/eda");
    if (!response.ok) throw new Error("Could not load the dataset analysis.");
    dashboardData = await response.json();
    renderSummary(dashboardData.summary);
    renderSnapshot(dashboardData);
    renderedPanels.add("snapshot");
    renderPanel(document.querySelector(".tab-button.active").dataset.panel);
  } catch (error) {
    const description = document.getElementById("tab-description");
    description.textContent = `${error.message} Refresh the page to try again.`;
    description.classList.add("load-error");
  }
}

function setupTabs() {
  const descriptions = {
    snapshot: "The balance of diabetes cases and how smoking-history groups are represented.",
    clinical: "Notebook distributions, outlier checks, and clinical measures split by recorded diabetes status.",
    relationships: "Explore pairwise patterns, correlations, and the notebook’s multivariate feature view.",
  };
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      document.querySelectorAll(".chart-panel").forEach((panel) => {
        const selected = panel.id === `panel-${button.dataset.panel}`;
        panel.classList.toggle("active", selected);
        panel.hidden = !selected;
      });
      document.getElementById("tab-description").textContent = descriptions[button.dataset.panel];
      renderPanel(button.dataset.panel);
      requestAnimationFrame(resizeActiveCharts);
    });
  });
  window.addEventListener("resize", resizeActiveCharts);
}

function setupReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach((target) => observer.observe(target));
}

function setupMobileNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("is-open", !expanded);
  });
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupPredictionForm() {
  const form = document.getElementById("prediction-form");
  const result = document.getElementById("prediction-result");
  const errorBox = document.getElementById("form-error");

  function showForm() {
    form.hidden = false;
    result.hidden = true;
    errorBox.hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.getElementById("edit-result").addEventListener("click", showForm);
  document.getElementById("predict-again").addEventListener("click", () => {
    form.reset();
    showForm();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.innerHTML = "Calculating… <span aria-hidden=\"true\">· · ·</span>";

    const values = Object.fromEntries(new FormData(form).entries());
    for (const field of ["age", "bmi", "HbA1c_level", "blood_glucose_level", "hypertension", "heart_disease"]) {
      values[field] = Number(values[field]);
    }

    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The prediction could not be calculated.");

      const percent = payload.probability * 100;
      document.getElementById("probability-value").textContent = `${percent.toFixed(1)}%`;
      document.querySelector(".gauge-progress").style.strokeDashoffset = `${301.59 * (1 - payload.probability)}`;
      const elevated = payload.prediction === 1;
      document.getElementById("probability-visual").classList.toggle("is-elevated", elevated);
      document.querySelector(".result-message").classList.toggle("is-elevated", elevated);
      document.getElementById("result-icon").textContent = elevated ? "!" : "✓";
      document.getElementById("result-title").textContent = elevated ? "Follow up with a clinician" : "No risk flag from this model";
      document.getElementById("result-copy").textContent = elevated
        ? "The model assigned this profile a higher diabetes probability. This is not a diagnosis; please discuss your health and any needed testing with a healthcare professional."
        : "This model did not flag the profile, but that does not rule out diabetes or replace regular screening. A clinician can advise based on your full health picture.";
      form.hidden = true;
      result.hidden = false;
      result.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Calculate estimate <span aria-hidden="true">↗</span>';
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupReveal();
  setupMobileNavigation();
  setupPredictionForm();
  loadDashboard();
});
