import json
from contextlib import redirect_stdout
from io import StringIO

from scripts.production_preflight import main


def test_preflight_returns_blocked_exit_code_and_redacted_report():
    output = StringIO()
    with redirect_stdout(output):
        status = main([])
    report = json.loads(output.getvalue())
    assert status == 2
    assert report["status"] == "blocked"
    assert "KMS_SECRET_VALUE" not in output.getvalue()


def test_demo_preflight_is_ready_but_explicitly_marked_simulated():
    output = StringIO()
    with redirect_stdout(output):
        status = main(["--demo"])
    report = json.loads(output.getvalue())
    assert status == 0
    assert report["status"] == "ready"
    assert report["mode"] == "demo-simulated"
    assert "simulated" in report["warning"].lower()
