export const rootCauses = [
  {
    "title": "Delay recovery and disruption handling",
    "confidence": "High",
    "impact": "High",
    "summary": "Recent public signals repeatedly mention long delays, disputed compensation, unclear refund handling, and communication gaps during disruption."
  },
  {
    "title": "Onboard experience inconsistency",
    "confidence": "Medium",
    "impact": "Medium",
    "summary": "Trustpilot review themes include staff and service as positives, while cabins, food quality, and boarding experience appear as recurring negatives."
  },
  {
    "title": "Route-specific trust risk in Jersey services",
    "confidence": "Medium",
    "impact": "High",
    "summary": "Public coverage around Jersey and Channel Islands ferry services shows concerns about service quality, freight pricing, disruption, and market expectations."
  },
  {
    "title": "Passenger app authentication and booking access",
    "confidence": "High",
    "impact": "High",
    "summary": "Apple App Store evidence and Google Play rating details show the DFDS Passenger app is a lower-rated channel, with recent complaints around login, booking visibility, account handoff, and mobile check-in expectations."
  }
];

export const signals = [
  {
    "route": "all",
    "source": "Trustpilot",
    "theme": "Overall brand perception is strong but uneven",
    "sentiment": "Mixed-positive",
    "journeyStage": "Post-trip evaluation",
    "evidence": "DFDS holds a 4.2/5 Trustpilot score from 20,646 reviews, with 53% 5-star and 9% 1-star ratings.",
    "businessMeaning": "DFDS has enough public goodwill to protect, but negative experiences are visible and specific enough to influence route-level choice."
  },
  {
    "route": "all",
    "source": "Trustpilot",
    "theme": "Staff and service are brand strengths",
    "sentiment": "Positive",
    "journeyStage": "Onboard experience",
    "evidence": "Trustpilot's review summary highlights positive themes around service, friendly staff, comfort, and overall satisfaction.",
    "businessMeaning": "Marketing can credibly lean into human service quality if operational weak spots are not ignored."
  },
  {
    "route": "all",
    "source": "Trustpilot",
    "theme": "Boarding, cabins, and food are friction points",
    "sentiment": "Negative",
    "journeyStage": "Boarding and onboard experience",
    "evidence": "Trustpilot's negative review summary highlights issues with cabins, food quality, customer service, disembarkation, border control, and delays.",
    "businessMeaning": "These are not abstract complaints; they map directly to journey moments that shape repeat purchase and recommendation."
  },
  {
    "route": "newhaven-dieppe",
    "source": "The Guardian",
    "theme": "Compensation and incident recovery risk",
    "sentiment": "Negative",
    "journeyStage": "Disruption recovery",
    "evidence": "Public reporting described Newhaven-Dieppe passengers seeking compensation after an onboard incident and disrupted journey experience.",
    "businessMeaning": "DFDS should treat unusual disruption handling as a brand-protection issue, not only an operations issue."
  },
  {
    "route": "dover-calais",
    "source": "BBC",
    "theme": "Delay communication pressure",
    "sentiment": "Negative",
    "journeyStage": "Pre-boarding and border control",
    "evidence": "BBC reporting around Dover delays includes DFDS advice for passengers to allow extra time because of passport control queues.",
    "businessMeaning": "Delay messaging needs to be proactive, route-specific, and framed as customer protection."
  },
  {
    "route": "dover-calais",
    "source": "Google Reviews",
    "theme": "Terminal experience is a marketing proof point",
    "sentiment": "Positive",
    "journeyStage": "Terminal and boarding",
    "evidence": "Public Google location profiles show DFDS Calais at 4.2/5 from 2,331 reviews and DFDS Dover at 4.3/5 from 47 reviews.",
    "businessMeaning": "Dover-Calais messaging can use terminal efficiency and staff service as proof points, while still addressing signage and food-value friction."
  },
  {
    "route": "jersey",
    "source": "BBC / local public reporting",
    "theme": "Channel Islands service confidence",
    "sentiment": "Negative",
    "journeyStage": "Market trust",
    "evidence": "Public reporting has covered Jersey concerns around DFDS ferry service levels, freight prices, and service disruption.",
    "businessMeaning": "Jersey should be monitored as a distinct market perception risk rather than blended into all-DFDS averages."
  },
  {
    "route": "newhaven-dieppe",
    "source": "Google Reviews",
    "theme": "Crossing experience is stronger than terminal impression",
    "sentiment": "Mixed-positive",
    "journeyStage": "Check-in, onboard, and terminal",
    "evidence": "The Newhaven DFDS Transmanche Google location profile shows 4.2/5 from 478 reviews, with positive signals around booking, check-in, onboard food, crossing comfort, and staff service.",
    "businessMeaning": "Marketing can highlight the crossing and onboard experience, while terminal-condition concerns should be treated as a journey-expectation gap."
  },
  {
    "route": "newcastle-ijmuiden",
    "source": "Google Reviews",
    "theme": "Mini-cruise and onboard service are strong positives",
    "sentiment": "Positive",
    "journeyStage": "Onboard experience",
    "evidence": "The DFDS Newcastle Google location profile shows 4.4/5 from 346 reviews, with positive signals around customer service, cabins, entertainment, family/pet facilities, and mini-cruise experience.",
    "businessMeaning": "Newcastle-IJmuiden marketing should lean into onboard experience, service quality, and short-break value."
  },
  {
    "route": "all",
    "source": "Apple App Store",
    "theme": "Passenger app login and booking access are visible pain points",
    "sentiment": "Negative",
    "journeyStage": "Digital pre-trip",
    "evidence": "Recent Apple GB reviews mention failed account credentials, disappeared bookings, unauthorized-access messages, and login loops.",
    "businessMeaning": "App problems can reduce customer confidence before the trip even starts."
  },
  {
    "route": "newcastle-ijmuiden",
    "source": "Apple App Store",
    "theme": "Mobile check-in expectation mismatch",
    "sentiment": "Negative",
    "journeyStage": "Digital pre-trip",
    "evidence": "A recent Apple review says mobile check-in was not available for Newcastle to IJmuiden.",
    "businessMeaning": "Route-specific digital feature availability should be explicit before customers download or rely on the app."
  },
  {
    "route": "all",
    "source": "Google Play",
    "theme": "Android app perception is weaker than brand perception",
    "sentiment": "Negative",
    "journeyStage": "Digital pre-trip",
    "evidence": "The Google Play GB page for DFDS - Passenger shows 2.5/5 from 64 reviews.",
    "businessMeaning": "The Android channel should be treated as its own customer-experience risk, not hidden inside general brand sentiment."
  },
  {
    "route": "dover-calais",
    "source": "Reddit",
    "theme": "Ticket-rule and fare-arbitrage confusion",
    "sentiment": "Mixed",
    "journeyStage": "Booking consideration",
    "evidence": "A recent Reddit travel thread asks what happens if a DFDS Short Break return ticket is used only one way because it is cheaper than a one-way fare.",
    "businessMeaning": "Pricing and ticket-condition messaging may be creating confusion or arbitrage behavior before purchase."
  },
  {
    "route": "all",
    "source": "Reddit",
    "theme": "Ferry choice competes with faster transport alternatives",
    "sentiment": "Mixed",
    "journeyStage": "Travel planning",
    "evidence": "Reddit travel discussions compare DFDS-style ferry journeys with flying, train, bus, Eurotunnel, and competitor ferry options.",
    "businessMeaning": "Marketing should position the ferry around comfort, flexibility, vehicle access, and experience rather than speed alone."
  }
];

