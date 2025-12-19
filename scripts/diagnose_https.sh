#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 설정
DOMAIN="eventermap.mydns.jp"
FRONTEND_PORT=7772
BACKEND_PORT=7773

echo "=========================================="
echo "HTTPS 연결 문제 진단 스크립트"
echo "도메인: $DOMAIN"
echo "=========================================="
echo ""

# 1. DNS 확인
echo -e "${BLUE}1️⃣  DNS 설정 확인${NC}"
echo "---"
DNS_RESULT=$(nslookup -type=AAAA $DOMAIN 8.8.8.8 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
if [ -n "$DNS_RESULT" ]; then
    echo -e "${GREEN}✅ DNS 정상: $DNS_RESULT${NC}"
else
    echo -e "${RED}❌ DNS 미등록 또는 조회 실패${NC}"
    echo "   → MyDNS.jp에서 IP 주소를 등록했는지 확인하세요"
fi
echo ""

# 2. Docker 컨테이너 상태
echo -e "${BLUE}2️⃣  Docker 컨테이너 상태${NC}"
echo "---"
FRONTEND_RUNNING=$(docker ps --filter "name=eventer-map-frontend" --format "{{.Names}}" 2>/dev/null)
BACKEND_RUNNING=$(docker ps --filter "name=eventer-map-backend" --format "{{.Names}}" 2>/dev/null)

if [ -n "$FRONTEND_RUNNING" ]; then
    echo -e "${GREEN}✅ Frontend 컨테이너 실행 중${NC}"
else
    echo -e "${RED}❌ Frontend 컨테이너 미실행${NC}"
    echo "   → docker-compose -f docker-compose.pro.yml up -d"
fi

if [ -n "$BACKEND_RUNNING" ]; then
    echo -e "${GREEN}✅ Backend 컨테이너 실행 중${NC}"
else
    echo -e "${RED}❌ Backend 컨테이너 미실행${NC}"
    echo "   → docker-compose -f docker-compose.pro.yml up -d"
fi
echo ""

# 3. 로컬 포트 접근 테스트
echo -e "${BLUE}3️⃣  로컬 포트 접근 테스트${NC}"
echo "---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT 2>/dev/null)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    echo -e "${GREEN}✅ Frontend 포트($FRONTEND_PORT) 접근 가능: HTTP $HTTP_CODE${NC}"
else
    echo -e "${RED}❌ Frontend 포트($FRONTEND_PORT) 접근 실패: HTTP $HTTP_CODE${NC}"
    echo "   → 컨테이너 로그 확인: docker logs eventer-map-frontend"
fi

HTTP_CODE_BACKEND=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/health 2>/dev/null)
if [ "$HTTP_CODE_BACKEND" = "200" ]; then
    echo -e "${GREEN}✅ Backend 포트($BACKEND_PORT) 접근 가능: HTTP $HTTP_CODE_BACKEND${NC}"
else
    echo -e "${YELLOW}⚠️  Backend 포트($BACKEND_PORT) 접근 실패: HTTP $HTTP_CODE_BACKEND${NC}"
    echo "   (Backend는 /health 엔드포인트가 없을 수 있음)"
fi
echo ""

# 4. Synology Nginx 443 포트 확인
echo -e "${BLUE}4️⃣  Synology Nginx 포트 443 확인${NC}"
echo "---"
NGINX_443=$(sudo netstat -tlnp 2>/dev/null | grep :443 | grep nginx)
if [ -n "$NGINX_443" ]; then
    echo -e "${GREEN}✅ Nginx가 443 포트를 리스닝 중${NC}"
    echo "$NGINX_443"
else
    echo -e "${RED}❌ Nginx가 443 포트를 리스닝하지 않음${NC}"
    echo "   → Synology DSM 역방향 프록시 설정 확인"
fi
echo ""

