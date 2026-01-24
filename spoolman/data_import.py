"""Functionality for importing data from various formats."""

import csv
import json
import logging
from io import StringIO
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from spoolman.database import filament, spool, vendor

logger = logging.getLogger(__name__)


class ImportDataError(Exception):
    """Exception raised during import."""


class ImportResult:
    """Result of an import operation."""

    def __init__(self) -> None:
        """Initialize the import result."""
        self.created = 0
        self.failed = 0
        self.errors: list[dict[str, Any]] = []

    def add_error(self, row_index: int, item_data: dict[str, Any], error: str) -> None:
        """Add an error to the result."""
        self.failed += 1
        self.errors.append({"row": row_index, "data": item_data, "error": error})


def parse_csv(content: str) -> list[dict[str, Any]]:
    """Parse CSV content and return a list of dictionaries."""
    reader = csv.DictReader(StringIO(content))
    if reader.fieldnames is None:
        raise ImportDataError("CSV file has no headers")
    return list(reader)


def parse_json(content: str) -> list[dict[str, Any]]:
    """Parse JSON content and return a list of dictionaries."""
    data = json.loads(content)
    if not isinstance(data, list):
        raise ImportDataError("JSON must contain an array of objects")
    return data


def _parse_value(value: Any, field_type: str) -> Any:  # noqa: ANN401, PLR0911
    """Parse a value to the appropriate type."""
    if value is None or value == "":
        return None

    if isinstance(value, str):
        # Handle string representations of None
        if value.lower() in ("none", "null", ""):
            return None

        # Type conversion
        if field_type == "int":
            try:
                return int(value)
            except ValueError:
                return None
        elif field_type == "float":
            try:
                return float(value)
            except ValueError:
                return None
        elif field_type == "bool":
            return value.lower() in ("true", "1", "yes")

    return value


def _extract_extra_fields(data: dict[str, Any]) -> dict[str, str]:
    """Extract extra fields (fields starting with 'extra.') from the data."""
    extra = {}
    for key, value in data.items():
        if key.startswith("extra."):
            field_key = key[6:]  # Remove 'extra.' prefix
            extra[field_key] = str(value) if value is not None else ""
    return extra


async def import_vendors(
    db: AsyncSession,
    data: list[dict[str, Any]],
) -> ImportResult:
    """Import vendors from a list of dictionaries."""
    result = ImportResult()

    for row_index, item_data in enumerate(data, 1):
        try:
            # Extract fields
            name = item_data.get("name", "").strip()
            comment = item_data.get("comment")
            empty_spool_weight = _parse_value(item_data.get("empty_spool_weight"), "float")
            external_id = item_data.get("external_id")
            extra = _extract_extra_fields(item_data)

            # Validate required fields
            if not name:
                raise ImportDataError("'name' is required")  # noqa: TRY301

            # Create vendor
            new_vendor = await vendor.create(
                db=db,
                name=name,
                comment=comment,
                empty_spool_weight=empty_spool_weight,
                external_id=external_id,
                extra=extra if extra else None,
            )
            result.created += 1
            logger.info("Imported vendor: %s (ID: %s)", new_vendor.name, new_vendor.id)

        except Exception as e:  # noqa: PERF203
            result.add_error(row_index, item_data, str(e))
            logger.exception("Error importing vendor at row %s", row_index)

    return result


