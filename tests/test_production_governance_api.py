import server


def test_project_user_cannot_enable_production_mode():
    try:
        server.enable_production_mode({"id": "user", "role": "project_user"})
    except PermissionError as exc:
        assert "Governance administrator" in str(exc)
    else:
        raise AssertionError("project user must not enable production mode")


def test_blocked_readiness_cannot_enable_production_mode():
    original = server.PRODUCTION_MODE_ENABLED
    server.PRODUCTION_MODE_ENABLED = False
    try:
        try:
            server.enable_production_mode({"id": "admin", "role": "administrator"})
        except RuntimeError as exc:
            assert "blocked" in str(exc)
        else:
            raise AssertionError("blocked governance must prevent production mode")
    finally:
        server.PRODUCTION_MODE_ENABLED = original
