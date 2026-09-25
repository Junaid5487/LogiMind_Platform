from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.core.security.jwt import decode_access_token
from app.db.models import User, Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db_session)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user_id = payload["sub"]
    return db.query(User).filter(User.user_id == user_id).first()

def require_roles(allowed_roles: list):
    def role_checker(user: User = Depends(get_current_user)):
        if not user or not user.role or user.role.role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role lacks permission. Required: {allowed_roles}"
            )
        return user
    return role_checker
