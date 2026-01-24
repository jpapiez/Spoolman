"""Import data endpoints."""

import logging
from enum import Enum
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from spoolman.data_import import (
    ImportDataError,
    import_filaments,
    import_spools,
    import_vendors,
    parse_csv,
    parse_json,
)
from spoolman.database.database import get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/import",
    tags=["import"],
)


class FileFormat(str, Enum):
    """File format for import."""

    CSV = "csv"
    JSON = "json"


class ImportItemError(BaseModel):
    """Import error details."""

    row: int = Field(description="Row number where the error occurred")
    error: str = Field(description="Error message")


class ImportResponse(BaseModel):
    """Response from an import operation."""

    created: int = Field(description="Number of items successfully created")
    failed: int = Field(description="Number of items that failed to import")
    errors: list[ImportItemError] = Field(description="List of errors encountered during import")


async def _detect_format(filename: str) -> FileFormat:
    """Detect file format from filename."""
    if filename.endswith(".csv"):
        return FileFormat.CSV
    if filename.endswith(".json"):
        return FileFormat.JSON
    raise ValueError("Unsupported file format. Use .csv or .json files.")


async def _do_import(
    db: AsyncSession,
    resource: str,
    content: str,
    file_format: FileFormat,
) -> ImportResponse:
    """Perform the actual import operation."""
    try:
        # Parse the file
        if file_format == FileFormat.CSV:
            data = parse_csv(content)
        elif file_format == FileFormat.JSON:
            data = parse_json(content)
        else:
            raise ImportDataError(f"Unsupported format: {file_format}")  # noqa: TRY301

        # Import based on resource type
        if resource == "vendors":
            result = await import_vendors(db, data)
        elif resource == "filaments":
            result = await import_filaments(db, data)
        elif resource == "spools":
            result = await import_spools(db, data)
        else:
            raise ImportDataError(f"Unknown resource type: {resource}")  # noqa: TRY301

        # Convert result to response
        return ImportResponse(
            created=result.created,
            failed=result.failed,
            errors=[ImportItemError(row=e["row"], error=e["error"]) for e in result.errors],
        )

    except ImportDataError as e:
        logger.exception("Import error")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error during import")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e!s}") from e


@router.post(
    "/vendors",
    name="Import vendors",
    description="Import vendors from a CSV or JSON file.",
)
async def import_vendors_endpoint(
    *,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    file: UploadFile,
) -> ImportResponse:
    """Import vendors from an uploaded file."""
    try:
        # Read file content
        content = await file.read()
        text_content = content.decode("utf-8")

        # Detect format from filename
        file_format = await _detect_format(file.filename or "")

        return await _do_import(db, "vendors", text_content, file_format)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/filaments",
    name="Import filaments",
    description="Import filaments from a CSV or JSON file.",
)
async def import_filaments_endpoint(
    *,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    file: UploadFile,
) -> ImportResponse:
    """Import filaments from an uploaded file."""
    try:
        # Read file content
        content = await file.read()
        text_content = content.decode("utf-8")

        # Detect format from filename
        file_format = await _detect_format(file.filename or "")

        return await _do_import(db, "filaments", text_content, file_format)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/spools",
    name="Import spools",
    description="Import spools from a CSV or JSON file.",
)
async def import_spools_endpoint(
    *,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    file: UploadFile,
) -> ImportResponse:
    """Import spools from an uploaded file."""
    try:
        # Read file content
        content = await file.read()
        text_content = content.decode("utf-8")

        # Detect format from filename
        file_format = await _detect_format(file.filename or "")

        return await _do_import(db, "spools", text_content, file_format)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
