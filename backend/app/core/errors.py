from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class ClaimNotFoundError(Exception):
    def __init__(self, claim_id: int):
        super().__init__(f"Claim {claim_id} not found")


class ClaimStateError(Exception):
    """The claim's current status does not allow the requested change."""


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ClaimNotFoundError)
    async def handle_not_found(_: Request, exc: ClaimNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})

    @app.exception_handler(ClaimStateError)
    async def handle_state_error(_: Request, exc: ClaimStateError) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": str(exc)})
