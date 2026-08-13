import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = process.env.MIA_PROJECT_ROOT || process.cwd();
const sourcePath = path.join(root, "data/evaluation/mia-human-calibration-v1.json");
const outputDir = path.join(root, "outputs");
const outputPath = path.join(outputDir, "mia-human-calibration-v1.xlsx");
const previewDir = path.join(outputDir, "mia-human-calibration-previews");

const fixture = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const workbook = Workbook.create();
const notes = workbook.worksheets.add("审核说明");
const samples = workbook.worksheets.add("样本集");
const summary = workbook.worksheets.add("评分汇总");

const navy = "#19324D";
const teal = "#0F766E";
const paleBlue = "#EAF2F8";
const paleTeal = "#E7F6F2";
const paleAmber = "#FFF4D6";
const grid = "#D8E0E8";
const white = "#FFFFFF";

function styleTitle(sheet, range, text) {
  sheet.getRange(range).merge();
  const cell = sheet.getRange(range.split(":")[0]);
  cell.values = [[text]];
  cell.format = { fill: navy, font: { bold: true, color: white, size: 16 }, horizontalAlignment: "left", verticalAlignment: "center" };
  cell.format.rowHeight = 30;
}

function styleHeader(range, fill = teal) {
  range.format = { fill, font: { bold: true, color: white }, wrapText: true, verticalAlignment: "center", borders: { preset: "all", style: "thin", color: grid } };
  range.format.rowHeight = 30;
}

function styleBody(range) {
  range.format = { wrapText: true, verticalAlignment: "top", borders: { preset: "all", style: "thin", color: grid } };
}

// Reviewer instructions and rubric.
notes.showGridLines = false;
styleTitle(notes, "A1:F1", "Mia 人审校准样本集 v1");
notes.getRange("A3:B7").values = [
  ["用途", "校准自动 judge 的回答质量，不用于实时检索或生产提示词。"],
  ["样本版本", fixture.schema_version],
  ["样本来源", fixture.source],
  ["审核策略", fixture.review_policy_version],
  ["审核人填写", "评分、引用正确性、是否应拒答、政策问题、备注、审核人和审核时间"],
];
notes.getRange("A3:A7").format = { fill: paleBlue, font: { bold: true, color: navy } };
notes.getRange("A3:B7").format.borders = { preset: "all", style: "thin", color: grid };
notes.getRange("A3:B7").format.wrapText = true;
notes.getRange("A3:B7").format.rowHeight = 30;

notes.getRange("A10:C10").values = [["评分维度", "范围", "5 分锚点"]];
styleHeader(notes.getRange("A10:C10"));
notes.getRange("A11:C15").values = [
  ["groundedness", "0-5", "所有主要主张均有证据支持"],
  ["citation_correctness", "0-5", "引用 ID 与主张准确对应"],
  ["answer_completeness", "0-5", "回答问题且无重要遗漏"],
  ["uncertainty_calibration", "0-5", "准确表达范围、样本量和限制"],
  ["policy_safety", "0-5", "遵守聚合分析边界并安全处理高风险内容"],
];
styleBody(notes.getRange("A11:C15"));

notes.getRange("A18:B18").values = [["总体分数", "含义"]];
styleHeader(notes.getRange("A18:B18"));
notes.getRange("A19:B24").values = [
  [0, "无支持、误导或不安全"],
  [1, "大部分无依据，仅有偶然相关"],
  [2, "部分有用，但存在重大证据或引用问题"],
  [3, "总体有用，但有明显遗漏或不确定性问题"],
  [4, "有依据且有用，仅有轻微问题"],
  [5, "完全有依据、引用正确、范围适当且安全"],
];
styleBody(notes.getRange("A19:B24"));
notes.getRange("A27:F27").merge();
notes.getRange("A27").values = [["流程：逐条阅读参考证据和模型回答 -> 填写 L:P 五维评分 -> 填写 Q:W 审核字段 -> 在评分汇总查看完成率与均分。human_review 表示发布前必须人工处理。"]];
notes.getRange("A27").format = { fill: paleAmber, font: { color: navy, bold: true }, wrapText: true, verticalAlignment: "center" };
notes.getRange("A27").format.rowHeight = 44;
notes.getRange("A:A").format.columnWidth = 24;
notes.getRange("B:B").format.columnWidth = 48;
notes.getRange("C:C").format.columnWidth = 42;
notes.getRange("D:F").format.columnWidth = 16;

// Editable sample worksheet.
samples.showGridLines = false;
styleTitle(samples, "A1:W1", "Mia 人审校准样本集：请填写蓝绿色输入列");
samples.getRange("A3:W3").merge();
samples.getRange("A3").values = [["灰色列为样本/参考资料，蓝绿色列为审核输入。样本均为合成内容，不含真实客户信息。"]];
samples.getRange("A3").format = { fill: paleAmber, font: { color: navy }, wrapText: true };

const headers = [
  "Case ID", "Language", "Route", "Source Type", "Question", "Reference Evidence IDs", "Reference Answer", "Retrieved Evidence", "Model Answer", "Expected Review Outcome", "Risk Tags",
  "Groundedness (0-5)", "Citation Correctness (0-5)", "Answer Completeness (0-5)", "Uncertainty Calibration (0-5)", "Policy Safety (0-5)", "Overall Score (0-5)", "Citation Correct", "Should Abstain", "Policy Issue", "Reviewer Notes", "Reviewer ID", "Reviewed At"
];
samples.getRange("A5:W5").values = [headers];
styleHeader(samples.getRange("A5:W5"));

