"""Lifecycle-managed LangGraph checkpoint selection."""

import os
from contextlib import contextmanager


def build_checkpointer(testing: bool = False):
    """Return an in-memory saver for isolated tests and local no-DB use."""
    if testing or not os.environ.get("LANGGRAPH_CHECKPOINT_DATABASE_URL"):
        from langgraph.checkpoint.memory import MemorySaver
        return MemorySaver()
    raise RuntimeError("Use checkpoint_session() for a PostgreSQL-backed saver")


@contextmanager
def checkpoint_session(testing: bool = False):
    """Yield one usable saver for the application lifetime and close it cleanly."""
    if testing or not os.environ.get("LANGGRAPH_CHECKPOINT_DATABASE_URL"):
        yield build_checkpointer(testing=True)
        return
    from langgraph.checkpoint.postgres import PostgresSaver
    with PostgresSaver.from_conn_string(os.environ["LANGGRAPH_CHECKPOINT_DATABASE_URL"]) as saver:
        saver.setup()
        yield saver
