import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useI18n } from "../i18n";

export function SymbolSearch() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const { copy } = useI18n();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = value.trim().toUpperCase();

    if (!symbol) {
      return;
    }

    navigate(`/symbols/${encodeURIComponent(symbol)}`);
    setValue("");
  }

  return (
    <form className="symbol-search-form" onSubmit={handleSubmit} role="search">
      <label className="visually-hidden" htmlFor="symbol-search">
        {copy.common.searchTicker}
      </label>
      <input
        autoComplete="off"
        className="symbol-search"
        id="symbol-search"
        onChange={(event) => setValue(event.target.value)}
        placeholder={`${copy.common.searchTicker}...`}
        type="search"
        value={value}
      />
    </form>
  );
}
