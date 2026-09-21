'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  position?: 'center' | 'top' | 'responsive-bottom';
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

const maxWidthClasses: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  description,
  children,
  footer,
  maxWidth = 'md',
  position = 'center',
  className,
  overlayClassName,
  showCloseButton = true,
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

    // Find landmarks outside modal to mark inert and aria-hidden
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

  const positionClasses = {
    center: 'items-center justify-center p-4',
    top: 'items-start justify-center p-4 pt-12 sm:pt-16',
    'responsive-bottom': 'items-end sm:items-center justify-center p-0 sm:p-4',
  }[position];

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm animate-fade-in transition-all',
        positionClasses,
        overlayClassName
      )}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : '弹窗对话框'}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden flex flex-col',
          position === 'responsive-bottom'
            ? 'rounded-t-2xl sm:rounded-xl max-h-[90vh]'
            : 'rounded-xl max-h-[85vh]',
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {icon && <div className="shrink-0 text-zinc-900 dark:text-zinc-100">{icon}</div>}
              <div className="min-w-0 flex-1">
                {title && (
                  <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50 truncate">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-mono">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
