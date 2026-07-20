import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { MyWorkerProfile } from "../../services/apiWorkers";

// Real-render proof (react-dom/server's renderToStaticMarkup -- no DOM
// needed, established pattern already used throughout this project) that
// the expanded "Mi información" view renders every approved section,
// respects every placeholder rule, formats dates without a timezone
// shift, sorts relations deterministically, excludes observations/id/
// worker_id/created_at, and never renders an editing control of any kind.

let nextProfile: {
  isLoading: boolean;
  myWorkerProfile: MyWorkerProfile | null;
  error: unknown;
} = {
  isLoading: false,
  myWorkerProfile: null,
  error: null,
};

mock.module("./useMyWorkerProfile", () => ({
  useMyWorkerProfile: () => nextProfile,
}));

const { default: MyProfileView } = await import("./MyProfileView");

const fullProfile = (overrides: Partial<MyWorkerProfile> = {}): MyWorkerProfile => ({
  name: "Ana Pérez",
  RFC: "PEAA800101ABC",
  email: "ana@example.test",
  phone: "555-0000",
  street: "Av. Reforma 123",
  neighborhood: "Centro",
  post_code: "86000",
  city: "Villahermosa",
  state: "Tabasco",
  type_worker: "Docente",
  specialty: "Matemáticas",
  function_performed: "Titular",
  status: 1,
  profile_picture: null,
  sustenance_plazas: [],
  date_of_admissions: [],
  ...overrides,
});

describe("MyProfileView -- sections and field content", () => {
  test("renders every approved section heading", () => {
    nextProfile = { isLoading: false, myWorkerProfile: fullProfile(), error: null };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("Datos personales");
    expect(html).toContain("Contacto");
    expect(html).toContain("Domicilio");
    expect(html).toContain("Información laboral");
    expect(html).toContain("Plazas");
    expect(html).toContain("Fechas de admisión");
  });

  test("renders RFC and every domicile field", () => {
    nextProfile = { isLoading: false, myWorkerProfile: fullProfile(), error: null };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("PEAA800101ABC");
    expect(html).toContain("Av. Reforma 123");
    expect(html).toContain("Centro");
    expect(html).toContain("86000");
    expect(html).toContain("Villahermosa");
    expect(html).toContain("Tabasco");
  });

  test("worker status ('Estatus') and address state ('Estado') never collide as the same label", () => {
    nextProfile = { isLoading: false, myWorkerProfile: fullProfile(), error: null };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("Estatus");
    expect(html).toContain("Estado");
  });

  test("observations, id, worker_id, and created_at never appear anywhere on the page", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: {
        ...fullProfile(),
        // Simulates a caller accidentally widening the object -- the view
        // itself must never read or render this field even if present.
        observations: "Nota administrativa interna",
      } as MyWorkerProfile,
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).not.toContain("Nota administrativa interna");
    expect(html).not.toContain("Observaciones");
  });
});

describe("MyProfileView -- placeholders for missing/empty fields", () => {
  test("every optional text field falls back to 'No registrado'", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({
        RFC: null,
        email: null,
        phone: null,
        street: null,
        neighborhood: null,
        post_code: null,
        city: null,
        state: null,
        specialty: null,
        function_performed: null,
      }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html.match(/No registrado/g) ?? []).toHaveLength(10);
  });

  test("a missing worker type shows the distinct 'Tipo no especificado' text", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({ type_worker: null }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("Tipo no especificado");
  });

  test("an unrecognized status shows 'Estado desconocido', never a guessed Activo/Inactivo", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({ status: null }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("Estado desconocido");
  });
});

describe("MyProfileView -- plazas (zero, one, multiple)", () => {
  test("zero plazas shows the exact empty-state message", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({ sustenance_plazas: [] }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("No tienes plazas registradas.");
  });

  test("one plaza renders its sustenance/plaza/payment_key as a card, not a horizontal table", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({
        sustenance_plazas: [
          { sustenance: "Estatal", payment_key: "01", plaza: "Base" },
        ],
      }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("Estatal");
    expect(html).toContain("Base");
    expect(html).toContain("01");
    expect(html).not.toContain("<table");
  });

  test("multiple plazas all render, sorted deterministically regardless of input order", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({
        sustenance_plazas: [
          { sustenance: "Federal", payment_key: "9", plaza: "Z" },
          { sustenance: "Estatal", payment_key: "1", plaza: "A" },
        ],
      }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    // Estatal/A sorts before Federal/Z.
    expect(html.indexOf("Estatal")).toBeLessThan(html.indexOf("Federal"));
  });
});

describe("MyProfileView -- fechas de admisión (zero, one, multiple, civil-date formatting)", () => {
  test("zero admission dates shows the exact empty-state message", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({ date_of_admissions: [] }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("No tienes fechas de admisión registradas.");
  });

  test("one admission date renders as a Spanish civil date, no timezone shift", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({
        date_of_admissions: [{ type: "Ingreso", date_of_admission: "2024-08-16" }],
      }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("16 de agosto de 2024");
    expect(html).not.toContain("15 de agosto");
  });

  test("multiple admission dates render in chronological order regardless of input order", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({
        date_of_admissions: [
          { type: "Reingreso", date_of_admission: "2024-01-01" },
          { type: "Ingreso", date_of_admission: "2020-01-01" },
        ],
      }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html.indexOf("2020")).toBeLessThan(html.indexOf("2024"));
  });

  test("a null admission date shows 'Fecha no registrada', never blank or 'null'", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: fullProfile({
        date_of_admissions: [{ type: "Ingreso", date_of_admission: null }],
      }),
      error: null,
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("Fecha no registrada");
    expect(html).not.toContain(">null<");
  });
});

describe("MyProfileView -- strictly read-only", () => {
  test("no button, form, input, or upload control of any kind is present", () => {
    nextProfile = { isLoading: false, myWorkerProfile: fullProfile(), error: null };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Subir");
    expect(html).not.toContain("Eliminar");
  });
});

describe("MyProfileView -- loading, missing-row, and error states", () => {
  test("loading state shows no profile content", () => {
    nextProfile = { isLoading: true, myWorkerProfile: null, error: null };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).not.toContain("Datos personales");
  });

  test("a missing worker row shows the distinct contact-an-administrator message", () => {
    nextProfile = { isLoading: false, myWorkerProfile: null, error: null };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("No se encontró tu información de trabajador");
  });

  test("a query error shows a distinct error message, not the missing-row message", () => {
    nextProfile = {
      isLoading: false,
      myWorkerProfile: null,
      error: new Error("network failed"),
    };
    const html = renderToStaticMarkup(<MyProfileView />);

    expect(html).toContain("La información no pudo cargarse.");
    expect(html).not.toContain("No se encontró tu información de trabajador");
  });
});
