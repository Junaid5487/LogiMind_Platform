from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.core.security.hashing import hash_password, verify_password
from app.core.security.jwt import create_access_token
from app.db.models import User, Role

router = APIRouter(prefix="/auth", tags=["Authentication & Access Token"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    full_name: str
    email: str
    role_name: str

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db_session)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    role_name = user.role.role_name if user.role else "DISPATCHER"
    token = create_access_token({"sub": user.user_id, "role": role_name})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role_name": role_name
    }
