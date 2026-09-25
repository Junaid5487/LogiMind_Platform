from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.services.genai.copilot import LogisticsCopilotAgent

router = APIRouter(prefix="/copilot", tags=["RAG Copilot Intelligence"])

class CopilotQueryRequest(BaseModel):
    query: str
    user_context: Optional[Dict[str, Any]] = None

@router.post("/ask", response_model=Dict[str, Any])
def ask_copilot(req: CopilotQueryRequest, db: Session = Depends(get_db_session)):
    copilot = LogisticsCopilotAgent(db=db)
    return copilot.process_query(req.query)
