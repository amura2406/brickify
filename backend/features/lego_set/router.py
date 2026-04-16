from fastapi import APIRouter, HTTPException
from lego_sets import LEGO_SETS, get_set_info, get_set_detail

router = APIRouter(prefix="/api/sets", tags=["lego_sets"])

@router.get("")
def list_sets():
    """List all available LEGO Art sets (with full detail)."""
    sets = []
    for set_id in LEGO_SETS:
        detail = get_set_detail(set_id)
        if detail:
            sets.append(detail)
    return {"sets": sets}

@router.get("/{set_id}")
def get_set(set_id: str):
    """Get detailed info for a LEGO Art set."""
    detail = get_set_detail(set_id)
    if not detail:
        raise HTTPException(404, f"Set {set_id} not found")
    return detail
