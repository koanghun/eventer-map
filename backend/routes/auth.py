from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx
import models
import schemas
from database import get_db
from utils.auth import create_access_token, get_current_user
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

# OAuth 설정
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/auth/google/callback')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google/login")
async def google_login():
    """구글 로그인 페이지로 리다이렉트"""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """구글 OAuth 콜백 처리"""
    try:
        # 1. 인증 코드로 액세스 토큰 교환
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get access token from Google"
                )
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            # 2. 액세스 토큰으로 사용자 정보 가져오기
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if userinfo_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to get user info from Google"
                )
            
            user_info = userinfo_response.json()
        
        # 3. 사용자 찾기 또는 생성
        user = db.query(models.User).filter(
            models.User.google_id == user_info['id']
        ).first()
        
        if not user:
            user = models.User(
                email=user_info['email'],
                name=user_info.get('name'),
                profile_image=user_info.get('picture'),
                google_id=user_info['id']
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # 기존 사용자 정보 업데이트
            user.name = user_info.get('name')
            user.profile_image = user_info.get('picture')
            db.commit()
        
        # 4. JWT 토큰 생성
        jwt_token = create_access_token({"sub": str(user.id)})
        
        # 5. 프론트엔드로 리다이렉트 (토큰 전달)
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?token={jwt_token}"
        )
    
    except Exception as e:
        print(f"OAuth callback error: {str(e)}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}?error=auth_failed"
        )


@router.get("/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회"""
    return current_user


@router.post("/logout")
async def logout():
    """로그아웃 (클라이언트 side에서 토큰 삭제)"""
    return {"message": "Logged out successfully"}
