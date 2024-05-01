// ***** Types *****
interface ILogicRow {
    enabled: number;
    activatorId: number;
    operation: number;
    operandAType: number;
    operandAValue: number;
    operandBType: number;
    operandBValue: number;
    flags: number;

    activatorRefUpdated?: boolean;
    operandARefUpdated?: boolean;
    operandBRefUpdated?: boolean;
}

interface IRange {
    from: number;
    to: number;
}

type CommandsArray = (ILogicRow | null)[];

const OPERAND_CONST = 0;
const OPERAND_LC = 4;

const EMPTY_ROW: ILogicRow = {
    enabled: 0,
    activatorId: -1,
    operation: 0,
    operandAType: 0,
    operandAValue: 0,
    operandBType: 0,
    operandBValue: 0,
    flags: 0,
}

// ***** Actions *****
const commands = `
`;

// ***** main *****
const parsed = parseLogicDump(commands);
const range = findRowsRange(parsed);

// Do operations here
insert(parsed, 5, 1);
// remove(parsed, 4, 1);
// remove(parsed, 2, 1);
// move(parsed, 15, 28, 0);

// console.log(parsed);
console.log(formatLogicDump(parsed, range));

// ***** Parsing *****
function parseLogicRow(
    row: string,
): { index: number; row: ILogicRow } | undefined {
    const parts = row.trim().split(" ");
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

    const keys = Object.keys(rows);
    const length = +keys[keys.length - 1] + 1;

    for (let i = 0; i < length; i++) {
        rows[i] = rows[i] ?? null; // Replace missing elements by nulls
    }

    return rows;
}

function formatLogicDump(rows: CommandsArray, originalRange: IRange, withDisabled = true): string {
    const parts = rows
        .map((row, index) => {
            const format = (index >= originalRange.from && index <= originalRange.to) || (!!row && (row.enabled || withDisabled));
            return format ? formatLogicRow(row ?? EMPTY_ROW, index) : null;
        })
        .filter((r) => r);
    return ["-----", "batch start", "logic reset", ...parts, "batch end", "-----"].join("\n");
}

function findRowsRange(rows: CommandsArray): IRange {
    const from = rows.findIndex(r => r);
    const to = rows.length - [...rows].reverse().findIndex(r => r) - 1;
    return { from, to };
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
        !row.activatorRefUpdated &&
        row.activatorId > -1 &&
        row.activatorId >= fromIndex &&
        (toIndex === undefined || row.activatorId <= toIndex)
    ) {
        if (offset) row.activatorId += offset;
        else {
            console.warn("Deleted activator condition", row);
            row.activatorId = -1;
        }
        row.activatorRefUpdated = true;
    }

    // Shift operand A
    if (
        !row.operandARefUpdated &&
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
        row.operandARefUpdated = true;
    }

    // Shift operand B
    if (
        !row.operandBRefUpdated &&
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
        row.operandBRefUpdated = true;
    }
}

function resetUpdatedState(rows: CommandsArray) {
    rows.forEach((row) => {
        if (row) {
            row.activatorRefUpdated = false;
            row.operandARefUpdated = false;
            row.operandBRefUpdated = false;
        }
    });
}

function insert(
    rows: CommandsArray,
    index: number,
    count: number,
): CommandsArray {
    resetUpdatedState(rows);

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
    resetUpdatedState(rows);

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
    if (offset === 0) return rows;

    resetUpdatedState(rows);

    // Offset refs to moved block
    const to = indexFrom + count - 1;
    rows.forEach((row) => {
        if (row) updateRow(row, offset, indexFrom, to);
    });

    // Offset refs to pushed items
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

    // Cut items
    const cut = rows.splice(indexFrom, count);

    // Extend array, if needed
    if (rows.length < indexTo) {
        const empty = new Array(indexTo - rows.length).fill(null);
        console.log(empty);
        rows.push(...empty);
    }

    // Insert at new place
    rows.splice(indexTo, 0, ...cut);

    return rows;
}
