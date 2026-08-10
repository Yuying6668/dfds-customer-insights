"""Checkpoint selection isolated from graph definitions."""

def build_checkpointer(testing: bool = False):
    if testing or not __import__("os").environ.get("LANGGRAPH_CHECKPOINT_DATABASE_URL"):
        try:
            from langgraph.checkpoint.memory import MemorySaver
            return MemorySaver()
        except ImportError:
            return None
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
    except ImportError as exc:
        raise RuntimeError("langgraph-checkpoint-postgres is required for configured checkpoints") from exc
    return PostgresSaver.from_conn_string(__import__("os").environ["LANGGRAPH_CHECKPOINT_DATABASE_URL"])
