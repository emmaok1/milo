"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  sampleReportEntries,
  showSampleReport,
  reportViewHref,
} from "@/lib/report-sample";
import type { JournalEntry } from "@/lib/listener-model";
import { localDate } from "@/lib/types";
import {
  buildReport,
  moveReportAnchor,
  chartDate,
  type ReportPeriod,
} from "@/lib/report-model";
const foodColors = ["#78916b", "#c5ac78", "#ce9279", "#a59ab8"];
const feelingColors = ["#78916b", "#c5ac78", "#b68e97"];
export default function ReportView({
  entries,
  timezone,
  onRefresh,
}: {
  entries: JournalEntry[];
  timezone: string;
  onOpenDay: (date: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const period: ReportPeriod =
    search.get("period") === "month" ? "month" : "week";
  const [anchor, setAnchor] = useState(() => localDate(timezone));
  const [analyzing, setAnalyzing] = useState(false),
    [error, setError] = useState("");
  const preview = showSampleReport(search.get("preview"), entries.length);
  const report = useMemo(
    () =>
      buildReport(
        preview ? sampleReportEntries(anchor, period) : entries,
        anchor,
        period,
      ),
    [entries, anchor, period, preview],
  );
  const photoTotal = report.foods.reduce((n, f) => n + f.count, 0);
  let offset = 0;
  const gradient = report.foods
    .map((f, i) => {
      const start = offset;
      offset += photoTotal ? (f.count / photoTotal) * 100 : 0;
      return `${foodColors[i]} ${start}% ${offset}%`;
    })
    .join(",");
  async function analyze() {
    setAnalyzing(true);
    setError("");
    try {
      for (const e of report.entries.filter(
        (e) => e.photo && e.foodCategory === undefined,
      )) {
        const r = await fetch("/api/journal/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: e.id }),
        });
        if (!r.ok)
          throw new Error(
            "Some photos could not be analyzed. You can set their categories in your journal.",
          );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await onRefresh();
      setAnalyzing(false);
    }
  }
  return (
    <div className="r-report" data-preview={preview ? "true" : undefined}>
      <div className="r-period-tabs" role="group" aria-label="Report period">
        {(["week", "month"] as const).map((v) => (
          <button
            key={v}
            aria-pressed={period === v}
            className={period === v ? "selected" : ""}
            onClick={() => router.replace(reportViewHref(v, preview))}
          >
            {v === "week" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>
      <div className="r-data-mode">
        {preview && (
          <span className="r-sample-badge" role="status">
            Sample data
          </span>
        )}
        <button
          onClick={() => router.replace(reportViewHref(period, !preview))}
        >
          {preview ? "Your report" : "Preview report"}
        </button>
      </div>
      <div className="r-period-nav">
        <button
          aria-label="Previous report period"
          onClick={() => setAnchor(moveReportAnchor(anchor, period, -1))}
        >
          <ChevronLeft size={19} />
        </button>
        <span>
          {chartDate(report.start, true)} – {chartDate(report.end, true)},{" "}
          {report.end.slice(0, 4)}
        </span>
        <button
          aria-label="Next report period"
          onClick={() => setAnchor(moveReportAnchor(anchor, period, 1))}
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <section className="m-card r-card">
        <div className="r-card-heading">
          <h2>Food</h2>
          <span>{photoTotal} classified</span>
        </div>
        <div className="r-food-layout">
          <div
            role="img"
            aria-label={
              photoTotal
                ? report.foods.map((f) => `${f.label}: ${f.count}`).join(", ")
                : "No classified photos"
            }
            className="r-food-pie"
            style={{
              background: photoTotal
                ? `conic-gradient(${gradient})`
                : "#eceee7",
            }}
          />
          <div className="r-legend r-food-legend">
            {report.foods.map((f, i) => (
              <span key={f.label}>
                <i style={{ background: foodColors[i] }} />
                <span className="r-food-label">{f.label}<small>{f.count} photos</small></span>
                <b>
                  {photoTotal ? Math.round((f.count / photoTotal) * 100) : 0}%
                </b>
              </span>
            ))}
          </div>
        </div>
        <p className="r-empty-inline">Share of classified photos · not portion size or nutrition.</p>
        {!photoTotal && (
          <p className="r-empty-inline">No classified food photos in this period yet.</p>
        )}
        {report.unclassifiedPhotos > 0 && (
          <p className="r-empty-inline">
            {report.unclassifiedPhotos} unclassified · excluded
          </p>
        )}
        {!preview &&
          report.entries.some(
            (e) => e.photo && e.foodCategory === undefined,
          ) && (
            <button disabled={analyzing} onClick={() => void analyze()}>
              {analyzing ? "Analyzing…" : "Analyze photos"}
            </button>
          )}
        {error && <p role="alert">{error}</p>}
      </section>
      <section className="m-card r-card">
        <div className="r-card-heading">
          <h2>Feelings</h2>
          <span>{report.feelingEntries} entries</span>
        </div>
        <svg
          className="r-chart"
          viewBox="0 0 340 190"
          role="img"
          aria-label={report.primaryFeelings
            .map((f) => `${f.label}: ${f.count}`)
            .join(", ")}
        >
          <title>Feelings</title>
          <line x1="25" y1="150" x2="315" y2="150" stroke="#e7e9e1" />
          {report.primaryFeelings.map((f, i) => {
            const h =
              (f.count /
                Math.max(1, ...report.primaryFeelings.map((f) => f.count))) *
              125;
            return (
              <g key={f.label}>
                <rect
                  x={45 + i * 100}
                  y={150 - h}
                  width="50"
                  height={h}
                  rx="7"
                  fill={feelingColors[i]}
                />
                <text x={70 + i * 100} y={142 - h} textAnchor="middle">
                  {f.count}
                </text>
                <text x={70 + i * 100} y="177" textAnchor="middle">
                  {f.label}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="r-empty-inline">Number of entries tagged with each feeling. One entry can have several tags.</p>
        {!report.primaryFeelings.some((f) => f.count > 0) && (
          <p className="r-empty-inline">No Joy, Regret or Pain tags yet.</p>
        )}
      </section>
      <section className="m-card r-card">
        <div className="r-card-heading"><h2>Summary</h2></div>
        <p>{report.generalAnalysis}</p>
      </section>
      <section className="m-card r-card r-advice-card">
        <div className="r-card-heading"><h2>Advice</h2></div>
        <p>{report.advice}</p>
      </section>
    </div>
  );
}
