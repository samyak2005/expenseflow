from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ExpenseFlow API"
    app_version: str = "dev"
    database_url: str = "postgresql+psycopg://expenseflow:expenseflow@localhost:5432/expenseflow"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
