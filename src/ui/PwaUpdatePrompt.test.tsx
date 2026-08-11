import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  actAsync,
  fireClick,
  flush,
  renderDom,
  type DomRender,
} from "../testUtils/renderDom";
import type {
  PwaRegistrar,
  PwaRegistrationOptions,
  PwaUpdateFn,
} from "../pwa/types";
import PwaUpdatePrompt from "./PwaUpdatePrompt";

let currentRender: DomRender | null = null;
let registrationOptions: PwaRegistrationOptions | null = null;
let updateCalls: Array<boolean | undefined> = [];

beforeEach(() => {
  registrationOptions = null;
  updateCalls = [];
});

afterEach(() => {
  currentRender?.unmount();
  currentRender = null;
});

function createRegistrar(): PwaRegistrar {
  return (options) => {
    registrationOptions = options;
    const update: PwaUpdateFn = async (reloadPage) => {
      updateCalls.push(reloadPage);
    };
    return update;
  };
}

function renderPrompt() {
  currentRender = renderDom(<PwaUpdatePrompt registrar={createRegistrar()} />);
  return currentRender;
}

function findButton(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === label
  ) as HTMLButtonElement | undefined;
}

describe("PwaUpdatePrompt", () => {
  test("permanece oculto hasta que el service worker informa una nueva versión", async () => {
    renderPrompt();

    expect(document.body.textContent).not.toContain("Nueva versión de ENU disponible");
    expect(registrationOptions).not.toBeNull();

    await actAsync(() => registrationOptions!.onNeedRefresh());

    expect(document.body.textContent).toContain("Nueva versión de ENU disponible");
    expect(findButton("Actualizar ahora")).not.toBeUndefined();
    expect(findButton("Más tarde")).not.toBeUndefined();
  });

  test("aplica la versión en espera y solicita recarga sólo por decisión del usuario", async () => {
    renderPrompt();
    await actAsync(() => registrationOptions!.onNeedRefresh());

    fireClick(findButton("Actualizar ahora")!);
    await flush();

    expect(updateCalls).toEqual([true]);
  });

  test("Más tarde oculta el aviso sin aplicar la actualización", async () => {
    renderPrompt();
    await actAsync(() => registrationOptions!.onNeedRefresh());

    fireClick(findButton("Más tarde")!);
    await flush();

    expect(document.body.textContent).not.toContain("Nueva versión de ENU disponible");
    expect(updateCalls).toHaveLength(0);
  });
});
