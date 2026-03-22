import React, { useMemo, useState } from 'react';

export type WizardFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'password'
  | 'time'
  | 'toggle'
  | 'multiSelect'
  | 'custom'
  | 'link';

export interface WizardOption {
  label: string;
  value: string;
}

export interface WizardField {
  key: string;
  label: string;
  type: WizardFieldType;
  options?: WizardOption[];
  placeholder?: string;
  helpText?: string;
  helper?: string;
  section?: string; // optional grouping header
  required?: boolean;
  visible?: (values: Record<string, any>) => boolean;
  validate?: (value: any, values: Record<string, any>) => string | undefined;
  normalize?: (value: any) => any;
  min?: number;
  max?: number;
  text?: string; // for link type
  href?: string; // for link type
  dataSource?: string; // for dynamic data loading
  suffix?: string; // for display (e.g., "GiB", "disks")
}

export interface WizardStepSchema {
  id: string;
  title: string;
  description?: string;
  fields: WizardField[];
}

export interface WizardEngineProps {
  steps: WizardStepSchema[];
  initialValues: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onCancel?: () => void;
  onTabChange?: (index: number) => void;
  initialTabIndex?: number;
  customFieldRenderer?: (field: WizardField, value: any, onChange: (key: string, value: any) => void) => React.ReactNode;
  onFieldChange?: (key: string, value: any) => void;
}

