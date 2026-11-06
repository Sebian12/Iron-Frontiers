// Intelligence operations available from the intelligence screen. They are generic (any country can
// run them) and are resolved by the daily simulation.

export interface IntelligenceOperation {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number; // political power
  days: number;
  reward: number; // political power returned on completion
  risk: 'low' | 'moderate' | 'high';
}

export const OPERATIONS: IntelligenceOperation[] = [
  {
    id: 'op_network',
    name: 'Build an Agent Network',
    icon: 'spy',
    description: 'Recruit local contacts in the target capital and establish a secure courier route.',
    cost: 35,
    days: 60,
    reward: 25,
    risk: 'low',
  },
  {
    id: 'op_industry',
    name: 'Industrial Espionage',
    icon: 'factory',
    description: 'Photograph production lines and acquire machine-tool blueprints from a target plant.',
    cost: 50,
    days: 90,
    reward: 40,
    risk: 'moderate',
  },
  {
    id: 'op_ciphers',
    name: 'Cipher Interception',
    icon: 'lock',
    description: 'Intercept and break the target’s diplomatic traffic for the next quarter.',
    cost: 65,
    days: 120,
    reward: 55,
    risk: 'moderate',
  },
  {
    id: 'op_sabotage',
    name: 'Rail Sabotage',
    icon: 'target',
    description: 'Disrupt a key marshalling yard to delay the movement of enemy formations.',
    cost: 80,
    days: 100,
    reward: 30,
    risk: 'high',
  },
  {
    id: 'op_counter',
    name: 'Counter-Intelligence Sweep',
    icon: 'eye',
    description: 'Roll up hostile networks operating inside the capital and the armaments districts.',
    cost: 45,
    days: 75,
    reward: 35,
    risk: 'low',
  },
];
