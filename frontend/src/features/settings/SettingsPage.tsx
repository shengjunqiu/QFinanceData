import { ChangeEvent, useState } from "react";

import { formatDateTime, type AppCopy, type Locale, useI18n } from "../../i18n";

type UpDownColorMode = "us" | "cn";
type PriceBasis = "adjusted" | "raw";
type TimeRange = "1D" | "1M" | "3M" | "1Y" | "5Y" | "MAX";

type SettingsState = {
  defaultRange: TimeRange;
  defaultStartDate: string;
  colorMode: UpDownColorMode;
  staleThresholdDays: number;
  priceBasis: PriceBasis;
};

const defaultSettings: SettingsState = {
  defaultRange: "1Y",
  defaultStartDate: "2015-01-01",
  colorMode: "us",
  staleThresholdDays: 2,
  priceBasis: "adjusted"
};

const ranges: TimeRange[] = ["1D", "1M", "3M", "1Y", "5Y", "MAX"];

export function SettingsPage() {
  const { copy, locale } = useI18n();
  const t = copy.settings;
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function updateSettings<Key extends keyof SettingsState>(key: Key, value: SettingsState[Key]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleThresholdChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);
    updateSettings("staleThresholdDays", Math.max(1, Math.min(30, nextValue)));
  }

  function saveSettings() {
    setSavedAt(new Date().toISOString());
  }

  function resetSettings() {
    setSettings(defaultSettings);
    setSavedAt(null);
  }

  const upColor = settings.colorMode === "us" ? t.green : t.red;
  const downColor = settings.colorMode === "us" ? t.red : t.green;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{t.preferences}</p>
          <h1>{t.title}</h1>
        </div>
        <div className="settings-actions">
          <button className="text-action" onClick={resetSettings} type="button">
            {copy.common.reset}
          </button>
          <button className="primary-action" onClick={saveSettings} type="button">
            {copy.common.save}
          </button>
        </div>
      </div>

      {savedAt ? <p className="inline-message">{t.savedAt} {formatDateTime(savedAt, locale)}.</p> : null}

      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>{t.defaultDataView}</h2>
            <span>{t.chartsAndFirstFetch}</span>
          </div>

          <SettingField label={t.defaultTimeRange} description={t.defaultTimeRangeDescription}>
            <div className="settings-segmented-control" aria-label={t.defaultTimeRange}>
              {ranges.map((range) => (
                <button
                  aria-pressed={settings.defaultRange === range}
                  className={settings.defaultRange === range ? "settings-segment-active" : ""}
                  key={range}
                  onClick={() => updateSettings("defaultRange", range)}
                  type="button"
                >
                  {range}
                </button>
              ))}
            </div>
          </SettingField>

          <SettingField label={t.defaultUpdateStart} description={t.defaultUpdateStartDescription}>
            <input
              className="settings-input"
              onChange={(event) => updateSettings("defaultStartDate", event.target.value)}
              type="date"
              value={settings.defaultStartDate}
            />
          </SettingField>

          <SettingField label={t.defaultPriceBasis} description={t.defaultPriceBasisDescription}>
            <div className="settings-segmented-control" aria-label={t.defaultPriceBasis}>
              <button
                aria-pressed={settings.priceBasis === "adjusted"}
                className={settings.priceBasis === "adjusted" ? "settings-segment-active" : ""}
                onClick={() => updateSettings("priceBasis", "adjusted")}
                type="button"
              >
                {t.adjusted}
              </button>
              <button
                aria-pressed={settings.priceBasis === "raw"}
                className={settings.priceBasis === "raw" ? "settings-segment-active" : ""}
                onClick={() => updateSettings("priceBasis", "raw")}
                type="button"
              >
                {t.raw}
              </button>
            </div>
          </SettingField>
        </section>

        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>{t.displayAndFreshness}</h2>
            <span>{t.localPreferences}</span>
          </div>

          <SettingField label={t.upDownColors} description={t.upDownColorsDescription}>
            <div className="settings-segmented-control" aria-label={t.upDownColorMode}>
              <button
                aria-pressed={settings.colorMode === "us"}
                className={settings.colorMode === "us" ? "settings-segment-active" : ""}
                onClick={() => updateSettings("colorMode", "us")}
                type="button"
              >
                US
              </button>
              <button
                aria-pressed={settings.colorMode === "cn"}
                className={settings.colorMode === "cn" ? "settings-segment-active" : ""}
                onClick={() => updateSettings("colorMode", "cn")}
                type="button"
              >
                A/HK
              </button>
            </div>
          </SettingField>

          <SettingField label={t.dataStaleThreshold} description={t.staleThresholdDescription}>
            <div className="number-setting">
              <button onClick={() => updateSettings("staleThresholdDays", Math.max(1, settings.staleThresholdDays - 1))} type="button">
                -
              </button>
              <input
                className="settings-input"
                max={30}
                min={1}
                onChange={handleThresholdChange}
                type="number"
                value={settings.staleThresholdDays}
              />
              <button onClick={() => updateSettings("staleThresholdDays", Math.min(30, settings.staleThresholdDays + 1))} type="button">
                +
              </button>
            </div>
          </SettingField>
        </section>

        <section className="panel panel-full">
          <div className="panel-heading">
            <h2>{t.preview}</h2>
            <span>{t.currentLocalState}</span>
          </div>
          <div className="settings-preview-grid">
            <PreviewItem label={t.range} value={settings.defaultRange} />
            <PreviewItem label={t.startDate} value={settings.defaultStartDate} />
            <PreviewItem label={t.priceBasis} value={settings.priceBasis === "adjusted" ? t.adjustedPrice : t.rawOhlc} />
            <PreviewItem label={t.staleAfter} value={formatTradingDays(settings.staleThresholdDays, copy, locale)} />
            <PreviewItem label={t.upColor} value={upColor} tone={settings.colorMode === "us" ? "positive" : "negative"} />
            <PreviewItem label={t.downColor} value={downColor} tone={settings.colorMode === "us" ? "negative" : "positive"} />
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingField({ children, description, label }: { children: React.ReactNode; description: string; label: string }) {
  return (
    <div className="setting-field">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

function PreviewItem({ label, tone, value }: { label: string; tone?: "positive" | "negative"; value: string }) {
  return (
    <div className="preview-item">
      <span>{label}</span>
      <strong className={tone === "positive" ? "change-positive" : tone === "negative" ? "change-negative" : undefined}>{value}</strong>
    </div>
  );
}

function formatTradingDays(value: number, copy: AppCopy, locale: Locale) {
  return locale === "zh" ? `${value} ${copy.settings.tradingDays}` : `${value} ${copy.settings.tradingDays}`;
}
