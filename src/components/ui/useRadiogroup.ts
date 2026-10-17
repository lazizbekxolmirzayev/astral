'use client';

import { useCallback, useState } from 'react';

/**
 * Keyboard navigation for a radiogroup built from `<button role="radio">`.
 *
 * Handles ArrowLeft/Right/Up/Down to move focus, Home/End to jump to first/
 * last, and Space/Enter to activate. Returns props to spread on each option
 * button plus a container key handler.
 */
export function useRadiogroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(
    options.indexOf(value) >= 0 ? options.indexOf(value) : 0,
  );

  const handleOptionKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, options.length - 1));
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setActiveIndex(options.length - 1);
          break;
        case ' ':
        case 'Enter':
          event.preventDefault();
          onChange(options[index]);
          break;
        default:
          break;
      }
    },
    [options, onChange],
  );

  const optionProps = (option: T, index: number) => ({
    'data-option': option,
    role: 'radio' as const,
    'aria-checked': option === value,
    tabIndex: activeIndex === index ? 0 : -1,
    onClick: () => {
      onChange(option);
      setActiveIndex(index);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      handleOptionKeyDown(event, index);
      if (event.key === ' ' || event.key === 'Enter') {
        setActiveIndex(index);
      }
    },
  });

  return { optionProps, activeIndex, setActiveIndex };
}
