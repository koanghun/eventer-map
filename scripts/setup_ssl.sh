#!/bin/bash

echo "=========================================="
echo "HTTPS 인증서 발급 스크립트 (DNS-01 Challenge)"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# MyDNS.jp 정보 입력 (사용자가 직접 수정)
MYDNS_MASTER_ID="test"
MYDNS_PASSWORD="test"
DOMAIN="eventermap.mydns.jp"
EMAIL="test"

echo -e "${YELLOW}⚠️  설정 확인:${NC}"
echo "도메인: $DOMAIN"
echo "이메일: $EMAIL"
echo ""

if [ "$MYDNS_MASTER_ID" = "YOUR_MASTER_ID" ]; then
    echo -e "${RED}❌ 오류: 스크립트를 수정하여 MyDNS.jp 정보를 입력하세요!${NC}"
    echo ""
    echo "편집할 파일:"
    echo "  nano $0"
    echo ""
    echo "수정할 변수:"
    echo "  MYDNS_MASTER_ID=\"test\""
    echo "  MYDNS_PASSWORD=\"test\""
    echo "  EMAIL=\"test\""
    exit 1
fi

# acme.sh 설치 확인
if [ ! -d "$HOME/.acme.sh" ]; then
    echo -e "${YELLOW}📦 acme.sh 설치 중...${NC}"
    curl https://get.acme.sh | sh -s email=$EMAIL
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ acme.sh 설치 완료${NC}"
    else
        echo -e "${RED}❌ acme.sh 설치 실패${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ acme.sh 이미 설치됨${NC}"
fi

# acme.sh 경로 설정
ACME_SH="$HOME/.acme.sh/acme.sh"

# MyDNS.jp API 정보 설정
export MYDNSJP_MasterID="$MYDNS_MASTER_ID"
export MYDNSJP_Password="$MYDNS_PASSWORD"

echo ""
echo -e "${YELLOW}🔐 Let's Encrypt 인증서 발급 중...${NC}"
echo "방식: DNS-01 Challenge (포트 80 불필요)"
echo ""

# 인증서 발급
$ACME_SH --issue \
    --dns dns_mydnsjp \
    -d "$DOMAIN" \
    --server letsencrypt

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 인증서 발급 성공!${NC}"
    echo ""
    echo "인증서 위치:"
    echo "  $HOME/.acme.sh/$DOMAIN"
    echo ""
    echo "파일 목록:"
    ls -lh "$HOME/.acme.sh/$DOMAIN/"
    echo ""
    echo -e "${YELLOW}📋 다음 단계:${NC}"
    echo "1. 인증서를 Synology DSM으로 가져오기"
    echo "2. 역방향 프록시 설정"
    echo "3. 자동 갱신 설정 (acme.sh가 자동으로 처리)"
else
    echo ""
    echo -e "${RED}❌ 인증서 발급 실패${NC}"
    echo ""
    echo "문제 해결:"
    echo "1. MyDNS.jp 로그인 정보가 정확한지 확인"
    echo "2. DNS가 정상 작동하는지 확인 (nslookup $DOMAIN)"
    echo "3. MyDNS.jp 계정에서 API 사용이 가능한지 확인"
    exit 1
fi

echo ""
echo "=========================================="
echo "완료!"
echo "=========================================="
