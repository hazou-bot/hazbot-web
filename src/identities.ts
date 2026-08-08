import { getEmailConnection, getSharedAccess } from './api';
import { User } from './types';

export interface Identity {
  id: string; // 'me' or a SharedAccessPerson.id
  label: string;
  sublabel: string;
}

/** 'me' plus any shared-access person who has connected their own Gmail. */
export async function getEmailIdentities(user: User | null): Promise<Identity[]> {
  const [people, myEmail] = await Promise.all([getSharedAccess(), getEmailConnection()]);
  return [
    { id: 'me', label: user?.name ?? 'Me', sublabel: myEmail?.address ?? user?.email ?? '' },
    ...people
      .filter((p) => p.emailConnection)
      .map((p) => ({ id: p.id, label: p.name, sublabel: p.emailConnection!.address })),
  ];
}

/** 'me' plus any shared-access person who has a phone number on file. */
export async function getPhoneIdentities(user: User | null): Promise<Identity[]> {
  const people = await getSharedAccess();
  return [
    { id: 'me', label: user?.name ?? 'Me', sublabel: 'This device’s number' },
    ...people.filter((p) => p.phone).map((p) => ({ id: p.id, label: p.name, sublabel: p.phone! })),
  ];
}

/**
 * Who should send a reply to this lead — always whoever's connected inbox
 * actually received it (`Lead.receivedByEmail`), matched by address against
 * the known email identities. Never a manually-picked default: a lead's
 * client only ever emailed one address, so replies must come from that same
 * address or they read as a different person replying. Falls back to the
 * signed-in user ('me', always identities[0]) when the lead has no recorded
 * receiving inbox or it doesn't match anyone currently connected.
 */
export function resolveLeadIdentity(identities: Identity[], receivedByEmail: string | undefined): Identity {
  if (receivedByEmail) {
    const match = identities.find((i) => i.sublabel.toLowerCase() === receivedByEmail.toLowerCase());
    if (match) return match;
  }
  return identities[0] ?? { id: 'me', label: 'Me', sublabel: '' };
}
