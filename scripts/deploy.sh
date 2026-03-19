#!/bin/bash

# 설정 (브랜치 등)
BRANCH="release"

echo "==========================================="
echo "🚀 배포 자동화 스크립트 실행 시작"
echo "브랜치: $BRANCH"
echo "==========================================="

# 1. 최신 코드 가져오기
echo "📥 1. 최신 코드 가져오는 중... (git pull)"
git pull origin $BRANCH

# 2. 프로덕션 컨테이너 빌드 및 재실행
echo "🐳 2. Docker 컨테이너 빌드 및 백그라운드 구동"
docker-compose -f docker-compose.pro.yml up --build -d

# 3. 불필요한 고아 이미지 정리
echo "🧹 3. 불필요한 고아 이미지 및 볼륨 정리"
docker image prune -f

echo "==========================================="
echo "✅ 배포가 완료되었습니다!"
echo "==========================================="
