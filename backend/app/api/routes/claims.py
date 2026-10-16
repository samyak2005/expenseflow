from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import ClaimCreate, ClaimFilters, ClaimOut, ClaimStats, ClaimUpdate, StatusChange
from app.services import claims as service

router = APIRouter(prefix="/api/claims", tags=["claims"])

DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[ClaimOut])
def list_claims(db: DbSession, response: Response, filters: Annotated[ClaimFilters, Query()]):
    claims, total = service.list_claims(db, filters)
    response.headers["X-Total-Count"] = str(total)
    return claims


@router.get("/stats", response_model=ClaimStats)
def claim_stats(db: DbSession):
    return service.get_stats(db)


@router.get("/{claim_id}", response_model=ClaimOut)
def get_claim(claim_id: int, db: DbSession):
    return service.get_claim(db, claim_id)


@router.post("", response_model=ClaimOut, status_code=status.HTTP_201_CREATED)
def create_claim(payload: ClaimCreate, db: DbSession):
    return service.create_claim(db, payload)


@router.put("/{claim_id}", response_model=ClaimOut)
def update_claim(claim_id: int, payload: ClaimUpdate, db: DbSession):
    return service.update_claim(db, claim_id, payload)


@router.patch("/{claim_id}/status", response_model=ClaimOut)
def change_status(claim_id: int, payload: StatusChange, db: DbSession):
    return service.change_status(db, claim_id, payload)


@router.delete("/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_claim(claim_id: int, db: DbSession):
    service.delete_claim(db, claim_id)
