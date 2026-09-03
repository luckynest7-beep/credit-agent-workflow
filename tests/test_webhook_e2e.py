#!/usr/bin/env python3
"""
Credit Agent Workflow — End-to-End Integration & Verification Test Suite
"""

import sys
import json
import argparse
from typing import Dict, Any

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass

BASE_URL_PROD = "http://localhost:5678/webhook/credit-agent"
BASE_URL_TEST = "http://localhost:5678/webhook-test/credit-agent"

SAMPLE_PAYLOAD_FULL = {
    "intent": "Recommend loan options, check affordability, check contract clauses, and evaluate prepayment vs investment",
    "business_age": 4,
    "loan_purpose": "Working capital & inventory expansion",
    "amount_needed": 1500000,
    "collateral_available": "Unencumbered commercial shop worth ₹2.5M",
    "owner_category": "MSME General",
    "credit_score": 760,
    "proposed_emi": 35000,
    "principal_remaining": 1200000,
    "interest_rate": 11.5,
    "tenure_remaining_months": 36,
    "lump_sum_available": 400000,
    "expected_investment_return_rate": 12.0,
    "tax_rate": 0.25,
    "emergency_shock_amount": 50000
}

SAMPLE_PAYLOAD_AFFORDABILITY_FASTPATH = {
    "intent": "Check cash flow affordability and stress test proposed EMI",
    "amount_needed": 1000000,
    "proposed_emi": 22000,
    "avg_monthly_income": 450000,
    "avg_monthly_expense": 290000,
    "emergency_shock_amount": 40000
}

SAMPLE_PAYLOAD_PREPAYMENT_FASTPATH = {
    "intent": "Evaluate prepayment vs investment comparison",
    "principal_remaining": 800000,
    "interest_rate": 13.0,
    "tenure_remaining_months": 24,
    "lump_sum_available": 300000,
    "expected_investment_return_rate": 9.5,
    "tax_rate": 0.25
}

def test_webhook(url: str, payload: Dict[str, Any], test_name: str) -> bool:
    print(f"\n=======================================================")
    print(f"Running Test: {test_name}")
    print(f"Target URL:   {url}")
    print(f"Payload Intent: {payload.get('intent', 'N/A')}")
    print(f"-------------------------------------------------------")

    data_bytes = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json", "User-Agent": "CreditAgent-E2E-Tester/1.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            status_code = resp.getcode()
            response_body = resp.read().decode('utf-8')
            print(f"HTTP Status: {status_code}")
            try:
                parsed = json.loads(response_body)
                print(f"Response (JSON):\n{json.dumps(parsed, indent=2)}")
            except Exception:
                print(f"Response (Raw/Markdown):\n{response_body[:500]}...")
            print(f"Result: [PASS] {test_name}")
            return True
    except urllib.error.URLError as e:
        print(f"Network / HTTP Error: {e}")
        print(f"Result: [FAIL] {test_name}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        print(f"Result: [FAIL] {test_name}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Credit Agent E2E Tester")
    parser.add_argument("--test-endpoint", action="store_true", help="Use test webhook URL instead of production")
    parser.add_argument("--fastpath-only", action="store_true", help="Run only fast-path mathematical tests")
    args = parser.parse_args()

    target_url = BASE_URL_TEST if args.test_endpoint else BASE_URL_PROD

    print(f"=== Starting Credit Agent Workflow Verification Suite ===")
    print(f"Target Endpoint: {target_url}")

    results = []
    res_afford = test_webhook(target_url, SAMPLE_PAYLOAD_AFFORDABILITY_FASTPATH, "Branch 2 Fast-Path (Cash Flow Affordability)")
    results.append(("Affordability Fast-Path", res_afford))

    res_prepay = test_webhook(target_url, SAMPLE_PAYLOAD_PREPAYMENT_FASTPATH, "Branch 4 Fast-Path (Prepayment vs Investment)")
    results.append(("Prepayment Fast-Path", res_prepay))

    if not args.fastpath_only:
        res_full = test_webhook(target_url, SAMPLE_PAYLOAD_FULL, "Full 4-Branch Comprehensive Pipeline")
        results.append(("Full 4-Branch Pipeline", res_full))

    print("\n=======================================================")
    print("Test Summary Results:")
    for name, success in results:
        status_str = "PASS" if success else "FAIL / UNREACHABLE"
        print(f"  - {name}: {status_str}")
    print("=======================================================")

if __name__ == "__main__":
    main()