const rows = fixture.cases.map((item) => [
  item.case_id,
  item.language,
  item.route,
  item.source_type,
  item.question,
  item.reference_evidence_ids.join(", "),
  item.reference_answer,
  item.retrieved_evidence.map((evidence) => `${evidence.id}: ${evidence.summary}`).join("\n"),
  item.model_answer,
  item.expected_review_outcome,
  item.known_risk_tags.join(", "),
  null, null, null, null, null, null, null, null, null, null, null, null,
]);
samples.getRange(`A6:W${5 + rows.length}`).values = rows;
styleBody(samples.getRange(`A6:W${5 + rows.length}`));
samples.getRange(`L6:W${5 + rows.length}`).format = { fill: paleTeal, wrapText: true, verticalAlignment: "top", borders: { preset: "all", style: "thin", color: grid } };
samples.getRange(`L6:Q${5 + rows.length}`).dataValidation = { rule: { type: "whole", operator: "between", formula1: 0, formula2: 5 } };
samples.getRange(`R6:T${5 + rows.length}`).dataValidation = { rule: { type: "list", values: ["TRUE", "FALSE"] } };
samples.getRange(`V6:V${5 + rows.length}`).dataValidation = { rule: { type: "textLength", operator: "greaterThan", formula1: 0 } };
samples.getRange(`W6:W${5 + rows.length}`).setNumberFormat("yyyy-mm-dd");
samples.getRange(`L6:Q${5 + rows.length}`).setNumberFormat("0.0");
samples.getRange("A:A").format.columnWidth = 14;
samples.getRange("B:D").format.columnWidth = 16;
samples.getRange("E:E").format.columnWidth = 34;
samples.getRange("F:F").format.columnWidth = 28;
samples.getRange("G:G").format.columnWidth = 34;
samples.getRange("H:H").format.columnWidth = 42;
samples.getRange("I:I").format.columnWidth = 38;
samples.getRange("J:K").format.columnWidth = 24;
samples.getRange("L:Q").format.columnWidth = 15;
samples.getRange("R:T").format.columnWidth = 15;
samples.getRange("U:U").format.columnWidth = 32;
samples.getRange("V:W").format.columnWidth = 18;
samples.freezePanes.freezeRows(5);
samples.getRange(`J6:J${5 + rows.length}`).conditionalFormats.add("containsText", { text: "human_review", format: { fill: "#FDE2E1", font: { color: "#9B1C1C", bold: true } } });
samples.getRange(`Q6:Q${5 + rows.length}`).conditionalFormats.add("colorScale", { colors: ["#FDE2E1", "#FFF4D6", "#D8F3DC"] });

// Formula-driven summary.
summary.showGridLines = false;
styleTitle(summary, "A1:F1", "Mia 人审校准评分汇总");
summary.getRange("A3:B8").values = [
  ["指标", "结果"],
  ["样本总数", null],
  ["已完成审核数", null],
  ["完成率", null],
  ["预期需人工审核数", null],
  ["预期直接返回数", null],
];
styleHeader(summary.getRange("A3:B3"));
styleBody(summary.getRange("A4:B8"));
summary.getRange("B4:B8").formulas = [[`=COUNTA('样本集'!A6:A${5 + rows.length})`], [`=COUNT('样本集'!Q6:Q${5 + rows.length})`], ["=IF(B4=0,0,B5/B4)"], [`=COUNTIF('样本集'!J6:J${5 + rows.length},\"human_review\")`], [`=COUNTIF('样本集'!J6:J${5 + rows.length},\"return_cited_response\")`]];
summary.getRange("B6").setNumberFormat("0.0%");
summary.getRange("A11:B17").values = [
  ["人工评分维度", "平均分"],
  ["Groundedness", null],
  ["Citation Correctness", null],
  ["Answer Completeness", null],
  ["Uncertainty Calibration", null],
  ["Policy Safety", null],
  ["Overall Score", null],
];
styleHeader(summary.getRange("A11:B11"), navy);
styleBody(summary.getRange("A12:B17"));
summary.getRange("B12:B17").formulas = [
  [`=IFERROR(AVERAGE('样本集'!L6:L${5 + rows.length}),0)`],
  [`=IFERROR(AVERAGE('样本集'!M6:M${5 + rows.length}),0)`],
  [`=IFERROR(AVERAGE('样本集'!N6:N${5 + rows.length}),0)`],
  [`=IFERROR(AVERAGE('样本集'!O6:O${5 + rows.length}),0)`],
  [`=IFERROR(AVERAGE('样本集'!P6:P${5 + rows.length}),0)`],
  [`=IFERROR(AVERAGE('样本集'!Q6:Q${5 + rows.length}),0)`],
];
summary.getRange("B12:B17").setNumberFormat("0.0");
summary.getRange("A20:F20").merge();
summary.getRange("A20").values = [["填写完成后，本页公式会自动更新。人工评分与自动 judge 分数保持分离，供后续校准分析使用。"]];
summary.getRange("A20").format = { fill: paleAmber, font: { color: navy }, wrapText: true };
summary.getRange("A:A").format.columnWidth = 30;
summary.getRange("B:B").format.columnWidth = 18;
summary.getRange("C:F").format.columnWidth = 16;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

const inspect = await workbook.inspect({ kind: "table", sheetId: "评分汇总", range: "A1:B17", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 4 });
console.log(inspect.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log(errors.ndjson);
for (const sheetName of ["审核说明", "样本集", "评分汇总"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(previewDir, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
}
console.log(`saved ${outputPath}`);
