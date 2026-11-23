# Harden development and deployment configuration

Remove the unrestricted Vite development host setting, hide React Query devtools in production, and configure conservative response headers for the Vercel SPA. Preserve routing and existing PDF preview behavior. Dependency remediation is a separate validation task: use a supported Bun version for audit, evaluate actual resolved versions, update package and lockfile together and test PDF compatibility. No production configuration or database mutation.
