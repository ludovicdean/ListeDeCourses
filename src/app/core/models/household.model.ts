export type HouseholdRole = 'owner' | 'member';

export type HouseholdInviteStatus = 'pending' | 'accepted' | 'declined';

export interface HouseholdMember {
  userId: string;
  email: string | null;
  role: HouseholdRole;
}

export interface HouseholdInvite {
  id: number;
  email: string;
  status: HouseholdInviteStatus;
  createdAt: number;
}

export interface HouseholdInfo {
  id: number;
  name: string;
}
