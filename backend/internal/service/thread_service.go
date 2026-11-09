package service

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrEventNotFound            = errors.New("event not found")
	ErrThreadNotFound           = errors.New("thread not found")
	ErrThreadForbidden          = errors.New("not allowed to modify this thread")
	ErrCannotRecommendOwnThread = errors.New("cannot recommend your own thread")
	ErrInvalidThreadContent     = errors.New("thread content must be 1-1000 characters")
	ErrInvalidThreadCursor      = errors.New("invalid cursor")
	ErrUserNotFound             = errors.New("user not found")
)

const (
	MaxThreadContentLength       = 1000
	DefaultThreadLimit     int32 = 20
	MaxThreadLimit         int32 = 50
)

// ThreadView 는 HTTP 계층과 무관한 스레드 조회 모델입니다.
type ThreadView struct {
	ID                uuid.UUID
	EventID           uuid.UUID
	AuthorID          *uuid.UUID
	AuthorDisplayName string
	Content           string
	RecommendCount    int32
	IsRecommended     bool
	IsMine            bool
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type ThreadService struct {
	repo *repository.Queries
	db   *sql.DB
}

func NewThreadService(repo *repository.Queries, db *sql.DB) *ThreadService {
	return &ThreadService{repo: repo, db: db}
}

// threadCursor 는 (recommend_count, created_at, id) 복합 정렬 키입니다.
type threadCursor struct {
	RecommendCount int32
	CreatedAt      time.Time
	ID             uuid.UUID
}

func encodeThreadCursor(c threadCursor) string {
	raw := fmt.Sprintf("%d|%d|%s", c.RecommendCount, c.CreatedAt.UnixNano(), c.ID.String())
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeThreadCursor(s string) (threadCursor, error) {
	if len(s) > 256 {
		return threadCursor{}, ErrInvalidThreadCursor
	}
	raw, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return threadCursor{}, ErrInvalidThreadCursor
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 3 {
		return threadCursor{}, ErrInvalidThreadCursor
	}
	count, err := strconv.ParseInt(parts[0], 10, 32)
	if err != nil || count < 0 {
		return threadCursor{}, ErrInvalidThreadCursor
	}
	nanos, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return threadCursor{}, ErrInvalidThreadCursor
	}
	id, err := uuid.Parse(parts[2])
	if err != nil {
		return threadCursor{}, ErrInvalidThreadCursor
	}
	return threadCursor{
		RecommendCount: int32(count),
		CreatedAt:      time.Unix(0, nanos).UTC(),
		ID:             id,
	}, nil
}

func nullableViewer(viewerID *uuid.UUID) uuid.NullUUID {
	if viewerID == nil || *viewerID == uuid.Nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *viewerID, Valid: true}
}

func newThreadView(
	id, eventID uuid.UUID,
	authorID uuid.NullUUID,
	authorName, content string,
	recommendCount int32,
	isRecommended bool,
	createdAt, updatedAt time.Time,
	viewerID *uuid.UUID,
) ThreadView {
	v := ThreadView{
		ID:                id,
		EventID:           eventID,
		AuthorDisplayName: authorName,
		Content:           content,
		RecommendCount:    recommendCount,
		IsRecommended:     isRecommended,
		CreatedAt:         createdAt,
		UpdatedAt:         updatedAt,
	}
	if authorID.Valid {
		a := authorID.UUID
		v.AuthorID = &a
		v.IsMine = viewerID != nil && *viewerID == a
	}
	return v
}

// normalizeThreadContent 는 본문을 정규화하고 길이/문자 제약을 검증합니다.
func normalizeThreadContent(content string) (string, error) {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimSpace(content)
	if content == "" || !utf8.ValidString(content) || strings.ContainsRune(content, 0) {
		return "", ErrInvalidThreadContent
	}
	if utf8.RuneCountInString(content) > MaxThreadContentLength {
		return "", ErrInvalidThreadContent
	}
	return content, nil
}

// requireActiveUser 는 유저 존재 및 정지 여부를 확인합니다 (조회 실패 시 거부 = fail closed).
func (s *ThreadService) requireActiveUser(ctx context.Context, userID uuid.UUID) (repository.User, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return repository.User{}, ErrUserNotFound
		}
		return repository.User{}, err
	}
	if user.IsBanned {
		return repository.User{}, ErrUserBanned
	}
	return user, nil
}

