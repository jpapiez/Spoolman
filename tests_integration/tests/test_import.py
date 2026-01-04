"""Integration tests for the Import API endpoint."""

import httpx
import pytest

from ..conftest import URL


def test_import_vendors_csv(random_vendor_mod):
    """Test importing vendors from CSV."""
    # Create CSV content with vendor data
    csv_content = """name,comment,empty_spool_weight
TestVendor1,Test comment,145.5
TestVendor2,,150.0
"""

    # Import vendors
    response = httpx.post(
        f"{URL}/api/v1/import/vendors",
        files={"file": ("vendors.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["created"] >= 2
    assert data["failed"] == 0
    assert len(data["errors"]) == 0


def test_import_vendors_json(random_vendor_mod):
    """Test importing vendors from JSON."""
    # Create JSON content with vendor data
    json_content = """[
    {"name": "JsonVendor1", "comment": "Test", "empty_spool_weight": 145.5},
    {"name": "JsonVendor2", "comment": null, "empty_spool_weight": 150.0}
]"""

    # Import vendors
    response = httpx.post(
        f"{URL}/api/v1/import/vendors",
        files={"file": ("vendors.json", json_content, "application/json")},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["created"] >= 2
    assert data["failed"] == 0
    assert len(data["errors"]) == 0


def test_import_filaments_csv(random_vendor_mod):
    """Test importing filaments from CSV."""
    # Create CSV content with filament data
    csv_content = f"""name,vendor.name,material,density,diameter,weight,price
TestFilament1,{random_vendor_mod["name"]},PLA,1.24,1.75,1000.0,20.5
TestFilament2,{random_vendor_mod["name"]},ABS,1.04,1.75,1000.0,25.0
"""

    # Import filaments
    response = httpx.post(
        f"{URL}/api/v1/import/filaments",
        files={"file": ("filaments.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["created"] >= 2
    assert data["failed"] == 0
    assert len(data["errors"]) == 0


def test_import_filaments_json(random_vendor_mod):
    """Test importing filaments from JSON."""
    # Create JSON content with filament data
    json_content = f"""[
    {{"name": "JsonFilament1", "vendor.name": "{random_vendor_mod['name']}", "material": "PLA", "density": 1.24, "diameter": 1.75, "weight": 1000.0, "price": 20.5}},
    {{"name": "JsonFilament2", "vendor.name": "{random_vendor_mod['name']}", "material": "ABS", "density": 1.04, "diameter": 1.75, "weight": 1000.0, "price": 25.0}}
]"""

    # Import filaments
    response = httpx.post(
        f"{URL}/api/v1/import/filaments",
        files={"file": ("filaments.json", json_content, "application/json")},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["created"] >= 2
    assert data["failed"] == 0
    assert len(data["errors"]) == 0


def test_import_filaments_missing_required(random_vendor_mod):
    """Test importing filaments with missing required fields."""
    # Create CSV with missing required field (density)
    csv_content = """name,vendor.name,material,diameter
TestFilament1,TestVendor,PLA,1.75
"""

    response = httpx.post(
        f"{URL}/api/v1/import/filaments",
        files={"file": ("filaments.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["created"] == 0
    assert data["failed"] == 1
    assert len(data["errors"]) == 1
    assert "density" in data["errors"][0]["error"].lower()
