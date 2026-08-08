export const passengerProfileSummary = {
  sourceLabel: "Synthetic Passenger Profile PG",
  status: "Ready for slicing",
  passengerCount: 1000,
  tripCount: 1800,
  routeCount: 14,
  productCount: 10,
  dateRange: "2024-01-01 to 2026-12-31",
  methodology:
    "Star-schema synthetic dataset generated from public-source-inspired assumptions. It is useful for segmentation and agent prototyping, not as real DFDS CRM evidence.",
  actarDefinition: [
    "Action area",
    "Customer target",
    "Trigger signal",
    "Analysis",
    "Recommendation"
  ],
  topSegments: [
    { label: "Young Leisure Travelers", share: "16.9%", passengers: 169 },
    { label: "Car-based Cross-border Travelers", share: "15.4%", passengers: 154 },
    { label: "Price-sensitive Short-break Travelers", share: "14.6%", passengers: 146 },
    { label: "Family Holiday Travelers", share: "13.3%", passengers: 133 },
    { label: "High-value Comfort Seekers", share: "11.1%", passengers: 111 }
  ],
  routeAffinity: [
    { label: "Channel crossing short", share: "48.9%", trips: 880, signal: "Dominant simulated demand pool." },
    { label: "North Sea overnight", share: "14.7%", trips: 265, signal: "Comfort and mini-cruise oriented." },
    { label: "Baltic overnight", share: "13.4%", trips: 242, signal: "Vehicle and cabin heavy." },
    { label: "Irish Celtic", share: "10.6%", trips: 191, signal: "Family and vehicle transport signal." },
    { label: "Celtic short break", share: "10.1%", trips: 182, signal: "Short-break and leisure pattern." }
  ],
  productPreference: [
    { label: "Cabin", share: "26.8%", trips: 482 },
    { label: "Vehicle crossing", share: "19.6%", trips: 353 },
    { label: "Flexible ticket", share: "16.6%", trips: 298 },
    { label: "Mini-cruise", share: "11.3%", trips: 203 },
    { label: "Seat", share: "11.2%", trips: 201 }
  ],
  travelContext: [
    { label: "Weekend getaway", share: "20.6%", trips: 370 },
    { label: "Transport alternative", share: "16.4%", trips: 295 },
    { label: "Family holiday", share: "15.2%", trips: 273 },
    { label: "Mini-cruise leisure", share: "13.3%", trips: 239 },
    { label: "Visiting friends and relatives", share: "11.8%", trips: 213 }
  ],
  actarSlices: [
    {
      actionArea: "Channel crossing short",
      customerTarget: "Car-based Cross-border Travelers",
      triggerSignal: "177 synthetic trips; 70.6% vehicle share.",
      analysis: "This group behaves like a practical transport audience that needs reliable vehicle-first planning.",
      recommendation: "Prioritize boarding clarity, vehicle booking reassurance, ticket-rule clarity, and disruption timing."
    },
    {
      actionArea: "Channel crossing short",
      customerTarget: "Family Holiday Travelers",
      triggerSignal: "137 synthetic trips; 86.9% cabin share; average order value 369.88.",
      analysis: "Family travelers combine vehicle needs with comfort and planning needs.",
      recommendation: "Prioritize family-package messaging, car guidance, school-holiday timing, and flexible-ticket content."
    },
    {
      actionArea: "North Sea overnight",
      customerTarget: "High-value Comfort Seekers",
      triggerSignal: "75 synthetic trips; 100.0% cabin share; average order value 501.39.",
      analysis: "This group indexes toward premium cabins, comfort, lounge and overnight experience.",
      recommendation: "Prioritize premium cabin proof points, onboard experience, meal bundles, and mini-cruise upgrades."
    },
    {
      actionArea: "North Sea overnight",
      customerTarget: "Senior Mini-cruise Travelers",
      triggerSignal: "76 synthetic trips; 100.0% cabin share; average order value 425.85.",
      analysis: "This is a leisure audience that responds to low-friction, confidence-building mini-cruise packaging.",
      recommendation: "Prioritize easy itinerary planning, cabin comfort, assisted booking options, and calm onboarding messages."
    }
  ],
  sourceAssumptions: [
    "DFDS route, destination, onboard product, pet travel and mini-cruise pages.",
    "DFDS annual, investor and sustainability reporting.",
    "Tourism boards, ports, national statistics and market research.",
    "Google Trends, public reviews, social signals and competitor positioning."
  ]
};
