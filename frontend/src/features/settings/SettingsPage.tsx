import { ChangeEvent, useState } from "react";

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

  const upColor = settings.colorMode === "us" ? "Green" : "Red";
  const downColor = settings.colorMode === "us" ? "Red" : "Green";

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
        </div>
        <div className="settings-actions">
          <button className="text-action" onClick={resetSettings} type="button">
            Reset
          </button>
          <button className="primary-action" onClick={saveSettings} type="button">
            Save
          </button>
        </div>
      </div>

      {savedAt ? <p className="inline-message">Settings saved at {formatDateTime(savedAt)}.</p> : null}

      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>Default Data View</h2>
            <span>Charts and first fetch</span>
          </div>

          <SettingField label="Default time range" description="Used by charts and price queries when no range is selected.">
            <div className="settings-segmented-control" aria-label="Default time range">
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

          <SettingField label="Default update start" description="Used for the first historical price update.">
            <input
              className="settings-input"
              onChange={(event) => updateSettings("defaultStartDate", event.target.value)}
              type="date"
              value={settings.defaultStartDate}
            />
          </SettingField>

          <SettingField label="Default price basis" description="Controls whether charts prefer adjusted or raw prices.">
            <div className="settings-segmented-control" aria-label="Default price basis">
              <button
                aria-pressed={settings.priceBasis === "adjusted"}
                className={settings.priceBasis === "adjusted" ? "settings-segment-active" : ""}
                onClick={() => updateSettings("priceBasis", "adjusted")}
                type="button"
              >
                Adjusted
              </button>
              <button
                aria-pressed={settings.priceBasis === "raw"}
                className={settings.priceBasis === "raw" ? "settings-segment-active" : ""}
                onClick={() => updateSettings("priceBasis", "raw")}
                type="button"
              >
                Raw
              </button>
            </div>
          </SettingField>
        </section>

        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>Display and Freshness</h2>
            <span>Local preferences</span>
          </div>

          <SettingField label="Up / down colors" description="Switch between US and A-share/HK-style market color conventions.">
            <div className="settings-segmented-control" aria-label="Up and down color mode">
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

          <SettingField label="Data stale threshold" description="A symbol is stale after this many trading days without fresh data.">
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
            <h2>Preview</h2>
            <span>Current local state</span>
          </div>
          <div className="settings-preview-grid">
            <PreviewItem label="Range" value={settings.defaultRange} />
            <PreviewItem label="Start Date" value={settings.defaultStartDate} />
            <PreviewItem label="Price Basis" value={settings.priceBasis === "adjusted" ? "Adjusted price" : "Raw OHLC"} />
            <PreviewItem label="Stale After" value={`${settings.staleThresholdDays} trading days`} />
            <PreviewItem label="Up Color" value={upColor} tone={settings.colorMode === "us" ? "positive" : "negative"} />
            <PreviewItem label="Down Color" value={downColor} tone={settings.colorMode === "us" ? "negative" : "positive"} />
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
