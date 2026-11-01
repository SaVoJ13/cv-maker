import type { CSSProperties, ReactNode } from 'react';
import type { PhotoCrop } from '../domain/photo';
import { PhotoView } from './PhotoView';
import type { Cv } from '../domain/types';
import { ACCENTS, DENSITY } from '../domain/constants';
import { SIDEBAR } from '../domain/templates';
import { tint } from '../domain/color';
import { DOC } from '../domain/docText';
import {
  dateRange,
  documentClause,
  extraDetails,
  filledEducation,
  filledExperience,
  filledLanguages,
  levelLabel,
  lines,
  list,
  mainHas,
  showsPhoto,
  sideBlocks,
  type SideBlock,
} from '../domain/cvOps';

interface PaperProps {
  cv: Cv;
  /** Callback ref do pomiaru wysokości arkusza */
  innerRef?: (el: HTMLDivElement | null) => void;
  /** Elementy położone absolutnie na arkuszu (np. znaczniki podziału stron) */
  overlay?: ReactNode;
  /** Gdy podane, zdjęcie w podglądzie można przeciągać i powiększać */
  onPhotoCrop?: (crop: PhotoCrop) => void;
}

function Entry({ role, org, dates, bullets }: { role: string; org: string; dates: string; bullets: string[] }) {
  return (
    <div className="p-item">
      <div className="p-top">
        <div className="p-id">
          <div className="p-role">{role}</div>
          {org ? <div className="p-org">{org}</div> : null}
        </div>
        {dates ? <div className="p-dates">{dates}</div> : null}
      </div>
      {bullets.length ? (
        <ul>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="p-sec">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Side({ blocks }: { blocks: SideBlock[] }) {
  return (
    <>
      {blocks.map((blk) => (
        <div className="s-block" key={blk.title}>
          <h2>{blk.title}</h2>
          {blk.kind === 'rows'
            ? blk.rows.map((r) => (
                <div className="s-row" key={r.label}>
                  <b>{r.label}</b>
                  <span>{r.value}</span>
                </div>
              ))
            : null}
          {blk.kind === 'langs'
            ? blk.langs.map((l, i) => (
                <div className="s-lang" key={i}>
                  <b>{l.name}</b>
                  <span>{l.level}</span>
                </div>
              ))
            : null}
          {blk.kind === 'list'
            ? blk.items.map((h, i) => (
                <div className="s-hobby" key={i}>
                  {h}
                </div>
              ))
            : null}
        </div>
      ))}
    </>
  );
}

/**
 * Arkusz A4 w HTML. Zawsze biały (poza szablonem z kremowym tłem), niezależnie od motywu aplikacji.
 * Szablony jednokolumnowe mają standardowe nagłówki, więc systemy ATS czytają je w prawidłowej kolejności.
 * Szablony z paskiem bocznym (Panel boczny, Kreatywny, Nordycki) mają dwie kolumny (patrz LookTab: ostrzeżenie).
 */
export function Paper({ cv, innerRef, overlay, onPhotoCrop }: PaperProps) {
  const L = DOC[cv.lang];
  const d = cv.data;
  const b = d.basics;
  const accent = ACCENTS[cv.accent];
  const style = { '--ac': accent, '--tint': tint(accent), '--d': DENSITY[cv.density] } as CSSProperties;
  const contact = [b.email, b.phone, b.city, b.link].filter(Boolean);
  const exp = filledExperience(d);
  const edu = filledEducation(d);
  const hard = list(d.skillsHard);
  const soft = list(d.skillsSoft);
  const langs = filledLanguages(d);

  const photo = showsPhoto(cv) ? b.photo : '';
  const extra = extraDetails(b, L);
  const side = SIDEBAR[cv.tpl];
  const has = mainHas(cv.tpl);

  const sections = (
    <>
      {d.summary.trim() ? (
        <Section title={L.summary}>
          <p>{d.summary}</p>
        </Section>
      ) : null}

      {exp.length ? (
        <Section title={L.exp}>
          {exp.map((e) => (
            <Entry
              key={e.id}
              role={e.role}
              org={[e.company, e.city].filter(Boolean).join(', ')}
              dates={dateRange(e, L)}
              bullets={lines(e.bullets)}
            />
          ))}
        </Section>
      ) : null}

      {edu.length ? (
        <Section title={L.edu}>
          {edu.map((e) => (
            <Entry
              key={e.id}
              role={[e.degree, e.field].filter(Boolean).join(', ') || e.school}
              org={e.degree || e.field ? e.school : ''}
              dates={dateRange({ from: e.from, to: e.to }, L)}
              bullets={[]}
            />
          ))}
        </Section>
      ) : null}

      {has.skills && (hard.length || soft.length) ? (
        <Section title={L.skills}>
          {hard.length ? (
            <p>
              <b>{L.hard}:</b> {hard.join(', ')}
            </p>
          ) : null}
          {soft.length ? (
            <p>
              <b>{L.soft}:</b> {soft.join(', ')}
            </p>
          ) : null}
        </Section>
      ) : null}

      {has.langs && langs.length ? (
        <Section title={L.lang}>
          <p>{langs.map((l) => `${l.name} – ${levelLabel(l.level, L)}`).join('  •  ')}</p>
        </Section>
      ) : null}

      {has.interests && d.interests.trim() ? (
        <Section title={L.interests}>
          <p>{d.interests}</p>
        </Section>
      ) : null}

      <div className="p-rodo">{documentClause(cv)}</div>
    </>
  );

  if (side) {
    const blocks = sideBlocks(cv, L);
    /* Zdjęcie: w panelu na górze paska, w szablonie Nordyckim obok nazwiska */
    const photoInSide = cv.tpl === 'panel';
    const aside = (
      <aside className="p-side">
        {photo && photoInSide ? <PhotoView b={b} onCrop={onPhotoCrop} /> : null}
        <Side blocks={blocks} />
      </aside>
    );
    const main = (
      <div className="p-main">
        <div className="p-head">
          {photo && !photoInSide ? <PhotoView b={b} onCrop={onPhotoCrop} /> : null}
          <div className="p-headtext">
            <h1>{b.name}</h1>
            {b.title ? <div className="p-title">{b.title}</div> : null}
          </div>
        </div>
        {sections}
      </div>
    );
    return (
      <div ref={innerRef} className={`paper t-side t-${cv.tpl} side-${side}`} style={style}>
        {side === 'left' ? aside : main}
        {side === 'left' ? main : aside}
        {overlay}
      </div>
    );
  }

  return (
    <div ref={innerRef} className={`paper t-${cv.tpl}`} style={style}>
      <div className="p-head">
        <div className="p-headtext">
          <h1>{b.name}</h1>
          {b.title ? <div className="p-title">{b.title}</div> : null}
          {cv.tpl === 'elegant' ? <div className="p-orn" aria-hidden="true" /> : null}
          {contact.length || extra.length ? (
            <div className="p-contactbox">
              {contact.length ? (
                <div className="p-contact">
                  {contact.map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </div>
              ) : null}
              {extra.length ? (
                <div className="p-contact p-extra">
                  {extra.map((r) => (
                    <span key={r.label}>
                      {r.label}: {r.value}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {photo ? <PhotoView b={b} onCrop={onPhotoCrop} /> : null}
      </div>
      {sections}
      {overlay}
    </div>
  );
}
