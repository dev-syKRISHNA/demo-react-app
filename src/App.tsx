import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import CreateResource from "@/pages/CreateResource";
import CreateStorageAccount from "@/pages/CreateStorageAccount";
import ResourceGroups from "@/pages/ResourceGroups";
import ResourceGroupDetail from "@/pages/ResourceGroupDetail";
import AllServices from "@/pages/AllServices";
import CreateResourceGroup from "@/pages/CreateResourceGroup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="flex flex-col h-screen bg-background">
            <Header onToggleSidebar={toggleSidebar} />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar isCollapsed={sidebarCollapsed} />
              <main className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/create-resource" element={<CreateResource />} />
                  <Route path="/create/storage-account" element={<CreateStorageAccount />} />
                  <Route path="/create/:serviceId" element={<CreateStorageAccount />} />
                  <Route path="/create/resource-group" element={<CreateResourceGroup />} />
                  <Route path="/resource-groups" element={<ResourceGroups />} />
                  <Route path="/resource-groups/:id" element={<ResourceGroupDetail />} />
                  <Route path="/all-services" element={<AllServices />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;