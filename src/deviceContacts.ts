import * as Contacts from 'expo-contacts';

import { Lead } from './types';

/**
 * Opens the native "New Contact" form pre-filled with the lead's name and
 * phone — the user reviews and taps Done/Cancel themselves, same as the
 * expo-sms composer pattern used elsewhere. Returns false if permission was
 * denied (native form never opened) so the caller can toast accordingly.
 */
export async function addToDeviceContacts(lead: Lead): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return false;

  const [firstName, ...rest] = lead.name.trim().split(/\s+/);
  const lastName = rest.join(' ');
  await Contacts.presentFormAsync(undefined, {
    contactType: Contacts.ContactTypes.Person,
    name: lead.name.trim(),
    firstName,
    lastName,
    phoneNumbers: lead.phone
      ? [{ number: lead.phone, label: 'mobile', isPrimary: true }]
      : [],
  });
  return true;
}
