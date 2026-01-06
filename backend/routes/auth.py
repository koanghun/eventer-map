from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from db import models
from db import schemas
from db import get_db
from utils.auth import create_access_token, get_current_user, set_admin_status
import os

router = APIRouter(prefix="/auth", tags=["auth"])

# OAuth 설정
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import json

# OAuth 설정
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/auth/google/callback')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Google OAuth 설정 딕셔너리 생성 (client_secrets.json 파일 대체)
client_config = {
    "web": {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "redirect_uris": [GOOGLE_REDIRECT_URI]
    }
}

# 개발 환경에서 HTTPS 요구사항 비활성화 (프로덕션에서는 제거해야 함)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

@router.get("/google/login")
async def google_login():
    """구글 로그인 페이지로 리다이렉트"""
    flow = Flow.from_client_config(
        client_config=client_config,
        scopes=[
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"
        ],
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
    # 디버깅: 실제 사용되는 redirect_uri 확인
    print(f"=== DEBUG: GOOGLE_REDIRECT_URI = {GOOGLE_REDIRECT_URI}")
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    print(f"=== DEBUG: Authorization URL = {authorization_url}")
    
    # state 값을 쿠키에 저장 (CSRF 방지)
    response = RedirectResponse(url=authorization_url)
    # 개발 환경 호환성을 위해 samesite='lax', secure=False 명시
    # path="/"를 설정하여 모든 경로에서 쿠키 접근 가능하도록 함
    response.set_cookie(
        key="oauth_state", 
        value=state, 
        httponly=True, 
        samesite="lax", 
        secure=False, 
        path="/"
    )
    return response


@router.get("/google/callback")
async def google_callback(request: Request, code: str, state: str, db: Session = Depends(get_db)):
    """구글 OAuth 콜백 처리"""
    try:
        # 1. State 검증 (CSRF 방지)
        stored_state = request.cookies.get("oauth_state")
        
        # 디버깅을 위한 로그
        print(f"Received State from Google: {state}")
        print(f"Stored State in Cookie: {stored_state}")
        print(f"All Cookies: {request.cookies}")

        if not stored_state or stored_state != state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter"
            )

        # 2. Flow 객체 생성
        flow = Flow.from_client_config(
            client_config=client_config,
            scopes=[
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/userinfo.profile",
                "openid"
            ],
            redirect_uri=GOOGLE_REDIRECT_URI,
            state=state
        )
        
        # 3. 인증 코드로 토큰 교환
        # fetch_token 내부에서 state 검증도 수행할 수 있으나, 
        # 위에서 수동으로 검증했으므로 안전함
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # 4. ID 토큰 검증 및 사용자 정보 추출
        id_info = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # 5. 사용자 찾기 또는 생성
        user = db.query(models.User).filter(
            models.User.google_id == id_info['sub']
        ).first()
        
        if not user:
            user = models.User(
                email=id_info['email'],
                name=id_info.get('name'),
                profile_image=id_info.get('picture'),
                google_id=id_info['sub']
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # 기존 사용자 정보 업데이트
            user.name = id_info.get('name')
            user.profile_image = id_info.get('picture')
            db.commit()
        
        # 관리자 상태 설정 (ADMIN_EMAILS 환경변수 기반)
        set_admin_status(user)
        db.commit()

        # 관리자 상태 확인
        print(f"User {user.email} is_admin: {user.is_admin}")
        
        # 6. 자체 JWT 토큰 생성
        jwt_token = create_access_token({"sub": str(user.id)})
        
        # 7. 프론트엔드로 리다이렉트 (사용자 정보 포함으로 즉시 로그인 상태 표시 가능)
        from urllib.parse import urlencode
        
        user_params = {
            'token': jwt_token,
            'user_id': user.id,
            'user_email': user.email,
            'user_name': user.name or '',
            'user_picture': user.profile_image or ''
        }
        
        response = RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?{urlencode(user_params)}"
        )
        response.delete_cookie(key="oauth_state")
        return response
    
    except ValueError as e:
        # 토큰 검증 실패 (Invalid token)
        print(f"Token verification failed: {str(e)}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?error=invalid_token"
        )
    except HTTPException as e:
        print(f"OAuth callback error: {e.detail}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?error=auth_failed"
        )
    except Exception as e:
        print(f"OAuth callback error: {str(e)}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/auth/callback?error=unknown_error"
        )


@router.get("/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회"""
    return current_user


@router.post("/logout")
async def logout():
    """로그아웃 (클라이언트 side에서 토큰 삭제)"""
    return {"message": "Logged out successfully"}
