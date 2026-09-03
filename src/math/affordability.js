/**
 * Branch 2: Cash Flow Affordability Stress-Testing Engine
 */

function calculateAffordability(data) {
  const proposedEmi = Number(data.proposed_emi) || 0;
  let months = data.statement_months || [];

  if (!Array.isArray(months) || months.length === 0) {
    const avgIncome = Number(data.avg_monthly_income) || (Number(data.amount_needed) ? Number(data.amount_needed) * 0.4 : 500000);
    const avgExpense = Number(data.avg_monthly_expense) || (avgIncome * 0.7);
    months = [
      { month: 'M-1', income: avgIncome * 0.95, expense: avgExpense * 0.98 },
      { month: 'M-2', income: avgIncome * 1.05, expense: avgExpense * 1.02 },
      { month: 'M-3', income: avgIncome * 1.00, expense: avgExpense * 1.00 },
      { month: 'M-4', income: avgIncome * 0.90, expense: avgExpense * 0.95 },
      { month: 'M-5', income: avgIncome * 1.10, expense: avgExpense * 1.05 },
      { month: 'M-6', income: avgIncome * 1.00, expense: avgExpense * 1.00 },
    ];
  }

  const monthlyBreakdown = months.map(m => {
    const inc = Number(m.income) || 0;
    const exp = Number(m.expense) || 0;
    return {
      month: m.month || 'N/A',
      income: inc,
      expense: exp,
      surplus: inc - exp,
    };
  });

  const totalIncome = monthlyBreakdown.reduce((acc, m) => acc + m.income, 0);
  const totalExpense = monthlyBreakdown.reduce((acc, m) => acc + m.expense, 0);
  const totalSurplus = monthlyBreakdown.reduce((acc, m) => acc + m.surplus, 0);

  const n = monthlyBreakdown.length || 1;
  const avgIncome = Math.round(totalIncome / n);
  const avgExpense = Math.round(totalExpense / n);
  const avgSurplus = Math.round(totalSurplus / n);

  const emergencyShockAmount = Number(data.emergency_shock_amount) || 50000;

  const shock20Surplus = Math.round(avgSurplus - (0.20 * avgIncome));
  const shock30Surplus = Math.round(avgSurplus - (0.30 * avgIncome));
  const delaySurplus = Math.round(avgSurplus * 0.70);
  const emergencySurplus = Math.round(avgSurplus - emergencyShockAmount);

  const scenarios = [
    {
      name: 'Baseline Surplus',
      surplus: avgSurplus,
      passed: avgSurplus >= proposedEmi,
      cushion: avgSurplus - proposedEmi,
      description: 'Historical average monthly net surplus',
    },
    {
      name: 'Revenue Shock -20%',
      surplus: shock20Surplus,
      passed: shock20Surplus >= proposedEmi,
      cushion: shock20Surplus - proposedEmi,
      description: '20% drop in monthly turnover',
    },
    {
      name: 'Revenue Shock -30%',
      surplus: shock30Surplus,
      passed: shock30Surplus >= proposedEmi,
      cushion: shock30Surplus - proposedEmi,
      description: '30% catastrophic revenue collapse',
    },
    {
      name: '30-Day Payment Delay',
      surplus: delaySurplus,
      passed: delaySurplus >= proposedEmi,
      cushion: delaySurplus - proposedEmi,
      description: '30% working capital realization delay',
    },
    {
      name: 'Emergency Expense Shock',
      surplus: emergencySurplus,
      passed: emergencySurplus >= proposedEmi,
      cushion: emergencySurplus - proposedEmi,
      description: `One-off unplanned expense of ₹${emergencyShockAmount.toLocaleString('en-IN')}`,
    },
  ];

  const failedTests = scenarios.filter(s => !s.passed);
  const failedCount = failedTests.length;

  let verdict = 'affordable';
  let riskLevel = 'Low';
  let summary = 'The business demonstrates sufficient cash flow cushion to service the proposed EMI across all stress scenarios.';

  if (proposedEmi > avgSurplus || failedCount >= 3) {
    verdict = 'not_affordable';
    riskLevel = 'High';
    summary = `High default risk: Proposed EMI of ₹${proposedEmi.toLocaleString('en-IN')} exceeds sustainable cash flows under stress (${failedCount}/5 shocks failed).`;
  } else if (failedCount >= 1) {
    verdict = 'risky';
    riskLevel = 'Medium';
    summary = `Moderate vulnerability: Proposed EMI of ₹${proposedEmi.toLocaleString('en-IN')} is serviceable in baseline, but vulnerable under ${failedCount} stress shock(s) (${failedTests.map(f => f.name).join(', ')}).`;
  }

  const conservativeCeiling = Math.min(0.60 * avgSurplus, 0.80 * shock20Surplus);
  const suggestedEmiCeiling = Math.max(0, Math.round(conservativeCeiling));
  const dscrProxy = proposedEmi > 0 ? Number((avgSurplus / proposedEmi).toFixed(2)) : 999;

  return {
    verdict,
    risk_level: riskLevel,
    proposed_emi: proposedEmi,
    suggested_emi_ceiling: suggestedEmiCeiling,
    dscr_proxy: dscrProxy,
    summary,
    stress_scenarios: scenarios,
    failed_shock_count: failedCount,
  };
}

module.exports = { calculateAffordability };
