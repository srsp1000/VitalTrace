import React, { useState, useMemo } from 'react';
import { 
  Info, 
  ExternalLink, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { useHealthData } from '../../context/HealthDataContext';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceArea,
  ReferenceLine 
} from 'recharts';

export const TrendsScreen: React.FC = () => {
  const { observations, setSelectedDocumentIdFilter, setActiveScreen } = useHealthData();

  // Find all distinct canonical tests that have numeric values
  const numericTests = useMemo(() => {
    const map = new Map<string, { count: number; unit: string }>();
    observations.forEach(o => {
      if (o.valueNumeric !== null && o.verifiedByUser === 'confirmed') {
        const existing = map.get(o.canonicalTestName);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(o.canonicalTestName, { count: 1, unit: o.originalUnit });
        }
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, count: data.count, unit: data.unit }))
      .sort((a, b) => b.count - a.count);
  }, [observations]);

  // Default to Fasting Glucose or first available test
  const [selectedTestName, setSelectedTestName] = useState<string>(() => {
    return numericTests.find(t => t.name === 'Fasting Glucose')?.name || numericTests[0]?.name || '';
  });

  // Extract trend data points for the selected test
  const trendData = useMemo(() => {
    if (!selectedTestName) return [];

    return observations
      .filter(o => o.canonicalTestName === selectedTestName && o.valueNumeric !== null && o.verifiedByUser === 'confirmed')
      .sort((a, b) => new Date(a.observationDate).getTime() - new Date(b.observationDate).getTime())
      .map(o => ({
        id: o.id,
        date: o.observationDate,
        value: o.valueNumeric,
        unit: o.originalUnit,
        refLow: o.referenceLow,
        refHigh: o.referenceHigh,
        sourceDoc: o.sourceDocumentName || o.documentId,
        documentId: o.documentId,
      }));
  }, [observations, selectedTestName]);

  // Check unit consistency: Warn if multiple distinct units exist for the same test
  const distinctUnits = useMemo(() => {
    const set = new Set<string>();
    trendData.forEach(d => {
      if (d.unit) set.add(d.unit);
    });
    return Array.from(set);
  }, [trendData]);

  // Global reference bounds for this test
  const samplePoint = trendData[0];
  const refLow = samplePoint?.refLow ?? null;
  const refHigh = samplePoint?.refHigh ?? null;
  const currentUnit = samplePoint?.unit || '';

  return (
    <div className="space-y-6">
      {/* Header and Test Selector */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Longitudinal Biomarker Trends
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-200">
              Unit-Standardized
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visual inspection of repeated laboratory readings over time with reference interval bounds and source traceability.
          </p>
        </div>

        {numericTests.length > 0 && (
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <label className="text-xs font-semibold uppercase text-slate-600 whitespace-nowrap">
              Select Biomarker:
            </label>
            <select
              value={selectedTestName}
              onChange={(e) => setSelectedTestName(e.target.value)}
              className="text-xs rounded-md border border-slate-300 px-3 py-2 bg-white text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {numericTests.map(t => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.count} readings, {t.unit})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {numericTests.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-16 text-center shadow-subtle space-y-3">
          <Info className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-900">
            No confirmed numerical biomarkers yet
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once laboratory observations are uploaded and confirmed in the Review screen, longitudinal trajectories with clinical reference intervals will render here.
          </p>
          <button
            onClick={() => setActiveScreen('upload')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-subtle transition-colors"
          >
            <span>Upload Laboratory Report</span>
          </button>
        </div>
      ) : (
        <>
          {/* Incompatible unit warning if detected */}
          {distinctUnits.length > 1 && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Incompatible Units Detected:</strong> Observations for {selectedTestName} contain multiple units ({distinctUnits.join(', ')}). Trends must only compare standardized, like-for-like units.
              </div>
            </div>
          )}

          {/* Chart Section */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                {selectedTestName}
              </h3>
              <span className="text-xs font-mono font-medium text-slate-500">
                [{currentUnit}]
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Reference Interval:{' '}
              {refLow !== null || refHigh !== null ? (
                <span className="font-semibold text-slate-700">
                  {refLow ?? '<'} to {refHigh ?? '>'} {currentUnit}
                </span>
              ) : (
                <span className="italic text-slate-400">Not specified by lab</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-0.5 bg-teal-600 inline-block"></span>
              <span>Observed Value</span>
            </div>
            {refLow !== null && refHigh !== null && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <span className="w-3 h-2 bg-emerald-100 border border-emerald-300 inline-block rounded-xs"></span>
                <span>Normal Reference Zone</span>
              </div>
            )}
          </div>
        </div>

        {trendData.length < 2 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs">
              Only {trendData.length} measurement recorded for {selectedTestName}. Multiple dates are needed to display a longitudinal trend.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  dy={5}
                />
                <YAxis 
                  stroke="#64748B" 
                  fontSize={11} 
                  tickLine={false} 
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-md shadow-elevation border border-slate-800 text-xs space-y-1.5 max-w-xs">
                          <div className="font-semibold text-teal-400 font-mono">
                            {data.date}
                          </div>
                          <div className="text-sm font-bold">
                            {data.value} {data.unit}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Reference: {data.refLow ?? '<'} - {data.refHigh ?? '>'} {data.unit}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate pt-1 border-t border-slate-800">
                            Source: {data.sourceDoc}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Shaded Reference Interval if available */}
                {refLow !== null && refHigh !== null && (
                  <ReferenceArea
                    y1={refLow}
                    y2={refHigh}
                    fill="#10B981"
                    fillOpacity={0.08}
                    stroke="#10B981"
                    strokeOpacity={0.2}
                    strokeDasharray="3 3"
                  />
                )}

                {/* Upper and lower lines */}
                {refHigh !== null && (
                  <ReferenceLine
                    y={refHigh}
                    stroke="#D97706"
                    strokeDasharray="3 3"
                    label={{ value: `Ref Max: ${refHigh}`, position: 'right', fill: '#D97706', fontSize: 10 }}
                  />
                )}
                {refLow !== null && (
                  <ReferenceLine
                    y={refLow}
                    stroke="#0284C7"
                    strokeDasharray="3 3"
                    label={{ value: `Ref Min: ${refLow}`, position: 'right', fill: '#0284C7', fontSize: 10 }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0D9488', stroke: '#FFFFFF', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#0F766E' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Clinical Disclaimer */}
        <div className="bg-slate-50 rounded-md p-3 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Analytical Interpretation Note:</strong> Trajectories visualize longitudinal measurement variation. Fluctuations may reflect normal biological variability, time of day, fasting compliance, or differing laboratory assays. Never interpret a trend as medical improvement or progression without clinical evaluation by a licensed healthcare provider.
          </span>
        </div>
      </div>

      {/* Observation Readings Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Recorded Observations for {selectedTestName} ({trendData.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Chronological Order
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Observation Date</th>
                <th className="px-4 py-3">Measured Value</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Reference Interval</th>
                <th className="px-4 py-3">Source Document</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
              {trendData.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 font-mono font-medium text-slate-900">
                    {d.date}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-teal-800">
                    {d.value}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {d.unit}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {d.refLow !== null || d.refHigh !== null ? (
                      `${d.refLow ?? '<'} - ${d.refHigh ?? '>'}`
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-1.5 truncate max-w-xs">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{d.sourceDoc}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedDocumentIdFilter(d.documentId);
                        setActiveScreen('documents');
                      }}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 justify-end ml-auto"
                    >
                      <span>Trace Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )}
</div>
  );
};
