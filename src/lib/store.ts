import { useSyncExternalStore } from 'react';
import {
  mockSubscriptions,
  mockResourceGroups,
  mockResources,
  type Subscription,
  type ResourceGroup,
  type Resource
} from '@/data/mockData';

type AppState = {
  subscriptions: Subscription[];
  resourceGroups: ResourceGroup[];
  resources: Resource[];
};

type AppActions = {
  createResourceGroup: (input: {
    name: string;
    subscription: string;
    location: string;
    tags?: Record<string, string>;
  }) => ResourceGroup;
  createStorageAccount: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    redundancy: string;
    performance: 'Standard' | 'Premium';
    tags?: Record<string, string>;
  }) => Resource;
  createResource: (input: Resource) => Resource;
  createFunctionApp: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    runtimeStack: string;
    runtimeVersion: string;
    os: 'Linux' | 'Windows';
    hostingPlan: 'Consumption' | 'App Service Plan' | 'Dedicated';
    zoneRedundant?: boolean;
    appInsights?: boolean;
    tags?: Record<string, string>;
  }) => Resource;
  updateResource: (id: string, changes: Partial<Resource>) => Resource | undefined;
  deleteResource: (id: string) => void;
  setResourceStatus: (id: string, status: Resource['status']) => void;
  createSqlDatabase: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    server: string;
    location: string;
    computeTier: string;
    slo: string;
    networking?: string;
    backupPolicy?: string;
    tags?: Record<string, string>;
  }) => Resource;
  createVirtualMachine: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    image: string;
    size: string;
    authenticationType: string;
    username: string;
    tags?: Record<string, string>;
  }) => Resource;
  createWebApp: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    publish: string;
    runtimeStack: string;
    runtimeVersion: string;
    operatingSystem: string;
    planSku: string;
    tags?: Record<string, string>;
  }) => Resource;
  createKeyVault: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    pricingTier: string;
    accessModel: string;
    publicNetworkAccess: string;
    tags?: Record<string, string>;
  }) => Resource;
  createCosmosDb: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    api: string;
    consistency: string;
    regions: string[];
    tags?: Record<string, string>;
  }) => Resource;
  createVirtualNetwork: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    addressSpace: string;
    subnetAddress: string;
    tags?: Record<string, string>;
  }) => Resource;
  createDataFactory: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    gitRepository?: string;
    gitBranch?: string;
    tags?: Record<string, string>;
  }) => Resource;
  createLogicApp: (input: {
    name: string;
    subscription: string;
    resourceGroup: string;
    location: string;
    planType: string;
    runtime: string;
    tags?: Record<string, string>;
  }) => Resource;
};

const STORAGE_KEY = 'cognior_portal_state_v1';

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch (err) {
    // ignore corrupt storage
  }
  return {
    subscriptions: mockSubscriptions,
    resourceGroups: mockResourceGroups,
    resources: mockResources,
  };
}

function persist(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // storage might be unavailable; fail soft
  }
}

type Listener = () => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor(initial: AppState) {
    this.state = initial;
  }

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    persist(this.state);
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

const store = new Store(loadInitialState());

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}

