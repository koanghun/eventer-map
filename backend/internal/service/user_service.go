package service

import (
	"eventer-map-backend/internal/repository"
)

type UserService struct {
	repo *repository.Queries
}

func NewUserService(repo *repository.Queries) *UserService {
	return &UserService{repo: repo}
}
