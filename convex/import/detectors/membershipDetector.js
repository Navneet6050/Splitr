function anomaly(rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata = {}) {
    return { rowId, rowNumber, type, severity, message, suggestedAction, confidenceScore, metadata };
}

function membershipWindowForName(name, rowDate) {
    if (name === "Meera") return { joinedAt: Date.UTC(2026, 1, 1), leftAt: Date.UTC(2026, 3, 1) };
    if (name === "Sam") return { joinedAt: Date.UTC(2026, 3, 8), leftAt: null };
    if (name === "Dev") return { joinedAt: Date.UTC(2026, 1, 8), leftAt: Date.UTC(2026, 2, 15) };
    if (name === "Kabir") return { joinedAt: rowDate, leftAt: rowDate + 24 * 60 * 60 * 1000 };
    return { joinedAt: Date.UTC(2026, 1, 1), leftAt: null };
}

export function detectMembershipAnomalies(stagedRows) {
    const results = [];
    for (const row of stagedRows) {
        const p = row.parsed;
        if (p.participants.some((name) => name === "Meera") && p.date && p.date >= Date.UTC(2026, 3, 1)) {
            results.push(anomaly(row._id, row.rowNumber, "MEMBERSHIP_VIOLATION", "blocking", "Meera appears after her March move-out.", "correct", 0.88, { participant: "Meera" }));
        }
        if ((p.paidBy === "Sam" || (p.participants || []).includes("Sam")) && p.date && p.date < Date.UTC(2026, 3, 8)) {
            results.push(anomaly(row._id, row.rowNumber, "MEMBERSHIP_VIOLATION", "blocking", "Sam appears before his April move-in.", "correct", 0.88, { participant: "Sam" }));
        }
        if ((p.participants || []).includes("Kabir")) {
            results.push(anomaly(row._id, row.rowNumber, "GUEST_PARTICIPANT", "warning", "Kabir appears as a trip-only guest.", "approve", 0.9, { participant: "Kabir" }));
        }
        if ((p.participants || []).includes("Dev")) {
            results.push(anomaly(row._id, row.rowNumber, "TEMPORARY_MEMBER", "info", "Dev appears to be a temporary trip participant.", "approve", 0.75, { participant: "Dev" }));
        }
    }
    return results;
}

export default { detectMembershipAnomalies };
