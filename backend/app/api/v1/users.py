from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import User

router = APIRouter(prefix="/users", tags=["Users Management"])

@router.get("", response_model=List[Dict[str, Any]])
def get_users(db: Session = Depends(get_db_session)):
    users = db.query(User).all()
    return [
        {
            "user_id": u.user_id,
            "full_name": u.full_name,
            "email": u.email,
            "phone_number": u.phone_number,
            "status": u.status,
            "role_name": u.role.role_name if u.role else "USER"
        }
        for u in users
    ]
