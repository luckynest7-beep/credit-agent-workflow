/**
 * Resilient State Synchronization Barrier Module
 */

function mergeResults(context) {
  let intentText = '';
  try {
    intentText = context.get('Set: Business Profile')?.json?.intent || '';
  } catch (e) {}

  const intentLower = (intentText || '').toLowerCase();
  const isBroadIntent = !intentLower || intentLower.includes('all') || intentLower.includes('comprehensive');

  const expectB1 = isBroadIntent || ['recommend', 'loan', 'option', 'best', 'scheme'].some(k => intentLower.includes(k));
  const expectB2 = isBroadIntent || ['afford', 'emi', 'cash flow', 'stress'].some(k => intentLower.includes(k));
  const expectB3 = isBroadIntent || ['contract', 'sanction', 'clause', 'charge'].some(k => intentLower.includes(k));
  const expectB4 = isBroadIntent || ['prepay', 'invest', 'lump', 'amortization'].some(k => intentLower.includes(k));

  let f1Node = null;
  let f2Node = null;
  let f3Node = null;
  let f4Node = null;

  try { f1Node = context.get('AI Agent: Loan Recommender')?.json; } catch (e) {}
  try { f2Node = context.get('Code: Stress Scenarios')?.json; } catch (e) {}
  try { f3Node = context.get('AI Agent: Contract Checker')?.json; } catch (e) {}
  try { f4Node = context.get('Code: Compare to Invest')?.json; } catch (e) {}

  const b1Ready = !expectB1 || !!f1Node;
  const b2Ready = !expectB2 || !!f2Node;
  const b3Ready = !expectB3 || !!f3Node;
  const b4Ready = !expectB4 || !!f4Node;

  if (!b1Ready || !b2Ready || !b3Ready || !b4Ready) {
    return [];
  }

  let loanRec = null;
  let b1Status = 'skipped';
  if (expectB1) {
    if (f1Node) {
      if (f1Node.error) {
        b1Status = 'failed';
        loanRec = { error: f1Node.error.message || 'Error' };
      } else {
        b1Status = 'completed';
        loanRec = f1Node.output || f1Node;
      }
    }
  }

  let affordability = null;
  let b2Status = 'skipped';
  if (expectB2) {
    if (f2Node) {
      if (f2Node.error) {
        b2Status = 'failed';
        affordability = { error: f2Node.error.message || 'Error' };
      } else {
        b2Status = 'completed';
        affordability = f2Node.affordability_verdict || f2Node;
      }
    }
  }

  let flaggedClauses = null;
  let b3Status = 'skipped';
  if (expectB3) {
    if (f3Node) {
      if (f3Node.error) {
        b3Status = 'failed';
        flaggedClauses = { error: f3Node.error.message || 'Error' };
      } else {
        b3Status = 'completed';
        flaggedClauses = f3Node.output || f3Node;
      }
    }
  }

  let prepayVsInvest = null;
  let b4Status = 'skipped';
  if (expectB4) {
    if (f4Node) {
      if (f4Node.error) {
        b4Status = 'failed';
        prepayVsInvest = { error: f4Node.error.message || 'Error' };
      } else {
        b4Status = 'completed';
        prepayVsInvest = f4Node.prepay_vs_invest_comparison || f4Node;
      }
    }
  }

  const branchStatus = {
    branch_1_loan_recommender: b1Status,
    branch_2_affordability: b2Status,
    branch_3_contract_audit: b3Status,
    branch_4_prepayment_invest: b4Status,
  };

  const branchesExecuted = Object.keys(branchStatus).filter(k => branchStatus[k] === 'completed');
  const branchesFailed = Object.keys(branchStatus).filter(k => branchStatus[k] === 'failed');

  return [{
    json: {
      loan_recommendation: loanRec,
      affordability_verdict: affordability,
      flagged_clauses: flaggedClauses,
      prepay_vs_invest_comparison: prepayVsInvest,
      meta: {
        branch_status: branchStatus,
        branches_executed: branchesExecuted,
        branches_failed: branchesFailed,
        all_expected_succeeded: branchesFailed.length === 0,
      }
    }
  }];
}

module.exports = { mergeResults };
