"""
Pins the whole test session onto a disposable SQLite file, before pytest
imports any test module.

Why this has to live here and not in test_webhook.py: pytest imports test
files in name order (test_incidents.py, test_intent.py, test_scheduler.py,
then test_webhook.py). Several of those earlier files import from `app.*`,
which imports app.config, which calls `load_dotenv()` and sets
DATABASE_URL from .env (sqlite:///./mandi.db) into the process environment
the first time it runs. By the time test_webhook.py reached its own
`os.environ.setdefault("DATABASE_URL", ...)`, that key already existed —
so setdefault was a silent no-op, and the webhook tests were actually
writing straight into the real production mandi.db on every single pytest
run. That's why booking counts kept climbing across runs (1, then 2, then
3...) instead of ever resetting.

conftest.py is imported by pytest before any test module, so setting the
env var here actually wins the race.
"""
import os
from pathlib import Path

_TEST_DB = Path(__file__).resolve().parent / "test_webhook.db"
os.environ["DATABASE_URL"] = f"sqlite:///./{_TEST_DB.name}"

if _TEST_DB.exists():
    _TEST_DB.unlink()
