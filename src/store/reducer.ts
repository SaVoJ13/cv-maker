import type { Cv, UiLang } from '../domain/types';
import { duplicateCv } from '../domain/cvOps';
import type { PersistedState } from './persist';

export type State = PersistedState;

export type Action =
  | { type: 'add'; cv: Cv }
  | { type: 'addMany'; cvs: Cv[] }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; copyLabel: string }
  | { type: 'select'; id: string | null }
  | { type: 'ui'; lang: UiLang }
  /** Mutator działa na kopii CV; `updated` ustawiamy automatycznie. */
  | { type: 'update'; id: string; mutate: (draft: Cv) => void; now?: number };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return { ...state, cvs: [...state.cvs, action.cv], currentId: action.cv.id };
    case 'addMany':
      return action.cvs.length ? { ...state, cvs: [...state.cvs, ...action.cvs] } : state;
    case 'remove': {
      const cvs = state.cvs.filter((c) => c.id !== action.id);
      return { ...state, cvs, currentId: state.currentId === action.id ? null : state.currentId };
    }
    case 'duplicate': {
      const src = state.cvs.find((c) => c.id === action.id);
      if (!src) return state;
      return { ...state, cvs: [...state.cvs, duplicateCv(src, action.copyLabel)] };
    }
    case 'select':
      return { ...state, currentId: action.id };
    case 'ui':
      return { ...state, ui: action.lang };
    case 'update': {
      const i = state.cvs.findIndex((c) => c.id === action.id);
      const current = state.cvs[i];
      if (!current) return state;
      const draft = structuredClone(current);
      action.mutate(draft);
      draft.updated = action.now ?? Date.now();
      const cvs = state.cvs.slice();
      cvs[i] = draft;
      return { ...state, cvs };
    }
  }
}
