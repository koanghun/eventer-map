package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

const (
	ProviderX = "x"

	ModeLogin  = "login"
	ModeLink   = "link"
	ModeReauth = "reauth"

	OAuthStateTTL = 10 * time.Minute
)

var (
	ErrOAuthStateNotFound          = errors.New("oauth state not found or expired")
	ErrOAuthStateStoreNotConfigured = errors.New("oauth state store is not configured")
)

// OAuthState represents a short-lived server-side PKCE & CSRF state entry.
type OAuthState struct {
	StateHash    string
	Provider     string
	Mode         string
	CodeVerifier string
	UserID       string
	ExpiresAt    time.Time
}

// OAuthStateStore persists and atomically consumes OAuth PKCE/CSRF state.
type OAuthStateStore interface {
	Save(ctx context.Context, state OAuthState) error
	Consume(ctx context.Context, stateHash, provider string) (OAuthState, error)
}

// HashState returns the SHA-256 hex digest of a raw OAuth state token so the
// plaintext token never needs to be persisted in storage.
func HashState(rawState string) string {
	sum := sha256.Sum256([]byte(rawState))
	return hex.EncodeToString(sum[:])
}

type dynamoDBClient interface {
	PutItem(ctx context.Context, params *dynamodb.PutItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	DeleteItem(ctx context.Context, params *dynamodb.DeleteItemInput, optFns ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error)
}

// DynamoDBOAuthStateStore stores OAuth states in AWS DynamoDB with TTL and
// conditional DeleteItem for atomic single-use consumption.
type DynamoDBOAuthStateStore struct {
	client    dynamoDBClient
	tableName string
	now       func() time.Time
}

// NewDynamoDBOAuthStateStore creates a DynamoDB-backed OAuthStateStore.
func NewDynamoDBOAuthStateStore(client dynamoDBClient, tableName string) *DynamoDBOAuthStateStore {
	return &DynamoDBOAuthStateStore{
		client:    client,
		tableName: tableName,
		now:       time.Now,
	}
}

func (s *DynamoDBOAuthStateStore) Save(ctx context.Context, state OAuthState) error {
	if s == nil || s.client == nil || s.tableName == "" {
		return ErrOAuthStateStoreNotConfigured
	}
	item := map[string]types.AttributeValue{
		"state_hash":    &types.AttributeValueMemberS{Value: state.StateHash},
		"provider":      &types.AttributeValueMemberS{Value: state.Provider},
		"mode":          &types.AttributeValueMemberS{Value: state.Mode},
		"code_verifier": &types.AttributeValueMemberS{Value: state.CodeVerifier},
		"expires_at":    &types.AttributeValueMemberN{Value: strconv.FormatInt(state.ExpiresAt.Unix(), 10)},
	}
	if state.UserID != "" {
		item["user_id"] = &types.AttributeValueMemberS{Value: state.UserID}
	}

	_, err := s.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           aws.String(s.tableName),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(state_hash)"),
	})
	return err
}

func (s *DynamoDBOAuthStateStore) Consume(ctx context.Context, stateHash, provider string) (OAuthState, error) {
	if s == nil || s.client == nil || s.tableName == "" {
		return OAuthState{}, ErrOAuthStateStoreNotConfigured
	}
	nowUnix := strconv.FormatInt(s.now().Unix(), 10)
	out, err := s.client.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(s.tableName),
		Key: map[string]types.AttributeValue{
			"state_hash": &types.AttributeValueMemberS{Value: stateHash},
		},
		ConditionExpression: aws.String("provider = :p AND expires_at > :now"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":p":   &types.AttributeValueMemberS{Value: provider},
			":now": &types.AttributeValueMemberN{Value: nowUnix},
		},
		ReturnValues: types.ReturnValueAllOld,
	})
	if err != nil {
		var condErr *types.ConditionalCheckFailedException
		if errors.As(err, &condErr) {
			return OAuthState{}, ErrOAuthStateNotFound
		}
		return OAuthState{}, err
	}
	if len(out.Attributes) == 0 {
		return OAuthState{}, ErrOAuthStateNotFound
	}

	return parseDynamoOAuthState(out.Attributes)
}

