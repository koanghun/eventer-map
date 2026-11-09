package handler

import (
	"errors"
	"log"
	"net/http"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/service"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// 스레드 작성 요청 바디 최대 크기 (본문 1000자 * UTF-8 최대 4바이트 + JSON 여유분)
const maxThreadRequestBodyBytes = 8 << 10

// TODO(security): 스레드 작성/추천 API에 유저·IP 단위 Rate Limiting 적용 필요 (현재 프로젝트 공통 Rate Limiter 미구현)

func viewerIDFromRequest(r *http.Request) *uuid.UUID {
	if id, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID); ok && id != uuid.Nil {
		return &id
	}
	return nil
}

func mapThreadViewToResponse(v service.ThreadView) EventThread {
	t := EventThread{
		Id:             openapi_types.UUID(v.ID),
		EventId:        openapi_types.UUID(v.EventID),
		Content:        v.Content,
		RecommendCount: int(v.RecommendCount),
		IsRecommended:  v.IsRecommended,
		IsMine:         v.IsMine,
		CreatedAt:      v.CreatedAt,
		UpdatedAt:      v.UpdatedAt,
	}
	if v.AuthorID != nil {
		t.Author = &EventThreadAuthor{
			Id:          openapi_types.UUID(*v.AuthorID),
			DisplayName: v.AuthorDisplayName,
		}
	}
	return t
}

// ListEventThreads implements GET /events/{eventId}/threads
func (s *Server) ListEventThreads(w http.ResponseWriter, r *http.Request, eventId openapi_types.UUID, params ListEventThreadsParams) {
	cursor := ""
	if params.Cursor != nil {
		cursor = *params.Cursor
	}
	limit := service.DefaultThreadLimit
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}

	views, nextCursor, err := s.services.Thread.ListThreads(r.Context(), eventId, viewerIDFromRequest(r), cursor, limit)
	if err != nil {
		if errors.Is(err, service.ErrInvalidThreadCursor) {
			RespondError(w, http.StatusBadRequest, "Invalid cursor")
			return
		}
		log.Printf("[ListEventThreads] ListThreads error (eventID=%s): %v", eventId, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve threads")
		return
	}

	threads := make([]EventThread, 0, len(views))
	for _, v := range views {
		threads = append(threads, mapThreadViewToResponse(v))
	}

	RespondJSON(w, http.StatusOK, EventThreadListResponse{
		Threads:    threads,
		NextCursor: nextCursor,
	})
}

// CreateEventThread implements POST /events/{eventId}/threads
func (s *Server) CreateEventThread(w http.ResponseWriter, r *http.Request, eventId openapi_types.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxThreadRequestBodyBytes)
	var body CreateEventThreadJSONRequestBody
	if err := ParseJSON(r, &body); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	view, err := s.services.Thread.CreateThread(r.Context(), eventId, userID, body.Content)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidThreadContent):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUserNotFound):
			RespondError(w, http.StatusUnauthorized, "user not authenticated")
		case errors.Is(err, service.ErrUserBanned):
			RespondError(w, http.StatusForbidden, "User is banned")
		case errors.Is(err, service.ErrEventNotFound):
			RespondError(w, http.StatusNotFound, "Event not found")
		default:
			log.Printf("[CreateEventThread] CreateThread error (eventID=%s, userID=%s): %v", eventId, userID, err)
			RespondError(w, http.StatusInternalServerError, "Failed to create thread")
		}
		return
	}

	RespondJSON(w, http.StatusCreated, mapThreadViewToResponse(*view))
}

// DeleteEventThread implements DELETE /event-threads/{threadId}
func (s *Server) DeleteEventThread(w http.ResponseWriter, r *http.Request, threadId openapi_types.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	if err := s.services.Thread.DeleteThread(r.Context(), threadId, userID); err != nil {
		switch {
		case errors.Is(err, service.ErrThreadNotFound):
			RespondError(w, http.StatusNotFound, "Thread not found")
		case errors.Is(err, service.ErrThreadForbidden):
			RespondError(w, http.StatusForbidden, "Not allowed to delete this thread")
		default:
			log.Printf("[DeleteEventThread] DeleteThread error (threadID=%s, userID=%s): %v", threadId, userID, err)
			RespondError(w, http.StatusInternalServerError, "Failed to delete thread")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RecommendEventThread implements PUT /event-threads/{threadId}/recommend
func (s *Server) RecommendEventThread(w http.ResponseWriter, r *http.Request, threadId openapi_types.UUID) {
	s.setThreadRecommendation(w, r, threadId, true)
}

// UnrecommendEventThread implements DELETE /event-threads/{threadId}/recommend
func (s *Server) UnrecommendEventThread(w http.ResponseWriter, r *http.Request, threadId openapi_types.UUID) {
	s.setThreadRecommendation(w, r, threadId, false)
}

func (s *Server) setThreadRecommendation(w http.ResponseWriter, r *http.Request, threadId openapi_types.UUID, recommend bool) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	count, err := s.services.Thread.SetRecommendation(r.Context(), threadId, userID, recommend)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrThreadNotFound):
			RespondError(w, http.StatusNotFound, "Thread not found")
		case errors.Is(err, service.ErrCannotRecommendOwnThread):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUserNotFound):
			RespondError(w, http.StatusUnauthorized, "user not authenticated")
		case errors.Is(err, service.ErrUserBanned):
			RespondError(w, http.StatusForbidden, "User is banned")
		default:
			log.Printf("[setThreadRecommendation] SetRecommendation error (threadID=%s, userID=%s, recommend=%t): %v", threadId, userID, recommend, err)
			RespondError(w, http.StatusInternalServerError, "Failed to update recommendation")
		}
		return
	}

	RespondJSON(w, http.StatusOK, ThreadRecommendResult{
		ThreadId:       threadId,
		Recommended:    recommend,
		RecommendCount: int(count),
	})
}

