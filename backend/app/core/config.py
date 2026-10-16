from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ExpenseFlow API"
    app_version: str = "dev"
    database_url: str = "postgresql+psycopg://expenseflow:expenseflow@localhost:5432/expenseflow"
    log_level: str = "INFO"
    cors_origins: list[str] = []

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
