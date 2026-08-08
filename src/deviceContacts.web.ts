import { Lead } from './types';

/**
 * Web equivalent of the native "New Contact" form: generates a standard
 * vCard (.vcf) and triggers a download. Opening the downloaded file hands
 * the contact to the OS/phone contacts app — the closest the browser gets
 * to expo-contacts' presentFormAsync (there is no web API for writing to
 * the device's address book directly). Returns true so callers treat it as
 * handled rather than showing an error.
 */
export async function addToDeviceContacts(lead: Lead): Promise<boolean> {
  const name = lead.name.trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(' ');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${name}`,
    lead.phone ? `TEL;TYPE=CELL:${lead.phone}` : null,
    lead.email ? `EMAIL:${lead.email}` : null,
    lead.listing ? `NOTE:Inquired about ${lead.listing} via ${lead.source}` : null,
    'END:VCARD',
  ].filter(Boolean);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^\w -]/g, '') || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
