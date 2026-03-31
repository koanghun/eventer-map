from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db import get_db
from db import models
import os

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


def create_access_token(data: dict):
    """JWT 액세스 토큰 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)



def _extract_token(request: Request) -> Optional[str]:
    """쿠키 → Authorization 헤더 순서로 JWT 토큰을 추출"""
    token = request.cookies.get("access_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1]
    return None


def verify_token(request: Request):
    """JWT 토큰 검증 (쿠키 우선, Authorization 헤더 폴백)"""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        try:
            user_id = int(user_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )



def get_current_user(
    user_id: int = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """현재 인증된 사용자 조회"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


# 로그인 필수 데코레이터용
require_auth = Depends(get_current_user)


from fastapi import Header

INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "eventer_sync_token_2026")

def get_current_user_or_internal(
    request: Request,
    x_internal_token: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    현재 인증된 사용자 또는 내부 서비스 토큰으로 인증된 'System' 사용자 반환.
    X-Internal-Token 헤더가 일치하면 인증 통과 처리합니다.
    """
    # 1. 내부 토큰 검증
    if x_internal_token and x_internal_token == INTERNAL_TOKEN:
        system_user = db.query(models.User).filter(models.User.email == "system@eventer").first()
        if not system_user:
            system_user = models.User(
                email="system@eventer", 
                name="System Pipeline", 
                is_admin=True
            )
            db.add(system_user)
            db.commit()
            db.refresh(system_user)
        return system_user

    # 2. 일반 토큰 검증 (쿠키 → Authorization 헤더 폴백)
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Token or Internal Token"
        )
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(user_id_str)
        
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
        
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")


require_auth_or_internal = Depends(get_current_user_or_internal)




# 관리자 이메일 목록
ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "").split(",")


def set_admin_status(user: models.User) -> None:
    """
    사용자가 관리자 이메일 목록에 있으면 is_admin을 True로 설정
    
    Args:
        user: User 객체
    """
    if user.email in ADMIN_EMAILS:
        user.is_admin = True
    else:
        user.is_admin = False


def require_admin(current_user: models.User = require_auth):
    """관리자 권한 필수 체크"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

