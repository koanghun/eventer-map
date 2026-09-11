ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE verification_tokens (
    email VARCHAR PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
