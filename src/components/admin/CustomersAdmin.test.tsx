import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CustomersAdmin, type CustomerAdminRow } from "./CustomersAdmin";

vi.mock("@/app/admin/clientes/actions", () => ({ saveCustomer: vi.fn() }));

const customers: CustomerAdminRow[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    full_name: "María Pérez",
    phone: "+54 9 351 555 0000",
    email: "maria@example.com",
    internal_notes: null,
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    bookings: [{
      id: "20000000-0000-4000-8000-000000000001",
      customer_id: "10000000-0000-4000-8000-000000000001",
      booking_code: "PC-MARIA",
      status: "confirmed",
      starts_at: "2026-08-23T15:00:00.000Z",
      applied_price_snapshot_cents: 4_200_000,
      treatment_name_snapshot: "Limpieza facial",
    }],
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    full_name: "Laura Gómez",
    phone: "351 555 1111",
    email: null,
    internal_notes: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    bookings: [],
  },
];

describe("CustomersAdmin", () => {
  it("submits server-side search and exposes booking history progressively", async () => {
    const user = userEvent.setup();
    render(<CustomersAdmin customers={customers} referenceTime="2026-08-21T12:00:00.000Z" feedback={{}} directory={{ query: "", page: 1, total: 2, pageSize: 30 }} />);
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.getByText("María Pérez")).toBeInTheDocument();
    expect(screen.getByText("Laura Gómez")).toBeInTheDocument();
    await user.click(screen.getByText("María Pérez"));
    expect(screen.getByText("PC-MARIA")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Abrir WhatsApp" })[0]).toHaveAttribute("href", "https://wa.me/5493515550000");
  });
});
