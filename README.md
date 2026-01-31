# Enub - Sistema de Gestión Escolar

![Enub Banner](public/enub.jpg)

## 📋 Descripción General

**Enub** es una plataforma integral de gestión escolar diseñada para optimizar la administración de horarios, registros académicos y recursos humanos en instituciones educativas. Construida con una arquitectura moderna y escalable, la aplicación ofrece una experiencia de usuario fluida, reactiva y accesible desde cualquier dispositivo gracias a su implementación como **Progressive Web App (PWA)**.

El sistema permite a los administradores gestionar de manera eficiente semestres, asignaturas, grupos, personal docente y roles, proporcionando un panel de control centralizado con métricas clave en tiempo real.

## 🚀 Características Principales

-   **Dashboard Interactivo**: Visualización de métricas clave (semestres activos, trabajadores, asignaturas, grupos) con soporte para temas claro/oscuro.
-   **Gestión Académica Completa**:
    -   Administración de Licenciaturas y Planes de Estudio.
    -   Control de Asignaturas y Créditos.
    -   Gestión de Grupos y Semestres.
-   **Administración de Personal**: Registro y gestión de trabajadores y asignación de roles.
-   **Interfaz Moderna & Responsive**: Diseño adaptativo optimizado para escritorio y dispositivos móviles.
-   **Modo Oscuro (Dark Mode)**: Soporte nativo para preferencias de sistema y alternancia manual, persistente entre sesiones.
-   **PWA (Progressive Web App)**: Instalable en dispositivos, soporte offline y rendimiento nativo.
-   **Seguridad**: Rutas protegidas y autenticación robusta integrada con Supabase.

## 🛠️ Stack Tecnológico

El proyecto está construido utilizando las últimas tecnologías del ecosistema React, priorizando el rendimiento y la mantenibilidad:

### Core
-   **[React 18](https://reactjs.org/)**: Biblioteca principal para la construcción de interfaces.
-   **[Vite](https://vitejs.dev/)**: Build tool de próxima generación para un desarrollo ultrarrápido.

### Estado y Datos
-   **[TanStack Query (React Query)](https://tanstack.com/query/latest)**: Gestión eficiente del estado asíncrono, caché y sincronización de datos.
-   **[Supabase](https://supabase.com/)**: Backend-as-a-Service para autenticación y base de datos en tiempo real.

### UI & Estilos
-   **[Styled Components](https://styled-components.com/)**: Estilizado basado en componentes con soporte dinámico de temas.
-   **[React Icons](https://react-icons.github.io/react-icons/)** & **[Tabler Icons](https://tabler-icons.io/)**: Iconografía vectorial.
-   **[React Hot Toast](https://react-hot-toast.com/)**: Notificaciones toast elegantes y ligeras.

### Utilidades
-   **[React Router DOM](https://reactrouter.com/)**: Enrutamiento declarativo del lado del cliente.
-   **[React Hook Form](https://react-hook-form.com/)**: Manejo de formularios performante y validación.
-   **[Vite Plugin PWA](https://vite-pwa-org.netlify.app/)**: Configuración automatizada de Service Workers y Manifiesto.

## 🔧 Instalación y Configuración

Sigue estos pasos para levantar el entorno de desarrollo local:

1.  **Clonar el repositorio**
    ```bash
    git clone https://github.com/tu-usuario/enub.git
    cd enub
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**
    Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example` (si aplica) y añade tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url_supabase
    VITE_SUPABASE_ANON_KEY=tu_clave_anonima
    ```

4.  **Iniciar servidor de desarrollo**
    ```bash
    npm run dev
    ```

## 📜 Scripts Disponibles

-   `npm run dev`: Inicia el servidor de desarrollo en modo watch.
-   `npm run build`: Genera la versión de producción optimizada en la carpeta `dist`.
-   `npm run preview`: Previsualiza localmente la build de producción.
-   `npm run lint`: Ejecuta ESLint para analizar el código en busca de errores y problemas de estilo.

## 📱 PWA

Este proyecto es una Progressive Web App totalmente compatible. Al construir el proyecto (`npm run build`), se generan automáticamente:
-   `manifest.webmanifest`
-   Service Workers para caché y funcionamiento offline.

Para probar la experiencia PWA, se recomienda ejecutar `npm run build` seguido de `npm run preview`.

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor, abre un issue para discutir cambios mayores antes de enviar un Pull Request.

1.  Haz un Fork del proyecto.
2.  Crea tu rama de características (`git checkout -b feature/AmazingFeature`).
3.  Haz Commit de tus cambios (`git commit -m 'Add some AmazingFeature'`).
4.  Haz Push a la rama (`git push origin feature/AmazingFeature`).
5.  Abre un Pull Request.

---

Desarrollado con ❤️ por el equipo de Enub.
