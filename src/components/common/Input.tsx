import React from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  variant?: 'underline';
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
};

export const Input: React.FC<Props> = ({ id, label, variant = 'underline', startAdornment, endAdornment, className = '', ...props }) => (
  <div className={`ui-input ui-input-${variant} ${className}`.trim()}>
    {startAdornment && <span className="ui-input-start" aria-hidden="true">{startAdornment}</span>}
    <input id={id} aria-label={props['aria-label'] || label} placeholder=" " {...props} />
    <label htmlFor={id}>{label}</label>
    {endAdornment && <span className="ui-input-end">{endAdornment}</span>}
  </div>
);

