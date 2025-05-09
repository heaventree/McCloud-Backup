import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { preloadCommonChunks } from "./preload";

// Preload critical chunks to prevent 429 errors
preloadCommonChunks();

// Add Google Fonts directly instead of relying on CSS import
const linkElement = document.createElement('link');
linkElement.rel = 'stylesheet';
linkElement.href = 'https://fonts.googleapis.com/css?family=Inter:400,500,600,700,900&subset=cyrillic,cyrillic-ext';
document.head.appendChild(linkElement);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster />
  </QueryClientProvider>
);
