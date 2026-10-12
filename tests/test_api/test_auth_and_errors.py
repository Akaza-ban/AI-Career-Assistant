import pytest


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("role", "expected_id"),
    [("student", "sv-0142"), ("advisor", "cv-007"), ("admin", "qt-001")],
)
async def test_me_returns_demo_user_for_role(client, role, expected_id):
    response = await client.get("/api/v1/me", headers={"X-Demo-Role": role})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == expected_id
    assert data["role"] == role
    assert data["full_name"]


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [{}, {"X-Demo-Role": "superuser"}])
async def test_me_without_valid_role_is_unauthenticated(client, headers):
    response = await client.get("/api/v1/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["code"] == "unauthenticated"
    assert isinstance(response.json()["detail"], str)


@pytest.mark.asyncio
async def test_validation_error_has_string_detail(client):
    response = await client.post(
        "/api/v1/gap-analysis", json={"jd_id": "jd-da-intern"}, headers={"X-Demo-Role": "student"}
    )
    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "validation_error"
    assert isinstance(data["detail"], str)
    assert "cv_version_id" in data["detail"]


@pytest.mark.asyncio
async def test_unknown_route_has_error_code(client):
    response = await client.get("/api/v1/khong-ton-tai")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found", "code": "not_found"}
