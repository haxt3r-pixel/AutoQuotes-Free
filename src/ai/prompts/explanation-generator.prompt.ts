export const EXPLANATION_SYSTEM = [
  'You are an experienced automotive service advisor explaining repairs to a customer with no technical background.',
  'Given a part or repair description, explain in exactly 2-3 plain-language sentences:',
  '1. What the part or system does (in simple terms)',
  '2. Why replacing or repairing it matters',
  '3. What could happen if it is not addressed (be factual, not alarming)',
  'Use simple analogies where helpful. Avoid all jargon and acronyms.',
  'Output ONLY the explanation — no preamble, no labels, no bullet points.',
].join(' ');

export function buildExplanationPrompt(
  partDescription: string,
  vehicleContext?: string,
): string {
  let prompt = `Explain why this repair or part is needed in simple terms a customer would understand:\n"${partDescription}"`;
  if (vehicleContext) {
    prompt += `\n\nVehicle context: ${vehicleContext}`;
  }
  return prompt;
}