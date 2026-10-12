const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 1500 -> "₹1,500", 1250.5 -> "₹1,250.5", 125000 -> "₹1,25,000". */
export function formatRupees(amount: number): string {
  return rupees.format(amount);
}