export const voiceThemes = [
  {
    "routes": [
      "all",
      "newcastle-ijmuiden"
    ],
    "theme": "App and booking friction",
    "sentiment": "Negative",
    "sources": [
      "Apple App Store",
      "Google Play"
    ],
    "routeLabel": "All routes; strongest signal on Newcastle-IJmuiden",
    "customerMeaning": "Some customers struggle before the trip starts because login, booking retrieval, and route feature availability are unclear.",
    "marketingAction": "Be cautious about promoting mobile self-service until login, booking visibility, and route feature messaging improve.",
    "evidence": [
      "Google Play GB shows DFDS - Passenger at 2.5/5 from 64 reviews.",
      "Apple GB App Store shows 3.3/5 from 10 ratings.",
      "Recent Apple reviews mention login loops, missing bookings, and mobile check-in not available on Newcastle-IJmuiden."
    ]
  },
  {
    "routes": [
      "all",
      "dover-calais",
      "newhaven-dieppe",
      "newcastle-ijmuiden"
    ],
    "theme": "Terminal and boarding proof points",
    "sentiment": "Positive",
    "sources": [
      "Google Reviews"
    ],
    "routeLabel": "Dover-Calais, Newhaven-Dieppe, Newcastle-IJmuiden",
    "customerMeaning": "Location-level Google Reviews show useful strengths around terminal service, boarding flow, staff, and crossing experience.",
    "marketingAction": "Use terminal efficiency, staff service, and route-specific location strengths as proof points in campaign copy.",
    "evidence": [
      "DFDS Calais: 4.2/5 from 2,331 Google reviews.",
      "DFDS Dover: 4.3/5 from 47 Google reviews.",
      "DFDS Newhaven: 4.2/5 from 478 Google reviews.",
      "DFDS Newcastle: 4.4/5 from 346 Google reviews."
    ]
  },
  {
    "routes": [
      "all",
      "dover-calais",
      "newhaven-dieppe"
    ],
    "theme": "Disruption communication",
    "sentiment": "Negative",
    "sources": [
      "Trustpilot",
      "BBC",
      "The Guardian"
    ],
    "routeLabel": "Dover-Calais and Newhaven-Dieppe",
    "customerMeaning": "Delays, compensation, border-control queues, and recovery handling can quickly become brand trust issues.",
    "marketingAction": "Prepare clearer disruption messaging before, during, and after travel so customers feel guided rather than surprised.",
    "evidence": [
      "Trustpilot negative themes include delays and customer service friction.",
      "BBC reporting surfaced Dover delay and passport-control queue pressure.",
      "Guardian reporting surfaced Newhaven-Dieppe compensation concerns after an onboard incident."
    ]
  },
  {
    "routes": [
      "all"
    ],
    "theme": "Staff and onboard service strength",
    "sentiment": "Positive",
    "sources": [
      "Trustpilot",
      "Google Reviews"
    ],
    "routeLabel": "All public signals",
    "customerMeaning": "Staff friendliness, onboard support, and service quality appear as positive brand assets.",
    "marketingAction": "Use people-led service quality as a brand strength, especially when paired with honest route and disruption messaging.",
    "evidence": [
      "Trustpilot summary highlights service, friendly staff, comfort, and satisfaction.",
      "Google location profiles for Dover-Calais, Newhaven, and Newcastle include positive service signals."
    ]
  },
  {
    "routes": [
      "all",
      "jersey"
    ],
    "theme": "Channel Islands trust risk",
    "sentiment": "Negative",
    "sources": [
      "BBC / local public reporting"
    ],
    "routeLabel": "Jersey / Channel Islands",
    "customerMeaning": "Jersey-related service and freight-pricing concerns are market-specific and should not be hidden inside DFDS averages.",
    "marketingAction": "Track Channel Islands separately and avoid using all-company performance as a proxy for local confidence.",
    "evidence": [
      "Public reporting surfaced Jersey ferry service-level concerns.",
      "Public reporting also surfaced freight-pricing and disruption concerns."
    ]
  },
  {
    "routes": [
      "all",
      "dover-calais"
    ],
    "theme": "Ticket rules and alternative choices",
    "sentiment": "Mixed",
    "sources": [
      "Reddit"
    ],
    "routeLabel": "Dover-Calais",
    "customerMeaning": "Some customers compare ferry options against price rules, one-way fares, Eurotunnel, flights, and other alternatives.",
    "marketingAction": "Make fare rules and value propositions easier to understand before purchase.",
    "evidence": [
      "A Reddit travel thread asks about using a DFDS Short Break return ticket one way because it is cheaper than a one-way fare.",
      "Reddit discussions compare ferry travel with flying, train, bus, Eurotunnel, and competitor ferry options."
    ]
  }
];