async def import_filaments(
    db: AsyncSession,
    data: list[dict[str, Any]],
) -> ImportResult:
    """Import filaments from a list of dictionaries."""
    result = ImportResult()

    for row_index, item_data in enumerate(data, 1):
        try:
            # Extract fields
            name = item_data.get("name", "").strip() if item_data.get("name") else None
            material = item_data.get("material", "").strip() if item_data.get("material") else None
            price = _parse_value(item_data.get("price"), "float")
            density = _parse_value(item_data.get("density"), "float")
            diameter = _parse_value(item_data.get("diameter"), "float")
            weight = _parse_value(item_data.get("weight"), "float")
            spool_weight = _parse_value(item_data.get("spool_weight"), "float")
            article_number = item_data.get("article_number", "").strip() if item_data.get("article_number") else None
            comment = item_data.get("comment")
            settings_extruder_temp = _parse_value(item_data.get("settings_extruder_temp"), "int")
            settings_bed_temp = _parse_value(item_data.get("settings_bed_temp"), "int")
            color_hex = item_data.get("color_hex")
            multi_color_hexes = item_data.get("multi_color_hexes")
            multi_color_direction = item_data.get("multi_color_direction")
            external_id = item_data.get("external_id")
            extra = _extract_extra_fields(item_data)

            # Validate required fields
            if density is None:
                raise ImportDataError("'density' is required")  # noqa: TRY301
            if diameter is None:
                raise ImportDataError("'diameter' is required")  # noqa: TRY301

            # Handle vendor
            vendor_id = None
            vendor_name = item_data.get("vendor.name")
            if vendor_name:
                # Try to find vendor by name
                found_vendors, _ = await vendor.find(db=db, name=vendor_name)
                if found_vendors:
                    vendor_id = found_vendors[0].id

            # Create filament
            new_filament = await filament.create(
                db=db,
                name=name,
                vendor_id=vendor_id,
                material=material,
                price=price,
                density=density,
                diameter=diameter,
                weight=weight,
                spool_weight=spool_weight,
                article_number=article_number,
                comment=comment,
                settings_extruder_temp=settings_extruder_temp,
                settings_bed_temp=settings_bed_temp,
                color_hex=color_hex,
                multi_color_hexes=multi_color_hexes,
                multi_color_direction=multi_color_direction,
                external_id=external_id,
                extra=extra if extra else None,
            )
            result.created += 1
            logger.info("Imported filament: %s (ID: %s)", new_filament.name, new_filament.id)

        except Exception as e:  # noqa: PERF203
            result.add_error(row_index, item_data, str(e))
            logger.exception("Error importing filament at row %s", row_index)

    return result


async def import_spools(
    db: AsyncSession,
    data: list[dict[str, Any]],
) -> ImportResult:
    """Import spools from a list of dictionaries."""
    result = ImportResult()

    for row_index, item_data in enumerate(data, 1):
        try:
            # Extract fields
            price = _parse_value(item_data.get("price"), "float")
            initial_weight = _parse_value(item_data.get("initial_weight"), "float")
            spool_weight = _parse_value(item_data.get("spool_weight"), "float")
            used_weight = _parse_value(item_data.get("used_weight"), "float")
            remaining_weight = _parse_value(item_data.get("remaining_weight"), "float")
            location = item_data.get("location", "").strip() if item_data.get("location") else None
            lot_nr = item_data.get("lot_nr", "").strip() if item_data.get("lot_nr") else None
            comment = item_data.get("comment")
            archived = _parse_value(item_data.get("archived"), "bool")
            extra = _extract_extra_fields(item_data)

            # Handle filament - try to match by name and vendor name
            filament_name = item_data.get("filament.name")
            vendor_name = item_data.get("filament.vendor.name")
            filament_id = None

            if filament_name:
                # Try to find filament
                found_filaments, _ = await filament.find(db=db, name=filament_name)
                if vendor_name:
                    # Filter by vendor name if provided
                    found_filaments = [f for f in found_filaments if f.vendor and f.vendor.name == vendor_name]
                if found_filaments:
                    filament_id = found_filaments[0].id

            if filament_id is None:
                raise ImportDataError(f"Could not find filament: {filament_name}")  # noqa: TRY301

            # Create spool
            new_spool = await spool.create(
                db=db,
                filament_id=filament_id,
                price=price,
                initial_weight=initial_weight,
                spool_weight=spool_weight,
                used_weight=used_weight,
                remaining_weight=remaining_weight,
                location=location,
                lot_nr=lot_nr,
                comment=comment,
                archived=archived,
                extra=extra if extra else None,
            )
            result.created += 1
            logger.info("Imported spool ID: %s", new_spool.id)

        except Exception as e:  # noqa: PERF203
            result.add_error(row_index, item_data, str(e))
            logger.exception("Error importing spool at row %s", row_index)

    return result
