import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  FileDown,
} from 'lucide-react';
import { CreateAction, FieldDefinition, getBlueprintByRoute } from '@/data/createBlueprints';
import { actions, useAppStore } from '@/lib/store';
import { AnalyticsEvents, trackEvent } from '@/data/mockData';

type FormErrors = Record<string, string>;

type DeploymentState = 'idle' | 'deploying' | 'succeeded' | 'failed';

const CreateServiceWizard: React.FC = () => {
  const navigate = useNavigate();
  const { serviceSlug, stepId } = useParams<{ serviceSlug: string; stepId?: string }>();
  const [searchParams] = useSearchParams();
  const blueprint = getBlueprintByRoute(serviceSlug);
  const subscriptions = useAppStore((s) => s.subscriptions);
  const resourceGroups = useAppStore((s) => s.resourceGroups);

  const [currentStep, setCurrentStep] = useState(0);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [initializedBlueprintId, setInitializedBlueprintId] = useState<string | null>(null);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentState>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [validationSummary, setValidationSummary] = useState<FormErrors>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [role, setRole] = useState('Owner'); // Simulate RBAC
  const [showResourceGroupDialog, setShowResourceGroupDialog] = useState(false);
  const [newResourceGroup, setNewResourceGroup] = useState('');
  const formRef = useRef(formState);

  const DRAFT_KEY = `wizard-draft-${serviceSlug}`;

  useEffect(() => {
    if (!blueprint) return;

    // Only initialize form state when we first load a given blueprint id.
    if (initializedBlueprintId !== blueprint.id) {
      setFormState((prev) => {
        // If we already have some state (e.g. from navigation), preserve it and overlay defaults
        const hasExistingState = Object.keys(prev).length > 0;
        return hasExistingState ? { ...blueprint.defaultValues, ...prev } : { ...blueprint.defaultValues };
      });
      setErrors({});
      setCurrentStep(0);
      setDeploymentStatus('idle');
      setInitializedBlueprintId(blueprint.id);

      trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
        resourceType: blueprint.resourceType,
        blueprint: blueprint.id,
      });
    }
  }, [blueprint, initializedBlueprintId]);

  // When returning from creating a resource group via returnTo flow, auto-select it
  useEffect(() => {
    if (!blueprint || blueprint.id !== 'virtual-machine') return;
    try {
      const savedVmState = window.localStorage.getItem('vmReturnState');
      if (savedVmState) {
        const parsed = JSON.parse(savedVmState);
        setFormState((prev) => ({
          ...prev,
          ...parsed,
        }));
        window.localStorage.removeItem('vmReturnState');
      }

      const lastRg = window.localStorage.getItem('lastCreatedResourceGroup');
      if (lastRg) {
        setFormState((prev) => ({ ...prev, resourceGroup: lastRg }));
        window.localStorage.removeItem('lastCreatedResourceGroup');
      }

      const lastDiskRaw = window.localStorage.getItem('lastCreatedDisk');
      if (lastDiskRaw) {
        const disk = JSON.parse(lastDiskRaw);
        setFormState((prev) => ({
          ...prev,
          dataDisks: Array.isArray(prev.dataDisks)
            ? [...prev.dataDisks, disk]
            : [disk],
        }));
        window.localStorage.removeItem('lastCreatedDisk');
      }
    } catch {
      // ignore storage errors
    }
  }, [blueprint]);

  useEffect(() => {
    if (!blueprint) return;
    const steps = blueprint.steps ?? [];
    if (steps.length === 0) return;
    const targetIndex = steps.findIndex((step) => step.id === stepId);
    if (targetIndex === -1) {
      navigate(`/create/${serviceSlug}/${steps[0].id}`, { replace: true });
      return;
    }
    setCurrentStep(targetIndex);
  }, [blueprint, stepId, serviceSlug, navigate]);

  // Draft save/load
  useEffect(() => {
    formRef.current = formState;
  }, [formState]);

  useEffect(() => {
    if (window.localStorage.getItem(DRAFT_KEY)) setShowDraftDialog(true);
  }, []);

  const saveDraft = () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(formRef.current));
    setDraftSaved(true);
  };

  const loadDraft = () => {
    const draft = window.localStorage.getItem(DRAFT_KEY);
    if (draft) setFormState(JSON.parse(draft));
    setShowDraftDialog(false);
  };

  const clearDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY);
    setShowDraftDialog(false);
  };

  const normalizeRegion = (value?: string) =>
    value?.replace(/^\([^)]+\)\s*/, '') ?? 'East US';

  const steps = blueprint?.steps ?? [];
  const isReviewStep =
    steps.length > 0 &&
    currentStep === steps.length - 1 &&
    steps[currentStep]?.id === 'review';

  const fieldOptions = (field: FieldDefinition) => {
    if (field.dataSource === 'subscriptions') {
      return subscriptions.map((sub) => ({
        label: sub.name,
        value: sub.name,
      }));
    }

    if (field.dataSource === 'resourceGroups') {
      return resourceGroups.map((rg) => ({
        label: rg.name,
        value: rg.name,
      }));
    }

    return field.options ?? [];
  };

  const handleFieldChange = (field: FieldDefinition, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [field.id]: value,
    }));

    setErrors((prev) => {
      if (!prev[field.id]) return prev;
      const next = { ...prev };
      delete next[field.id];
      return next;
    });

    trackEvent(AnalyticsEvents.FORM_FIELD_FOCUS, {
      field: field.id,
      resourceType: blueprint?.resourceType,
    });
  };

  const collectFieldIds = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return [];
    return step.sections.flatMap((section) => section.fields.map((field) => field.id));
  };

  const runValidation = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return {};
    const newErrors: FormErrors = {};

    step.sections.forEach((section) => {
      section.fields.forEach((field) => {
        const value = formState[field.id];

        if (field.required && (value === undefined || value === '' || value === null)) {
          newErrors[field.id] = `${field.label} is required.`;
          return;
        }

        if (field.validation) {
          field.validation.forEach((rule) => {
            const passes = rule.test(value, formState);
            if (!passes) {
              newErrors[field.id] = rule.message;
            }
          });
        }
      });
    });

    return newErrors;
  };

  const validateStep = (stepIndex: number) => {
    const fieldIds = collectFieldIds(stepIndex);
    const stepErrors = runValidation(stepIndex);

    setErrors((prev) => {
      const next = { ...prev };
      fieldIds.forEach((id) => {
        delete next[id];
      });
      Object.assign(next, stepErrors);
      return next;
    });

    const isValid = Object.keys(stepErrors).length === 0;
    if (!isValid) {
      setValidationSummary((prev) => ({ ...prev, ...stepErrors }));
    } else {
      setValidationSummary((prev) => {
        const next = { ...prev };
        collectFieldIds(stepIndex).forEach((id) => delete next[id]);
        return next;
      });
    }

    return isValid;
  };

  const validateAll = () => {
    let aggregated: FormErrors = {};
    let firstInvalidIndex = -1;

    steps.forEach((_, index) => {
      const result = runValidation(index);
      if (Object.keys(result).length > 0 && firstInvalidIndex === -1) {
        firstInvalidIndex = index;
      }
      aggregated = { ...aggregated, ...result };
    });

    setErrors(aggregated);
    setValidationSummary(aggregated);

    if (firstInvalidIndex !== -1) {
      setCurrentStep(firstInvalidIndex);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      trackEvent(AnalyticsEvents.FORM_VALIDATION_ERROR, {
        resourceType: blueprint?.resourceType,
        step: steps[currentStep]?.id,
      });
      return;
    }

    const currentId = steps[currentStep]?.id;
    if (currentId) {
      setCompletedStepIds((prev) => (prev.includes(currentId) ? prev : [...prev, currentId]));
    }

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_STEP, {
      resourceType: blueprint?.resourceType,
      fromStep: steps[currentStep]?.id,
      toStep: steps[currentStep + 1]?.id,
    });

    const query = searchParams.toString();
    const nextStepId = steps[currentStep + 1]?.id;
    if (!nextStepId) return;
    const nextPath = `/create/${serviceSlug}/${nextStepId}`;
    navigate(query ? `${nextPath}?${query}` : nextPath);
  };

  const handlePrevious = () => {
    if (currentStep === 0) return;
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_STEP, {
      resourceType: blueprint?.resourceType,
      fromStep: steps[currentStep]?.id,
      toStep: steps[currentStep - 1]?.id,
      direction: 'previous',
    });
    const query = searchParams.toString();
    const prevStepId = steps[currentStep - 1]?.id;
    if (!prevStepId) return;
    const prevPath = `/create/${serviceSlug}/${prevStepId}`;
    navigate(query ? `${prevPath}?${query}` : prevPath);
  };

  const performCreation = (action: CreateAction) => {
    switch (action) {
      case 'resourceGroup':
        return actions.createResourceGroup({
          name: formState.resourceGroupName,
          subscription: formState.subscription,
          location: formState.region,
          tags: {
            environment: formState.tagsEnvironment,
            owner: formState.tagsOwner,
          },
        });
      case 'storageAccount':
        return actions.createStorageAccount({
          name: formState.storageAccountName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: formState.region.replace(/^\([^)]+\)\s*/, ''),
          redundancy: formState.redundancy,
          performance: formState.performance,
          tags: {
            environment: formState.tagsEnvironment,
            networkAccess: formState.networkAccess,
          },
        });
      case 'functionApp':
        return actions.createFunctionApp({
          name: formState.appName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: formState.region.replace(/^\([^)]+\)\s*/, ''),
          runtimeStack: formState.runtimeStack,
          runtimeVersion: formState.runtimeVersion,
          os: formState.os,
          hostingPlan: formState.hostingPlan,
          zoneRedundant: false,
          appInsights: formState.enableAppInsights,
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'sqlDatabase':
        return actions.createSqlDatabase({
          name: formState.databaseName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          server: formState.serverName,
          location: formState.region?.replace(/^\([^)]+\)\s*/, '') ?? 'East US',
          computeTier: formState.computeTier,
          slo: formState.serviceLevel,
          networking: formState.zoneRedundant ? 'Zone redundant' : 'Single zone',
          backupPolicy: `${formState.backupRetention} days`,
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'virtualMachine':
        if (!actions.createVirtualMachine) {
          return actions.createResource({
            id: '',
            name: formState.vmName,
            type: 'Virtual machine',
            resourceGroup: formState.resourceGroup,
            location: formState.region.replace(/^\([^)]+\)\s*/, ''),
            subscription: formState.subscription,
            status: 'Deploying',
            lastViewed: new Date().toISOString(),
            tags: {
              image: formState.image,
              size: formState.size,
              environment: formState.tagsEnvironment,
            },
            isFavorite: false,
          });
        }
        return actions.createVirtualMachine({
          name: formState.vmName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: formState.region.replace(/^\([^)]+\)\s*/, ''),
          image: formState.image,
          size: formState.size,
          authenticationType: formState.authenticationType,
          username: formState.username,
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'webApp':
        return actions.createWebApp({
          name: formState.appName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: normalizeRegion(formState.region),
          publish: formState.publish,
          runtimeStack: formState.runtimeStack,
          runtimeVersion: formState.runtimeVersion,
          operatingSystem: formState.operatingSystem,
          planSku: formState.planSku ?? 'P1v3',
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'keyVault':
        return actions.createKeyVault({
          name: formState.vaultName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: normalizeRegion(formState.region),
          pricingTier: formState.pricingTier,
          accessModel: formState.accessModel ?? 'RBAC',
          publicNetworkAccess: formState.publicNetworkAccess,
          tags: {
            owner: formState.tagsOwner,
          },
        });
      case 'cosmosDb':
        return actions.createCosmosDb({
          name: formState.accountName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: normalizeRegion(formState.region),
          api: formState.api,
          consistency: formState.consistency,
          regions: Array.isArray(formState.additionalRegions) ? formState.additionalRegions : [],
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'virtualNetwork':
        return actions.createVirtualNetwork({
          name: formState.vnetName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: normalizeRegion(formState.region),
          addressSpace: formState.addressSpace,
          subnetAddress: formState.subnetAddress,
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'dataFactory':
        return actions.createDataFactory({
          name: formState.factoryName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: normalizeRegion(formState.region),
          gitRepository: formState.gitRepository,
          gitBranch: formState.gitBranch,
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'logicApp':
        return actions.createLogicApp({
          name: formState.workflowName,
          subscription: formState.subscription,
          resourceGroup: formState.resourceGroup,
          location: normalizeRegion(formState.region),
          planType: formState.planType,
          runtime: formState.runtime,
          tags: {
            environment: formState.tagsEnvironment,
          },
        });
      case 'managedDisk': {
        const diskName = formState.diskName;
        const subscription = formState.subscription;
        const resourceGroup = formState.resourceGroup;
        const location = normalizeRegion(formState.region);
        const sizeGiB = formState.sizeGiB;
        const keyManagement = formState.keyManagement;

        const resource = actions.createResource({
          id: '',
          name: diskName,
          type: 'Managed disk',
          resourceGroup,
          location,
          subscription,
          status: 'Running',
          lastViewed: new Date().toISOString(),
          tags: {
            sizeGiB: String(sizeGiB ?? ''),
            keyManagement: keyManagement ?? 'Platform-managed key',
          },
          isFavorite: false,
        });

        try {
          window.localStorage.setItem(
            'lastCreatedDisk',
            JSON.stringify({
              name: resource.name,
              sizeGiB,
              keyManagement,
            }),
          );
        } catch {
          // ignore storage errors
        }

        return resource;
      }
      default:
        return null;
    }
  };

  const handleExportTemplate = () => {
    if (!blueprint) return;
    setIsExporting(true);
    try {
      const template = {
        $schema: 'https://schema.cogniorcloud/templates/2024-01-01/template.json',
        contentVersion: '1.0.0.0',
        metadata: {
          blueprint: blueprint.id,
          generatedAt: new Date().toISOString(),
        },
        parameters: formState,
      };
      const blob = new Blob([JSON.stringify(template, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${blueprint.id}-template.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!blueprint) return;
    const valid = validateAll();
    if (!valid) {
      trackEvent(AnalyticsEvents.FORM_VALIDATION_ERROR, {
        resourceType: blueprint.resourceType,
        stage: 'final',
      });
      return;
    }

    setDeploymentStatus('deploying');
    trackEvent(AnalyticsEvents.FORM_SUBMIT, {
      resourceType: blueprint.resourceType,
      blueprint: blueprint.id,
    });

    try {
      performCreation(blueprint.action);
      setTimeout(() => {
        setDeploymentStatus('succeeded');
        trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
          resourceType: blueprint.resourceType,
          blueprint: blueprint.id,
        });

        const returnTo = searchParams.get('returnTo');
        const targetPath =
          returnTo && (blueprint.id === 'resource-group' || blueprint.id === 'managed-disk')
            ? returnTo
            : blueprint.successPath;

        setTimeout(() => {
          navigate(targetPath);
        }, 900);
      }, 1200);
    } catch (error) {
      console.error(error);
      setDeploymentStatus('failed');
      trackEvent(AnalyticsEvents.RESOURCE_CREATE_ERROR, {
        resourceType: blueprint.resourceType,
        blueprint: blueprint.id,
      });
    }
  };

  const renderField = (field: FieldDefinition) => {
    const value =
      formState[field.id] !== undefined
        ? formState[field.id]
        : field.type === 'toggle'
        ? false
        : '';
    const opts = fieldOptions(field);

    switch (field.type) {
      case 'select':
        if (blueprint?.id === 'virtual-machine' && field.id === 'resourceGroup') {
          return (
            <div className="space-y-1">
              <select
                multiple={field.multiple}
                value={field.multiple ? value || [] : value ?? ''}
                onChange={(event) => {
                  const target = event.target;
                  if (field.multiple) {
                    const entries = Array.from(target.selectedOptions).map(
                      (option) => option.value,
                    );
                    handleFieldChange(field, entries);
                  } else {
                    handleFieldChange(field, target.value);
                  }
                }}
                className="azure-select"
              >
                {!field.multiple && <option value="">Select an option</option>}
                {opts.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-primary text-sm hover:underline"
                onClick={() => {
                  try {
                    window.localStorage.setItem('vmReturnState', JSON.stringify(formState));
                  } catch {
                    // ignore storage errors
                  }
                  const returnTo = `/create/virtual-machine/basics`;
                  navigate(`/create/resource-group/basics?returnTo=${encodeURIComponent(returnTo)}`);
                }}
              >
                Create new
              </button>
            </div>
          );
        }

        return (
          <select
            multiple={field.multiple}
            value={field.multiple ? value || [] : value ?? ''}
            onChange={(event) => {
              const target = event.target;
              if (field.multiple) {
                const entries = Array.from(target.selectedOptions).map(
                  (option) => option.value,
                );
                handleFieldChange(field, entries);
              } else {
                handleFieldChange(field, target.value);
              }
            }}
            className="azure-select"
          >
            {!field.multiple && <option value="">Select an option</option>}
            {opts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      // Custom virtual machine data disks table
      case 'text':
        if (blueprint?.id === 'virtual-machine' && field.id === 'dataDisks') {
          const disks: any[] = Array.isArray(formState.dataDisks) ? formState.dataDisks : [];
          return (
            <div className="space-y-3">
              <table className="min-w-full text-sm border border-border rounded-md overflow-hidden">
                <thead className="bg-background-elevated">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">LUN</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">Size (GiB)</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">Key management</th>
                  </tr>
                </thead>
                <tbody>
                  {disks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-foreground-secondary text-sm">
                        No data disks attached.
                      </td>
                    </tr>
                  ) : (
                    disks.map((disk, index) => (
                      <tr key={disk.name || index} className="border-t border-border">
                        <td className="px-3 py-2 text-sm text-foreground-secondary">{index}</td>
                        <td className="px-3 py-2 text-sm">{disk.name}</td>
                        <td className="px-3 py-2 text-sm">{disk.sizeGiB ?? '--'}</td>
                        <td className="px-3 py-2 text-sm">{disk.keyManagement ?? 'Platform-managed key'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <button
                type="button"
                className="text-primary text-sm hover:underline"
                onClick={() => {
                  const returnTo = `/create/virtual-machine/disks`;
                  navigate(`/create/managed-disk/basics?returnTo=${encodeURIComponent(returnTo)}`);
                }}
              >
                Create and attach a new disk
              </button>
            </div>
          );
        }

        if (blueprint?.id === 'virtual-machine' && field.id === 'vmTagsTable') {
          const tags: any[] = Array.isArray(formState.vmTags)
            ? formState.vmTags
            : [
                {
                  name: '',
                  value: '',
                  scope: 'vm-and-resources',
                },
              ];

          const updateTagRow = (index: number, key: 'name' | 'value' | 'scope', newValue: string) => {
            const next = tags.map((row, i) =>
              i === index
                ? {
                    ...row,
                    [key]: newValue,
                  }
                : row,
            );
            setFormState((prev) => ({
              ...prev,
              vmTags: next,
            }));
          };

          const addTagRow = () => {
            const next = [
              ...tags,
              {
                name: '',
                value: '',
                scope: 'vm-and-resources',
              },
            ];
            setFormState((prev) => ({
              ...prev,
              vmTags: next,
            }));
          };

          const removeTagRow = (index: number) => {
            if (tags.length === 1) {
              const single = [
                {
                  name: '',
                  value: '',
                  scope: 'vm-and-resources',
                },
              ];
              setFormState((prev) => ({
                ...prev,
                vmTags: single,
              }));
              return;
            }

            const next = tags.filter((_, i) => i !== index);
            setFormState((prev) => ({
              ...prev,
              vmTags: next,
            }));
          };

          return (
            <div className="space-y-3">
              <table className="min-w-full text-sm border border-border rounded-md overflow-hidden">
                <thead className="bg-background-elevated">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">Value</th>
                    <th className="px-3 py-2 text-left font-medium text-foreground-secondary">Resource</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={tag.name ?? ''}
                          onChange={(e) => updateTagRow(index, 'name', e.target.value)}
                          className="azure-input"
                          placeholder="Tag name (e.g. Environment)"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={tag.value ?? ''}
                          onChange={(e) => updateTagRow(index, 'value', e.target.value)}
                          className="azure-input"
                          placeholder="Tag value (e.g. production)"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="azure-select"
                          value={tag.scope ?? 'vm-and-resources'}
                          onChange={(e) => updateTagRow(index, 'scope', e.target.value)}
                        >
                          <option value="vm">Virtual machine only</option>
                          <option value="vm-and-resources">VM and related resources</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => removeTagRow(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                className="text-primary text-sm hover:underline"
                onClick={addTagRow}
              >
                Add tag
              </button>
            </div>
          );
        }

        return (
          <input
            type="text"
            value={value ?? ''}
            placeholder={field.placeholder}
            onChange={(event) => handleFieldChange(field, event.target.value)}
            className="azure-input"
          />
        );
      case 'radio':
        return (
          <div className="space-y-2">
            {opts.map((option) => (
              <label
                key={option.value}
                className="flex items-start space-x-2 border border-card-border rounded-lg p-3 hover:border-primary cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  checked={value === option.value}
                  onChange={() => handleFieldChange(field, option.value)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{option.label}</div>
                  {/* Fix: Optionally render description only if it exists and property is present */}
                  {option && 'description' in option && option.description && (
                    <span className="block text-xs text-muted-foreground">{String(option.description)}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        );
      case 'toggle':
        return (
          <label className="inline-flex items-center space-x-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(event) => handleFieldChange(field, event.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-10 h-5 rounded-full transition-colors ${
                  value ? 'bg-primary' : 'bg-border'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow transform transition ${
                    value ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>
            <span className="text-sm text-foreground">
              {Boolean(value) ? 'On' : 'Off'}
            </span>
          </label>
        );
      case 'textarea':
        return (
          <textarea
            value={value ?? ''}
            onChange={(event) => handleFieldChange(field, event.target.value)}
            className="azure-input h-28"
          />
        );
      case 'number':
        return (
          <div className="relative">
            <input
              type="number"
              value={value ?? ''}
              min={field.min}
              max={field.max}
              onChange={(event) =>
                handleFieldChange(field, event.target.value ? Number(event.target.value) : '')
              }
              className="azure-input pr-16"
            />
            {field.suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary">
                {field.suffix}
              </span>
            )}
          </div>
        );
      default:
        return (
          <input
            type="text"
            value={value ?? ''}
            placeholder={field.placeholder}
            onChange={(event) => handleFieldChange(field, event.target.value)}
            className="azure-input"
          />
        );
    }
  };

  // Create a new resource group from the inline dialog and select it
  const handleCreateResourceGroup = () => {
    const trimmed = newResourceGroup.trim();
    if (!trimmed) {
      return;
    }

    if (resourceGroups.some((rg) => rg.name === trimmed)) {
      // If it already exists, just select it and close
      setFormState((prev) => ({
        ...prev,
        resourceGroup: trimmed,
      }));
      setShowResourceGroupDialog(false);
      setNewResourceGroup('');
      return;
    }

    const subscription = formState.subscription || subscriptions[0]?.name || '';
    const rawRegion = formState.region || '(Americas) East US';
    const location = typeof rawRegion === 'string' ? rawRegion.replace(/^\([^)]+\)\s*/, '') : 'East US';

    const newGroup = actions.createResourceGroup({
      name: trimmed,
      subscription,
      location,
      tags: {
        environment: formState.tagsEnvironment || 'dev',
        owner: formState.tagsOwner || 'team-cognior',
      },
    });

    try {
      window.localStorage.setItem('lastCreatedResourceGroup', newGroup.name);
    } catch {
      // ignore storage errors
    }

    setFormState((prev) => ({
      ...prev,
      resourceGroup: newGroup.name,
    }));

    setShowResourceGroupDialog(false);
    setNewResourceGroup('');
  };

  if (!blueprint) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-warning mx-auto" />
          <div>
            <p className="text-lg font-semibold text-foreground">Blueprint not found</p>
            <p className="text-foreground-secondary text-sm">
              The requested Cognior service is not available in this demo environment.
            </p>
          </div>
          <button onClick={() => navigate('/create-resource')} className="azure-button-primary">
            Back to create hub
          </button>
        </div>
      </div>
    );
  }

  const currentStepConfig = steps[currentStep];

  const visibleSteps = steps.filter((step) => {
    if (step.id === 'networking') {
      return !!formState.privateEndpoint;
    }
    return true;
  });
  const visibleStepIndex = visibleSteps.findIndex((s) => s.id === stepId);

  // Cross-step validation (example: region must match between steps)
  const runCrossStepValidation = () => {
    const errors: FormErrors = {};
    if (formState.region && formState.region === 'East US' && formState.performance === 'Premium') {
      errors.performance = 'Premium is not available in East US.';
    }
    return errors;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <nav className="text-sm text-foreground-secondary space-x-2">
          <span onClick={() => navigate('/')} className="cursor-pointer hover:text-foreground">
            Home
          </span>
          <ChevronRight size={16} className="inline" />
          <span onClick={() => navigate('/create-resource')} className="cursor-pointer hover:text-foreground">
            Create a resource
          </span>
          <ChevronRight size={16} className="inline" />
          <span className="text-foreground font-medium">Create {blueprint.title}</span>
        </nav>

        <button onClick={() => navigate('/')} className="p-2 hover:bg-secondary rounded transition-colors">
          Close
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-border p-4 space-y-4 bg-background-elevated overflow-auto">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">{blueprint.title}</h2>
            <p className="text-sm text-foreground-secondary">{blueprint.description}</p>
          </div>

          <div className="space-y-2">
            {steps.map((step, index) => {
              const isComplete = completedStepIds.includes(step.id);
              const status = isComplete
                ? 'complete'
                : index === currentStep
                ? 'active'
                : 'upcoming';
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    const targetId = step.id;
                    const query = searchParams.toString();
                    const path = `/create/${serviceSlug}/${targetId}`;

                    // Always allow navigating to current or previous steps without re-validation
                    if (index <= currentStep) {
                      navigate(query ? `${path}?${query}` : path);
                      return;
                    }

                    // When jumping forward to a brand new step, validate the current step once
                    if (validateStep(currentStep)) {
                      const currentId = steps[currentStep]?.id;
                      if (currentId) {
                        setCompletedStepIds((prev) =>
                          prev.includes(currentId) ? prev : [...prev, currentId],
                        );
                      }
                      navigate(query ? `${path}?${query}` : path);
                    } else {
                      trackEvent(AnalyticsEvents.FORM_VALIDATION_ERROR, {
                        resourceType: blueprint?.resourceType,
                        step: steps[currentStep]?.id,
                      });
                    }
                  }}
                  className={`flex items-center w-full text-left px-3 py-2 rounded transition ${
                    status === 'active'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  {status === 'complete' ? (
                    <CheckCircle2 size={16} className="mr-2" />
                  ) : status === 'active' ? (
                    <Circle size={16} className="mr-2 fill-current" />
                  ) : (
                    <Circle size={16} className="mr-2" />
                  )}
                  <span className="text-sm">{step.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              {currentStepConfig?.title}
            </h1>
            {currentStepConfig?.description && (
              <p className="text-sm text-foreground-secondary mb-6">
                {currentStepConfig.description}
              </p>
            )}

            {!isReviewStep ? (
              <div className="space-y-8">
                {currentStepConfig?.sections.map((section) => (
                  <div
                    key={section.id}
                    className="bg-card border border-card-border rounded-lg p-6 space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-foreground">{section.title}</h3>
                      {section.description && (
                        <p className="text-sm text-foreground-secondary mt-1">
                          {section.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-6">
                      {section.fields.map((field) => (
                        <div key={field.id}>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            {field.label}
                            {field.required && <span className="text-error ml-1">*</span>}
                          </label>
                          <div className="space-y-2">
                            {renderField(field)}
                            {field.helper && (
                              <p className="text-xs text-foreground-secondary">{field.helper}</p>
                            )}
                            {errors[field.id] && (
                              <p className="text-xs text-error">{errors[field.id]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  {Object.keys(validationSummary).length > 0 && (
                    <div className="border border-warning/30 bg-warning/10 rounded-lg p-4">
                      <div className="flex items-start space-x-3 text-warning">
                        <AlertCircle size={18} className="mt-0.5" />
                        <div>
                          <p className="font-medium">Fix validation issues before creating the resource.</p>
                          <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                            {Object.entries(validationSummary).map(([fieldId, message]) => (
                              <li key={fieldId}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="bg-success/10 border border-success/30 text-success rounded-lg p-4 flex items-center space-x-3">
                      <CheckCircle2 size={20} />
                      <div>
                        <p className="font-medium">Validation passed</p>
                        <p className="text-sm text-success/80">
                          Review the configuration and select Create to start deployment.
                        </p>
                      </div>
                    </div>
                    <button
                      className="azure-button-secondary text-sm flex items-center"
                      onClick={handleExportTemplate}
                      disabled={isExporting}
                    >
                      <FileDown size={14} className="mr-1" />
                      {isExporting ? 'Preparing template...' : 'Download template'}
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-card-border rounded-lg p-6">
                  <h3 className="text-lg font-medium text-foreground mb-4">Summary</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {blueprint.summaryFields.map((summary) => (
                      <div key={summary.field} className="border border-border rounded p-3">
                        <dt className="text-xs uppercase text-foreground-secondary mb-1">
                          {summary.label}
                        </dt>
                        <dd className="text-sm text-foreground font-semibold">
                          {formState[summary.field] || '--'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="bg-card border border-card-border rounded-lg p-6">
                  <h3 className="text-lg font-medium text-foreground mb-4">Deployment status</h3>
                  <div className="space-y-3 text-sm text-foreground-secondary">
                    <p>
                      Status:{' '}
                      <span className="font-semibold text-foreground">
                        {deploymentStatus === 'idle'
                          ? 'Ready to deploy'
                          : deploymentStatus === 'deploying'
                          ? 'Deploying...'
                          : deploymentStatus === 'succeeded'
                          ? 'Succeeded'
                          : 'Failed'}
                      </span>
                    </p>
                    {deploymentStatus === 'deploying' && (
                      <div className="flex items-center space-x-2 text-primary">
                        <Loader2 className="animate-spin" size={16} />
                        <span>Submitting deployment to Cognior Resource Manager</span>
                      </div>
                    )}
                    {deploymentStatus === 'succeeded' && (
                      <p className="text-success">Deployment completed successfully.</p>
                    )}
                    {deploymentStatus === 'failed' && (
                      <p className="text-error">Deployment failed. Check configuration and retry.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <div className="border-t border-border bg-background-elevated p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-foreground-secondary">
            Step {currentStep + 1} of {steps.length}
          </div>
          <div className="space-x-2">
            <button onClick={handlePrevious} className="azure-button-secondary" disabled={currentStep === 0}>
              Previous
            </button>
            {!isReviewStep ? (
              <button onClick={handleNext} className="azure-button-primary">
                Next
              </button>
            ) : (
              <button onClick={handleSubmit} className="azure-button-primary flex items-center space-x-2">
                <span>
                  {deploymentStatus === 'deploying'
                    ? 'Deploying...'
                    : deploymentStatus === 'succeeded'
                    ? 'Deployment succeeded'
                    : 'Create'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showDraftDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Resume draft?</h2>
            <p className="mb-4">A saved draft was found. Would you like to resume or start over?</p>
            <button className="azure-button-primary mr-2" onClick={loadDraft}>Resume</button>
            <button className="azure-button-secondary" onClick={clearDraft}>Start Over</button>
          </div>
        </div>
      )}
      {permissionError && (
        <div className="bg-error text-white p-2 rounded mb-4">{permissionError}</div>
      )}
      {showResourceGroupDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded shadow-lg">
            <h2 className="text-lg font-bold mb-2">Create Resource Group</h2>
            <input className="azure-input mb-2" value={newResourceGroup} onChange={e => setNewResourceGroup(e.target.value)} placeholder="Resource group name" />
            <button className="azure-button-primary mr-2" onClick={handleCreateResourceGroup}>Create</button>
            <button className="azure-button-secondary" onClick={() => setShowResourceGroupDialog(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateServiceWizard;

