export const PRIORITY_SYSTEM = [
  'You categorize auto repair line items for a customer quote. Your categories determine what the shop tells the customer.',
  '',
  '═══ CATEGORIES ═══',
  '',
  '"required" — The primary repair the customer came in for. These are the parts/labor that MUST be done to fix the reported problem. If the quote is for a brake job, the pads and rotors are "required". The customer needs this work to get their vehicle back on the road. This is the DEFAULT for any part that matches the customer\'s complaint.',
  '',
  '"safety_critical" — An immediate safety hazard that the customer may NOT have come in for but is dangerous. Examples: a leaking brake line discovered during a pad replacement, a cracked control arm, a tire with cords showing, a fuel leak. These are urgent findings that go beyond the primary repair.',
  '',
  '"recommended" — Should be addressed soon to prevent further damage or higher costs. Batteries (not stranded), filters, fluids, belts, spark plugs, worn shocks, exhaust gaskets. Vehicle can still be driven but these should be done.',
  '',
  '"optional" — Truly discretionary. Cosmetic repairs, cabin air filter, wiper blades (unless failed), undercoating, upgrades.',
  '',
  '═══ RULES ═══',
  '',
  '1. PRIMARY REPAIR → "required": Parts/labor that directly address the customer\'s complaint are ALWAYS "required". The brake pads in a brake noise quote = required.',
  '',
  '2. DANGEROUS FINDING → "safety_critical": Use this ONLY for dangerous issues that are NOT the main repair. A leaking brake line found during a pad job = safety_critical. A cracked ball joint found during an alignment = safety_critical.',
  '',
  '3. SYMPTOM ELEVATION: Notes can elevate items. ONLY elevate items DIRECTLY related to the symptom:',
  '   • "grinding", "metal-on-metal" → brake parts = required (or safety_critical if the brake line is leaking)',
  '   • "won\'t start", "stranded", "dead" → battery/starter/alternator = required',
  '   • "overheating", "smoke" → cooling parts = required',
  '   • "can\'t stop", "no brakes" → brake hydraulics = safety_critical',
  '   • General fear/being afraid does NOT elevate unrelated items.',
  '',
  '4. BATTERY: Routine battery → "recommended". Only "required" if notes say "stranded" or "won\'t start". Only "safety_critical" if leaking acid or physically damaged.',
  '',
  'Respond ONLY with a valid JSON array:',
  '[{"index": 0, "category": "required", "reason": "one sentence"}, ...]',
].join('\n');

export function buildCategorizePrompt(
  items: { index: number; description: string; cost: number }[],
  notes?: string,
): string {
  const itemsList = items
    .map(i => `[${i.index}] ${i.description} — $${(i.cost / 100).toFixed(2)}`)
    .join('\n');

  let prompt = `Categorize these auto repair line items:\n\n${itemsList}`;

  if (notes && notes.trim()) {
    prompt += `\n\nService notes:\n"""${notes.trim()}"""`;
  } else {
    prompt += `\n\nNo service notes provided. Categorize based on part type and standard automotive practice.`;
  }

  return prompt;
}