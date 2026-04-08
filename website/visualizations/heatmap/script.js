const margin = { top: 70, right: 120, bottom: 80, left: 90 };
const width = 820 - margin.left - margin.right;
const height = 520 - margin.top - margin.bottom;

const svg = d3.select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

const chartGroup = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

const schoolFilter = d3.select("#schoolFilter");
const metricFilter = d3.select("#metricFilter");

// fixed domains so layout stays stable
const hoursValues = d3.range(1, 45);   // 1–44
const sleepValues = d3.range(4, 11);   // 4–10

const xScale = d3.scaleBand()
  .domain(hoursValues)
  .range([0, width])
  .padding(0.05);

const yScale = d3.scaleBand()
  .domain(sleepValues)
  .range([height, 0])
  .padding(0.05);

// axes groups
chartGroup.append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0,${height})`);

chartGroup.append("g")
  .attr("class", "y-axis");

// axis labels
chartGroup.append("text")
  .attr("class", "axis-label")
  .attr("x", width / 2)
  .attr("y", height + 55)
  .attr("text-anchor", "middle")
  .text("Hours Studied");

chartGroup.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -55)
  .attr("text-anchor", "middle")
  .text("Sleep Hours");

// chart title
chartGroup.append("text")
  .attr("class", "chart-title")
  .attr("x", width / 2)
  .attr("y", -30)
  .attr("text-anchor", "middle")
  .text("Average Exam Score by Study Hours and Sleep");

// legend
const legendGroup = svg.append("g")
  .attr("transform", `translate(${width + margin.left + 35}, ${margin.top + 40})`);

const legendTitle = legendGroup.append("text")
  .attr("class", "legend-title")
  .attr("x", 0)
  .attr("y", -10);

const legendScaleY = d3.scaleLinear().range([160, 0]);

const legendAxisGroup = legendGroup.append("g")
  .attr("transform", "translate(22,0)");

const defs = svg.append("defs");
const linearGradient = defs.append("linearGradient")
  .attr("id", "legend-gradient")
  .attr("x1", "0%")
  .attr("y1", "100%")
  .attr("x2", "0%")
  .attr("y2", "0%");

legendGroup.append("rect")
  .attr("width", 22)
  .attr("height", 160)
  .style("stroke", "#999");

// load CSV as text, skip first line, then parse
d3.text("student_performance.csv").then(raw => {
  const cleaned = raw.trim().split("\n").slice(1).join("\n");

  const data = d3.csvParse(cleaned, d => ({
    Hours_Studied: +d.Hours_Studied,
    Sleep_Hours: +d.Sleep_Hours,
    Exam_Score: +d.Exam_Score,
    School_Type: d.School_Type
  })).filter(d =>
    !isNaN(d.Hours_Studied) &&
    !isNaN(d.Sleep_Hours) &&
    !isNaN(d.Exam_Score) &&
    d.School_Type
  );

  console.log("Loaded rows:", data.length);
  console.log("Sample row:", data[0]);

  function updateChart() {
    const selectedSchool = schoolFilter.property("value");
    const selectedMetric = metricFilter.property("value");

    let filteredData = data;
    if (selectedSchool !== "All") {
      filteredData = data.filter(d => d.School_Type === selectedSchool);
    }

    const grouped = d3.rollups(
      filteredData,
      values => ({
        avg_score: d3.mean(values, d => d.Exam_Score),
        count: values.length
      }),
      d => d.Hours_Studied,
      d => d.Sleep_Hours
    );

    const cellData = [];

    hoursValues.forEach(hour => {
      sleepValues.forEach(sleep => {
        const hourGroup = grouped.find(g => +g[0] === hour);
        const sleepGroup = hourGroup ? hourGroup[1].find(s => +s[0] === sleep) : null;

        cellData.push({
          Hours_Studied: hour,
          Sleep_Hours: sleep,
          avg_score: sleepGroup ? sleepGroup[1].avg_score : null,
          count: sleepGroup ? sleepGroup[1].count : 0
        });
      });
    });

    const valueKey = selectedMetric;
    const validValues = cellData
      .map(d => d[valueKey])
      .filter(v => v !== null && !isNaN(v) && v > 0);

    const minValue = d3.min(validValues);
    const maxValue = d3.max(validValues);

    const colorScale = d3.scaleSequential()
      .domain([minValue, maxValue])
      .interpolator(d3.interpolateYlOrRd);

    chartGroup.select(".x-axis")
      .call(d3.axisBottom(xScale).tickValues(hoursValues.filter(d => d % 2 === 0)));

    chartGroup.select(".y-axis")
      .call(d3.axisLeft(yScale));

    chartGroup.select(".chart-title")
      .text(
        selectedMetric === "avg_score"
          ? "Average Exam Score by Study Hours and Sleep"
          : "Student Count by Study Hours and Sleep"
      );

    legendTitle.text(selectedMetric === "avg_score" ? "Avg Score" : "Count");

    legendScaleY.domain([minValue, maxValue]);

    linearGradient.selectAll("stop").remove();

    d3.range(0, 1.01, 0.1).forEach(t => {
      linearGradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(minValue + t * (maxValue - minValue)));
    });

    legendGroup.select("rect")
      .style("fill", "url(#legend-gradient)");

    legendAxisGroup.call(d3.axisRight(legendScaleY).ticks(6));

    const cells = chartGroup.selectAll(".cell")
      .data(cellData, d => `${d.Hours_Studied}-${d.Sleep_Hours}`);

    cells.enter()
      .append("rect")
      .attr("class", "cell")
      .attr("x", d => xScale(d.Hours_Studied))
      .attr("y", d => yScale(d.Sleep_Hours))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.6)
      .merge(cells)
      .transition()
      .duration(500)
      .attr("x", d => xScale(d.Hours_Studied))
      .attr("y", d => yScale(d.Sleep_Hours))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", d => {
        if (selectedMetric === "avg_score") {
          return d.avg_score !== null ? colorScale(d.avg_score) : "#eeeeee";
        } else {
          return d.count > 0 ? colorScale(d.count) : "#eeeeee";
        }
      });

    cells.exit().remove();

    chartGroup.selectAll(".cell")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke", "#222")
          .attr("stroke-width", 1.5);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>Hours Studied:</strong> ${d.Hours_Studied}<br>
            <strong>Sleep Hours:</strong> ${d.Sleep_Hours}<br>
            <strong>Average Exam Score:</strong> ${d.avg_score !== null ? d.avg_score.toFixed(2) : "No data"}<br>
            <strong>Student Count:</strong> ${d.count}
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 14) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 0.6);

        tooltip.style("opacity", 0);
      });
  }

  updateChart();
  schoolFilter.on("change", updateChart);
  metricFilter.on("change", updateChart);

}).catch(error => {
  console.error("Error loading or parsing CSV:", error);
});