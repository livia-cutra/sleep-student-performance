const tooltip = d3.select("body").append("div")
  .style("position", "absolute")
  .style("background", "white")
  .style("border", "1px solid #ccc")
  .style("padding", "6px 10px")
  .style("border-radius", "4px")
  .style("pointer-events", "none")
  .style("font-size", "13px")
  .style("display", "none");

const margin = { top: 10, right: 20, bottom: 50, left: 55 };
const width = 560 - margin.left - margin.right;
const height = 260 - margin.top - margin.bottom;

const svg = d3.select("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

const chart = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

d3.text("student_performance.csv").then(raw => {
  const cleaned = raw.trim().split(/\r?\n/).slice(1).join("\n");

  const data = d3.csvParse(cleaned, d => ({
    Exam_Score: +String(d.Exam_Score).trim(),
    Sleep_Hours: +String(d.Sleep_Hours).trim(),
    Motivation_Level: String(d.Motivation_Level).trim(),
    Family_Income: String(d.Family_Income).trim(),
    Physical_Activity: String(d.Physical_Activity).trim(),
    Access_to_Resources: String(d.Access_to_Resources).trim(),
    School_Type: String(d.School_Type).trim()
  })).filter(d =>
    !isNaN(d.Exam_Score) &&
    !isNaN(d.Sleep_Hours) &&
    d.Motivation_Level &&
    d.Family_Income &&
    d.Physical_Activity &&
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
  });

  updateChart(data, "Sleep_Group", "all");

  d3.select("#dropdown").on("change", function () {
    const selected = d3.select("#dropdown").property("value");
    const schoolType = d3.select("#dropdown2").property("value");
    updateChart(data, selected, schoolType);
  });

  d3.select("#dropdown2").on("change", function () {
    const selected = d3.select("#dropdown").property("value");
    const schoolType = d3.select("#dropdown2").property("value");
    updateChart(data, selected, schoolType);
  });
});

function updateChart(data, category, schoolType) {
  const filtered = schoolType === "all"
    ? data
    : data.filter(d => d.School_Type === schoolType);

  const grouped = d3.rollup(
    filtered,
    v => d3.mean(v, d => d.Exam_Score),
    d => d[category]
  );

  const newData = Array.from(grouped, ([key, value]) => ({
    category: key,
    Exam_Score: value
  }));

  const x = d3.scaleBand()
    .domain(newData.map(d => d.category))
    .range([0, width])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([50, d3.max(newData, d => d.Exam_Score)])
    .nice()
    .range([height, 0]);

  chart.selectAll("*").remove();

  chart.selectAll("rect")
    .data(newData)
    .join("rect")
    .attr("x", d => x(d.category))
    .attr("y", d => y(d.Exam_Score))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.Exam_Score))
    .attr("fill", "steelblue")
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", "orange");
      tooltip
        .style("display", "block")
        .html(`<strong>${d.category}</strong><br>Avg Score: ${d.Exam_Score.toFixed(2)}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", "steelblue");
      tooltip.style("display", "none");
    });

  chart.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  chart.append("text")
    .attr("x", width / 2)
    .attr("y", height + 45)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(category.replaceAll("_", " "));

  chart.append("g")
    .call(d3.axisLeft(y));

  chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -42)
    .style("font-size", "12px")
    .attr("text-anchor", "middle")
     .style("font-weight", "bold")
    .text("Average Exam Score");
}