# 5. HTTPS 접속 테스트 (외부)
echo -e "${BLUE}5️⃣  HTTPS 외부 접속 테스트${NC}"
echo "---"
HTTPS_RESPONSE=$(curl -I -k --connect-timeout 5 https://$DOMAIN 2>&1)
HTTPS_CODE=$(echo "$HTTPS_RESPONSE" | grep "HTTP" | head -1 | awk '{print $2}')

if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "304" ]; then
    echo -e "${GREEN}✅ HTTPS 접속 성공: HTTP $HTTPS_CODE${NC}"
elif echo "$HTTPS_RESPONSE" | grep -q "Connection refused\|Connection timed out"; then
    echo -e "${RED}❌ HTTPS 접속 실패: 연결 거부됨${NC}"
    echo "   → 포트 443이 외부에서 차단되었을 가능성"
    echo "   → IPv6 방화벽 설정 확인 (라우터 + NAS)"
elif echo "$HTTPS_RESPONSE" | grep -q "certificate"; then
    echo -e "${YELLOW}⚠️  SSL 인증서 오류${NC}"
    echo "   → Synology DSM에서 Let's Encrypt 인증서 재발급"
elif [ "$HTTPS_CODE" = "502" ]; then
    echo -e "${YELLOW}⚠️  502 Bad Gateway${NC}"
    echo "   → 역방향 프록시가 localhost:$FRONTEND_PORT에 연결 실패"
    echo "   → Docker 컨테이너 재시작 필요"
else
    echo -e "${YELLOW}⚠️  HTTPS 접속 실패: HTTP $HTTPS_CODE${NC}"
    echo "$HTTPS_RESPONSE" | head -5
fi
echo ""

# 6. 컨테이너 로그 확인 (최근 10줄)
echo -e "${BLUE}6️⃣  컨테이너 최근 로그${NC}"
echo "---"
if [ -n "$FRONTEND_RUNNING" ]; then
    echo -e "${YELLOW}Frontend 로그:${NC}"
    docker logs eventer-map-frontend --tail 5 2>&1 | sed 's/^/  /'
    echo ""
fi

if [ -n "$BACKEND_RUNNING" ]; then
    echo -e "${YELLOW}Backend 로그:${NC}"
    docker logs eventer-map-backend --tail 5 2>&1 | sed 's/^/  /'
fi
echo ""

# 7. 요약 및 권장 사항
echo "=========================================="
echo -e "${BLUE}📋 진단 요약${NC}"
echo "=========================================="
echo ""

# 문제 카운트
ISSUES=0

if [ -z "$DNS_RESULT" ]; then
    ISSUES=$((ISSUES+1))
    echo -e "${RED}❌ DNS 문제 발견${NC}"
fi

if [ -z "$FRONTEND_RUNNING" ] || [ -z "$BACKEND_RUNNING" ]; then
    ISSUES=$((ISSUES+1))
    echo -e "${RED}❌ Docker 컨테이너 문제${NC}"
fi

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "304" ]; then
    ISSUES=$((ISSUES+1))
    echo -e "${RED}❌ 로컬 포트 접근 문제${NC}"
fi

if [ "$HTTPS_CODE" != "200" ] && [ "$HTTPS_CODE" != "304" ]; then
    ISSUES=$((ISSUES+1))
    echo -e "${RED}❌ HTTPS 외부 접속 문제${NC}"
fi

echo ""
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 항목이 정상입니다!${NC}"
    echo ""
    echo "브라우저에서 접속: https://$DOMAIN"
else
    echo -e "${YELLOW}⚠️  $ISSUES개의 문제가 발견되었습니다.${NC}"
    echo ""
    echo "다음 단계:"
    echo "1. 위의 오류 메시지를 확인하세요"
    echo "2. 상세 체크리스트 참고: https_setup_checklist.md"
    echo "3. 문제가 지속되면 아래 명령어로 더 많은 정보 수집:"
    echo "   docker logs eventer-map-frontend --tail 50"
    echo "   docker logs eventer-map-backend --tail 50"
fi

echo ""
echo "=========================================="
