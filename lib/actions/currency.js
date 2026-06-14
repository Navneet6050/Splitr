import { db } from "../db";

export async function getRateForDate(fromCurrency, toCurrency, date) {
  if (!fromCurrency || !toCurrency) throw new Error("Missing currency");
  if (fromCurrency === toCurrency) return { rate: 1, currencyRateId: null };

  const effective = date ? new Date(date) : new Date();

  // Find rate in database
  const rates = await db.currencyRate.findMany({
    where: {
      fromCurrency,
      toCurrency,
      effectiveDate: { lte: effective },
    },
    orderBy: { effectiveDate: "desc" },
    take: 1,
  });

  if (rates.length > 0) {
    return { rate: rates[0].rate, currencyRateId: rates[0].id };
  }

  // Fallback
  if (fromCurrency === "USD" && toCurrency === "INR") {
    return { rate: 83.0, currencyRateId: null };
  }

  throw new Error(
    `No currency rate found for ${fromCurrency}->${toCurrency} as of ${effective.toISOString()}`
  );
}

export async function convertAmount(amount, fromCurrency, toCurrency, date) {
  const { rate, currencyRateId } = await getRateForDate(fromCurrency, toCurrency, date);
  return { rate, convertedAmount: amount * rate, currencyRateId };
}
