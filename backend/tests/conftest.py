from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False)
    engine.dispose()


@pytest.fixture()
def db(session_factory) -> Session:
    with session_factory() as session:
        yield session


@pytest.fixture()
def client(session_factory):
    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def claim_payload():
    return {
        "employee_name": "Asha Rao",
        "department": "ENGINEERING",
        "title": "Conference ticket",
        "category": "TRAINING",
        "amount": 2500,
        "expense_date": date.today().isoformat(),
    }


@pytest.fixture()
def make_claim(client, claim_payload):
    def _make(**overrides):
        response = client.post("/api/claims", json={**claim_payload, **overrides})
        assert response.status_code == 201, response.text
        return response.json()

    return _make