func parseDynamoOAuthState(attrs map[string]types.AttributeValue) (OAuthState, error) {
	getString := func(key string) (string, bool) {
		v, ok := attrs[key]
		if !ok {
			return "", false
		}
		s, ok := v.(*types.AttributeValueMemberS)
		if !ok {
			return "", false
		}
		return s.Value, true
	}

	stateHash, ok1 := getString("state_hash")
	provider, ok2 := getString("provider")
	mode, ok3 := getString("mode")
	verifier, ok4 := getString("code_verifier")
	if !ok1 || !ok2 || !ok3 || !ok4 {
		return OAuthState{}, ErrOAuthStateNotFound
	}

	expAttr, ok := attrs["expires_at"].(*types.AttributeValueMemberN)
	if !ok {
		return OAuthState{}, ErrOAuthStateNotFound
	}
	expSec, err := strconv.ParseInt(expAttr.Value, 10, 64)
	if err != nil {
		return OAuthState{}, ErrOAuthStateNotFound
	}

	userID, _ := getString("user_id")

	return OAuthState{
		StateHash:    stateHash,
		Provider:     provider,
		Mode:         mode,
		CodeVerifier: verifier,
		UserID:       userID,
		ExpiresAt:    time.Unix(expSec, 0).UTC(),
	}, nil
}

// InMemoryOAuthStateStore is a single-process OAuthStateStore for local development.
type InMemoryOAuthStateStore struct {
	mu     sync.Mutex
	states map[string]OAuthState
	now    func() time.Time
}

// NewInMemoryOAuthStateStore creates an in-memory OAuthStateStore.
func NewInMemoryOAuthStateStore() *InMemoryOAuthStateStore {
	return &InMemoryOAuthStateStore{
		states: make(map[string]OAuthState),
		now:    time.Now,
	}
}

func (s *InMemoryOAuthStateStore) Save(_ context.Context, state OAuthState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.now()
	for k, v := range s.states {
		if v.ExpiresAt.Unix() <= now.Unix() {
			delete(s.states, k)
		}
	}
	if _, exists := s.states[state.StateHash]; exists {
		return errors.New("oauth state collision")
	}
	s.states[state.StateHash] = state
	return nil
}

func (s *InMemoryOAuthStateStore) Consume(_ context.Context, stateHash, provider string) (OAuthState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	st, ok := s.states[stateHash]
	if !ok {
		return OAuthState{}, ErrOAuthStateNotFound
	}
	delete(s.states, stateHash)

	if st.Provider != provider || st.ExpiresAt.Unix() <= s.now().Unix() {
		return OAuthState{}, ErrOAuthStateNotFound
	}
	return st, nil
}

// NewOAuthStateStoreFromEnv initializes DynamoDBOAuthStateStore when
// DYNAMODB_OAUTH_STATE_TABLE is configured, or falls back to InMemoryOAuthStateStore
// strictly in local non-Lambda development.
func NewOAuthStateStoreFromEnv(ctx context.Context) (OAuthStateStore, error) {
	tableName := strings.TrimSpace(os.Getenv("DYNAMODB_OAUTH_STATE_TABLE"))
	if tableName == "" {
		env := strings.TrimSpace(os.Getenv("ENV"))
		isLocal := (env == "" || env == "local") && os.Getenv("AWS_LAMBDA_FUNCTION_NAME") == ""
		if isLocal {
			log.Println("WARNING: DYNAMODB_OAUTH_STATE_TABLE is not set; using ephemeral in-memory OAuth state store (instance-isolated, local dev only)")
			return NewInMemoryOAuthStateStore(), nil
		}
		return nil, ErrOAuthStateStoreNotConfigured
	}

	region := strings.TrimSpace(os.Getenv("AWS_REGION"))
	if region == "" {
		region = strings.TrimSpace(os.Getenv("AWS_DEFAULT_REGION"))
	}
	if region == "" {
		region = "ap-northeast-1"
	}

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config for DynamoDB: %w", err)
	}

	var opts []func(*dynamodb.Options)
	if endpoint := strings.TrimSpace(os.Getenv("DYNAMODB_ENDPOINT_URL")); endpoint != "" {
		opts = append(opts, func(o *dynamodb.Options) {
			o.BaseEndpoint = aws.String(endpoint)
		})
	}

	client := dynamodb.NewFromConfig(cfg, opts...)
	return NewDynamoDBOAuthStateStore(client, tableName), nil
}

