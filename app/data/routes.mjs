export const routeInsights = {
  "all": {
    "title": "All signals",
    "status": "All sources",
    "reason": "These routes are not the full DFDS network. They are the routes where this dashboard currently has public signals.",
    "risk": "App friction, disruption communication, and unclear journey expectations.",
    "action": "Prioritize app reliability, route-specific messaging, and disruption communication."
  },
  "dover-calais": {
    "title": "Dover-Calais",
    "status": "Public delay signal",
    "reason": "Selected because public reporting and Reddit discussion surfaced delay, border-control, and ticket-rule signals.",
    "risk": "Pre-boarding uncertainty and price-rule confusion.",
    "action": "Clarify delay guidance, border-control timing, and ticket conditions before purchase."
  },
  "newhaven-dieppe": {
    "title": "Newhaven-Dieppe",
    "status": "Incident recovery signal",
    "reason": "Selected because public reporting mentioned passenger compensation after an onboard incident.",
    "risk": "Weak disruption recovery can become a brand story.",
    "action": "Create a route-specific incident recovery and compensation communication playbook."
  },
  "newcastle-ijmuiden": {
    "title": "Newcastle-IJmuiden",
    "status": "App feature signal",
    "reason": "Selected because a recent Apple App Store review mentions mobile check-in being unavailable on this route.",
    "risk": "Customers may expect app features that do not exist on their route.",
    "action": "Show route-level app feature availability before customers rely on mobile check-in."
  },
  "jersey": {
    "title": "Jersey / Channel Islands",
    "status": "Market trust signal",
    "reason": "Selected because public coverage surfaced Jersey service-level and freight-pricing concerns.",
    "risk": "A local service issue can be hidden by the all-company average.",
    "action": "Track Jersey separately and report service confidence as its own market lens."
  }
};
