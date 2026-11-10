package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

// SMTPMailer sends verification emails through an SMTP server.
type SMTPMailer struct {
	host, port, user, pass, from string
}

// NewFromEnv returns an SMTPMailer when SMTP_HOST is set, otherwise a MockMailer.
// Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
func NewFromEnv() Mailer {
	host := os.Getenv("SMTP_HOST")
	if host == "" {
		log.Printf("SMTP_HOST not set: using MockMailer (emails are only logged to console)")
		return NewMockMailer()
	}
	port := os.Getenv("SMTP_PORT")
	if port == "" {
		port = "587"
	}
	user := os.Getenv("SMTP_USER")
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		from = user
	}
	log.Printf("SMTPMailer initialized with host=%s, port=%s, from=%s", host, port, from)
	return &SMTPMailer{host: host, port: port, user: user, pass: os.Getenv("SMTP_PASSWORD"), from: from}
}

// SendVerificationEmail sends the localized verification code to the given address.
func (m *SMTPMailer) SendVerificationEmail(ctx context.Context, toEmail string, code string, lang string) error {
	// Prevent header injection.
	if strings.ContainsAny(toEmail, "\r\n") {
		return fmt.Errorf("invalid recipient")
	}

	addr := m.host + ":" + m.port
	rawSubject, body := GetVerificationTemplate(lang, code)
	encodedSubject := EncodeHeaderSubject(rawSubject)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n%s",
		m.from, toEmail, encodedSubject, body)

	var auth smtp.Auth
	if m.user != "" {
		auth = smtp.PlainAuth("", m.user, m.pass, m.host)
	}

	// Port 465 uses SSL/TLS direct connection
	if m.port == "465" {
		tlsConfig := &tls.Config{
			ServerName: m.host,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to dial SMTP over TLS: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, m.host)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
		defer client.Close()

		if auth != nil {
			if ok, _ := client.Extension("AUTH"); ok {
				if err = client.Auth(auth); err != nil {
					return fmt.Errorf("SMTP auth error: %w", err)
				}
			}
		}

		if err = client.Mail(m.from); err != nil {
			return fmt.Errorf("SMTP MAIL error: %w", err)
		}
		if err = client.Rcpt(toEmail); err != nil {
			return fmt.Errorf("SMTP RCPT error: %w", err)
		}
		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("SMTP DATA error: %w", err)
		}
		if _, err = w.Write([]byte(msg)); err != nil {
			return fmt.Errorf("SMTP write error: %w", err)
		}
		if err = w.Close(); err != nil {
			return fmt.Errorf("SMTP close writer error: %w", err)
		}
		return client.Quit()
	}

	// Port 587 or default STARTTLS
	return smtp.SendMail(addr, auth, m.from, []string{toEmail}, []byte(msg))
}
