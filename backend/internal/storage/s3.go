package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// Uploader defines the interface for uploading files and returning their public URL.
type Uploader interface {
	UploadArtistProfileImage(ctx context.Context, body io.Reader, contentType string) (string, error)
}

// S3Storage implements Uploader using AWS S3.
type S3Storage struct {
	client        *s3.Client
	bucketName    string
	region        string
	publicBaseURL string
}

// NewS3StorageFromEnv initializes an S3Storage instance from environment variables.
// Required: S3_MEDIA_BUCKET (or AWS_S3_BUCKET).
// Optional: AWS_REGION (defaults to ap-northeast-2), S3_PUBLIC_BASE_URL.
func NewS3StorageFromEnv(ctx context.Context) (*S3Storage, error) {
	bucketName := strings.TrimSpace(os.Getenv("S3_MEDIA_BUCKET"))
	if bucketName == "" {
		bucketName = strings.TrimSpace(os.Getenv("AWS_S3_BUCKET"))
	}
	if bucketName == "" {
		return nil, nil
	}

	region := strings.TrimSpace(os.Getenv("AWS_REGION"))
	if region == "" {
		region = strings.TrimSpace(os.Getenv("AWS_DEFAULT_REGION"))
	}
	if region == "" {
		region = "ap-northeast-2"
	}

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	var s3Opts []func(*s3.Options)
	if endpoint := strings.TrimSpace(os.Getenv("S3_ENDPOINT_URL")); endpoint != "" {
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = true
		})
	}

	client := s3.NewFromConfig(cfg, s3Opts...)
	publicBaseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("S3_PUBLIC_BASE_URL")), "/")

	return &S3Storage{
		client:        client,
		bucketName:    bucketName,
		region:        region,
		publicBaseURL: publicBaseURL,
	}, nil
}

// UploadArtistProfileImage uploads the original profile image stream to S3 and returns its S3 URL.
func (s *S3Storage) UploadArtistProfileImage(ctx context.Context, body io.Reader, contentType string) (string, error) {
	if s == nil || s.client == nil || s.bucketName == "" {
		return "", fmt.Errorf("S3 storage is not configured (set S3_MEDIA_BUCKET)")
	}

	var ext string
	switch contentType {
	case "image/jpeg":
		ext = ".jpg"
	case "image/png":
		ext = ".png"
	default:
		return "", fmt.Errorf("unsupported content type: %s", contentType)
	}

	// Generate an unpredictable UUID key so user filenames are never trusted in paths.
	objectKey := fmt.Sprintf("artists/profiles/%s%s", uuid.NewString(), ext)

	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucketName),
		Key:         aws.String(objectKey),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload image to S3: %w", err)
	}

	if s.publicBaseURL != "" {
		return fmt.Sprintf("%s/%s", s.publicBaseURL, objectKey), nil
	}

	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucketName, s.region, objectKey), nil
}

