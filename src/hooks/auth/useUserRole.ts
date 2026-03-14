"use client";

import { useMemo } from "react";
import { normalizeUserRole, type UserRole } from "@/lib/auth/roles";

export interface UseUserRoleParams {
	metadataRole?: string | null;
	dbRole?: string | null;
	fallbackRole?: string | null;
}

export function resolveUserRole(params?: UseUserRoleParams): UserRole {
	const candidateRole = params?.dbRole ?? params?.metadataRole ?? params?.fallbackRole;
	return normalizeUserRole(candidateRole);
}

export function useUserRole(params?: UseUserRoleParams): UserRole {
	return useMemo(() => resolveUserRole(params), [params?.dbRole, params?.fallbackRole, params?.metadataRole]);
}