const tooltip = d3.select("body")
  .append("div")
  .style("position", "absolute")
  .style("background", "white")
  .style("border", "1px solid #ccc")
  .style("padding", "8px 10px")
  .style("border-radius", "6px")
  .style("pointer-events", "none")
  .style("font-size", "13px")
  .style("box-shadow", "0 2px 8px rgba(0,0,0,0.12)")
  .style("display", "none");

const margin = { top: 40, right: 30, bottom: 70, left: 60 };
const width = 620 - margin.left - margin.right;
const height = 320 - margin.top - margin.bottom;

const svg = d3.select("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

const chart = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const colorScale = d3.scaleOrdinal()
  .domain(["Public", "Private"])
  .range(["#4C78A8", "#F58518"]);

d3.text("student_performance.csv").then(raw => {
  const lines = raw.trim().split(/\r?\n/);

  // handles your dataset format with the extra first row
  const cleaned = [lines[1], ...lines.slice(2)].join("\n");

  const data = d3.csvParse(cleaned, d => ({
    Exam_Score: +String(d.Exam_Score).trim(),
    Sleep_Hours: +String(d.Sleep_Hours).trim(),
    Motivation_Level: String(d.Motivation_Level).trim(),
    Family_Income: String(d.Family_Income).trim(),
    Physical_Activity: +String(d.Physical_Activity).trim(),
    Access_to_Resources: String(d.Access_to_Resources).trim(),
    School_Type: String(d.School_Type).trim()
  })).filter(d =>
    !isNaN(d.Exam_Score) &&
    !isNaN(d.Sleep_Hours) &&
    !isNaN(d.Physical_Activity) &&
    d.Motivation_Level &&
    d.Family_Income &&
    d.Access_to_Resources &&
    d.School_Type
  );

  data.forEach(d => {
    if (d.Sleep_Hours < 6) {
      d.Sleep_Group = "Low";
    } else if (d.Sleep_Hours <= 7) {
      d.Sleep_Group = "Medium";
    } else {
      d.Sleep_Group = "High";
    }

    if (d.Physical_Activity <= 2) {
      d.Physical_Activity_Group = "Low";
    } else if (d.Physical_Activity <= 4) {
      d.Physical_Activity_Group = "Medium";
    } else {
      d.Physical_Activity_Group = "High";
    }
  });

  updateChart(data, "Access_to_Resources");

  d3.select("#dropdown").on("change", function () {
    const selected = d3.select("#dropdown").property("value");
    updateChart(data, selected);
  });
});

function updateChart(data, category) {
  const orderedLevels = ["Low", "Medium", "High"];
  const orderedSchools = ["Public", "Private"];

  const grouped = d3.rollups(
    data,
    v => d3.mean(v, d => d.Exam_Score),
    d => d[category],
    d => d.School_Type
  );

  const categoryValues = grouped
    .map(d => d[0])
    .sort((a, b) => {
      const ai = orderedLevels.indexOf(a);
      const bi = orderedLevels.indexOf(b);

      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return d3.ascending(a, b);
    });

  const newData = [];
  grouped.forEach(([groupName, schoolEntries]) => {
    orderedSchools.forEach(school => {
      const found = schoolEntries.find(d => d[0] === school);
      if (found) {
        newData.push({
          category: groupName,
          school,
          Exam_Score: found[1]
        });
      }
    });
  });

  const x0 = d3.scaleBand()
    .domain(categoryValues)
    .range([0, width])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(orderedSchools)
    .range([0, x0.bandwidth()])
    .padding(0.08);

  const y = d3.scaleLinear()
    .domain([50, d3.max(newData, d => d.Exam_Score) + 2])
    .nice()
    .range([height, 0]);

  chart.selectAll("*").remove();

  chart.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .style("font-size", "12px");

  chart.append("g")
    .call(d3.axisLeft(y));

  const group = chart.selectAll(".group")
    .data(categoryValues)
    .join("g")
    .attr("class", "group")
    .attr("transform", d => `translate(${x0(d)},0)`);

  group.selectAll("rect")
    .data(groupName => newData.filter(d => d.category === groupName))
    .join("rect")
    .attr("x", d => x1(d.school))
    .attr("y", d => y(d.Exam_Score))
    .attr("width", x1.bandwidth())
    .attr("height", d => height - y(d.Exam_Score))
    .attr("fill", d => colorScale(d.school))
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 0.8);
      tooltip
        .style("display", "block")
        .html(
          `<strong>${d.category}</strong><br>` +
          `School Type: ${d.school}<br>` +
          `Avg Score: ${d.Exam_Score.toFixed(2)}`
        )
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 1);
      tooltip.style("display", "none");
    });

  chart.append("text")
    .attr("x", width / 2)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(category.replaceAll("_", " "));

  chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Average Exam Score");

  const legend = chart.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 120}, -25)`);

  orderedSchools.forEach((school, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(${i * 70}, 0)`);

    row.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", colorScale(school));

    row.append("text")
      .attr("x", 20)
      .attr("y", 11)
      .text(school);
  });
}