import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { treatmentCategories } from "@/data/fixtures";
import { CategoryEntryCard } from "./CategoryEntryCard";

describe("CategoryEntryCard", () => {
  it("renders the approved three category entries with filter URLs", () => {
    render(
      <div>
        {treatmentCategories.map((category) => (
          <CategoryEntryCard key={category.id} category={category} />
        ))}
      </div>,
    );

    const links = screen.getAllByRole("link", { name: /ver tratamientos/i });
    expect(links).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Estética" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bienestar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recuperación" })).toBeInTheDocument();
    expect(links[0]).toHaveAttribute("href", "/tratamientos?category=estetica#catalogo");
    expect(links[1]).toHaveAttribute("href", "/tratamientos?category=bienestar#catalogo");
    expect(links[2]).toHaveAttribute("href", "/tratamientos?category=recuperacion#catalogo");
  });
});

