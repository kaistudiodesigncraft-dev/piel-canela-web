import { SearchableManual } from "@/components/admin/SearchableManual";
import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Manual de uso",
  description: "Guía operativa del panel administrativo de Piel Canela.",
};

const sections = [
  {
    title: "Ingresar, salir y cambiar contraseña",
    steps: [
      "Entrá al panel con el correo autorizado por Kai Studio o Piel Canela.",
      "Usá Mi cuenta para cambiar la contraseña cuando recepción lo necesite.",
      "Cerrá sesión si el equipo comparte computadora o si el panel queda abierto en recepción.",
    ],
  },
  {
    title: "Cargar un tratamiento",
    steps: [
      "Abrí Tratamientos y elegí Nuevo tratamiento.",
      "Completá nombre, categoría, especialidad, descripción, duración, preparación y frecuencia de inicio.",
      "Asigná al menos un profesional activo antes de publicar para evitar turnos pisados.",
      "Podés guardar borrador sin imagen y agregarla después.",
      "Publicá cuando precio, duración y textos estén revisados. La imagen es opcional; si la cargás, revisá también su descripción accesible.",
    ],
  },
  {
    title: "Editar o desactivar un tratamiento",
    steps: [
      "Entrá a Tratamientos y abrí el tratamiento que querés corregir.",
      "Si cambiás duración, margen, especialidad o publicación, revisá el aviso de impacto.",
      "Desactivar oculta el tratamiento del público, pero conserva historial y reservas relacionadas.",
      "Si editaste por error, entrá a Historial y restaurá la versión anterior con un motivo claro.",
    ],
  },
  {
    title: "Imágenes",
    steps: [
      "Usá JPG, PNG, WebP o AVIF de hasta 4 MB.",
      "La imagen es opcional tanto para guardar borrador como para publicar, pero si se carga debe tener descripción accesible.",
      "Ajustá foco horizontal y vertical para que el recorte se vea bien en mobile y desktop.",
      "Si una carga falla, guardá el tratamiento sin imagen y repetí la carga más tarde.",
    ],
  },
  {
    title: "Profesionales",
    steps: [
      "Cargá cada profesional una sola vez y asignale sus especialidades.",
      "Un profesional puede atender varios tratamientos.",
      "El sistema evita superponer turnos de la misma persona cuando queda asignada a una reserva.",
      "Si un profesional deja de atender, marcá inactivo antes de eliminar.",
    ],
  },
  {
    title: "Disponibilidad y agenda",
    steps: [
      "Definí la disponibilidad habitual por especialidad.",
      "La duración, preparación y frecuencia de inicio se configuran en cada tratamiento.",
      "Usá excepciones para bloquear fechas puntuales, feriados o ausencias.",
      "Los cambios de disponibilidad afectan turnos futuros disponibles, no reservas ya tomadas.",
    ],
  },
  {
    title: "Turnos manuales",
    steps: [
      "Desde Agenda, usá Asignar un turno manual para solicitudes recibidas por WhatsApp o recepción.",
      "La reserva asigna un profesional habilitado y disponible; revisá su nombre en la agenda después de guardar.",
      "Confirmá estado, horario y datos de contacto antes de guardar.",
      "Usá notas internas solo para información operativa, no para datos sensibles innecesarios.",
    ],
  },
  {
    title: "Depilación, combos y paquetes",
    steps: [
      "Depilación funciona como tratamiento configurable, no como un tratamiento por combo.",
      "Cargá zonas, extras y combos desde la configuración del tratamiento Depilación.",
      "El público elige un combo publicado y, si está permitido, extras compatibles.",
      "La primera sesión se agenda online; las sesiones restantes se administran desde Paquetes.",
    ],
  },
  {
    title: "Mensajes de WhatsApp",
    steps: [
      "Cuando una persona termina la pre-reserva, la web prepara un mensaje con su nombre, tratamiento, fecha, horario y código.",
      "La persona abre WhatsApp y decide enviarlo. La web no manda mensajes automáticos ni promociones.",
      "El número que recibe las consultas se modifica en Configuración. El mensaje es único para todos los tratamientos.",
    ],
  },
  {
    title: "Contenido de la web",
    steps: [
      "Contenido permite ajustar textos e imágenes de secciones aprobadas.",
      "No crea ni elimina secciones; mantiene la estructura visual definida por Kai Studio.",
      "Previsualizá antes de publicar cuando la sección tenga imagen o textos extensos.",
    ],
  },
  {
    title: "Qué hacer ante errores",
    steps: [
      "Si una pantalla no carga, usá Reintentar y anotá el código de soporte si aparece.",
      "Si se borró o editó algo por error, no lo recrees de inmediato: revisá Historial.",
      "Si hay dudas con reservas reales, no borres registros; desactivá o consultá soporte.",
    ],
  },
];

export default async function AdminManualPage() {
  const { profile } = await requireAdmin();
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div>
          <p className="eyebrow">Manual de uso</p>
          <h1>Guía rápida para operar el panel sin depender de soporte.</h1>
          <p>{profile.full_name}, este manual resume las tareas más frecuentes de recepción, agencia y administración.</p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--quiet" href="/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver sitio</Link>
          <form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form>
        </div>
      </header>
      <AdminRouteNav current="manual" canManageAccess={profile.role === "admin"} />
      <section className="live-admin__section admin-manual" aria-labelledby="manual-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="manual-title">Operación diaria</h2>
            <p>Usá esta guía como checklist mientras Piel Canela carga tratamientos reales y atiende turnos.</p>
          </div>
          <span className="admin-count numeric">{sections.length} temas</span>
        </div>
<SearchableManual sections={sections.map((section, index) => ({ ...section, href: ["/admin/mi-cuenta", "/admin/catalogo/nuevo", "/admin/catalogo", "/admin/catalogo", "/admin/profesionales", "/admin?module=availability", "/admin?module=agenda#asignar", "/admin/catalogo", "/admin/configuracion", "/admin/contenido", "/admin/historial"][index] }))} />
      </section>
    </div>
  );
}
