export const sourceCoverage = [
  {
    "source": "Trustpilot",
    "logo": "https://cdn.simpleicons.org/trustpilot/00B67A",
    "status": "Collected",
    "records": "20,646 reviews",
    "insight": "Broad ferry-service perception, staff/service positives, and journey friction themes."
  },
  {
    "source": "Google Play Reviews",
    "logo": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Google_Play_2022_logo.svg",
    "status": "Rating found",
    "records": "64 Android reviews",
    "insight": "DFDS - Passenger shows a weaker Android rating than the overall DFDS brand score."
  },
  {
    "source": "Apple App Store Reviews",
    "logo": "https://cdn.simpleicons.org/apple/000000",
    "status": "Collected",
    "records": "10 GB ratings; 5 recent public review entries",
    "insight": "Recent reviews highlight account login, booking retrieval, and route feature availability problems."
  },
  {
    "source": "Google Reviews",
    "logo": "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg",
    "status": "Location profiles collected",
    "records": "4 Google location profiles",
    "insight": "Collected at terminal/location level for Dover-Calais, Newhaven-Dieppe, and Newcastle-IJmuiden signals."
  },
  {
    "source": "Reddit",
    "logo": "https://cdn.simpleicons.org/reddit/FF4500",
    "status": "Discussion signals found",
    "records": "2 relevant discussion signals",
    "insight": "Reddit is used here for travel questions and comments, not star-rated reviews."
  },
  {
    "source": "Survey CSV",
    "logo": "",
    "status": "Upload later",
    "records": "No survey uploaded",
    "insight": "Future survey results can be compared with the public sources."
  },
  {
    "source": "Synthetic Passenger Profile PG",
    "logo": "",
    "status": "Ready",
    "records": "1,000 synthetic passengers; 1,800 synthetic trips",
    "insight": "Star-schema passenger profile data for route affinity, segment, product preference, travel-context, and ACTAR analysis."
  }
];

export const sources = [
  {
    "title": "Synthetic Passenger Profile PG dataset",
    "url": "data/passenger_profile/manifest.json",
    "note": "Local synthetic dataset generated from public-source-inspired assumptions. Used for Passenger Profile sub-agent slicing and Mia evidence, not as real DFDS CRM or survey data."
  },
  {
    "title": "DFDS Trustpilot profile",
    "url": "https://www.trustpilot.com/review/dfds.com",
    "note": "Used for DFDS score, review count, distribution, recent review volume, positive themes, and negative themes."
  },
  {
    "title": "DFDS - Passenger on Google Play",
    "url": "https://play.google.com/store/apps/details?id=com.dfds.pax&hl=en&gl=GB",
    "note": "Used for Android app rating and review-count details: 2.5/5 rating and 64 reviews in the GB Google Play view. Full review text requires a dedicated Play review connector."
  },
  {
    "title": "DFDS - Passenger on Apple App Store",
    "url": "https://apps.apple.com/gb/app/dfds-passenger/id6474616110",
    "note": "Used for Apple app rating details: 3.3/5 rating and 10 GB ratings."
  },
  {
    "title": "Apple App Store customer reviews feed for DFDS - Passenger",
    "url": "https://itunes.apple.com/gb/rss/customerreviews/id=6474616110/sortBy=mostRecent/json",
    "note": "Used for recent public Apple review evidence around account login, booking retrieval, and route feature availability."
  },
  {
    "title": "Google Reviews signal: DFDS Calais - Ferry Terminal & Office",
    "url": "https://wanderlog.com/place/details/1574638/dfds-calais-ferry-terminal--office",
    "note": "Used for Calais terminal rating and review-count signal mapped to Dover-Calais."
  },
  {
    "title": "Google Reviews signal: DFDS Dover - Office & Ferry Terminal",
    "url": "https://wanderlog.com/place/details/12640587/dfds-dover-office--ferry-terminal",
    "note": "Used for Dover terminal rating and review-count signal mapped to Dover-Calais."
  },
  {
    "title": "Google Reviews signal: DFDS Transmanche Ferries, Newhaven",
    "url": "https://wanderlog.com/place/details/8211168/dfds-transmanche-ferries",
    "note": "Used for Newhaven terminal/location rating and review-count signal mapped to Newhaven-Dieppe."
  },
  {
    "title": "Google Reviews signal: DFDS Newcastle",
    "url": "https://wanderlog.com/place/details/10251667",
    "note": "Used for Newcastle location rating and review-count signal mapped to Newcastle-IJmuiden."
  },
  {
    "title": "Reddit travel discussion: DFDS Short Break ticket rules",
    "url": "https://www.reddit.com/r/travel/comments/1urvt1f/dfds_ferry_what_happens_if_i_miss_the_return_leg/",
    "note": "Used as a Reddit discussion signal, not as a formal review score."
  },
  {
    "title": "Reddit travel discussions mentioning DFDS ferry alternatives",
    "url": "https://www.reddit.com/search/?q=DFDS%20ferry%20review",
    "note": "Used to identify customer questions about route expectations and travel alternatives."
  },
  {
    "title": "Brittany Ferries Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.brittany-ferries.co.uk",
    "note": "Used for competitor benchmark score and review count."
  },
  {
    "title": "Stena Line Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.stenaline.co.uk",
    "note": "Used for competitor benchmark score and review count."
  },
  {
    "title": "P&O Ferries Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.poferries.com",
    "note": "Used for competitor benchmark score and review count."
  },
  {
    "title": "Irish Ferries Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.irishferries.com",
    "note": "Used for competitor benchmark score and review count."
  },
  {
    "title": "Condor Ferries Trustpilot profile",
    "url": "https://www.trustpilot.com/review/condorferries.co.uk",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "Scandlines Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.scandlines.dk",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "Color Line Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.colorline.no",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "Fjord Line Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.fjordline.com",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "TT-Line Trustpilot profile",
    "url": "https://www.trustpilot.com/review/ttline.com",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "Tallink Silja Trustpilot profile",
    "url": "https://www.trustpilot.com/review/www.tallinksilja.com",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "Viking Line Trustpilot profile",
    "url": "https://www.trustpilot.com/review/vikingline.com",
    "note": "Firecrawl search was used to capture the public score and review-count snapshot for the competitor benchmark."
  },
  {
    "title": "BBC reporting on Dover ferry delays",
    "url": "https://www.bbc.co.uk/news/uk-england-kent-67837449",
    "note": "Used as a public signal for delay communication and border-control journey friction."
  },
  {
    "title": "Guardian reporting on Newhaven-Dieppe DFDS incident",
    "url": "https://www.theguardian.com/uk-news/2025/mar/12/dfds-ferry-passengers-newhaven-dieppe-compensation",
    "note": "Used as a public signal for disruption recovery and compensation risk."
  },
  {
    "title": "BBC reporting on Jersey ferry service concerns",
    "url": "https://www.bbc.com/news/articles/cp8v2gqxv1go",
    "note": "Used as a public signal for Jersey and Channel Islands service confidence."
  }
];
