import { useEffect, useRef } from "react";

export function useOutsideClick(handler: () => void, listenCapturing = true) {
  const ref = useRef<any>(null);

  useEffect(
    function () {
      function handleClick(e: MouseEvent) {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          handler();
        }
      }

      document.addEventListener("click", handleClick as any, listenCapturing);

      return () =>
        document.removeEventListener("click", handleClick as any, listenCapturing);
    },
    [handler, listenCapturing]
  );

  return ref;
}