// withTx 는 트랜잭션 내에서 fn 을 실행합니다. (DB 미연결 환경에서는 트랜잭션 없이 실행)
func (s *ThreadService) withTx(ctx context.Context, fn func(q *repository.Queries) error) error {
	if s.db == nil {
		return fn(s.repo)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := fn(s.repo.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit()
}

// ListThreads 는 이벤트의 스레드를 추천순으로 커서 페이지네이션하여 반환합니다.
func (s *ThreadService) ListThreads(
	ctx context.Context,
	eventID uuid.UUID,
	viewerID *uuid.UUID,
	cursor string,
	limit int32,
) ([]ThreadView, *string, error) {
	if limit <= 0 {
		limit = DefaultThreadLimit
	}
	if limit > MaxThreadLimit {
		limit = MaxThreadLimit
	}

	params := repository.ListEventThreadsParams{
		ViewerID: nullableViewer(viewerID),
		EventID:  eventID,
		RowLimit: limit + 1, // hasMore 판별용 1건 추가 조회
	}

	if cursor != "" {
		c, err := decodeThreadCursor(cursor)
		if err != nil {
			return nil, nil, err
		}
		params.CursorID = uuid.NullUUID{UUID: c.ID, Valid: true}
		params.CursorRecommendCount = sql.NullInt32{Int32: c.RecommendCount, Valid: true}
		params.CursorCreatedAt = sql.NullTime{Time: c.CreatedAt, Valid: true}
	}

	rows, err := s.repo.ListEventThreads(ctx, params)
	if err != nil {
		return nil, nil, err
	}

	var nextCursor *string
	if int32(len(rows)) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		c := encodeThreadCursor(threadCursor{
			RecommendCount: last.RecommendCount,
			CreatedAt:      last.CreatedAt,
			ID:             last.ID,
		})
		nextCursor = &c
	}

	views := make([]ThreadView, 0, len(rows))
	for _, r := range rows {
		views = append(views, newThreadView(
			r.ID, r.EventID, r.AuthorID, r.AuthorDisplayName, r.Content,
			r.RecommendCount, r.IsRecommended, r.CreatedAt, r.UpdatedAt, viewerID,
		))
	}
	return views, nextCursor, nil
}

// CreateThread 는 이벤트에 새 스레드를 작성합니다.
func (s *ThreadService) CreateThread(ctx context.Context, eventID, authorID uuid.UUID, content string) (*ThreadView, error) {
	normalized, err := normalizeThreadContent(content)
	if err != nil {
		return nil, err
	}

	if _, err := s.requireActiveUser(ctx, authorID); err != nil {
		return nil, err
	}

	if _, err := s.repo.GetEvent(ctx, eventID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrEventNotFound
		}
		return nil, err
	}

	created, err := s.repo.CreateEventThread(ctx, repository.CreateEventThreadParams{
		EventID:  eventID,
		AuthorID: uuid.NullUUID{UUID: authorID, Valid: true},
		Content:  normalized,
	})
	if err != nil {
		return nil, err
	}

	viewer := authorID
	row, err := s.repo.GetEventThreadView(ctx, repository.GetEventThreadViewParams{
		ViewerID: nullableViewer(&viewer),
		ID:       created.ID,
	})
	if err != nil {
		return nil, err
	}

	v := newThreadView(
		row.ID, row.EventID, row.AuthorID, row.AuthorDisplayName, row.Content,
		row.RecommendCount, row.IsRecommended, row.CreatedAt, row.UpdatedAt, &viewer,
	)
	return &v, nil
}

// DeleteThread 는 작성자 본인 또는 관리자만 스레드를 삭제할 수 있습니다.
func (s *ThreadService) DeleteThread(ctx context.Context, threadID, userID uuid.UUID) error {
	thread, err := s.repo.GetEventThread(ctx, threadID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrThreadNotFound
		}
		return err
	}

	isAuthor := thread.AuthorID.Valid && thread.AuthorID.UUID == userID
	if !isAuthor {
		user, err := s.repo.GetUserByID(ctx, userID)
		if err != nil || user.Role != "ADMIN" {
			return ErrThreadForbidden
		}
	}

	affected, err := s.repo.DeleteEventThread(ctx, threadID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrThreadNotFound
	}
	return nil
}

// SetRecommendation 은 스레드 추천(recommend=true) 또는 추천 취소(false)를 멱등적으로 수행하고
// 최종 추천 수를 반환합니다. 추천 레코드와 카운터는 동일 트랜잭션에서 갱신됩니다.
func (s *ThreadService) SetRecommendation(ctx context.Context, threadID, userID uuid.UUID, recommend bool) (int32, error) {
	if recommend {
		if _, err := s.requireActiveUser(ctx, userID); err != nil {
			return 0, err
		}
	}

	var count int32
	err := s.withTx(ctx, func(q *repository.Queries) error {
		thread, err := q.GetEventThread(ctx, threadID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrThreadNotFound
			}
			return err
		}

		if recommend && thread.AuthorID.Valid && thread.AuthorID.UUID == userID {
			return ErrCannotRecommendOwnThread
		}

		var affected int64
		var delta int32
		if recommend {
			affected, err = q.InsertThreadRecommendation(ctx, repository.InsertThreadRecommendationParams{
				UserID:   userID,
				ThreadID: threadID,
			})
			delta = 1
		} else {
			affected, err = q.DeleteThreadRecommendation(ctx, repository.DeleteThreadRecommendationParams{
				UserID:   userID,
				ThreadID: threadID,
			})
			delta = -1
		}
		if err != nil {
			return err
		}

		if affected == 0 {
			// 이미 원하는 상태 (멱등) — 카운터 변경 없음
			count = thread.RecommendCount
			return nil
		}

		count, err = q.AddThreadRecommendCount(ctx, repository.AddThreadRecommendCountParams{
			Delta: delta,
			ID:    threadID,
		})
		return err
	})
	if err != nil {
		return 0, err
	}
	return count, nil
}

