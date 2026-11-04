import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Basics, Cv, Education, Experience, LangLevel, LanguageSkill, RodoMode } from '../domain/types';
import { LEVELS } from '../domain/constants';
import { TEMPLATE_META } from '../domain/templates';
import { PHOTO_DEFAULT, type PhotoCrop } from '../domain/photo';
import { CORE_SECTIONS, completeness, sectionFilled, sectionIds, type SectionId } from '../domain/completeness';
import { clampLines, EXTRAS_MAX_VALUE, LICENCE_CATEGORIES, WELDING_METHODS, certsFromText, emptyDriver, emptyTech, toggleCategory, toggleWelding } from '../domain/extras';
import { emailProblem, monthProblem, rangeProblem, yearProblem } from '../domain/validation';
import { PhotoView } from './PhotoView';
import { loadPhoto } from '../export/photo';
import { moveItem, newEducation, newExperience, newLanguage, removeItem, sortExperience } from '../domain/cvOps';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { PhraseButton } from './PhrasePicker';
import { Area, Check, Field, ItemTools, SelectField } from './ui';

export interface TabProps {
  cv: Cv;
  update: (mutate: (draft: Cv) => void) => void;
}

const OPTIONAL: readonly SectionId[] = ['photo', 'extra', 'driver', 'tech', 'courses', 'interests'];
const TITLE_KEY = {
  basics: 's_basics',
  photo: 's_photo',
  extra: 's_extra',
  driver: 's_driver',
  tech: 's_trades',
  courses: 's_student',
  summary: 's_summary',
  exp: 's_exp',
  edu: 's_edu',
  skills: 's_skills',
  lang: 's_lang',
  interests: 's_int',
  rodo: 's_rodo',
} as const;

