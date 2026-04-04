import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'buy' | 'sell' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'full';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  className = '', 
  disabled, 
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-ui font-medium rounded-md transition-all duration-150 ease-default cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 hover:brightness-90 active:scale-95';
  
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--brand)] text-white',
    buy: 'bg-[var(--buy)] text-[var(--bg-base)]',
    sell: 'bg-[var(--sell)] text-[var(--text-primary)]',
    ghost: 'bg-transparent text-[var(--text-primary)] border-transparent',
    outline: 'bg-transparent text-[var(--text-primary)] border border-[var(--border-active)]'
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    full: 'w-full h-12 text-base'
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button className={combinedClassName} disabled={disabled || isLoading} {...props}>
      {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
      {isLoading ? "Loading..." : children}
    </button>
  );
}