export const WizardEngine: React.FC<WizardEngineProps> = ({ 
  steps, 
  initialValues, 
  onSubmit, 
  onCancel, 
  onTabChange, 
  initialTabIndex = 0,
  customFieldRenderer,
  onFieldChange 
}) => {
  const [current, setCurrent] = useState(initialTabIndex);
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const step = steps[current];

  const visibleFields = useMemo(() => step.fields.filter(f => (f.visible ? f.visible(values) : true)), [step, values]);

  const setValue = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    onFieldChange?.(key, value);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    visibleFields.forEach(f => {
      const v = values[f.key];
      if (f.required && (v === undefined || v === null || v === '')) {
        e[f.key] = `${f.label} is required`;
      }
      if (f.validate) {
        const msg = f.validate(v, values);
        if (msg) e[f.key] = msg;
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleTabClick = (index: number) => {
    setCurrent(index);
    onTabChange?.(index);
  };

  const next = () => {
    if (!validate()) return;
    const nextIndex = Math.min(current + 1, steps.length - 1);
    setCurrent(nextIndex);
    onTabChange?.(nextIndex);
  };

  const prev = () => {
    const prevIndex = Math.max(current - 1, 0);
    setCurrent(prevIndex);
    onTabChange?.(prevIndex);
  };

  const submit = () => {
    if (!validate()) return;
    onSubmit(values);
  };

  return (
    <div className="flex-1 p-6 min-h-screen pb-24">
      <div className="flex space-x-8 mb-6 border-b border-border">
        {steps.map((s, i) => (
          <button
            key={s.id}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${i === current ? 'text-primary border-primary' : 'text-foreground-secondary border-transparent'}`}
            onClick={() => handleTabClick(i)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="max-w-3xl space-y-6">
        {step.description && (
          <p className="text-sm text-foreground-secondary">{step.description}</p>
        )}

        {visibleFields.map(field => {
          const value = values[field.key];

          // Special handling for vmTagsTable: render tag rows table
          if (field.key === 'vmTagsTable') {
            const tags = Array.isArray(values.vmTags)
              ? values.vmTags
              : [
                  {
                    name: '',
                    value: '',
                    scope: 'vm-and-resources',
                  },
                ];

            const updateTagRow = (index: number, key: 'name' | 'value' | 'scope', newValue: string) => {
              const next = tags.map((row: any, i: number) =>
                i === index
                  ? {
                      ...row,
                      [key]: newValue,
                    }
                  : row,
              );
              setValues(prev => ({
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
              setValues(prev => ({
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
                setValues(prev => ({
                  ...prev,
                  vmTags: single,
                }));
                return;
              }

              const next = tags.filter((_: any, i: number) => i !== index);
              setValues(prev => ({
                ...prev,
                vmTags: next,
              }));
            };

            return (
              <div key={field.key} className="space-y-3">
                <label className="block text-sm font-medium text-foreground mb-2">
                  {field.label}
                </label>
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
                    {tags.map((tag: any, index: number) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={tag.name ?? ''}
                            onChange={e => updateTagRow(index, 'name', e.target.value)}
                            className="azure-input"
                            placeholder="Tag name (e.g. Environment)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={tag.value ?? ''}
                            onChange={e => updateTagRow(index, 'value', e.target.value)}
                            className="azure-input"
                            placeholder="Tag value (e.g. production)"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="azure-select"
                            value={tag.scope ?? 'vm-and-resources'}
                            onChange={e => updateTagRow(index, 'scope', e.target.value)}
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

          // Try custom field renderer first
          if (customFieldRenderer) {
            const customRender = customFieldRenderer(field, value, setValue);
            if (customRender) {
              return (
                <div key={field.key}>
                  {field.section && (
                    <h3 className="text-lg font-medium text-foreground mb-3">{field.section}</h3>
                  )}
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {field.label}
                    {field.required && <span className="text-error ml-1">*</span>}
                  </label>
                  {customRender}
                  {errors[field.key] && (
                    <p className="text-error text-sm mt-1">{errors[field.key]}</p>
                  )}
                </div>
              );
            }
          }

          return (
            <div key={field.key}>
              {field.section && (
                <h3 className="text-lg font-medium text-foreground mb-3">{field.section}</h3>
              )}
              <label className="block text-sm font-medium text-foreground mb-1">
                {field.label}
                {field.required && <span className="text-error ml-1">*</span>}
              </label>
              {field.type === 'text' && (
                <input
                  className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] || ''}
                  placeholder={field.placeholder}
                  onChange={e => setValue(field.key, field.normalize ? field.normalize(e.target.value) : e.target.value)}
                />
              )}
              {field.type === 'password' && (
                <input
                  type="password"
                  className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] || ''}
                  placeholder={field.placeholder}
                  onChange={e => setValue(field.key, e.target.value)}
                />
              )}
              {field.type === 'time' && (
                <input
                  type="time"
                  className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] || ''}
                  onChange={e => setValue(field.key, e.target.value)}
                />
              )}
              {field.type === 'number' && (
                <input
                  type="number"
                  className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] ?? ''}
                  min={field.min}
                  max={field.max}
                  onChange={e => setValue(field.key, Number(e.target.value))}
                />
              )}
              {field.type === 'textarea' && (
                <textarea
                  className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] || ''}
                  placeholder={field.placeholder}
                  onChange={e => setValue(field.key, e.target.value)}
                />
              )}
              {field.type === 'select' && (
                <select
                  className={`azure-select ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] || ''}
                  onChange={e => setValue(field.key, e.target.value)}
                >
                  <option value="">Select an option</option>
                  {(field.options || []).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              {field.type === 'checkbox' && (
                <div className="space-y-2">
                  {(field.options || []).map(o => (
                    <label key={o.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={Array.isArray(value) ? value.includes(o.value) : false}
                        onChange={e => {
                          const current = Array.isArray(value) ? value : [];
                          if (e.target.checked) {
                            setValue(field.key, [...current, o.value]);
                          } else {
                            setValue(field.key, current.filter((v: string) => v !== o.value));
                          }
                        }}
                      />
                      <span className="text-sm">{o.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {field.type === 'radio' && (
                <div className="space-y-2">
                  {(field.options || []).map(o => (
                    <label key={o.value} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={field.key}
                        checked={values[field.key] === o.value}
                        onChange={() => setValue(field.key, o.value)}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {field.type === 'toggle' && (
                <label className="inline-flex items-center space-x-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.key])}
                      onChange={e => setValue(field.key, e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-10 h-5 rounded-full transition-colors ${
                        values[field.key] ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full shadow transform transition ${
                          values[field.key] ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-foreground">
                    {Boolean(values[field.key]) ? 'On' : 'Off'}
                  </span>
                </label>
              )}
              {field.type === 'multiSelect' && (
                <select
                  multiple
                  className={`azure-select ${errors[field.key] ? 'border-error' : ''}`}
                  value={values[field.key] || []}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setValue(field.key, selected);
                  }}
                >
                  {(field.options || []).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              {field.type === 'custom' && (
                <div className="text-foreground-secondary">
                  Custom field: {field.label}
                </div>
              )}
              {field.helper && (
                <p className="text-xs text-foreground-secondary">{field.helper}</p>
              )}
              {errors[field.key] && (
                <p className="text-error text-sm mt-1">{errors[field.key]}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background-elevated border-t border-border p-4">
        <div className="flex justify-between items-center max-w-3xl">
          <button onClick={prev} disabled={current === 0} className="azure-button-secondary disabled:opacity-50">Previous</button>
          <div className="flex space-x-3">
            {current === steps.length - 1 ? (
              <button onClick={submit} className="azure-button-primary">Create</button>
            ) : (
              <button onClick={next} className="azure-button-primary">Next</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WizardEngine;


