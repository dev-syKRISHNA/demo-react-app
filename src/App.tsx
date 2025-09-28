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
import StorageAccounts from "@/pages/StorageAccounts";
import ResourceGroups from "@/pages/ResourceGroups";
import ResourceGroupDetail from "@/pages/ResourceGroupDetail";
import AllServices from "@/pages/AllServices";
import CreateResourceGroup from "@/pages/CreateResourceGroup";
import { VirtualMachines } from "@/pages/VirtualMachines";
import { NotFound } from "@/pages/NotFound";
import { Index } from '@/pages/Index';
import CreateFunctionApp from "@/pages/CreateFunctionApp";
import FunctionApps from "@/pages/FunctionApps";
import ResourceDetail from "@/pages/ResourceDetail";
import CreateSqlDatabase from "@/pages/CreateSqlDatabase";
import SqlDatabases from "@/pages/SqlDatabases";

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
                  <Route path="/index" element={<Index />} />
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/all-services" element={<AllServices />} />
                  <Route path="/create" element={<CreateResource />} />
                  <Route path="/create-resource" element={<CreateResource />} />
                  <Route path="/create/storage-account" element={<CreateStorageAccount />} />
                  <Route path="/create/:serviceId" element={<CreateStorageAccount />} />
                  <Route path="/create/resource-group" element={<CreateResourceGroup />} />
                  <Route path="/resource-groups" element={<ResourceGroups />} />
                  <Route path="/resource-groups/:id" element={<ResourceGroupDetail />} />
                  <Route path="/virtual-machines" element={<VirtualMachines />} />
                  <Route path="/storage-accounts" element={<StorageAccounts />} />
                  <Route path="/function-apps" element={<AllServices />} />
                  <Route path="/create/function-app" element={<CreateFunctionApp />} />
                  <Route path="/function-apps" element={<FunctionApps />} />
                  <Route path="/resources/:id" element={<ResourceDetail />} />
                  <Route path="/create/sql-database" element={<CreateSqlDatabase />} />
                  <Route path="/sql-databases" element={<SqlDatabases />} />
                  <Route path="/sql-databases" element={<AllServices />} />
                  <Route path="/app-services" element={<AllServices />} />
                  <Route path="/key-vaults" element={<AllServices />} />
                  <Route path="/virtual-networks" element={<AllServices />} />
                  <Route path="/kubernetes-service" element={<AllServices />} />
                  <Route path="/marketplace" element={<CreateResource />} />
                  <Route path="/cost-management" element={<AllServices />} />
                  <Route path="/monitor" element={<AllServices />} />
                  <Route path="/advisor" element={<AllServices />} />
                  <Route path="/security-center" element={<AllServices />} />
                  <Route path="/subscriptions" element={<AllServices />} />
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