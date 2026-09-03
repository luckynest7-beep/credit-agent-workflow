/**
 * Report Formatter Module
 */

function formatCreditReport(data) {
  let md = '# Credit Agent Advisory Report\n\n';

  if (data.affordability_verdict) {
    const aff = data.affordability_verdict;
    const verdictBadge = aff.verdict === 'affordable' ? '🟢 **AFFORDABLE**' : (aff.verdict === 'risky' ? '🟡 **RISKY**' : '🔴 **NOT AFFORDABLE**');
    md += `### 📊 Cash Flow Affordability\n- **Verdict:** ${verdictBadge}\n- **Proposed EMI:** ₹${aff.proposed_emi}\n\n`;
  }

  if (data.prepay_vs_invest_comparison) {
    const comp = data.prepay_vs_invest_comparison;
    const tradeoff = comp.tradeoff_analysis || comp;
    md += `### 💰 Prepayment vs. Investment\n- **Recommendation:** ${tradeoff.recommendation}\n\n`;
  }

  return md.trim();
}

module.exports = { formatCreditReport };
