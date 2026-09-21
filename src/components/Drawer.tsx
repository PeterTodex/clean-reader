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
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle escape, focus trap, and background inert
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Find landmarks outside drawer to mark inert and aria-hidden
    const affectedElements: HTMLElement[] = [];
    const landmarks = document.querySelectorAll<HTMLElement>('header, main, footer, [data-dialog-inert]');
    landmarks.forEach((el) => {
      if (overlayRef.current && !overlayRef.current.contains(el) && !el.contains(overlayRef.current)) {
        el.setAttribute('aria-hidden', 'true');
        (el as any).inert = true;
        affectedElements.push(el);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      affectedElements.forEach((el) => {
        el.removeAttribute('aria-hidden');
        (el as any).inert = false;
      });
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
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
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm transition-all',
        sideContainerClasses,
        overlayClassName
      )}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label="侧边抽屉面板"
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
