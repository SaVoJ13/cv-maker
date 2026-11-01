import type { UiLang } from '../types';
import { pl, type MsgKey } from './pl';
import { en } from './en';
import { uk } from './uk';

export type { MsgKey };

export const MESSAGES: Record<UiLang, Record<MsgKey, string>> = { pl, en, uk };

export function translate(lang: UiLang, key: MsgKey): string {
  return MESSAGES[lang][key];
}

/** Локаль для дат і сортування за мовою інтерфейсу. */
export const UI_LOCALE: Record<UiLang, string> = { pl: 'pl-PL', uk: 'uk-UA', en: 'en-GB' };
