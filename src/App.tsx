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
import StorageAccounts from "@/pages/StorageAccounts";
import ResourceGroups from "@/pages/ResourceGroups";
import ResourceGroupDetail from "@/pages/ResourceGroupDetail";
import AllServices from "@/pages/AllServices";
import { VirtualMachines } from "@/pages/VirtualMachines";
import { VirtualMachineCreateBlade } from "@/pages/VirtualMachineCreateBlade";
import { ResourceGroupCreateBlade } from "@/pages/ResourceGroupCreateBlade";
import { VirtualNetworkCreateBlade } from "@/pages/VirtualNetworkCreateBlade";
import { PublicIpCreateBlade } from "@/pages/PublicIpCreateBlade";
import { NetworkSecurityGroupCreateBlade } from "@/pages/NetworkSecurityGroupCreateBlade";
import { StorageAccountCreateBlade } from "@/pages/StorageAccountCreateBlade";
import { NotFound } from "@/pages/NotFound";
import { Index } from "@/pages/Index";
import FunctionApps from "@/pages/FunctionApps";
import ResourceDetail from "@/pages/ResourceDetail";
import SqlDatabases from "@/pages/SqlDatabases";
import CreateServiceWizard from "@/pages/CreateServiceWizard";
import AllResources from "@/pages/AllResources";
import Subscriptions from "@/pages/Subscriptions";
import CostManagement from "@/pages/CostManagement";
import Monitor from "@/pages/Monitor";
import Advisor from "@/pages/Advisor";
import SecurityCenter from "@/pages/SecurityCenter";
import { ServiceExplorer } from "@/components/ServiceExplorer";
import { serviceExplorerConfigs } from "@/data/serviceExplorerConfigs";

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
                  <Route path="/index" element={<Index />} />
                  <Route path="/all-services" element={<AllServices />} />
                  <Route path="/all-resources" element={<AllResources />} />
                  <Route path="/create" element={<CreateResource />} />
                  <Route path="/create-resource" element={<CreateResource />} />
                  <Route path="/marketplace" element={<CreateResource />} />
                  <Route path="/create/:serviceSlug" element={<CreateServiceWizard />} />
                  <Route path="/create/:serviceSlug/:stepId" element={<CreateServiceWizard />} />
                  <Route path="/resource-groups" element={<ResourceGroups />} />
                  <Route path="/resource-groups/:id" element={<ResourceGroupDetail />} />
                  <Route path="/virtual-machines" element={<VirtualMachines />} />
                  <Route path="/virtual-machines/create/:tabId?" element={<VirtualMachineCreateBlade />}>
                    {/* Child blades */}
                    <Route path="resource-groups/new" element={<ResourceGroupCreateBlade />} />
                    <Route path="vnets/new" element={<VirtualNetworkCreateBlade />} />
                    <Route path="public-ips/new" element={<PublicIpCreateBlade />} />
                    <Route path="nsgs/new" element={<NetworkSecurityGroupCreateBlade />} />
                    <Route path="storage-accounts/new" element={<StorageAccountCreateBlade />} />
                  </Route>
                  <Route path="/storage-accounts" element={<StorageAccounts />} />
                  <Route path="/function-apps" element={<FunctionApps />} />
                  <Route path="/resources/:id" element={<ResourceDetail />} />
                  <Route path="/sql-databases" element={<SqlDatabases />} />
                  <Route path="/subscriptions" element={<Subscriptions />} />
                  <Route path="/cost-management" element={<CostManagement />} />
                  <Route path="/monitor" element={<Monitor />} />
                  <Route path="/advisor" element={<Advisor />} />
                  <Route path="/security-center" element={<SecurityCenter />} />
                  <Route path="/app-services" element={<ServiceExplorer {...serviceExplorerConfigs.appServices} />} />
                  <Route path="/key-vaults" element={<ServiceExplorer {...serviceExplorerConfigs.keyVaults} />} />
                  <Route path="/virtual-networks" element={<ServiceExplorer {...serviceExplorerConfigs.virtualNetworks} />} />
                  <Route path="/kubernetes-service" element={<ServiceExplorer {...serviceExplorerConfigs.kubernetes} />} />
                  <Route path="/cosmos-db" element={<ServiceExplorer {...serviceExplorerConfigs.cosmosDb} />} />
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