# Design

Use existing QueryClient cancellation and clear APIs after successful sign-out; remove both query and mutation cache records. Do not erase unrelated browser preferences. This does not cancel server-side mutations or guarantee erasure from downloads, browser history, SDK storage or other tabs. Investigate those surfaces separately. Branch starts from the validated dependency upgrade, so preview includes phase 2.
