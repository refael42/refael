import type { MemberRole, Profile, Project, ProjectMember } from "../db/types";

export interface Session {
  profile: Profile;
  memberships: ProjectMember[];
  project: Project | null;
  role: MemberRole | null;
  /** Contractor rows linked to this person (normally 0 or 1). */
  contractorIds: string[];
  isDemo: boolean;
}

export type ProjectSession = Session & { project: Project; role: MemberRole };

export class AccessError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 | 404 = 403,
  ) {
    super(message);
  }
}

