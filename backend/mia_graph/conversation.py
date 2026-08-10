"""Small bounded graph for authenticated Mia conversations."""

from typing import Any, Protocol, TypedDict

from .policy import assess_untrusted_text, decide_review


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
    answer: dict[str, Any]
    review: dict[str, Any]
    publication_state: str


def _merge(state: dict[str, Any], update: dict[str, Any] | None) -> dict[str, Any]:
    if update and update is not state:
        state.update(update)
    return state


class _SequentialConversationGraph:
    """Dependency-free execution used locally until LangGraph is installed."""

    def __init__(self, services: ConversationServices):
        self.services = services

    def invoke(self, initial: dict[str, Any], config=None) -> dict[str, Any]:
        state = dict(initial)
        for node in (self.services.route_request, self.services.retrieve_evidence, self.services.generate_answer, self.services.validate_draft):
            _merge(state, node(state))
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

    def validate(state):
        update = services.validate_draft(state)
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

    workflow = StateGraph(ConversationState)
    workflow.add_node("route_request", services.route_request)
    workflow.add_node("retrieve_evidence", services.retrieve_evidence)
    workflow.add_node("analyse_or_answer", services.generate_answer)
    workflow.add_node("validate_output", validate)
    workflow.add_node("queue_review", services.queue_review)
    workflow.add_node("return_response", return_response)
    workflow.add_edge(START, "route_request")
    workflow.add_edge("route_request", "retrieve_evidence")
    workflow.add_edge("retrieve_evidence", "analyse_or_answer")
    workflow.add_edge("analyse_or_answer", "validate_output")
    workflow.add_conditional_edges("validate_output", review_route, {"review": "queue_review", "return": "return_response"})
    workflow.add_edge("queue_review", END)
    workflow.add_edge("return_response", END)
    return workflow.compile(checkpointer=checkpointer)
