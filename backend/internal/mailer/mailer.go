package mailer

import (
	"context"
	"log"
)

// Mailer defines the interface for sending emails.
type Mailer interface {
	SendVerificationEmail(ctx context.Context, toEmail string, code string, lang string) error
}

// MockMailer is a mock implementation of Mailer that prints the email to the console.
type MockMailer struct{}

// NewMockMailer creates a new MockMailer.
func NewMockMailer() *MockMailer {
	return &MockMailer{}
}

// SendVerificationEmail prints the verification code and localized content to the log.
func (m *MockMailer) SendVerificationEmail(ctx context.Context, toEmail string, code string, lang string) error {
	norm := NormalizeLang(lang)
	subject, body := GetVerificationTemplate(norm, code)

	log.Printf("========================================\n")
	log.Printf("[MOCK EMAIL] Lang: %s (raw: %s)\n", norm, lang)
	log.Printf("[MOCK EMAIL] To: %s\n", toEmail)
	log.Printf("[MOCK EMAIL] Subject: %s\n", subject)
	log.Printf("[MOCK EMAIL] Body:\n%s", body)
	log.Printf("========================================\n")
	return nil
}