export const actions: AppActions = {
  createResourceGroup: ({ name, subscription, location, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resourceGroups.map((g) => Number(g.id))) + 1).toString();
    const now = new Date();
    const newGroup: ResourceGroup = {
      id,
      name,
      subscription,
      location,
      resourceCount: 0,
      status: 'Active',
      lastModified: 'just now',
      tags,
    };

    const rgResource: Resource = {
      id,
      name,
      type: 'Resource group',
      resourceGroup: '',
      location,
      subscription,
      status: 'Running',
      lastViewed: now.toLocaleString(),
      tags,
      isFavorite: false,
    };

    store.setState({
      resourceGroups: [newGroup, ...state.resourceGroups],
      resources: [rgResource, ...state.resources],
    });

    return newGroup;
  },
  createStorageAccount: ({ name, subscription, resourceGroup, location, redundancy, performance, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Storage account',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: { ...tags, redundancy, performance },
      isFavorite: false,
    };

    // update RG count
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );

    store.setState({
      resourceGroups: updatedGroups,
      resources: [resource, ...state.resources],
    });

    return resource;
  },
  createResource: (input: Resource) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = { ...input, id };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resource.resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({
      resourceGroups: updatedGroups,
      resources: [resource, ...state.resources],
    });
    return resource;
  },
  createFunctionApp: ({
    name,
    subscription,
    resourceGroup,
    location,
    runtimeStack,
    runtimeVersion,
    os,
    hostingPlan,
    zoneRedundant,
    appInsights,
    tags = {},
  }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Function App',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: { ...tags, runtimeStack, runtimeVersion, os, hostingPlan, zoneRedundant: String(!!zoneRedundant), appInsights: String(!!appInsights) },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({
      resourceGroups: updatedGroups,
      resources: [resource, ...state.resources],
    });
    return resource;
  },
  updateResource: (id, changes) => {
    const state = store.getState();
    let updated: Resource | undefined;
    const resources = state.resources.map((r) => {
      if (r.id === id) {
        updated = { ...r, ...changes } as Resource;
        return updated;
      }
      return r;
    });
    if (updated) {
      store.setState({ resources });
    }
    return updated;
  },
  deleteResource: (id) => {
    const state = store.getState();
    const res = state.resources.find((r) => r.id === id);
    const resources = state.resources.filter((r) => r.id !== id);
    const resourceGroups = res
      ? state.resourceGroups.map((g) =>
          g.name === res.resourceGroup && g.resourceCount > 0
            ? { ...g, resourceCount: g.resourceCount - 1, lastModified: 'just now' }
            : g
        )
      : state.resourceGroups;
    store.setState({ resources, resourceGroups });
  },
  setResourceStatus: (id, status) => {
    const state = store.getState();
    const resources = state.resources.map((r) => (r.id === id ? { ...r, status } : r));
    store.setState({ resources });
  },
  createSqlDatabase: ({ name, subscription, resourceGroup, server, location, computeTier, slo, networking, backupPolicy, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'SQL database',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: { ...tags, server, computeTier, slo, networking: networking || '', backupPolicy: backupPolicy || '' },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createVirtualMachine: ({ name, subscription, resourceGroup, location, image, size, authenticationType, username, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Virtual machine',
      resourceGroup,
      location,
      subscription,
      status: 'Deploying',
      lastViewed: 'just now',
      tags: {
        ...tags,
        image,
        size,
        authenticationType,
        username,
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createWebApp: ({ name, subscription, resourceGroup, location, publish, runtimeStack, runtimeVersion, operatingSystem, planSku, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Web App',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: {
        ...tags,
        publish,
        runtimeStack,
        runtimeVersion,
        operatingSystem,
        planSku,
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createKeyVault: ({ name, subscription, resourceGroup, location, pricingTier, accessModel, publicNetworkAccess, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Key Vault',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: {
        ...tags,
        pricingTier,
        accessModel,
        publicNetworkAccess,
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createCosmosDb: ({ name, subscription, resourceGroup, location, api, consistency, regions, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Cosmos DB account',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: {
        ...tags,
        api,
        consistency,
        regions: regions.join(','),
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createVirtualNetwork: ({ name, subscription, resourceGroup, location, addressSpace, subnetAddress, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Virtual network',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: {
        ...tags,
        addressSpace,
        subnetAddress,
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createDataFactory: ({ name, subscription, resourceGroup, location, gitRepository, gitBranch, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Data Factory',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: {
        ...tags,
        gitRepository: gitRepository ?? '',
        gitBranch: gitBranch ?? '',
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
  createLogicApp: ({ name, subscription, resourceGroup, location, planType, runtime, tags = {} }) => {
    const state = store.getState();
    const id = (Math.max(0, ...state.resources.map((r) => Number(r.id))) + 1).toString();
    const resource: Resource = {
      id,
      name,
      type: 'Logic App',
      resourceGroup,
      location,
      subscription,
      status: 'Running',
      lastViewed: 'just now',
      tags: {
        ...tags,
        planType,
        runtime,
      },
      isFavorite: false,
    };
    const updatedGroups = state.resourceGroups.map((g) =>
      g.name === resourceGroup ? { ...g, resourceCount: g.resourceCount + 1, lastModified: 'just now' } : g
    );
    store.setState({ resourceGroups: updatedGroups, resources: [resource, ...state.resources] });
    return resource;
  },
};


