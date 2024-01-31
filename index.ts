const OPERAND_CONST = 0;
const OPERAND_LC = 4;

const commands = `
`;

// ***** main *****
const parsed = parseLogicDump(commands);

// Do operations here
// insert(parsed, 45, 3);
// remove(parsed, 28, 2);
// move(parsed, 7, 1, 26);

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
  return ["-----", "batch start", "logic reset", ...parts, "batch end", "-----"].join("\n");
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