function Section({
  id,
  cv,
  open,
  onOpen,
  children,
}: {
  id: SectionId;
  cv: Cv;
  open: boolean;
  onOpen: (id: SectionId | null) => void;
  children: ReactNode;
}) {
  const { t } = useStore();
  const ids = sectionIds(cv);
  const index = ids.indexOf(id);
  const next = ids[index + 1];
  const filled = sectionFilled(cv, id) && id !== 'rodo';
  return (
    <section className={`acc${open ? ' open' : ''}`} id={`sec-${id}`}>
      <h3 className="acc-h">
        <button type="button" id={`sech-${id}`} aria-expanded={open} aria-controls={`secp-${id}`} onClick={() => onOpen(open ? null : id)}>
          <span className={`acc-n${filled ? ' done' : ''}`} aria-hidden="true">
            {filled ? <Icon name="check" size={14} /> : index + 1}
          </span>
          <span className="acc-t">{t(TITLE_KEY[id])}</span>
          {OPTIONAL.includes(id) ? <span className="acc-opt">{t('optional')}</span> : null}
          {filled ? <span className="sr-only">{t('sec_done')}</span> : null}
          <Icon name="chevron-down" size={18} className="acc-chev" />
        </button>
      </h3>
      <div className="acc-body" id={`secp-${id}`} role="region" aria-labelledby={`sech-${id}`} hidden={!open}>
        {children}
        {next ? (
          <div className="acc-next">
            <button type="button" className="btn" onClick={() => onOpen(next)}>
              {t('sec_next')}: {t(TITLE_KEY[next])}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Pasek postępu: jedna kreska na każdą kluczową sekcję (dotknięcie otwiera ją), pod spodem podpowiedź, co dalej. */
function Progress({ cv, open, onOpen }: { cv: Cv; open: SectionId | null; onOpen: (id: SectionId | null) => void }) {
  const { t } = useStore();
  const { done, total } = completeness(cv);
  const nextId = CORE_SECTIONS.find((id) => !sectionFilled(cv, id)) ?? null;
  return (
    <section className="prog" aria-label={t('filled')}>
      <div className="prog-head">
        <p className="prog-count">
          <b>{done}</b>
          <span aria-hidden="true">/{total}</span>
          <span className="sr-only">
            {' '}
            {t('filled')} {done}/{total}
          </span>
        </p>
        {nextId ? (
          <button type="button" className="btn soft sm" onClick={() => onOpen(nextId)}>
            {t('sec_next')}: {t(TITLE_KEY[nextId])}
            <Icon name="arrow-right" size={14} />
          </button>
        ) : (
          <p className="prog-done">
            <Icon name="check" size={16} />
            {t('prog_done')}
          </p>
        )}
      </div>
      <ol className="prog-steps">
        {CORE_SECTIONS.map((id) => {
          const filled = sectionFilled(cv, id);
          return (
            <li key={id}>
              <button
                type="button"
                className="prog-step"
                data-done={filled || undefined}
                data-open={open === id || undefined}
                aria-label={`${t(TITLE_KEY[id])}: ${t(filled ? 'sec_done' : 'sec_todo')}`}
                title={t(TITLE_KEY[id])}
                onClick={() => onOpen(id)}
              >
                <span />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ContentTab({ cv, update, open, onOpen }: TabProps & { open: SectionId | null; onOpen: (id: SectionId | null) => void }) {
  const { t } = useStore();
  const d = cv.data;
  const b = d.basics;
  const labels = { up: t('up'), down: t('down'), del: t('del'), sure: t('sure') };

  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState(false);

  /* Po przełączeniu sekcji przewijamy do jej nagłówka, bo zwinięcie poprzedniej przesuwa układ.
     Porównujemy z poprzednią wartością, więc samo wejście do edytora niczego nie przewija. */
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    if (open) document.getElementById(`sec-${open}`)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [open]);

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await loadPhoto(file);
      setPhotoError(false);
      update((x) => {
        x.data.basics.photo = dataUrl;
        resetCrop(x);
      });
    } catch {
      setPhotoError(true);
    }
  };

  const resetCrop = (x: Cv) => {
    x.data.basics.photoX = PHOTO_DEFAULT.x;
    x.data.basics.photoY = PHOTO_DEFAULT.y;
    x.data.basics.photoZoom = PHOTO_DEFAULT.zoom;
    x.data.basics.photoSize = PHOTO_DEFAULT.size;
  };
  const setCrop = (c: PhotoCrop) =>
    update((x) => {
      x.data.basics.photoX = c.x;
      x.data.basics.photoY = c.y;
      x.data.basics.photoZoom = c.zoom;
    });
  const setBasic = (key: Exclude<keyof Basics, 'photoX' | 'photoY' | 'photoZoom' | 'photoSize' | 'photoShape'>) => (v: string) =>
    update((x) => {
      x.data.basics[key] = v;
    });
  const patchExp = (id: string, patch: Partial<Experience>) =>
    update((x) => {
      const e = x.data.experience.find((i) => i.id === id);
      if (e) Object.assign(e, patch);
    });
  const patchEdu = (id: string, patch: Partial<Education>) =>
    update((x) => {
      const e = x.data.education.find((i) => i.id === id);
      if (e) Object.assign(e, patch);
    });
  const patchLang = (id: string, patch: Partial<LanguageSkill>) =>
    update((x) => {
      const e = x.data.languages.find((i) => i.id === id);
      if (e) Object.assign(e, patch);
    });

  /** Змінює блок водія; дані інших блоків і самого CV не чіпає. */
  const patchDriver = (mutate: (x: NonNullable<Cv['data']['extras']['driver']>) => void) =>
    update((x) => {
      const drv = x.data.extras.driver ?? emptyDriver();
      mutate(drv);
      x.data.extras.driver = drv;
    });

  /** Змінює блок майстра; дані інших блоків і самого CV не чіпає. */
  const patchTech = (mutate: (x: NonNullable<Cv['data']['extras']['tech']>) => void) =>
    update((x) => {
      const t = x.data.extras.tech ?? emptyTech();
      mutate(t);
      x.data.extras.tech = t;
    });

  const sec = (id: SectionId) => ({ id, cv, open: open === id, onOpen });
  const summaryLen = d.summary.trim().length;

  return (
    <div className="accs">
      <Progress cv={cv} open={open} onOpen={onOpen} />
      <Section {...sec('basics')}>
        <div className="row2">
          <Field id="f_name" label={t('f_name')} value={b.name} onChange={setBasic('name')} />
          <Field id="f_title" label={t('f_title')} value={b.title} onChange={setBasic('title')} />
        </div>
        <div className="row2">
          <Field id="f_email" type="email" label={t('f_email')} value={b.email} onChange={setBasic('email')} error={emailProblem(b.email) && t('err_email')} />
          <Field id="f_phone" type="tel" label={t('f_phone')} value={b.phone} onChange={setBasic('phone')} />
        </div>
        <div className="row2">
          <Field id="f_city" label={t('f_city')} value={b.city} onChange={setBasic('city')} />
          <Field id="f_link" label={t('f_link')} value={b.link} onChange={setBasic('link')} />
        </div>
      </Section>

      <Section {...sec('photo')}>
        <p className="hint">{t('h_photo')}</p>
        <div className="photobox">
          {b.photo ? <PhotoView b={b} className="pthumb" fixed={168} onCrop={setCrop} wheelZoom /> : <div className="photo-empty" aria-hidden="true"><Icon name="image" size={32} /></div>}
          <div className="btns">
            <input
              ref={fileRef}
              id="f_photo"
              type="file"
              accept="image/*"
              tabIndex={-1}
              onChange={(e) => {
                void onPickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} />
              {b.photo ? t('photo_change') : t('photo_add')}
            </button>
            {b.photo ? (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  update((x) => {
                    x.data.basics.photo = '';
                    resetCrop(x);
                  })
                }
              >
                <Icon name="trash" size={16} />
                {t('photo_remove')}
              </button>
            ) : null}
          </div>
        </div>
        {b.photo ? <p className="hint">{t('photo_drag')}</p> : null}
        {photoError ? (
          <p className="f-msg err" role="alert">
            <Icon name="alert" size={14} />
            <span>{t('photo_bad')}</span>
          </p>
        ) : null}
        {b.photo ? (
          <div>
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                update((x) => {
                  resetCrop(x);
                })
              }
            >
              <Icon name="rotate" size={14} />
              {t('photo_reset')}
            </button>
          </div>
        ) : null}
        {b.photo && !TEMPLATE_META[cv.tpl].photo ? <p className="hint">{t('photo_unused')}</p> : null}
      </Section>

      <Section {...sec('extra')}>
        <p className="hint">{t('h_extra')}</p>
        <Field id="f_address" label={t('f_address')} value={b.address} onChange={setBasic('address')} />
        <div className="row2">
          <Field id="f_birth_date" label={t('f_birth_date')} value={b.birthDate} onChange={setBasic('birthDate')} />
          <Field id="f_birth_place" label={t('f_birth_place')} value={b.birthPlace} onChange={setBasic('birthPlace')} />
        </div>
        <Field id="f_license" label={t('f_license')} value={b.license} onChange={setBasic('license')} />
      </Section>

      {sectionIds(cv).includes('driver') ? (
        <Section {...sec('driver')}>
          <p className="hint">{t('h_driver')}</p>
          <fieldset className="dgroup">
            <legend>{t('f_dr_cats')}</legend>
            <div className="dgrid cats">
              {LICENCE_CATEGORIES.map((c) => (
                <Check
                  key={c}
                  id={`dr_cat_${c}`}
                  label={c}
                  checked={(d.extras.driver?.categories ?? []).includes(c)}
                  onChange={() => patchDriver((x) => (x.categories = toggleCategory(x.categories, c)))}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="dgroup">
            <legend>{t('f_dr_permits')}</legend>
            <div className="dgrid two">
              <Check id="dr_code95" label={t('f_dr_code95')} checked={d.extras.driver?.code95 ?? false} onChange={(v) => patchDriver((x) => (x.code95 = v))} />
              <Check id="dr_adr" label={t('f_dr_adr')} checked={d.extras.driver?.adr ?? false} onChange={(v) => patchDriver((x) => (x.adr = v))} />
              <Check id="dr_card" label={t('f_dr_card')} checked={d.extras.driver?.tachograph ?? false} onChange={(v) => patchDriver((x) => (x.tachograph = v))} />
              <Check id="dr_udt" label={t('f_dr_udt')} checked={d.extras.driver?.udt ?? false} onChange={(v) => patchDriver((x) => (x.udt = v))} />
            </div>
          </fieldset>
          <Field
            id="dr_fleet"
            label={t('f_dr_fleet')}
            value={d.extras.driver?.fleet ?? ''}
            placeholder={t('f_dr_fleet_ph')}
            hint={t('f_dr_fleet_hint')}
            maxLength={EXTRAS_MAX_VALUE}
            onChange={(v) => patchDriver((x) => (x.fleet = v))}
          />
          <fieldset className="dgroup">
            <legend>{t('f_dr_routes')}</legend>
            <div className="dgrid two">
              {(['PL', 'UE'] as const).map((r) => (
                <Check
                  key={r}
                  id={`dr_route_${r}`}
                  label={t(r === 'PL' ? 'f_dr_route_pl' : 'f_dr_route_eu')}
                  checked={(d.extras.driver?.routes ?? []).includes(r)}
                  onChange={(v) => patchDriver((x) => (x.routes = (['PL', 'UE'] as const).filter((k) => (k === r ? v : x.routes.includes(k)))))}
                />
              ))}
            </div>
          </fieldset>
        </Section>
      ) : null}

      {sectionIds(cv).includes('tech') ? (
        <Section {...sec('tech')}>
          <p className="hint">{t('h_trades')}</p>
          <Field
            id="tr_sep"
            label={t('f_tr_sep')}
            value={d.extras.tech?.sep ?? ''}
            placeholder={t('f_tr_sep_ph')}
            hint={t('f_tr_limit')}
            maxLength={EXTRAS_MAX_VALUE}
            onChange={(v) => patchTech((x) => (x.sep = v))}
          />
          <fieldset className="dgroup">
            <legend>{t('f_tr_weld')}</legend>
            <div className="dgrid cats">
              {WELDING_METHODS.map((m) => (
                <Check
                  key={m}
                  id={`tr_weld_${m}`}
                  label={m}
                  checked={(d.extras.tech?.welding ?? []).includes(m)}
                  onChange={() => patchTech((x) => (x.welding = toggleWelding(x.welding, m)))}
                />
              ))}
            </div>
          </fieldset>
          <Field
            id="tr_cnc"
            label={t('f_tr_cnc')}
            value={d.extras.tech?.cnc ?? ''}
            placeholder={t('f_tr_cnc_ph')}
            hint={t('f_tr_limit')}
            maxLength={EXTRAS_MAX_VALUE}
            onChange={(v) => patchTech((x) => (x.cnc = v))}
          />
          <fieldset className="dgroup">
            <legend>{t('f_tr_more')}</legend>
            <div className="dgrid">
              <Check id="tr_drawings" label={t('f_tr_drawings')} checked={d.extras.tech?.drawings ?? false} onChange={(v) => patchTech((x) => (x.drawings = v))} />
              <Check id="tr_bhp" label={t('f_tr_bhp')} checked={d.extras.tech?.bhp ?? false} onChange={(v) => patchTech((x) => (x.bhp = v))} />
            </div>
          </fieldset>
          <Area
            id="tr_certs"
            label={t('f_tr_certs')}
            rows={4}
            value={(d.extras.tech?.certs ?? []).join('\n')}
            onChange={(v) => patchTech((x) => (x.certs = certsFromText(v)))}
          />
          <p className="hint">{t('f_tr_certs_hint')}</p>
        </Section>
      ) : null}

      <Section {...sec('summary')}>
        <div className="sh">
          <p className="hint">{t('h_summary')}</p>
          <PhraseButton
            cv={cv}
            section="summary"
            idPrefix="f_summary"
            value={d.summary}
            onChange={(v) =>
              update((x) => {
                x.data.summary = v;
              })
            }
          />
        </div>
        <Area
          id="f_summary"
          ariaLabel={t('s_summary')}
          value={d.summary}
          rows={5}
          counter={{ text: `${summaryLen} ${t('summary_counter')}`, ok: summaryLen >= 150 && summaryLen <= 600 }}
          onChange={(v) =>
            update((x) => {
              x.data.summary = v;
            })
          }
        />
      </Section>

      <Section {...sec('exp')}>
        <div className="sh">
          <p className="hint">{t('h_exp')}</p>
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              update((x) => {
                x.data.experience = sortExperience(x.data.experience);
              })
            }
          >
            <Icon name="arrow-down" size={14} />
            {t('sort_chrono')}
          </button>
        </div>
        {d.experience.map((e, i) => (
          <div className="item" key={e.id}>
            <div className="itop">
              <b>{(e.role || `${t('item')} ${i + 1}`) + (e.company ? ` · ${e.company}` : '')}</b>
              <ItemTools
                index={i}
                count={d.experience.length}
                labels={labels}
                onMove={(dir) =>
                  update((x) => {
                    x.data.experience = moveItem(x.data.experience, e.id, dir);
                  })
                }
                onRemove={() =>
                  update((x) => {
                    x.data.experience = removeItem(x.data.experience, e.id);
                  })
                }
              />
            </div>
            <div className="row2">
              <Field id={`exp_${e.id}_role`} label={t('f_role')} value={e.role} onChange={(v) => patchExp(e.id, { role: v })} />
              <Field id={`exp_${e.id}_company`} label={t('f_company')} value={e.company} onChange={(v) => patchExp(e.id, { company: v })} />
            </div>
            <div className="row3">
              <Field id={`exp_${e.id}_city`} label={t('f_exp_city')} value={e.city} onChange={(v) => patchExp(e.id, { city: v })} />
              <Field
                id={`exp_${e.id}_from`}
                label={t('f_from')}
                placeholder="03.2022"
                value={e.from}
                error={monthProblem(e.from) && t('err_month')}
                onChange={(v) => patchExp(e.id, { from: v })}
              />
              <Field
                id={`exp_${e.id}_to`}
                label={t('f_to')}
                placeholder="12.2024"
                value={e.to}
                disabled={e.current}
                error={(monthProblem(e.to) && t('err_month')) || (rangeProblem(e.from, e.to, e.current) && t('err_range'))}
                onChange={(v) => patchExp(e.id, { to: v })}
              />
            </div>
            <Check id={`exp_${e.id}_current`} label={t('f_current')} checked={e.current} onChange={(v) => patchExp(e.id, { current: v })} />
            <div className="sh">
              <PhraseButton cv={cv} section="experience" idPrefix={`exp_${e.id}`} value={e.bullets} onChange={(v) => patchExp(e.id, { bullets: v })} />
            </div>
            <Area
              id={`exp_${e.id}_bullets`}
              label={t('f_bullets')}
              value={e.bullets}
              rows={5}
              onChange={(v) => patchExp(e.id, { bullets: v })}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn add"
          onClick={() =>
            update((x) => {
              x.data.experience.push(newExperience());
            })
          }
        >
          <Icon name="plus" size={16} />
          {t('add_exp')}
        </button>
      </Section>

      <Section {...sec('edu')}>
        {d.education.map((e, i) => (
          <div className="item" key={e.id}>
            <div className="itop">
              <b>{e.school || `${t('item')} ${i + 1}`}</b>
              <ItemTools
                index={i}
                count={d.education.length}
                labels={labels}
                onMove={(dir) =>
                  update((x) => {
                    x.data.education = moveItem(x.data.education, e.id, dir);
                  })
                }
                onRemove={() =>
                  update((x) => {
                    x.data.education = removeItem(x.data.education, e.id);
                  })
                }
              />
            </div>
            <div className="row2">
              <Field id={`edu_${e.id}_school`} label={t('f_school')} value={e.school} onChange={(v) => patchEdu(e.id, { school: v })} />
              <Field id={`edu_${e.id}_degree`} label={t('f_degree')} value={e.degree} onChange={(v) => patchEdu(e.id, { degree: v })} />
            </div>
            <div className="row3">
              <Field id={`edu_${e.id}_field`} label={t('f_field')} value={e.field} onChange={(v) => patchEdu(e.id, { field: v })} />
              <Field
                id={`edu_${e.id}_from`}
                label={t('f_year_from')}
                value={e.from}
                error={yearProblem(e.from) && t('err_year')}
                onChange={(v) => patchEdu(e.id, { from: v })}
              />
              <Field
                id={`edu_${e.id}_to`}
                label={t('f_year_to')}
                value={e.to}
                error={(yearProblem(e.to) && t('err_year')) || (rangeProblem(e.from, e.to) && t('err_range'))}
                onChange={(v) => patchEdu(e.id, { to: v })}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn add"
          onClick={() =>
            update((x) => {
              x.data.education.push(newEducation());
            })
          }
        >
          <Icon name="plus" size={16} />
          {t('add_edu')}
        </button>
      </Section>

      {sectionIds(cv).includes('courses') ? (
        <Section {...sec('courses')}>
          <p className="hint">{t('h_student')}</p>
          <Area
            id="st_courses"
            ariaLabel={t('s_student')}
            rows={5}
            value={d.courses}
            onChange={(v) =>
              update((x) => {
                x.data.courses = clampLines(v);
              })
            }
          />
          <p className="hint">{t('f_st_hint')}</p>
        </Section>
      ) : null}

      <Section {...sec('skills')}>
        <div className="sh">
          <PhraseButton
            cv={cv}
            section="skills"
            idPrefix="f_hard"
            value={d.skillsHard}
            onChange={(v) =>
              update((x) => {
                x.data.skillsHard = v;
              })
            }
          />
        </div>
        <Area
          id="f_hard"
          label={t('f_hard')}
          value={d.skillsHard}
          rows={3}
          onChange={(v) =>
            update((x) => {
              x.data.skillsHard = v;
            })
          }
        />
        <div className="sh">
          <PhraseButton
            cv={cv}
            section="skills"
            idPrefix="f_soft"
            value={d.skillsSoft}
            onChange={(v) =>
              update((x) => {
                x.data.skillsSoft = v;
              })
            }
          />
        </div>
        <Area
          id="f_soft"
          label={t('f_soft')}
          value={d.skillsSoft}
          rows={2}
          onChange={(v) =>
            update((x) => {
              x.data.skillsSoft = v;
            })
          }
        />
      </Section>

      <Section {...sec('lang')}>
        {d.languages.map((l, i) => (
          <div className="item" key={l.id}>
            <div className="itop">
              <b>{l.name || `${t('item')} ${i + 1}`}</b>
              <ItemTools
                index={i}
                count={d.languages.length}
                labels={labels}
                onMove={(dir) =>
                  update((x) => {
                    x.data.languages = moveItem(x.data.languages, l.id, dir);
                  })
                }
                onRemove={() =>
                  update((x) => {
                    x.data.languages = removeItem(x.data.languages, l.id);
                  })
                }
              />
            </div>
            <div className="row2">
              <Field id={`lang_${l.id}_name`} label={t('f_lang')} value={l.name} onChange={(v) => patchLang(l.id, { name: v })} />
              <SelectField
                id={`lang_${l.id}_level`}
                label={t('f_level')}
                value={l.level}
                options={LEVELS.map((v) => ({ value: v, label: v === 'native' ? t('lvl_native') : v }))}
                onChange={(v) => patchLang(l.id, { level: v as LangLevel })}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn add"
          onClick={() =>
            update((x) => {
              x.data.languages.push(newLanguage());
            })
          }
        >
          <Icon name="plus" size={16} />
          {t('add_lang')}
        </button>
      </Section>

      <Section {...sec('interests')}>
        <p className="hint">{t('h_int')}</p>
        <Area
          id="f_interests"
          ariaLabel={t('s_int')}
          value={d.interests}
          rows={2}
          onChange={(v) =>
            update((x) => {
              x.data.interests = v;
            })
          }
        />
      </Section>

      <Section {...sec('rodo')}>
        <div className="radios" role="radiogroup" aria-label={t('s_rodo')}>
          {(['current', 'future'] as RodoMode[]).map((v) => (
            <label className="chk" htmlFor={`rodo_${v}`} key={v}>
              <input
                id={`rodo_${v}`}
                type="radio"
                name="rodo"
                value={v}
                checked={cv.rodo === v}
                onChange={() =>
                  update((x) => {
                    x.rodo = v;
                  })
                }
              />
              <span>{t(v === 'current' ? 'rodo_current' : 'rodo_future')}</span>
            </label>
          ))}
        </div>
        <Field
          id="rodoTarget"
          label={t('f_target')}
          value={cv.rodoTarget}
          onChange={(v) =>
            update((x) => {
              x.rodoTarget = v;
            })
          }
        />
        <p className="hint">{t('rodo_note')}</p>
      </Section>
    </div>
  );
}
