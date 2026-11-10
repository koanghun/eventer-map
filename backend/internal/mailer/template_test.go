package mailer

import (
	"strings"
	"testing"
)

func TestNormalizeLang(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", "ja"},
		{"ja", "ja"},
		{"ja-JP", "ja"},
		{"ko", "ko"},
		{"ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7", "ko"},
		{"en", "en"},
		{"en-US,en;q=0.9", "en"},
		{"zh", "zh"},
		{"zh-CN,zh;q=0.9", "zh"},
		{"fr-FR,fr;q=0.9", "ja"}, // unsupported falls back to ja
	}

	for _, tt := range tests {
		got := NormalizeLang(tt.input)
		if got != tt.expected {
			t.Errorf("NormalizeLang(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestGetVerificationTemplate(t *testing.T) {
	code := "123456"

	// Korean
	subKo, bodyKo := GetVerificationTemplate("ko", code)
	if !strings.Contains(subKo, "이메일 인증 코드") || !strings.Contains(bodyKo, code) {
		t.Errorf("Korean template failed: %s / %s", subKo, bodyKo)
	}

	// Japanese
	subJa, bodyJa := GetVerificationTemplate("ja", code)
	if !strings.Contains(subJa, "メール認証コード") || !strings.Contains(bodyJa, code) {
		t.Errorf("Japanese template failed: %s / %s", subJa, bodyJa)
	}

	// English
	subEn, bodyEn := GetVerificationTemplate("en", code)
	if !strings.Contains(subEn, "Verification Code") || !strings.Contains(bodyEn, code) {
		t.Errorf("English template failed: %s / %s", subEn, bodyEn)
	}

	// Chinese
	subZh, bodyZh := GetVerificationTemplate("zh", code)
	if !strings.Contains(subZh, "邮箱验证码") || !strings.Contains(bodyZh, code) {
		t.Errorf("Chinese template failed: %s / %s", subZh, bodyZh)
	}
}

