# MyDNS.jp 자동 업데이트 설정 가이드

MyDNS.jp는 Dynamic DNS 서비스로, 서버의 공인 IP 주소가 변경될 때마다 자동으로 도메인과 연결해줍니다. 
이를 위해 **정기적으로 현재 IP 주소를 MyDNS 서버에 알려줘야** 합니다.

---

## 📋 목차

- [왜 필요한가요?](#왜-필요한가요)
- [설정 단계](#설정-단계)
- [Synology 작업 스케줄러 설정](#synology-작업-스케줄러-설정)
- [수동 업데이트](#수동-업데이트)
- [로그 확인](#로그-확인)
- [트러블슈팅](#트러블슈팅)

---

## 왜 필요한가요?

### MyDNS.jp의 작동 원리

1. 서버의 공인 IP가 변경됨 (ISP에 의해)
2. MyDNS에 새로운 IP를 알려줌
3. MyDNS가 도메인(`eventermap.mydns.jp`)과 새 IP를 연결
4. 사용자는 계속 같은 도메인으로 접속 가능

### ⚠️ 업데이트하지 않으면?

- **7일 이상**: 에러 페이지로 리디렉션
- **30일 이상**: 모든 DNS 데이터 삭제됨!

---

## 설정 단계

### 1️⃣ 스크립트 권한 설정

SSH로 NAS에 접속한 후:

```bash
# eventer-map 디렉토리로 이동
cd /volume1/docker/eventer-map

# 스크립트에 실행 권한 부여
chmod +x scripts/update_mydns_ip.sh
```

### 2️⃣ 비밀번호 설정

스크립트를 편집하여 실제 MyDNS 비밀번호 입력:

```bash
vi scripts/update_mydns_ip.sh
```

또는 GUI 편집기 사용:
1. File Station에서 `scripts/update_mydns_ip.sh` 찾기
2. 마우스 우클릭 → **텍스트 편집기로 열기**
3. 다음 줄 수정:

```bash
MYDNS_PASSWORD="YOUR_PASSWORD_HERE"  # ← 실제 비밀번호로 변경
```

**저장 후 닫기**

### 3️⃣ 테스트 실행

설정이 제대로 되었는지 확인:

```bash
cd /volume1/docker/eventer-map
./scripts/update_mydns_ip.sh
```

**예상 출력:**
```
==========================================
[2025-12-25 10:30:15] MyDNS IP 업데이트 시작
[2025-12-25 10:30:16] 현재 공인 IP: 123.456.789.012
[2025-12-25 10:30:17] MyDNS.jp에 IP 주소 업데이트 중...
[2025-12-25 10:30:18] ✅ 업데이트 성공!
[2025-12-25 10:30:18] 응답: OK
==========================================
```

---

## Synology 작업 스케줄러 설정

### 방법 1: GUI를 통한 설정 (권장)

#### Step 1: 제어판 열기

1. Synology DSM에 로그인
2. **제어판** → **작업 스케줄러** 열기

#### Step 2: 새 작업 생성

1. **생성** 버튼 클릭
2. **예약된 작업** → **사용자 정의 스크립트** 선택

#### Step 3: 일반 설정

- **작업 이름**: `MyDNS IP 자동 업데이트`
- **사용자**: `root` (권장)
- **사용**: ✅ 체크

#### Step 4: 스케줄 설정

**실행 주기 설정:**

- **날짜**: 매일
- **시간**: 반복 선택
  - **첫 실행 시간**: `00:00` (자정)
  - **빈도**: `매 24시간마다` (또는 원하는 주기)
  - **마지막 실행 시간**: `23:00`

> [!TIP]
> 더 자주 업데이트하려면 `매 12시간마다` 또는 `매 6시간마다`로 설정할 수 있습니다.
> - 예: 00:00, 06:00, 12:00, 18:00에 자동 실행

#### Step 5: 작업 설정

**사용자 정의 스크립트** 탭에서 아래 스크립트를 **복사하여 붙여넣기**:

> [!IMPORTANT]
> `MYDNS_PASSWORD`를 실제 MyDNS 비밀번호로 변경하세요!

```bash
#!/bin/bash

# MyDNS 정보 (비밀번호 입력 필수!)
MYDNS_MASTER_ID="mydns786724"
MYDNS_PASSWORD="실제_비밀번호_입력"  # ← 여기를 수정하세요!

# 로그 설정
LOG_DIR="/volume2/docker/eventer-map/logs"  # volume1 또는 volume2로 수정
LOG_FILE="$LOG_DIR/mydns_update.log"
mkdir -p "$LOG_DIR"

# 로그 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 업데이트 시작
log "=========================================="
log "MyDNS IP 업데이트 시작"

# 현재 공인 IP 확인
CURRENT_IP=$(curl -s https://api.ipify.org)
log "현재 공인 IP: $CURRENT_IP"

# MyDNS.jp에 IP 업데이트
log "MyDNS.jp에 IP 주소 업데이트 중..."
RESPONSE=$(curl -s -u "$MYDNS_MASTER_ID:$MYDNS_PASSWORD" "https://ipv4.mydns.jp/login.html")

# 결과 확인
if [ $? -eq 0 ]; then
    log "✅ 업데이트 성공!"
    log "응답: $RESPONSE"
else
    log "❌ 업데이트 실패"
    log "응답: $RESPONSE"
fi

log "=========================================="
```

#### Step 6: 저장 및 확인

1. 스크립트에서 `MYDNS_PASSWORD="실제_비밀번호_입력"` 부분을 실제 비밀번호로 수정
2. `LOG_DIR` 경로 확인 (volume1 또는 volume2)
3. **확인** 버튼 클릭
4. 작업 목록에서 새로 만든 작업 확인
5. ✅ 사용 체크박스 확인

#### Step 7: 즉시 실행 테스트

1. 작업 선택
2. **실행** 버튼 클릭
3. 로그에서 결과 확인 (아래 참조)

---

### 방법 2: SSH를 통한 Cron 설정

```bash
# crontab 편집
sudo vi /etc/crontab

# 매 6시간마다 실행 (0시, 6시, 12시, 18시)
0 */6 * * * root /volume1/docker/eventer-map/scripts/update_mydns_ip.sh >> /volume1/docker/eventer-map/logs/mydns_cron.log 2>&1
```

**또는 매일 새벽 3시 실행:**
```bash
0 3 * * * root /volume1/docker/eventer-map/scripts/update_mydns_ip.sh >> /volume1/docker/eventer-map/logs/mydns_cron.log 2>&1
```

---

## 수동 업데이트

긴급하게 IP를 업데이트해야 할 때:

### 방법 1: 스크립트 실행

```bash
ssh admin@YOUR_NAS_IP
cd /volume1/docker/eventer-map
./scripts/update_mydns_ip.sh
```

### 방법 2: 브라우저에서 직접

다음 URL을 브라우저에서 열기:

```
https://mydns786724:비밀번호@ipv4.mydns.jp/login.html
```

**비밀번호**를 실제 MyDNS 비밀번호로 변경하세요.

### 방법 3: cURL 사용

```bash
curl -u "mydns786724:비밀번호" "https://ipv4.mydns.jp/login.html"
```

---

## 로그 확인

### 업데이트 로그 보기

```bash
# 전체 로그 보기
cat /volume1/docker/eventer-map/logs/mydns_update.log

# 최근 30줄만 보기
tail -n 30 /volume1/docker/eventer-map/logs/mydns_update.log

# 실시간 모니터링
tail -f /volume1/docker/eventer-map/logs/mydns_update.log
```

### Synology 작업 스케줄러 로그

1. **제어판** → **작업 스케줄러**
2. 작업 선택 후 **편집**
3. **결과** 탭 확인

---

## 트러블슈팅

### 문제 1: "업데이트 실패" 메시지

**원인**: 잘못된 비밀번호 또는 Master ID

**해결**:
```bash
# 스크립트 편집
vi /volume1/docker/eventer-map/scripts/update_mydns_ip.sh

# 다음 항목 확인:
MYDNS_MASTER_ID="mydns786724"  # 정확한지 확인
MYDNS_PASSWORD="실제비밀번호"   # 큰따옴표 안에 입력
```

### 문제 2: "Permission denied" 에러

**원인**: 실행 권한이 없음

**해결**:
```bash
chmod +x /volume1/docker/eventer-map/scripts/update_mydns_ip.sh
```

### 문제 3: 작업 스케줄러가 실행되지 않음

**확인 사항**:
1. 작업이 **사용** 체크되어 있는지 확인
2. 사용자가 `root`로 설정되어 있는지 확인
3. 스크립트 경로가 정확한지 확인
4. 로그 파일 확인:

```bash
cat /volume1/docker/eventer-map/logs/mydns_update.log
```

### 문제 4: MyDNS에서 계속 경고 메일이 옴

**확인**:
1. 로그 파일에서 성공 메시지 확인
2. 현재 공인 IP 확인:
   ```bash
   curl https://api.ipify.org
   ```
3. MyDNS 웹사이트에서 등록된 IP 확인

---

## 📊 업데이트 상태 확인

### 현재 등록된 IP 확인

```bash
nslookup eventermap.mydns.jp
```

**예상 출력:**
```
Server:		8.8.8.8
Address:	8.8.8.8#53

Non-authoritative answer:
Name:	eventermap.mydns.jp
Address: 123.456.789.012  ← 현재 등록된 IP
```

### 현재 공인 IP 확인

```bash
curl https://api.ipify.org
```

**두 IP가 일치하면 정상 작동 중입니다!** ✅

---

## 🔒 보안 고려사항

> [!WARNING]
> 스크립트에 비밀번호가 평문으로 저장됩니다!

### 보안 강화 방법

1. **파일 권한 제한:**
   ```bash
   chmod 700 /volume1/docker/eventer-map/scripts/update_mydns_ip.sh
   ```

2. **환경 변수 사용 (선택사항):**
   ```bash
   # .env 파일에 비밀번호 저장
   echo "MYDNS_PASSWORD=실제비밀번호" >> /volume1/docker/eventer-map/.env.mydns
   chmod 600 /volume1/docker/eventer-map/.env.mydns
   
   # 스크립트에서 읽기
   source /volume1/docker/eventer-map/.env.mydns
   ```

---

## 📚 관련 문서

- [배포 가이드](./DEPLOYMENT_GUIDE.md)
- [MyDNS.jp 공식 사이트](https://www.mydns.jp/)
- [SSL/HTTPS 설정](../scripts/setup_ssl.sh)

---

**🎉 설정 완료!** 이제 IP 주소가 자동으로 업데이트됩니다.
