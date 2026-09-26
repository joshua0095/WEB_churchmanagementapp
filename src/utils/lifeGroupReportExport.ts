import type { Borders, Cell, Fill, Worksheet } from "exceljs";

/** One row of the Life Groups monthly report, already bucketed by week (see ReportsLifeGroups). */
export interface LifeGroupExportRow {
  /** LGN letter, e.g. "H". */
  letter: string;
  /** The group's code, e.g. "LG04" — how groups are named in the app. */
  code: string;
  leaderName: string;
  isCommunity: boolean;
  /** Unrounded — the sheet shows up to 2 decimals. */
  average: number;
  actual: number;
  firstTimers: number;
  /** One entry per week of the month; null when the group has no session that week. */
  weekCounts: (number | null)[];
}

// The summary table's column order, as on the church's paper/Sheets report.
const SUMMARY_LETTERS = ["M", "W", "Y", "K", "C", "H"];

const BROWN = "FF7F4F24";
const NAVY = "FF1F3A5F";
const WHITE = "FFFFFFFF";

const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: "FF9AA3B2" } };
const thick = { style: "medium" as const, color: { argb: "FF000000" } };
const allThin: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };

function header(cell: Cell, value: string, fill: string) {
  cell.value = value;
  cell.fill = solid(fill);
  cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = allThin;
}

/** Draws a medium outline around a block, keeping each cell's inner thin borders. */
function outline(ws: Worksheet, top: number, left: number, bottom: number, right: number) {
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        ...allThin,
        ...(r === top && { top: thick }),
        ...(r === bottom && { bottom: thick }),
        ...(c === left && { left: thick }),
        ...(c === right && { right: thick }),
      };
    }
  }
}

/**
 * Builds the LG attendance workbook in the same layout as the church's Sheets report —
 * the per-group table (LGN, code, leader, Average/Actual/First Timer, one column per week
 * under a merged month header) and the per-network summary underneath — and downloads it.
 * exceljs is loaded on demand so it never weighs on the normal page load.
 */
export async function exportLifeGroupReport(rows: LifeGroupExportRow[], monthName: string, year: number, weeksInMonth: number) {
  // The church's template always has Week 1–5; a 4-Sunday month just leaves Week 5 blank.
  const totalWeeks = Math.max(weeksInMonth, 5);
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${monthName} ${year}`, { views: [{ state: "frozen", ySplit: 2 }] });

  // A–C: LGN / code / leader, D: spacer, E–G: totals, H…: weeks.
  const WEEK_COL = 8;
  const lastCol = Math.max(WEEK_COL + totalWeeks - 1, 12); // the summary always needs E–L
  ws.columns = [
    { width: 7 },
    { width: 9 },
    { width: 30 },
    { width: 2 },
    { width: 12 },
    { width: 9 },
    { width: 9 },
    ...Array.from({ length: lastCol - 7 }, () => ({ width: 10 })),
  ];
  ws.getRow(1).height = 20;
  ws.getRow(2).height = 20;

  // Header block — A–C and E–G span both header rows; the month is merged over its weeks.
  (
    [
      [1, "LGN", BROWN],
      [2, "LGN CODE", BROWN],
      [3, "LGL", BROWN],
      [5, "Average", NAVY],
      [6, "Actual", NAVY],
      [7, "First Timer", NAVY],
    ] as const
  ).forEach(([col, label, fill]) => {
    ws.mergeCells(1, col, 2, col);
    header(ws.getCell(1, col), label, fill);
  });
  ws.mergeCells(1, WEEK_COL, 1, WEEK_COL + totalWeeks - 1);
  header(ws.getCell(1, WEEK_COL), monthName.toUpperCase(), NAVY);
  for (let w = 0; w < totalWeeks; w++) {
    const cell = ws.getCell(2, WEEK_COL + w);
    cell.value = `Week ${w + 1}`;
    cell.font = { size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = allThin;
  }

  const firstData = 3;
  rows.forEach((row, i) => {
    const r = firstData + i;
    const leader = row.isCommunity ? `${row.leaderName} (Community)` : row.leaderName;
    const values: [number, string | number | null][] = [
      [1, row.letter],
      [2, row.code],
      [3, leader],
      [5, row.average],
      [6, row.actual],
      [7, row.firstTimers],
      ...row.weekCounts.map((count, w): [number, number | null] => [WEEK_COL + w, count]),
    ];
    for (const [col, value] of values) {
      const cell = ws.getCell(r, col);
      cell.value = value;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: col === 3 ? "left" : "center", vertical: "middle" };
    }
    ws.getCell(r, 5).numFmt = "0.##";
  });
  const lastData = firstData + Math.max(rows.length, 1) - 1;
  outline(ws, 1, 1, lastData, 3);
  outline(ws, 1, 5, lastData, WEEK_COL + totalWeeks - 1);

  // Summary by network, two rows under the table, in E–L.
  const top = lastData + 3;
  header(ws.getCell(top, 5), "", NAVY);
  [...SUMMARY_LETTERS, "TOTAL"].forEach((label, i) => header(ws.getCell(top, 6 + i), label, NAVY));

  const inNetwork = (letter: string) => rows.filter((r) => r.letter === letter);
  const sum = (list: LifeGroupExportRow[], pick: (r: LifeGroupExportRow) => number) =>
    list.reduce((total, r) => total + pick(r), 0);
  const distinctLeaders = (list: LifeGroupExportRow[]) => new Set(list.map((r) => r.leaderName)).size;

  // null = left blank for manual entry (not tracked in the app).
  const summaryRows: [string, ((list: LifeGroupExportRow[]) => number) | null][] = [
    ["LG", (list) => list.length],
    ["LGL", distinctLeaders],
    ["   FF", null],
    ["   T", null],
    ["Members", null],
    ["Attendance", (list) => sum(list, (r) => r.average)],
    ["Actual", (list) => sum(list, (r) => r.actual)],
    ["FT", (list) => sum(list, (r) => r.firstTimers)],
  ];
  summaryRows.forEach(([label, compute], i) => {
    const r = top + 1 + i;
    const labelCell = ws.getCell(r, 5);
    labelCell.value = label; // FF / T keep their leading indent, as on the paper report
    labelCell.font = { size: 10 };
    const columns = [...SUMMARY_LETTERS.map((l) => inNetwork(l)), rows];
    columns.forEach((list, c) => {
      const cell = ws.getCell(r, 6 + c);
      cell.value = compute ? compute(list) : null;
      cell.font = { size: 10, bold: c === columns.length - 1 };
      cell.alignment = { horizontal: "center" };
      cell.numFmt = "0.##";
    });
  });
  outline(ws, top, 5, top + summaryRows.length, 12);

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `LG Attendance - ${monthName} ${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
