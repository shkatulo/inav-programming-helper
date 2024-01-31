const OPERAND_CONST = 0;
const OPERAND_LC = 4;

const commands = `
logic 0 1 -1 1 2 31 0 0 0
logic 1 1 -1 1 2 31 0 1 0
logic 2 1 -1 1 3 0 0 1 0
logic 3 1 -1 6 1 10 0 0 0
logic 4 1 -1 7 4 0 4 2 0
logic 5 1 -1 8 4 3 4 4 0
logic 6 1 -1 12 4 5 0 0 0
logic 7 1 -1 7 4 1 4 2 0
logic 8 1 -1 3 2 12 0 3000 0
logic 9 1 -1 12 4 8 0 0 0
logic 10 1 -1 7 4 5 4 8 0
logic 11 1 -1 7 4 5 4 9 0
logic 15 1 -1 16 2 90 0 1000000 0
logic 16 1 -1 16 2 91 0 1000000 0
logic 17 1 1 18 0 0 4 15 0
logic 18 1 1 18 0 1 4 16 0
logic 19 1 -1 17 5 0 0 100000 0
logic 20 1 -1 17 5 1 0 100000 0
logic 21 1 6 18 0 2 1 4 0
logic 30 1 7 38 0 6 0 2000 0
logic 32 1 5 38 0 5 0 1400 0
logic 33 1 10 38 0 4 0 2000 0
logic 34 1 11 38 0 4 5 2 0
logic 36 1 -1 7 4 5 4 19 0
logic 37 1 36 90 5 0 5 1 0
logic 38 1 36 15 4 37 2 40 0
logic 39 1 36 34 4 38 0 10 0
logic 40 1 36 33 4 38 0 10 0
logic 41 1 36 45 0 1 4 39 0
logic 42 1 36 45 0 0 4 40 0
`;

// ***** main *****
const parsed = parseLogicDump(commands);

// Do operations here
// insert(parsed, 0, 5);
// remove(parsed, 12, 3);
// move(parsed, 0, 12, 60);

// console.log(parsed);
console.log(formatLogicDump(parsed));

// ***** Parsing *****
interface ILogicRow {
  enabled: number;
  activatorId: number;
  operation: number;
  operandAType: number;
  operandAValue: number;
  operandBType: number;
  operandBValue: number;
  flags: number;
}

type CommandsArray = (ILogicRow | null)[];

function parseLogicRow(
  row: string,
): { index: number; row: ILogicRow } | undefined {
  const parts = row.split(" ");
  if (parts.length !== 10 || parts[0] !== "logic") return;
  return {
    index: +parts[1],
    row: {
      enabled: +parts[2],
      activatorId: +parts[3],
      operation: +parts[4],
      operandAType: +parts[5],
      operandAValue: +parts[6],
      operandBType: +parts[7],
      operandBValue: +parts[8],
      flags: +parts[9],
    },
  };
}

function formatLogicRow(row: ILogicRow, index: number): string {
  return (
    `logic ${index} ${row.enabled} ${row.activatorId} ${row.operation} ` +
    `${row.operandAType} ${row.operandAValue} ${row.operandBType} ${row.operandBValue} ${row.flags}`
  );
}

function parseLogicDump(dump: string): CommandsArray {
  const rows: CommandsArray = [];

  const parts = dump.split("\n");
  parts.map((part) => {
    const { row, index } = parseLogicRow(part) ?? {};
    if (row && index !== undefined) rows[index] = row;
  });

  for (let i = 0; i < parts.length; i++) {
    rows[i] = rows[i] ?? null; // Replace missing elements by nulls
  }

  return rows;
}

function formatLogicDump(rows: CommandsArray): string {
  const parts = rows
    .map((row, index) => (row ? formatLogicRow(row, index) : null))
    .filter((r) => r);
  return ["-----", "logic reset", ...parts, "-----"].join("\n");
}

// ***** Operations *****
function updateRow(
  row: ILogicRow,
  offset: number,
  fromIndex: number,
  toIndex?: number,
) {
  // Shift activator
  if (
    row.activatorId > -1 &&
    row.activatorId >= fromIndex &&
    (toIndex === undefined || row.activatorId <= toIndex)
  ) {
    if (offset) row.activatorId += offset;
    else {
      console.warn("Deleted activator condition", row);
      row.activatorId = -1;
    }
  }

  // Shift operand A
  if (
    row.operandAType === OPERAND_LC &&
    row.operandAValue >= fromIndex &&
    (toIndex === undefined || row.operandAValue <= toIndex)
  ) {
    if (offset) row.operandAValue += offset;
    else {
      console.warn("Deleted operand A reference", row);
      row.operandAType = OPERAND_CONST;
      row.operandAValue = -111111;
    }
  }

  // Shift operand B
  if (
    row.operandBType === OPERAND_LC &&
    row.operandBValue >= fromIndex &&
    (toIndex === undefined || row.operandBValue <= toIndex)
  ) {
    if (offset) row.operandBValue += offset;
    else {
      console.warn("Deleted operand B reference", row);
      row.operandBType = OPERAND_CONST;
      row.operandBValue = -111111;
    }
  }
}

function insert(
  rows: CommandsArray,
  index: number,
  count: number,
): CommandsArray {
  // Offset refs
  rows.forEach((row) => {
    if (row) updateRow(row, count, index);
  });

  // Insert
  rows.splice(index, 0, ...new Array(count).fill(null));

  return rows;
}

function remove(
  rows: CommandsArray,
  index: number,
  count: number,
): CommandsArray {
  // Remove refs
  const to = index + count - 1;
  rows.forEach((row) => {
    if (row) updateRow(row, 0, index, to);
  });

  // Offset refs
  const fr = index + count;
  rows.forEach((row) => {
    if (row) updateRow(row, -count, fr);
  });

  // Remove
  rows.splice(index, count);

  return rows;
}

function move(
  rows: CommandsArray,
  indexFrom: number,
  count: number,
  indexTo: number,
): CommandsArray {
  const offset = indexTo - indexFrom;

  // Offset refs to moved block
  let to = indexFrom + count - 1;
  rows.forEach((row) => {
    if (row) updateRow(row, offset, indexFrom, to);
  });

  // Offset refs to pulled items
  if (offset > 0) {
    const fr = indexFrom + count;
    const to = fr + offset - 1;
    rows.forEach((row) => {
      if (row) updateRow(row, -count, fr, to);
    });
  } else {
    const fr = indexFrom + offset;
    const to = indexFrom - 1;
    rows.forEach((row) => {
      if (row) updateRow(row, count, fr, to);
    });
  }

  // Extend array, if needed
  if (rows.length < indexTo) {
    const empty = new Array(indexTo - rows.length).fill(null);
    rows.push(...empty);
  }

  // Cut items
  const cut = rows.splice(indexFrom, count);

  // Insert at new place
  to = offset > 0 ? indexTo - count : indexTo;
  rows.splice(to, 0, ...cut);

  return rows;
}
