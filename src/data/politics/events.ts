import type { GameEventDef } from '../../sim/content';

// Condition-driven political events. They do not follow a fixed presidential calendar: they appear
// when the political system actually reaches the state described in their conditions.

export const POLITICAL_EVENTS: GameEventDef[] = [
  {
    id: 'pol_parliamentary_crisis',
    date: '1936-01-15',
    title: 'A Government Without a Majority',
    category: 'political',
    political: true,
    body: 'The chamber has rejected the government\'s budget by four votes. Coalition partners are already drafting statements distancing themselves from the cabinet, and the opposition benches are calling for a confidence motion. The country is not yet in crisis, but it can see one from here.',
    conditions: { maxStability: 0.48, maxLegitimacy: 0.6, systems: ['parliamentary_republic', 'constitutional_monarchy', 'federal_republic'] },
    options: [
      { label: 'Buy the coalition another year', detail: 'Offices, committee chairs and a revised budget. It is expensive, and everyone knows it.', political: { legitimacy: 0.03, groups: [{ name: 'Liberal Party', influence: 4 }], politicalPower: -15 }, bundle: { stability: 0.02 } },
      { label: 'Call the opposition\'s bluff', detail: 'Demand a confidence vote and dare the chamber to bring down the government.', political: { tension: 6, legitimacy: -0.02, flags: ['confidence_crisis'] }, bundle: { stability: -0.02 } },
      { label: 'Ask the head of state to intervene', detail: 'A dissolution, a royal commission or a caretaker cabinet — anything that avoids a vote.', political: { legitimacy: -0.04, tension: 4, mechanicValue: -3 }, followUp: 'pol_caretaker_government' },
    ],
  },
  {
    id: 'pol_caretaker_government',
    date: '1936-01-15',
    title: 'The Caretaker Experiment',
    category: 'political',
    political: true,
    body: 'The head of state has appointed a caretaker administration of civil servants and soldiers. It promises elections within the year. The parties have agreed to nothing except that they will not be blamed for the next six months.',
    conditions: { flags: ['confidence_crisis'] },
    options: [
      { label: 'Let the caretakers govern', detail: 'A pause in party politics, at the cost of legitimacy.', political: { legitimacy: -0.05, mechanicValue: 4, tension: 3 } },
      { label: 'Demand an immediate election', detail: 'Force the issue before the caretakers entrench themselves.', political: { legitimacy: 0.02, tension: 2, flags: ['election_demanded'] } },
    ],
  },
  {
    id: 'pol_royal_succession',
    date: '1936-01-20',
    title: 'The Succession Question',
    category: 'political',
    political: true,
    body: 'The royal household has confirmed that the sovereign is seriously ill. There is no agreed successor, and the court is divided between a popular reformer and a conservative traditionalist. Every faction in the capital has an opinion about the succession — and a candidate.',
    conditions: { systems: ['constitutional_monarchy', 'absolute_monarchy'] },
    options: [
      { label: 'Back the reformer', detail: 'A modern crown, a weakened court and a new constitutional settlement.', political: { legitimacy: 0.03, mechanicValue: -4, flags: ['reformer_on_throne'], tension: 2 } },
      { label: 'Back the traditionalist', detail: 'Continuity, the officer corps and the church — and a court that will remember its friends.', political: { legitimacy: 0.02, mechanicValue: 6, groups: [{ name: 'Crown Household', influence: 5 }], tension: 4 } },
      { label: 'Let the chamber decide', detail: 'Turn a dynastic question into a constitutional one.', political: { legitimacy: 0.04, tension: 5, mechanicValue: -6, flags: ['parliamentary_succession'] } },
    ],
  },
  {
    id: 'pol_revolutionary_demonstrations',
    date: '1936-02-01',
    title: 'The Streets Are Moving',
    category: 'political',
    political: true,
    body: 'A wildcat strike in the capital has become a general demonstration. Factory committees are marching under their own banners, and the garrison has been confined to barracks. The movement is large enough to frighten the government and divided enough to frighten itself.',
    conditions: { minRevolutionSupport: 22, maxStability: 0.55 },
    options: [
      { label: 'Meet the workers\' delegates', detail: 'Recognise the committees and negotiate. The government survives by sharing a little power.', political: { revolutionSupport: 6, legitimacy: 0.02, tension: -4 }, bundle: { stability: 0.02 } },
      { label: 'Send in the security services', detail: 'Break the strike before it becomes a government.', political: { revolutionSupport: -5, governmentLoyalty: 4, tension: 7 }, bundle: { stability: -0.03 } },
      { label: 'Join the movement', detail: 'Put the government\'s remaining authority behind the street.', political: { revolutionSupport: 12, revolutionOrganization: 5, flags: ['government_embraces_street'], tension: 4 } },
    ],
  },
  {
    id: 'pol_coup_rumours',
    date: '1936-02-10',
    title: 'Rumours in the Officers\' Mess',
    category: 'political',
    political: true,
    body: 'Military intelligence reports that a group of senior officers has been meeting without authorisation. Nothing has been put in writing. The minister of war insists the reports are exaggerated; the head of the security service does not.',
    conditions: { minTension: 18 },
    options: [
      { label: 'Purge the suspected ringleaders', detail: 'Act first and accept the damage to the officer corps.', political: { governmentLoyalty: 5, groups: [{ name: 'General Staff', influence: -8 }, { name: 'Reichswehr Command', influence: -8 }], tension: 4 }, bundle: { stability: -0.02 } },
      { label: 'Buy their loyalty', detail: 'Promotions, commands and a larger defence budget.', political: { governmentLoyalty: 3, groups: [{ name: 'General Staff', influence: 4 }] }, bundle: { treasury: -60, stability: 0.01 } },
      { label: 'Do nothing', detail: 'Perhaps the reports are exaggerated. Perhaps the officers are waiting to see what happens.', political: { tension: 3, flags: ['coup_unaddressed'] } },
    ],
  },
  {
    id: 'pol_electoral_victory',
    date: '1936-03-01',
    title: 'A Mandate, Not a Coronation',
    category: 'political',
    political: true,
    body: 'The governing party has won the election, but with a reduced majority. The result is a mandate to continue, not a licence to ignore the chamber. The opposition is already describing the victory as temporary.',
    conditions: { minLegitimacy: 0.62, systems: ['parliamentary_republic', 'constitutional_monarchy', 'federal_republic'] },
    options: [
      { label: 'Govern from the centre', detail: 'A broad cabinet and a modest programme.', political: { legitimacy: 0.02, tension: -3, mechanicValue: 4 } },
      { label: 'Push through the radical programme', detail: 'The mandate is real. Use it before it fades.', political: { legitimacy: 0.04, tension: 6, flags: ['radical_mandate'] }, bundle: { stability: -0.02 } },
    ],
  },
  {
    id: 'pol_war_defeat',
    date: '1936-03-10',
    title: 'The Government of Defeat',
    category: 'political',
    political: true,
    body: 'The army has been beaten in the field and the government must explain why. Crowds have gathered outside the cabinet office. The opposition is demanding a vote of no confidence, and the general staff is drafting a statement that carefully avoids the word "responsibility".',
    conditions: { flags: ['war_defeat'] },
    options: [
      { label: 'Accept responsibility and resign', detail: 'A caretaker government will manage the armistice.', political: { legitimacy: -0.08, stability: -0.03, tension: 8, flags: ['government_resigned'] } },
      { label: 'Blame the army', detail: 'A political survival strategy that turns the officer corps into an enemy.', political: { legitimacy: 0.02, tension: 10, groups: [{ name: 'General Staff', influence: -6 }], flags: ['army_blamed'] } },
      { label: 'Promise reconstruction', detail: 'A national programme, a new cabinet and an enquiry with a narrow mandate.', political: { legitimacy: 0.03, stability: 0.02, flags: ['reconstruction_debate'] } },
    ],
  },
  {
    id: 'pol_government_scandal',
    date: '1936-04-01',
    title: 'The Minister\'s Ledger',
    category: 'political',
    political: true,
    body: 'A newspaper has published a ledger showing payments to a cabinet minister from an industrial consortium. The minister calls it a clerical error. The opposition calls it corruption. The security service calls it an opportunity.',
    conditions: { maxLegitimacy: 0.6, minTension: 10 },
    options: [
      { label: 'Sack the minister', detail: 'A public sacrifice to restore confidence.', political: { legitimacy: 0.02, tension: -3 }, bundle: { stability: 0.01 } },
      { label: 'Suppress the story', detail: 'The press can be persuaded. The public cannot be un-persuaded.', political: { legitimacy: -0.03, tension: 4, governmentLoyalty: 2 } },
      { label: 'Open a public enquiry', detail: 'A slow, dignified process that may clear the minister or bury the government.', political: { legitimacy: 0.01, tension: 2, flags: ['scandal_enquiry'] } },
    ],
  },
];
