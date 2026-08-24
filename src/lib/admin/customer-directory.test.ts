import { describe, expect, it } from "vitest";
import {
  customerDirectoryHref,
  customerDirectoryPageRange,
  parseCustomerDirectoryQuery,
} from "./customer-directory";

describe("customer directory query", () => {
  it("normalizes unsafe filter syntax and invalid pages", () => {
    expect(parseCustomerDirectoryQuery({
      customerQuery: "  Ana,_% (351)  ",
      customerPage: "0",
    })).toEqual({ query: "Ana 351", page: 1 });
  });

  it("calculates the database range", () => {
    expect(customerDirectoryPageRange(2)).toEqual({ from: 30, to: 59 });
  });

  it("preserves search in pagination links", () => {
    expect(customerDirectoryHref({ query: "Laura", page: 1 }, { page: 2 }))
      .toBe("/admin/clientes?customerQuery=Laura&customerPage=2#directorio");
  });
});
