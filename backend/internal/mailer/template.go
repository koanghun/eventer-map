package mailer

import (
	"fmt"
	"mime"
	"strings"
)

// EmailTemplate holds the subject and body format for an email.
type EmailTemplate struct {
	Subject string
	Body    string
}

// verificationTemplates maps language codes to their respective templates.
var verificationTemplates = map[string]EmailTemplate{
	"ja": {
		Subject: "[Eventer Map] メール認証コード",
		Body: "こんにちは、\r\n\r\nEventer Mapのメール認証コードです：\r\n\r\n  %s\r\n\r\n認証コードの有効期限は5分間です。\r\n心当たりがない場合は、このメールを破棄してください。\r\n",
	},
	"ko": {
		Subject: "[Eventer Map] 이메일 인증 코드",
		Body: "안녕하세요,\r\n\r\nEventer Map 이메일 인증 코드입니다:\r\n\r\n  %s\r\n\r\n인증 코드는 5분간 유효합니다.\r\n본인이 요청하지 않은 경우 이 메일을 무시해 주세요.\r\n",
	},
	"en": {
		Subject: "[Eventer Map] Verification Code",
		Body: "Hello,\r\n\r\nHere is your verification code for Eventer Map:\r\n\r\n  %s\r\n\r\nThis code is valid for 5 minutes.\r\nIf you did not request this, please ignore this email.\r\n",
	},
	"zh": {
		Subject: "[Eventer Map] 邮箱验证码",
		Body: "您好，\r\n\r\n这是您的 Eventer Map 邮箱验证码：\r\n\r\n  %s\r\n\r\n验证码有效期为5分钟。\r\n如非本人操作，请忽略此邮件。\r\n",
	},
}

// NormalizeLang resolves an Accept-Language header or language code to a supported language.
// Defaults to "ja" (the primary language of Eventer Map).
func NormalizeLang(acceptLang string) string {
	raw := strings.ToLower(strings.TrimSpace(acceptLang))
	if raw == "" {
		return "ja"
	}

	// If Accept-Language is a comma-separated list (e.g. "ko-KR,ko;q=0.9,ja;q=0.8")
	// inspect language tags in order of appearance
	parts := strings.Split(raw, ",")
	for _, part := range parts {
		tag := strings.TrimSpace(strings.Split(part, ";")[0])
		switch {
		case strings.HasPrefix(tag, "ja"):
			return "ja"
		case strings.HasPrefix(tag, "ko"):
			return "ko"
		case strings.HasPrefix(tag, "zh"):
			return "zh"
		case strings.HasPrefix(tag, "en"):
			return "en"
		}
	}

	return "ja"
}

// GetVerificationTemplate returns the verification email template for the given language.
func GetVerificationTemplate(lang string, code string) (subject string, body string) {
	norm := NormalizeLang(lang)
	tmpl, ok := verificationTemplates[norm]
	if !ok {
		tmpl = verificationTemplates["ja"]
	}
	return tmpl.Subject, fmt.Sprintf(tmpl.Body, code)
}

// EncodeHeaderSubject encodes non-ASCII email subjects using RFC 2047 Base64 encoding.
func EncodeHeaderSubject(subject string) string {
	return mime.BEncoding.Encode("UTF-8", subject)
}

