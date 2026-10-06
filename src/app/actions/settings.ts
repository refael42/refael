"use server";
import type { AreaType, MemberRole } from "@/lib/db/types";
import * as svc from "@/lib/services/settings";
import { run } from "./_run";

export async function createAreasAction(input: { parentId: string | null; type: AreaType; names: string[] }) {
  return run(async (ctx) => (await svc.createAreas(ctx, input)).length);
}
export async function renameAreaAction(id: string, name: string) {
  return run(async (ctx) => {
    await svc.renameArea(ctx, id, name);
  });
}
export async function deleteAreaAction(id: string) {
  return run(async (ctx) => {
    await svc.deleteArea(ctx, id);
  });
}
export async function createContractorAction(input: svc.ContractorInput) {
  return run(async (ctx) => (await svc.createContractor(ctx, input)).id);
}
export async function updateContractorAction(id: string, input: Partial<svc.ContractorInput>) {
  return run(async (ctx) => {
    await svc.updateContractor(ctx, id, input);
  });
}
export async function addMemberAction(input: { name: string; phone?: string | null; email?: string | null; role: Exclude<MemberRole, "contractor"> }) {
  return run(async (ctx) => (await svc.addMember(ctx, input)).id);
}
export async function setMemberRoleAction(profileId: string, role: MemberRole) {
  return run(async (ctx) => {
    await svc.setMemberRole(ctx, profileId, role);
  });
}
export async function removeMemberAction(profileId: string) {
  return run(async (ctx) => {
    await svc.removeMember(ctx, profileId);
  });
}
