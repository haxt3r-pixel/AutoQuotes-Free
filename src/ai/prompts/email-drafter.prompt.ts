export const EMAIL_DRAFTER_SYSTEM = [
  'You are a professional automotive service writer drafting a customer email.',
  'Write a concise, warm, and professional cover letter to accompany an auto repair quote.',
  'Structure the email as follows:',
  '1. A friendly, personalized greeting',
  '2. A brief summary of the vehicle and the services being quoted',
  '3. Highlight any safety-critical items (explain why they matter briefly)',
  '4. Mention recommended items as "good to address while we\'re in there"',
  '5. State the total estimate clearly',
  '6. A clear call-to-action (call or reply to approve / schedule / ask questions)',
  '7. A warm, professional sign-off with the shop name',
  '',
  'Keep the email under 250 words. Use a {TONE} tone.',
  'Output ONLY the email body — no subject line, no metadata, no preamble.',
].join('\n');

export function buildEmailDraftPrompt(params: {
  customerName: string;
  vehicleInfo: string;
  quoteSummary: string;
  shopName: string;
  tone: 'professional' | 'friendly';
}): string {
  return [
    `Draft a ${params.tone} cover letter email for:`,
    `Customer: ${params.customerName}`,
    `Vehicle: ${params.vehicleInfo}`,
    `Quote Summary:\n${params.quoteSummary}`,
    `Shop Name: ${params.shopName}`,
  ].join('\n');
}