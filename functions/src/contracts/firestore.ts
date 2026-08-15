import type { Timestamp } from 'firebase-admin/firestore';

export const COLLECTIONS = {
  users: 'users',
  teams: 'teams',
  members: 'members',
  inviteTokens: 'inviteTokens',
  links: 'links',
  history: 'history',
  dailyClicks: 'dailyClicks',
} as const;

export const documentPaths = {
  user: (uid: string) => `users/${uid}`,
  team: (teamId: string) => `teams/${teamId}`,
  member: (teamId: string, uid: string) => `teams/${teamId}/members/${uid}`,
  inviteToken: (tokenHash: string) => `inviteTokens/${tokenHash}`,
  link: (slug: string) => `links/${slug}`,
  linkHistory: (slug: string, entryId: string) => `links/${slug}/history/${entryId}`,
  dailyClicks: (slug: string, dayUtc: string) => `links/${slug}/dailyClicks/${dayUtc}`,
} as const;

export type MembershipRole = 'admin' | 'member';
export type LinkStatus = 'active' | 'disabled' | 'archived';

export interface UserDocument {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface TeamDocument {
  readonly id: string;
  readonly name: string;
  readonly createdBy: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface MemberDocument {
  readonly uid: string;
  readonly teamId: string;
  readonly role: MembershipRole;
  readonly displayName: string;
  readonly email: string;
  readonly joinedAt: Timestamp;
}

export interface InviteTokenDocument {
  readonly teamId: string;
  readonly createdBy: string;
  readonly expiresAt: Timestamp;
  readonly canceledAt: Timestamp | null;
  readonly role: MembershipRole;
  readonly createdAt: Timestamp;
}

export interface LinkDocument {
  readonly teamId: string;
  readonly createdBy: string;
  readonly destinationUrl: string;
  readonly status: LinkStatus;
  readonly totalClicks: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface LinkHistoryDocument {
  readonly action: 'created' | 'destination_changed' | 'disabled' | 'archived' | 'restored';
  readonly actorId: string;
  readonly previousValue: string | null;
  readonly nextValue: string | null;
  readonly createdAt: Timestamp;
}

export interface DailyClicksDocument {
  readonly count: number;
  readonly dayUtc: string;
  readonly updatedAt: Timestamp;
}
