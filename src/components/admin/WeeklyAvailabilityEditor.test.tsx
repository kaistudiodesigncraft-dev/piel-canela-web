import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WeeklyAvailabilityEditor } from "./WeeklyAvailabilityEditor";

vi.mock("@/app/admin/actions", () => ({
  saveWeeklyAvailability: vi.fn(),
}));

const specialtyId = "20000000-0000-4000-8000-000000000001";
const specialties = [{ id: specialtyId, name: "Masoterapia", is_active: true }];
const treatments = [{
  id: "40000000-0000-4000-8000-000000000001",
  name: "Relajación profunda",
  specialty_id: specialtyId,
  duration_minutes: 60,
  buffer_minutes: 15,
  start_interval_minutes: 30,
  is_active: true,
}];
const rules = [{
  id: "50000000-0000-4000-8000-000000000001",
  specialty_id: specialtyId,
  weekday: 1,
  start_time: "09:00:00",
  end_time: "13:00:00",
}];

describe("WeeklyAvailabilityEditor", () => {
  it("shows the selected specialty, its week and treatment cadence", () => {
    render(<WeeklyAvailabilityEditor specialties={specialties} treatments={treatments} rules={rules} />);
    expect(screen.getByLabelText("Especialidad")).toHaveValue(specialtyId);
    expect(screen.getByText("Relajación profunda")).toBeInTheDocument();
    expect(screen.getByText("Inicios cada 30 min")).toBeInTheDocument();
    expect(screen.getByText("09:00–13:00")).toBeInTheDocument();
  });

  it("copies Monday to weekdays and reports overlapping ranges", async () => {
    const user = userEvent.setup();
    render(<WeeklyAvailabilityEditor specialties={specialties} treatments={treatments} rules={rules} />);
    await user.click(screen.getByRole("button", { name: /Copiar lunes/ }));
    expect(screen.getByRole("checkbox", { name: /Martes/ })).toBeChecked();

    await user.click(screen.getAllByRole("button", { name: "Agregar franja" })[0]!);
    const starts = screen.getAllByLabelText(/Inicio de la franja .* del Lunes/);
    const ends = screen.getAllByLabelText(/Fin de la franja .* del Lunes/);
    await user.clear(starts[1]!);
    await user.type(starts[1]!, "12:30");
    await user.clear(ends[1]!);
    await user.type(ends[1]!, "14:00");
    expect(screen.getByText("Las franjas del mismo día no pueden superponerse.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar semana" })).toBeDisabled();
  });
});
