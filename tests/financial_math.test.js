const test = require('node:test');
const assert = require('node:assert');

const { calculateAffordability } = require('../src/math/affordability');
const { calculateEmi, simulateAmortization, calculatePrepaymentVsInvest } = require('../src/math/prepayment_invest');
const { mergeResults } = require('../src/barrier/merge_results');
const { formatCreditReport } = require('../src/formatters/report_formatter');

test('Affordability Engine: Strong cash flows (0 shocks failed) produce affordable verdict', () => {
  const data = {
    proposed_emi: 25000,
    avg_monthly_income: 500000,
    avg_monthly_expense: 300000,
    emergency_shock_amount: 50000,
  };

  const result = calculateAffordability(data);

  assert.strictEqual(result.verdict, 'affordable');
  assert.strictEqual(result.risk_level, 'Low');
  assert.strictEqual(result.failed_shock_count, 0);
  assert.ok(result.suggested_emi_ceiling >= result.proposed_emi);
  assert.strictEqual(result.stress_scenarios.length, 5);
});

test('Affordability Engine: Moderate vulnerability (1-2 shocks failed) produces risky verdict', () => {
  const data = {
    proposed_emi: 25000,
    avg_monthly_income: 500000,
    avg_monthly_expense: 350000,
    emergency_shock_amount: 50000,
  };

  const result = calculateAffordability(data);

  assert.strictEqual(result.verdict, 'risky');
  assert.strictEqual(result.risk_level, 'Medium');
  assert.strictEqual(result.failed_shock_count, 1);
});

test('Affordability Engine: High default risk (>=3 shocks failed or proposed EMI > surplus) produces not_affordable', () => {
  const data = {
    proposed_emi: 60000,
    avg_monthly_income: 500000,
    avg_monthly_expense: 400000,
  };

  const result = calculateAffordability(data);

  assert.strictEqual(result.verdict, 'not_affordable');
  assert.strictEqual(result.risk_level, 'High');
  assert.ok(result.failed_shock_count >= 3);
});

test('Amortization & EMI: 0% interest rate handled cleanly (no division by zero)', () => {
  const emi = calculateEmi(120000, 0, 12);
  assert.strictEqual(emi, 10000);
});

test('Amortization & Prepayment: Standard MSME loan reduces interest and tenure', () => {
  const data = {
    principal_remaining: 1000000,
    interest_rate: 12.0,
    tenure_remaining_months: 36,
    lump_sum_available: 300000,
    expected_investment_return_rate: 10.0,
    tax_rate: 0.25,
    investment_tax_rate: 0.125,
  };

  const result = calculatePrepaymentVsInvest(data);

  assert.ok(result.loan_baseline.monthly_emi > 30000);
  assert.ok(result.prepayment_scenario.gross_interest_saved > 0);
  assert.ok(result.prepayment_scenario.tenure_saved_months > 0);
  assert.ok(result.prepayment_scenario.after_tax_interest_saved > 0);
  assert.ok(result.investment_scenario.gross_gain > 0);
  assert.ok(result.tradeoff_analysis.recommendation.length > 0);
});

test('Prepayment vs Invest: Full prepayment closes loan immediately', () => {
  const data = {
    principal_remaining: 500000,
    interest_rate: 10.0,
    tenure_remaining_months: 24,
    lump_sum_available: 600000,
  };

  const result = calculatePrepaymentVsInvest(data);
  assert.strictEqual(result.prepayment_scenario.tenure_saved_months, 24);
  assert.strictEqual(result.prepayment_scenario.new_tenure_months, 0);
  assert.strictEqual(result.prepayment_scenario.new_total_interest, 0);
});

test('Resilient Barrier: Successfully merges all 4 completed branches', () => {
  const mockContext = new Map([
    ['Set: Business Profile', { json: { intent: 'Recommend loan options, check affordability, check contract clauses, and evaluate prepayment vs investment' } }],
    ['AI Agent: Loan Recommender', { json: { output: 'Recommended: CGTMSE Collateral-Free Term Loan.' } }],
    ['Code: Stress Scenarios', { json: { affordability_verdict: { verdict: 'affordable', proposed_emi: 25000 } } }],
    ['AI Agent: Contract Checker', { json: { output: 'No predatory clauses flagged.' } }],
    ['Code: Compare to Invest', { json: { prepay_vs_invest_comparison: { recommendation: 'Prepay loan' } } }],
  ]);

  const output = mergeResults(mockContext);
  assert.strictEqual(output.length, 1);
  assert.strictEqual(output[0].json.meta.branches_executed.length, 4);
  assert.strictEqual(output[0].json.meta.all_expected_succeeded, true);
});

test('Resilient Barrier: Gracefully handles failed/errored branch without stalling', () => {
  const mockContext = new Map([
    ['Set: Business Profile', { json: { intent: 'Check affordability and check contract' } }],
    ['Code: Stress Scenarios', { json: { affordability_verdict: { verdict: 'risky' } } }],
    ['AI Agent: Contract Checker', { json: { error: { message: 'Pinecone gateway timeout' } } }],
  ]);

  const output = mergeResults(mockContext);
  assert.strictEqual(output.length, 1);
  assert.strictEqual(output[0].json.meta.branch_status.branch_2_affordability, 'completed');
  assert.strictEqual(output[0].json.meta.branch_status.branch_3_contract_audit, 'failed');
  assert.strictEqual(output[0].json.meta.all_expected_succeeded, false);
});

test('Report Formatter: Generates clean markdown with table and badges', () => {
  const reportData = {
    affordability_verdict: {
      verdict: 'affordable',
      proposed_emi: 25000,
      suggested_emi_ceiling: 40000,
      stress_scenarios: [
        { name: 'Baseline', surplus: 150000, passed: true, cushion: 125000 },
      ],
    },
    prepay_vs_invest_comparison: {
      lump_sum_amount: 300000,
      prepayment: { interest_saved_guaranteed: 105000, tenure_reduced_months: 12 },
      investment: { projected_investment_gain: 90000 },
      tradeoff_analysis: { recommendation: 'Prepay loan' },
    },
    meta: { branches_executed: ['branch_2_affordability', 'branch_4_prepayment_invest'] },
  };

  const md = formatCreditReport(reportData);
  assert.ok(md.includes('# Credit Agent Advisory Report'));
  assert.ok(md.includes('🟢 **AFFORDABLE**'));
  assert.ok(md.includes('Prepay loan'));
});
