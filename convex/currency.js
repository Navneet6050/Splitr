// Find the most recent rate <= date for from/to currencies
export async function getRateForDate(ctx, fromCurrency, toCurrency, date) {
    if (!fromCurrency || !toCurrency) throw new Error("Missing currency");
    if (fromCurrency === toCurrency) return { rate: 1, currencyRateId: null };

    const effective = date ?? Date.now();
    const rates = await ctx.db
        .query("currencyRates")
        .withIndex("by_fromCurrency_and_toCurrency_and_effectiveDate", (q) =>
            q.eq("fromCurrency", fromCurrency).eq("toCurrency", toCurrency)
        )
        .order("desc")
        .take(50);

    // choose the most recent rate whose effectiveDate <= effective
    let chosen = null;
    for (const r of rates) {
        if (r.effectiveDate <= effective) {
            chosen = r;
            break;
        }
    }

    if (chosen) return { rate: chosen.rate, currencyRateId: chosen._id };

    // fallback: if converting USD->INR and no rate present, use a pragmatic default
    if (fromCurrency === "USD" && toCurrency === "INR") return { rate: 83, currencyRateId: null };

    throw new Error(`No currency rate found for ${fromCurrency}->${toCurrency} as of ${new Date(effective).toISOString()}`);
}

export async function convertAmount(ctx, amount, fromCurrency, toCurrency, date) {
    const { rate, currencyRateId } = await getRateForDate(ctx, fromCurrency, toCurrency, date);
    return { rate, convertedAmount: amount * rate, currencyRateId };
}

export default { getRateForDate, convertAmount };
