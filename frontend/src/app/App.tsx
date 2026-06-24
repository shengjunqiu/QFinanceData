import { RouterProvider } from "react-router-dom";

import { I18nProvider } from "../i18n";
import { router } from "./router";

export function App() {
  return (
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  );
}
