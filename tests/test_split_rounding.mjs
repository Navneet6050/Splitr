// Simple ESM test runner for split rounding logic
function calculateSplitsEqual(participantCount, convertedAmount) {
    const base = convertedAmount / participantCount;
    return Array.from({ length: participantCount }).map(() => ({ amount: base }));
}

function roundAndAdjust(splitRows, convertedAmount) {
    if (splitRows.length === 0) return [];
    const roundedSplits = [];
    if (splitRows.length === 1) {
        roundedSplits.push({ ...splitRows[0], amount: Number(convertedAmount.toFixed(2)) });
    } else {
        const rawAmounts = splitRows.map((s) => s.amount);
        const rounded = rawAmounts.map((a) => Math.round(a * 100) / 100);
        const sumRounded = rounded.reduce((s, v) => s + v, 0);
        const discrepancy = Math.round((convertedAmount - sumRounded) * 100) / 100;
        rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + discrepancy) * 100) / 100;
        for (let i = 0; i < splitRows.length; i++) {
            roundedSplits.push({ ...splitRows[i], amount: Number(rounded[i].toFixed(2)) });
        }
    }
    return roundedSplits;
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || "Assertion failed");
}

function run() {
    console.log("Running split rounding tests...");

    // Test 1: equal split among 3 for 100
    let convertedAmount = 100;
    let splits = calculateSplitsEqual(3, convertedAmount);
    let rounded = roundAndAdjust(splits, convertedAmount);
    let sum = rounded.reduce((s, r) => s + r.amount, 0);
    assert(sum === 100, `Equal split sum ${sum} != 100`);

    // Test 2: equal split among 3 for 100.01
    convertedAmount = 100.01;
    splits = calculateSplitsEqual(3, convertedAmount);
    rounded = roundAndAdjust(splits, convertedAmount);
    sum = rounded.reduce((s, r) => s + r.amount, 0);
    assert(Math.abs(sum - Number(convertedAmount.toFixed(2))) < 0.001, `Sum mismatch ${sum} vs ${convertedAmount}`);

    // Test 3: shares with non-integer totals
    convertedAmount = 123.45;
    // Build reasonable shares to sum to convertedAmount
    const a = 50.12; const b = 50.23; const c = convertedAmount - a - b;
    splits = [{ amount: a }, { amount: b }, { amount: c }];
    rounded = roundAndAdjust(splits, convertedAmount);
    sum = rounded.reduce((s, r) => s + r.amount, 0);
    assert(Math.abs(sum - Number(convertedAmount.toFixed(2))) < 0.001, `Shares sum mismatch ${sum} vs ${convertedAmount}`);

    // Test 4: single participant
    convertedAmount = 45.678;
    splits = [{ amount: convertedAmount }];
    rounded = roundAndAdjust(splits, convertedAmount);
    sum = rounded.reduce((s, r) => s + r.amount, 0);
    assert(sum === Number(convertedAmount.toFixed(2)), `Single participant mismatch ${sum}`);

    console.log("All split rounding tests passed.");
}

run();
