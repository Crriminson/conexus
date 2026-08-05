from fastapi import FastAPI
from routes.health import router as health_router

app = FastAPI(
    title="Conexus OCR API",
    description="Backend API for IPO Document Processing",
    version="1.0.0"
)

app.include_router(health_router)

@app.get("/")
def home():
    return {
        "message": "Welcome to Conexus OCR API",
        "status": "Backend is running successfully!"
    }