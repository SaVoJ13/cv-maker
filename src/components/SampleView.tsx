import type { Cv } from '../domain/types';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { Preview } from './Preview';

const noPages = () => undefined;

/** Przykładowe CV w widoku podglądu arkusza A4, tylko do obejrzenia. */
export function SampleView({ cv, onBack, onCreate }: { cv: Cv; onBack: () => void; onCreate: () => void }) {
  const { t } = useStore();
  return (
    <section className="sample" aria-labelledby="sample-title">
      <div className="ph">
        <div>
          <h1 id="sample-title">{t('sample_title')}</h1>
          <p>{t('sample_sub')}</p>
        </div>
        <div className="ph-actions">
          <button type="button" className="btn" onClick={onBack}>
            <Icon name="arrow-left" size={16} />
            {t('back')}
          </button>
          <button type="button" className="btn primary" onClick={onCreate}>
            <Icon name="plus" size={16} />
            {t('new_cv')}
          </button>
        </div>
      </div>
      <Preview cv={cv} onPages={noPages} />
    </section>
  );
}
