def test_health_reports_up(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_ready_checks_the_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "READY"}


def test_root_describes_the_service(client):
    body = client.get("/").json()
    assert body["service"] == "ExpenseFlow API"
    assert body["docs"] == "/docs"


def test_metrics_are_in_prometheus_format(client, make_claim):
    make_claim(category="TRAVEL")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert 'expenseflow_claims_submitted_total{category="TRAVEL"}' in response.text


def test_request_id_is_echoed_or_generated(client):
    echoed = client.get("/health", headers={"X-Request-ID": "abc123"})
    generated = client.get("/health")

    assert echoed.headers["X-Request-ID"] == "abc123"
    assert len(generated.headers["X-Request-ID"]) == 16
