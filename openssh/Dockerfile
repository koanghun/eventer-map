# SSH 개발 환경 컨테이너
# Ubuntu 22.04 기반 - VSCode Remote SSH 호환
FROM ubuntu:22.04

# 패키지 설치 중 interactive prompts 방지
ENV DEBIAN_FRONTEND=noninteractive

# 1. 시스템 업데이트 및 필수 패키지 설치
RUN apt-get update && \
    apt-get install -y \
    openssh-server \
    sudo \
    curl \
    wget \
    git \
    vim \
    nano \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 2. SSH 서비스 디렉토리 생성
RUN mkdir -p /run/sshd

# 3. developer 사용자 생성
# -M: 홈 디렉토리를 자동 생성하지 않음 (볼륨 마운트로 제공됨)
# -s /bin/bash: 기본 쉘을 bash로 설정
RUN useradd -M -s /bin/bash developer && \
    mkdir -p /home/developer && \
    chown developer:developer /home/developer

# 4. sudo 권한 부여 (비밀번호 없이 sudo 사용 가능)
RUN echo 'developer ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# 5. .ssh 디렉토리 사전 생성 및 권한 설정
RUN mkdir -p /home/developer/.ssh && \
    chown -R developer:developer /home/developer/.ssh && \
    chmod 700 /home/developer/.ssh

# entrypoint 스크립트 복사
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# SSH 포트 노출
EXPOSE 22

# 런타임 설정 및 SSH 서비스 시작
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
