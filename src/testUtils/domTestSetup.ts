// Registers a real DOM (happy-dom) onto globalThis for test files that
// need genuine event dispatch (keydown, click, focus) rather than
// renderToStaticMarkup's markup-only rendering. Imported explicitly by
// only the test files that need it (DOM interaction suites), never
// globally preloaded -- every other test file in this project keeps
// running exactly as before, with no DOM globals present at all.
//
// Guarded so importing this module twice in the same process (e.g. two
// DOM test files running in the same worker) never double-registers.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (typeof document === "undefined") {
  GlobalRegistrator.register();
}

// Tells React this environment supports act() (suppresses React's "not
// configured to support act" warning); required whenever tests call
// act()/render outside of a framework-provided test renderer.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
