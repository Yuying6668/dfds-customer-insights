import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(import.meta.dirname, "..");
const outputs = path.join(root, "outputs");
const rawRecords = JSON.parse(
  await fs.readFile(path.join(root, "work", "raw_survey_records.json"), "utf8"),
);

// Python modules cannot be imported by Node; the codebook below is supplied as JSON by build_outputs.
const dictionary = JSON.parse(
  await fs.readFile(path.join(root, "work", "survey_data_dictionary.json"), "utf8"),
);

const titleFormat = {
  fill: "#073B4C",
  font: { bold: true, color: "#FFFFFF", size: 14 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
const noticeFormat = {
  fill: "#FFE5B4",
  font: { bold: true, color: "#7A3400" },
  wrapText: true,
  verticalAlignment: "center",
};
const headerFormat = {
  fill: "#118AB2",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function applySheetFrame(sheet, columnCount, title, notice) {
  const lastColumn = columnLetter(columnCount - 1);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastColumn}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${lastColumn}1`).format = titleFormat;
  sheet.getRange(`A2:${lastColumn}2`).merge();
  sheet.getRange("A2").values = [[notice]];
  sheet.getRange(`A2:${lastColumn}2`).format = noticeFormat;
  sheet.getRange(`A1:${lastColumn}1`).format.rowHeight = 26;
  sheet.getRange(`A2:${lastColumn}2`).format.rowHeight = 38;
}

async function savePreview(workbook, sheetName, range, filename) {
  const preview = await workbook.render({ sheetName, range, scale: 1.5, format: "png" });
  await fs.writeFile(path.join(root, "work", filename), new Uint8Array(await preview.arrayBuffer()));
}

async function makeRawWorkbook() {
  const columns = Object.keys(rawRecords[0]);
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Synthetic raw responses");
  applySheetFrame(
    sheet,
    columns.length,
    "DFDS synthetic survey - 1,500 simulated responses",
    "SYNTHETIC DATA ONLY: simulated survey responses, not real passenger data. Raw records intentionally retain quality defects for curation training.",
  );
  sheet.getRangeByIndexes(2, 0, 1, columns.length).values = [columns];
  sheet.getRangeByIndexes(2, 0, 1, columns.length).format = headerFormat;
  sheet.getRangeByIndexes(3, 0, rawRecords.length, columns.length).values = rawRecords.map((record) =>
    columns.map((column) => {
      const value = record[column];
      return ["completion_seconds", "mot_", "sat_", "overall_satisfaction", "return_intent", "recommend_intent", "competitor_likelihood"].some((key) => column === key || column.startsWith(key)) && /^\d+$/.test(value) ? Number(value) : value;
    }),
  );
  const dataRange = `A3:${columnLetter(columns.length - 1)}${rawRecords.length + 3}`;
  sheet.tables.add(`A3:${columnLetter(columns.length - 1)}${rawRecords.length + 3}`, true, "SyntheticRawResponses");
  sheet.freezePanes.freezeRows(3);
  sheet.getRange(dataRange).format.verticalAlignment = "top";
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const range = sheet.getRange(`${columnLetter(index)}1:${columnLetter(index)}${rawRecords.length + 3}`);
    range.format.columnWidth = column === "synthetic_data_notice" ? 44 :
      column === "response_id" ? 16 :
      column.startsWith("mot_") || column.startsWith("sat_") ? 16 : 24;
  }
  await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(outputs, "dfds_synthetic_raw_survey_1500.xlsx"));
  await savePreview(workbook, "Synthetic raw responses", "A1:AS3", "raw_workbook_preview.png");
}

async function makeDictionaryWorkbook() {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("Data dictionary");
  const columns = ["Field name", "Readable question / label", "Section", "Data type", "Allowed values", "Scale"];
  applySheetFrame(
    sheet,
    columns.length,
    "DFDS synthetic survey data dictionary",
    "SYNTHETIC DATA ONLY: this codebook describes the simulated survey export and is not a real DFDS passenger questionnaire.",
  );
  sheet.getRange("A3:F3").values = [columns];
  sheet.getRange("A3:F3").format = headerFormat;
  sheet.getRangeByIndexes(3, 0, dictionary.length, columns.length).values = dictionary.map((field) => [
    field.name, field.label, field.section, field.type,
    field.options.map((option) => typeof option === "string" ? option : `${option.code}: ${option.label}`).join("; "), field.scale,
  ]);
  sheet.tables.add(`A3:F${dictionary.length + 3}`, true, "SurveyDataDictionary");
  sheet.freezePanes.freezeRows(3);
  sheet.getRange(`A4:F${dictionary.length + 3}`).format.wrapText = true;
  const lastRow = dictionary.length + 3;
  sheet.getRange(`A1:A${lastRow}`).format.columnWidth = 28;
  sheet.getRange(`B1:B${lastRow}`).format.columnWidth = 42;
  sheet.getRange(`C1:C${lastRow}`).format.columnWidth = 26;
  sheet.getRange(`D1:D${lastRow}`).format.columnWidth = 18;
  sheet.getRange(`E1:E${lastRow}`).format.columnWidth = 70;
  sheet.getRange(`F1:F${lastRow}`).format.columnWidth = 18;
  sheet.getRange(`A1:F${dictionary.length + 3}`).format.autofitRows();
  await (await SpreadsheetFile.exportXlsx(workbook)).save(path.join(outputs, "dfds_survey_data_dictionary.xlsx"));
  await savePreview(workbook, "Data dictionary", "A1:F14", "dictionary_workbook_preview.png");
}

await fs.mkdir(outputs, { recursive: true });
await makeRawWorkbook();
await makeDictionaryWorkbook();
