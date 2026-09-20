import { ChapterContent, BookDetail } from '@/sources/types';

// In-memory client module cache for instant transitions across navigation
export const clientChapterCache = new Map<string, ChapterContent>();
export const clientBookCache = new Map<string, BookDetail>();
