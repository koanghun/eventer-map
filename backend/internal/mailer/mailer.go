package mailer

import (
	"context"
	"log"
)

// Mailer defines the interface for sending emails.
type Mailer interface {
	SendVerificationEmail(ctx context.Context, toEmail string, code string) error
}

// MockMailer is a mock implementation of Mailer that prints the email to the console.
type MockMailer struct{}

// NewMockMailer creates a new MockMailer.
func NewMockMailer() *MockMailer {
	return &MockMailer{}
}

// SendVerificationEmail prints the verification code to the log.
func (m *MockMailer) SendVerificationEmail(ctx context.Context, toEmail string, code string) error {
	log.Printf("========================================\n")
	log.Printf("[MOCK EMAIL] To: %s\n", toEmail)
	log.Printf("[MOCK EMAIL] Subject: Your Verification Code\n")
	log.Printf("[MOCK EMAIL] Body: Your verification code is: %s\n", code)
	log.Printf("========================================\n")
	return nil
}
