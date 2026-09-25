import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database.connection import check_database_connection,ensure_indexes_and_seed,connection_target_description
from app.routers import auth,health,products,orders,stock,reports,customers,company

logger=logging.getLogger("app.startup")
error_logger=logging.getLogger("app.errors")

@asynccontextmanager
async def lifespan(app:FastAPI):
    try:
        ensure_indexes_and_seed()
        if check_database_connection():
            logger.info("MongoDB connection OK (%s)",connection_target_description())
        else:
            logger.error("MongoDB connection FAILED (%s)",connection_target_description())
    except Exception as exc:
        logger.error("MongoDB startup initialization failed (%s)",type(exc).__name__)
    yield

app=FastAPI(title=settings.app_name,version=settings.api_version,
            description="Farm-Craft backend API",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_origins_list,
                   allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
app.include_router(health.router,prefix=settings.api_prefix)
app.include_router(auth.router,prefix=settings.api_prefix)
app.include_router(products.router,prefix=settings.api_prefix)
app.include_router(orders.router,prefix=settings.api_prefix)
app.include_router(stock.router,prefix=settings.api_prefix)
app.include_router(reports.router,prefix=settings.api_prefix)
app.include_router(customers.router,prefix=settings.api_prefix)
app.include_router(company.router,prefix=settings.api_prefix)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Without this handler, any unexpected exception (a dropped MongoDB
    # connection, a bad query, etc.) falls through to Starlette's default
    # error response, which is a *plain-text* "Internal Server Error" body.
    # The admin/customer frontends always call response.json() on API
    # responses, so that plain-text body fails to parse and surfaces as
    # "Unexpected token 'I', "Internal S"... is not valid JSON" — hiding the
    # real backend error instead of reporting it. Returning JSON here, with
    # the real exception logged server-side, keeps every unexpected failure
    # inspectable instead of hidden behind a frontend parse error.
    error_logger.exception(
        "Unhandled exception on %s %s: %s",
        request.method, request.url.path, exc,
    )
    detail = str(exc) if settings.app_debug else "Internal server error. Please try again or contact support."
    return JSONResponse(status_code=500, content={"detail": detail})

@app.get("/")
def root():
    return {"message":f"{settings.app_name} is running","docs":"/docs","health":f"{settings.api_prefix}/health"}
