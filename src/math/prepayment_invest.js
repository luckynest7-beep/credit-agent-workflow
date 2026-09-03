/**
 * Branch 4: Prepayment vs. Investment Opportunity Cost Engine
 */

function calculateEmi(principal, annualRate, tenureMonths) {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = annualRate / (12 * 100);
  if (r === 0) {
    return Math.round(principal / tenureMonths);
  }
  const factor = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * factor) / (factor - 1);
  return Math.round(emi);
}

function simulateAmortization(principal, annualRate, emi) {
  const r = annualRate / (12 * 100);
  let balance = principal;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 600;

  while (balance > 1 && months < maxMonths) {
    months++;
    const interest = r > 0 ? balance * r : 0;
    const principalPaid = Math.min(balance, emi - interest);
    totalInterest += interest;
    balance -= principalPaid;
    if (principalPaid <= 0 && balance > 0) break;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest),
    finalBalance: Math.max(0, Math.round(balance)),
  };
}

function calculatePrepaymentVsInvest(data) {
  const principal = Number(data.principal_remaining || data.amount_needed) || 1000000;
  const annualRate = Number(data.interest_rate) || 12.0;
  const tenureMonths = Number(data.tenure_remaining_months) || 36;
  const lumpSum = Number(data.lump_sum_available) || 300000;
  const expectedInvestRate = Number(data.expected_investment_return_rate) || 10.0;
  const businessTaxRate = data.tax_rate !== undefined ? Number(data.tax_rate) : 0.25;
  const investmentTaxRate = data.investment_tax_rate !== undefined ? Number(data.investment_tax_rate) : 0.125;

  const tenureYears = tenureMonths / 12;

  const baselineEmi = calculateEmi(principal, annualRate, tenureMonths);
  const baselineSim = simulateAmortization(principal, annualRate, baselineEmi);
  const baselineTotalInterest = baselineSim.totalInterest;

  const effectivePrepay = Math.min(principal, lumpSum);
  const newPrincipal = Math.max(0, principal - effectivePrepay);

  let prepaySim;
  let interestSaved = 0;
  let tenureReducedMonths = 0;

  if (newPrincipal <= 0) {
    prepaySim = { months: 0, totalInterest: 0, finalBalance: 0 };
    interestSaved = baselineTotalInterest;
    tenureReducedMonths = tenureMonths;
  } else {
    prepaySim = simulateAmortization(newPrincipal, annualRate, baselineEmi);
    interestSaved = Math.max(0, baselineTotalInterest - prepaySim.totalInterest);
    tenureReducedMonths = Math.max(0, tenureMonths - prepaySim.months);
  }

  const afterTaxInterestSaved = Math.round(interestSaved * (1 - businessTaxRate));
  const futureValueGross = Math.round(lumpSum * Math.pow(1 + expectedInvestRate / 100, tenureYears));
  const grossInvestmentGain = Math.max(0, futureValueGross - lumpSum);
  const afterTaxInvestmentGain = Math.round(grossInvestmentGain * (1 - investmentTaxRate));

  const netAdvantagePrepay = afterTaxInterestSaved - afterTaxInvestmentGain;

  let recommendation = '';
  if (afterTaxInterestSaved > afterTaxInvestmentGain) {
    recommendation = `Prepay Loan: Guaranteed after-tax interest savings of ₹${afterTaxInterestSaved.toLocaleString('en-IN')} exceed projected investment gains by ₹${netAdvantagePrepay.toLocaleString('en-IN')}.`;
  } else {
    const netAdvantageInvest = afterTaxInvestmentGain - afterTaxInterestSaved;
    recommendation = `Invest Surplus: Projected after-tax returns of ₹${afterTaxInvestmentGain.toLocaleString('en-IN')} exceed net interest savings by ₹${netAdvantageInvest.toLocaleString('en-IN')}.`;
  }

  return {
    loan_baseline: {
      monthly_emi: baselineEmi,
      total_interest: baselineTotalInterest,
    },
    prepayment_scenario: {
      lump_sum_applied: effectivePrepay,
      new_tenure_months: prepaySim.months,
      tenure_saved_months: tenureReducedMonths,
      gross_interest_saved: interestSaved,
      after_tax_interest_saved: afterTaxInterestSaved,
      new_total_interest: prepaySim.totalInterest,
    },
    investment_scenario: {
      initial_investment: lumpSum,
      gross_gain: grossInvestmentGain,
      after_tax_gain: afterTaxInvestmentGain,
    },
    tradeoff_analysis: {
      recommendation,
    },
  };
}

module.exports = { calculateEmi, simulateAmortization, calculatePrepaymentVsInvest };
