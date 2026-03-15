import { useMemo } from "react";
import { normalizeUserRole, type UserRole } from "@/lib/auth/roles";

type UseUserRoleOptions = {
	metadataRole?: string | null;
};

export function useUserRole(options: UseUserRoleOptions = {}): UserRole {
	return useMemo(() => normalizeUserRole(options.metadataRole), [options.metadataRole]);
}
