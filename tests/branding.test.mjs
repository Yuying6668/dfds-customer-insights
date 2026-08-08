import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { displayBrandText } from '../app/lib/brand-display.mjs';

const reactSources = Object.fromEntries(
  await Promise.all(
    [
      'app/App.jsx',
      'app/components/chat-widget.jsx',
      'app/routes/OverviewRoute.jsx',
      'app/routes/CustomerVoiceRoute.jsx',
      'app/routes/PassengerProfileRoute.jsx',
      'app/routes/CompetitorsRoute.jsx'
    ].map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])
  )
);

const appSource = reactSources['app/App.jsx'];

test("uses Mia's Cruises branding without the DFDS logo card", () => {
  assert.match(appSource, /Mia's Cruises/);
  assert.doesNotMatch(appSource, /DFDS_logo_2015\.svg/);
  assert.doesNotMatch(appSource, /brand-logo-card/);
  assert.match(appSource, /className="brand-mark"/);
  assert.match(appSource, /aria-label="Mia's Cruises logo"/);
});

test("masks the original company name in display text", () => {
  assert.equal(displayBrandText('DFDS routes and DFDS Passenger'), "Mia's Cruises routes and Mia's Cruises Passenger");
});

test("uses Mia's Cruises in all non-source product copy", () => {
  for (const [path, source] of Object.entries(reactSources)) {
    assert.match(source, /Mia's Cruises/, `${path} should name Mia's Cruises`);
  }

  assert.doesNotMatch(appSource, /ferry brands DFDS/);
  assert.doesNotMatch(reactSources['app/components/chat-widget.jsx'], /should DFDS fix first|What can DFDS learn|DFDS Customer Intelligence/);
  assert.doesNotMatch(reactSources['app/routes/OverviewRoute.jsx'], /how DFDS looks|Is DFDS building/);
  assert.doesNotMatch(reactSources['app/routes/CustomerVoiceRoute.jsx'], /telling DFDS/);
  assert.doesNotMatch(reactSources['app/routes/PassengerProfileRoute.jsx'], /DFDS-relevant/);

  const competitorsSource = reactSources['app/routes/CompetitorsRoute.jsx'];
  assert.match(competitorsSource, /item\.company === "DFDS"/);
  assert.match(competitorsSource, /item\.company !== "DFDS"/);
  assert.match(competitorsSource, /row\.company === "DFDS"/);
  assert.match(competitorsSource, /Mia's Cruises/);
  assert.doesNotMatch(competitorsSource, /how DFDS compares|overlap with DFDS|Start with DFDS|What DFDS can learn/);
  assert.match(competitorsSource, /function displayCompetitorText\(text\)/);
  assert.match(competitorsSource, /data\.competitorScope\.bullets\.map\(displayCompetitorText\)/);
  assert.match(competitorsSource, /displayCompetitorText\(row\.category\)/);
});
