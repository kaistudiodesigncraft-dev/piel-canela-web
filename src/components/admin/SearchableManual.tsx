"use client";
import { useState } from "react";
import Link from "next/link";

export function SearchableManual({ sections }: { sections: { title: string; steps: string[]; href?: string }[] }) {
  const [query, setQuery] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const visible = sections.filter((section) => normalize([section.title, ...section.steps].join(" ")).includes(normalize(query.trim())));
  return <>
    <label className="admin-search">Buscar en el manual<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Imagen, contraseña, combo…" /></label>
    <p role="status">{visible.length} temas encontrados</p>
    <div className="admin-manual-grid">{visible.map((section) => <article className="admin-manual-card" key={section.title}>
      <h3>{section.title}</h3><ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      {section.href ? <Link className="button button--quiet" href={section.href}>Abrir esta tarea</Link> : null}
    </article>)}</div>
    {visible.length === 0 ? <p>Probá otra palabra o borrá la búsqueda para ver todos los temas.</p> : null}
  </>;
}
