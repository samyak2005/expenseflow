from prometheus_client import Counter

CLAIMS_SUBMITTED = Counter(
    "expenseflow_claims_submitted",
    "Expense claims submitted, by category",
    ["category"],
)

CLAIM_STATUS_CHANGES = Counter(
    "expenseflow_claim_status_changes",
    "Expense claim review decisions, by new status",
    ["status"],
)
