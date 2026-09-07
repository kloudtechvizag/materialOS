from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.schemas.sales import DeliveryChallanOut, SalesOrderOut
from app.services.dispatch_board import dispatch_board

router = APIRouter(prefix="/dispatch-board", tags=["dispatch"])


@router.get("")
def get_dispatch_board(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> dict:
    board = dispatch_board(db)
    return {
        "pending_orders": [SalesOrderOut.model_validate(o) for o in board["pending_orders"]],
        "ready_to_dispatch": [SalesOrderOut.model_validate(o) for o in board["ready_to_dispatch"]],
        "dispatched": [DeliveryChallanOut.model_validate(d) for d in board["dispatched"]],
        "delivered": [DeliveryChallanOut.model_validate(d) for d in board["delivered"]],
    }
