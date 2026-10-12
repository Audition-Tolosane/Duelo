import { pluralKey, setLanguage } from '../utils/i18n';

// pluralKey ne doit pas dépendre d'Intl.PluralRules (absent de Hermes sur téléphone).
describe('pluralKey', () => {
  const realIntl = global.Intl;
  beforeAll(() => { (global as any).Intl = { ...realIntl, PluralRules: undefined }; });
  afterAll(() => { (global as any).Intl = realIntl; setLanguage('fr'); });

  it('français : 0 et 1 au singulier', () => {
    setLanguage('fr');
    expect(pluralKey('k', 0)).toBe('k_one');
    expect(pluralKey('k', 1)).toBe('k_one');
    expect(pluralKey('k', 2)).toBe('k_many');
  });
  it('anglais : seul 1 au singulier', () => {
    setLanguage('en');
    expect(pluralKey('k', 0)).toBe('k_many');
    expect(pluralKey('k', 1)).toBe('k_one');
  });
  it('japonais : toujours la forme plurielle', () => {
    setLanguage('ja');
    expect(pluralKey('k', 1)).toBe('k_many');
  });
});
