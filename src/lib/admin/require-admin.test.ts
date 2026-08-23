import { describe, expect, it } from "vitest";
import {
  isOperationalAdminRole,
  isOwnerRole,
  OPERATIONAL_ADMIN_ROLES,
} from "./require-admin";

describe("administrative role boundaries", () => {
  it("allows owners and managers to operate the day-to-day admin", () => {
    expect(OPERATIONAL_ADMIN_ROLES).toEqual(["admin", "manager"]);
    expect(isOperationalAdminRole("admin")).toBe(true);
    expect(isOperationalAdminRole("manager")).toBe(true);
  });

  it("keeps ownership-only areas exclusive to the admin role", () => {
    expect(isOwnerRole("admin")).toBe(true);
    expect(isOwnerRole("manager")).toBe(false);
    expect(isOwnerRole("owner")).toBe(false);
    expect(isOwnerRole(undefined)).toBe(false);
  });

  it("rejects unknown and inactive-profile role values", () => {
    expect(isOperationalAdminRole("owner")).toBe(false);
    expect(isOperationalAdminRole("staff")).toBe(false);
    expect(isOperationalAdminRole(null)).toBe(false);
  });
});
