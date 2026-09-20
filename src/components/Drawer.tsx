'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: 'left' | 'right' | 'bottom';
  width?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  side = 'left',
  width = 'max-w-md w-full',
  children,
  className,
  overlayClassName,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sideContainerClasses = {
    left: 'justify-start',
    right: 'justify-end',
    bottom: 'items-end justify-center',
  }[side];

  const sideDrawerClasses = {
    left: 'h-full border-r border-zinc-200 dark:border-zinc-800',
    right: 'h-full border-l border-zinc-200 dark:border-zinc-800',
    bottom: 'w-full max-h-[85vh] rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800',
  }[side];

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm transition-all',
        sideContainerClasses,
        overlayClassName
      )}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-white dark:bg-zinc-900 shadow-2xl flex flex-col',
          side !== 'bottom' && width,
          sideDrawerClasses,
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};
