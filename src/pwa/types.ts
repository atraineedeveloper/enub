export type PwaUpdateFn = (reloadPage?: boolean) => Promise<void>;

export interface PwaRegistrationOptions {
  onNeedRefresh: () => void;
  onRegistered: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError: (error: unknown) => void;
}

export type PwaRegistrar = (options: PwaRegistrationOptions) => PwaUpdateFn;
