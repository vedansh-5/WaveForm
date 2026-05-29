package storage

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	wfConfig "github.com/vedansh-5/waveform/backend/internal/config"
)

type StorageClient interface {
	UploadFile(ctx context.Context, key string, body io.Reader, contentType string) (string, error)
	GetPublicURL(key string) string
}

type r2StorageClient struct {
	s3Client     *s3.Client
	bucketName   string
	publicDomain string
}

func NewR2StorageClient(cfg *wfConfig.Config) (StorageClient, error) {
	if cfg.R2AccountID == "" || cfg.R2AccessKeyID == "" || cfg.R2SecretAccessKey == "" || cfg.R2BucketName == "" {
		return nil, fmt.Errorf("missing Cloudflare R2 configurations")
	}

	r2Endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)

	sdkCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load S3 config: %w", err)
	}

	s3Client := s3.NewFromConfig(sdkCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(r2Endpoint)
	})

	return &r2StorageClient{
		s3Client:     s3Client,
		bucketName:   cfg.R2BucketName,
		publicDomain: cfg.R2PublicDomain,
	}, nil
}

func (c *r2StorageClient) UploadFile(ctx context.Context, key string, body io.Reader, contentType string) (string, error) {
	_, err := c.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucketName),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload object to R2: %w", err)
	}

	return c.GetPublicURL(key), nil
}

func (c *r2StorageClient) GetPublicURL(key string) string {
	if c.publicDomain != "" {
		return fmt.Sprintf("https://%s/%s", c.publicDomain, key)
	}
	return key
}
