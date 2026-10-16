from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False)
    Base.metadata.create_all(engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture()
def make_claim(client):
    def _make(**overrides):
        payload = {
            "employee_name": "Asha Rao",
            "department": "ENGINEERING",
            "title": "Conference ticket",
            "category": "TRAINING",
            "amount": 2500,
            "expense_date": date.today().isoformat(),
        }
        payload.update(overrides)
        response = client.post("/api/claims", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make
