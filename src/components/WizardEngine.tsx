import React, { useMemo, useState } from 'react';

export type WizardFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'textarea';

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
  section?: string; // optional grouping header
  required?: boolean;
  visible?: (values: Record<string, any>) => boolean;
  validate?: (value: any, values: Record<string, any>) => string | undefined;
  normalize?: (value: any) => any;
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
}

export const WizardEngine: React.FC<WizardEngineProps> = ({ steps, initialValues, onSubmit, onCancel }) => {
  const [current, setCurrent] = useState(0);
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const step = steps[current];

  const visibleFields = useMemo(() => step.fields.filter(f => (f.visible ? f.visible(values) : true)), [step, values]);

  const setValue = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
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

  const next = () => {
    if (!validate()) return;
    setCurrent(c => Math.min(c + 1, steps.length - 1));
  };

  const prev = () => setCurrent(c => Math.max(c - 1, 0));

  const submit = () => {
    if (!validate()) return;
    onSubmit(values);
  };

  return (
    <div className="flex-1 p-6">
      <div className="flex space-x-8 mb-6 border-b border-border">
        {steps.map((s, i) => (
          <button
            key={s.id}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${i === current ? 'text-primary border-primary' : 'text-foreground-secondary border-transparent'}`}
            onClick={() => setCurrent(i)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="max-w-3xl space-y-6">
        {step.description && (
          <p className="text-sm text-foreground-secondary">{step.description}</p>
        )}

        {visibleFields.map(field => (
          <div key={field.key}>
            {field.section && (
              <h3 className="text-lg font-medium text-foreground mb-3">{field.section}</h3>
            )}
            <label className="block text-sm font-medium text-foreground mb-1">
              {field.label}
            </label>
            {field.type === 'text' && (
              <input
                className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                value={values[field.key] || ''}
                placeholder={field.placeholder}
                onChange={e => setValue(field.key, field.normalize ? field.normalize(e.target.value) : e.target.value)}
              />
            )}
            {field.type === 'number' && (
              <input
                type="number"
                className={`azure-input ${errors[field.key] ? 'border-error' : ''}`}
                value={values[field.key] ?? ''}
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
                {(field.options || []).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            {field.type === 'checkbox' && (
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={!!values[field.key]}
                  onChange={e => setValue(field.key, e.target.checked)}
                />
                <span className="text-sm text-foreground-secondary">{field.helpText || ''}</span>
              </label>
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
            {errors[field.key] && (
              <p className="text-error text-sm mt-1">{errors[field.key]}</p>
            )}
          </div>
        ))}
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


