from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
import json
from app.dependencies.database import get_db_session
from app.db.models import CopilotAuditLog
from app.services.genai.copilot import LogisticsCopilotAgent
from app.core.logging import logger

router = APIRouter(prefix="/copilot", tags=["RAG Copilot Intelligence"])

class CopilotQueryRequest(BaseModel):
    query: str
    user_context: Optional[Dict[str, Any]] = None

@router.post("/ask", response_model=Dict[str, Any])
def ask_copilot(req: CopilotQueryRequest, db: Session = Depends(get_db_session)):
    copilot = LogisticsCopilotAgent(db=db)
    result = copilot.process_query(req.query)

    # Immutable audit trail: every question + routed intent + suggested
    # actions is persisted before the answer ships (advisory: never 500).
    try:
        db.add(CopilotAuditLog(
            query=req.query[:4000],
            intent=str(result.get("intent", "GENERAL"))[:60],
            answer_preview=str(result.get("answer", ""))[:500],
            actions_json=json.dumps(result.get("suggested_actions") or []),
        ))
        db.commit()
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        logger.warning(f"Copilot audit write skipped: {exc}")

    return result


@router.get("/audit", response_model=Dict[str, Any])
def list_copilot_audit(limit: int = 25, db: Session = Depends(get_db_session)):
    """Recent Copilot queries with routed intents — the audit trail."""
    rows = (db.query(CopilotAuditLog)
            .order_by(CopilotAuditLog.created_at.desc())
            .limit(max(1, min(limit, 200))).all())
    entries: List[Dict[str, Any]] = []
    for row in rows:
        try:
            actions = json.loads(row.actions_json) if row.actions_json else []
        except Exception:
            actions = []
        entries.append({
            "id": row.id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "query": row.query,
            "intent": row.intent,
            "answer_preview": row.answer_preview,
            "suggested_actions": actions,
        })
    return {"entries": entries, "count": len(entries)}


@router.post("/audit/{audit_id}/action", response_model=Dict[str, Any])
def record_executed_action(audit_id: str, action: str, db: Session = Depends(get_db_session)):
    """Mark a suggested action as executed from an audit entry (trail link)."""
    row = db.query(CopilotAuditLog).filter(CopilotAuditLog.id == audit_id).first()
    if row is None:
        return {"status": "NOT_FOUND", "audit_id": audit_id}
    row.executed_action = action[:60]
    db.commit()
    return {"status": "RECORDED", "audit_id": audit_id, "action": action}
