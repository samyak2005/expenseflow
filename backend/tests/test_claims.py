from datetime import date, timedelta


def test_new_claim_starts_pending(make_claim):
    claim = make_claim(amount=1234.5)
    assert claim["status"] == "PENDING"
    assert claim["amount"] == 1234.5
    assert claim["id"] > 0


def test_amount_must_be_positive(client):
    response = client.post(
        "/api/claims",
        json={
            "employee_name": "Asha Rao",
            "department": "HR",
            "title": "Negative test",
            "category": "OTHER",
            "amount": -10,
            "expense_date": date.today().isoformat(),
        },
    )
    assert response.status_code == 422


def test_expense_date_cannot_be_in_the_future(client):
    next_week = (date.today() + timedelta(days=7)).isoformat()
    response = client.post(
        "/api/claims",
        json={
            "employee_name": "Asha Rao",
            "department": "HR",
            "title": "Time travel",
            "category": "TRAVEL",
            "amount": 100,
            "expense_date": next_week,
        },
    )
    assert response.status_code == 422
    assert "future" in response.text


def test_unknown_category_is_rejected(client, make_claim):
    response = client.post(
        "/api/claims",
        json={
            "employee_name": "Asha Rao",
            "department": "HR",
            "title": "Spa day",
            "category": "LUXURY",
            "amount": 100,
            "expense_date": date.today().isoformat(),
        },
    )
    assert response.status_code == 422


def test_list_filters_by_status_and_department(client, make_claim):
    make_claim(department="SALES")
    make_claim(department="ENGINEERING")
    approved = make_claim(department="SALES")
    client.patch(f"/api/claims/{approved['id']}/status", json={"status": "APPROVED"})

    sales = client.get("/api/claims", params={"department": "SALES"}).json()
    assert len(sales) == 2

    pending_sales = client.get(
        "/api/claims", params={"department": "SALES", "status": "PENDING"}
    ).json()
    assert len(pending_sales) == 1


def test_search_matches_title_or_employee(client, make_claim):
    make_claim(employee_name="Ravi Kumar", title="Taxi to airport")
    make_claim(employee_name="Neha Gupta", title="Laptop stand")

    assert [c["employee_name"] for c in client.get("/api/claims?q=ravi").json()] == ["Ravi Kumar"]
    assert [c["title"] for c in client.get("/api/claims?q=laptop").json()] == ["Laptop stand"]


def test_get_one_claim_and_missing_claim(client, make_claim):
    claim = make_claim()
    assert client.get(f"/api/claims/{claim['id']}").json()["title"] == "Conference ticket"
    assert client.get("/api/claims/99999").status_code == 404


def test_pending_claim_can_be_edited(client, make_claim):
    claim = make_claim(amount=500)
    response = client.put(f"/api/claims/{claim['id']}", json={"amount": 750, "title": "Fixed"})
    assert response.status_code == 200
    assert response.json()["amount"] == 750
    assert response.json()["title"] == "Fixed"
    assert response.json()["department"] == "ENGINEERING"


def test_approve_then_reimburse(client, make_claim):
    claim = make_claim()
    approved = client.patch(f"/api/claims/{claim['id']}/status", json={"status": "APPROVED"})
    assert approved.json()["status"] == "APPROVED"

    paid = client.patch(f"/api/claims/{claim['id']}/status", json={"status": "REIMBURSED"})
    assert paid.status_code == 200
    assert paid.json()["status"] == "REIMBURSED"


def test_pending_claim_cannot_skip_approval(client, make_claim):
    claim = make_claim()
    response = client.patch(f"/api/claims/{claim['id']}/status", json={"status": "REIMBURSED"})
    assert response.status_code == 409


def test_rejection_requires_a_comment(client, make_claim):
    claim = make_claim()
    no_reason = client.patch(f"/api/claims/{claim['id']}/status", json={"status": "REJECTED"})
    assert no_reason.status_code == 422

    with_reason = client.patch(
        f"/api/claims/{claim['id']}/status",
        json={"status": "REJECTED", "reviewer_comment": "Receipt missing"},
    )
    assert with_reason.status_code == 200
    assert with_reason.json()["reviewer_comment"] == "Receipt missing"


def test_approved_claim_is_locked_for_edits(client, make_claim):
    claim = make_claim()
    client.patch(f"/api/claims/{claim['id']}/status", json={"status": "APPROVED"})
    assert client.put(f"/api/claims/{claim['id']}", json={"amount": 99999}).status_code == 409
    assert client.delete(f"/api/claims/{claim['id']}").status_code == 409


def test_pending_claim_can_be_deleted(client, make_claim):
    claim = make_claim()
    assert client.delete(f"/api/claims/{claim['id']}").status_code == 204
    assert client.get(f"/api/claims/{claim['id']}").status_code == 404


def test_stats_add_up(client, make_claim):
    make_claim(amount=1000, category="TRAVEL")
    approved = make_claim(amount=2000, category="SOFTWARE")
    rejected = make_claim(amount=400, category="MEALS")
    client.patch(f"/api/claims/{approved['id']}/status", json={"status": "APPROVED"})
    client.patch(
        f"/api/claims/{rejected['id']}/status",
        json={"status": "REJECTED", "reviewer_comment": "Personal expense"},
    )

    stats = client.get("/api/claims/stats").json()
    assert stats["total_claims"] == 3
    assert stats["pending_count"] == 1
    assert stats["pending_amount"] == 1000
    assert stats["approved_amount"] == 2000
    assert stats["rejected_count"] == 1
    assert [c["category"] for c in stats["by_category"]] == ["SOFTWARE", "TRAVEL"]
