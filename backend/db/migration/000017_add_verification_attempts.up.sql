ALTER TABLE verification_tokens ADD COLUMN attempts INT NOT NULL DEFAULT 0;

-- Google accounts have a provider-verified email.
UPDATE users SET is_email_verified = true WHERE google_id IS NOT NULL;

