import React, { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Play, Square } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { BladePanel } from '@/components/BladePanel';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

const mockVMs = [
  {
    id: 'vm-1',
    name: 'web-server-01',
    resourceGroup: 'Production-RG',
    location: 'East US',
    status: 'Running',
    size: 'Standard_B2s',
    publicIP: '40.114.125.33',
    privateIP: '10.0.0.4',
    os: 'Windows Server 2022'
  },
  {
    id: 'vm-2', 
    name: 'db-server-01',
    resourceGroup: 'Production-RG',
    location: 'East US',
    status: 'Stopped',
    size: 'Standard_D4s_v3',
    publicIP: '-',
    privateIP: '10.0.0.5',
    os: 'Ubuntu 20.04 LTS'
  },
  {
    id: 'vm-3',
    name: 'dev-machine-01',
    resourceGroup: 'Development-RG', 
    location: 'West US 2',
    status: 'Running',
    size: 'Standard_B1s',
    publicIP: '13.64.151.44',
    privateIP: '10.1.0.4',
    os: 'Windows 11 Pro'
  }
];

export const VirtualMachines: React.FC = () => {
  const [isCreateBladeOpen, setIsCreateBladeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVMs, setSelectedVMs] = useState<string[]>([]);

  const handleCreateVM = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'virtual_machine',
      source: 'vm_list_page'
    });
    setIsCreateBladeOpen(true);
  };

  const handleVMAction = (vmId: string, action: string) => {
    trackEvent(AnalyticsEvents.RESOURCE_VIEW, {
      resourceType: 'virtual_machine',
      resourceId: vmId,
      action
    });
  };

  const filteredVMs = mockVMs.filter(vm =>
    vm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vm.resourceGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <Breadcrumb 
          items={[
            { label: 'Home', href: '/' },
            { label: 'Virtual machines' }
          ]} 
        />

        <div className="mt-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Virtual machines</h1>
              <p className="text-foreground-secondary mt-1">
                Create and manage virtual machines in the cloud
              </p>
            </div>
            <button
              onClick={handleCreateVM}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Create
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-secondary" />
              <input
                type="text"
                placeholder="Search virtual machines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <button className="btn-secondary flex items-center gap-2">
              <Filter size={16} />
              Filter
            </button>
          </div>

          {/* VM Table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVMs(mockVMs.map(vm => vm.id));
                          } else {
                            setSelectedVMs([]);
                          }
                        }}
                      />
                    </th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Location</th>
                    <th className="text-left py-3 px-4">Resource group</th>
                    <th className="text-left py-3 px-4">Size</th>
                    <th className="text-left py-3 px-4">Public IP</th>
                    <th className="text-left py-3 px-4">Operating system</th>
                    <th className="text-left py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVMs.map((vm) => (
                    <tr key={vm.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedVMs.includes(vm.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVMs([...selectedVMs, vm.id]);
                            } else {
                              setSelectedVMs(selectedVMs.filter(id => id !== vm.id));
                            }
                          }}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleVMAction(vm.id, 'view_details')}
                          className="text-primary hover:underline font-medium"
                        >
                          {vm.name}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          vm.status === 'Running' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {vm.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground-secondary">{vm.location}</td>
                      <td className="py-3 px-4">
                        <button className="text-primary hover:underline">
                          {vm.resourceGroup}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-foreground-secondary">{vm.size}</td>
                      <td className="py-3 px-4 text-foreground-secondary">{vm.publicIP}</td>
                      <td className="py-3 px-4 text-foreground-secondary">{vm.os}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {vm.status === 'Running' ? (
                            <button
                              onClick={() => handleVMAction(vm.id, 'stop')}
                              className="p-1 hover:bg-secondary rounded"
                              title="Stop"
                            >
                              <Square size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVMAction(vm.id, 'start')}
                              className="p-1 hover:bg-secondary rounded"
                              title="Start"
                            >
                              <Play size={16} />
                            </button>
                          )}
                          <button
                            className="p-1 hover:bg-secondary rounded"
                            title="More actions"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredVMs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-foreground-secondary">No virtual machines found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BladePanel
        isOpen={isCreateBladeOpen}
        onClose={() => setIsCreateBladeOpen(false)}
        title="Create virtual machine"
        width="xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Virtual machine name *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Enter virtual machine name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Region *</label>
              <select className="input w-full">
                <option>East US</option>
                <option>West US 2</option>
                <option>Central US</option>
                <option>North Europe</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Availability options</label>
              <select className="input w-full">
                <option>No infrastructure redundancy required</option>
                <option>Availability zone</option>
                <option>Availability set</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Image *</label>
              <select className="input w-full">
                <option>Windows Server 2022 Datacenter - x64 Gen2</option>
                <option>Ubuntu Server 20.04 LTS - x64 Gen2</option>
                <option>Windows 11 Pro - x64 Gen2</option>
                <option>CentOS 8.2 - x64 Gen2</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Size *</label>
              <button className="input w-full text-left flex items-center justify-between">
                <span>Standard_B1s - 1 vcpu, 1 GiB memory</span>
                <span className="text-foreground-secondary">Select size</span>
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="font-medium mb-4">Administrator account</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username *</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Password *</label>
                <input
                  type="password"
                  className="input w-full"
                  placeholder="Enter password"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button
              onClick={() => setIsCreateBladeOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button className="btn-primary">
              Create
            </button>
          </div>
        </div>
      </BladePanel>
    </div>
  );
};