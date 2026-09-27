import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.tsx";
import { Toaster, toast } from "sonner";

const queryClient = new QueryClient();

// Registra el Service Worker y notifica al usuario cuando hay actualizaciones
registerSW({
  onNeedRefresh() {
    toast("Nueva versión disponible", {
      description: "Recarga la página para obtener la última versión.",
      duration: Infinity,
      action: {
        label: "Recargar",
        onClick: () => window.location.reload(),
      },
    });
  },
  onOfflineReady() {
    toast.success("NodeLand está listo para usarse sin conexión.", {
      duration: 4000,
    });
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
);

