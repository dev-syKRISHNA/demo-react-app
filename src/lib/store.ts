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
};


