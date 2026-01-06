from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import engine, models
from routes import events, places, performers, auth, flags
import os
from dotenv import load_dotenv

load_dotenv()

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Eventer Map API",
    description="API for managing events on a map",
    version="1.0.0"
)

# Configure CORS
origins = os.getenv("CORS_ORIGINS", default="http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(places.router)
app.include_router(performers.router)
app.include_router(flags.router)


@app.get("/")
def root():
    return {
        "message": "Event Map API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
