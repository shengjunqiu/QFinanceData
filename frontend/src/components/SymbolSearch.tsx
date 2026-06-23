import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

export function SymbolSearch() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

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
        Search ticker
      </label>
      <input
        autoComplete="off"
        className="symbol-search"
        id="symbol-search"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search ticker..."
        type="search"
        value={value}
      />
    </form>
  );
}
