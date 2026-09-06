import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedBookingSelection } from "@/domain/treatment";
import { LiveBookingFlow } from "./LiveBookingFlow";

const { getAvailableSlotsMock, createPublicBookingMock } = vi.hoisted(() => ({
  getAvailableSlotsMock: vi.fn(),
  createPublicBookingMock: vi.fn(),
}));

vi.mock("@/app/(public)/reservar/actions", () => ({
  getAvailableSlots: (...args: unknown[]) => getAvailableSlotsMock(...args),
  createPublicBooking: (...args: unknown[]) => createPublicBookingMock(...args),
}));

const selection: ResolvedBookingSelection = {
  treatmentId: "30000000-0000-4000-8000-000000000001",
  treatmentName: "Relajación profunda",
  durationMinutes: 60,
  basePriceCents: 6500000,
  appliedPriceCents: 6500000,
};

const dates = [{
  value: "2026-08-17",
  weekday: "Lun",
  day: "17",
  month: "Ago",
  longLabel: "lunes, 17 de agosto",
}];

describe("LiveBookingFlow", () => {
  beforeEach(() => {
    getAvailableSlotsMock.mockReset();
    createPublicBookingMock.mockReset();
    getAvailableSlotsMock.mockResolvedValue({
      ok: true,
      slots: [{ startsAt: "2026-08-17T15:30:00.000Z", endsAt: "2026-08-17T16:45:00.000Z" }],
    });
    createPublicBookingMock.mockResolvedValue({
      ok: true,
      bookingId: "50000000-0000-4000-8000-000000000001",
      bookingCode: "PC-ABC12345",
      status: "pending",
    });
  });

  it("loads availability and creates a real pre-booking", async () => {
    const user = userEvent.setup();
    render(<LiveBookingFlow selection={selection} dates={dates} whatsappNumber="5493515550000" />);

    const slot = await screen.findByRole("button", { name: "12:30" });
    await user.click(slot);
    await user.click(screen.getAllByRole("button", { name: /continuar/i })[0]!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Contanos cómo contactarte." })).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Nombre y apellido"), { target: { value: "Laura Gómez" } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "3515550000" } });
    await user.click(screen.getByRole("button", { name: /revisar reserva/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Revisá antes de crear la pre-reserva." })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: /crear pre-reserva/i }));

    await waitFor(() => expect(createPublicBookingMock).toHaveBeenCalledTimes(1));
    expect(createPublicBookingMock).toHaveBeenCalledWith(expect.objectContaining({ website: "" }));
    expect(await screen.findByText("PC-ABC12345")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continuar por whatsapp/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/5493515550000"),
    );
  });

  it("keeps the confirmation usable when the business WhatsApp is not configured", async () => {
    const user = userEvent.setup();
    render(<LiveBookingFlow selection={selection} dates={dates} whatsappNumber={null} />);

    await user.click(await screen.findByRole("button", { name: "12:30" }));
    await user.click(screen.getAllByRole("button", { name: /continuar/i })[0]!);
    fireEvent.change(screen.getByLabelText("Nombre y apellido"), { target: { value: "Laura Gómez" } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "3515550000" } });
    await user.click(screen.getByRole("button", { name: /revisar reserva/i }));
    await user.click(screen.getByRole("button", { name: /crear pre-reserva/i }));

    expect(await screen.findByText(/se comunicará al WhatsApp que informaste/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /continuar por whatsapp/i })).not.toBeInTheDocument();
  });

  it("keeps long availability lists compact until the person asks for more", async () => {
    const user = userEvent.setup();
    getAvailableSlotsMock.mockResolvedValue({
      ok: true,
      slots: Array.from({ length: 16 }, (_, index) => ({
        startsAt: new Date(Date.UTC(2026, 7, 17, 12, index * 15)).toISOString(),
        endsAt: new Date(Date.UTC(2026, 7, 17, 13, index * 15)).toISOString(),
      })),
    });

    render(<LiveBookingFlow selection={selection} dates={dates} whatsappNumber="5493515550000" />);

    const reveal = await screen.findByRole("button", { name: "Ver 4 horarios más" });
    await user.click(reveal);
    expect(screen.getByRole("button", { name: "Ver menos horarios" })).toHaveAttribute("aria-expanded", "true");
  });

  it("reveals the administrator-defined booking window progressively", async () => {
    const user = userEvent.setup();
    const longWindow = Array.from({ length: 18 }, (_, index) => ({
      value: `2026-09-${String(index + 1).padStart(2, "0")}`,
      weekday: "Lun",
      day: String(index + 1),
      month: "Sep",
      longLabel: `lunes, ${index + 1} de septiembre`,
    }));

    render(<LiveBookingFlow selection={selection} dates={longWindow} whatsappNumber="5493515550000" />);
    expect(screen.queryByRole("button", { name: /18 Sep/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver 4 fechas más" }));
    expect(screen.getByRole("button", { name: /18 Sep/i })).toBeInTheDocument();
  });

  it("recovers from a slot taken concurrently without losing customer data", async () => {
    const user = userEvent.setup();
    createPublicBookingMock.mockResolvedValueOnce({ ok: false, reason: "slot" });
    render(<LiveBookingFlow selection={selection} dates={dates} whatsappNumber="5493515550000" />);

    await user.click(await screen.findByRole("button", { name: "12:30" }));
    await user.click(screen.getAllByRole("button", { name: /continuar/i })[0]!);
    fireEvent.change(screen.getByLabelText("Nombre y apellido"), { target: { value: "Laura Gómez" } });
    fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "3515550000" } });
    await user.click(screen.getByRole("button", { name: /revisar reserva/i }));
    await user.click(screen.getByRole("button", { name: /crear pre-reserva/i }));

    expect(await screen.findByText("Ese horario acaba de ocuparse. Elegí otra opción disponible.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Elegí cuándo querés venir." })).toBeInTheDocument();
    await waitFor(() => expect(getAvailableSlotsMock).toHaveBeenCalledTimes(2));

    await user.click(await screen.findByRole("button", { name: "12:30" }));
    await user.click(screen.getAllByRole("button", { name: /continuar/i })[0]!);
    expect(screen.getByLabelText("Nombre y apellido")).toHaveValue("Laura Gómez");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("3515550000");
  });
});
