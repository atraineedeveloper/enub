import { registerSW } from "virtual:pwa-register";
import type { PwaRegistrar } from "./types";

export const registerPwa: PwaRegistrar = ({
  onNeedRefresh,
  onRegistered,
  onRegisterError,
}) =>
  registerSW({
    immediate: true,
    onNeedRefresh,
    onRegisteredSW(_swScriptUrl, registration) {
      onRegistered(registration);
    },
    onRegisterError,
  });
