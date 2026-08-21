import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookingStatusTransitionForm } from "./BookingStatusTransitionForm";

vi.mock("@/app/admin/actions", () => ({ updateBookingStatus: vi.fn() }));

describe("BookingStatusTransitionForm", () => {
  it("asks for a reason only when the chosen transition requires it", async () => {
    const user = userEvent.setup();
    render(
      <BookingStatusTransitionForm
        bookingId="20000000-0000-4000-8000-000000000001"
        bookingCode="PC-4821"
        transitions={["completed", "cancelled", "no_show"]}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Motivo" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "cancelled");
    expect(screen.getByRole("textbox", { name: "Motivo" })).toBeRequired();
    await user.selectOptions(screen.getByRole("combobox"), "completed");
    expect(screen.queryByRole("textbox", { name: "Motivo" })).not.toBeInTheDocument();
  });
});
