#!/bin/bash

echo "=========================================="
echo "DNS 확인 스크립트"
echo "=========================================="
echo ""

echo "1. IPv4 DNS 조회:"
nslookup eventermap.mydns.jp 8.8.8.8 2>/dev/null | grep -A2 "Name:" || echo "  ❌ IPv4 주소 미등록"

echo ""
echo "2. IPv6 DNS 조회:"
nslookup -type=AAAA eventermap.mydns.jp 8.8.8.8 2>/dev/null | grep -A2 "Name:" || echo "  ❌ IPv6 주소 미등록"

echo ""
echo "3. 현재 서버 IP 주소:"
echo "  IPv4: $(curl -4 -s ifconfig.me)"
echo "  IPv6: $(curl -6 -s ifconfig.me)"

echo ""
echo "=========================================="
echo "예상 결과:"
echo "  IPv4: 133.200.193.32"
echo "  IPv6: 2404:7a80:c120:e500:211:32ff:fed5:1c63"
echo "=========================================="
