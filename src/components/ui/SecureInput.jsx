import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useInputValidation, debounceValidation } from '@/lib/security';
import { AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Input seguro com validação automática e sanitização
 */
export const SecureInput = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  validationType = 'text',
  className = '',
  showValidation = true,
  ...props
}) => {
  const [validationState, setValidationState] = useState({
    isValid: true,
    error: null,
    sanitized: value
  });

  const [isDirty, setIsDirty] = useState(false);

  // Validação em tempo real com debounce
  useEffect(() => {
    if (isDirty) {
      debounceValidation(() => {
        const validation = useInputValidation(value, validationType);
        setValidationState(validation);
        
        // Chamar onChange com valor sanitizado se válido
        if (validation.isValid && onChange) {
          onChange(validation.sanitized);
        }
      });
    }
  }, [value, validationType, isDirty, onChange]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setIsDirty(true);
    
    // Validação imediata para alguns tipos
    if (validationType === 'price' || validationType === 'number') {
      const validation = useInputValidation(newValue, validationType);
      setValidationState(validation);
    }
    
    if (onChange) {
      onChange(newValue);
    }
  };

  const inputClassName = `
    ${className}
    ${!validationState.isValid && isDirty ? 'border-red-500 dark:border-red-400 focus:border-red-500' : ''}
    ${validationState.isValid && isDirty ? 'border-green-500 dark:border-green-400 focus:border-green-500' : ''}
  `.trim();

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={props.id} className="flex items-center gap-2">
          {label}
          {required && <span className="text-red-500">*</span>}
          {showValidation && isDirty && (
            validationState.isValid ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )
          )}
        </Label>
      )}
      
      <Input
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={inputClassName}
        {...props}
      />
      
      {showValidation && isDirty && validationState.error && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {validationState.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/**
 * Input específico para preços com formatação automática
 */
export const PriceInput = ({
  value,
  onChange,
  label = "Preço",
  currency = "R$",
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState(value?.toString() || '');

  useEffect(() => {
    setDisplayValue(value?.toString() || '');
  }, [value]);

  const handleChange = (sanitizedValue) => {
    // Atualizar display
    setDisplayValue(sanitizedValue?.toString() || '');
    
    // Chamar onChange com número
    if (onChange) {
      const numericValue = parseFloat(sanitizedValue) || 0;
      onChange(numericValue);
    }
  };

  return (
    <div className="relative">
      <SecureInput
        label={label}
        type="text"
        value={displayValue}
        onChange={handleChange}
        validationType="price"
        placeholder="0,0000"
        className="pl-12"
        {...props}
      />
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 dark:text-slate-400 font-semibold">
        {currency}
      </div>
    </div>
  );
};

/**
 * Input de busca com debounce automático
 */
export const SearchInput = ({
  value,
  onChange,
  placeholder = "Buscar...",
  debounceMs = 300,
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(value || '');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (onChange) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [internalValue, onChange, debounceMs]);

  const handleChange = (sanitizedValue) => {
    setInternalValue(sanitizedValue);
  };

  return (
    <SecureInput
      type="text"
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      validationType="search"
      showValidation={false}
      {...props}
    />
  );
};

/**
 * Hook para formulário seguro
 */
export const useSecureForm = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(true);

  const setValue = (field, value) => {
    const validationType = validationRules[field] || 'text';
    const validation = useInputValidation(value, validationType);
    
    setValues(prev => ({
      ...prev,
      [field]: validation.sanitized
    }));
    
    setErrors(prev => ({
      ...prev,
      [field]: validation.error
    }));
    
    // Verificar se formulário é válido
    const newErrors = { ...errors, [field]: validation.error };
    const hasErrors = Object.values(newErrors).some(error => error);
    setIsValid(!hasErrors);
  };

  const validateAll = () => {
    const newErrors = {};
    let formIsValid = true;

    Object.entries(values).forEach(([field, value]) => {
      const validationType = validationRules[field] || 'text';
      const validation = useInputValidation(value, validationType);
      
      if (!validation.isValid) {
        newErrors[field] = validation.error;
        formIsValid = false;
      }
    });

    setErrors(newErrors);
    setIsValid(formIsValid);
    return formIsValid;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setIsValid(true);
  };

  return {
    values,
    errors,
    isValid,
    setValue,
    validateAll,
    reset
  };
};

export default SecureInput;
