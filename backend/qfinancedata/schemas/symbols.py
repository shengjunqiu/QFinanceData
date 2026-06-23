from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationInfo, field_validator

DataStatus = Literal["fresh", "stale", "missing", "failed", "partial"]

SYMBOL_PATTERN = re.compile(r"^[A-Z0-9.^=_-]+$")


def normalize_symbol_value(value: str) -> str:
    symbol = value.strip().upper()
    if not symbol:
        raise ValueError("symbol is required.")
    if not SYMBOL_PATTERN.fullmatch(symbol):
        raise ValueError("symbol contains unsupported characters.")
    return symbol


def normalize_text(value: str | None) -> str | None:
    return value.strip() if isinstance(value, str) else value


class SymbolCreate(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    name: str = Field(default="", max_length=160)
    exchange: str = Field(default="", max_length=40)
    asset_type: str = Field(default="equity", min_length=1, max_length=40)
    currency: str = Field(default="", max_length=12)
    group_name: str = Field(default="Default", min_length=1, max_length=80)
    enabled: bool = True

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return normalize_symbol_value(value)

    @field_validator("asset_type", "group_name")
    @classmethod
    def strip_required_text(cls, value: str, info: ValidationInfo) -> str:
        text = value.strip()
        if not text:
            raise ValueError(f"{info.field_name} is required.")
        return text

    @field_validator("name", "exchange", "currency")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class SymbolUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    exchange: str | None = Field(default=None, max_length=40)
    asset_type: str | None = Field(default=None, min_length=1, max_length=40)
    currency: str | None = Field(default=None, max_length=12)
    group_name: str | None = Field(default=None, min_length=1, max_length=80)
    enabled: bool | None = None

    @field_validator("asset_type", "group_name")
    @classmethod
    def strip_optional_required_text(
        cls,
        value: str | None,
        info: ValidationInfo,
    ) -> str | None:
        text = normalize_text(value)
        if text == "":
            raise ValueError(f"{info.field_name} is required.")
        return text

    @field_validator("name", "exchange", "currency")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        return normalize_text(value)


class SymbolRead(BaseModel):
    symbol: str
    name: str
    exchange: str
    asset_type: str
    currency: str
    group_name: str
    enabled: bool
    status: DataStatus = "missing"
    last_data_at: str | None = None
    last_fetch_at: str | None = None
    created_at: str
    updated_at: str
