import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DROPDOWN_ITEM,
  DROPDOWN_ITEM_ACTIVE,
  DROPDOWN_ITEM_DISABLED,
  DROPDOWN_MENU,
  DROPDOWN_TRIGGER,
} from './dropdownStyles';

export type AppSelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type AppSelectProps<T extends string> = {
  value: T;
  options: Array<AppSelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  itemClassName?: string;
  preferNativeOnMobile?: boolean;
  mobileBreakpointPx?: number;
  ariaLabel?: string;
};

const cx = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' ');

const getFirstEnabledIndex = <T extends string>(options: Array<AppSelectOption<T>>) =>
  options.findIndex(option => !option.disabled);

const AppSelect = <T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  className,
  menuClassName,
  itemClassName,
  preferNativeOnMobile = true,
  mobileBreakpointPx = 767,
  ariaLabel,
}: AppSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!preferNativeOnMobile || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setIsMobile(false);
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpointPx}px)`);
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, [mobileBreakpointPx, preferNativeOnMobile]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const selectedIndex = useMemo(
    () => options.findIndex(option => option.value === value),
    [options, value]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (selectedIndex >= 0 && !options[selectedIndex]?.disabled) {
      setActiveIndex(selectedIndex);
      return;
    }

    setActiveIndex(getFirstEnabledIndex(options));
  }, [isOpen, options, selectedIndex]);

  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]?.label : undefined;

  const moveActive = (direction: 1 | -1) => {
    if (!options.length) return;

    const startIndex = activeIndex >= 0 ? activeIndex : (selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(options));
    let nextIndex = startIndex;

    for (let i = 0; i < options.length; i += 1) {
      nextIndex = (nextIndex + direction + options.length) % options.length;
      if (!options[nextIndex]?.disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  };

  const chooseOption = (option: AppSelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex >= 0) {
        chooseOption(options[activeIndex]);
      }
      return;
    }

    if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  if (preferNativeOnMobile && isMobile) {
    return (
      <div className="relative" ref={rootRef}>
        <select
          value={value}
          onChange={event => onChange(event.target.value as T)}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cx(DROPDOWN_TRIGGER, 'appearance-none', className)}
        >
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        className={cx(DROPDOWN_TRIGGER, 'text-left flex items-center justify-between', className)}
      >
        <span className={selectedLabel ? 'text-slate-800' : 'text-slate-400'}>
          {selectedLabel || placeholder || 'Bitte auswaehlen'}
        </span>
        <ChevronDown className={cx('h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div id={listboxId} role="listbox" className={cx(DROPDOWN_MENU, menuClassName)}>
          {options.map((option, index) => {
            const isActive = index === activeIndex;
            const isSelected = option.value === value;
            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className={cx(
                  DROPDOWN_ITEM,
                  isActive && DROPDOWN_ITEM_ACTIVE,
                  option.disabled && DROPDOWN_ITEM_DISABLED,
                  itemClassName
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppSelect;
