# CreditAgent AI — Autonomous MSME Credit Advisor & Underwriting Pipeline

An n8n-orchestrated agentic system that helps MSME (small business) borrowers evaluate loan options, check affordability, audit contracts for hidden charges, and decide between loan prepayment vs. investing surplus — combining **LLM agents + RAG (Pinecone)** with **deterministic financial engines**, exposed through a **voice-enabled web dashboard**.

Built as a decision-support tool, not a black-box chatbot: every branch either cites its regulatory/scheme source or runs transparent, testable math.

---

## What it does

A single query — typed or spoken — is routed to up to four independent analytical branches, run in parallel, and merged into one advisory report.

| Branch | What it does | How |
|---|---|---|
| **1. Loan Recommender** | Recommends the best-fit loan type/scheme for a business profile | LangChain agent + Pinecone RAG over loan schemes & circulars, citing the specific source for every claim |
| **2. Affordability Stress-Test** | Verdicts a proposed EMI as `affordable` / `risky` / `not_affordable` | Deterministic cash-flow engine that runs 5 stress scenarios (revenue -20%/-30%, 30-day payment delay, emergency expense shock) and computes a suggested EMI ceiling + DSCR-style ratio |
| **3. Contract Auditor** | Flags predatory or non-standard clauses in a sanction letter/loan contract | PDF extraction → LangChain agent + Pinecone RAG over RBI Fair Practices Code, quoting the flagged clause and the regulatory norm it violates |
| **4. Prepayment vs. Investment** | Compares prepaying a loan lump sum vs. investing it | Deterministic amortization simulation (month-by-month, not a closed-form approximation) vs. compounded investment return, both after-tax |

An **intent router** (keyword-matched, extensible) decides which branches a given query actually needs, so a simple "check my EMI affordability" doesn't trigger the RAG agents unnecessarily. A **synchronization barrier** (`Merge Results`) waits only for the branches that were expected to run, tracks per-branch success/failure, and degrades gracefully to a `partial_success` status if one branch errors out.

## Architecture

```
Webhook / Voice UI / Orchestrator sub-workflow
              │
      Set: Business Profile
              │
        Switch Router (intent-based)
   ┌─────┬─────────┬──────────┬─────────┐
   ▼     ▼         ▼          ▼
Loan   Fetch    Extract    Loan Terms
Rec.   Stmt     PDF        Input
(RAG)  → Cash   → Contract → Amortization
       Flow     Auditor    → Prepay vs
       → Stress (RAG)      Invest
       Test
   └─────┴─────────┴──────────┴─────────┘
              │
         Merge Results (sync barrier)
              │
         Format Report
              │
    Detect Trigger Source → Route Response
       (webhook reply / orchestrator status)
```

- **Orchestration:** [n8n](https://n8n.io/) workflow (`credit_agent_workflow.json`) — LangChain agent nodes, Pinecone vector store, Ollama embeddings (`nomic-embed-text`)
- **Deterministic engines:** mirrored as standalone, unit-tested JS modules in `src/` so the core math isn't locked inside n8n
  - `src/math/affordability.js` — stress-testing engine
  - `src/math/prepayment_invest.js` — EMI/amortization + prepay-vs-invest engine
  - `src/barrier/merge_results.js` — branch-readiness / sync logic
  - `src/formatters/report_formatter.js` — Markdown report generation
- **Frontend:** `frontend/` — a voice-enabled dashboard (Web Speech API for mic input + speech synthesis for spoken summaries), with a local deterministic fallback if the n8n webhook is unreachable
- **Tests:** `tests/financial_math.test.js` (Node's built-in test runner) covers the affordability and prepayment engines; `tests/test_webhook_e2e.py` exercises the live webhook end-to-end

## Getting started

```bash
npm install
npm test                 # run the financial-math unit tests
```

To run the full pipeline:
1. Import `credit_agent_workflow.json` into n8n
2. Configure credentials for Pinecone, your LLM provider, and Ollama embeddings
3. Activate the workflow (exposes `POST /webhook/credit-agent`)
4. Open `frontend/index.html` to use the voice dashboard, or run `tests/test_webhook_e2e.py` against it directly

## Status

This is a working prototype, not production-hardened. In particular:
- Intent routing is keyword-based (v1) — a good candidate to swap for LLM-based intent classification
- The webhook has no auth layer yet — add one before exposing it beyond localhost
- Bank statement ingestion (`Fetch Bank Statement`) is stubbed against a placeholder endpoint pending a real statement-parsing integration

## License

MIT
