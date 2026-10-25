import { Suspense } from "react";
import App from "@/components/app";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">Making a little space…</div>}>
      <App />
    </Suspense>
  );
}
