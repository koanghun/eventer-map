package handler

import (
	"net/http"

	"github.com/oapi-codegen/runtime"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (siw *ServerInterfaceWrapper) wrapWithMiddlewares(h http.HandlerFunc) http.Handler {
	handler := http.Handler(h)
	for _, mw := range siw.HandlerMiddlewares {
		handler = mw(handler)
	}
	return handler
}

func (siw *ServerInterfaceWrapper) bindPathUUID(w http.ResponseWriter, r *http.Request, name string) (openapi_types.UUID, bool) {
	var val openapi_types.UUID
	err := runtime.BindStyledParameterWithOptions("simple", name, r.PathValue(name), &val, runtime.BindStyledParameterOptions{
		ParamLocation:    runtime.ParamLocationPath,
		Explode:          false,
		Required:         true,
		Type:             "string",
		Format:           "uuid",
		ValueIsUnescaped: true,
	})
	if err != nil {
		siw.ErrorHandlerFunc(w, r, &InvalidParamFormatError{ParamName: name, Err: err})
		return openapi_types.UUID{}, false
	}
	return val, true
}

func (siw *ServerInterfaceWrapper) PutArtistsArtistIdCredit(w http.ResponseWriter, r *http.Request) {
	artistId, ok := siw.bindPathUUID(w, r, "artistId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.PutArtistsArtistIdCredit(w, r, artistId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) PutVenuesVenueIdCredit(w http.ResponseWriter, r *http.Request) {
	venueId, ok := siw.bindPathUUID(w, r, "venueId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.PutVenuesVenueIdCredit(w, r, venueId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) DeleteEventsEventId(w http.ResponseWriter, r *http.Request) {
	eventId, ok := siw.bindPathUUID(w, r, "eventId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.DeleteEventsEventId(w, r, eventId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) PostEventsEventIdApprove(w http.ResponseWriter, r *http.Request) {
	eventId, ok := siw.bindPathUUID(w, r, "eventId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.PostEventsEventIdApprove(w, r, eventId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) PutEventsEventIdCredit(w http.ResponseWriter, r *http.Request) {
	eventId, ok := siw.bindPathUUID(w, r, "eventId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.PutEventsEventIdCredit(w, r, eventId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) ListModificationRequests(w http.ResponseWriter, r *http.Request) {
	var params ListModificationRequestsParams
	if err := runtime.BindQueryParameterWithOptions("form", true, true, "entityType", r.URL.Query(), &params.EntityType, runtime.BindQueryParameterOptions{Type: "string"}); err != nil {
		siw.ErrorHandlerFunc(w, r, &InvalidParamFormatError{ParamName: "entityType", Err: err})
		return
	}
	if err := runtime.BindQueryParameterWithOptions("form", true, true, "entityId", r.URL.Query(), &params.EntityId, runtime.BindQueryParameterOptions{Type: "string", Format: "uuid"}); err != nil {
		siw.ErrorHandlerFunc(w, r, &InvalidParamFormatError{ParamName: "entityId", Err: err})
		return
	}
	if err := runtime.BindQueryParameterWithOptions("form", true, false, "status", r.URL.Query(), &params.Status, runtime.BindQueryParameterOptions{Type: "string"}); err != nil {
		siw.ErrorHandlerFunc(w, r, &InvalidParamFormatError{ParamName: "status", Err: err})
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.ListModificationRequests(w, r, params)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) CreateModificationRequest(w http.ResponseWriter, r *http.Request) {
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.CreateModificationRequest(w, r)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) DeleteModificationRequest(w http.ResponseWriter, r *http.Request) {
	requestId, ok := siw.bindPathUUID(w, r, "requestId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.DeleteModificationRequest(w, r, requestId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) VoteModificationRequestTrust(w http.ResponseWriter, r *http.Request) {
	requestId, ok := siw.bindPathUUID(w, r, "requestId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.VoteModificationRequestTrust(w, r, requestId)
	}).ServeHTTP(w, r)
}

func (siw *ServerInterfaceWrapper) ApplyModificationRequest(w http.ResponseWriter, r *http.Request) {
	requestId, ok := siw.bindPathUUID(w, r, "requestId")
	if !ok {
		return
	}
	siw.wrapWithMiddlewares(func(w http.ResponseWriter, r *http.Request) {
		siw.Handler.ApplyModificationRequest(w, r, requestId)
	}).ServeHTTP(w, r)
}
