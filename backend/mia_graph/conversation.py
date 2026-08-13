"""Small bounded graph for authenticated Mia conversations."""

from typing import Any, Protocol, TypedDict

from .policy import assess_untrusted_text, decide_review
from .retry import MAX_NODE_ATTEMPTS, run_with_recovery


class ConversationServices(Protocol):
    def route_request(self, state: dict[str, Any]) -> dict[str, Any]: ...
    def retrieve_evidence(self, state: dict[str, Any]) -> dict[str, Any]: ...
    def generate_answer(self, state: dict[str, Any]) -> dict[str, Any]: ...
    def validate_draft(self, state: dict[str, Any]) -> dict[str, Any]: ...
    def queue_review(self, state: dict[str, Any]) -> dict[str, Any]: ...


class ConversationState(TypedDict, total=False):
    message: str
    actor_id: str
    request_id: str
    route: str
    evidence_ids: list[str]
    rag_context: dict[str, Any]
    status: int
    result: dict[str, Any]
    answer: dict[str, Any]
    review: dict[str, Any]
    publication_state: str
    graph_run_id: str
    trace_id: str
    graph_version: str
    idempotency_key: str
    retry: dict[str, Any]
    failure_state: str
    failure_node: str
    failure_error: str
    last_safe_state: dict[str, Any]


def _merge(state: dict[str, Any], update: dict[str, Any] | None) -> dict[str, Any]:
    if update and update is not state:
        state.update(update)
    return state


class _SequentialConversationGraph:
    """Dependency-free execution used locally until LangGraph is installed."""

    def __init__(self, services: ConversationServices):
        self.services = services

    def invoke(self, initial: dict[str, Any], config=None) -> dict[str, Any]:
        state = {"graph_version": "mia-graph-v1", "failure_state": "none", **dict(initial)}
        state.setdefault("idempotency_key", state.get("request_id") or state.get("trace_id") or "conversation")
        state["last_safe_state"] = dict(state)
        for name, node in (("route_request", self.services.route_request), ("retrieve_evidence", self.services.retrieve_evidence), ("analyse_or_answer", self.services.generate_answer), ("validate_output", self.services.validate_draft)):
            _merge(state, run_with_recovery(state, lambda node=node: node(state), node=name))
            if state.get("failure_state") == "failed":
                state["publication_state"] = "failed"
                return state
        answer = state.get("answer") or {}
        decision = decide_review({
            **answer,
            "evidence_ids": answer.get("evidence_ids", state.get("evidence_ids", [])),
            "suspected_injection": assess_untrusted_text(state.get("message", "")),
        })
        state["review"] = {"requires_human_review": decision.requires_human_review, "reasons": decision.reasons, "policy_version": decision.policy_version}
        if decision.requires_human_review:
            _merge(state, self.services.queue_review(state))
            state.setdefault("publication_state", "pending_human_review")
        else:
            state["publication_state"] = "returned"
        return state


def build_conversation_graph(services: ConversationServices, checkpointer=None):
    """Build the fixed Conversation Graph; no model output can alter its path."""
    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError:
        return _SequentialConversationGraph(services)

    def safe(name, fn):
        def wrapped(state):
            return run_with_recovery(state, lambda: fn(state), node=name)
        return wrapped

    def failed_route(state):
        return "failed" if state.get("failure_state") == "failed" else "next"

    def recover_failure(state):
        return {"publication_state": "failed"}

    def validate(state):
        update = run_with_recovery(state, lambda: services.validate_draft(state), node="validate_output")
        if update.get("failure_state") == "failed":
            return update
        merged = {**state, **(update or {})}
        answer = merged.get("answer") or {}
        decision = decide_review({
            **answer,
            "evidence_ids": answer.get("evidence_ids", merged.get("evidence_ids", [])),
            "suspected_injection": assess_untrusted_text(merged.get("message", "")),
        })
        return {**(update or {}), "review": {"requires_human_review": decision.requires_human_review, "reasons": decision.reasons, "policy_version": decision.policy_version}}

    def review_route(state):
        return "review" if (state.get("review") or {}).get("requires_human_review") else "return"

    def return_response(state):
        return {"publication_state": "returned"}

    def review_decision(state):
        return {}

    workflow = StateGraph(ConversationState)
    workflow.add_node("route_request", safe("route_request", services.route_request))
    workflow.add_node("retrieve_evidence", safe("retrieve_evidence", services.retrieve_evidence))
    workflow.add_node("analyse_or_answer", safe("analyse_or_answer", services.generate_answer))
    workflow.add_node("validate_output", validate)
    workflow.add_node("queue_review", safe("queue_review", services.queue_review))
    workflow.add_node("return_response", return_response)
    workflow.add_node("review_decision", review_decision)
    workflow.add_node("recover_failure", recover_failure)
    workflow.add_edge(START, "route_request")
    workflow.add_conditional_edges("route_request", failed_route, {"failed": "recover_failure", "next": "retrieve_evidence"})
    workflow.add_conditional_edges("retrieve_evidence", failed_route, {"failed": "recover_failure", "next": "analyse_or_answer"})
    workflow.add_conditional_edges("analyse_or_answer", failed_route, {"failed": "recover_failure", "next": "validate_output"})
    workflow.add_conditional_edges("validate_output", failed_route, {"failed": "recover_failure", "next": "review_decision"})
    workflow.add_conditional_edges("review_decision", review_route, {"review": "queue_review", "return": "return_response"})
    workflow.add_conditional_edges("queue_review", failed_route, {"failed": "recover_failure", "next": END})
    workflow.add_edge("return_response", END)
    workflow.add_edge("recover_failure", END)
    return workflow.compile(checkpointer=checkpointer)
